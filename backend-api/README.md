# Sales Dashboard API (Django)

A JWT-secured backend for authentication, RBAC, customers, prospects, bills, audit logs, and dynamic menus.

## Stack
- Django 5 + DRF
- SimpleJWT (with blacklist)
- django-filter, drf-yasg/Swagger

## Quick start
```bash
cd /home/shamimkhaled/sales-dashboard-app/backend-api
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manasge.py seed_rbac   # seeds permissions, roles, and menu
python manage.py runserver
```

Docs: Swagger at http://localhost:8000/api/docs/ (Redoc at /api/redoc/)

## Apps
- apps/authentication: roles, permissions, menu, auth endpoints, activity/audit
- apps/users: custom user model (email login) and /api/users/me
- apps/customers: customers, prospects, follow-ups, attachments; import/export, revenue calc
- apps/bills: BillRecord (Node.js-compatible schema), import/export

## ENV (optional via python-decouple)
- SECRET_KEY, DEBUG, ALLOWED_HOSTS
- JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_REFRESH_TOKEN_EXPIRE_DAYS
- CORS_ALLOWED_ORIGINS

## RBAC seeding
- Roles: super_admin, admin, sales_manager, sales_person, user
- Permissions: users/customers/prospects/bills (read/create/update/import/export), reports, logs
- Menu: Dashboard, Customers, Prospects, Bills, Reports, Admin

## Testing
- Import Postman collection: `postman_collection.json`
- Or use curl; see `api-docs.md` for requests/responses

## Project layout
```
backend-api/
  apps/
    authentication/
    users/
    customers/
    bills/
  config/
  manage.py
  requirements.txt
  api-docs.md
  postman_collection.json
```

