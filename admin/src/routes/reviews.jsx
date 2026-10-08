import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { ReviewsManagementPage } from "@/components/reviews-management-page";
export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Moderate retailer reviews across the marketplace.",
      },
      { property: "og:title", content: "Review Moderation" },
      { property: "og:description", content: "Moderate marketplace reviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(ReviewsManagementPage, {}) }),
});
