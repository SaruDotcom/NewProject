import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { ProductsManagementPage } from "@/components/products-management-page";
export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Products · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Control catalog quality, stock visibility, and marketplace listings.",
      },
      { property: "og:title", content: "Product Management" },
      {
        property: "og:description",
        content: "Control catalog quality and listings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    return _jsx(AdminShell, { children: pathname === "/products" ? _jsx(ProductsManagementPage, {}) : _jsx(Outlet, {}) });
  },
});
