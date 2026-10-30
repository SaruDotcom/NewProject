import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const OrdersManagementPage = createLazyRoute(() => import("@/components/orders-management-page"), "OrdersManagementPage");
export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Track every order from placement to delivery across the marketplace.",
      },
      { property: "og:title", content: "Order Management" },
      {
        property: "og:description",
        content: "Track orders from placement to delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    return _jsx(AdminShell, { children: pathname === "/orders" ? _jsx(OrdersManagementPage, {}) : _jsx(Outlet, {}) });
  },
});
