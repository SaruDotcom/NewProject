import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const ReportsManagementPage = createLazyRoute(() => import("@/components/reports-management-page"), "ReportsManagementPage");
export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Sales, revenue, and network performance analytics.",
      },
      { property: "og:title", content: "Reports & Analytics" },
      { property: "og:description", content: "Sales and revenue analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(ReportsManagementPage, {}) }),
});
