// Legal Sakshya telemetry proxy (Cloudflare Worker).
//
// The website sends usage statistics here as OpenTelemetry (OTLP/HTTP) logs. This worker checks where they come
// from, adds the visitor's IP address and location (which Cloudflare knows and Elastic otherwise wouldn't see),
// and forwards them to Elastic's Managed OTLP Endpoint with an API key that never reaches the browser.
//
// Settings (Workers → legalsakshya-telemetry → Settings → Variables and Secrets):
//   ELASTIC_OTLP_ENDPOINT  the Managed OTLP endpoint, e.g. https://<project>.ingest.<region>.<provider>.elastic.cloud
//   ELASTIC_API_KEY        secret, the whole Authorization header value: "ApiKey <encoded key>"
//   TELEMETRY_LIMITER      optional rate-limit binding (see wrangler.toml)
// Deploying and testing: telemetry/README.md.

const ALLOWED_ORIGINS = new Set([
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
    ...num("client.as.number", cf.asn),
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

    const type = request.headers
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

    if (!env.ELASTIC_OTLP_ENDPOINT ||
        !env.ELASTIC_API_KEY) {
      return new Response("Proxy not configured", {
        status: 503,
        headers: cors
      });
    }

    const endpoint = env.ELASTIC_OTLP_ENDPOINT
      .replace(/\/+$/, "");

    const target = new URL(endpoint);
    if (target.protocol !== "https:" ||
        target.username || target.password ||
        target.search || target.hash ||
        (target.pathname !== "/" && target.pathname !== "")) {
      return new Response("Invalid upstream config", {
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
    }

    try {
      const upstream = await fetch(
        target.origin + url.pathname,
        {
          method: "POST",
          headers: {
            "Authorization": env.ELASTIC_API_KEY,
            "Content-Type": type,
            "Accept": "application/json"
          },
          body,
          redirect: "manual"
        }
      );

      if (upstream.status >= 300 &&
          upstream.status < 400) {
        return new Response("Upstream redirect rejected", {
          status: 502,
          headers: cors
        });
      }

      // Keep upstream error details private.
      if (!upstream.ok) {
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
      return new Response("Upstream unavailable", {
        status: 502,
        headers: cors
      });
    }
  }
};
