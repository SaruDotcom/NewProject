import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { RelationshipsManagementPage } from "@/components/relationships-management-page";
export const Route = createFileRoute("/relationships")({
  head: () => ({
    meta: [
      { title: "Relationships · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Manage every wholesaler–retailer commercial connection.",
      },
      { property: "og:title", content: "Wholesaler–Retailer Network" },
      {
        property: "og:description",
        content: "Manage commercial connections on the platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    return _jsx(AdminShell, { children: pathname === "/relationships" ? _jsx(RelationshipsManagementPage, {}) : _jsx(Outlet, {}) });
  },
});

