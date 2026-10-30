import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const WholesalerInvitesPage = createLazyRoute(() => import("@/components/wholesaler-invites-page"), "WholesalerInvitesPage");

export const Route = createFileRoute("/wholesaler-invites")({
  head: () => ({
    meta: [
      { title: "Wholesaler Invites · VyaparOne Super Admin" },
      { name: "description", content: "Create and manage secure wholesaler registration invitations." },
    ],
  }),
  component: () => <AdminShell><WholesalerInvitesPage /></AdminShell>,
});
