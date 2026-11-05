import { createFileRoute } from "@tanstack/react-router";
import AdminPosters from "@/components/pages/AdminPosters";

export const Route = createFileRoute("/admin/posters")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Posters — Civic Tracker" },
      { name: "description", content: "Generate printable posters for civic complaints." },
      { property: "og:title", content: "Posters — Civic Tracker" },
      { property: "og:description", content: "Generate printable posters for civic complaints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPosters,
});
