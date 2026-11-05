import { createFileRoute } from "@tanstack/react-router";
import Departments from "@/components/pages/Departments";

export const Route = createFileRoute("/departments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Departments — Civic Tracker" },
      { name: "description", content: "Civic departments in City and the issues they handle." },
      { property: "og:title", content: "Departments — Civic Tracker" },
      { property: "og:description", content: "Civic departments in City and the issues they handle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Departments,
});
