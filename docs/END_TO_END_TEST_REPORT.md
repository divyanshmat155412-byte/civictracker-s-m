# Civic Tracker — End-to-End Test Report

| | |
|---|---|
| Project | Civic Tracker — "Every Complaint Tracked. Every Fix Proven." |
| Team | Team SANT (Lead: Mohit Katara, Member: Divyansh Mathur) |
| Competition | Unstop CodeQuest 2026 |
| Pilot city | Ratlam, Madhya Pradesh |
| Test date | 5 November 2026, 11:05–11:56 UTC (16:35–17:26 IST) |
| Site tested | Published site https://civictracker-s-m.lovable.app (live database) and the Lovable preview for unpublished fixes |
| Browser | Chromium (Playwright, headless), 1280×800 desktop, 768×1024 tablet, 390×844 mobile |
| Accounts | Three temporary DEMO accounts (citizen, City Admin for Ratlam, field worker). The real Super Admin account was **not** used. |

## 1. Rules source

Official Unstop CodeQuest 2026 rulebook, PPT template, slide limit and video length were **not available** in this project. The only requirements source is the team's own brief (`CIVIC_TRACKER - AUTONOMOUS FULL PROJECT`, Part 12). That brief lists: working MVP, GitHub repository, README, live deployment (it names Vercel), screenshots, short demo video, installation instructions, migrations, environment documentation and test results. No other requirements were invented. Slide count, video length and file format limits are **unverified** — please check them against the official Unstop page before submitting.

## 2. Safety measures used during testing

- Every automatic test script now takes an exclusive lock, so two scripts can never run at the same time.
- Each script snapshots the Super Admin ID and role rows before running and fails loudly if anything changed afterwards. All 5 suites ended with `SAFETY OK: Super Admin ID and roles unchanged`.
- The two dangerous steps found in the old scripts were removed: a temporary swap of the Super Admin ID, and a backend-key deletion probe against the real Super Admin roles. Root-only checks are now skipped (4 checks) and must only run in an isolated copy.
- Test cleanup deletes only rows belonging to accounts created by that run.
- All browser test records are titled `DEMO/TEST` and were created by temporary `demo-*@example.com` accounts.

## 3. Results by category

| # | Category | Result | Evidence |
|---|---|---|---|
| 1 | Website, registration and login | **PARTIAL** | All 14 public pages opened without page errors. Three test accounts signed in through the real login form. New-account sign-up and "unverified email cannot sign in" were verified by automated tests only, not through the browser sign-up form. |
| 2 | Citizen complaint filing | **PASS** | DEMO/TEST complaint CT-14 filed through the live form with photo, description, GPS (23.3316, 75.0368). Saved in database: city Ratlam, Ward 1 Station Road (demo ward data), Zone A – Central, department Public Works, deadline 72 h. |
| 3 | Hindi voice complaint | **NOT TESTED** | The headless browser has no microphone. Code shows a "Did we hear you correctly?" confirmation step, but it was not exercised. Hindi interface (not voice) **PASS** after fix B6. |
| 4 | AI photo classification | **PASS** | Live AI suggested "Broken Road (98% sure) → Public Works"; citizen pressed Accept. Category was not auto-filled before confirmation. |
| 5 | Duplicate detection and merging | **PASS** | Second DEMO report 15 m away showed "Possible duplicate" warning. Test City Admin merged it into CT-14, banner "linked to an existing complaint" appeared, reporter received a notification, then Undo merge restored it. Both actions are in the audit log. |
| 6 | City Admin dashboard | **PASS** | Test City Admin saw the admin dashboard, routing panel (ward/zone/department, "Correct ward / department") and assigned the DEMO field worker from Workers & Live Tracking. Audit log recorded the assignment. |
| 7 | Field Worker workflow | **PASS** | Worker saw only the assigned job. "Complete job" was disabled with no after-photo. After uploading an after-repair photo the complaint became Resolved with timeline notes. |
| 8 | Public Accountability Score | **PARTIAL** | Score panel renders and correctly shows "Not enough data" (fewer than 5 complaints per department). Formula verified by unit tests and the innovation suite; no department has enough live data for a real score yet. |
| 9 | Automatic escalation | **PASS (automated only)** | Verified by the innovation suite on the live database with back-dated temporary complaints (L1/L2/L3, notifications, audit, reset on new deadline). Not observed in the browser because it needs real time to pass. |
| 10 | Security and privacy | **PASS** | Security suite 45/45. Private WhatsApp column refused for public visitors (checked live). Super Admin record unchanged after every run. |
| 11 | Mobile responsiveness | **PASS** | No sideways scrolling on 5 key pages at 390 px and 768 px. Mobile menu opens fully. One readability defect fixed (B4). |
| 12 | Final report | **PASS** | This report, PDF, video and screenshots. |

Other features (pages opened only, functions not exercised): Map, Heatmap, Leaderboard, Rewards, Polls, Predictions, FAQ, Contact, Privacy — **NOT TESTED** functionally. Civic AI chatbot, WhatsApp simulator, offline drafts, account deletion through the UI, Super Admin screens (excluded on purpose) — **NOT TESTED** in the browser. Account deletion removing the profile is verified by the civic-flow suite.

**Counts (12 categories): PASS 9 (one automated-only, one is this report), PARTIAL 2, FAIL 0, NOT TESTED 1.**

## 4. Automated suites (run one at a time, 5 Nov 2026)

| Suite | Result |
|---|---|
| Civic flow (now includes 2 new checks for bugs B1, B2) | 23/23 PASS |
| Security | 45/45 PASS |
| City onboarding | 21/21 PASS |
| GPS routing and applications | 34 PASS, 0 FAIL, 4 SKIPPED (root-only, need isolated copy) |
| Innovation (escalation, score, merge) | 25/25 PASS |
| Unit tests | 11/11 PASS |

## 5. Complete lifecycle (CT-14)

1. Citizen files DEMO/TEST pothole with photo and GPS → `pending`, routed to Public Works, due in 72 h.
2. City Admin opens it, sees routing, assigns DEMO field worker → `in-progress`.
3. Worker: Complete blocked without photo → Start work → uploads after photo → `resolved`.
4. Citizen opens tracking page: before/after slider, timeline "Field worker started work", "completed the job with after-repair photo", notifications in bell.
5. Citizen rates the work (saved; the test script clicked the 3rd star, so the stored rating is 3, a test-script slip, not an app error).

## 6. Bugs found and fixed

| ID | Problem | Cause | Fix | Retest | Live? |
|---|---|---|---|---|---|
| B1 | All complaint lists, the home feed and admin dashboards showed "No complaints" on the live site | 6 newer non-private complaint fields had never been made readable | Made those 6 fields readable (approved by owner) | List shows complaints again; new automatic check PASS | Live now |
| B2 | Two complaints shared tracking number CT-14 | Number generator cut numbers to 2 digits (141 → "14") | Full-length numbers, skip any number already used (approved). Renumbered only the DEMO duplicate to CT-142 | New automatic check PASS | Live now |
| B3 | Old test scripts could remove the Super Admin's roles | Root ID swap + destructive probe | Removed both, added lock and Super Admin snapshot check | All suites `SAFETY OK` | Scripts only |
| B4 | City and zone labels on complaint pages almost invisible | Low-contrast text colour | Normal text colour | Preview screenshot | Not yet published |
| B5 | Departments page titled "IT Departments" | Wrong label | "Departments" / "विभाग" | Preview check | Not yet published |
| B6 | Hindi mode showed category names in English | No Hindi names | Added Hindi category names | Preview: कचरा, जलभराव, टूटी सड़क… | Not yet published |
| B7 | Rating said "Thanks" even if saving failed | Error ignored | Shows an error and keeps the form | Code review only | Not yet published |

## 7. Remaining issues (not fixed)

- After submitting, the green "submitted #ID" message is at the top of the form while the user is at the bottom, so it is easy to miss.
- Assigning a worker does not add a timeline entry; the citizen sees the update only through the general notification bell, not a personal notification.
- Ratlam has no city-specific category routing yet, so complaints use the shared fallback department ("city mapping missing").
- Ratlam ward data is demonstration data, not official boundaries.
- Departments page and menu still show an "In Progress" tag (left as the team's own label).
- Brief asks for Vercel deployment; the app is hosted on Lovable instead. GitHub connection status cannot be read from here.
- Voice input, offline drafts, chatbot, WhatsApp simulator, polls, rewards redemption and Super Admin screens need a manual check.

## 8. Test records left in the database

DEMO/TEST complaints CT-14 (resolved) and CT-142 (pending, unmerged), three `demo-*@example.com` accounts and one "DEMO TEST Field Worker". Kept so judges can open the public tracking page; they can be deleted by exact ID on request.

## 9. MVP readiness

The core promise — click, route, prove — works end to end on the live site with real photo proof. Two serious live bugs (empty lists, clashing tracking numbers) were found and fixed during this test. **Ready for MVP demo**, with the limitations in section 7 stated honestly.
