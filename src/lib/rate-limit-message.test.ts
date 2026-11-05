import { describe, it, expect } from "vitest";
import { parseRetryAfter, rateLimitMessage } from "./rate-limit-message";

describe("parseRetryAfter", () => {
  it("uses the Retry-After header in seconds", () => expect(parseRetryAfter("573")).toBe(573));
  it("falls back to body.retry_after when header missing", () => expect(parseRetryAfter(null, { retry_after: 120 })).toBe(120));
  it("rejects invalid values safely", () => {
    expect(parseRetryAfter("abc", { retry_after: "x" })).toBeNull();
    expect(parseRetryAfter("-5", { retry_after: -1 })).toBeNull();
    expect(parseRetryAfter("0")).toBeNull();
  });
  it("accepts an HTTP date", () => {
    const now = Date.parse("2030-01-01T00:00:00Z");
    expect(parseRetryAfter("Tue, 01 Jan 2030 00:01:30 GMT", null, now)).toBe(90);
  });
  it("caps absurd values at one hour", () => expect(parseRetryAfter("999999")).toBe(3600));
});

describe("rateLimitMessage", () => {
  it("English with minutes and seconds", () =>
    expect(rateLimitMessage(573, "en")).toBe("AI request limit reached. Please try again in 9 minutes and 33 seconds."));
  it("English singular", () => expect(rateLimitMessage(61, "en")).toBe("AI request limit reached. Please try again in 1 minute and 1 second."));
  it("Hindi", () => expect(rateLimitMessage(573, "hi")).toBe("AI अनुरोध सीमा पूरी हो गई। कृपया 9 मिनट 33 सेकंड बाद फिर कोशिश करें।"));
  it("generic when unknown", () => expect(rateLimitMessage(null, "en")).toMatch(/few minutes/));
});
