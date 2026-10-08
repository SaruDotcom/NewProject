import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { CategoriesManagementPage } from "@/components/categories-management-page";
export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories · VyaparOne Super Admin" },
      {
        name: "description",
        content: "Organize catalog hierarchy, visibility, and display order.",
      },
      { property: "og:title", content: "Category Management" },
      {
        property: "og:description",
        content: "Organize the catalog hierarchy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => _jsx(AdminShell, { children: _jsx(CategoriesManagementPage, {}) }),
});
