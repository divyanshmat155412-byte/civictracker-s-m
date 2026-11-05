import { createFileRoute } from "@tanstack/react-router";
import AdminWorkers from "@/components/pages/AdminWorkers";

export const Route = createFileRoute("/admin/workers")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Manage workers — Civic Tracker" },
      { name: "description", content: "Assign and track field workers on civic complaints." },
      { property: "og:title", content: "Manage workers — Civic Tracker" },
      { property: "og:description", content: "Assign and track field workers on civic complaints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminWorkers,
});
