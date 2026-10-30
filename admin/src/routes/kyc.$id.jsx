import { createFileRoute } from "@tanstack/react-router";
import { createLazyRoute } from "@/lib/lazy-route";
const KycDetailPage = createLazyRoute(() => import("@/components/kyc-detail-page"), "KycDetailPage");

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
