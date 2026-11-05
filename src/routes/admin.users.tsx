import { createFileRoute } from "@tanstack/react-router";
import AdminUsers from "@/components/pages/AdminUsers";

export const Route = createFileRoute("/admin/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Users — Civic Tracker" },
      { name: "description", content: "Manage citizen and administrator accounts." },
      { property: "og:title", content: "Users — Civic Tracker" },
      { property: "og:description", content: "Manage citizen and administrator accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminUsers,
});
