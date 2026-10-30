import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const DashboardPage = createLazyRoute(() => import("@/components/dashboard-page"), "DashboardPage");
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Marketplace overview: wholesalers, retailers, orders, sales, and platform revenue in one control center.",
      },
      { property: "og:title", content: "VyaparOne Super Admin Dashboard" },
      {
        property: "og:description",
        content: "Complete visibility across the wholesale commerce network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(DashboardPage, {}) }),
});
