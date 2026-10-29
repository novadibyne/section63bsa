# Contributing

The full project specification is in [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md). Read it before making changes.

## Development rules

- **Scope:** build Phase 1 only. It's a static, browser-only Next.js app (`output: 'export'`) with no login and no backend. Evidence files must never leave the browser.
- **Statutory text:** the Section 63 Schedule text in Section 2.3 of the specification must be reproduced **word for word** in `lib/legal/schedule-63.ts`. Never paraphrase or auto-generate it.
- **Drafts only:** the app drafts certificates. It must never claim to certify anything. Signature boxes stay blank.
- **Date and time format:** dates are `DD/MM/YYYY`. Times are `HH:MM` in 24-hour IST (`Asia/Kolkata`).
- **Static export limits:** no API routes, server actions, middleware or dynamic route segments. Use query strings such as `/evidence/?id=…`.
- **Deployment:** GitHub Pages, through the workflow in Section 4.1 of the specification.
- **Changes to the specification:** discuss them before departing from it.
- **Dependencies:** only open-source libraries under permissive licences (MIT, Apache-2.0, ISC, BSD, OFL for fonts). After adding, removing or upgrading one, run `npm run licenses -- --check` and commit the updated `THIRD_PARTY_LICENSES.md`.
- **No CDNs:** if a library downloads code or data at run time (a worker, WebAssembly, a model), copy those files into `public/vendor/` in `scripts/copy-scan-assets.mjs` and point the library there. The CSP blocks everything else.
- **Photos for device IDs** are read and discarded. Never store, hash or log them.

## Before opening a pull request

- `npm run test` passes.
- `npm run build` produces a working static site in `out/`.
- No request in the browser Network tab carries file content.
