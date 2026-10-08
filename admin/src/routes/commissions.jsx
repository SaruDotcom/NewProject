import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/commissions")({
  component: () => <Navigate to="/" replace />,
});

