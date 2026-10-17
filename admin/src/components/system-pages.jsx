import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgePercent,
  Bell,
  Check,
  CircleDollarSign,
  CreditCard,
  Download,
  FileBarChart,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Star,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DataTable,
  KpiCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/admin-ui";
import { useCollectionData } from "@/hooks/use-live-data";
import { apiGet, apiPut } from "@/lib/api";

const adminUsers = [];
const coupons = [];
const initialNotifications = [];
const reviews = [];
const salesTrend = [];
const transactions = [];

export function PaymentsPage() {
  const { data: transactions, loading } = useCollectionData("payments");
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Payment Management",
        description: "Track collections, pending dues, and settlements.",
        action: _jsxs(Button, {
          variant: "outline",
          onClick: () => toast.success("Settlement batch started"),
          children: [_jsx(Wallet, {}), " Run settlement"],
        }),
      }),
      _jsxs("div", {
        className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
        children: [
          _jsx(KpiCard, {
            label: "Collected",
            value: "\u20B91.86 Cr",
            change: "14.2%",
            icon: CircleDollarSign,
            tone: "success",
          }),
          _jsx(KpiCard, {
            label: "Pending",
            value: "\u20B912.8 L",
            change: "-4.2%",
            icon: CreditCard,
            tone: "warning",
          }),
          _jsx(KpiCard, {
            label: "Settled",
            value: "\u20B91.72 Cr",
            change: "11.8%",
            icon: Check,
          }),
          _jsx(KpiCard, {
            label: "Refunds",
            value: "\u20B92.4 L",
            change: "-1.6%",
            icon: BadgePercent,
          }),
        ],
      }),
      _jsx(DataTable, {
        data: transactions,
        columns: [
          {
            key: "id",
            label: "Transaction",
            render: (r) =>
              _jsx("span", {
                className: "font-semibold text-primary",
                children: r.id || r._id,
              }),
          },
          {
            key: "orderId",
            label: "Order",
            render: (r) => r.order?.orderNo || r.order || "-",
          },
          {
            key: "retailer",
            label: "Retailer",
            render: (r) => r.order?.retailer?.name || "-",
          },
          {
            key: "amount",
            label: "Amount",
          },
          {
            key: "method",
            label: "Method",
          },
          {
            key: "status",
            label: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.status }),
          },
          {
            key: "createdAt",
            label: "Date",
            render: (r) => new Date(r.createdAt).toLocaleDateString(),
          },
        ],
        searchKeys: ["id", "orderId", "retailer"],
        filters: ["success", "pending", "failed"],
      }),
    ],
  });
}
export function TransactionsPage() {
  const { data: transactions, loading } = useCollectionData("wallet/transactions");
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Transactions",
        description:
          "Every commission and settlement movement on the platform.",
      }),
      _jsx(DataTable, {
        data: transactions,
        columns: [
          {
            key: "id",
            label: "Transaction",
            sortable: true,
            render: (r) =>
              _jsx("span", {
                className: "font-semibold text-primary",
                children: r.id || r._id,
              }),
          },
          { key: "type", label: "Type" },
          { key: "amount", label: "Amount" },
          { key: "balanceAfter", label: "Balance" },
          {
            key: "date",
            label: "Date",
            render: (r) => new Date(r.createdAt).toLocaleDateString(),
          },
        ],
        searchKeys: ["id", "orderId", "wholesaler"],
        filters: [],
      }),
    ],
  });
}
export function CommissionsPage() {
  const [rate, setRate] = useState("3.5");
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Commission Management",
        description: "Configure platform commission and track earnings.",
        action: _jsx(Button, {
          onClick: () =>
            toast.success("Commission rules saved", {
              description: `Global rate set to ${rate}%`,
            }),
          children: "Save rules",
        }),
      }),
      _jsxs("div", {
        className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
        children: [
          _jsx(KpiCard, {
            label: "Commission Earned",
            value: "\u20B929.47 L",
            change: "15.1%",
            icon: BadgePercent,
            tone: "success",
          }),
          _jsx(KpiCard, {
            label: "This Month",
            value: "\u20B94.86 L",
            change: "9.4%",
            icon: CircleDollarSign,
          }),
          _jsx(KpiCard, {
            label: "Avg. Rate",
            value: "3.5%",
            icon: BadgePercent,
          }),
          _jsx(KpiCard, {
            label: "Pending Payouts",
            value: "\u20B91.9 L",
            change: "-2.0%",
            icon: Wallet,
            tone: "warning",
          }),
        ],
      }),
      _jsx(SectionCard, {
        title: "Commission Rules",
        description: "Demo settings stored locally",
        children: _jsxs("div", {
          className: "grid gap-4 sm:grid-cols-3",
          children: [
            _jsxs("div", {
              className: "space-y-2",
              children: [
                _jsx(Label, {
                  htmlFor: "rate",
                  children: "Global commission %",
                }),
                _jsx(Input, {
                  id: "rate",
                  value: rate,
                  onChange: (e) => setRate(e.target.value),
                }),
              ],
            }),
            _jsxs("div", {
              className: "space-y-2",
              children: [
                _jsx(Label, {
                  htmlFor: "min",
                  children: "Minimum per order (\u20B9)",
                }),
                _jsx(Input, { id: "min", defaultValue: "25" }),
              ],
            }),
            _jsxs("div", {
              className: "space-y-2",
              children: [
                _jsx(Label, {
                  htmlFor: "cap",
                  children: "Maximum per order (\u20B9)",
                }),
                _jsx(Input, { id: "cap", defaultValue: "5000" }),
              ],
            }),
          ],
        }),
      }),
      _jsx(DataTable, {
        data: transactions.slice(0, 20),
        columns: [
          { key: "id", label: "Transaction" },
          { key: "orderId", label: "Order" },
          { key: "amount", label: "Order Value" },
          { key: "commission", label: "Commission" },
          {
            key: "status",
            label: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.status }),
          },
          { key: "date", label: "Date" },
        ],
        searchKeys: ["id", "orderId"],
        filters: ["Completed", "Pending"],
      }),
    ],
  });
}
export function ReportsPage() {
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Reports & Analytics",
        description: "Sales, revenue, and network performance at a glance.",
        action: _jsxs(Button, {
          variant: "outline",
          onClick: () =>
            toast.success("Report generated", {
              description: "Your PDF export is ready.",
            }),
          children: [_jsx(Download, {}), " Export PDF"],
        }),
      }),
      _jsxs("div", {
        className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
        children: [
          _jsx(KpiCard, {
            label: "Total Sales",
            value: "\u20B98.42 Cr",
            change: "18.6%",
            icon: FileBarChart,
          }),
          _jsx(KpiCard, {
            label: "Platform Revenue",
            value: "\u20B929.47 L",
            change: "15.1%",
            icon: CircleDollarSign,
            tone: "success",
          }),
          _jsx(KpiCard, {
            label: "Orders",
            value: "42,816",
            change: "14.3%",
            icon: FileBarChart,
          }),
          _jsx(KpiCard, {
            label: "Avg. Order Value",
            value: "\u20B91,966",
            change: "3.8%",
            icon: BadgePercent,
          }),
        ],
      }),
      _jsx(SectionCard, {
        title: "Sales & Revenue Trend",
        description: "\u20B9 in lakhs \u00B7 last 6 months",
        children: _jsx("div", {
          className: "h-80",
          children: _jsx(ResponsiveContainer, {
            width: "100%",
            height: "100%",
            children: _jsxs(AreaChart, {
              data: salesTrend,
              children: [
                _jsx("defs", {
                  children: _jsxs("linearGradient", {
                    id: "rep",
                    x1: "0",
                    y1: "0",
                    x2: "0",
                    y2: "1",
                    children: [
                      _jsx("stop", {
                        offset: "5%",
                        stopColor: "var(--color-primary)",
                        stopOpacity: 0.18,
                      }),
                      _jsx("stop", {
                        offset: "95%",
                        stopColor: "var(--color-primary)",
                        stopOpacity: 0,
                      }),
                    ],
                  }),
                }),
                _jsx(CartesianGrid, {
                  stroke: "var(--color-border)",
                  vertical: false,
                }),
                _jsx(XAxis, {
                  dataKey: "month",
                  tickLine: false,
                  axisLine: false,
                  fontSize: 11,
                }),
                _jsx(YAxis, { tickLine: false, axisLine: false, fontSize: 11 }),
                _jsx(Tooltip, {
                  contentStyle: {
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  },
                }),
                _jsx(Area, {
                  type: "monotone",
                  dataKey: "sales",
                  stroke: "var(--color-primary)",
                  fill: "url(#rep)",
                  strokeWidth: 2.5,
                }),
                _jsx(Area, {
                  type: "monotone",
                  dataKey: "revenue",
                  stroke: "var(--color-success)",
                  fill: "transparent",
                  strokeWidth: 2,
                }),
              ],
            }),
          }),
        }),
      }),
    ],
  });
}
export function NotificationsPage() {
  const [items, setItems] = useState(initialNotifications);
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Notifications",
        description: "Platform events across every module.",
        action: _jsxs(Button, {
          variant: "outline",
          onClick: () => {
            setItems((list) => list.map((n) => ({ ...n, unread: false })));
            toast.success("All notifications marked as read");
          },
          children: [_jsx(Check, {}), " Mark all read"],
        }),
      }),
      _jsx("div", {
        className: "space-y-2",
        children: items.map((n) =>
          _jsxs(
            "div",
            {
              className: `admin-card flex items-start gap-3 p-4 ${n.unread ? "" : "opacity-70"}`,
              children: [
                _jsx("span", {
                  className:
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary",
                  children: _jsx(Bell, { className: "size-4" }),
                }),
                _jsxs("div", {
                  className: "min-w-0 flex-1",
                  children: [
                    _jsxs("div", {
                      className: "flex items-center gap-2",
                      children: [
                        _jsx("p", {
                          className: "text-sm font-semibold",
                          children: n.title,
                        }),
                        n.unread &&
                          _jsx("span", {
                            className: "size-2 rounded-full bg-primary",
                          }),
                      ],
                    }),
                    _jsx("p", {
                      className: "mt-0.5 text-xs text-muted-foreground",
                      children: n.message,
                    }),
                  ],
                }),
                _jsxs("div", {
                  className: "shrink-0 text-right",
                  children: [
                    _jsx(StatusBadge, { status: n.module ?? "System" }),
                    _jsx("p", {
                      className: "mt-1 text-[11px] text-muted-foreground",
                      children: n.time,
                    }),
                  ],
                }),
              ],
            },
            n.id,
          ),
        ),
      }),
    ],
  });
}
export function ReviewsPage() {
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Review Moderation",
        description: "Approve, hide, or respond to retailer reviews.",
      }),
      _jsxs("div", {
        className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
        children: [
          _jsx(KpiCard, {
            label: "Total Reviews",
            value: "1,284",
            change: "8.4%",
            icon: Star,
          }),
          _jsx(KpiCard, {
            label: "Avg. Rating",
            value: "4.2 / 5",
            change: "0.3",
            icon: Star,
            tone: "success",
          }),
          _jsx(KpiCard, {
            label: "Pending",
            value: "36",
            icon: Star,
            tone: "warning",
          }),
          _jsx(KpiCard, {
            label: "Hidden",
            value: "12",
            change: "-2.1%",
            icon: Star,
          }),
        ],
      }),
      _jsx(DataTable, {
        data: reviews,
        columns: [
          {
            key: "product",
            label: "Product",
            render: (r) =>
              _jsx("span", {
                className: "max-w-56 block truncate font-semibold",
                children: r.product,
              }),
          },
          { key: "retailer", label: "Retailer" },
          { key: "wholesaler", label: "Wholesaler" },
          {
            key: "rating",
            label: "Rating",
            sortable: true,
            render: (r) => `${r.rating} / 5`,
          },
          {
            key: "review",
            label: "Review",
            render: (r) =>
              _jsx("span", {
                className: "max-w-64 block truncate text-muted-foreground",
                children: r.review,
              }),
          },
          { key: "date", label: "Date" },
          {
            key: "status",
            label: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.status }),
          },
        ],
        searchKeys: ["product", "retailer", "wholesaler"],
        filters: ["Approved", "Pending", "Hidden"],
      }),
    ],
  });
}
export function CouponsPage() {
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Coupons & Offers",
        description: "Create and control promotional discounts.",
        action: _jsxs(Button, {
          onClick: () => toast("Coupon builder opened"),
          children: [_jsx(Plus, {}), " Create coupon"],
        }),
      }),
      _jsx(DataTable, {
        data: coupons,
        columns: [
          {
            key: "code",
            label: "Code",
            render: (r) =>
              _jsx("span", {
                className:
                  "rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold",
                children: r.code,
              }),
          },
          { key: "type", label: "Type" },
          { key: "value", label: "Value" },
          { key: "minimum", label: "Min. Order" },
          { key: "maximum", label: "Max. Discount" },
          { key: "start", label: "Start" },
          { key: "end", label: "End" },
          { key: "usage", label: "Usage" },
          {
            key: "status",
            label: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.status }),
          },
        ],
        searchKeys: ["code"],
        filters: ["Active", "Inactive"],
      }),
    ],
  });
}
const contentPages = [
  {
    id: "CNT-1",
    name: "Homepage hero banner",
    type: "Banner",
    updated: "2 days ago",
  },
  {
    id: "CNT-2",
    name: "Retailer onboarding guide",
    type: "Page",
    updated: "5 days ago",
  },
  {
    id: "CNT-3",
    name: "Festive sale announcement",
    type: "Announcement",
    updated: "1 week ago",
  },
  {
    id: "CNT-4",
    name: "Terms & conditions",
    type: "Page",
    updated: "3 weeks ago",
  },
  { id: "CNT-5", name: "Privacy policy", type: "Page", updated: "1 month ago" },
];
export function ContentPage() {
  const [pages, setPages] = useState(
    contentPages.map((p, i) => ({ ...p, live: i !== 2 })),
  );
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Content Management",
        description: "Control banners, pages, and announcements.",
        action: _jsxs(Button, {
          onClick: () => toast("Content editor opened"),
          children: [_jsx(Plus, {}), " New content"],
        }),
      }),
      _jsx("div", {
        className: "space-y-2",
        children: pages.map((p) =>
          _jsxs(
            "div",
            {
              className: "admin-card flex items-center gap-4 p-4",
              children: [
                _jsxs("div", {
                  className: "min-w-0 flex-1",
                  children: [
                    _jsx("p", {
                      className: "text-sm font-semibold",
                      children: p.name,
                    }),
                    _jsxs("p", {
                      className: "text-xs text-muted-foreground",
                      children: [p.type, " \u00B7 Updated ", p.updated],
                    }),
                  ],
                }),
                _jsx(StatusBadge, { status: p.live ? "Published" : "Draft" }),
                _jsx(Switch, {
                  checked: p.live,
                  onCheckedChange: (live) => {
                    setPages((list) =>
                      list.map((x) => (x.id === p.id ? { ...x, live } : x)),
                    );
                    toast.success(
                      `${p.name} ${live ? "published" : "unpublished"}`,
                    );
                  },
                  "aria-label": `Toggle ${p.name}`,
                }),
                _jsx(Button, {
                  variant: "outline",
                  size: "sm",
                  onClick: () => toast("Content editor opened"),
                  children: "Edit",
                }),
              ],
            },
            p.id,
          ),
        ),
      }),
    ],
  });
}
export function AdminUsersPage() {
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Admin Users & Roles",
        description: "Manage internal access and permissions.",
        action: _jsxs(Button, {
          onClick: () => toast("Invite form opened"),
          children: [_jsx(UserPlus, {}), " Invite admin"],
        }),
      }),
      _jsx(DataTable, {
        data: adminUsers,
        columns: [
          {
            key: "name",
            label: "Name",
            render: (r) =>
              _jsx("span", { className: "font-semibold", children: r.name }),
          },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          {
            key: "status",
            label: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.status }),
          },
          { key: "lastLogin", label: "Last Login" },
        ],
        searchKeys: ["name", "email", "role"],
        filters: [
          "Active",
          "Inactive",
          "Super Admin",
          "Operations",
          "Finance",
          "Support",
        ],
      }),
    ],
  });
}
export function ActivityPage() {
  const { data: activity, loading, error } = useCollectionData("admin/activity");
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Activity Log",
        description: "Audit trail of every administrative action.",
      }),
      _jsx(SectionCard, {
        title: "Recent Activity",
        children: loading
          ? _jsx("p", {
              className: "py-8 text-center text-sm text-muted-foreground",
              children: "Loading activity…",
            })
          : error
            ? _jsx("p", {
                className: "py-8 text-center text-sm text-destructive",
                children: `Unable to load activity: ${error}`,
              })
            : activity.length === 0
              ? _jsx("p", {
                  className: "py-8 text-center text-sm text-muted-foreground",
                  children: "No activity recorded yet.",
                })
              : _jsx("div", {
                  children: activity.map((entry) =>
                    _jsxs(
                      "div",
                      {
                        className: "border-l-2 border-primary/25 pb-6 pl-4 last:pb-0",
                        children: [
                          _jsx("p", {
                            className: "text-sm font-semibold",
                            children: entry.action,
                          }),
                          _jsx("p", {
                            className: "text-xs text-muted-foreground",
                            children: [entry.user, entry.entity].filter(Boolean).join(" · "),
                          }),
                          _jsx("p", {
                            className: "mt-1 text-[11px] text-muted-foreground",
                            children: entry.timestamp
                              ? new Date(entry.timestamp).toLocaleString()
                              : "Date unavailable",
                          }),
                        ],
                      },
                      entry.id,
                    ),
                  ),
                }),
      }),
    ],
  });
}
const settingsGroups = {
  General: [
    ["Marketplace name", "VyaparOne"],
    ["Support email", "support@vyaparone.in"],
    ["Support phone", "+91 1800 419 0000"],
    ["Currency", "INR (₹)"],
  ],
  Orders: [
    ["Default order SLA", "3 days"],
    ["Auto-cancel window", "48 hours"],
    ["Minimum order value", "₹2,000"],
    ["Return window", "7 days"],
  ],
  Payments: [
    ["Settlement cycle", "T+2 days"],
    ["Payment gateway", "Razorpay (demo)"],
    ["Payout threshold", "₹10,000"],
    ["Late fee", "1.5% / week"],
  ],
  Notifications: [
    ["Order alerts", "Enabled"],
    ["Low stock alerts", "Enabled"],
    ["Weekly summary", "Enabled"],
    ["SMS alerts", "Disabled"],
  ],
};
export function SettingsPage() {
  const [settings, setSettings] = useState({
    // General
    marketplaceName: "VyaparOne B2B Marketplace",
    supportEmail: "support@vyaparone.com",
    supportPhone: "+91 1800-123-9999",
    supportAddress: "VyaparOne Tech Tower, Sector 62, Noida, UP - 201309",
    currency: "INR (₹)",
    maintenanceMode: false,

    // Financials
    platformCommissionRate: 3.5,
    minCommissionPerOrder: 25,
    maxCommissionPerOrder: 5000,
    minPayoutThreshold: 5000,
    settlementCycle: "T+2 Days",
    paymentGateway: "Razorpay",
    lateFeePercent: 1.5,

    // Orders & SLA
    minOrderValue: 2000,
    defaultOrderSla: "3 Days",
    autoCancelWindowHours: 48,
    returnWindowDays: 7,
    freeShippingThreshold: 10000,
    autoReserveStock: true,

    // Security & KYC
    autoApproveKyc: false,
    mandatoryGstVerification: true,
    allowRetailerSelfRegister: true,
    maxFailedLoginAttempts: 5,
    sessionTimeoutMinutes: 60,

    // Notifications
    enableOrderSmsAlerts: true,
    enableLowStockAlerts: true,
    enableEmailNotifications: true,
    enableWeeklyDigest: true,
    enableHelpCenterPush: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [lastSavedTime, setLastSavedTime] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiGet("/admin/settings")
      .then((data) => {
        if (!mounted) return;
        if (data && typeof data === "object") {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => {
        console.error("Failed to load settings:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut("/admin/settings", settings);
      toast.success("Platform settings saved successfully", {
        description: "All configuration updates are now active across the marketplace.",
      });
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      toast.error(err.message || "Failed to update platform settings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings({
      marketplaceName: "VyaparOne B2B Marketplace",
      supportEmail: "support@vyaparone.com",
      supportPhone: "+91 1800-123-9999",
      supportAddress: "VyaparOne Tech Tower, Sector 62, Noida, UP - 201309",
      currency: "INR (₹)",
      maintenanceMode: false,
      platformCommissionRate: 3.5,
      minCommissionPerOrder: 25,
      maxCommissionPerOrder: 5000,
      minPayoutThreshold: 5000,
      settlementCycle: "T+2 Days",
      paymentGateway: "Razorpay",
      lateFeePercent: 1.5,
      minOrderValue: 2000,
      defaultOrderSla: "3 Days",
      autoCancelWindowHours: 48,
      returnWindowDays: 7,
      freeShippingThreshold: 10000,
      autoReserveStock: true,
      autoApproveKyc: false,
      mandatoryGstVerification: true,
      allowRetailerSelfRegister: true,
      maxFailedLoginAttempts: 5,
      sessionTimeoutMinutes: 60,
      enableOrderSmsAlerts: true,
      enableLowStockAlerts: true,
      enableEmailNotifications: true,
      enableWeeklyDigest: true,
      enableHelpCenterPush: true,
    });
    toast.info("Settings reset to system defaults");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace & Platform Settings"
        description="Manage global business rules, commission structures, order SLAs, security compliance, and system alerts."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleResetDefaults} disabled={saving || loading}>
              <RefreshCw className="mr-1.5 size-4" /> Reset Defaults
            </Button>
            <Button onClick={handleSave} disabled={saving || loading} className="font-bold shadow-md">
              {saving ? (
                <>
                  <RefreshCw className="mr-1.5 size-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 size-4" /> Save All Settings
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* System Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
            <SlidersHorizontal className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Super Admin Control Engine</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                ● Live & Operational
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Changes updated here affect live order processing, settlement engines, and wholesaler portals instantly.
            </p>
          </div>
        </div>
        {lastSavedTime && (
          <div className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">
            Last saved: {lastSavedTime}
          </div>
        )}
      </div>

      {/* Settings Tabbed Interface */}
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto p-1 bg-muted/60 rounded-xl gap-1">
          <TabsTrigger value="general" className="py-2.5 text-xs font-bold gap-2">
            <Globe className="size-4" /> General
          </TabsTrigger>
          <TabsTrigger value="financials" className="py-2.5 text-xs font-bold gap-2">
            <CircleDollarSign className="size-4" /> Financials
          </TabsTrigger>
          <TabsTrigger value="orders" className="py-2.5 text-xs font-bold gap-2">
            <CreditCard className="size-4" /> Orders & SLA
          </TabsTrigger>
          <TabsTrigger value="security" className="py-2.5 text-xs font-bold gap-2">
            <Lock className="size-4" /> Security & KYC
          </TabsTrigger>
          <TabsTrigger value="notifications" className="py-2.5 text-xs font-bold gap-2">
            <Bell className="size-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GENERAL SETTINGS */}
        <TabsContent value="general" className="space-y-6">
          <SectionCard
            title="General Marketplace Profile"
            description="Core platform identity, contact credentials, and emergency maintenance status."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Marketplace Name *</Label>
                <Input
                  value={settings.marketplaceName}
                  onChange={(e) => handleChange("marketplaceName", e.target.value)}
                  placeholder="e.g. VyaparOne B2B Wholesale"
                />
                <p className="text-[11px] text-muted-foreground">Brand name displayed on invoices, emails, and headers.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Official Support Email *</Label>
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => handleChange("supportEmail", e.target.value)}
                  placeholder="support@vyaparone.com"
                />
                <p className="text-[11px] text-muted-foreground">Primary contact email for system tickets and inquiries.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Support Helpline Phone *</Label>
                <Input
                  value={settings.supportPhone}
                  onChange={(e) => handleChange("supportPhone", e.target.value)}
                  placeholder="+91 1800-123-9999"
                />
                <p className="text-[11px] text-muted-foreground">Toll-free customer support line for wholesalers and retailers.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Platform Base Currency</Label>
                <Select value={settings.currency} onValueChange={(val) => handleChange("currency", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR (₹)">INR (Indian Rupee - ₹)</SelectItem>
                    <SelectItem value="USD ($)">USD (US Dollar - $)</SelectItem>
                    <SelectItem value="AED (AED)">AED (UAE Dirham)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Default currency used across all transaction processing.</p>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs font-bold">Corporate Office Address</Label>
                <Input
                  value={settings.supportAddress}
                  onChange={(e) => handleChange("supportAddress", e.target.value)}
                  placeholder="Company office address"
                />
                <p className="text-[11px] text-muted-foreground">Official business address printed on legal documents and footers.</p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold text-foreground">Maintenance Mode</Label>
                <p className="text-[11px] text-muted-foreground">
                  Temporarily pause new order placements while keeping portals in read-only mode.
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(val) => handleChange("maintenanceMode", val)}
              />
            </div>
          </SectionCard>
        </TabsContent>

        {/* TAB 2: FINANCIALS & COMMISSION SETTINGS */}
        <TabsContent value="financials" className="space-y-6">
          <SectionCard
            title="Commission & Revenue Rules"
            description="Configure global platform commission percentages, min/max caps, and payment gateway rules."
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Global Platform Commission (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.platformCommissionRate}
                    onChange={(e) => handleChange("platformCommissionRate", parseFloat(e.target.value) || 0)}
                    className="pr-8 font-mono font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-muted-foreground">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Standard commission deducted from gross order subtotal.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Min Commission per Order (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    value={settings.minCommissionPerOrder}
                    onChange={(e) => handleChange("minCommissionPerOrder", parseInt(e.target.value, 10) || 0)}
                    className="pl-8 font-mono font-bold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Floor commission amount charged for low-value orders.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Max Commission Cap per Order (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    value={settings.maxCommissionPerOrder}
                    onChange={(e) => handleChange("maxCommissionPerOrder", parseInt(e.target.value, 10) || 0)}
                    className="pl-8 font-mono font-bold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Upper cap on commission fee for bulk high-value orders.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Payouts & Settlement Configuration"
            description="Rules governing wholesaler wallet payouts, settlement cycles, and gateway providers."
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Minimum Payout Request (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    value={settings.minPayoutThreshold}
                    onChange={(e) => handleChange("minPayoutThreshold", parseInt(e.target.value, 10) || 0)}
                    className="pl-8 font-mono font-bold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Minimum wallet balance required for payout requests.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Settlement Cycle</Label>
                <Select value={settings.settlementCycle} onValueChange={(val) => handleChange("settlementCycle", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select settlement cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T+1 Day">T+1 Day (Next Business Day)</SelectItem>
                    <SelectItem value="T+2 Days">T+2 Days (Standard B2B)</SelectItem>
                    <SelectItem value="T+3 Days">T+3 Days</SelectItem>
                    <SelectItem value="Weekly">Weekly (Every Monday)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Time taken to release earnings after order delivery.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Primary Payment Gateway</Label>
                <Select value={settings.paymentGateway} onValueChange={(val) => handleChange("paymentGateway", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Gateway" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Razorpay">Razorpay (Cards, NetBanking, UPI)</SelectItem>
                    <SelectItem value="Cashfree">Cashfree Payments</SelectItem>
                    <SelectItem value="Stripe">Stripe Payments</SelectItem>
                    <SelectItem value="UPI Direct">UPI Direct Merchant</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Active gateway handling online payment checkouts.</p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* TAB 3: ORDERS & SLA SETTINGS */}
        <TabsContent value="orders" className="space-y-6">
          <SectionCard
            title="Order Fulfillment & SLA Limits"
            description="Minimum order values, SLA processing windows, and auto-cancellation rules."
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Minimum Order Value (MOV) (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    value={settings.minOrderValue}
                    onChange={(e) => handleChange("minOrderValue", parseInt(e.target.value, 10) || 0)}
                    className="pl-8 font-mono font-bold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Minimum cart total required to place a B2B order.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Default Fulfillment SLA</Label>
                <Select value={settings.defaultOrderSla} onValueChange={(val) => handleChange("defaultOrderSla", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select SLA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 Day">1 Day (Express Dispatch)</SelectItem>
                    <SelectItem value="2 Days">2 Days</SelectItem>
                    <SelectItem value="3 Days">3 Days (Standard)</SelectItem>
                    <SelectItem value="5 Days">5 Days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Target dispatch SLA expected from wholesalers.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Auto-Cancel Window (Hours)</Label>
                <Input
                  type="number"
                  value={settings.autoCancelWindowHours}
                  onChange={(e) => handleChange("autoCancelWindowHours", parseInt(e.target.value, 10) || 0)}
                  className="font-mono font-bold"
                />
                <p className="text-[11px] text-muted-foreground">Unconfirmed orders auto-cancel after this duration.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Return Request Window (Days)</Label>
                <Input
                  type="number"
                  value={settings.returnWindowDays}
                  onChange={(e) => handleChange("returnWindowDays", parseInt(e.target.value, 10) || 0)}
                  className="font-mono font-bold"
                />
                <p className="text-[11px] text-muted-foreground">Days after delivery during which returns are accepted.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Free Shipping Threshold (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    value={settings.freeShippingThreshold}
                    onChange={(e) => handleChange("freeShippingThreshold", parseInt(e.target.value, 10) || 0)}
                    className="pl-8 font-mono font-bold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Orders above this amount get free delivery.</p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold text-foreground">Automatic Stock Reservation</Label>
                <p className="text-[11px] text-muted-foreground">
                  Reserve inventory stock automatically when a retailer places an order.
                </p>
              </div>
              <Switch
                checked={settings.autoReserveStock}
                onCheckedChange={(val) => handleChange("autoReserveStock", val)}
              />
            </div>
          </SectionCard>
        </TabsContent>

        {/* TAB 4: SECURITY & KYC SETTINGS */}
        <TabsContent value="security" className="space-y-6">
          <SectionCard
            title="KYC & Compliance Verification"
            description="Control onboarding verification requirements and auto-approval policies."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">Auto-Approve Wholesaler KYC</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically approve KYC applications without Super Admin manual document review.
                  </p>
                </div>
                <Switch
                  checked={settings.autoApproveKyc}
                  onCheckedChange={(val) => handleChange("autoApproveKyc", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">Mandatory GSTIN Verification</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Require verified GSTIN certificate before allowing wholesalers to publish products.
                  </p>
                </div>
                <Switch
                  checked={settings.mandatoryGstVerification}
                  onCheckedChange={(val) => handleChange("mandatoryGstVerification", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">Allow Retailer Self-Registration</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Allow retailers to sign up publicly without an invite link from a wholesaler.
                  </p>
                </div>
                <Switch
                  checked={settings.allowRetailerSelfRegister}
                  onCheckedChange={(val) => handleChange("allowRetailerSelfRegister", val)}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 mt-6 pt-5 border-t">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Max Failed Login Attempts</Label>
                <Input
                  type="number"
                  value={settings.maxFailedLoginAttempts}
                  onChange={(e) => handleChange("maxFailedLoginAttempts", parseInt(e.target.value, 10) || 5)}
                  className="font-mono font-bold"
                />
                <p className="text-[11px] text-muted-foreground">Lock user account after consecutive incorrect password attempts.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Session Timeout (Minutes)</Label>
                <Input
                  type="number"
                  value={settings.sessionTimeoutMinutes}
                  onChange={(e) => handleChange("sessionTimeoutMinutes", parseInt(e.target.value, 10) || 60)}
                  className="font-mono font-bold"
                />
                <p className="text-[11px] text-muted-foreground">Inactivity duration before requiring re-authentication.</p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* TAB 5: NOTIFICATIONS SETTINGS */}
        <TabsContent value="notifications" className="space-y-6">
          <SectionCard
            title="System Alert Dispatch Controls"
            description="Manage automatic communication channels for SMS, Email, and Push alerts."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">Order SMS & WhatsApp Alerts</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Send instant transactional SMS/WhatsApp notifications to retailers and wholesalers upon order placement.
                  </p>
                </div>
                <Switch
                  checked={settings.enableOrderSmsAlerts}
                  onCheckedChange={(val) => handleChange("enableOrderSmsAlerts", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">Low Stock Inventory Warnings</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Notify wholesalers when product inventory drops below reorder thresholds.
                  </p>
                </div>
                <Switch
                  checked={settings.enableLowStockAlerts}
                  onCheckedChange={(val) => handleChange("enableLowStockAlerts", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">System Email Notifications</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Send invoice PDFs, payout receipts, and status updates via email.
                  </p>
                </div>
                <Switch
                  checked={settings.enableEmailNotifications}
                  onCheckedChange={(val) => handleChange("enableEmailNotifications", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">Weekly Performance Digest</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Send weekly automated analytics digests to Super Admin and active wholesalers.
                  </p>
                </div>
                <Switch
                  checked={settings.enableWeeklyDigest}
                  onCheckedChange={(val) => handleChange("enableWeeklyDigest", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">Help Center Desk Notifications</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Notify Super Admin in real-time when wholesalers submit urgent help desk requests.
                  </p>
                </div>
                <Switch
                  checked={settings.enableHelpCenterPush}
                  onCheckedChange={(val) => handleChange("enableHelpCenterPush", val)}
                />
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
