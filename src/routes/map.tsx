import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
const MapView = lazy(() => import("@/components/pages/MapView"));

export const Route = createFileRoute("/map")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Map — Civic Tracker" },
      { name: "description", content: "See every reported civic issue on a live map of City." },
      { property: "og:title", content: "Map — Civic Tracker" },
      { property: "og:description", content: "See every reported civic issue on a live map of City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientOnly><Suspense fallback={null}><MapView /></Suspense></ClientOnly>,
});
