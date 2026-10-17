import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { WholesalerInvitesPage } from "@/components/wholesaler-invites-page";

export const Route = createFileRoute("/wholesaler-invites")({
  head: () => ({
    meta: [
      { title: "Wholesaler Invites · VyaparOne Super Admin" },
      { name: "description", content: "Create and manage secure wholesaler registration invitations." },
    ],
  }),
  component: () => <AdminShell><WholesalerInvitesPage /></AdminShell>,
});
