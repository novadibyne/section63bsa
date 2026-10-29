# Legal Sakshya

**https://legalsakshya.com**

A web app for preparing **draft certificates for electronic evidence** under **Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA)**.

Users add evidence files such as photos, audio, video, documents or WhatsApp chat exports. The app computes their SHA-256 hash, extracts technical metadata and produces a draft certificate PDF in the format of the Schedule to Section 63(4)(c):
- **Part A**, filled by the party;
- **Part B**, filled by the expert;
- a **Hash Report** annexure.

> Developed as part of a research paper at **Government Law College, Thiruvananthapuram**.

> **Status:** Phase 1 MVP built, with the additions listed in [Section 3.14 of the specification](docs/SPECIFICATION.md#314-additions-after-phase-1). The name comes from `lib/config.ts` and can be overridden with the `NEXT_PUBLIC_APP_NAME` environment variable.

## Privacy: your evidence stays on your device

**Your evidence and the details you enter never leave your device.**

- Evidence files are hashed, read and turned into the certificate PDF **inside your browser**. They are **never uploaded**. There is no server for them and no login.
- Photos taken to read an IMEI or serial number are read on the device and then **thrown away**. They are never saved or uploaded.
- A Content-Security-Policy (`connect-src`) makes the browser refuse to send data to any other site. The only exception is the usage-statistics worker. The text and barcode readers are served by the site itself, not loaded from a CDN.
- After the first visit the app **works offline**. Anyone can check this: turn on airplane mode and reload. The in-app **Privacy** page walks through it.
- Records stay in your browser's storage. Export a case bundle (`.zip`) to back them up or move them to another computer.

### Usage statistics (optional)

The app reports **how it is used**: visits, unique visitors, certificates started, PDFs made and downloaded, phone scans and installs. These go as OpenTelemetry logs to a Cloudflare Worker (`telemetry/worker/`). The worker adds each visitor's IP address and location and forwards them to Elastic's Managed OTLP Endpoint, where they're kept for 365 days and viewed in Kibana.

It never sends evidence, file names, hashes, names, IMEI or serial numbers, case numbers or PDF contents. The Privacy page describes the statistics whenever they are switched on.

The worker, its settings, the 365-day retention setup, the Kibana dashboard queries and how to move to another Elastic deployment are in **[`telemetry/README.md`](telemetry/README.md)**. To switch statistics off, set the GitHub variable `TELEMETRY_URL` to `off`.

## Features

- Add evidence of several types: images, audio, video, PDFs, WhatsApp exports and any other file
- SHA-256 hashing (NIST FIPS 180-4), with re-verification later. SHA-1 and MD5 are not used: the Schedule's SHA1 and MD5 boxes are printed as part of the statutory form but left unticked
- Automatic metadata extraction (EXIF, media details, PDF info, WhatsApp chat summary)
- Device details as the Schedule asks for: category, make and model, colour, serial number, IMEI/UIN/UID/MAC/Cloud ID
- **Choose what to make** at the start: Part A and Part B, only Part A, or only Part B. The steps, the checks and the PDF follow the choice, and it can be changed until the version is finalised
- **Read the make & model, IMEI 1, IMEI 2 and the serial number from a photo** of the `*#06#` screen, the About phone page or the box label. Barcodes are read first, then the text. Every IMEI is checked with its Luhn check digit; everything found is pre-ticked and filled in with one tap
- A plain-language wizard (5 steps, or 4 for a single part) that produces a PDF with the chosen part(s) and the Hash Report
- **My certificates**: every certificate made in the browser, with its PDF ready to download again at any time
- **Why it matters**: a page tracing the certificate from s.65B and *Anvar P.V.* through *Arjun Panditrao Khotkar* (2020) to Section 63 BSA and *Pune Bar Association* (2026)
- **Made for phones**: works in Safari on iPhone and Chrome on Android, installs as an app from the browser (Add to Home Screen), and shares PDFs through the phone's share sheet (Save to Files, WhatsApp, email)
- A version for each submission, with court and case number
- A hash-chained audit log of every action (Settings › Activity log)
- Export and import of case bundles
- Works offline; no login and no backend; hosted as a static site

Login, cloud storage, expert accounts and payments are planned for later phases.

## Legal notice

This tool **prepares drafts only**. It does not certify anything.

- The Section 63(2) declarations in Part A must be made by the party.
- Part B must be completed and signed by an expert.
- All signatures are added outside the app.
- Check the statutory text against the official [Bharatiya Sakshya Adhiniyam, 2023](https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf) and take legal advice before relying on any certificate.

## Tech stack

Next.js 15 (static export) · TypeScript · Tailwind CSS 4 · IndexedDB (Dexie) · hash-wasm · @react-pdf/renderer · exifr · music-metadata · pdf-lib · JSZip · tesseract.js (OCR) · zxing-wasm (barcodes) · OpenTelemetry logs → Cloudflare Worker → Elastic (usage statistics)

## Open-source licences

Every library is open source under a permissive licence (MIT, Apache-2.0, ISC, BSD or, for fonts, the SIL Open Font License). The full list is in **[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md)**: what is shipped to the browser, the files served from `public/vendor/`, and the build-only tools. Regenerate it after changing dependencies:

```bash
npm run licenses
```

## Development

```bash
npm install
npm run dev       # local development server at http://localhost:3000
npm run test      # unit tests (hashing, statutory text, WhatsApp parser, IMEI/serial parser, audit chain, PDF)
npm run build     # static build in ./out
npx serve out     # preview the static build
```

`npm run dev` and `npm run build` first copy the text and barcode readers into `public/vendor/` (`scripts/copy-scan-assets.mjs`). `npm run build` then writes the offline service worker, `out/sw.js` (`scripts/build-sw.mjs`).

End-to-end browser tests run against the static build served under the GitHub Pages sub-path, with usage statistics pointed at a test address (`https://telemetry.invalid`) that the tests answer themselves:

```bash
NEXT_PUBLIC_TELEMETRY_URL=https://telemetry.invalid NEXT_PUBLIC_BASE_PATH=/section63bsa npm run build
mkdir -p .site && rm -rf .site/section63bsa && cp -r out .site/section63bsa
npx serve .site -l 4173 &
npx playwright install chromium   # first time only
npm run test:e2e
```

They walk through the whole flow: choosing the parts, adding a file, reading both IMEIs and the serial number from a photo, filling Parts A and B, downloading the finalised PDF and downloading it again from My certificates. Other tests read the make & model and barcodes on a box label, and make a Part B–only certificate. The flow tests run three times: desktop, an Android phone (Pixel 7) and an iPhone-sized screen, all in Chromium; Safari's own engine is not part of the automated tests. Another test turns on usage statistics and checks that page views, certificates and PDFs are reported, and that nothing typed or added into the app (names, IMEI, hashes, file names, record IDs) appears in what is sent. They also check that the app works offline, that no request leaves the site except usage statistics, that there are no console or Content-Security-Policy errors, and that pages don't scroll sideways at phone width.

### Project layout

| Path | What it holds |
|---|---|
| `app/` | Pages: home, `evidence/new`, `evidence` (overview), `certificate` (the 5-step wizard), `history` (My certificates), `why`, `privacy`, `audit`, `settings` |
| `components/` | UI building blocks, the drop zone, file cards, wizard steps, the photo scanner, the certificate preview and the Why it matters timeline |
| `lib/legal/schedule-63.ts` | The Schedule text, word for word. The PDF, the preview and a unit test all read from it |
| `lib/legal/case-law.ts` | The plain-language history shown on the Why it matters page |
| `lib/evidence/` | Hashing (in a Web Worker), file-type detection and metadata readers |
| `lib/device-scan/` | Reading IMEIs and serial numbers from a photo: barcode and OCR engines (`scan.ts`) and the parser (`parse.ts`) |
| `lib/pdf/render.tsx` | The certificate PDF: Part A, Part B and the Hash Report annexure |
| `lib/audit/` | The append-only, hash-chained audit log |
| `lib/bundle/` | Case bundle export and import, with SHA-256 verification |
| `lib/actions.ts` | Operations that combine storage, hashing and the audit log |
| `scripts/` | Build helpers: scan engine copy, service worker, licence list |

## Deployment

Every push to `main` is deployed to **GitHub Pages** by `.github/workflows/deploy-pages.yml`. The workflow reads the base path from GitHub Pages itself, so the same build works at `https://novadibyne.github.io/section63bsa/` and at the custom domain.

One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

### Custom domain: legalsakshya.com

1. **At the domain registrar**, add these DNS records:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA (optional) | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
   | CNAME | `www` | `novadibyne.github.io` |

2. **In GitHub**, go to the repo's **Settings → Pages → Custom domain**, enter `legalsakshya.com` and save. When the DNS check passes, tick **Enforce HTTPS**.
3. **Run the deploy again**: **Actions → Deploy to GitHub Pages → Run workflow**. The site is then built for the domain root.
4. Recommended: verify the domain under your GitHub account's **Settings → Pages → Add a domain**, so no one else can point it at their own Pages site.

Steps for AWS Amplify and for S3 + CloudFront are in [Section 4 of the specification](docs/SPECIFICATION.md#4-hosting).

## Documentation

- [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md): requirements, the Section 63 and Schedule field mapping, the statutory text, the build specification and hosting
- [`CONTRIBUTING.md`](CONTRIBUTING.md): development rules
- [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md): open-source licences
- [`telemetry/README.md`](telemetry/README.md): usage statistics with Elastic and Kibana

## Contact

Questions, feedback or privacy requests: [legalsakshya.bsa@gmail.com](mailto:legalsakshya.bsa@gmail.com). The app shows this address in the footer of every page, at the end of Home, on the Privacy page and in Settings › About (`CONTACT_EMAIL` in `lib/config.ts`).
