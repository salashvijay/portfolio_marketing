# CLAUDE.md: Vihsm Labs

Free, browser-only compliance tools for Vihsm (the Owner is Vijaya Kumar Sala). Target address: `https://labs.vihsmai.com`. Each tool is a lead magnet for a paid Vihsm offer (see README).

## Hard rules
- **Everything runs in the visitor's browser.** No uploads, no server code, no cookies, no analytics, no third-party scripts, fonts or CDNs. No inline `<script>`: the CSP in `nginx.conf` blocks it, so page code goes in `js/ui-*.js`. Shared logic goes in `js/<tool>.js`, written UMD-style so the Node tests can `require` it.
- **Honest pages.** Every tool page says "information, not legal advice", says what it does *not* check, and cites sources. No guarantees, no invented statistics. Use only facts verified against official sources, or label them as from the press.
- **Never scan or fetch other people's sites or data.** Tools work only on what the visitor pastes or selects.
- Every item in `data/deadlines.json` needs a date, an `https` source and a `confidence` of `official` or `press`. Update `checked` when you re-verify.
- Escape all user input before putting it in HTML.
- Keep the look consistent: same header and nav, `css/site.css`, a `.cta` block linking to the matching paid offer, the footer, and title, description and Open Graph tags.

## Working
- Tests: `npm test` (logic tests plus simulated-browser tests in `tests/pages.test.js`). Every new tool gets both kinds. Tests must pass before a commit.
- New tool checklist: page plus `js/` logic plus a UI file → tests → add it to the nav on every page, the `index.html` card grid, `sitemap.xml` and the `Dockerfile` COPY line → `npm test` → commit.
- **Don't push.** Pushing goes live (Coolify auto-deploys), so the Owner approves first. Ask him in the tracker: `python ../marketting/marketing/tracker/ai_update.py ask X18 "Push Vihsm Labs update?" "<what changed>" --push vihsm_labs <sha>`.
- Record work in the shared tracker: `python ../marketting/marketing/tracker/ai_update.py note X18 "<what you did>"` and `... log "<one line>"`.
- Backlog: README → "Tool backlog".
