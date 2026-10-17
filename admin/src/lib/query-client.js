import { QueryClient } from "@tanstack/react-query";

export function getAdminUserId() {
  try {
    const user = JSON.parse(localStorage.getItem("admin_user") || "null");
    return String(user?.id || user?._id || user?.userId || "unknown");
  } catch {
    return "unknown";
  }
}

export const adminQueryKeys = {
  root: () => ["admin", getAdminUserId()],
  collection: (collection, ...params) => ["admin", getAdminUserId(), "collection", collection, ...params],
  dashboard: (section, ...params) => ["admin", getAdminUserId(), "dashboard", section, ...params],
  detail: (collection, id) => ["admin", getAdminUserId(), collection, "detail", id],
  request: (resource, path) => ["admin", getAdminUserId(), "request", resource, path],
  requestResource: (resource) => ["admin", getAdminUserId(), "request", resource],
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
