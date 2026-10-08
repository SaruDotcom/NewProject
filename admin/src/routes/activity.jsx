import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { ActivityPage } from "@/components/system-pages";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log · VyaparOne Super Admin" },
    ],
  }),
  component: () =>
    _jsx(AdminShell, {
      children: _jsx(ActivityPage, {}),
    }),
});
