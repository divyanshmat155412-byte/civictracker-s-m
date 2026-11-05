import { createFileRoute } from "@tanstack/react-router";
import Profile from "@/components/pages/Profile";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My profile — Civic Tracker" },
      { name: "description", content: "Your complaints, points, badges and account settings." },
      { property: "og:title", content: "My profile — Civic Tracker" },
      { property: "og:description", content: "Your complaints, points, badges and account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});
