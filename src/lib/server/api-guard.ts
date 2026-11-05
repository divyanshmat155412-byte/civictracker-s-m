import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Shared caller checks for /api/public/fn/* endpoints. These routes bypass the
 * site auth wall, so each handler must verify the caller itself.
 */

export const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

export function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });
}

function keyFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export type Caller = { user: User; supabase: SupabaseClient };

/** Returns the signed-in caller (with an RLS-scoped client) or null. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!token || !url || !key || token === key) return null;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: keyFetch(key) },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, supabase };
}

/** True when the caller holds an active admin or moderator (officer) role. */
export async function isStaff(caller: Caller): Promise<boolean> {
  const [a, m] = await Promise.all([
    caller.supabase.rpc("has_role", { _user_id: caller.user.id, _role: "admin" }),
    caller.supabase.rpc("has_role", { _user_id: caller.user.id, _role: "moderator" }),
  ]);
  return a.data === true || m.data === true;
}

export async function canManageCity(caller: Caller, city: string | null | undefined) {
  if (!city) return false;
  const { data } = await caller.supabase.rpc("admin_can_manage_city", { _user_id: caller.user.id, _city: city });
  return data === true;
}

/** Keep only plain user/assistant chat turns with bounded size. */
export function sanitizeChat(messages: unknown, maxTurns = 20, maxChars = 2000) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m): m is { role: string; content: string } =>
        !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .slice(-maxTurns)
    .map((m) => ({ role: m.role, content: m.content.slice(0, maxChars) }));
}
