import { createFileRoute } from "@tanstack/react-router";
import Reports from "@/components/pages/Reports";

export const Route = createFileRoute("/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reports — Civic Tracker" },
      { name: "description", content: "Download civic complaint reports and analytics." },
      { property: "og:title", content: "Reports — Civic Tracker" },
      { property: "og:description", content: "Download civic complaint reports and analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reports,
});
