import { QueryClient } from '@tanstack/react-query';

export function getWholesalerId(): string {
  if (typeof window === 'undefined') return 'unknown';
  return localStorage.getItem('wholesaler_user_id') || 'unknown';
}

export const wholesalerQueryKeys = {
  root: (userId = getWholesalerId()) => ['wholesaler', userId] as const,
  resource: (userId: string, resource: string, ...params: unknown[]) =>
    ['wholesaler', userId, resource, ...params] as const,
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
