import { describe, expect, it } from "vitest";
import { notificationDisplay } from "@/lib/notification-display";

describe("notification payload preservation", () => {
  it("preserves citizen title, location and description inside a known template", () => {
    const original = {
      type: "new_complaint",
      title: "🚨 New Complaint: High — मेरा मूल शीर्षक",
      body: "garbage issue reported at Station Road. Keep my English description unchanged.",
    };
    const copy = JSON.stringify(original);
    const translated = notificationDisplay(original, "hi");
    expect(translated.title.endsWith("High — मेरा मूल शीर्षक")).toBe(true);
    expect(translated.body.endsWith("Station Road. Keep my English description unchanged.")).toBe(true);
    expect(JSON.stringify(original)).toBe(copy);
  });
  it("preserves unknown notifications verbatim", () => {
    const notification = { type: "custom", title: "High", body: "Personal content: Pending" };
    expect(notificationDisplay(notification, "hi")).toEqual({ title: notification.title, body: notification.body });
  });
  it("preserves all English content", () => {
    const notification = { type: "complaint_update", title: "✅ Update: My report", body: "Status changed to resolved at Ratlam" };
    expect(notificationDisplay(notification, "en")).toEqual({ title: notification.title, body: notification.body });
  });
});