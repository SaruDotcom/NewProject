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
│   ├── seedDevelopmentData.js # Initializes platform settings only
│   └── cleanup-demo-data.js # Explicitly removes records marked isDemo=true
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

# Retailer identity documents and PAN/Aadhaar encryption
RETAILER_IDENTITY_ENCRYPTION_KEY=<64-hex-character AES-256-GCM key>

# Wholesaler subscriptions (use Razorpay test-mode credentials in development)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Wallet earnings settle seven days after delivery by default
WALLET_SETTLEMENT_DAYS=7
```

Generate the encryption key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it as a secret in `Backend/.env`. Keep the same key available for decryption; changing it requires re-encrypting saved retailer identity numbers.

The Super Admin-managed wholesaler plan catalog is initialized with Monthly Plan (₹300/month), Annual Pro Plan (₹3,000/year), and the existing Wholesaler Plan (₹499/month). Super Admins can add, edit, deactivate, reorder, and delete plans and features. Plan and price details are snapshotted when an order is created, so catalog changes do not alter an existing subscription. Razorpay credentials are required to create and verify subscription payments; without them, the wholesaler portal displays “Online payment is not configured”.

### Retailer UPI payments and credit

Retailer order checkout no longer creates or verifies gateway payments. Orders can use `UPI`, `COD`, or `CREDIT`; a UPI order remains unpaid until its connected wholesaler confirms a payment report. Razorpay remains in use for wholesaler subscriptions only.

- Wholesalers configure UPI and private QR details with `GET/PATCH /api/v1/wholesaler/payment-settings`.
- Retailers fetch the connected wholesaler’s options from `GET /api/v1/retailer/payment-options`.
- Retailers fetch a fresh, authenticated QR display session from `POST /api/v1/retailer/payment-options/qr-session`; the QR is loaded after order placement and can be requested again after the display timer expires.
- Retailers report direct UPI order payments or credit installments at `POST /api/v1/retailer/payments/reports`; wholesalers list and review those reports at `GET /api/v1/wholesaler/payment-reports` and `PATCH /api/v1/wholesaler/payment-reports/:reportId`.
- Payment evidence is served only by authenticated report screenshot routes and each access is audited. QR and evidence images are stored outside the static product-upload directory.
- Super Admins can review all reports at `GET /api/v1/admin/payment-reports` and access evidence through the corresponding authenticated screenshot route.
- Retailers may request credit at `POST /api/v1/retailer/credit-request`. Wholesalers approve, reject, enable, or disable per-retailer access and configure limits/terms at `PATCH /api/v1/wholesaler/retailers/:retailerId/credit-policy`.
- Credit orders use an atomic paise-denominated outstanding/limit check. Credit repayments are separate payment reports and change outstanding balances only after wholesaler confirmation.
- QR display duration defaults to 10 minutes and is configurable from 1–60 minutes. Expiry affects only the in-app display session; it does not invalidate the underlying UPI QR.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd Backend
npm install
```

### 2. Initialize Platform Settings
```bash
npm run seed
```

This initializes platform settings only. It does not create sample users, categories, products, inventory, or orders.

### 3. Remove Explicitly Tagged Demo Records
```bash
npm run clean:demo -- --confirm
```

This command requires an explicit confirmation and deletes only records with `isDemo: true`; it does not delete untagged wholesaler or retailer records. Production runs additionally require `--confirm-production`.

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
