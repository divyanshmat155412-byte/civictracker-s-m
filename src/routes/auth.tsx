import { createFileRoute } from "@tanstack/react-router";
import Auth from "@/components/pages/Auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Civic Tracker" },
      { name: "description", content: "Sign in or create an account to report and track civic issues." },
      { property: "og:title", content: "Sign in — Civic Tracker" },
      { property: "og:description", content: "Sign in or create an account to report and track civic issues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});
