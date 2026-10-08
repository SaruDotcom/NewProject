import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export function useCollectionData(collection, fallback = []) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const items = await apiGet(`/${collection}`);
        if (!isMounted) return;
        setData(Array.isArray(items) ? items : []);
      } catch (err) {
        if (!isMounted) return;
        setData([]);
        setError(err.message || "Failed to load data");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [collection]);

  return { data, loading, error };
}

export function useAdminDashboardStats(refreshKey = 0) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const response = await apiGet('/admin/dashboard/stats');
        if (!isMounted) return;
        setStats(response || {});
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setStats(null);
        setError(err.message || 'Dashboard stats failed');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  return { stats, loading, error };
}

export function useAdminDashboardCharts(period, refreshKey = 0) {
  const [charts, setCharts] = useState({
    ordersOverTime: [],
    revenueOverTime: [],
    topWholesalers: [],
    topRetailers: [],
    ordersByStatus: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const query = `?period=${encodeURIComponent(period)}`;

    async function load() {
      setLoading(true);
      try {
        const [orders, revenue, wholesalers, retailers, statuses] = await Promise.all([
          apiGet(`/admin/dashboard/charts/orders-over-time${query}`),
          apiGet(`/admin/dashboard/charts/revenue-over-time${query}`),
          apiGet(`/admin/dashboard/charts/top-wholesalers${query}`),
          apiGet(`/admin/dashboard/charts/top-retailers${query}`),
          apiGet(`/admin/dashboard/charts/orders-by-status${query}`),
        ]);

        if (!isMounted) return;
        setCharts({
          ordersOverTime: orders?.data || [],
          revenueOverTime: revenue?.data || [],
          topWholesalers: Array.isArray(wholesalers) ? wholesalers : [],
          topRetailers: Array.isArray(retailers) ? retailers : [],
          ordersByStatus: statuses?.data || [],
        });
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setCharts({
          ordersOverTime: [],
          revenueOverTime: [],
          topWholesalers: [],
          topRetailers: [],
          ordersByStatus: [],
        });
        setError(err.message || 'Dashboard charts failed');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [period, refreshKey]);

  return { charts, loading, error };
}

export function useAdminDashboardRecent(refreshKey = 0) {
  const [recent, setRecent] = useState({
    recentOrders: [],
    recentRegistrations: [],
    pendingApprovals: [],
    lowStock: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const response = await apiGet('/admin/dashboard/recent');
        if (!isMounted) return;
        setRecent(response || {});
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setRecent({ recentOrders: [], recentRegistrations: [], pendingApprovals: [], lowStock: [] });
        setError(err.message || 'Recent dashboard records failed');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  return { recent, loading, error };
}

export function useDashboardData() {
  const [data, setData] = useState({
    metrics: [],
    salesTrend: [],
    orders: [],
    wholesalers: [],
    retailers: [],
    products: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [dashboard, wholesalers, retailers, products, orders] = await Promise.all([
          apiGet("/dashboard").catch(() => null),
          apiGet("/users/wholesalers").catch(() => []),
          apiGet("/users/retailers").catch(() => []),
          apiGet("/products").catch(() => []),
          apiGet("/orders").catch(() => []),
        ]);

        if (!isMounted) return;

        const orderRows = Array.isArray(orders) ? orders : [];
        const summary = dashboard || {
          metrics: [],
          revenue: { daily: { labels: [], values: [] } },
          totals: {},
          recentOrders: [],
        };

        setData({
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
        });
      } catch (err) {
        if (!isMounted) return;
        setData({
          metrics: [],
          salesTrend: [],
          orders: [],
          wholesalers: [],
          retailers: [],
          products: [],
        });
        setError(err.message || "Dashboard data failed");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return { data, loading, error };
}
