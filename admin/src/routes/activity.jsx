import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const ActivityPage = createLazyRoute(() => import("@/components/system-pages"), "ActivityPage");

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
