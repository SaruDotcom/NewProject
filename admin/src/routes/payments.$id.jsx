import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { PaymentDetailPage } from "@/components/payment-detail-page";

export const Route = createFileRoute("/payments/$id")({
  head: () => ({
    meta: [
      { title: "Payment Details · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "View payment status, parties, transaction references, and order breakdown.",
      },
      { property: "og:title", content: "Payment Details" },
      {
        property: "og:description",
        content: "Payment and related order information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(PaymentDetailPage, {}),
});
