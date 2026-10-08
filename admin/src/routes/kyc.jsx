import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { KycManagementPage } from "@/components/kyc-management-page";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "KYC Review · VyaparOne Super Admin" },
      { name: "description", content: "Review wholesaler KYC applications." },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(KycManagementPage, {}) }),
});
