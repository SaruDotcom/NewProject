import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { RetailerDetailPage } from "@/components/retailer-detail-page";

export const Route = createFileRoute("/retailers/$id")({
  head: () => ({
    meta: [
      { title: "Retailer Detail · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Full retailer profile: connected wholesalers, orders, purchases, and payments.",
      },
      { property: "og:title", content: "Retailer Detail" },
      {
        property: "og:description",
        content: "Full retailer profile and activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(RetailerDetailPage, {}),
});

