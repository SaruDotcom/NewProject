import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const NotificationsManagementPage = createLazyRoute(() => import("@/components/notifications-management-page"), "NotificationsManagementPage");
export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Platform events and alerts across every module.",
      },
      { property: "og:title", content: "Notifications" },
      { property: "og:description", content: "Platform events and alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(NotificationsManagementPage, {}) }),
});
