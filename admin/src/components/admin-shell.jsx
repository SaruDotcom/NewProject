import {
  jsx as _jsx,
  Fragment as _Fragment,
  jsxs as _jsxs,
} from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BadgePercent,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileCheck2,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  clearAdminSession,
  getAdminUser,
  isAdminAuthenticated,
} from "@/lib/auth";
import { apiGet, apiPatch } from "@/lib/api";

const notifications = [];

const nav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Wholesalers", href: "/wholesalers", icon: Building2 },
  { label: "KYC Review", href: "/kyc", icon: FileCheck2 },
  { label: "Retailers", href: "/retailers", icon: Store },
  { label: "Relationships", href: "/relationships", icon: Waypoints },
  { label: "Products", href: "/products", icon: PackageSearch },
  { label: "Categories", href: "/categories", icon: Boxes },
  { label: "Orders", href: "/orders", icon: ClipboardList },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Transactions", href: "/transactions", icon: CircleDollarSign },
  { label: "Reports & Analytics", href: "/reports", icon: FileBarChart },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Reviews", href: "/reviews", icon: MessageSquareText },
  { label: "Coupons / Offers", href: "/coupons", icon: Tags },
  { label: "Content Management", href: "/content", icon: Zap },
  { label: "Activity Log", href: "/activity", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];
export function AdminShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [adminUser, setAdminUser] = useState(() => getAdminUser());
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = nav.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );

  const [pendingKycCount, setPendingKycCount] = useState(0);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }

    setAdminUser(getAdminUser());

    let mounted = true;

    const fetchPendingKyc = () => {
      apiGet("/admin/kyc?status=PENDING")
        .then((payload) => {
          if (!mounted) return;
          const items = Array.isArray(payload)
            ? payload
            : payload?.applications || payload?.items || [];
          setPendingKycCount(items.length);
        })
        .catch(() => {});
    };

    const fetchAdminNotifications = () => {
      apiGet("/admin/notifications?limit=8")
        .then((payload) => {
          if (!mounted) return;
          const items = payload?.items || [];
          setAdminNotifications(items);
          const count = payload?.pagination?.unreadCount ?? items.filter((n) => n.unread || !n.isRead).length;
          setUnreadNotificationsCount(count);
        })
        .catch(() => {});
    };

    fetchPendingKyc();
    fetchAdminNotifications();

    const interval = setInterval(fetchAdminNotifications, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [navigate]);

  const markNotificationRead = (id) => {
    apiPatch(`/admin/notifications/${id}/read`, {})
      .then(() => {
        setAdminNotifications((prev) =>
          prev.map((n) => (n.id === id || n._id === id ? { ...n, unread: false, isRead: true } : n))
        );
        setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
      })
      .catch(() => {});
  };

  const markAllNotificationsRead = () => {
    apiPatch("/admin/notifications/read-all", {})
      .then(() => {
        setAdminNotifications((prev) => prev.map((n) => ({ ...n, unread: false, isRead: true })));
        setUnreadNotificationsCount(0);
        toast.success("All notifications marked as read");
      })
      .catch(() => {});
  };

  const logout = () => {
    clearAdminSession();
    navigate({ to: "/login" });
  };

  if (!isAdminAuthenticated()) {
    return null;
  }

  const adminName = adminUser?.name || "Admin";
  const adminEmail = adminUser?.email || "admin";
  const initials =
    adminName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AD";

  return _jsxs("div", {
    className: "min-h-screen bg-background text-foreground",
    children: [
      _jsxs("aside", {
        className: cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r bg-card transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-[68px]" : "w-[248px]",
        ),
        children: [
          _jsx(Brand, { compact: collapsed }),
          _jsx(NavList, { compact: collapsed, pathname: pathname, pendingKycCount }),
          _jsx("div", {
            className: "border-t p-3",
            children: _jsx(Button, {
              variant: "ghost",
              size: collapsed ? "icon" : "default",
              className: cn("w-full", !collapsed && "justify-start"),
              onClick: () => setCollapsed(!collapsed),
              children: collapsed
                ? _jsx(PanelLeftOpen, {})
                : _jsxs(_Fragment, {
                    children: [
                      _jsx(PanelLeftClose, {}),
                      _jsx("span", { children: "Collapse sidebar" }),
                    ],
                  }),
            }),
          }),
        ],
      }),
      mobile &&
        _jsx("div", {
          className: "fixed inset-0 z-50 bg-foreground/30 lg:hidden",
          onClick: () => setMobile(false),
          children: _jsxs("aside", {
            className: "h-full w-[280px] bg-card shadow-xl",
            onClick: (e) => e.stopPropagation(),
            children: [
              _jsxs("div", {
                className: "flex items-center justify-between",
                children: [
                  _jsx(Brand, {}),
                  _jsx(Button, {
                    variant: "ghost",
                    size: "icon",
                    onClick: () => setMobile(false),
                    children: _jsx(X, {}),
                  }),
                ],
              }),
              _jsx(NavList, {
                pathname: pathname,
                close: () => setMobile(false),
                pendingKycCount: pendingKycCount,
              }),
            ],
          }),
        }),
      _jsxs("div", {
        className: cn(
          "transition-[padding] duration-200",
          collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]",
        ),
        children: [
          _jsxs("header", {
            className:
              "sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6",
            children: [
              _jsx(Button, {
                variant: "ghost",
                size: "icon",
                className: "lg:hidden",
                onClick: () => setMobile(true),
                children: _jsx(Menu, {}),
              }),
              _jsxs("div", {
                className: "hidden min-w-40 sm:block",
                children: [
                  _jsx("p", {
                    className: "text-xs text-muted-foreground",
                    children: "Super Admin",
                  }),
                  _jsx("p", {
                    className: "text-sm font-bold",
                    children: current?.label ?? "Marketplace",
                  }),
                ],
              }),
              _jsxs("div", {
                className: "relative mx-auto w-full max-w-xl",
                children: [
                  _jsx(Search, {
                    className:
                      "absolute left-3 top-2.5 size-4 text-muted-foreground",
                  }),
                  _jsx(Input, {
                    placeholder: "Search orders, businesses, products...",
                    className: "bg-muted/50 pl-9 shadow-none",
                    onKeyDown: (e) => {
                      if (e.key === "Enter")
                        toast.success("Search complete", {
                          description: `Showing matches for “${e.currentTarget.value}”`,
                        });
                    },
                  }),
                ],
              }),
              _jsxs(DropdownMenu, {
                children: [
                  _jsx(DropdownMenuTrigger, {
                    asChild: true,
                    children: _jsxs(Button, {
                      variant: "ghost",
                      size: "icon",
                      className: "relative",
                      children: [
                        _jsx(Bell, {}),
                        unreadNotificationsCount > 0 &&
                          _jsx("span", {
                            className:
                              "absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-extrabold text-destructive-foreground animate-pulse",
                            children: unreadNotificationsCount,
                          }),
                      ],
                    }),
                  }),
                  _jsxs(DropdownMenuContent, {
                    align: "end",
                    className: "w-96 max-h-[85vh] overflow-y-auto p-0",
                    children: [
                      _jsxs("div", {
                        className: "flex items-center justify-between p-3 border-b bg-muted/40",
                        children: [
                          _jsx(DropdownMenuLabel, { className: "p-0 text-sm font-bold", children: "Super Admin Notifications" }),
                          unreadNotificationsCount > 0 &&
                            _jsx(Button, {
                              variant: "ghost",
                              size: "sm",
                              className: "h-7 text-xs text-primary font-bold hover:bg-transparent",
                              onClick: markAllNotificationsRead,
                              children: "Mark all read",
                            }),
                        ],
                      }),
                      adminNotifications.length === 0
                        ? _jsx("div", { className: "p-6 text-center text-xs text-muted-foreground", children: "No recent notifications" })
                        : _jsx("div", {
                            className: "divide-y text-xs",
                            children: adminNotifications.slice(0, 6).map((n) => {
                              const isUnread = n.unread || !n.isRead;
                              const wholesaler = n.wholesalerName || n.data?.wholesalerName;
                              return _jsxs(
                                DropdownMenuItem,
                                {
                                  className: cn("flex flex-col items-start gap-1 p-3 cursor-pointer transition-colors", isUnread ? "bg-accent/40 font-medium" : "opacity-80"),
                                  onClick: () => markNotificationRead(n.id || n._id),
                                  children: [
                                    _jsxs("div", {
                                      className: "flex w-full items-center justify-between gap-2",
                                      children: [
                                        _jsxs("span", {
                                          className: "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase bg-primary/10 text-primary",
                                          children: [n.module || "SYSTEM"],
                                        }),
                                        _jsx("span", {
                                          className: "text-[10px] text-muted-foreground font-mono",
                                          children: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
                                        }),
                                      ],
                                    }),
                                    wholesaler && (
                                      _jsxs("div", {
                                        className: "mt-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900",
                                        children: ["Wholesaler: ", wholesaler],
                                      })
                                    ),
                                    _jsx("p", { className: "text-xs font-semibold leading-snug text-foreground", children: n.title }),
                                    _jsx("p", { className: "text-[11px] text-muted-foreground leading-tight line-clamp-2", children: n.message }),
                                  ],
                                },
                                n.id || n._id
                              );
                            }),
                          }),
                      _jsx(DropdownMenuSeparator, {}),
                      _jsx("div", {
                        className: "p-2 text-center bg-muted/20",
                        children: _jsx(Link, {
                          to: "/notifications",
                          className: "text-xs font-bold text-primary hover:underline",
                          children: "View All Notifications →",
                        }),
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs(DropdownMenu, {
                children: [
                  _jsx(DropdownMenuTrigger, {
                    asChild: true,
                    children: _jsxs(Button, {
                      variant: "ghost",
                      className: "hidden h-10 gap-2 px-2 sm:flex",
                      children: [
                        _jsx("span", {
                          className:
                            "flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground",
                          children: initials,
                        }),
                        _jsxs("span", {
                          className: "hidden text-left xl:block",
                          children: [
                            _jsx("span", {
                              className: "block text-xs font-bold",
                              children: adminName,
                            }),
                            _jsx("span", {
                              className:
                                "block text-[10px] text-muted-foreground",
                              children: adminEmail,
                            }),
                          ],
                        }),
                        _jsx(ChevronDown, { className: "size-3" }),
                      ],
                    }),
                  }),
                  _jsxs(DropdownMenuContent, {
                    align: "end",
                    children: [
                      _jsx(DropdownMenuLabel, { children: "My account" }),
                      _jsx(DropdownMenuSeparator, {}),
                      _jsx(DropdownMenuItem, { children: adminEmail }),
                      _jsx(DropdownMenuItem, {
                        onClick: logout,
                        children: "Sign out",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          _jsx("main", {
            className: "mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-7",
            children: children,
          }),
        ],
      }),
    ],
  });
}
function Brand({ compact = false }) {
  return _jsxs("div", {
    className: cn(
      "flex h-16 items-center gap-3 border-b px-4",
      compact && "justify-center px-2",
    ),
    children: [
      _jsx("div", {
        className:
          "flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground",
        children: "V",
      }),
      !compact &&
        _jsxs("div", {
          children: [
            _jsx("p", {
              className: "text-sm font-extrabold",
              children: "VyaparOne",
            }),
            _jsx("p", {
              className:
                "text-[10px] font-semibold uppercase text-muted-foreground",
              children: "Marketplace Control",
            }),
          ],
        }),
    ],
  });
}
function NavList({ compact = false, pathname, close, pendingKycCount = 0 }) {
  return _jsx("nav", {
    className: "fine-scrollbar flex-1 overflow-y-auto p-2",
    children: nav.map((item) => {
      const active =
        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      return _jsxs(
        Link,
        {
          to: item.href,
          onClick: close,
          title: compact ? item.label : undefined,
          className: cn(
            "mb-0.5 flex h-9 items-center justify-between rounded-md px-3 text-xs font-semibold transition-colors",
            active
              ? "bg-accent text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            compact && "justify-center px-0",
          ),
          children: [
            _jsxs("div", {
              className: "flex items-center gap-3",
              children: [
                _jsx(item.icon, { className: "size-4 shrink-0" }),
                !compact && _jsx("span", { children: item.label }),
              ],
            }),
            !compact && item.href === "/kyc" && pendingKycCount > 0 && (
              _jsx("span", {
                className: "flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-extrabold text-destructive-foreground animate-pulse",
                children: pendingKycCount,
              })
            ),
          ],
        },
        item.href,
      );
    }),
  });
}
