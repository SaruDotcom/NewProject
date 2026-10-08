const businessRoots = [
  "Sharma",
  "Khandelwal",
  "Mehta",
  "Gupta",
  "Agarwal",
  "Bansal",
  "Kapoor",
  "Jain",
  "Patel",
  "Reddy",
  "Iyer",
  "Malhotra",
  "Choudhary",
  "Verma",
  "Singh",
  "Nair",
  "Yadav",
  "Joshi",
  "Saxena",
  "Deshmukh",
  "Arora",
  "Mishra",
  "Kulkarni",
  "Sethi",
];
const businessKinds = [
  "Distributors",
  "Trading Co.",
  "Enterprises",
  "Wholesale Hub",
  "Supply House",
  "Agencies",
];
const cities = [
  "Delhi",
  "Mumbai",
  "Jaipur",
  "Ahmedabad",
  "Lucknow",
  "Indore",
  "Pune",
  "Surat",
  "Bengaluru",
  "Hyderabad",
  "Chandigarh",
  "Nagpur",
];
const firstNames = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Arjun",
  "Rohan",
  "Karan",
  "Neha",
  "Priya",
  "Ananya",
  "Meera",
  "Rajesh",
  "Sanjay",
];
const lastNames = [
  "Sharma",
  "Gupta",
  "Patel",
  "Jain",
  "Kapoor",
  "Singh",
  "Mehta",
  "Reddy",
];
const categories = [
  "Staples",
  "Beverages",
  "Personal Care",
  "Home Care",
  "Snacks",
  "Dairy",
  "Stationery",
  "Electronics",
];
const productNames = [
  "Premium Basmati Rice",
  "Cold Pressed Mustard Oil",
  "Masala Tea Pack",
  "Bath Soap Multipack",
  "Floor Cleaner",
  "Salted Snack Mix",
  "Full Cream Milk Powder",
  "A4 Copier Paper",
  "LED Bulb Pack",
  "Natural Jaggery",
  "Dishwash Gel",
  "Whole Wheat Flour",
];
function cycle(items, index) {
  const value = items[index % items.length];
  if (value === undefined) throw new Error("Mock data source cannot be empty");
  return value;
}
const money = (value) => `₹${value.toLocaleString("en-IN")}`;
const dateFrom = (days) =>
  new Date(Date.UTC(2026, 8, 14 - days)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export const wholesalers = Array.from({ length: 24 }, (_, i) => ({
  id: `WH-${String(1001 + i)}`,
  business: `${cycle(businessRoots, i)} ${cycle(businessKinds, i)}`,
  owner: `${cycle(firstNames, i)} ${cycle(lastNames, i + 2)}`,
  email: `accounts@${cycle(businessRoots, i).toLowerCase()}${i + 1}.in`,
  phone: `+91 98${String(41000000 + i * 731).slice(-8)}`,
  location: cycle(cities, i),
  gst: `${String(7 + (i % 22)).padStart(2, "0")}ABCDE${String(1200 + i)}F1Z${i % 9}`,
  products: 34 + ((i * 13) % 170),
  retailers: 18 + ((i * 7) % 92),
  orders: 120 + i * 23,
  sales: money(420000 + i * 127500),
  salesValue: 420000 + i * 127500,
  status: cycle(
    [
      "Active",
      "Approved",
      "Pending",
      "Active",
      "Active",
      "Suspended",
      "Rejected",
    ],
    i,
  ),
  registered: dateFrom(i + 2),
}));
export const retailers = Array.from({ length: 56 }, (_, i) => ({
  id: `RT-${String(2001 + i)}`,
  business: `${cycle(businessRoots, i + 5)} ${cycle(["General Store", "Retail Mart", "Kirana", "Super Store", "Bazaar"], i)}`,
  owner: `${cycle(firstNames, i + 3)} ${cycle(lastNames, i)}`,
  email: `owner${i + 1}@retailmail.in`,
  phone: `+91 97${String(51000000 + i * 547).slice(-8)}`,
  location: cycle(cities, i + 3),
  gst: `${String(7 + (i % 22)).padStart(2, "0")}PQRSX${String(2200 + i)}L1Z${i % 9}`,
  connected: 2 + (i % 8),
  orders: 12 + ((i * 5) % 90),
  purchase: money(85000 + i * 28500),
  purchaseValue: 85000 + i * 28500,
  status: cycle(
    ["Active", "Active", "Pending", "Active", "Suspended", "Blocked"],
    i,
  ),
  registered: dateFrom(i % 45),
}));
export const products = Array.from({ length: 108 }, (_, i) => ({
  id: `PRD-${String(3001 + i)}`,
  name: `${cycle(productNames, i)} ${cycle(["1 kg", "500 g", "Pack of 6", "Value Pack"], i)}`,
  sku: `SKU-${cycle(categories, i).slice(0, 3).toUpperCase()}-${4200 + i}`,
  brand: cycle(
    ["Aarambh", "Sampurna", "DailyChoice", "Nirmaan", "PureNest", "UrbanKart"],
    i,
  ),
  category: cycle(categories, i),
  wholesaler: cycle(wholesalers, i).business,
  price: 120 + ((i * 37) % 1800),
  mrp: 160 + ((i * 49) % 2200),
  moq: cycle([6, 12, 24, 48], i),
  stock: (i * 47) % 780,
  status: cycle(
    ["Active", "Approved", "Pending", "Active", "Inactive", "Rejected"],
    i,
  ),
  created: dateFrom(i % 60),
}));
const orderStatuses = [
  "Pending",
  "Processing",
  "Shipped",
  "Delivered",
  "Delivered",
  "Cancelled",
];
export const orders = Array.from({ length: 112 }, (_, i) => {
  const amount = 4200 + ((i * 1739) % 68000);
  return {
    id: `ORD-${String(260901 + i)}`,
    retailer: cycle(retailers, i).business,
    wholesaler: cycle(wholesalers, i * 3).business,
    products: 2 + (i % 9),
    amount,
    amountLabel: money(amount),
    payment: i % 5 === 0 ? "Pending" : i % 7 === 0 ? "Refunded" : "Paid",
    status: cycle(orderStatuses, i),
    date: dateFrom(i % 35),
  };
});
export const transactions = orders.slice(0, 48).map((order, i) => ({
  id: `TXN-${88210 + i}`,
  orderId: order.id,
  retailer: order.retailer,
  wholesaler: order.wholesaler,
  amount: order.amountLabel,
  commission: money(Math.round(order.amount * 0.035)),
  settlement: money(Math.round(order.amount * 0.965)),
  method: cycle(["UPI", "NEFT", "Credit", "Net Banking"], i),
  status: i % 6 === 0 ? "Pending" : "Completed",
  date: order.date,
}));
export const categoryData = categories.map((name, i) => ({
  id: `CAT-${i + 1}`,
  name,
  subcategories: 3 + i,
  products: 96 + i * 43,
  status: i === 6 ? "Inactive" : "Active",
  order: i + 1,
}));
export const relationships = Array.from({ length: 36 }, (_, i) => ({
  id: `REL-${5001 + i}`,
  wholesaler: cycle(wholesalers, i).business,
  retailer: cycle(retailers, i * 5).business,
  location: cycle(retailers, i * 5).location,
  orders: 4 + ((i * 7) % 48),
  value: money(24000 + i * 9500),
  status: cycle(
    ["Connected", "Connected", "Pending", "Rejected", "Suspended"],
    i,
  ),
  since: dateFrom(40 + i),
}));
export const reviews = Array.from({ length: 28 }, (_, i) => ({
  id: `REV-${7001 + i}`,
  product: cycle(products, i).name,
  retailer: cycle(retailers, i).business,
  wholesaler: cycle(wholesalers, i).business,
  rating: 3 + (i % 3),
  review: cycle(
    [
      "Consistent quality and reliable packaging.",
      "Good wholesale value; delivery was on time.",
      "Product matches the listing and sells well.",
    ],
    i,
  ),
  date: dateFrom(i),
  status: cycle(["Approved", "Pending", "Hidden"], i),
}));
export const coupons = Array.from({ length: 12 }, (_, i) => ({
  id: `CPN-${i + 1}`,
  code:
    cycle(["BULK10", "FIRST500", "FESTIVE8", "SHIPFREE"], i) + (i > 3 ? i : ""),
  type: i % 2 ? "Flat" : "Percentage",
  value: i % 2 ? money(500 + i * 100) : `${5 + i}%`,
  minimum: money(5000 + i * 1000),
  maximum: money(1000 + i * 250),
  start: dateFrom(20 - i),
  end: dateFrom(-20 - i),
  usage: `${20 + i * 13} / ${100 + i * 25}`,
  status: i % 4 === 0 ? "Inactive" : "Active",
}));
export const notifications = [
  [
    "New wholesaler registration",
    "Vardhman Supply House submitted business documents.",
    "Wholesalers",
  ],
  [
    "Approval request",
    "12 products are waiting for catalog approval.",
    "Products",
  ],
  [
    "Payment received",
    "Payment of ₹48,620 received for ORD-260914.",
    "Payments",
  ],
  [
    "Low stock alert",
    "8 high-performing products are running low.",
    "Inventory",
  ],
  [
    "New retailer registration",
    "City Centre Mart joined from Pune.",
    "Retailers",
  ],
  [
    "System alert",
    "Settlement reconciliation completed successfully.",
    "System",
  ],
].map((n, i) => ({
  id: i + 1,
  title: n[0],
  message: n[1],
  module: n[2],
  time: `${i + 1}h ago`,
  unread: i < 4,
}));
const adminUserRows = [
  [
    "Arjun Mehta",
    "arjun@vyaparone.in",
    "Super Admin",
    "Active",
    "Today, 09:42",
  ],
  ["Neha Kapoor", "neha@vyaparone.in", "Operations", "Active", "Today, 08:15"],
  ["Rohan Jain", "rohan@vyaparone.in", "Finance", "Active", "Yesterday, 18:22"],
  ["Priya Nair", "priya@vyaparone.in", "Support", "Active", "Yesterday, 16:08"],
  ["Karan Singh", "karan@vyaparone.in", "Admin", "Inactive", "02 Sep, 11:30"],
];
export const adminUsers = adminUserRows.map((u, i) => ({
  id: `ADM-${i + 1}`,
  name: u[0],
  email: u[1],
  role: u[2],
  status: u[3],
  lastLogin: u[4],
}));
export const salesTrend = [
  { month: "Apr", sales: 62, revenue: 12, orders: 38 },
  { month: "May", sales: 74, revenue: 15, orders: 44 },
  { month: "Jun", sales: 68, revenue: 14, orders: 41 },
  { month: "Jul", sales: 89, revenue: 18, orders: 52 },
  { month: "Aug", sales: 96, revenue: 21, orders: 61 },
  { month: "Sep", sales: 112, revenue: 25, orders: 69 },
];
export { categories, money };
