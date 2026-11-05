import { createFileRoute } from "@tanstack/react-router";
import ComplaintDetail from "@/components/pages/ComplaintDetail";

export const Route = createFileRoute("/complaints/$id/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Complaint details — Civic Tracker" },
      { name: "description", content: "Full details, photos and timeline for a reported civic issue." },
      { property: "og:title", content: "Complaint details — Civic Tracker" },
      { property: "og:description", content: "Full details, photos and timeline for a reported civic issue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComplaintDetail,
});
