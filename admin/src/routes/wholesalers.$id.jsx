import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { createLazyRoute } from "@/lib/lazy-route";
const WholesalerDetailPage = createLazyRoute(() => import("@/components/wholesaler-detail-page"), "WholesalerDetailPage");
export const Route = createFileRoute("/wholesalers/$id")({
  head: () => ({
    meta: [
      { title: "Wholesaler Detail · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Full wholesaler profile: business info, products, retailers, orders, sales, and payments.",
      },
      { property: "og:title", content: "Wholesaler Detail" },
      {
        property: "og:description",
        content: "Full wholesaler profile and activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(WholesalerDetailPage, {}),
});
