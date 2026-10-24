import { createFileRoute } from "@tanstack/react-router";
import { KycDetailPage } from "@/components/kyc-detail-page";

export const Route = createFileRoute("/kyc/$id")({
  head: () => ({
    meta: [
      { title: "KYC Profile · VyaparOne Super Admin" },
      {
        name: "description",
        content:
          "Wholesaler business details, KYC documents, and review history.",
      },
    ],
  }),
  component: KycDetailPage,
});
