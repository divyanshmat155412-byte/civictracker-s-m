import { createFileRoute } from "@tanstack/react-router";
import Index from "@/components/pages/Index";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Civic Tracker — City" },
      { name: "description", content: "Report & track civic issues in City" },
      { property: "og:title", content: "Civic Tracker — City" },
      { property: "og:description", content: "Report & track civic issues in City" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});
