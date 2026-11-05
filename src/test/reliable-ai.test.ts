import { describe, it, expect } from "vitest";
import { isRetryableStatus, backoffMs, AI_MAX_RETRIES, AI_TIMEOUT_MS } from "@/lib/invoke-function";

describe("reliable AI calls", () => {
  it("retries rate limits and server errors", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });
  it("does not retry client errors", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
  });
  it("retries twice with growing, capped backoff and a 20s timeout", () => {
    expect(AI_MAX_RETRIES).toBe(2);
    expect(AI_TIMEOUT_MS).toBe(20000);
    expect(backoffMs(0)).toBeLessThan(backoffMs(1));
    expect(backoffMs(10)).toBe(4000);
  });
});
