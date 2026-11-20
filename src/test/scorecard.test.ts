import { describe, it, expect } from "vitest";
import { scoreGrade, summarizeAccountability, overdueBy } from "@/lib/accountability";

const now = new Date("2026-11-20T12:00:00Z");
const c = (o: Partial<Parameters<typeof summarizeAccountability>[0][number]>) => ({
  status: "pending",
  after_photo_url: null,
  due_at: null,
  resolved_at: null,
  created_at: "2026-11-10T00:00:00Z",
  merged_into: null,
  ...o,
});

describe("scoreGrade", () => {
  it("labels score bands", () => {
    expect(scoreGrade(90).key).toBe("good");
    expect(scoreGrade(75).key).toBe("good");
    expect(scoreGrade(60).key).toBe("fair");
    expect(scoreGrade(10).key).toBe("poor");
    expect(scoreGrade(null).key).toBe("na");
  });
});

describe("summarizeAccountability", () => {
  it("matches the department score rules", () => {
    const rows = [
      c({
        status: "resolved",
        after_photo_url: "a.jpg",
        due_at: "2026-11-12T00:00:00Z",
        resolved_at: "2026-11-11T00:00:00Z",
      }),
      c({
        status: "resolved",
        after_photo_url: "b.jpg",
        due_at: "2026-11-12T00:00:00Z",
        resolved_at: "2026-11-13T00:00:00Z",
      }),
      c({ status: "resolved", after_photo_url: "", resolved_at: "2026-11-11T00:00:00Z" }), // no proof
      c({ status: "pending", due_at: "2026-11-15T00:00:00Z" }), // overdue
      c({ status: "in-progress", due_at: "2026-11-30T00:00:00Z" }),
      c({ status: "pending", merged_into: "x" }), // excluded duplicate
    ];
    const s = summarizeAccountability(rows, now);
    expect(s.total).toBe(5);
    expect(s.resolvedWithProof).toBe(2);
    expect(s.resolvedOnTime).toBe(1);
    expect(s.openOverdue).toBe(1);
    // 0.5*2/5 + 0.3*1/2 + 0.2*(1-1/5) = 0.2 + 0.15 + 0.16 = 0.51
    expect(s.score).toBe(51);
    expect(s.avgResolutionHours).toBe(40); // (24+72+24)/3, all resolved count like the SQL
  });
  it("returns null score for small samples", () => {
    expect(summarizeAccountability([c({})], now).score).toBeNull();
  });
});

describe("overdueBy", () => {
  it("uses hours then days", () => {
    expect(overdueBy("2026-11-20T09:00:00Z", now)).toEqual({ value: 3, unit: "hours" });
    expect(overdueBy("2026-11-15T12:00:00Z", now)).toEqual({ value: 5, unit: "days" });
  });
});
