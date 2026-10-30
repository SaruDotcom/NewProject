import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const KycManagementPage = createLazyRoute(() => import("@/components/kyc-management-page"), "KycManagementPage");

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "KYC Review · VyaparOne Super Admin" },
      { name: "description", content: "Review wholesaler KYC applications." },
    ],
  }),
  component: () => {
    const pathname = useRouterState({
      select: (state) => state.location.pathname,
    });
    return _jsx(AdminShell, {
      children:
        pathname === "/kyc"
          ? _jsx(KycManagementPage, {})
          : _jsx(Outlet, {}),
    });
  },
});
