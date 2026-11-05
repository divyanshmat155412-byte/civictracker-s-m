import { createFileRoute } from "@tanstack/react-router";
import ResetPassword from "@/components/pages/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Civic Tracker" },
      { name: "description", content: "Set a new password for your Civic Tracker account." },
      { property: "og:title", content: "Reset password — Civic Tracker" },
      { property: "og:description", content: "Set a new password for your Civic Tracker account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});
