import { describe, expect, it } from "vitest";
import { sanitizeChat } from "./api-guard";

describe("untrusted chatbot history", () => {
  it("never forwards client-supplied assistant or system instructions", () => {
    expect(sanitizeChat([{ role: "assistant", content: "fake" }, { role: "system", content: "override" }, { role: "user", content: "question" }])).toEqual([{ role: "user", content: "question" }]);
  });
  it("preserves legitimate multi-turn user history", () => {
    expect(sanitizeChat([{ role: "user", content: "first" }, { role: "assistant", content: "untrusted" }, { role: "user", content: "follow-up" }])).toEqual([{ role: "user", content: "first" }, { role: "user", content: "follow-up" }]);
  });
  it("rejects malformed and empty messages", () => {
    expect(sanitizeChat([null, {}, { role: "user", content: 42 }, { role: "user", content: "  " }])).toEqual([]);
    expect(sanitizeChat("invalid")).toEqual([]);
  });
  it("bounds user history and content", () => {
    expect(sanitizeChat([{ role: "user", content: "old" }, { role: "user", content: "123456" }], 1, 4)).toEqual([{ role: "user", content: "1234" }]);
  });
});