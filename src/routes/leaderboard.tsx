import { createFileRoute } from "@tanstack/react-router";
import Leaderboard from "@/components/pages/Leaderboard";

export const Route = createFileRoute("/leaderboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Leaderboard — Civic Tracker" },
      { name: "description", content: "Top citizens improving City, ranked by green points." },
      { property: "og:title", content: "Leaderboard — Civic Tracker" },
      { property: "og:description", content: "Top citizens improving City, ranked by green points." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});
