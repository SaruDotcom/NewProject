# NEXORA — Production-Grade B2B Wholesale Platform Backend

A modular, secure, scalable, and tested Multi-Tenant B2B Wholesale Marketplace & Super Admin Backend built with Node.js, Express, MongoDB, and Mongoose.

---

## 🏛️ Business Architecture & Core Multi-Tenant Rules

1. **Three-Tier Role Hierarchy**:
   - `SUPER_ADMIN`: Global moderation, KYC verifications, category & product moderation, orders oversight, earnings, payout approvals/processing, platform settings, immutable audit logs.
   - `WHOLESALER`: Multi-tier product catalog creation, stock inventory management, retailer invitation link generation (`/join/<token>`), order fulfillment, wallet balance tracking, payout requests.
   - `RETAILER`: Single-wholesaler exclusive storefront connection, catalog browsing with authoritative price deduction, order placement with atomic stock reservation, order tracking.

2. **CRITICAL BUSINESS RULE (Enforced at Database & Transaction Level)**:
   - **One wholesaler can have MANY retailers.**
   - **One retailer can have ONLY ONE ACTIVE wholesaler relationship.**
   - Enforced by a **compound partial unique index** in MongoDB on `{ retailerId: 1 }` with `{ status: "ACTIVE" }` and ACID database transactions.

3. **Wholesaler KYC Lifecycle**:
   - `DRAFT` ➔ `SUBMITTED` ➔ `UNDER_REVIEW` ➔ `APPROVED` / `REJECTED` / `RESUBMISSION_REQUIRED` / `SUSPENDED`.
   - Wholesalers cannot publish products, generate invitation links, receive business orders, or request payouts until KYC is **APPROVED** by Super Admin.
   - Sensitive KYC documents are stored privately and streamed only upon verified authorization.

4. **Financial Ledger & Wallet Accounting**:
   - Double-entry immutable ledger tracking (`CREDIT`, `DEBIT`, `COMMISSION`, `REFUND`, `PAYOUT`, `ADJUSTMENT`).
   - Strict fund locking during payout review and atomic release/settlement.

---

## 📁 Project Structure

```
Backend/
├── src/
│   ├── config/              # Environment, DB, Logger, Constants, CORS
│   ├── middleware/          # JWT Authenticate, RBAC Authorize, Joi Validate, RateLimiter, Upload, Idempotency, ErrorHandler
│   ├── models/              # Professional Mongoose Schemas with compound partial indexes
│   ├── modules/
│   │   ├── auth/            # Auth controller, service, routes, validation
│   │   ├── admins/          # Dashboard aggregate metrics, Analytics, Settings
│   │   ├── wholesalers/     # Admin Wholesaler management + Wholesaler Portal
│   │   ├── retailers/       # Admin Retailer management + Retailer Portal
│   │   ├── kyc/             # KYC submission, review lifecycle & secure document streaming
│   │   ├── invitations/     # Invitation token generator, validation, atomic acceptance
│   │   ├── categories/      # Hierarchical category tree with safe-deletion checks
│   │   ├── products/        # Product catalog, multi-tier pricing, SKU uniqueness
│   │   ├── inventory/       # Stock tracking & inventory transaction audit
│   │   ├── orders/          # Server authoritative pricing & stock reservation
│   │   ├── payments/        # Payment tracking & idempotent transactions
│   │   ├── wallets/         # Balances & double-entry ledger inspection
│   │   ├── earnings/        # Platform commission & wholesaler earnings
│   │   ├── payouts/         # Payout request, review, approval & processing
│   │   ├── notifications/   # In-app notifications & mark-read
│   │   ├── audit/           # Immutable administrative audit logging
│   │   └── reports/         # CSV / JSON report exports (sales, payouts, etc.)
│   ├── services/            # StorageService, AuditService, NotificationService, WalletService, ReportService
│   ├── utils/               # ApiResponse, AsyncHandler, Custom Errors, Pagination, Crypto helpers
│   ├── routes/              # Master router aggregator (/api/v1 & /api)
│   ├── app.js               # Express application configuration
│   └── server.js            # Server entrypoint with graceful shutdown
├── scripts/
│   ├── createSuperAdmin.js  # CLI tool to create initial Super Admin
│   ├── seedDevelopmentData.js # Seeds categories, sample wholesalers, products & retailers
│   └── seed-demo.js         # Idempotent, demo-only marketplace seed
├── tests/                   # Automated Jest / Supertest integration test suite
├── .env.example
├── package.json
└── README.md
```

---

## ⚙️ Environment Variables

Create `.env` based on `.env.example`:

```env
PORT=5001
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/b2b_wholesale_platform
TEST_MONGO_URI=mongodb://localhost:27017/b2b_wholesale_test

# Authentication
JWT_ACCESS_SECRET=your_super_secret_access_jwt_key_at_least_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_at_least_32_chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# CORS
CLIENT_URL=http://localhost:3000,http://localhost:5173,http://localhost:3001
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd Backend
npm install
```

### 2. Seed Initial Development Data
```bash
npm run seed
```

### 3. Seed Client-Demo Data
```bash
npm run seed:demo
npm run seed:demo:reset
npm run seed:demo:clear
```

These commands create, reset, or clear records tagged `isDemo: true`; they never delete untagged records or create/change the configured Super Admin. The script prints the target database before writing and refuses to run with `NODE_ENV=production` unless `--confirm` is passed (for example, `npm run seed:demo -- --confirm`). Set `DEMO_PASSWORD` to override the shared demo password (default: `Demo@12345`). The generated `scripts/demo-credentials.md` file is git-ignored.

Product and wholesaler images use public HTTPS URLs. KYC statuses are seeded, but private KYC document files are not: the existing document endpoint streams from local private storage, so fabricating file references would produce broken downloads.

### 4. Create Initial Super Admin via CLI
```bash
npm run create:superadmin
```

### 5. Start Development Server
```bash
npm run dev
```

### 6. Run Automated Tests & Coverage
```bash
npm test
npm run test:coverage
```

---

## 📑 Core API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /login`: Authenticate user & issue token pair
- `POST /register`: Register Wholesaler / Retailer
- `POST /refresh`: Refresh token rotation
- `POST /logout`: Invalidate session
- `GET /me`: Authenticated user profile

### Super Admin (`/api/v1/admin`)
- `GET /admin/dashboard`: Real-time aggregated metrics across date ranges (`today`, `7d`, `30d`, `90d`, `year`, `custom`)
- `GET /admin/analytics`: AOV, top wholesalers, revenue trends
- `GET/PUT /admin/settings`: Platform commission & KYC settings
- `GET/PATCH/DELETE /admin/wholesalers`: Wholesaler 360 profile, status changes, soft-delete
- `GET/PATCH/DELETE /admin/retailers`: Retailer management & connection history
- `GET/PATCH /admin/kyc`: List, approve, reject, or request resubmission on KYC
- `GET/POST/PATCH/DELETE /admin/categories`: Category management with dependency safety
- `GET/PATCH/DELETE /admin/products`: Global product moderation
- `GET/PATCH /admin/orders`: Platform orders oversight
- `GET /admin/earnings`: Platform commission summary
- `GET/PATCH /admin/payouts`: Wholesaler payout review, approval, rejection, and settlement
- `GET /admin/audit-logs`: Immutable administrative audit logs
- `GET /admin/reports/:type`: Export CSV/JSON reports (`sales`, `wholesalers`, `retailers`, `payouts`)

### Wholesaler Portal (`/api/v1/wholesaler`)
- `POST /wholesaler/kyc`: Submit KYC profile & documents
- `POST /wholesaler/invite-links`: Generate retailer invitation link (`/join/<token>`)
- `GET /wholesaler/retailers`: List connected retailers
- `GET/POST/PUT/DELETE /wholesaler/products`: Manage product catalog & tiers
- `POST /wholesaler/payouts/wholesaler/request`: Request payout from available wallet balance

### Retailer Portal (`/api/v1/retailer` & `/api/v1/invitations`)
- `GET /invitations/:token`: Validate invitation token
- `POST /invitations/:token/accept`: Accept invitation (Enforces 1:1 active connection rule)
- `GET /retailer/connections`: Active connected wholesaler details
- `GET /retailer/products`: Products from connected wholesaler
- `POST /orders`: Place order with authoritative price calculation & stock reservation
- `GET /orders`: Track order history
