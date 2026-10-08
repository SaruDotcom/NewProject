import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { RetailerManagementPage } from "@/components/retailer-management-page";
export const Route = createFileRoute("/retailers")({
  head: () => ({
    meta: [
      { title: "Retailers · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Monitor retailer accounts, purchases, and wholesaler connections.",
      },
      { property: "og:title", content: "Retailer Management" },
      {
        property: "og:description",
        content: "Monitor retailer accounts and network access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    return _jsx(AdminShell, { children: pathname === "/retailers" ? _jsx(RetailerManagementPage, {}) : _jsx(Outlet, {}) });
  },
});
