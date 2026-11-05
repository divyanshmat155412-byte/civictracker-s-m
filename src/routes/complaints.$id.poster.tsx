import { createFileRoute } from "@tanstack/react-router";
import ComplaintPoster from "@/components/pages/ComplaintPoster";

export const Route = createFileRoute("/complaints/$id/poster")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Complaint poster — Civic Tracker" },
      { name: "description", content: "Shareable poster for a reported civic issue." },
      { property: "og:title", content: "Complaint poster — Civic Tracker" },
      { property: "og:description", content: "Shareable poster for a reported civic issue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComplaintPoster,
});
