/** Builds the chatbot's "AI limit reached" message from a 429 response's retry time. */

const MAX_SECONDS = 3600;

function clean(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\s*\d+(\.\d+)?\s*$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_SECONDS, Math.ceil(n));
}

/** Seconds to wait: Retry-After header (seconds or HTTP date) first, then body.retry_after; null if unusable. */
export function parseRetryAfter(header: string | null | undefined, body?: unknown, now = Date.now()): number | null {
  const fromHeader = clean(header);
  if (fromHeader) return fromHeader;
  if (header && /[a-z]/i.test(header)) {
    const at = Date.parse(header);
    if (Number.isFinite(at)) { const s = clean((at - now) / 1000); if (s) return s; }
  }
  const b = body as { retry_after?: unknown } | null | undefined;
  return clean(b?.retry_after);
}

export function rateLimitMessage(seconds: number | null, language: "en" | "hi" | string): string {
  const hi = language === "hi";
  if (!seconds) {
    return hi
      ? "AI अनुरोध सीमा पूरी हो गई। कृपया कुछ देर बाद फिर कोशिश करें।"
      : "AI request limit reached. Please try again in a few minutes.";
  }
  const m = Math.floor(seconds / 60), s = seconds % 60;
  if (hi) {
    const parts = [m ? `${m} मिनट` : "", s ? `${s} सेकंड` : ""].filter(Boolean).join(" ");
    return `AI अनुरोध सीमा पूरी हो गई। कृपया ${parts} बाद फिर कोशिश करें।`;
  }
  const parts = [m ? `${m} minute${m === 1 ? "" : "s"}` : "", s ? `${s} second${s === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
  return `AI request limit reached. Please try again in ${parts}.`;
}
