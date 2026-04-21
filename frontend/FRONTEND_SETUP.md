# Frontend Setup Guide (Minimal)

## Overview

This document covers the minimal frontend setup for the ISP Billing dashboard.

## Stack

- React
- Vite
- Axios
- Recharts
- Tailwind CSS

## Project Structure

```text
frontend/
  src/
    components/
    pages/
    services/
    App.jsx
    main.jsx
  package.json
  vite.config.js
```

## Installation

```bash
cd frontend
npm install
```

## Environment

Create `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Run

```bash
npm run dev
```

## Core Dashboard Scope

The frontend dashboard should display only:

- Total Revenue
- Active Customers
- Collection Rate (%)
- Outstanding Balance
- Weekly Revenue Trend
- Monthly Revenue Comparison

## API Integration (Minimal)

Dashboard service should consume a single summary endpoint and map the response to KPI cards and trend charts.

## Build

```bash
npm run build
```

## Troubleshooting

- If API calls fail, verify backend URL and server status.
- If charts do not render, verify response payload shape.
- If styling fails, rebuild and restart the dev server.
