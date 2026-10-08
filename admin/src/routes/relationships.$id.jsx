import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { RelationshipDetailPage } from "@/components/relationship-detail-page";

export const Route = createFileRoute("/relationships/$id")({
  head: () => ({
    meta: [
      { title: "Relationship Detail · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Commercial relationship details, orders, trade history, and metadata.",
      },
      { property: "og:title", content: "Relationship Detail" },
      {
        property: "og:description",
        content: "Wholesaler-retailer commercial connection profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(RelationshipDetailPage, {}),
});
