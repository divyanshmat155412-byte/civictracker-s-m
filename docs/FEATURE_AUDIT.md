# Civic Tracker — Feature Compliance Audit (5 Nov 2026)

Legend: PRE = existed in the imported pre-hackathon code · NEW = added in the prototype round.
"Tested" = exercised against the live database by `scripts/e2e-civic-flow.ts` (21/21 checks pass) or in the browser.

| # | Feature | Status | Origin | Evidence |
|---|---|---|---|---|
| 1 | Photo + GPS + voice complaint | Implemented & tested (DB insert); voice uses browser speech | PRE | e2e insert; form renders |
| 2 | Department routing | Implemented & tested | NEW (was manual) | broken-road → Public Works automatically |
| 2 | Deadlines | Implemented & tested | NEW stored deadline (PRE countdown display) | due_at = now + SLA hours, emergency ≤ 12 h |
| 3 | Officer dashboard | Partial — existing admin dashboard; officers (Municipal Officer role) now get city-scoped edit rights | PRE + NEW permissions | policies tested indirectly |
| 4 | Field-worker assignment | Implemented & tested | PRE assignment, NEW worker login + /worker jobs page | worker sees job, completes with photo; others blocked |
| 5 | Interactive map, heatmap | Implemented (pages load) | PRE | browser |
| 6 | AI summaries | Implemented & tested | PRE AI, NEW automatic fallback summary | AI chatbot answered in Hindi; fallback summary stored |
| 7 | Hindi / English | Implemented (toggle, translations) | PRE; new pages bilingual where shown | browser |
| 8 | Multi-city | Implemented | PRE; NEW Ratlam pilot city default | city-scoped admin roles |
| M1 | Ward / zone | Implemented & tested | NEW | 10 Ratlam wards in 5 zones; auto-ward from GPS; ward filter; /admin/wards |
| M2 | Offline drafts | Implemented | PRE local draft, NEW offline banner + auto-send on reconnect + clear failure messages | not yet tested on a real phone offline |
| M3 | Privacy + account deletion | Implemented & tested | NEW | /privacy page; deletion erases profile, complaints anonymised |
| M4 | Reliable AI | Implemented & tested | NEW | 20 s timeout, 2 retries with backoff, never blocks submit (unit tests) |
| — | Duplicate detection 300 m / 7 days | Implemented & tested | PRE approximate box, NEW true distance check | found at ~150 m; none at ~930 m or other category |
| — | Before/after proof | Implemented & tested | PRE slider, NEW enforced: completion requires after photo | e2e |
| — | Citizen ratings | Implemented & tested | PRE | e2e |
| — | QR public tracking | Implemented (QR on complaint page, signed-out read tested) | PRE | e2e public read |
| — | Analytics / AI reports | Implemented (dashboard charts, AI admin report) | PRE | page loads |
| — | Roles | Partial: Citizen, Municipal Officer, Field Worker, City Admin (admin + city), Super Admin (main admin) | PRE + NEW field worker | security: citizens can no longer self-resolve |

## Requires external configuration / user input
- Main admin email (super administrator) — not yet provided.
- Old complaint/user data — optional export from the previous backend.
- Real SMS (Twilio) and WhatsApp — optional keys; currently simulated.
- GitHub: connect in Project Settings → Git (cannot be done by the agent). Vercel deploy not used; publishing on Lovable instead.
