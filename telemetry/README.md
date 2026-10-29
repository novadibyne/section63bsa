# Usage statistics with Elastic

Legal Sakshya can report **how it is used** to your Elastic deployment: visits, unique visitors, certificates started,
PDFs made and downloaded, phone scans and app installs, with each visitor's **IP address, country, state, city,
browser, operating system and device**. You look at it in **Kibana**.

It never reports evidence, file names, hashes, names, addresses, IMEI or serial numbers, case numbers or PDF
contents. `lib/telemetry.ts` only lets through a fixed list of labels, and an end-to-end test
(`e2e/telemetry.spec.ts`) fails if any detail typed into the app shows up in what is sent.

It uses Elastic's browser agent (**APM Real User Monitoring**, MIT licence). The browser sends events straight to
your deployment's APM endpoint, so there is no server, worker or proxy to run. Statistics are **off** until you set the
endpoint (step 2), and the Privacy page only describes them once they are on.

---

## 1. Turn on browser monitoring in Elastic and copy the endpoint

You do this once per Elastic deployment.

**a) Turn on Real User Monitoring (RUM)**

1. Open **Kibana**. In the search bar at the top, type **Fleet** and open it.
2. Go to the **Agent policies** tab and click **Elastic Cloud agent policy**.
3. In the list of integrations, find **Elastic APM**. Click the **⋯** (Actions) button on its row, then **Edit integration**.
4. Scroll to the **Real User Monitoring** section.
   - Turn on **Enable RUM**.
   - Under **Allowed origins**, add `https://legalsakshya.com` and `https://www.legalsakshya.com` (one per line).
5. Click **Save integration**, then **Save and deploy changes**.

If you can't find Elastic APM in the policy, open your deployment in the Elastic Cloud console
(cloud.elastic.co) → **Edit** and check that **Integrations Server** is enabled.

**b) Copy the APM endpoint**

In the Elastic Cloud console, open your deployment. Under **Applications** (or "Application endpoints"), find
**APM** and click **Copy endpoint**. It looks like
`https://1a2b3c4d5e.apm.asia-south1.gcp.elastic-cloud.com:443`.
It isn't secret: every visitor's browser uses it.

**c) Check it (optional)**

On a Mac or Linux terminal, replace `ENDPOINT` with yours:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "ENDPOINT/intake/v2/rum/events" -H "Origin: https://legalsakshya.com" -H "Content-Type: application/x-ndjson" --data-binary '{"metadata":{"service":{"name":"legal-sakshya","agent":{"name":"rum-js","version":"5.17.5"}}}}'
```

- `202`: ready.
- `403`: RUM isn't enabled yet, or the allowed origins don't include `https://legalsakshya.com`. Check step a.

## 2. Tell the website where to send statistics

1. On GitHub, open the **section63bsa** repository → **Settings** → **Secrets and variables** → **Actions**.
2. Open the **Variables** tab (not Secrets) → **New repository variable**.
3. Name: `APM_SERVER_URL`. Value: the endpoint from step 1b. Click **Add variable**.
4. Go to **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

When the deploy finishes, the website sends statistics and its Privacy page lists what is collected.

## 3. Keep data for 365 days and add a data view

Open Kibana → **Dev Tools**, paste the contents of [`elastic-setup.console`](elastic-setup.console), and run the
requests one by one. The file explains each step and ends with checks.

## 4. See the numbers

**Ready-made:** Kibana → **Observability** → **User Experience** (in newer versions: Applications → User experience),
service `legal-sakshya`. This shows page loads, visitors by country on a map, browsers, operating systems and devices.

**Your own dashboard:** in **Discover**, switch to **ES|QL** (the query-language toggle at the top), paste a query
below and run it. Use the chart icon to choose a chart type, then **Save** → **Add to dashboard**, putting every
panel on one dashboard called "Legal Sakshya". Set the time picker to e.g. *Last 30 days*.

Visits per day:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.name == "page_view"
| STATS visits = COUNT(*) BY day = DATE_TRUNC(1 day, @timestamp)
| SORT day
```

Unique visitors per day:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya"
| STATS visitors = COUNT_DISTINCT(user.id) BY day = DATE_TRUNC(1 day, @timestamp)
| SORT day
```

Visitors by country, and by state and city:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya"
| STATS visitors = COUNT_DISTINCT(user.id) BY client.geo.country_name
| SORT visitors DESC
```
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya"
| STATS visitors = COUNT_DISTINCT(user.id) BY client.geo.region_name, client.geo.city_name
| SORT visitors DESC
| LIMIT 50
```

Certificates started, by parts (both / A / B):
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.name == "certificate_started"
| STATS started = COUNT(*) BY labels.parts
```

PDFs made, draft vs final and by parts:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.name == "pdf_generated"
| STATS pdfs = COUNT(*) BY labels.kind, labels.parts
```

PDFs downloaded or shared:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.name == "pdf_downloaded"
| STATS downloads = COUNT(*) BY labels.kind, labels.via
```

Evidence added, by file type:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.name == "evidence_added"
| STATS files = COUNT(*) BY labels.file_kind
| SORT files DESC
```

Phone scans:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.name == "device_scan"
| STATS scans = COUNT(*) BY labels.model_found, labels.serial_found
```

Phones vs computers, browsers and operating systems:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.type == "page-load"
| STATS visitors = COUNT_DISTINCT(user.id) BY user_agent.device.name, user_agent.os.name, user_agent.name
| SORT visitors DESC
```

Recent activity, with IP address and place:
```esql
FROM traces-apm.rum-*
| WHERE service.name == "legal-sakshya" AND transaction.type == "app-event"
| KEEP @timestamp, transaction.name, labels.parts, labels.kind, labels.via, client.ip, client.geo.country_name, client.geo.region_name, client.geo.city_name, user_agent.name, user_agent.os.name, user.id
| SORT @timestamp DESC
| LIMIT 200
```

**Map of visitors:** Kibana → **Maps** → **Add layer** → **Documents** → data view *Legal Sakshya usage* → geospatial
field `client.geo.location`. Save it to the same dashboard.

## 5. Moving to another Elastic deployment

1. On the new deployment, repeat step 1 (turn on RUM with the allowed origins, copy its endpoint).
2. Paste `elastic-setup.console` into its Dev Tools and run it (step 3).
3. Change the GitHub variable `APM_SERVER_URL` to the new endpoint and run the deploy again (step 2).
4. Re-create the dashboard from the queries above, or export it from the old Kibana (Stack Management → Saved
   objects → Export) and import it into the new one.

Data already collected stays in the old deployment unless you copy it over (snapshot and restore, or reindex).

**Elastic Cloud Serverless:** check that the project accepts RUM (browser) data without an API key before moving.
Serverless projects don't use the retention policy in step 1; they use the `lifecycle` setting in the same file.

## What is sent

| Event | When | Labels |
|---|---|---|
| `page-load` | A page is opened (Elastic adds load timings) | — |
| `page_view` | Any page is shown, including moving between pages | `path` |
| `certificate_started` | "Start" on a new certificate | `parts`: both, A or B |
| `evidence_added` | A file is added | `file_kind`: image, audio, video, document, whatsapp_export, email or other |
| `pdf_generated` | A draft or final PDF is made | `kind`: draft or final, `parts` |
| `pdf_downloaded` | A PDF is downloaded or shared | `kind`, `parts`, `via`: download or share |
| `device_scan` | Phone details are filled in from a photo | `imei_count`, `serial_found`, `model_found` (no values) |
| `app_installed` | The app is installed from the browser | — |
| errors | A JavaScript error in the app | the error message |

Every event also carries a random visitor ID kept in the browser (`user.id`), whether the app is installed
(`labels.installed`) and the page address **without** its query string. Elastic adds `client.ip`, `client.geo.*`
and `user_agent.*`.

Ad-blockers and some privacy browsers block these requests, so the numbers are a minimum.
