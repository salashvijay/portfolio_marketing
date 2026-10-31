# Vihsm Labs: free browser-only compliance tools

Live (once deployed): `https://labs.vihsmai.com`

| Page | Tool | Leads to (paid offer) |
|---|---|---|
| `deadlines.html` | Compliance deadline radar (`data/deadlines.json`) | All offers |
| `einvoice.html` | UBL e-invoice checker, EN 16931 core fields and totals (`js/einvoice.js`) | Invoice to E-Invoice |
| `bias.html` | Selection/scoring rates and impact ratios, NYC LL144 method (`js/impact.js`) | AI Bias Audit |
| `keys.html` | Leaked-key scanner for the user's own code (`js/secrets.js`) | Vibe App Security Audit |
| `ai-disclosure.html` | EU AI Act Article 50 disclosure generator | AI Transparency Pack |

## Principles (don't break these)
- **Everything runs in the visitor's browser.** No uploads, no cookies, no analytics, no third-party scripts. The CSP in `nginx.conf` enforces this, and nginx keeps no access log.
- **Honest limits on every page.** "Information, not legal advice", what the tool does *not* check, and sources for every claim.
- **No scanning of other people's sites.** The key scanner reads only files the visitor selects or pastes.
- Every deadline in `data/deadlines.json` has an `https` source, a `confidence` of `official` or `press`, and the file has a `checked` date.

## Test
```
npm install
npm test        # logic tests + simulated-browser tests of every page
```

## Deploy (Coolify)
1. Porkbun DNS: A record `labs` → `178.105.217.96`.
2. GitHub: private repo `vihsm_labs`; push this folder.
3. Coolify: New resource → this repo → Build pack **Dockerfile** → port **80** → domain `https://labs.vihsmai.com` → Auto Deploy on.

## Weekly upkeep (done by the autopilot)
- **Deadlines:** re-check each item against its source. Update `date`, `status` and `checked`, and add new mandates. Use only official sources, or mark the item `press`.
- **One new tool a week** from the backlog, with tests, then add it to `index.html` and `sitemap.xml`.

### Tool backlog
1. CII (Factur-X / ZUGFeRD) support in the e-invoice checker
2. Peppol participant lookup explainer (how to find a buyer's Peppol ID)
3. India GST e-invoice 30-day IRP deadline calculator
4. WCAG quick check for a pasted HTML snippet (contrast, alt text, labels)
5. DPDP consent-notice generator (India)
6. Duplicate invoice finder for a pasted CSV (invoice number, amount, date, supplier)
