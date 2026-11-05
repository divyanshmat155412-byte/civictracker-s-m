import { describe, it, expect } from "vitest";
import { accountabilityScore } from "@/lib/accountability";

describe("accountabilityScore", () => {
  it("returns null below 5 complaints", () => {
    expect(accountabilityScore({ total: 4, resolvedWithProof: 4, resolvedOnTime: 4, openOverdue: 0 })).toBeNull();
  });
  it("perfect department scores 100", () => {
    expect(accountabilityScore({ total: 10, resolvedWithProof: 10, resolvedOnTime: 10, openOverdue: 0 })).toBe(100);
  });
  it("weights 50/30/20", () => {
    // genuine 6/10=0.6, on-time 3/6=0.5, overdue 2/10 -> 0.8 => 30+15+16 = 61
    expect(accountabilityScore({ total: 10, resolvedWithProof: 6, resolvedOnTime: 3, openOverdue: 2 })).toBe(61);
  });
  it("resolutions without proof earn nothing", () => {
    expect(accountabilityScore({ total: 5, resolvedWithProof: 0, resolvedOnTime: 0, openOverdue: 5 })).toBe(0);
  });
});
