<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Complaint photos are stored in a private bucket and served via /api/public/photo/$ (src/lib/photo-url.ts); never use getPublicUrl because public buckets are blocked in this workspace.
- The Platform Super Admin is identified only by `app_config.root_admin_user_id` (checked via `is_main_admin()` / `useIsRootAdmin`); never by email or client state — keeps the identity private and immune to signup/role tricks.
- City scoping for admins/officers goes through `admin_can_manage_city()`; only the root gets all-city access, and `guard_user_roles` rejects city-less admin rows — prevents a second super admin.
- Audit rows are written only by SECURITY DEFINER triggers/RPCs via `write_audit()`; clients cannot insert/update/delete `audit_logs` — keeps the log tamper-proof.
- City lists come from `useCities()` (built-in `CITIES` + active rows in `public.cities`); never map `CITIES` directly in a selector — new cities must appear without code changes.
- Ward/zone/department assignment happens only in the `route_new_complaint` trigger via `locate_point()` (boundary first, nearest centre within radius second, else `needs_verification`); corrections go through `admin_correct_complaint()` so they are audited.
- City routing lives in `city_category_routing`; `category_routing` is the shared fallback editable only by the root — keeps cities isolated.
- `admin_requests` identity (user_id, email, status) is forced server-side by the `guard_admin_request` trigger — never trust form values.
- Escalation, merge fields (`escalation_level`, `merged_into`) are written only by SECURITY DEFINER functions (`escalate_overdue_complaints`, `admin_merge_complaint`) via the `civic.system_update` flag; the guard trigger blocks direct edits — keeps escalation and merges audited.
- AI photo/voice results are suggestions the citizen must confirm; never auto-fill the form — avoids presenting AI guesses as facts.
- Every e2e script must call `acquireSafety()` from `scripts/_safety.ts` (exclusive lock + Super Admin snapshot) and must never write to the root account or swap `root_admin_user_id` — the shared live database once lost the root roles this way.
- Complaint columns added later need an explicit column-level `GRANT SELECT` to anon/authenticated when non-private; otherwise every list using `COMPLAINT_COLS` fails silently.
- Fixed interface translations use local dictionaries and React language context; never translate citizen content or change stored records for localization.
- Notification localization uses an allowlisted frontend formatter for known system prefixes and enum scaffolding; unknown bodies and embedded citizen text stay verbatim to avoid rewriting personal content.
- Photo uploads are validated by real image bytes (src/lib/image-validate.ts) both before upload and in the photo-serving route; storage rules can't inspect content, so the serving route is the final gate.
- Client chatbot histories contain user turns only; assistant responses remain display-only because client roles are untrusted.
- Public leaderboard and assignment tracking use narrow RPC projections, while owner profile reads remain RLS-scoped; this prevents exposing account IDs and assignment internals.
- Worker linking requires verified same-city opt-in requests and uses the audited RPC only; direct user_id writes are revoked to prevent bypass.
- Complaint/upvote rewards use a private lifetime-deduplicated ledger and per-user transaction lock with UTC-day caps; reward redemption never resets earned allowance.
- Achievement history is owner-only; anonymous worker reads expose active public fields, while authenticated raw worker reads require ownership or city authority to prevent account enumeration.
