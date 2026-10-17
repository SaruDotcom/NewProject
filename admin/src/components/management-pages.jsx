import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  PackageSearch,
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DataTable,
  KpiCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/admin-ui";
import { apiGet } from "@/lib/api";

const emptyState = (message) => _jsx("div", {
  className: "rounded-lg border border-dashed bg-card p-6 text-sm text-muted-foreground",
  children: message,
});

export function EntityListPage({ type }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialFilter = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("status") || "All"
    : "All";

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const endpoint = type === "wholesalers"
          ? "/users/wholesalers"
          : type === "retailers"
            ? "/users/retailers"
            : type === "products"
              ? "/products"
              : type === "orders"
                ? "/orders"
                : "/relationships";
        const rows = await apiGet(endpoint);
        if (!isMounted) return;
        setData(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!isMounted) return;
        setData([]);
        setError(err.message || "Failed to load records");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [type]);

  const config = useMemo(() => {
    if (type === "wholesalers")
      return {
        title: "Wholesaler Management",
        description: "Review, approve, and manage every supply partner.",
        data,
        filters: ["Pending", "Approved", "Active", "Suspended", "Rejected"],
        search: ["business", "owner", "email", "location"],
        path: (r) => `/wholesalers/${r.id}`,
        columns: [
          { key: "business", label: "Business", sortable: true, render: (r) => _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: r.business || r.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: r.owner || r.email })] }) },
          { key: "email", label: "Contact", render: (r) => _jsxs("div", { children: [_jsx("p", { children: r.email }), _jsx("p", { className: "text-xs text-muted-foreground", children: r.phone })] }) },
          { key: "location", label: "Location", sortable: true },
          { key: "gst", label: "GST" },
          { key: "products", label: "Products", sortable: true },
          { key: "retailers", label: "Retailers" },
          { key: "orders", label: "Orders" },
          { key: "sales", label: "Sales" },
          { key: "status", label: "Status", render: (r) => _jsx(StatusBadge, { status: r.status }) },
          { key: "registered", label: "Registered" },
        ],
      };
    if (type === "retailers")
      return {
        title: "Retailer Management",
        description: "Monitor retailer accounts, purchases, and network access.",
        data,
        filters: ["Pending", "Active", "Suspended", "Blocked"],
        search: ["business", "owner", "email", "location"],
        path: (r) => `/retailers/${r.id}`,
        columns: [
          { key: "business", label: "Business", sortable: true, render: (r) => _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: r.business || r.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: r.owner || r.email })] }) },
          { key: "email", label: "Contact" },
          { key: "location", label: "Location" },
          { key: "gst", label: "GST" },
          { key: "connected", label: "Wholesalers" },
          { key: "orders", label: "Orders" },
          { key: "purchase", label: "Total Purchase" },
          { key: "status", label: "Status", render: (r) => _jsx(StatusBadge, { status: r.status }) },
          { key: "registered", label: "Registered" },
        ],
      };
    if (type === "products")
      return {
        title: "Product Management",
        description: "Control catalog quality, stock visibility, and marketplace listings.",
        data,
        filters: ["Active", "Approved", "Pending", "Inactive", "Rejected"],
        search: ["name", "sku", "brand", "wholesaler"],
        path: (r) => `/products/${r.id}`,
        columns: [
          { key: "name", label: "Product", sortable: true, render: (r) => _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex size-9 items-center justify-center rounded bg-muted", children: _jsx(PackageSearch, { className: "size-4 text-muted-foreground" }) }), _jsxs("div", { children: [_jsx("p", { className: "max-w-52 truncate font-semibold", children: r.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: r.sku })] })] }) },
          { key: "brand", label: "Brand" },
          { key: "category", label: "Category" },
          { key: "wholesaler", label: "Wholesaler" },
          { key: "price", label: "Wholesale", render: (r) => `₹${r.price ?? r.wholesalePrice ?? 0}` },
          { key: "mrp", label: "MRP", render: (r) => `₹${r.mrp ?? 0}` },
          { key: "moq", label: "MOQ" },
          { key: "stock", label: "Stock", sortable: true },
          { key: "status", label: "Status", render: (r) => _jsx(StatusBadge, { status: r.status }) },
          { key: "created", label: "Created" },
        ],
      };
    if (type === "orders")
      return {
        title: "Order Management",
        description: "Track every wholesaler-specific order from placement to delivery.",
        data,
        filters: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Paid"],
        search: ["id", "retailer", "wholesaler"],
        path: (r) => `/orders/${r.id}`,
        columns: [
          { key: "id", label: "Order ID", sortable: true, render: (r) => _jsx("span", { className: "font-semibold text-primary", children: r.id }) },
          { key: "retailer", label: "Retailer" },
          { key: "wholesaler", label: "Wholesaler / Sub-order" },
          { key: "products", label: "Products" },
          { key: "amountLabel", label: "Amount" },
          { key: "payment", label: "Payment", render: (r) => _jsx(StatusBadge, { status: r.payment }) },
          { key: "status", label: "Status", render: (r) => _jsx(StatusBadge, { status: r.status }) },
          { key: "date", label: "Date" },
        ],
      };
    return {
      title: "Wholesaler ↔ Retailer Network",
      description: "Understand and manage every commercial connection on the platform.",
      data,
      filters: ["Connected", "Pending", "Rejected", "Suspended"],
      search: ["wholesaler", "retailer", "location"],
      path: undefined,
      columns: [
        { key: "wholesaler", label: "Wholesaler", render: (r) => _jsx("span", { className: "font-semibold", children: r.wholesaler }) },
        { key: "retailer", label: "Connected Retailer" },
        { key: "location", label: "Location" },
        { key: "orders", label: "Orders" },
        { key: "value", label: "Business Value" },
        { key: "status", label: "Relationship", render: (r) => _jsx(StatusBadge, { status: r.status }) },
        { key: "since", label: "Since / Requested" },
      ],
    };
  }, [data, type]);

  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, { title: config.title, description: config.description }),
      type === "relationships" && _jsxs("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-4", children: [_jsx(KpiCard, { label: "Total Connections", value: String(data.length), change: "Live", icon: Users }), _jsx(KpiCard, { label: "Connected", value: String(data.filter((x) => x.status === "Connected").length), change: "Live", icon: Check, tone: "success" }), _jsx(KpiCard, { label: "Pending Requests", value: String(data.filter((x) => x.status === "Pending").length), change: "Live", icon: ClipboardList, tone: "warning" }), _jsx(KpiCard, { label: "Suspended", value: String(data.filter((x) => x.status === "Suspended").length), change: "Live", icon: ShieldAlert })] }),
      loading ? emptyState("Loading records from the database...") : error ? emptyState(error) : data.length === 0 ? emptyState("No records found for this module.") : _jsx(DataTable, { data: config.data, columns: config.columns, searchKeys: config.search, filters: config.filters, detailPath: config.path, initialFilter }),
    ],
  });
}
export function EntityDetailPage({ type }) {
  const params = useParams({ strict: false });
  const id = String(params["id"] ?? "");
  const entity =
    type === "wholesaler"
      ? wholesalers.find((x) => x.id === id)
      : type === "retailer"
        ? retailers.find((x) => x.id === id)
        : type === "product"
          ? products.find((x) => x.id === id)
          : orders.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(null);
  if (!entity)
    return _jsx("div", {
      className: "admin-card p-10 text-center",
      children: _jsx("p", {
        className: "font-bold",
        children: "Record not found",
      }),
    });
  const name =
    "business" in entity
      ? entity.business
      : "name" in entity
        ? entity.name
        : entity.id;
  const tabs =
    type === "wholesaler"
      ? [
        "Overview",
        "Business Information",
        "Products",
        "Retailers",
        "Orders",
        "Sales",
        "Payments",
        "Reviews",
        "Activity",
      ]
      : type === "retailer"
        ? [
          "Overview",
          "Business Details",
          "Connected Wholesalers",
          "Orders",
          "Purchase History",
          "Payments",
          "Reviews",
          "Activity",
        ]
        : type === "product"
          ? [
            "Overview",
            "Pricing",
            "Inventory",
            "Orders",
            "Reviews",
            "Activity",
          ]
          : ["Overview", "Products", "Payment Details", "Delivery", "Timeline"];
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx("div", {
        children: _jsxs(Button, {
          variant: "ghost",
          onClick: () => history.back(),
          children: [_jsx(ArrowLeft, {}), " Back"],
        }),
      }),
      _jsx("div", {
        className: "admin-card p-5",
        children: _jsxs("div", {
          className:
            "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
          children: [
            _jsxs("div", {
              className: "flex items-center gap-4",
              children: [
                _jsx("span", {
                  className:
                    "flex size-14 items-center justify-center rounded-md bg-accent text-primary",
                  children:
                    type === "wholesaler"
                      ? _jsx(Building2, {})
                      : type === "retailer"
                        ? _jsx(Store, {})
                        : type === "product"
                          ? _jsx(PackageSearch, {})
                          : _jsx(ClipboardList, {}),
                }),
                _jsxs("div", {
                  children: [
                    _jsxs("div", {
                      className: "flex flex-wrap items-center gap-2",
                      children: [
                        _jsx("h1", {
                          className: "text-xl font-bold",
                          children: name,
                        }),
                        _jsx(StatusBadge, {
                          status:
                            "status" in entity
                              ? String(entity.status)
                              : "Active",
                        }),
                      ],
                    }),
                    _jsxs("p", {
                      className: "mt-1 text-sm text-muted-foreground",
                      children: [
                        entity.id,
                        " ",
                        "location" in entity ? `· ${entity.location}` : "",
                      ],
                    }),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              className: "flex flex-wrap gap-2",
              children: [
                _jsxs(Button, {
                  variant: "outline",
                  onClick: () => toast("Edit form opened"),
                  children: [_jsx(Edit3, {}), " Edit"],
                }),
                _jsxs(Button, {
                  variant: "outline",
                  onClick: () => toast("Document viewer opened"),
                  children: [_jsx(Eye, {}), " View Documents"],
                }),
                _jsx(Button, {
                  onClick: () =>
                    setConfirm(type === "order" ? "Update order" : "Approve"),
                  children: type === "order" ? "Update status" : "Approve",
                }),
                _jsx(Button, {
                  variant: "destructive",
                  onClick: () =>
                    setConfirm(type === "retailer" ? "Block" : "Suspend"),
                  children: type === "retailer" ? "Block" : "Suspend",
                }),
              ],
            }),
          ],
        }),
      }),
      _jsxs(Tabs, {
        defaultValue: "Overview",
        children: [
          _jsx(TabsList, {
            className:
              "fine-scrollbar h-auto max-w-full justify-start overflow-x-auto bg-transparent p-0",
            children: tabs.map((tab) =>
              _jsx(
                TabsTrigger,
                {
                  value: tab,
                  className:
                    "rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                  children: tab,
                },
                tab,
              ),
            ),
          }),
          tabs.map((tab) =>
            _jsx(
              TabsContent,
              {
                value: tab,
                className: "mt-5",
                children: _jsx(DetailTab, {
                  title: tab,
                  type: type,
                  entity: entity,
                }),
              },
              tab,
            ),
          ),
        ],
      }),
      _jsx(Dialog, {
        open: Boolean(confirm),
        onOpenChange: (open) => !open && setConfirm(null),
        children: _jsxs(DialogContent, {
          children: [
            _jsxs(DialogHeader, {
              children: [
                _jsxs(DialogTitle, { children: ["Confirm ", confirm] }),
                _jsx(DialogDescription, {
                  children:
                    "This updates the selected record and adds an activity entry.",
                }),
              ],
            }),
            _jsxs(DialogFooter, {
              children: [
                _jsx(Button, {
                  variant: "outline",
                  onClick: () => setConfirm(null),
                  children: "Cancel",
                }),
                _jsx(Button, {
                  variant:
                    confirm === "Suspend" || confirm === "Block"
                      ? "destructive"
                      : "default",
                  onClick: () => {
                    toast.success(`${name} updated successfully`);
                    setConfirm(null);
                  },
                  children: "Confirm action",
                }),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
function DetailTab({ title, type, entity }) {
  const info = Object.entries(entity)
    .filter(([key]) => !["salesValue", "purchaseValue", "amount"].includes(key))
    .slice(0, 10);
  if (title === "Timeline" || title === "Activity")
    return _jsx(SectionCard, {
      title: title,
      children: [
        "Record reviewed by Operations",
        "Details updated",
        "Status changed",
        "Record created",
      ].map((item, i) =>
        _jsxs(
          "div",
          {
            className: "border-l-2 border-primary/25 pb-5 pl-4",
            children: [
              _jsx("p", { className: "text-sm font-semibold", children: item }),
              _jsxs("p", {
                className: "text-xs text-muted-foreground",
                children: [
                  i + 1,
                  " day",
                  i ? "s" : "",
                  " ago \u00B7 Admin User",
                ],
              }),
            ],
          },
          item,
        ),
      ),
    });
  if (title === "Products")
    return _jsx(DataTable, {
      data: products.slice(0, 8),
      columns: [
        { key: "name", label: "Product" },
        { key: "sku", label: "SKU" },
        { key: "price", label: "Price", render: (r) => `₹${r.price}` },
        { key: "stock", label: "Stock" },
        {
          key: "status",
          label: "Status",
          render: (r) => _jsx(StatusBadge, { status: r.status }),
        },
      ],
      searchKeys: ["name"],
      bulk: false,
    });
  if (title === "Orders")
    return _jsx(DataTable, {
      data: orders.slice(0, 8),
      columns: [
        { key: "id", label: "Order" },
        { key: "retailer", label: "Retailer" },
        { key: "amountLabel", label: "Amount" },
        {
          key: "status",
          label: "Status",
          render: (r) => _jsx(StatusBadge, { status: r.status }),
        },
      ],
      searchKeys: ["id"],
      bulk: false,
    });
  if (title === "Reviews")
    return _jsx(DataTable, {
      data: reviews.slice(0, 8),
      columns: [
        { key: "product", label: "Product" },
        { key: "retailer", label: "Retailer" },
        { key: "rating", label: "Rating", render: (r) => `${r.rating} / 5` },
        {
          key: "status",
          label: "Status",
          render: (r) => _jsx(StatusBadge, { status: r.status }),
        },
      ],
      searchKeys: ["product"],
      bulk: false,
    });
  return _jsxs("div", {
    className: "grid gap-5 lg:grid-cols-[1.4fr_1fr]",
    children: [
      _jsx(SectionCard, {
        title: title,
        children: _jsx("dl", {
          className: "grid gap-x-6 gap-y-5 sm:grid-cols-2",
          children: info.map(([key, value]) =>
            _jsxs(
              "div",
              {
                children: [
                  _jsx("dt", {
                    className:
                      "text-xs font-medium capitalize text-muted-foreground",
                    children: key.replace(/([A-Z])/g, " $1"),
                  }),
                  _jsx("dd", {
                    className: "mt-1 text-sm font-semibold",
                    children: String(value),
                  }),
                ],
              },
              key,
            ),
          ),
        }),
      }),
      _jsx(SectionCard, {
        title: type === "order" ? "Order Summary" : "Performance Summary",
        children: _jsxs("div", {
          className: "space-y-4",
          children: [
            _jsx(Summary, {
              icon: CircleDollarSign,
              label: "Business value",
              value:
                type === "order" && "amountLabel" in entity
                  ? String(entity["amountLabel"])
                  : "₹18.42 L",
            }),
            _jsx(Summary, {
              icon: ClipboardList,
              label: "Orders",
              value: String(entity["orders"] ?? 248),
            }),
            _jsx(Summary, {
              icon: Users,
              label: "Connections",
              value: String(entity["retailers"] ?? entity["connected"] ?? 36),
            }),
            _jsxs(Button, {
              className: "w-full",
              onClick: () => toast.success("Report generated"),
              children: [_jsx(Download, {}), " Download report"],
            }),
          ],
        }),
      }),
    ],
  });
}
function Summary({ icon: Icon, label, value }) {
  return _jsxs("div", {
    className: "flex items-center gap-3",
    children: [
      _jsx("span", {
        className: "flex size-9 items-center justify-center rounded bg-muted",
        children: _jsx(Icon, { className: "size-4" }),
      }),
      _jsxs("div", {
        children: [
          _jsx("p", {
            className: "text-xs text-muted-foreground",
            children: label,
          }),
          _jsx("p", { className: "text-sm font-bold", children: value }),
        ],
      }),
    ],
  });
}
export function CategoriesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiGet("/categories").then(res => {
      if (isMounted) {
        setData(Array.isArray(res) ? res : []);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, []);
  return _jsxs("div", {
    className: "space-y-6",
    children: [
      _jsx(PageHeader, {
        title: "Category Management",
        description:
          "Organize the catalog hierarchy, visibility, and display order.",
        action: _jsx(Button, {
          onClick: () => toast("Add category form opened"),
          children: "Add Category",
        }),
      }),
      _jsx(DataTable, {
        data: data,
        columns: [
          { key: "order", label: "Order" },
          {
            key: "name",
            label: "Category",
            render: (r) =>
              _jsxs("div", {
                className: "flex items-center gap-3",
                children: [
                  _jsx("span", {
                    className:
                      "flex size-10 items-center justify-center rounded bg-accent",
                    children: _jsx(PackageSearch, {
                      className: "size-4 text-primary",
                    }),
                  }),
                  _jsx("span", {
                    className: "font-semibold",
                    children: r.name,
                  }),
                ],
              }),
          },
          { key: "subcategories", label: "Subcategories" },
          { key: "products", label: "Products" },
          {
            key: "status",
            label: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.status }),
          },
          {
            key: "id",
            label: "Controls",
            render: (r) =>
              _jsxs("div", {
                className: "flex gap-1",
                children: [
                  _jsx(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () =>
                      setData((d) =>
                        d.map((x) =>
                          x.id === r.id
                            ? { ...x, order: Math.max(1, x.order - 1) }
                            : x,
                        ),
                      ),
                    children: "Move up",
                  }),
                  _jsx(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () => toast("Category editor opened"),
                    children: "Edit",
                  }),
                ],
              }),
          },
        ],
        searchKeys: ["name"],
        filters: ["Active", "Inactive"],
        bulk: false,
      }),
    ],
  });
}
