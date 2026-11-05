import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
const Heatmap = lazy(() => import("@/components/pages/Heatmap"));

export const Route = createFileRoute("/heatmap")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Heatmap — Civic Tracker" },
      { name: "description", content: "Heatmap of complaint density across City." },
      { property: "og:title", content: "Heatmap — Civic Tracker" },
      { property: "og:description", content: "Heatmap of complaint density across City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientOnly><Suspense fallback={null}><Heatmap /></Suspense></ClientOnly>,
});
