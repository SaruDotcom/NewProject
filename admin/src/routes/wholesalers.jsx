import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { WholesalerManagementPage } from "@/components/wholesaler-management-page";
export const Route = createFileRoute("/wholesalers")({
  head: () => ({
    meta: [
      { title: "Wholesalers · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Review, approve, and manage every wholesaler on the marketplace.",
      },
      { property: "og:title", content: "Wholesaler Management" },
      {
        property: "og:description",
        content: "Review, approve, and manage supply partners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () =>
    _jsx(AdminShell, {
      children: _jsx(WholesalerManagementPage, {}),
    }),
});
