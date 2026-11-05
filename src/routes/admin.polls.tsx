import { createFileRoute } from "@tanstack/react-router";
import AdminPolls from "@/components/pages/AdminPolls";

export const Route = createFileRoute("/admin/polls")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Manage polls — Civic Tracker" },
      { name: "description", content: "Create and manage community polls." },
      { property: "og:title", content: "Manage polls — Civic Tracker" },
      { property: "og:description", content: "Create and manage community polls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPolls,
});
