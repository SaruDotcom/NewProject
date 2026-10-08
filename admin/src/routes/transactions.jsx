import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { TransactionsManagementPage } from "@/components/transactions-management-page";
export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Every commission and settlement movement on the platform.",
      },
      { property: "og:title", content: "Transactions" },
      {
        property: "og:description",
        content: "Commission and settlement movements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(TransactionsManagementPage, {}) }),
});
