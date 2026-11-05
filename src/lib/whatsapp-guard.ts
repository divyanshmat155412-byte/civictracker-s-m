/** Caller and input checks for the WhatsApp intake endpoint. */

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Allowed when the request carries the configured shared token
 * (header `x-webhook-token` or `?token=`), or when `isStaffCaller` confirms a
 * signed-in admin/officer. With no secret configured, only staff are allowed.
 */
export async function authorizeWebhook(
  req: Request,
  secret: string | undefined,
  isStaffCaller: () => Promise<boolean>,
): Promise<boolean> {
  if (secret && secret.length >= 16) {
    const given = req.headers.get("x-webhook-token") || new URL(req.url).searchParams.get("token") || "";
    if (given && safeEqual(given, secret)) return true;
  }
  return isStaffCaller();
}

const MEDIA_HOSTS = ["api.twilio.com", "lookaside.fbsbx.com"];

export function cleanWhatsAppInput(input: {
  from: unknown;
  body: unknown;
  mediaUrl: unknown;
  latitude: unknown;
  longitude: unknown;
}) {
  const from = String(input.from ?? "").replace(/[^\d+]/g, "").slice(0, 20);
  const body = String(input.body ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 2000);
  let mediaUrl: string | null = null;
  if (typeof input.mediaUrl === "string") {
    try {
      const u = new URL(input.mediaUrl);
      if (u.protocol === "https:" && MEDIA_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
        mediaUrl = u.toString();
      }
    } catch {
      mediaUrl = null;
    }
  }
  const num = (v: unknown, lim: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    return Number.isFinite(n) && Math.abs(n) <= lim ? n : null;
  };
  let latitude = num(input.latitude, 90);
  let longitude = num(input.longitude, 180);
  if (latitude === null || longitude === null) latitude = longitude = null;
  return { from, body, mediaUrl, latitude, longitude };
}
