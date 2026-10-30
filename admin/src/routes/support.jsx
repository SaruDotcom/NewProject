import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const SupportManagementPage = createLazyRoute(() => import("@/components/support-management-page"), "SupportManagementPage");

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support Requests · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Review and respond to wholesaler and retailer support tickets.",
      },
    ],
  }),
  component: () =>
    _jsx(AdminShell, { children: _jsx(SupportManagementPage, {}) }),
});
