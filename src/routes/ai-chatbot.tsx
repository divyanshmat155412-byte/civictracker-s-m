import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ai-chatbot")({
  beforeLoad: () => {
    throw redirect({ to: "/ai-chat", replace: true });
  },
});
