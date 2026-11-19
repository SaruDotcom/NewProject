import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";

const ReferralCommissionManagementPage = createLazyRoute(
  () => import("@/components/referral-commission-management-page"),
  "ReferralCommissionManagementPage",
);

export const Route = createFileRoute("/commissions")({
  head: () => ({
    meta: [
      { title: "Referral & Commission Management · ThokStore Super Admin" },
      { name: "description", content: "Review wholesaler referrals and manually process approved referral commissions." },
    ],
  }),
  component: () => <AdminShell><ReferralCommissionManagementPage /></AdminShell>,
});

