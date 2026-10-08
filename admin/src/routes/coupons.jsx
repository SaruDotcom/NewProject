import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { CouponsManagementPage } from "@/components/coupons-management-page";
export const Route = createFileRoute("/coupons")({
  head: () => ({
    meta: [
      { title: "Coupons & Offers · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Create and control promotional discounts.",
      },
      { property: "og:title", content: "Coupons & Offers" },
      { property: "og:description", content: "Manage promotional discounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(CouponsManagementPage, {}) }),
});
