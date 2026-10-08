import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { SettingsPage } from "@/components/system-pages";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · VyaparOne Super Admin" },
    ],
  }),
  component: () =>
    _jsx(AdminShell, {
      children: _jsx(SettingsPage, {}),
    }),
});
