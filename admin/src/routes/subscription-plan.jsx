import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { SubscriptionPlanPage } from "@/components/subscription-plan-page";

export const Route = createFileRoute("/subscription-plan")({
  head: () => ({ meta: [{ title: "Subscription Plan · VyaparOne Super Admin" }] }),
  component: () => _jsx(AdminShell, { children: _jsx(SubscriptionPlanPage, {}) }),
});
