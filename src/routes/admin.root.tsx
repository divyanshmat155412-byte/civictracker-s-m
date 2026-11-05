import { createFileRoute } from "@tanstack/react-router";
import SuperAdminDashboard from "@/components/pages/SuperAdminDashboard";

export const Route = createFileRoute("/admin/root")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Super Admin Dashboard — Civic Tracker" },
      { name: "description", content: "Platform-wide oversight of cities, admins, complaints and audit logs." },
      { property: "og:title", content: "Super Admin Dashboard — Civic Tracker" },
      { property: "og:description", content: "Platform-wide oversight of cities, admins, complaints and audit logs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminDashboard,
});
