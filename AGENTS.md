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
