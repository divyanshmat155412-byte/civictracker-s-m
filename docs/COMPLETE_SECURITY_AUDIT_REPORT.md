# Civic Tracker — Complete Security Audit Report

Team SANT (Mohit Katara, Divyansh Mathur) · Unstop CodeQuest 2026 · Pilot: Ratlam, Madhya Pradesh · 2026-11-05 (UTC)

Companion files: `SECURITY_VULNERABILITY_REGISTER.md`, `SECURITY_REMEDIATION_REPORT.md`, `SECURITY_RETEST_REPORT.md`.

## Scope and method

Source review of all 11 server endpoints, the photo route, the caller-check helper, export/map rendering and secret handling; database review of access rules, column privileges and notification functions using read-only queries; the platform security scanner (21 findings: 5 error, 16 info); live unauthorised requests; full regression suites with temporary accounts. Production data, the Super Admin account, access rules, auth settings and storage permissions were not modified.

## Key results

- **Fixed now:** the WhatsApp intake could be used by anyone to write complaints with full privileges and spend AI credits (HIGH). It now requires a shared token or signed-in staff, and validates all input. Raw internal error text was removed from 11 endpoints.
- **Secrets:** the privileged database key, AI key and cron secret are read only inside server handlers; none are referenced in browser code. `.env` contains only public keys. No Twilio key is configured.
- **AI:** every AI endpoint requires a verified sign-in; chat input is limited to plain user/assistant turns (20 turns, 2,000 characters); AI results are suggestions the citizen must confirm; AI output is shown as text, never HTML. Prompt injection cannot reach private data because the chatbot only gets aggregate counts.
- **Privacy:** phone/WhatsApp numbers, filer account IDs and photos are not publicly readable (verified by column-privilege query and tests). Anonymous complaints show "Anonymous" publicly.
- **Remaining:** see register — SA-05 and SA-06 (MEDIUM) need approval for database changes.

## Scorecard (this round, evidence-based)

| Category | Total Tests | PASS | FAIL | NOT TESTED |
|----------|------------|------|------|------------|
| Authentication | 6 | 3 | 0 | 3 (password reset, Google, expiry) |
| Authorization | 52 | 52 | 0 | 0 |
| RLS | 23 | 23 | 0 | 0 |
| Database | 34 | 34 | 0 | 4 skipped (root-only) |
| Storage | 10 | 10 | 0 | 0 |
| API | 16 | 15 | 0 | 1 (staff simulator live) |
| Privacy | 14 | 14 | 0 | 0 |
| Secrets | 3 | 3 | 0 | 0 |
| AI Security | 25 | 25 | 0 | 0 |
| Notifications | 2 | 2 | 0 | 0 |
| Frontend | 10 | 10 | 0 | 0 |
| Integrations | 3 | 1 | 0 | 2 (real Twilio/Meta) |

Counts group the suite checks by their main purpose; skipped checks are not counted as PASS.

- Vulnerabilities found this round: 6 actionable (SA-01…SA-08 excluding accepted infos): 1 HIGH, 4 MEDIUM, 3 LOW.
- Fixed: 4 (SA-01–SA-04). Verified at runtime: 3 (SA-01, SA-02 by unit test, SA-04); SA-03 code-reviewed.
- Remaining CRITICAL: 0 · HIGH: 0 · MEDIUM: 2 (SA-05, SA-06) · LOW: 2 (SA-07, SA-08).
- External setup: `WHATSAPP_WEBHOOK_SECRET` when a real WhatsApp provider is connected; Twilio credentials for real SMS.

## Verdicts

1. Authentication & Authorization Security: **READY WITH LIMITATIONS** (password reset, Google sign-in and session expiry not exercised this round).
2. Data Privacy & Infrastructure Security: **READY WITH LIMITATIONS** (SA-05 open; low public-leaderboard inference risk).
3. Overall Production Security Readiness: **READY WITH LIMITATIONS** for the hackathon MVP. Not a claim of complete security.
