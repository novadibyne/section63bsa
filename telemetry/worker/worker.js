// Legal Hashed telemetry proxy (Cloudflare Worker).
//
// The website sends usage statistics here as OpenTelemetry (OTLP/HTTP) logs. This worker checks where they come
// from, adds the visitor's IP address and location (which Cloudflare knows and Elastic otherwise wouldn't see),
// and forwards them to Elastic's Managed OTLP Endpoint with an API key that never reaches the browser.
//
// Settings (Workers → legalsakshya-telemetry → Settings → Variables and Secrets):
//   ELASTIC_OTLP_ENDPOINT  the Managed OTLP endpoint, e.g. https://<project>.ingest.<region>.<provider>.elastic.cloud
//   ELASTIC_API_KEY        secret, the API key: "ApiKey <encoded key>" (the encoded key alone also works)
//   TELEMETRY_LIMITER      optional rate-limit binding (see wrangler.toml)
// Open https://<worker address>/status to check the settings and the connection to Elastic.
// Deploying and testing: telemetry/README.md.

// legalhashed.com, and the app's first address while visitors move over.
const ALLOWED_ORIGINS = new Set([
  "https://legalhashed.com",
  "https://www.legalhashed.com",
  "https://legalsakshya.com",
  "https://www.legalsakshya.com"
]);

const ALLOWED_PATHS = new Set([
  "/v1/traces",
  "/v1/logs",
  "/v1/metrics"
]);

const MAX_BODY_BYTES = 65536; // 64 KiB

const RESOURCE_LISTS = ["resourceLogs", "resourceSpans", "resourceMetrics"];

const SETTINGS_HELP = "Set it in Workers & Pages → legalsakshya-telemetry → Settings → Variables and Secrets, then deploy.";

/**
 * Reads the two Elastic settings, accepting the usual ways of pasting them: with quotes or spaces, as the
 * OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS lines Elastic shows, the endpoint with a path or without
 * https://, and the key with or without "ApiKey " or in the "id:api_key" form.
 * Returns { endpoint, authorization, problems }: problems lists what is missing or wrong.
 */
export function readSettings(env) {
  const clean = (value, name) => typeof value !== "string" ? "" : value
    .trim()
    .replace(new RegExp(`^${name}\\s*=\\s*`, "i"), "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
  const problems = [];

  let endpoint = clean(env.ELASTIC_OTLP_ENDPOINT, "OTEL_EXPORTER_OTLP_ENDPOINT");
  if (!endpoint) {
    problems.push("ELASTIC_OTLP_ENDPOINT is not set");
  } else {
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint)) endpoint = `https://${endpoint}`;
    let target = null;
    try {
      target = new URL(endpoint);
    } catch {
      // reported below
    }
    if (!target || target.protocol !== "https:" ||
        target.username || target.password ||
        !target.hostname.includes(".")) {
      problems.push("ELASTIC_OTLP_ENDPOINT is not a valid https:// address");
      endpoint = "";
    } else {
      // Only the address is used: a path pasted with it, such as /v1/logs, is ignored.
      endpoint = target.origin;
    }
  }

  let key = clean(env.ELASTIC_API_KEY, "OTEL_EXPORTER_OTLP_HEADERS")
    .replace(/^Authorization\s*[:=]\s*/i, "")
    .replace(/^ApiKey(\s+|%20)/i, "")
    .replace(/\s+/g, "");
  let authorization = "";
  if (!key) {
    problems.push("ELASTIC_API_KEY is not set");
  } else {
    // "id:api_key" is the same key before encoding.
    if (key.includes(":")) key = btoa(key);
    authorization = `ApiKey ${key}`;
  }

  return { endpoint, authorization, problems };
}

// OTLP/JSON → OTLP/protobuf for logs. Elastic reads OTLP as protobuf, so the website's JSON logs are converted here
// (after the visitor's details are added). Field numbers are from opentelemetry-proto: collector/logs/v1,
// logs/v1, resource/v1 and common/v1.

const utf8 = new TextEncoder();

function varint(value) {
  let v = BigInt.asUintN(64, BigInt(value));
  const out = [];
  while (v > 0x7fn) {
    out.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  out.push(Number(v));
  return out;
}

const pb = {
  tag: (field, wire) => varint(field * 8 + wire),
  // Length-delimited: strings, bytes and nested messages.
  bytes: (field, data) => [...pb.tag(field, 2), ...varint(data.length), ...data],
  string: (field, text) => typeof text === "string" && text !== "" ? pb.bytes(field, utf8.encode(text)) : [],
  message: (field, data) => data === null ? [] : pb.bytes(field, data),
  uint: (field, n) => Number.isInteger(n) && n > 0 ? [...pb.tag(field, 0), ...varint(n)] : [],
  fixed64(field, value) {
    if (value === undefined || value === null || value === "" || !/^\d+$/.test(String(value))) return [];
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigUint64(0, BigInt(value), true);
    return [...pb.tag(field, 1), ...out];
  },
  fixed32(field, n) {
    if (!Number.isInteger(n) || n === 0) return [];
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, n >>> 0, true);
    return [...pb.tag(field, 5), ...out];
  },
  // OTLP/JSON writes trace and span IDs in hex.
  hex: (field, text) => typeof text === "string" && /^([0-9a-f]{2})+$/i.test(text)
    ? pb.bytes(field, text.match(/../g).map((h) => parseInt(h, 16)))
    : []
};

const asArray = (value) => Array.isArray(value) ? value : [];
const isObject = (value) => value !== null && typeof value === "object";

function anyValue(v) {
  if (!isObject(v)) return null;
  if (typeof v.stringValue === "string") return pb.bytes(1, utf8.encode(v.stringValue));
  if (typeof v.boolValue === "boolean") return [...pb.tag(2, 0), v.boolValue ? 1 : 0];
  if (v.intValue !== undefined && /^-?\d+$/.test(String(v.intValue))) return [...pb.tag(3, 0), ...varint(v.intValue)];
  if (typeof v.doubleValue === "number") {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setFloat64(0, v.doubleValue, true);
    return [...pb.tag(4, 1), ...out];
  }
  if (isObject(v.arrayValue)) {
    return pb.bytes(5, asArray(v.arrayValue.values).flatMap((x) => pb.message(1, anyValue(x) ?? [])));
  }
  if (isObject(v.kvlistValue)) {
    return pb.bytes(6, asArray(v.kvlistValue.values).flatMap((kv) => pb.message(1, keyValue(kv))));
  }
  if (typeof v.bytesValue === "string") {
    return pb.bytes(7, Uint8Array.from(atob(v.bytesValue), (c) => c.charCodeAt(0)));
  }
  return [];
}

function keyValue(kv) {
  if (!isObject(kv) || typeof kv.key !== "string") return null;
  const value = anyValue(kv.value);
  return [...pb.string(1, kv.key), ...(value === null ? [] : pb.message(2, value))];
}

const attributes = (field, items) => asArray(items).flatMap((kv) => pb.message(field, keyValue(kv)));

function logRecord(r) {
  if (!isObject(r)) return null;
  const body = anyValue(r.body);
  return [
    ...pb.fixed64(1, r.timeUnixNano),
    ...pb.uint(2, r.severityNumber),
    ...pb.string(3, r.severityText),
    ...(body === null ? [] : pb.message(5, body)),
    ...attributes(6, r.attributes),
    ...pb.uint(7, r.droppedAttributesCount),
    ...pb.fixed32(8, r.flags),
    ...pb.hex(9, r.traceId),
    ...pb.hex(10, r.spanId),
    ...pb.fixed64(11, r.observedTimeUnixNano),
    ...pb.string(12, r.eventName)
  ];
}

function scopeLogs(s) {
  if (!isObject(s)) return null;
  const scope = isObject(s.scope)
    ? [...pb.string(1, s.scope.name), ...pb.string(2, s.scope.version), ...attributes(3, s.scope.attributes), ...pb.uint(4, s.scope.droppedAttributesCount)]
    : null;
  return [
    ...(scope === null ? [] : pb.message(1, scope)),
    ...asArray(s.logRecords).flatMap((r) => pb.message(2, logRecord(r))),
    ...pb.string(3, s.schemaUrl)
  ];
}

function resourceLogs(rl) {
  if (!isObject(rl)) return null;
  const resource = isObject(rl.resource)
    ? [...attributes(1, rl.resource.attributes), ...pb.uint(2, rl.resource.droppedAttributesCount)]
    : null;
  return [
    ...(resource === null ? [] : pb.message(1, resource)),
    ...asArray(rl.scopeLogs).flatMap((s) => pb.message(2, scopeLogs(s))),
    ...pb.string(3, rl.schemaUrl)
  ];
}

/** Encodes an OTLP/JSON logs request (text) as OTLP/protobuf. Returns null when it isn't a JSON object. */
export function logsJsonToProtobuf(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(payload)) return null;
  return Uint8Array.from(asArray(payload.resourceLogs).flatMap((rl) => pb.message(1, resourceLogs(rl))));
}

/** What Elastic's answer to a test send means, in plain words. */
function explainElastic(status, endpoint) {
  if (status >= 200 && status < 300) return "ok: Elastic accepted the API key";
  if (status === 401) return "Elastic refused the API key (401). Check ELASTIC_API_KEY: it must be the key's encoded value.";
  if (status === 403) return "The API key may not send data (403). Create it with the apm event:write privilege (telemetry/README.md).";
  if (status === 400 || status === 415) return `Elastic couldn't read the data (${status}).`;
  if (status === 404) return `Nothing at ${endpoint}/v1/logs (404). ELASTIC_OTLP_ENDPOINT must be the Managed OTLP endpoint, not the Elasticsearch or Kibana address.`;
  if (status >= 300 && status < 400) return `${endpoint} redirects (${status}). ELASTIC_OTLP_ENDPOINT must be the Managed OTLP endpoint.`;
  return `Elastic answered ${status}.`;
}

/** GET /status: which settings the worker sees and whether Elastic accepts them. Never shows their values. */
async function statusReport(env) {
  const { endpoint, authorization, problems } = readSettings(env);
  const report = {
    ok: false,
    settings_found: Object.keys(env).sort(),
    ELASTIC_OTLP_ENDPOINT: problems.find((p) => p.startsWith("ELASTIC_OTLP_ENDPOINT")) || `ok: ${endpoint}`,
    ELASTIC_API_KEY: problems.find((p) => p.startsWith("ELASTIC_API_KEY")) || "ok: set",
    elastic: problems.length ? `not tried: ${SETTINGS_HELP}` : ""
  };

  if (!problems.length) {
    try {
      const res = await fetch(endpoint + "/v1/logs", {
        method: "POST",
        headers: {
          "Authorization": authorization,
          "Content-Type": "application/x-protobuf"
        },
        // A test with no log records: nothing is stored.
        body: logsJsonToProtobuf(JSON.stringify({
          resourceLogs: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: "legal-sakshya-status-check" } }] } }]
        })),
        redirect: "manual"
      });
      report.elastic = explainElastic(res.status, endpoint);
      report.ok = res.ok;
    } catch {
      report.elastic = `Could not reach ${endpoint}. Check ELASTIC_OTLP_ENDPOINT.`;
    }
  }

  return new Response(JSON.stringify(report, null, 2), {
    status: report.ok ? 200 : 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

/**
 * Adds who sent the data, from Cloudflare's view of the request, to every resource in an OTLP/JSON body:
 * client.address (public IP), client.geo.* (country, region, city, location) and client.as.* (network).
 * Any client.* attributes the browser sent are removed first, so they can't be faked.
 * Returns null when the body isn't valid OTLP JSON.
 */
export function addVisitorDetails(text, request) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;

  const cf = request.cf || {};
  const str = (key, value) => (value ? [{ key, value: { stringValue: String(value) } }] : []);
  const num = (key, value) => (Number.isFinite(Number(value)) && value !== undefined && value !== null && value !== ""
    ? [{ key, value: { doubleValue: Number(value) } }]
    : []);
  const int = (key, value) => (Number.isSafeInteger(Number(value)) && value !== null && value !== ""
    ? [{ key, value: { intValue: String(Number(value)) } }]
    : []);
  const visitor = [
    ...str("client.address", request.headers.get("CF-Connecting-IP")),
    ...str("client.geo.country_iso_code", cf.country),
    ...str("client.geo.region_name", cf.region),
    ...str("client.geo.region_iso_code", cf.regionCode && cf.country ? `${cf.country}-${cf.regionCode}` : ""),
    ...str("client.geo.city_name", cf.city),
    ...str("client.geo.postal_code", cf.postalCode),
    ...str("client.geo.continent_code", cf.continent),
    ...str("client.geo.timezone", cf.timezone),
    ...num("client.geo.location.lat", cf.latitude),
    ...num("client.geo.location.lon", cf.longitude),
    ...int("client.as.number", cf.asn),
    ...str("client.as.organization.name", cf.asOrganization)
  ];

  for (const list of RESOURCE_LISTS) {
    if (!Array.isArray(payload[list])) continue;
    for (const entry of payload[list]) {
      if (!entry || typeof entry !== "object") continue;
      entry.resource = entry.resource && typeof entry.resource === "object" ? entry.resource : {};
      const own = Array.isArray(entry.resource.attributes) ? entry.resource.attributes : [];
      entry.resource.attributes = [
        ...own.filter((a) => !(a && typeof a.key === "string" && a.key.startsWith("client."))),
        ...visitor
      ];
    }
  }
  return JSON.stringify(payload);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    // A page for checking the setup in a browser.
    if (url.pathname === "/status" && request.method === "GET") {
      return statusReport(env);
    }

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin"
    };

    if (!ALLOWED_PATHS.has(url.pathname) ||
        url.search) {
      return new Response("Not found", {
        status: 404,
        headers: cors
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: cors
      });
    }

    let type = request.headers
      .get("Content-Type")?.split(";")[0]
      .trim().toLowerCase();

    if (!["application/x-protobuf", "application/json"]
      .includes(type)) {
      return new Response("Unsupported media type", {
        status: 415,
        headers: cors
      });
    }

    const declared = request.headers.get("Content-Length");
    if (declared !== null &&
        (Number(declared) > MAX_BODY_BYTES ||
         !Number.isSafeInteger(Number(declared)) ||
         Number(declared) < 0)) {
      return new Response("Payload too large", {
        status: 413,
        headers: cors
      });
    }

    let body = await request.arrayBuffer();

    if (body.byteLength > MAX_BODY_BYTES) {
      return new Response("Payload too large", {
        status: 413,
        headers: cors
      });
    }

    // Optional Cloudflare rate-limit binding.
    if (env.TELEMETRY_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP")
        || "unknown";
      const result = await env.TELEMETRY_LIMITER.limit({
        key: ip
      });

      if (!result.success) {
        return new Response("Rate limited", {
          status: 429,
          headers: cors
        });
      }
    }

    const settings = readSettings(env);
    if (settings.problems.length) {
      // Shows in Cloudflare's logs for the worker. Names only, never values.
      console.error(`Proxy not configured: ${settings.problems.join("; ")}. ${SETTINGS_HELP}`);
      return new Response(`Proxy not configured: ${settings.problems.join("; ")}`, {
        status: 503,
        headers: cors
      });
    }

    // The website sends JSON: add the visitor's IP address and location before it goes to Elastic.
    // Protobuf bodies are forwarded as they are.
    if (type === "application/json") {
      const enriched = addVisitorDetails(new TextDecoder().decode(body), request);
      if (enriched === null) {
        return new Response("Bad request", {
          status: 400,
          headers: cors
        });
      }
      body = enriched;
      if (url.pathname === "/v1/logs") {
        body = logsJsonToProtobuf(enriched);
        type = "application/x-protobuf";
        if (body === null) {
          return new Response("Bad request", {
            status: 400,
            headers: cors
          });
        }
      }
    }

    try {
      const upstream = await fetch(
        settings.endpoint + url.pathname,
        {
          method: "POST",
          headers: {
            "Authorization": settings.authorization,
            "Content-Type": type
          },
          body,
          redirect: "manual"
        }
      );

      if (upstream.status >= 300 &&
          upstream.status < 400) {
        console.error(`Elastic: ${explainElastic(upstream.status, settings.endpoint)}`);
        return new Response("Upstream redirect rejected", {
          status: 502,
          headers: cors
        });
      }

      // Keep upstream error details private: they go to the worker's logs only.
      if (!upstream.ok) {
        const detail = (await upstream.text().catch(() => "")).slice(0, 500);
        console.error(`Elastic: ${explainElastic(upstream.status, settings.endpoint)} ${detail}`.trim());
        return new Response("Telemetry rejected", {
          status: 502,
          headers: cors
        });
      }

      return new Response(null, {
        status: 204,
        headers: cors
      });
    } catch (error) {
      console.error(`Could not reach ${settings.endpoint}: ${error}`);
      return new Response("Upstream unavailable", {
        status: 502,
        headers: cors
      });
    }
  }
};
