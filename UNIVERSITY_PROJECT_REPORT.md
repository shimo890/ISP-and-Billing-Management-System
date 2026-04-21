# ISP Billing - University Project Report (Minimal)

Version: 1.0  
Last updated: April 2026

## Overview

This report presents a minimal version of the ISP Billing project focused on core dashboard analytics and essential billing operations.

## Core Objective

Provide a clear and reliable dashboard for monitoring billing performance and customer activity.

## Core Dashboard Metrics

- Total Revenue
- Active Customers
- Collection Rate (%)
- Outstanding Balance
- Weekly Revenue Trend
- Monthly Revenue Comparison

## System Summary

- Frontend: React + Vite
- Backend: Django + Django REST Framework
- Database: SQLite (development)
- Authentication: JWT

## Data Flow (Minimal)

1. Billing and payment records are stored in the backend database.
2. Aggregation queries compute dashboard metrics.
3. Dashboard endpoints return concise metric payloads.
4. Frontend renders KPI cards and trend charts.

## Example Dashboard API

`GET /api/bills/analytics/dashboard/?start_date=2024-01-01&end_date=2024-04-30`

Example response:

```json
{
  "total_revenue": 500000.0,
  "active_customers": 145,
  "collection_rate": 94.5,
  "outstanding_balance": 25000.0,
  "weekly_revenue": [{ "week": "2024-W1", "revenue": 50000 }],
  "monthly_revenue": [{ "month": "2024-01", "revenue": 150000 }]
}
```

## Implementation Notes

- Dashboard APIs return pre-aggregated values for fast page load.
- List endpoints use pagination.
- Date-range filters are used for trend views.

## Development Setup

Backend:

```bash
cd backend-api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Conclusion

The minimal project keeps the dashboard concise and actionable by focusing on only the essential ISP billing metrics and trends.

## References

- `backend-api/README.md`
- `frontend/README.md`
- `API_DOCUMENTATION.md`
- `PROJECT_FULL_DOCUMENTATION.md`
