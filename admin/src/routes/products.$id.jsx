import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { createLazyRoute } from "@/lib/lazy-route";
const ProductDetailPage = createLazyRoute(() => import("@/components/product-detail-page"), "ProductDetailPage");
export const Route = createFileRoute("/products/$id")({
  head: () => ({
    meta: [
      { title: "Product Detail · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Product pricing, inventory, orders, and review history.",
      },
      { property: "og:title", content: "Product Detail" },
      {
        property: "og:description",
        content: "Product pricing, inventory, and history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(ProductDetailPage, {}),
});
