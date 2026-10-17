import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { adminQueryKeys } from "@/lib/query-client";

export function useCollectionData(collection, fallback = []) {
  const query = useQuery({
    queryKey: adminQueryKeys.collection(collection),
    queryFn: () => apiGet(`/${collection}`),
    select: (items) => Array.isArray(items) ? items : fallback,
  });
  return { data: query.data ?? fallback, loading: query.isLoading, error: query.error?.message ?? null };
}

export function useAdminDashboardStats(refreshKey = 0) {
  const query = useQuery({
    queryKey: adminQueryKeys.dashboard("stats"),
    queryFn: () => apiGet('/admin/dashboard/stats'),
  });
  useEffect(() => {
    if (refreshKey) void query.refetch();
  }, [refreshKey]);
  return { stats: query.data ?? null, loading: query.isLoading, error: query.error?.message ?? null };
}

export function useAdminDashboardCharts(period, refreshKey = 0) {
  const emptyCharts = {
    ordersOverTime: [],
    revenueOverTime: [],
    topWholesalers: [],
    topRetailers: [],
    ordersByStatus: [],
  };
  const query = useQuery({
    queryKey: adminQueryKeys.dashboard("charts", period),
    queryFn: async () => {
      const query = `?period=${encodeURIComponent(period)}`;
      const [orders, revenue, wholesalers, retailers, statuses] = await Promise.all([
        apiGet(`/admin/dashboard/charts/orders-over-time${query}`),
        apiGet(`/admin/dashboard/charts/revenue-over-time${query}`),
        apiGet(`/admin/dashboard/charts/top-wholesalers${query}`),
        apiGet(`/admin/dashboard/charts/top-retailers${query}`),
        apiGet(`/admin/dashboard/charts/orders-by-status${query}`),
      ]);
      return {
        ordersOverTime: orders?.data || [],
        revenueOverTime: revenue?.data || [],
        topWholesalers: Array.isArray(wholesalers) ? wholesalers : [],
        topRetailers: Array.isArray(retailers) ? retailers : [],
        ordersByStatus: statuses?.data || [],
      };
    },
  });
  useEffect(() => {
    if (refreshKey) void query.refetch();
  }, [refreshKey]);
  return { charts: query.data ?? emptyCharts, loading: query.isLoading, error: query.error?.message ?? null };
}

export function useAdminDashboardRecent(refreshKey = 0) {
  const emptyRecent = {
    recentOrders: [],
    recentRegistrations: [],
    pendingApprovals: [],
    lowStock: [],
  };
  const query = useQuery({
    queryKey: adminQueryKeys.dashboard("recent"),
    queryFn: () => apiGet('/admin/dashboard/recent'),
  });
  useEffect(() => {
    if (refreshKey) void query.refetch();
  }, [refreshKey]);
  return { recent: query.data ?? emptyRecent, loading: query.isLoading, error: query.error?.message ?? null };
}

export function useDashboardData() {
  const query = useQuery({
    queryKey: adminQueryKeys.dashboard("overview"),
    queryFn: async () => {
      const [dashboard, wholesalers, retailers, products, orders] = await Promise.all([
        apiGet("/dashboard"),
        apiGet("/users/wholesalers"),
        apiGet("/users/retailers"),
        apiGet("/products"),
        apiGet("/orders"),
      ]);
      const orderRows = Array.isArray(orders) ? orders : [];
      const summary = dashboard || {
        metrics: [],
        revenue: { daily: { labels: [], values: [] } },
        totals: {},
        recentOrders: [],
      };
      return {
        metrics: Array.isArray(summary.metrics) ? summary.metrics : [],
        salesTrend: Array.isArray(summary.revenue?.daily?.values)
          ? summary.revenue.daily.labels.map((label, index) => ({
            month: label,
            sales: summary.revenue.daily.values[index] || 0,
            orders: orderRows[index]?.totalAmount || 0,
            revenue: summary.revenue.daily.values[index] || 0,
          }))
          : [],
        orders: orderRows.slice(0, 12),
        wholesalers: Array.isArray(wholesalers) ? wholesalers : [],
        retailers: Array.isArray(retailers) ? retailers : [],
        products: Array.isArray(products) ? products : [],
      };
    },
  });
  return {
    data: query.data ?? { metrics: [], salesTrend: [], orders: [], wholesalers: [], retailers: [], products: [] },
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
