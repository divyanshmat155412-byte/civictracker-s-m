import { createFileRoute } from "@tanstack/react-router";
import AIChatbot from "@/components/pages/AIChatbot";

export const Route = createFileRoute("/ai-chat")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Civic assistant — Civic Tracker" },
      { name: "description", content: "Ask the civic assistant about complaints, departments and status." },
      { property: "og:title", content: "Civic assistant — Civic Tracker" },
      { property: "og:description", content: "Ask the civic assistant about complaints, departments and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AIChatbot,
});
