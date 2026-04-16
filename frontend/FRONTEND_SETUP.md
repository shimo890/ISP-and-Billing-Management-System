# Frontend Setup & Implementation Guide

## Overview

This guide covers the complete frontend implementation for the Sales Dashboard application with modern premium design, advanced analytics, and comprehensive data management features.

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx              # Navigation with theme toggle
│   │   ├── KPICard.jsx             # KPI metric cards
│   │   ├── LoadingSpinner.jsx      # Loading state component
│   │   └── ErrorAlert.jsx          # Error notification component
│   ├── context/
│   │   └── ThemeContext.jsx        # Light/Dark theme management
│   ├── pages/
│   │   ├── Dashboard.jsx           # Main analytics dashboard
│   │   ├── DataEntry.jsx           # Bill management with import/export
│   │   └── Customers.jsx           # Customer management
│   ├── services/
│   │   ├── api.js                  # Base API configuration
│   │   ├── billService.js          # Bill API calls
│   │   ├── customerService.js      # Customer API calls
│   │   └── dashboardService.js     # Dashboard analytics API calls
│   ├── App.jsx                     # Main app component
│   ├── App.css                     # Global styles
│   ├── index.css                   # Tailwind & base styles
│   └── main.jsx                    # Entry point
├── tailwind.config.js              # Tailwind configuration
├── vite.config.js                  # Vite configuration
└── package.json                    # Dependencies
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Required Libraries

All dependencies are already installed:

- **React Router**: Navigation between pages
- **Axios**: HTTP client for API calls
- **Recharts**: Data visualization charts
- **Framer Motion**: Smooth animations
- **Lucide React**: Icon library
- **Tailwind CSS**: Utility-first CSS framework

### 3. Environment Configuration

Create `.env` file in frontend directory:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Features Implemented

### 1. Theme System (Light/Dark Mode)

**Location**: [`frontend/src/context/ThemeContext.jsx`](frontend/src/context/ThemeContext.jsx)

- Automatic theme detection based on system preferences
- LocalStorage persistence
- Global theme context for all components
- Smooth transitions between themes

**Usage**:
```jsx
import { useTheme } from '../context/ThemeContext';

function MyComponent() {
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
```

### 2. Premium Design System

**Tailwind Configuration**: [`frontend/tailwind.config.js`](frontend/tailwind.config.js)

**Color Palette**:
- **Gold**: #d4af37 (Primary accent)
- **Silver**: #c0c0c0 (Secondary)
- **Dark**: #1f2937 (Dark theme base)
- **ISP Colors**: Blue (#0066cc), Green (#10b981), Red (#ef4444)

**Design Features**:
- Glassmorphism effects
- Smooth animations and transitions
- Premium shadows and gradients
- Responsive grid system
- Accessibility-first approach

### 3. Dashboard Page

**Location**: [`frontend/src/pages/Dashboard.jsx`](frontend/src/pages/Dashboard.jsx)

**Features**:
- KPI cards showing total revenue, customers, active customers, collection rate
- Weekly revenue area chart
- Monthly revenue bar chart
- Yearly revenue line chart
- Customer status distribution pie chart
- Top customers by revenue table
- Date range filter (Weekly/Monthly/Yearly)
- Real-time data refresh

**Charts Used**:
- AreaChart: Weekly trends
- BarChart: Monthly comparison
- LineChart: Yearly trends
- PieChart: Customer distribution

### 4. Data Entry Page

**Location**: [`frontend/src/pages/DataEntry.jsx`](frontend/src/pages/DataEntry.jsx)

**Features**:
- Create, read, update, delete bills
- Import bills from Excel/CSV files
- Export bills to Excel/CSV formats
- Table view for structured data display
- Card view for visual browsing
- Search functionality
- Real-time form validation
- Status indicators (Pending, Paid, Overdue)

**Form Fields**:
- Customer Name
- Bill Amount
- Bill Date
- Due Date
- Status (Pending/Paid/Overdue)
- Payment Method (Cash/Bank/Check/Online)
- Notes

### 5. Customers Page

**Location**: [`frontend/src/pages/Customers.jsx`](frontend/src/pages/Customers.jsx)

**Features**:
- Manage customer information
- Track join and leave dates
- Monitor monthly budget allocation
- Customer status tracking (Active/Inactive)
- Export customer data to Excel
- Advanced search and filtering
- Statistics dashboard with KPI cards
- Customer-wise revenue display

**Customer Fields**:
- Name
- Email
- Phone
- Address
- Join Date
- Leave Date (Optional)
- Monthly Budget
- Status

### 6. Navigation Component

**Location**: [`frontend/src/components/Navbar.jsx`](frontend/src/components/Navbar.jsx)

**Features**:
- Sticky navigation bar
- Theme toggle button
- Mobile-responsive menu
- Active page indicator
- Smooth animations
- Logo with branding

### 7. KPI Card Component

**Location**: [`frontend/src/components/KPICard.jsx`](frontend/src/components/KPICard.jsx)

**Features**:
- Customizable metrics display
- Trend indicators (up/down)
- Multiple color themes
- Hover animations
- Icon support
- Responsive design

### 8. API Services

#### Dashboard Service
**Location**: [`frontend/src/services/dashboardService.js`](frontend/src/services/dashboardService.js)

```javascript
// Get weekly revenue
await dashboardService.getWeeklyRevenue();

// Get monthly revenue
await dashboardService.getMonthlyRevenue();

// Get yearly revenue
await dashboardService.getYearlyRevenue();

// Get customer-wise revenue
await dashboardService.getCustomerWiseRevenue();

// Get complete summary
await dashboardService.getSummary();
```

#### Bill Service
**Location**: [`frontend/src/services/billService.js`](frontend/src/services/billService.js)

```javascript
// Get all bills
await billService.getAllBills();

// Get bill by ID
await billService.getBillById(id);

// Create bill
await billService.createBill(data);

// Update bill
await billService.updateBill(id, data);

// Delete bill
await billService.deleteBill(id);
```

#### Customer Service
**Location**: [`frontend/src/services/customerService.js`](frontend/src/services/customerService.js)

```javascript
// Get all customers
await customerService.getAllCustomers();

// Get customer by ID
await customerService.getCustomerById(id);

// Create customer
await customerService.createCustomer(data);

// Update customer
await customerService.updateCustomer(id, data);

// Delete customer
await customerService.deleteCustomer(id);
```

## Styling System

### Global Styles

**App.css**: Premium design tokens and utilities
**index.css**: Tailwind base styles and components

### Color Usage

```jsx
// Light mode
<div className="bg-white text-dark-900 border-gold-100">

// Dark mode
<div className="dark:bg-dark-800 dark:text-white dark:border-dark-700">

// Gradient
<div className="bg-gradient-premium">

// Shadows
<div className="shadow-premium hover:shadow-premium-lg">
```

### Animation Classes

```jsx
// Fade in
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

// Slide up
<motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} />

// Hover effects
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} />
```

## Data Flow

### Import/Export Flow

```
User selects file
    ↓
File uploaded to backend
    ↓
Backend validates data
    ↓
Data stored in database
    ↓
Frontend fetches updated data
    ↓
UI updates with new records
```

### Analytics Flow

```
Dashboard loads
    ↓
Fetch weekly/monthly/yearly revenue
    ↓
Fetch customer-wise revenue
    ↓
Calculate KPI metrics
    ↓
Render charts and tables
```

## Performance Optimization

### 1. Code Splitting

Routes are lazy-loaded for better performance:

```jsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DataEntry = lazy(() => import('./pages/DataEntry'));
const Customers = lazy(() => import('./pages/Customers'));
```

### 2. Memoization

Components use React.memo to prevent unnecessary re-renders:

```jsx
export default React.memo(KPICard);
```

### 3. Image Optimization

All icons use Lucide React (SVG-based, lightweight)

### 4. Bundle Size

- Tailwind CSS: Purged unused styles
- Tree-shaking enabled for all dependencies
- Minification in production build

## Responsive Design

### Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Grid System

```jsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
```

## Accessibility Features

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus indicators
- Color contrast compliance
- Screen reader friendly

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Issue: API calls failing

**Solution**: Ensure backend is running on `http://localhost:5000`

```bash
# Backend terminal
cd backend
npm start
```

### Issue: Styles not applying

**Solution**: Clear Tailwind cache and rebuild

```bash
npm run build
```

### Issue: Theme not persisting

**Solution**: Check browser localStorage is enabled

```javascript
// Check localStorage
console.log(localStorage.getItem('theme'));
```

### Issue: Charts not rendering

**Solution**: Ensure Recharts is installed

```bash
npm install recharts
```

## Future Development Considerations

### Phase 1: Advanced Filtering
- Date range picker for analytics
- Customer segment filtering
- Revenue range filtering
- Status-based filtering

### Phase 2: Reporting
- PDF export functionality
- Custom report builder
- Scheduled email reports
- Report templates

### Phase 3: Real-time Updates
- WebSocket integration
- Live data streaming
- Real-time notifications
- Collaborative editing

### Phase 4: Mobile App
- React Native implementation
- Offline support
- Push notifications
- Mobile-optimized UI

### Phase 5: Advanced Analytics
- Predictive analytics
- Machine learning insights
- Anomaly detection
- Forecasting models

### Phase 6: Integration
- Payment gateway integration
- Email service integration
- SMS notifications
- Third-party API connections

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

```bash
npm run build
# Drag and drop 'dist' folder to Netlify
```

### Environment Variables for Production

```env
VITE_API_URL=https://api.yourdomain.com
```

## Support & Documentation

- **Tailwind CSS**: https://tailwindcss.com
- **Framer Motion**: https://www.framer.com/motion
- **Recharts**: https://recharts.org
- **React Router**: https://reactrouter.com
- **Lucide Icons**: https://lucide.dev

## License

This project is licensed under the MIT License.

## Contact

For support and inquiries, please contact the development team.
