# Section 63 BSA Certificate Tool

A web app for preparing **draft certificates for electronic evidence** under **Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA)**.

Users add evidence files such as photos, audio, video, documents or WhatsApp chat exports. The app computes their hashes (SHA-256, SHA-1, MD5), extracts technical metadata and produces a draft certificate PDF in the format of the Schedule to Section 63(4)(c):
- **Part A**, filled by the party;
- **Part B**, filled by the expert;
- a **Hash Report** annexure.

> Developed as part of a research paper at **Government Law College, Thiruvananthapuram**.

> **Status:** Phase 1 MVP built. The app is called **Sakshya63** for now; change the name with the `NEXT_PUBLIC_APP_NAME` environment variable or in `lib/config.ts`. See [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md).

## Privacy

Phase 1 runs **entirely in your browser**. Evidence files are hashed and processed on your own device and are **never uploaded** to any server. Your data stays in your browser's storage. You can export it as a case bundle (`.zip`) for backup or to move it to another computer.

## Features (Phase 1)

- Add evidence of several types: images, audio, video, PDFs, WhatsApp exports and any other file
- SHA-256, SHA-1 and MD5 hashing in one pass, with re-verification later
- Automatic metadata extraction (EXIF, media details, PDF info, WhatsApp chat summary)
- Device details as the Schedule asks for: category, make and model, colour, serial number, IMEI/UIN/UID/MAC/Cloud ID
- A certificate wizard that produces a PDF with Part A, Part B and the Hash Report
- A version for each submission, with court and case number
- A hash-chained audit log of every action
- Export and import of case bundles
- No login and no backend; hosted as a static site

Login, cloud storage, expert accounts and payments are planned for later phases.

## Legal notice

This tool **prepares drafts only**. It does not certify anything.

- The Section 63(2) declarations in Part A must be made by the party.
- Part B must be completed and signed by an expert.
- All signatures are added outside the app.
- Check the statutory text against the official [Bharatiya Sakshya Adhiniyam, 2023](https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf) and take legal advice before relying on any certificate.

## Tech stack

Next.js 15 (static export) · TypeScript · Tailwind CSS 4 · IndexedDB (Dexie) · hash-wasm · @react-pdf/renderer · exifr · music-metadata · pdf-lib · JSZip

## Development

```bash
npm install
npm run dev       # local development server at http://localhost:3000
npm run test      # unit tests (hashing, statutory text, WhatsApp parser, audit chain, PDF)
npm run build     # static build in ./out
npx serve out     # preview the static build
```

End-to-end browser tests run against the static build served under the GitHub Pages sub-path:

```bash
NEXT_PUBLIC_BASE_PATH=/section63bsa npm run build
mkdir -p .site && rm -rf .site/section63bsa && cp -r out .site/section63bsa
npx serve .site -l 4173 &
npx playwright install chromium   # first time only
npm run test:e2e
```

They walk through the whole flow, from adding a file to downloading the finalised PDF. They also check that no request leaves the site, that there are no console or Content-Security-Policy errors, and that pages don't scroll sideways at phone width.

### Project layout

| Path | What it holds |
|---|---|
| `app/` | Pages: dashboard, `evidence/new`, `evidence` (overview), `certificate` (the 5-step wizard), `audit`, `settings` |
| `components/` | UI building blocks, the drop zone, file cards, wizard steps and the certificate preview |
| `lib/legal/schedule-63.ts` | The Schedule text, word for word. The PDF, the preview and a unit test all read from it |
| `lib/evidence/` | Hashing (in a Web Worker), file-type detection and metadata readers |
| `lib/pdf/render.tsx` | The certificate PDF: Part A, Part B and the Hash Report annexure |
| `lib/audit/` | The append-only, hash-chained audit log |
| `lib/bundle/` | Case bundle export and import, with SHA-256 verification |
| `lib/actions.ts` | Operations that combine storage, hashing and the audit log |

## Deployment

Every push to `main` is deployed to **GitHub Pages** by `.github/workflows/deploy-pages.yml`:

**https://novadibyne.github.io/section63bsa/**

One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

Steps for AWS Amplify and for S3 + CloudFront are in [Section 4 of the specification](docs/SPECIFICATION.md#4-hosting).

## Documentation

- [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md): requirements, the Section 63 and Schedule field mapping, the statutory text, the build specification and hosting
- [`CONTRIBUTING.md`](CONTRIBUTING.md): development rules
