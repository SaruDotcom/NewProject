import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { PaymentsManagementPage } from "@/components/payments-management-page";
export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payments · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Track collections, pending dues, and settlements.",
      },
      { property: "og:title", content: "Payment Management" },
      {
        property: "og:description",
        content: "Track collections and settlements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const pathname = useRouterState({
      select: (state) => state.location.pathname,
    });
    return _jsx(AdminShell, {
      children:
        pathname === "/payments"
          ? _jsx(PaymentsManagementPage, {})
          : _jsx(Outlet, {}),
    });
  },
});
