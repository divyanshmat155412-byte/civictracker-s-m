# Innovation enhancements — audit and plan

## Audit (current state)

| Feature | Status | What already exists |
|---|---|---|
| 1. Auto-escalation on deadline breach | Partial | Deadlines are set per city and category, and "Overdue" badges show. Nothing escalates, notifies or logs when a deadline is missed. |
| 2. Public Department Accountability Score | Partial | The Departments page shows average resolution time and a ranking. It has no combined score, no overdue count, and doesn't separate genuine resolutions (with after-photo proof) from the rest. |
| 3. AI duplicate detection and merging | Partial | Matches the same category within 300 m and 7 days, and warns the citizen. There is no text similarity check, no admin merge and no "merged into #X" link. |
| 4. Hindi voice filing with confirmation | Mostly done | Voice input already supports hi-IN (browser speech), with AI transcription as a fallback and structured fields. Missing: a clear "confirm what we heard" step before fields are filled. |
| 5. AI photo classification and department recommendation | Mostly done | `analyze-image` suggests a category from the photo. Missing: a confidence score, the recommended department shown from the city's routing rules, and the citizen accepting or overriding the suggestion. |

All AI already runs through Lovable AI with retries and fallback, so there are no new paid services. Everything below reuses existing tables, triggers, audit logging and city scoping.

## Recommended for the MVP (highest impact, testable)

### A. Automatic escalation (complexity: medium)
- Benefit: a missed deadline can't be quietly ignored. This is the core accountability story.
- Backend: an `escalate_overdue_complaints()` SECURITY DEFINER function. It raises the escalation level (0 → 1 officer → 2 City Admin → 3 Root), notifies the right people in that city, and writes each step to the audit log. It runs every 15 minutes on a database schedule (pg_cron, built in, free).
- New columns: `escalation_level` and `escalated_at`, nullable/default, so the change is additive.
- UI: an "Escalated L1/L2/L3" badge, plus an "Escalated" filter on the admin list.
- Risks: notification spam (capped at one escalation per level), cross-city leaks (reuses `admin_can_manage_city`), clock drift (uses server time only).

### B. Public Accountability Score (complexity: low-medium)
- Benefit: citizens and the press can compare departments, which pushes performance.
- Backend: a read-only `department_scores(city)` function that returns aggregates only, no personal data. Score = 50% genuine resolution rate (resolved with an after-photo) + 30% speed against the deadline + 20% (1 − overdue share). Departments with fewer than 5 complaints show "Not enough data" instead of a score.
- UI: a score card and an explanation of the formula on the existing Departments page.
- Risks: unfair scores on small samples (minimum threshold), and gaming by fake resolutions (only proof-backed resolutions count).

### C. Safe duplicate merging (complexity: medium)
- Benefit: less duplicate work for staff, and every reporter still gets updates.
- Backend: add a text-similarity score to the existing nearby check (Postgres `pg_trgm`, built in, no AI cost). An `admin_merge_complaint(dup, primary)` RPC that only City Admins of that city can use. It sets `merged_into`, keeps the original row (no deletion), notifies the reporter and writes to the audit log. An unmerge RPC lets an admin undo it.
- UI: a "Possible duplicates" panel on complaint details for admins, with Merge and Unmerge buttons.
- Risks: wrong merges (manual only, reversible, audited), and cross-city merging (blocked in the RPC).

### D. Confirm-before-fill for voice and photo AI (complexity: low)
- Voice: after transcription, show the Hindi/English text and the parsed fields in a confirmation card (Use / Edit / Discard). Nothing fills in automatically.
- Photo: show the suggested category, its confidence, and the recommended department for that city's routing rules. The citizen taps Accept or picks a different category. Low-confidence or failed AI results show "Couldn't identify — please choose" and never invent a result.
- Risks: audio and photos go to the AI only after the user acts (already the case), and transcripts aren't stored separately.

## Deferred (not before the deadline)
- AI text-embedding duplicate matching: trigram similarity gives most of the value without per-request AI cost.
- SMS or WhatsApp alerts on escalation: these need paid provider keys and your approval.

## Testing
- Add to the e2e scripts using temporary accounts and cities:
  - Escalation with a backdated deadline: levels go up, notifications go to the right city only, and the audit log has a row.
  - Score calculation matches hand-computed values.
  - Merge and unmerge, including rejection when an admin from another city tries.
  - The minimum-data threshold for scores.
- Unit test for the score formula.
- Rerun the existing 21/45/21/38 regression suites.
- Update `docs/FEATURE_AUDIT.md`, marking these as new prototype-round improvements.

## Technical details
- One additive migration with new columns, functions and the cron job. No drops, and RLS/grants are unchanged except for new function EXECUTE grants.
- `analyze-image` adds a `confidence` field to its response. The department lookup reuses `city_category_routing` on the client through an existing readable policy.
