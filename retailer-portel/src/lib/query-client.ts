import { QueryClient } from "@tanstack/react-query";

export const retailerQueryKeys = {
  root: (userId: string) => ["retailer", userId] as const,
  resource: (userId: string, resource: string, ...params: unknown[]) =>
    ["retailer", userId, resource, ...params] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
