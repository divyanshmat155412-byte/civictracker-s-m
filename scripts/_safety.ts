// Shared safeguard for every e2e script (they run against the shared live database).
// 1. Exclusive lock: only one e2e script can run at a time.
// 2. Snapshots the real Super Admin (root ID + role rows) before the run.
// 3. On release/exit verifies nothing about the root changed and aborts loudly if it did.
// Tests must never write to the root account; this only detects, it never "repairs" silently.
import { createClient } from "@supabase/supabase-js";
import { openSync, closeSync, unlinkSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const LOCK = "/tmp/civic-tracker-e2e.lock";

export async function acquireSafety(name: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing safety credentials");
  try {
    const fd = openSync(LOCK, "wx");
    closeSync(fd);
    await Bun.write(LOCK, `${name} ${process.pid} ${new Date().toISOString()}`);
  } catch {
    const holder = (() => { try { return readFileSync(LOCK, "utf8"); } catch { return "?"; } })();
    console.error(`ABORT: another e2e script is running (${holder}). Run suites one at a time.`);
    process.exit(2);
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const started = new Date().toISOString();
  const initialUsers = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (initialUsers.error) throw initialUsers.error;
  const originalUsers = new Set(initialUsers.data.users.map((u) => u.id));
  const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const originalRows: Record<string, { id: string; hash: string }[]> = {};
  for (const table of ["profiles", "complaints"]) {
    const r = await admin.from(table).select("*").order("id");
    if (r.error) throw r.error;
    originalRows[table] = (r.data ?? []).map((row) => ({ id: row.id, hash: digest(row) }));
  }
  const snap = async () => {
    const { data: cfg, error: cfgError } = await admin.from("app_config").select("value").eq("key", "root_admin_user_id").single();
    if (cfgError) throw cfgError;
    const root = cfg?.value ?? null;
    const { data: roles, error: roleError } = await admin.from("user_roles").select("*").eq("user_id", root ?? "00000000-0000-0000-0000-000000000000").order("role");
    if (roleError) throw roleError;
    const rootAccount = root ? await admin.auth.admin.getUserById(root) : null;
    if (rootAccount?.error) throw rootAccount.error;
    return JSON.stringify({ root, roles, account: digest(rootAccount?.data.user) });
  };
  const before = await snap();
  if (!JSON.parse(before).root) { unlinkSync(LOCK); console.error("ABORT: root identity not found"); process.exit(2); }
  let released = false;
  const release = async () => {
    if (released) return; released = true;
    const after = await snap();
    try { unlinkSync(LOCK); } catch { /* already gone */ }
    if (after !== before) {
      console.error("!!! SAFETY VIOLATION: Super Admin record changed during", name);
      process.exit(3);
    }
    for (const [table, rows] of Object.entries(originalRows)) {
      if (!rows.length) continue;
      const r = await admin.from(table).select("*").in("id", rows.map((row) => row.id));
      if (r.error || rows.some((row) => digest(r.data?.find((x) => x.id === row.id)) !== row.hash)) {
        throw new Error(`SAFETY VIOLATION: existing ${table} changed`);
      }
    }
    // New no-Auth-FK ledgers must not retain rows after a temporary account is deleted.
    // Only exact event IDs from this run, absent auth accounts and never original users.
    const currentUsers = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (currentUsers.error) throw currentUsers.error;
    const currentIds = new Set(currentUsers.data.users.map((u) => u.id));
    for (const table of ["point_reward_events", "api_usage_events", "user_achievements"]) {
      const timeColumn = table === "user_achievements" ? "unlocked_at" : "created_at";
      const r = await admin.from(table).select("id,user_id").gte(timeColumn, started);
      if (r.error) throw r.error;
      const ids = (r.data ?? []).filter((x) => !originalUsers.has(x.user_id) && !currentIds.has(x.user_id)).map((x) => x.id);
      if (ids.length) {
        const deleted = await admin.from(table).delete().in("id", ids);
        if (deleted.error) throw deleted.error;
      }
    }
    console.log(`SAFETY OK (${name}): Super Admin ID and roles unchanged`);
    console.log(`SAFETY OK (${name}): all existing complaints and profiles unchanged`);
  };
  process.on("SIGINT", () => { try { unlinkSync(LOCK); } catch { /* noop */ } process.exit(130); });
  return { release };
}
