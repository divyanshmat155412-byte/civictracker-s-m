import { createFileRoute } from "@tanstack/react-router";
import Scorecard from "@/components/pages/Scorecard";

export const Route = createFileRoute("/scorecard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accountability Scorecard — Civic Tracker" },
      {
        name: "description",
        content:
          "Public, proof-based report card of how genuinely and how fast each city department fixes citizen complaints.",
      },
      { property: "og:title", content: "Accountability Scorecard — Civic Tracker" },
      {
        property: "og:description",
        content:
          "Public, proof-based report card of how genuinely and how fast each city department fixes citizen complaints.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Scorecard,
});
