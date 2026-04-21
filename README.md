# ISP Metrics Dashboard

A clean, minimal metrics dashboard for ISP companies providing real-time business insights.

## Overview

The ISP Metrics Dashboard is a web application focused on displaying core business metrics for Internet Service Providers.

## Core Dashboard Metrics

### Real-time KPIs
- Revenue
- Customers
- Active Customers
- Collection Rate

### Revenue Analysis
- Weekly revenue trends (Area Chart)
- Monthly revenue comparison (Bar Chart)
- Yearly revenue analysis (Line Chart)
- Customer distribution (Pie Chart)
- Top customers by revenue table

### Filtering
- Date range filtering for all metrics

### Design
- Responsive design (Mobile, Tablet, Desktop)
- Light/Dark theme toggle
- Clean, minimal interface

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js (v16 or higher)

### Backend Setup (Django)

```bash
cd backend-api
python3 -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs on `http://localhost:8000`

### Frontend Setup (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Project Structure

```
isp-metrics-dashboard/
├── backend-api/          # Django Backend
│   ├── apps/dashboard/   # Dashboard analytics
│   ├── config/           # Django settings
│   ├── manage.py
│   └── requirements.txt
├── frontend/             # React Frontend
│   ├── src/
│   │   ├── components/   # Dashboard components
│   │   ├── pages/        # Dashboard page
│   │   ├── services/     # API services
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## API Endpoints

### Dashboard Analytics
```
GET    /api/dashboard/kpis/                # KPI metrics
GET    /api/dashboard/weekly-revenue/      # Weekly revenue data
GET    /api/dashboard/monthly-revenue/     # Monthly revenue data
GET    /api/dashboard/yearly-revenue/      # Yearly revenue data
GET    /api/dashboard/customer-wise-revenue/ # Customer revenue breakdown
```

## Technology Stack

### Backend
- **Django** - Web framework
- **Django REST Framework** - API framework
- **SQLite** - Database

### Frontend
- **React** - UI library
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Vite** - Build tool

## Environment Variables

**backend-api/.env:**
```
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1
```

**frontend/.env:**
```
VITE_API_BASE_URL=http://localhost:8000/api
```
