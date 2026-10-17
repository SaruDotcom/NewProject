import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { SupportManagementPage } from "@/components/support-management-page";

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
