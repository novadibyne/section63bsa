# Section 63 BSA Certificate Tool

A web app for preparing **draft certificates for electronic evidence** under **Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA)**.

Users add evidence files such as photos, audio, video, documents or WhatsApp chat exports. The app computes their hashes (SHA-256, SHA-1, MD5), extracts technical metadata and produces a draft certificate PDF in the format of the Schedule to Section 63(4)(c):
- **Part A**, filled by the party;
- **Part B**, filled by the expert;
- a **Hash Report** annexure.

> **Status:** in development (Phase 1 MVP). See [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md).

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

Next.js (static export) · TypeScript · Tailwind CSS · shadcn/ui · IndexedDB (Dexie) · hash-wasm · @react-pdf/renderer

## Development

```bash
npm install
npm run dev       # local development server
npm run test      # unit tests
npm run build     # static build in ./out
npx serve out     # preview the static build
```

## Deployment

Every push to `main` is deployed to **GitHub Pages** by `.github/workflows/deploy-pages.yml`:

**https://novadibyne.github.io/section63bsa/**

One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

Steps for AWS Amplify and for S3 + CloudFront are in [Section 4 of the specification](docs/SPECIFICATION.md#4-hosting).

## Documentation

- [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md): requirements, the Section 63 and Schedule field mapping, the statutory text, the build specification and hosting
- [`CONTRIBUTING.md`](CONTRIBUTING.md): development rules
