import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { createLazyRoute } from "@/lib/lazy-route";
const OrderDetailPage = createLazyRoute(() => import("@/components/order-detail-page"), "OrderDetailPage");
export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order Detail · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Order products, payment details, delivery status, and timeline.",
      },
      { property: "og:title", content: "Order Detail" },
      {
        property: "og:description",
        content: "Order payment, delivery, and timeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(OrderDetailPage, {}),
});
