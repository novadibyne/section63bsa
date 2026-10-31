# Usage statistics with Elastic

Legal Hashed reports **how it is used** to Elastic: visits, unique visitors, certificates started, files added,
PDFs made and downloaded, phone scans, app installs and app errors. Each visitor's **IP address, country, state and
city, network, browser, operating system and device type** come with them. You look at it in **Kibana**.

It never reports evidence, file names, hashes, names, addresses, IMEI or serial numbers, case numbers or PDF
contents. `lib/telemetry.ts` only lets through a fixed list of labels, and an end-to-end test
(`e2e/telemetry.spec.ts`) fails if any detail typed into the app shows up in what is sent.

## How it works

```
Website (browser) ──OTLP/JSON logs──▶ Cloudflare Worker ──▶ Elastic Managed OTLP Endpoint ──▶ Kibana
                      /v1/logs         legalhashed-telemetry    (API key added here)       logs-legal_hashed.otel-default
```

- **The website** batches events and posts them as OpenTelemetry logs to
  `https://legalhashed-telemetry.novadibyne.workers.dev/v1/logs`. The address is set in `lib/config.ts`.
- **The worker** ([`worker/worker.js`](worker/worker.js)) only accepts requests from legalhashed.com (and the app's first address, legalsakshya.com) and caps their
  size. It adds the visitor's IP address and location, which Cloudflare knows and Elastic would otherwise never see,
  converts the logs to OTLP protobuf (the encoding Elastic reads) and forwards them to Elastic with the API key. The
  key never reaches the browser.
- **Elastic** stores the events in their own data stream, `logs-legal_hashed.otel-default`.

---

## 1. The worker

**Deploy or update it.** After any change to `worker/worker.js`, deploy it again. The version here adds the
visitor's IP and location; without it, Elastic only sees Cloudflare's address.

- In the Cloudflare dashboard: **Workers & Pages** → **legalhashed-telemetry** → **Edit code**. Replace everything
  with the contents of [`worker/worker.js`](worker/worker.js), then click **Deploy**. Or:
- From a computer: `cd telemetry/worker && npx wrangler deploy`. This keeps the settings made in the dashboard.

**Its two settings** (Workers & Pages → legalhashed-telemetry → **Settings** → **Variables and Secrets** → **Add**,
then **Deploy**). Use the runtime *Variables and Secrets* section, not *Build* → *Variables and secrets*; the worker
can't see build variables. The names must be exactly these:

| Name | Type | Value |
|---|---|---|
| `ELASTIC_OTLP_ENDPOINT` | Text or Secret | Your deployment's **Managed OTLP endpoint**, e.g. `https://….ingest.….elastic.cloud`. |
| `ELASTIC_API_KEY` | Secret | The key's **encoded** value, with or without `ApiKey ` in front. |

To create the API key, open Kibana → **Dev Tools** and run:

```
POST /_security/api_key
{
  "name": "legal-hashed-telemetry-worker",
  "role_descriptors": {
    "otlp-write": {
      "applications": [{ "application": "apm", "privileges": ["event:write"], "resources": ["*"] }]
    }
  }
}
```

Copy `encoded` from the response. The secret is `ApiKey ` plus that value.

**Optional rate limit:** uncomment the `[[ratelimits]]` lines in [`worker/wrangler.toml`](worker/wrangler.toml)
(120 requests a minute per IP) and deploy with wrangler.

**Check it** by opening <https://legalhashed-telemetry.novadibyne.workers.dev/status> in a browser. It shows the
settings the worker can see (names only, never values) and sends Elastic an empty test. `"ok": true` means it works.

| The status page says | Fix |
|---|---|
| `ELASTIC_OTLP_ENDPOINT is not set` or `ELASTIC_API_KEY is not set` | The setting is missing, misnamed (see `settings_found`) or under *Build* variables. Add it as above and click **Deploy**. |
| `not a valid https:// address` | Paste the Managed OTLP endpoint as shown in Elastic, starting `https://`. |
| `Elastic refused the API key (401)` | Paste the key's **encoded** value again, or create a new key. |
| `may not send data (403)` | Create the key with the `event:write` privilege shown above. |
| `couldn't read the data (400 or 415)` | Make sure Cloudflare is running the latest `worker/worker.js` (it sends protobuf). |
| `Nothing at …/v1/logs (404)` or `redirects` | That is the Elasticsearch or Kibana address. Use the **Managed OTLP endpoint**. |

When the website's requests fail, the worker also writes the reason to its logs (Workers & Pages →
legalhashed-telemetry → **Logs**). Each failed request shows `503` (a setting is missing) or `502` (Elastic refused it).

Or check from a Mac or Linux terminal. You should see `204`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://legalhashed-telemetry.novadibyne.workers.dev/v1/logs -H "Origin: https://legalhashed.com" -H "Content-Type: application/json" --data '{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"legal-hashed"}},{"key":"data_stream.dataset","value":{"stringValue":"legal_hashed"}}]},"scopeLogs":[{"logRecords":[{"body":{"stringValue":"setup_check"},"attributes":[{"key":"event.name","value":{"stringValue":"setup_check"}}]}]}]}]}'
```

`403` means the Origin isn't allowed, `503` means a setting is missing, and `502` means Elastic refused it. The
status page and the worker's logs say why.

## 2. The website

Statistics are **on** and go to the worker above. You only need to change something to use another worker, or to
switch them off. On GitHub, open **section63bsa** → **Settings** → **Secrets and variables** → **Actions** →
**Variables**, set `TELEMETRY_URL` to the other worker's address (or to `off`), then run **Actions** →
**Deploy to GitHub Pages**.

## 3. Keep data for 365 days

Elastic keeps logs forever by default. To delete usage statistics after 365 days:

1. In Kibana → **Dev Tools**, create a short-lived setup key:
   ```
   POST /_security/api_key
   {
     "name": "legal-hashed-retention-setup",
     "expiration": "1d",
     "role_descriptors": {
       "setup": {
         "cluster": ["monitor", "manage_ilm", "manage_index_templates"],
         "indices": [{ "names": ["logs-legal_hashed.otel-*"], "privileges": ["manage", "view_index_metadata"] }]
       }
     }
   }
   ```
2. On GitHub: **Settings** → **Secrets and variables** → **Actions** → **Secrets**, and add:
   - `ELASTIC_URL`: your **Elasticsearch** endpoint (Elastic Cloud console → your deployment → Elasticsearch → Copy endpoint);
   - `ELASTIC_SETUP_API_KEY`: the `encoded` value from step 1.
3. **Actions** → **Set up Elastic retention** → **Run workflow**. Tick *Only show what would change* first if you
   like, then run it for real.

The script ([`setup-retention.mjs`](setup-retention.mjs)) creates the policy `legal-hashed-365-days` and an index
template for `logs-legal_hashed.otel-*` only, copied from the one Elastic would use. It never changes other data.
It can run before or after the first events arrive.

## 4. See the numbers in Kibana

**Import the ready-made dashboard.** Download
[`kibana/legal-hashed-dashboard.ndjson`](kibana/legal-hashed-dashboard.ndjson) (on GitHub: open it, then
**Download raw file**). In Kibana open **Stack Management** → **Saved objects** → **Import**, choose the file, keep
*Check for existing objects* → *Automatically overwrite conflicts*, and click **Import**. Then open **Dashboards** →
**Legal Hashed usage**.

| Panel | Shows |
|---|---|
| Unique IP addresses · Visits · PDF certificates made | Totals for the chosen time range (30 days to start with) |
| **Visitors by IP address** (right-hand side) | Each public IP address with its country, city, visits (pages opened), PDFs made and when it was last seen, most visits first |
| **Where visitors are** | Map with a heat map of visitor locations and circles showing the number of unique IP addresses in each place. Zoom in for cities |
| **When people visit (Indian time)** | Heatmap of visits by day of the week and hour |
| Visitors by country · by state / region | Unique IP addresses per country and per state |
| Visits and unique IPs per day | Daily trend |
| **Certificates made** | One row per PDF made (draft or final), newest first: draft or final, parts (both, A or B), kind of evidence, kinds of file, number of files, kind of device, device maker, kind of court, Part A boxes, whether the observations annexure was attached, whether every detail was filled in, version, city and state |
| Certificates by part · Kind of evidence · Kinds of file · Kind of device · Device maker · Kind of court · Part A: how the device is held | Certificates counted by each of these, drafts included; a certificate counts once however many PDFs are made |
| Certificates per day | Certificates worked on, and those finalised, per day |

Click any IP, country, city or map circle to filter the whole dashboard to it. Each certificate counts once, by the
random ID the browser gave it, whether it has only drafts or has been finalised. Click a row's arrow in
*Certificates made* to see every label sent with it. The details are only sent with PDFs made after
30 October 2026: earlier rows only have *Draft or final* and *Parts*, and the charts leave them out. The import also adds the data view
*Legal Hashed usage* (`logs-legal_hashed.otel-*` and `logs-legal_sakshya.otel-*`, where statistics went before the app was
renamed). It works on Elastic Cloud 9.0 and later, and was tested on
Kibana 9.0.8 and 9.5.5 with data sent through the worker. The dashboard is built by
[`kibana/build-dashboard.mjs`](kibana/build-dashboard.mjs): change it there, run
`node telemetry/kibana/build-dashboard.mjs > telemetry/kibana/legal-hashed-dashboard.ndjson`, and import again.

**Your own charts:** in **Discover**, switch to **ES|QL**, paste a query below and run it. Use the chart icon to pick
a chart, then **Save** → **Add to dashboard**.

Visits per day:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| WHERE attributes.event.name == "page_view"
| STATS visits = COUNT(*) BY day = DATE_TRUNC(1 day, @timestamp)
| SORT day
```

Unique visitors per day:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| STATS visitors = COUNT_DISTINCT(resource.attributes.user.id) BY day = DATE_TRUNC(1 day, @timestamp)
| SORT day
```

Visitors by country, and by state and city:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| STATS visitors = COUNT_DISTINCT(resource.attributes.user.id) BY resource.attributes.client.geo.country_iso_code
| SORT visitors DESC
```
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| STATS visitors = COUNT_DISTINCT(resource.attributes.user.id) BY resource.attributes.client.geo.region_name, resource.attributes.client.geo.city_name
| SORT visitors DESC
| LIMIT 50
```

Certificates started, by parts (both / A / B):
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| WHERE attributes.event.name == "certificate_started"
| STATS started = COUNT(*) BY attributes.legal_hashed.parts
```

PDFs made, draft vs final and by parts:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| WHERE attributes.event.name == "pdf_generated"
| STATS pdfs = COUNT(*) BY attributes.legal_hashed.kind, attributes.legal_hashed.parts
```

What kind of certificates are made (every PDF, draft or final):
```esql
FROM logs-legal_hashed.otel-*
| WHERE attributes.event.name == "pdf_generated"
| KEEP @timestamp, attributes.legal_hashed.kind, attributes.legal_hashed.parts, attributes.legal_hashed.evidence_type, attributes.legal_hashed.file_kinds,
    attributes.legal_hashed.file_count, attributes.legal_hashed.device_types, attributes.legal_hashed.device_makers,
    attributes.legal_hashed.court_type, resource.attributes.client.geo.city_name
| SORT @timestamp DESC
```
```esql
FROM logs-legal_hashed.otel-*
| WHERE attributes.event.name == "pdf_generated" AND attributes.legal_hashed.certificate_id IS NOT NULL
| STATS certificates = COUNT_DISTINCT(attributes.legal_hashed.certificate_id) BY attributes.legal_hashed.parts, attributes.legal_hashed.evidence_type
| SORT certificates DESC
```

PDFs downloaded or shared:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| WHERE attributes.event.name == "pdf_downloaded"
| STATS downloads = COUNT(*) BY attributes.legal_hashed.kind, attributes.legal_hashed.via
```

Evidence added, by file type:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| WHERE attributes.event.name == "evidence_added"
| STATS files = COUNT(*) BY attributes.legal_hashed.file_kind
| SORT files DESC
```

Phone scans:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| WHERE attributes.event.name == "device_scan"
| STATS scans = COUNT(*) BY attributes.legal_hashed.model_found, attributes.legal_hashed.serial_found
```

Phones, tablets and computers; browsers and systems:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| STATS visitors = COUNT_DISTINCT(resource.attributes.user.id) BY resource.attributes.device.type, resource.attributes.os.name, resource.attributes.browser.name
| SORT visitors DESC
```

Networks (internet providers):
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| STATS visitors = COUNT_DISTINCT(resource.attributes.user.id) BY resource.attributes.client.as.organization.name
| SORT visitors DESC
| LIMIT 20
```

Recent activity, with IP address and place:
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| KEEP @timestamp, attributes.event.name, attributes.url.path, attributes.legal_hashed.parts, attributes.legal_hashed.kind, resource.attributes.client.address, resource.attributes.client.geo.country_iso_code, resource.attributes.client.geo.region_name, resource.attributes.client.geo.city_name, resource.attributes.device.type, resource.attributes.browser.name, resource.attributes.user.id
| SORT @timestamp DESC
| LIMIT 200
```

App errors (the kind of error only):
```esql
FROM logs-legal_hashed.otel-*, logs-legal_sakshya.otel-*
| WHERE attributes.event.name == "app_error"
| STATS errors = COUNT(*) BY attributes.legal_hashed.error_type, attributes.url.path
```

**Map of countries:** Kibana → **Maps** → **Add layer** → **Choropleth** → boundaries **World Countries**, join field
**ISO 3166-1 alpha-2 code** → data view *Legal Hashed usage*, term field
`resource.attributes.client.geo.country_iso_code`. Save it to the same dashboard.

If a field name in a query isn't found, open **Discover** with the *Legal Hashed usage* data view and copy the field
name exactly as your Kibana shows it.

## After the rename from Legal Sakshya

The app, its worker and its data in Elastic used to be called Legal Sakshya (`legal_sakshya`, `legal-sakshya`). New
statistics now go to `logs-legal_hashed.otel-default`. To finish the move in Elastic, once:

1. **Retention:** create a new setup key (step 3; it now names `logs-legal_hashed.otel-*`), update the
   `ELASTIC_SETUP_API_KEY` secret and run **Set up Elastic retention** again.
2. **Dashboard:** import [`kibana/legal-hashed-dashboard.ndjson`](kibana/legal-hashed-dashboard.ndjson) (step 4). Then in
   **Stack Management** → **Saved objects**, search for `Legal Sakshya`, tick the old dashboard, data view,
   visualizations and map, and **Delete** them.

Statistics collected before the rename stay in `logs-legal_sakshya.otel-default` and are still counted by the new
dashboard and the queries below; that stream keeps its own 365-day retention.

## 5. Moving to another Elastic deployment

1. In the new deployment, create the worker's API key (step 1), set up retention (step 3, with that deployment's
   `ELASTIC_URL` and a new setup key) and import the dashboard (step 4).
2. In Cloudflare, change the worker's `ELASTIC_OTLP_ENDPOINT` and `ELASTIC_API_KEY`.

The website doesn't change. Data already collected stays in the old deployment unless you copy it over (snapshot
and restore, or reindex). On Elastic Cloud Serverless the same steps work. The retention script then uses the data
stream lifecycle instead of an ILM policy.

## What is sent

| Event (`event.name`) | When | Attributes |
|---|---|---|
| `page_view` | Any page is shown | `url.path` |
| `certificate_started` | "Start" on a new certificate | `legal_hashed.parts`: both, A or B |
| `evidence_added` | A file is added | `legal_hashed.file_kind`: image, audio, video, document, whatsapp_export, email or other |
| `pdf_generated` | A draft or final PDF is made | `legal_hashed.kind`: draft or final, and what kind of certificate it is (below) |
| `pdf_downloaded` | A PDF is downloaded or shared | `legal_hashed.kind`, `legal_hashed.parts`, `legal_hashed.via`: download or share |
| `device_scan` | Phone details are filled in from a photo | `legal_hashed.imei_count`, `legal_hashed.serial_found`, `legal_hashed.model_found` (no values) |
| `app_installed` | The app is installed from the browser | — |
| `app_error` | A JavaScript error in the app | `legal_hashed.error_type` (e.g. TypeError; never the message) |

What kind of certificate a PDF is (`lib/legal/certificate-summary.ts`). Only values from fixed lists, counts and
yes/no; never names, addresses, file names, hashes, IMEI or serial numbers, case numbers, court names or other text
typed into the app:

| Attribute | Values |
|---|---|
| `legal_hashed.certificate_id` | A random ID the browser gave the certificate, so its drafts and final PDF count as one |
| `legal_hashed.parts` | both, A or B |
| `legal_hashed.version` | Version number of the certificate |
| `legal_hashed.evidence_type` | Kind of the first file: image, audio, video, document, whatsapp_export, email or other |
| `legal_hashed.file_kinds` | Every kind of file in the certificate, sorted and joined with +, e.g. image+whatsapp_export |
| `legal_hashed.file_count`, `legal_hashed.archive_files`, `legal_hashed.total_kb` | Number of files, files inside archives (e.g. a WhatsApp .zip) and total size in KB |
| `legal_hashed.device_count`, `legal_hashed.device_types` | Number of devices, and the Schedule's device boxes ticked: mobile, computer_storage_media, dvr, flash_drive, cd_dvd, server, cloud, other |
| `legal_hashed.device_makers` | Maker found in the make & model from a fixed list (samsung, apple, xiaomi, dell, hikvision…); other if not recognised, not_given if blank. Never the model |
| `legal_hashed.id_types` | Kinds of device ID given (imei, mac, cloud_id…), never the numbers |
| `legal_hashed.control` | Part A boxes: owned, maintained, managed, operated (only with Part A) |
| `legal_hashed.court_type` | Kind of court worked out in the browser from the court name: supreme_court, high_court, family_court, consumer_commission, tribunal, arbitration, sessions_court, magistrate, civil_court, district_court, commercial_court, special_court, other or not_given |
| `legal_hashed.case_number_given`, `legal_hashed.manner_given` | Whether a case number and the manner of production were filled in |
| `legal_hashed.acquisition_hash` | none, match or differs |
| `legal_hashed.observations_annexure`, `legal_hashed.observations_noted` | Whether the observations annexure was attached, and how many observations were noted |
| `legal_hashed.complete` | Whether every required detail was filled in |

Every batch also carries (as resource attributes) `service.name`, `service.version`, a random visitor ID kept in the
browser (`user.id`), `user_agent.original`, `browser.name`, `os.name`, `device.type`, `browser.language` and
`app.installed`. The worker adds `client.address` (IP), `client.geo.*` and `client.as.*`.

Events are sent in small batches, every few seconds and when the page is hidden. Ad-blockers and some privacy
browsers block them, so the numbers are a minimum.
