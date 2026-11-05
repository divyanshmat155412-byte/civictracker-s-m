import { supabase } from "@/integrations/supabase/client";

/**
 * Calls one of the app's server endpoints. Mirrors the shape the app used
 * before ({ data, error }) so calling code stays unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeFunction<T = any>(
  name: string,
  options?: { body?: unknown },
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(`/api/public/fn/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(options?.body ?? {}),
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : `Request failed with status ${res.status}`;
      return { data: null, error: new Error(message) };
    }

    return { data: parsed as T, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
