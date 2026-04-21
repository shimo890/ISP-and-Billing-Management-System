import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import NotificationContainer from "./components/NotificationContainer";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import AcceptInvitation from "./pages/AcceptInvitation";
import Dashboard from "./pages/Dashboard";
import KAMManagement from "./pages/KAMManagement";
import Ledger from "./pages/Ledger";
import SingleLedger from "./pages/SingleLedger";
import AdminDashboard from "./pages/AdminDashboard";
import ActivityLogs from "./pages/ActivityLogs";
import CompanyReports from "./pages/CompanyReports";
import DataEntryPerformance from "./pages/DataEntryPerformance";
import DataEntry from "./pages/DataEntry";
import Entitlement from "./pages/Entitlement";
import Customers from "./pages/Customers";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import Invoices from "./pages/Invoices";
import InvoiceForm from "./pages/InvoiceForm";
import PaymentForm from "./pages/PaymentForm";
import BulkPaymentForm from "./pages/BulkPaymentForm";
import InvoiceSingle from "./pages/InvoiceSingle";
import InvoiceView from "./pages/InvoiceView";
import Payments from "./pages/Payments";
import PaymentView from "./pages/PaymentView";
import Profile from "./pages/Profile";
import Packages from "./pages/Packages";
import "./App.css";
import { APP_SHORT_TITLE } from "./constants/branding";

// Protected Route Component
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { isAuthenticated, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Admin Route Component
const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Main App Layout with Sidebar
const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell h-screen flex overflow-hidden">
      {/* Sidebar - Always visible on desktop, toggleable on mobile */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="lg:hidden sticky top-0 z-40 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {APP_SHORT_TITLE}
            </h1>
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 shadow-sm"
              aria-label="Open menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <NotificationContainer />
    </div>
  );
};

// App Routes Component
const AppRoutes = () => {
  const { isAuthenticated, hasRole } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        }
      />

      <Route
        path="/forgot-password"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <ForgotPassword />
          )
        }
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="/accept-invitation"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AcceptInvitation />
          )
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/kam/create"
        element={
          <ProtectedRoute requiredPermission="customers:read">
            <AppLayout>
              <KAMManagement defaultMode="create" />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/kam/list"
        element={
          <ProtectedRoute requiredPermission="customers:read">
            <AppLayout>
              <KAMManagement defaultMode="list" />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ledger"
        element={
          <ProtectedRoute requiredPermission="ledger:read">
            <AppLayout>
              <Ledger />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ledger/customer/:customerId"
        element={
          <ProtectedRoute requiredPermission="ledger:read">
            <AppLayout>
              <SingleLedger />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/data-entry"
        element={
          <ProtectedRoute requiredPermission="entitlements:read">
            <AppLayout>
              <DataEntry />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/entitlement"
        element={
          <ProtectedRoute requiredPermission="entitlements:read">
            <AppLayout>
              <Entitlement />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Backward/alias route for ISP wording */}
      <Route path="/bill-entry" element={<Navigate to="/entitlement" replace />} />

      <Route
        path="/invoices"
        element={
          <ProtectedRoute requiredPermission="invoices:read">
            <AppLayout>
              <Invoices />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoice"
        element={
          <ProtectedRoute requiredPermission="invoices:read">
            <AppLayout>
              <InvoiceForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payment"
        element={
          <ProtectedRoute requiredPermission="payment_details:read">
            <AppLayout>
              <PaymentForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute requiredPermission="payment_details:read">
            <AppLayout>
              <Payments />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payment-view"
        element={
          <ProtectedRoute requiredPermission="payment_details:read">
            <AppLayout>
              <PaymentView />
            </AppLayout>
          </ProtectedRoute>
        }
      />


      {/* <Route
        path="/bulk-payment"
        element={
          <ProtectedRoute requiredPermission="payments:create">
            <AppLayout>
              <BulkPaymentForm />
            </AppLayout>
          </ProtectedRoute>
        }
      /> */}

      <Route
        path="/invoice-single"
        element={
          <ProtectedRoute requiredPermission="invoices:read">
            <AppLayout>
              <InvoiceSingle />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoice-view"
        element={
          <ProtectedRoute requiredPermission="invoices:read">
            <AppLayout>
              <InvoiceView />
            </AppLayout>
          </ProtectedRoute>
        }
      />


      <Route
        path="/customers"
        element={
          <ProtectedRoute requiredPermission="customers:read">
            <AppLayout>
              <Customers />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/packages"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Packages />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Profile />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/users"
        element={
          <AdminRoute>
            <AppLayout>
              <Users />
            </AppLayout>
          </AdminRoute>
        }
      />

      <Route
        path="/roles"
        element={
          <AdminRoute>
            <AppLayout>
              <Roles />
            </AppLayout>
          </AdminRoute>
        }
      />

      <Route
        path="/activity-logs"
        element={
          <AdminRoute>
            <AppLayout>
              <ActivityLogs />
            </AppLayout>
          </AdminRoute>
        }
      />

      <Route
        path="/reports/company"
        element={
          <ProtectedRoute requiredPermission="reports:read">
            <AppLayout>
              <CompanyReports />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/performance"
        element={
          <ProtectedRoute requiredPermission="reports:read">
            <AppLayout>
              <DataEntryPerformance />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/register"
        element={
          <AdminRoute>
            <Register />
          </AdminRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* 404 Route */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                404
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Page not found</p>
            </div>
          </div>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Router>
              <AppRoutes />
            </Router>
          </ErrorBoundary>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
