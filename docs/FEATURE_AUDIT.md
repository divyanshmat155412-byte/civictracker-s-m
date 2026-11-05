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

---

## Round 4 (prototype improvements, 5 Nov 2026): applications, GPS wards, city routing

Test: `bun scripts/e2e-gps-routing-applications.ts`. Temporary accounts, two temporary **demo** cities (Demopur*, Demogarh*), invented square ward shapes clearly marked as demonstration data, all deleted afterwards. The real Super Admin was swapped out for a temporary test account during the run and restored (verified by the script). **38 / 38 PASS.** Regression: complaint flow 21/21, security 45/45, city onboarding 21/21 PASS. Unit tests (ward CSV/GeoJSON import, AI retry rules) PASS.

| # | Requirement | Result | Evidence |
|---|---|---|---|
| E1 | Registration + email verification | PASS (backend) | Unverified account cannot sign in (1b); after verification it can (1c). The real verification email is NOT TESTED (test addresses can't receive mail). |
| E2 | Application uses the signed-in account, not typed email | PASS | Forged user_id/email/"approved" rewritten to the real account, forced pending; victim has no application (2a–2c). Unverified email blocked by the database. |
| E3 | Applications visible only to Root Super Admin | PASS | Citizen sees none, applicant sees only own, non-root can't decide, root sees all (3a–3d). |
| E4 | Approval assigns city + City Admin role | PASS | Admin of assigned city only; notification delivered (4a–4c). |
| E5 | Rejection grants nothing | PASS | No admin role, rejection notice, pending applicant has no city powers (5a–5c). |
| E6 | GPS → city + ward | PASS | Inside ward boundary (point-in-polygon) in city A, two wards (6a, 6b); nearest-centre fallback labelled in city B (6c); wrong city chosen but GPS inside A → filed under A (6d). |
| E7 | Automatic zone | PASS | 7a, 6b, 6c. |
| E8 | City-specific department routing | PASS | Each city's own department (8a, 8b); can't route to another city's department or edit another city's/shared routing (D2–D4). |
| E9 | Deadlines | PASS | City A 48 h, city B 24 h from each city's own rule (9a, 8b). |
| E10 | Cross-city isolation | PASS | City A admin can't correct city B complaint or use B's wards; citizen can't change ward (10a–10c). |
| E11 | Correction by City Admin, audited | PASS | Ward/zone corrected, marked "corrected", audit log row written (11a, 11b). |
| E12 | Missing GPS / outside coverage / no mapping | PASS | No ward assigned + "needs verification" (12a, 12b); unmapped category flagged as shared fallback (12c). |
| C | Manual ward entry + CSV/GeoJSON bulk import | PASS (parser unit tests + DB insert of GeoJSON boundaries in C1) | Import button in Wards & Zones page NOT TESTED in a browser. |
| UI | Ward preview on complaint form; city/ward/zone/department panel + correction on complaint page; "needs checking" list; routing editor | NOT TESTED in browser | Type-checks pass; no signed-in browser session was available. |

Existing Ratlam wards are now labelled **demonstration data** (they were never official boundaries). Real ward maps need to come from the Nagar Nigam.
