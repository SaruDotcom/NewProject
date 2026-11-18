import { createFileRoute } from "@tanstack/react-router";
import { createLazyRoute } from "@/lib/lazy-route";

const BankDetailsManagementPage = createLazyRoute(
  () => import("@/components/bank-details-management-page"),
  "BankDetailsManagementPage",
);

export const Route = createFileRoute("/bank-details")({
  head: () => ({
    meta: [
      { title: "Bank Verification · ThokStore Super Admin" },
      {
        name: "description",
        content: "Review wholesaler bank detail submissions.",
      },
    ],
  }),
  component: BankDetailsManagementPage,
});
