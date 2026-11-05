import { createFileRoute } from "@tanstack/react-router";
import Contact from "@/components/pages/Contact";

export const Route = createFileRoute("/contact")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contact — Civic Tracker" },
      { name: "description", content: "Get in touch with the Civic Tracker City team." },
      { property: "og:title", content: "Contact — Civic Tracker" },
      { property: "og:description", content: "Get in touch with the Civic Tracker City team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});
