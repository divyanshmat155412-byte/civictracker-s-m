import { createFileRoute } from "@tanstack/react-router";
import WhatsAppSetup from "@/components/pages/WhatsAppSetup";

export const Route = createFileRoute("/admin/whatsapp")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "WhatsApp setup — Civic Tracker" },
      { name: "description", content: "Configure WhatsApp complaint intake." },
      { property: "og:title", content: "WhatsApp setup — Civic Tracker" },
      { property: "og:description", content: "Configure WhatsApp complaint intake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhatsAppSetup,
});
