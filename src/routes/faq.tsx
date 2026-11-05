import { createFileRoute } from "@tanstack/react-router";
import FAQ from "@/components/pages/FAQ";

export const Route = createFileRoute("/faq")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "FAQ — Civic Tracker" },
      { name: "description", content: "Answers to common questions about reporting civic issues in City." },
      { property: "og:title", content: "FAQ — Civic Tracker" },
      { property: "og:description", content: "Answers to common questions about reporting civic issues in City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FAQ,
});
