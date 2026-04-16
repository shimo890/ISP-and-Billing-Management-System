# ISP Billing & Customer Management System

## 1) Project Overview

This project is a full-stack ISP billing platform focused on:

- Bandwidth customers
- Home/SOHO customers
- Entitlements (bill entry)
- Invoice generation and lifecycle
- Payment collection, bulk payment, and fund transfer
- Ledger reporting
- RBAC (roles/permissions/menu)
- Activity and audit logging

Frontend and backend are separated into:

- `frontend/` (React + Vite)
- `backend-api/` (Django + DRF + SQLite)

---

## 2) Architecture

### Frontend

- **Framework**: React (Vite build pipeline)
- **Routing**: `react-router-dom`
- **API client**: Axios (`frontend/src/services/api.js`)
- **Auth flow**: JWT access token in `localStorage` (`Authorization: Bearer <token>`)
- **Styling**: Tailwind/CSS with cyan-indigo-white visual system
- **Core layout**: Sidebar + protected routes in `frontend/src/App.jsx`

### Backend

- **Framework**: Django + Django REST Framework
- **DB**: SQLite3 (`backend-api/db.sqlite3`)
- **Auth**: JWT via `rest_framework_simplejwt`
- **Filtering/Search**: `django-filter` + DRF filters
- **Permission model**: custom RBAC in `apps/authentication`
- **API docs**: Swagger/ReDoc routes in `backend-api/config/urls.py`

---

## 3) Main Backend Apps and Responsibilities

- `apps.authentication`  
  Login, refresh/logout, invitations, role/permission/menu APIs, activity logs, audit logs.

- `apps.users`  
  User profile, user CRUD, password change, field-staff listing.

- `apps.customers`  
  KAM master data and customer master data (+ related customer actions like credit balance endpoints).

- `apps.bills`  
  Entitlements, invoice master/details, dashboard analytics, KAM onboarding/churn growth analytics, ledger reports.

- `apps.payment`  
  Payment master/details, customer due invoices, by-customer views, bulk payment flows.

- `apps.package`  
  Package master and package pricing.

- `apps.utility`  
  Utility information and detail master endpoints.

---

## 4) Core Business Flow (How It Works)

### Step A: Setup master data

1. Create users/roles/permissions (RBAC).
2. Create KAM records (`customers/kam-management`).
3. Create package records (`packages/`).
4. Create customers (`customers/`) and assign customer type (`bw` or `soho`) and KAM.

### Step B: Entitlement/Bill Entry

1. Open Entitlements module.
2. Select customer and package details.
3. Save entitlement master/details.
4. Entitlement records are used as invoice source.

### Step C: Invoice lifecycle

1. Create invoice manually or with entitlement context.
2. Add details / recalculate / apply discount.
3. Use history and billing period endpoints for review.
4. Optionally send invoice email.

### Step D: Payment lifecycle

1. Create payment against invoices/customer.
2. Use `customer-due-invoices` for pending dues.
3. Apply bulk pay (FIFO/selected allocation depending frontend flow).
4. Payment updates invoice due state and customer balances.

### Step E: Reporting

1. Dashboard analytics (`bills/analytics/dashboard/`)
2. KAM onboarding/churn growth (`bills/analytics/kam/growth-churn/`)
3. Ledger:
   - Customer ledger
   - All customer ledger summary

---

## 5) Key Frontend Modules

- Dashboard
- KAM (Create/List + onboarding/churn growth report)
- Entitlements (bill entry)
- Invoice (Create/List/View/Edit)
- Received/Payments (Create/List/Fund Transfer/Credit Balance)
- Customers
- Packages
- Ledger
- User/Role/Activity/Audit admin modules

---

## 6) Security and Access Control

- JWT auth for API calls.
- Route-level guards in frontend (`ProtectedRoute` / `AdminRoute`).
- Backend permission checks via:
  - `IsAuthenticated`
  - custom `RequirePermissions`
- Role-permission-menu mapping is seeded via backend management command (`seed_rbac`).

---

## 7) Important Runtime URLs

- Django admin: `/admin/`
- Swagger UI: `/api/docs/`
- ReDoc: `/api/redoc/`
- OpenAPI JSON: `/api/swagger.json`

---

## 8) Local Run Guide

### Backend

From `backend-api/`:

1. Create and activate virtualenv
2. Install requirements
3. Run migrations
4. Start server

Typical commands:

- `python -m venv .venv`
- `source .venv/bin/activate`
- `pip install -r requirements.txt`
- `python manage.py migrate`
- `python manage.py runserver 0.0.0.0:8000`

### Frontend

From `frontend/`:

- `npm install`
- `npm run dev`

For production build:

- `npm run build`

---

## 9) Data Model Highlights

- Customer types are intentionally restricted to:
  - `bw`
  - `soho`
- KAM master is a separate model used for assignment and analytics filters.
- Billing entities include:
  - entitlement master/details
  - invoice master/details
  - payment master/details

---

## 10) Error Handling Notes

- API interceptor (`frontend/src/services/api.js`) normalizes backend error payloads.
- KAM growth/churn custom-period report requires both:
  - `from_date`
  - `to_date`
- Date format must be `YYYY-MM-DD`.

---

## 11) Maintenance and Extensibility

- Keep API contract stable and version if breaking changes are introduced.
- Update RBAC seed whenever modules/endpoints are added or removed.
- Keep customer type constraints consistent across:
  - model choices
  - serializers
  - frontend selectors
  - reports/filters

---

## 12) Deliverables in this Repository

- Full project documentation: `PROJECT_FULL_DOCUMENTATION.md`
- API documentation: `API_DOCUMENTATION.md`
- Postman collection: `ISP_Billing_API.postman_collection.json`

