import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { createLazyRoute } from "@/lib/lazy-route";
const ContentManagementPage = createLazyRoute(() => import("@/components/content-management-page"), "ContentManagementPage");
export const Route = createFileRoute("/content")({
  head: () => ({
    meta: [
      { title: "Content Management · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Control banners, pages, and announcements.",
      },
      { property: "og:title", content: "Content Management" },
      {
        property: "og:description",
        content: "Control banners and announcements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(ContentManagementPage, {}) }),
});
