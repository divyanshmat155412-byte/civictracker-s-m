import { describe, expect, it } from "vitest";
import { authorizeWebhook, cleanWhatsAppInput } from "./whatsapp-guard";

const SECRET = "s3cret-token-0123456789";
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { method: "POST", headers });
const no = async () => false;
const yes = async () => true;

describe("WhatsApp webhook caller check", () => {
  it("rejects an unknown caller", async () => {
    expect(await authorizeWebhook(req("https://x/api"), SECRET, no)).toBe(false);
  });
  it("rejects a wrong token", async () => {
    expect(await authorizeWebhook(req("https://x/api?token=wrong"), SECRET, no)).toBe(false);
  });
  it("accepts the configured token in the header", async () => {
    expect(await authorizeWebhook(req("https://x/api", { "x-webhook-token": SECRET }), SECRET, no)).toBe(true);
  });
  it("accepts signed-in staff", async () => {
    expect(await authorizeWebhook(req("https://x/api"), undefined, yes)).toBe(true);
  });
  it("rejects everyone but staff when no secret is configured", async () => {
    expect(await authorizeWebhook(req("https://x/api?token="), undefined, no)).toBe(false);
  });
});

describe("WhatsApp input cleaning", () => {
  it("keeps only digits and + in the phone number", () => {
    expect(cleanWhatsAppInput({ from: "whatsapp:+91 98<b>", body: "", mediaUrl: null, latitude: null, longitude: null }).from).toBe("+9198");
  });
  it("drops photo links from unknown hosts", () => {
    expect(cleanWhatsAppInput({ from: "", body: "x", mediaUrl: "https://evil.example/a.png", latitude: null, longitude: null }).mediaUrl).toBeNull();
  });
  it("keeps https Twilio photo links", () => {
    expect(cleanWhatsAppInput({ from: "", body: "x", mediaUrl: "https://api.twilio.com/m/1", latitude: null, longitude: null }).mediaUrl).toBe("https://api.twilio.com/m/1");
  });
  it("drops out-of-range coordinates", () => {
    const r = cleanWhatsAppInput({ from: "", body: "x", mediaUrl: null, latitude: 200, longitude: 75 });
    expect(r.latitude).toBeNull();
    expect(r.longitude).toBeNull();
  });
  it("caps message length at 2000", () => {
    expect(cleanWhatsAppInput({ from: "", body: "a".repeat(5000), mediaUrl: null, latitude: null, longitude: null }).body.length).toBe(2000);
  });
});
