# API Documentation (ISP Billing & Customer Management)

Base URL (local):

- `http://127.0.0.1:8000/api`

Auth:

- JWT Bearer token
- Header: `Authorization: Bearer <access_token>`

Docs:

- Swagger: `http://127.0.0.1:8000/api/docs/`
- ReDoc: `http://127.0.0.1:8000/api/redoc/`
- OpenAPI JSON: `http://127.0.0.1:8000/api/swagger.json`

---

## 1) Authentication (`/auth`)

### POST `/auth/login/`

Authenticate user and receive JWT token pair.

Body:

```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

### POST `/auth/refresh/`

Refresh access token.

Body:

```json
{
  "refresh": "refresh_token_here"
}
```

### POST `/auth/logout/`

Invalidate token/session (depending backend config).

### POST `/auth/register/`

Create user (admin/controlled environments).

### POST `/auth/forgot-password/`

Body:

```json
{ "email": "user@example.com" }
```

### POST `/auth/reset-password/`

Body:

```json
{
  "token": "reset-token",
  "new_password": "newpass123",
  "confirm_password": "newpass123"
}
```

### Roles/Permissions/Menu

- `GET /auth/roles/`
- `POST /auth/roles/`
- `GET /auth/roles/{id}/`
- `PUT/PATCH/DELETE /auth/roles/{id}/`
- `GET /auth/permissions/`
- `GET /auth/role-choices/`
- `POST /auth/assign-role/{user_id}/`
- `GET /auth/menu/`

### Invitations

- `POST /auth/invite/`
- `POST /auth/invite/validate/`
- `POST /auth/invite/accept/`

### Activity / Audit Logs

- `GET /auth/activity-logs/`
- `GET /auth/activity-logs/my_activity/`
- `GET /auth/activity-logs/stats/`
- `GET /auth/audit-logs/`
- `GET /auth/audit-logs/by_record/`
- `GET /auth/audit-logs/stats/`

---

## 2) Users (`/users`)

- `GET /users/me/`
- `POST /users/change-password/`
- `GET /users/field-staff/`
- `GET /users/` (list, with pagination/filters)
- `POST /users/`
- `GET /users/{id}/`
- `PUT/PATCH /users/{id}/`
- `DELETE /users/{id}/`

---

## 3) Customers + KAM (`/customers`)

### KAM Read APIs

- `GET /customers/kam/`
- `GET /customers/kam/{id}/`

### KAM Management (CRUD)

- `GET /customers/kam-management/`
- `POST /customers/kam-management/`
- `GET /customers/kam-management/{id}/`
- `PUT/PATCH /customers/kam-management/{id}/`
- `DELETE /customers/kam-management/{id}/`

### Customer Master

- `GET /customers/`
- `POST /customers/`
- `GET /customers/{id}/`
- `PUT/PATCH /customers/{id}/`
- `DELETE /customers/{id}/`

Common query params:

- `search`
- `customer_type` (`bw` or `soho`)
- `status`
- `kam_id`
- `limit`
- `offset`
- `minimal=1` (lightweight list mode)

Customer actions:

- `GET /customers/{id}/entitlements/`
- `GET /customers/{id}/credit-balance/`
- `GET /customers/{id}/payments-with-credit/`
- `GET /customers/{id}/cumulative-balance/`
- `GET /customers/{id}/invoices/`
- `GET /customers/{id}/payments/`
- `GET /customers/{id}/payment_history/`
- `GET /customers/{id}/bill_history/`
- `GET /customers/{id}/last_bill/`
- `GET /customers/{id}/previous_bill/`
- `GET /customers/credit-balances/`
- `GET /customers/export/`
- `POST /customers/import_customers/` (multipart upload)
- `GET /customers/export_template/`

---

## 4) Bills, Entitlements, Invoices, Reports (`/bills`)

### Invoice Master

- `GET /bills/invoices/`
- `POST /bills/invoices/`
- `GET /bills/invoices/{id}/`
- `PUT/PATCH /bills/invoices/{id}/`
- `DELETE /bills/invoices/{id}/`

Invoice custom actions:

- `POST /bills/invoices/auto-generate/`
- `POST /bills/invoices/preview/`
- `POST /bills/invoices/{id}/add-details/`
- `POST /bills/invoices/{id}/recalculate/`
- `POST /bills/invoices/{id}/apply-discount/`
- `POST /bills/invoices/{id}/send-email/`
- `GET /bills/invoices/history/`
- `GET /bills/invoices/billing_period_history/`

### Invoice Details

- `GET /bills/invoice-details/`
- `POST /bills/invoice-details/`
- `GET /bills/invoice-details/{id}/`
- `PUT/PATCH /bills/invoice-details/{id}/`
- `DELETE /bills/invoice-details/{id}/`

### Entitlement Master/Details

- `GET /bills/entitlements/`
- `POST /bills/entitlements/`
- `GET /bills/entitlements/{id}/`
- `PUT/PATCH /bills/entitlements/{id}/`
- `DELETE /bills/entitlements/{id}/`
- `GET/POST /bills/entitlements/{id}/details/`

- `GET /bills/entitlement-details/`
- `POST /bills/entitlement-details/`
- `GET /bills/entitlement-details/{id}/`
- `PUT/PATCH /bills/entitlement-details/{id}/`
- `DELETE /bills/entitlement-details/{id}/`
- `GET /bills/entitlement-details/bandwidth_types/`
- `GET /bills/entitlement-details/history/`
- `GET /bills/entitlement-details/package_change_history/`

### Additional bill endpoints

- `POST /bills/add/entitlements/details/`
- `GET /bills/analytics/dashboard/`
- `GET /bills/analytics/kam/growth-churn/`
- `GET /bills/ledger/customer/{customer_id}/`
- `GET /bills/ledger/summary/`

KAM growth/churn query example:

`/bills/analytics/kam/growth-churn/?kam_id=1&period=monthly`

For custom:

`/bills/analytics/kam/growth-churn/?kam_id=1&period=custom&from_date=2026-01-01&to_date=2026-01-31`

---

## 5) Payments (`/payments`)

### Payment Master

- `GET /payments/`
- `POST /payments/`
- `GET /payments/{id}/`
- `PUT/PATCH /payments/{id}/`
- `DELETE /payments/{id}/`

Custom:

- `GET /payments/history/`
- `GET /payments/customer-due-invoices/?customer_id={id}`
- `GET /payments/by_customer/?customer_id={id}`
- `POST /payments/bulk-pay/`

### Payment Details

- `GET /payments/payment-details/`
- `POST /payments/payment-details/`
- `GET /payments/payment-details/{id}/`
- `PUT/PATCH /payments/payment-details/{id}/`
- `DELETE /payments/payment-details/{id}/`

---

## 6) Packages (`/packages`)

- `GET /packages/`
- `POST /packages/`
- `GET /packages/{id}/`
- `PUT/PATCH /packages/{id}/`
- `DELETE /packages/{id}/`
- `GET /packages/{id}/pricings/`

Package pricing:

- `GET /packages/package-pricings/`
- `POST /packages/package-pricings/`
- `GET /packages/package-pricings/{id}/`
- `PUT/PATCH /packages/package-pricings/{id}/`
- `DELETE /packages/package-pricings/{id}/`

---

## 7) Utility (`/utility`)

- `GET /utility/utility-info/`
- `POST /utility/utility-info/`
- `GET /utility/utility-info/{id}/`
- `PUT/PATCH /utility/utility-info/{id}/`
- `DELETE /utility/utility-info/{id}/`

- `GET /utility/utility-details/`
- `POST /utility/utility-details/`
- `GET /utility/utility-details/{id}/`
- `PUT/PATCH /utility/utility-details/{id}/`
- `DELETE /utility/utility-details/{id}/`

---

## 8) Pagination and Filtering

Default pagination is limit/offset:

- `?limit=25&offset=0`

Most list APIs support:

- `search`
- filter fields per endpoint
- `ordering`

---

## 9) Common Error Patterns

- `400 Bad Request`: validation errors or missing required query params
- `401 Unauthorized`: missing/invalid token
- `403 Forbidden`: permission denied by RBAC
- `404 Not Found`: resource ID does not exist

---

## 10) Postman

Import the provided collection file:

- `ISP_Billing_API.postman_collection.json`

Set collection variables:

- `baseUrl` (default `http://127.0.0.1:8000/api`)
- `accessToken`
- `refreshToken`
- `customerId`
- `kamId`
- `invoiceId`
- `paymentId`

