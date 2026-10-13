# CLAUDE.md

The full project specification is in `CLAUDE_CODE_BRIEF.md`. Read it before writing any code.

- Build **Phase 1** only: a static, browser-only Next.js app (`output: 'export'`). No login, no backend, and evidence files never leave the browser.
- The Section 63 Schedule text in section 2.3 of the brief must be reproduced **word for word** in `lib/legal/schedule-63.ts`. Never paraphrase or generate it.
- The app drafts certificates. It must never claim to certify anything. Signature boxes stay blank.
- Print dates as `DD/MM/YYYY` and times as `HH:MM` in 24-hour IST (`Asia/Kolkata`).
- Deploy to GitHub Pages with the workflow in section 4.1 of the brief.
- Ask before deviating from the brief.
