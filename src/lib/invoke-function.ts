import { supabase } from "@/integrations/supabase/client";

/**
 * Calls one of the app's server endpoints with a timeout and automatic
 * retries (network errors, timeouts, 429 and 5xx). Never throws: returns
 * { data, error } so AI failures can never block complaint reporting.
 */
export const AI_TIMEOUT_MS = 20_000;
export const AI_MAX_RETRIES = 2;

export function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

export function backoffMs(attempt: number) {
  return Math.min(4000, 600 * 2 ** attempt);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeFunction<T = any>(
  name: string,
  options?: { body?: unknown; timeoutMs?: number; retries?: number },
): Promise<{ data: T | null; error: Error | null }> {
  const timeoutMs = options?.timeoutMs ?? AI_TIMEOUT_MS;
  const retries = options?.retries ?? AI_MAX_RETRIES;
  let lastError: Error = new Error("Request failed");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/public/fn/${name}`, {
        method: "POST",
        signal: ctrl.signal,
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
      if (res.ok) return { data: parsed as T, error: null };
      lastError = new Error(
        parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : `Request failed with status ${res.status}`,
      );
      if (!isRetryableStatus(res.status)) break;
    } catch (e) {
      lastError =
        e instanceof DOMException && e.name === "AbortError"
          ? new Error("The AI service took too long to respond")
          : e instanceof Error
            ? e
            : new Error(String(e));
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, backoffMs(attempt)));
  }
  return { data: null, error: lastError };
}
