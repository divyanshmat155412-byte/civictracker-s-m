import { translateUi } from "@/lib/ui-translations";

/** Translate only known system scaffolding. All citizen payload remains verbatim. */
export function notificationDisplay(
  notification: { title: string; body: string; type: string },
  language: "en" | "hi",
) {
  const { title, body, type } = notification;
  if (language === "en") return { title, body };
  const tx = (text: string) => translateUi(text, language);
  if (type === "new_complaint" && title.startsWith("🚨 New Complaint: ")) {
    const match = /^(garbage|waterlogging|broken-road|streetlight|drainage|theft|fire|encroachment|noise|other) issue reported at ([\s\S]*)$/.exec(body);
    return {
      title: `🚨 नई शिकायत: ${title.slice("🚨 New Complaint: ".length)}`,
      body: match ? `${tx(match[1])} की समस्या यहाँ दर्ज हुई: ${match[2]}` : body,
    };
  }
  if (type === "complaint_update" && title.startsWith("✅ Update: ")) {
    const match = /^Status changed to (pending|in_progress|in-progress|resolved|escalated) at ([\s\S]*)$/.exec(body);
    return {
      title: `✅ अपडेट: ${title.slice("✅ Update: ".length)}`,
      body: match ? `स्थिति ${tx(match[1])} हुई — ${match[2]}` : body,
    };
  }
  // Unknown notification bodies may be personal/admin-authored text.
  return { title, body };
}