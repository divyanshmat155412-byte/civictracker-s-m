import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/components/pages/Dashboard";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Civic Tracker" },
      { name: "description", content: "Live statistics on civic complaints, resolutions and response times." },
      { property: "og:title", content: "Dashboard — Civic Tracker" },
      { property: "og:description", content: "Live statistics on civic complaints, resolutions and response times." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
