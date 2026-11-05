// Shared safeguard for every e2e script (they run against the shared live database).
// 1. Exclusive lock: only one e2e script can run at a time.
// 2. Snapshots the real Super Admin (root ID + role rows) before the run.
// 3. On release/exit verifies nothing about the root changed and aborts loudly if it did.
// Tests must never write to the root account; this only detects, it never "repairs" silently.
import { createClient } from "@supabase/supabase-js";
import { openSync, closeSync, unlinkSync, readFileSync } from "node:fs";

const LOCK = "/tmp/civic-tracker-e2e.lock";

export async function acquireSafety(name: string) {
  try {
    const fd = openSync(LOCK, "wx");
    closeSync(fd);
    await Bun.write(LOCK, `${name} ${process.pid} ${new Date().toISOString()}`);
  } catch {
    const holder = (() => { try { return readFileSync(LOCK, "utf8"); } catch { return "?"; } })();
    console.error(`ABORT: another e2e script is running (${holder}). Run suites one at a time.`);
    process.exit(2);
  }
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const snap = async () => {
    const { data: cfg } = await admin.from("app_config").select("value").eq("key", "root_admin_user_id").single();
    const root = cfg?.value ?? null;
    const { data: roles } = await admin.from("user_roles").select("role,city,status").eq("user_id", root ?? "00000000-0000-0000-0000-000000000000").order("role");
    return JSON.stringify({ root, roles });
  };
  const before = await snap();
  if (!JSON.parse(before).root) { unlinkSync(LOCK); console.error("ABORT: root identity not found"); process.exit(2); }
  let released = false;
  const release = async () => {
    if (released) return; released = true;
    const after = await snap();
    try { unlinkSync(LOCK); } catch { /* already gone */ }
    if (after !== before) {
      console.error("!!! SAFETY VIOLATION: Super Admin record changed during", name, { before, after });
      process.exit(3);
    }
    console.log(`SAFETY OK (${name}): Super Admin ID and roles unchanged`);
  };
  process.on("SIGINT", () => { try { unlinkSync(LOCK); } catch { /* noop */ } process.exit(130); });
  return { release };
}
