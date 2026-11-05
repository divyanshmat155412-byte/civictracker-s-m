import { createFileRoute } from "@tanstack/react-router";
import Predictions from "@/components/pages/Predictions";

export const Route = createFileRoute("/predictions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Predictions — Civic Tracker" },
      { name: "description", content: "Forecasts of where civic issues are likely to appear next." },
      { property: "og:title", content: "Predictions — Civic Tracker" },
      { property: "og:description", content: "Forecasts of where civic issues are likely to appear next." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Predictions,
});
