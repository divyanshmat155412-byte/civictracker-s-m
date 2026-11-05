import { createFileRoute } from "@tanstack/react-router";
import Polls from "@/components/pages/Polls";

export const Route = createFileRoute("/polls")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Community polls — Civic Tracker" },
      { name: "description", content: "Vote on community priorities for City." },
      { property: "og:title", content: "Community polls — Civic Tracker" },
      { property: "og:description", content: "Vote on community priorities for City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Polls,
});
