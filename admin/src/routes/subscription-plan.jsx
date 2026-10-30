import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const SubscriptionPlanPage = createLazyRoute(() => import("@/components/subscription-plan-page"), "SubscriptionPlanPage");

export const Route = createFileRoute("/subscription-plan")({
  head: () => ({ meta: [{ title: "Subscription Plan · VyaparOne Super Admin" }] }),
  component: () => _jsx(AdminShell, { children: _jsx(SubscriptionPlanPage, {}) }),
});
