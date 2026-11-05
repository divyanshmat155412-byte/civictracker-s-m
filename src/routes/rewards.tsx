import { createFileRoute } from "@tanstack/react-router";
import RewardsStore from "@/components/pages/RewardsStore";

export const Route = createFileRoute("/rewards")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rewards store — Civic Tracker" },
      { name: "description", content: "Redeem your green points for community rewards." },
      { property: "og:title", content: "Rewards store — Civic Tracker" },
      { property: "og:description", content: "Redeem your green points for community rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsStore,
});
