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

/** Client history is untrusted: only nonempty user turns may reach the model. */
export function sanitizeChat(messages: unknown, maxTurns = 20, maxChars = 2000) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m): m is { role: string; content: string } =>
        !!m && typeof m === "object" && m.role === "user" && typeof m.content === "string" && m.content.trim().length > 0,
    )
    .slice(-maxTurns)
    .map((m) => ({ role: "user" as const, content: m.content.trim().slice(0, maxChars) }));
}

/** Shared AI quota: 30 requests per signed-in user per 10 minutes, across all AI endpoints.
 *  Identity comes from the caller's verified session (auth.uid() in the database).
 *  Returns a 429 Response when over the limit, otherwise null. */
export async function enforceAiQuota(caller: Caller, endpoint: string): Promise<Response | null> {
  const { data, error } = await caller.supabase.rpc("consume_ai_quota" as never, { _endpoint: endpoint } as never);
  const r = data as { allowed?: boolean; retry_after?: number } | null;
  if (error || !r) return jsonError(503, "Request could not be completed. Please try again.");
  if (r.allowed) return null;
  const retry = Math.max(1, Number(r.retry_after) || 600);
  const mins = Math.ceil(retry / 60);
  return new Response(
    JSON.stringify({ error: `AI request limit reached (30 per 10 minutes). Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`, retry_after: retry }),
    { status: 429, headers: { ...jsonHeaders, "Retry-After": String(retry) } },
  );
}
