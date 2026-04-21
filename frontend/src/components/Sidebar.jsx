import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Moon,
  Sun,
  LayoutDashboard,
  FileText,
  Users,
  User,
  UserPlus,
  TrendingUp,
  Building2,
  Activity,
  LogOut,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Shield,
  Package,
  Receipt,
  CreditCard,
  BookOpen,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { APP_SHORT_TITLE } from "../constants/branding";
import { motion } from "framer-motion";

function Sidebar({ isOpen, setIsOpen }) {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, hasPermission, isAdmin, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [reportsOpen, setReportsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(location.pathname === '/payment' || location.pathname === '/payments' || location.pathname === '/payment-list' || location.pathname === '/bulk-payment');
  const [invoiceOpen, setInvoiceOpen] = useState(location.pathname === '/invoice' || location.pathname === '/invoices' || location.pathname === '/invoice-view');
  const [kamOpen, setKamOpen] = useState(location.pathname === '/kam/create' || location.pathname === '/kam/list');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setPaymentOpen(location.pathname === '/payment' || location.pathname === '/payments' || location.pathname === '/payment-list' || location.pathname === '/bulk-payment');
    setInvoiceOpen(location.pathname === '/invoice' || location.pathname === '/invoices' || location.pathname === '/invoice-view');
    setKamOpen(location.pathname === '/kam/create' || location.pathname === '/kam/list');
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => {
    if (location.pathname === path) return true;
    if (path === "/entitlement") {
      if (location.pathname === "/data-entry") {
        const customerType = new URLSearchParams(location.search).get("customerType");
        return ["bw"].includes(customerType);
      }
    }
    return false;
  };

  // Base navigation items for all users
  const baseNavItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      permission: null,
    },
    {
      name: "KAM",
      icon: TrendingUp,
      subItems: [
        {
          name: "Create",
          path: "/kam/create",
          permission: "customers:read",
        },
        {
          name: "List",
          path: "/kam/list",
          permission: "customers:read",
        },
      ],
    },
  ];

  // Navigation groups
  const navGroups = [
    {
      name: "Ledger",
      path: "/ledger",
      icon: BookOpen,
      permission: "ledger:read",
      isSingle: true,
    },
    {
      name: "Received",
      icon: CreditCard,
      subItems: [
        {
          name: "Create",
          path: "/payment",
          permission: "payment_details:read",
        },
        // {
        //   name: "Bulk Payment",
        //   path: "/bulk-payment",
        //   permission: "payments:create",
        // },
        {
          name: "List",
          path: "/payments",
          permission: "payment_details:read",
        },
      ],
    },
    {
      name: "Invoice",
      icon: Receipt,
      subItems: [
        {
          name: "Create",
          path: "/invoice",
          permission: "invoices:read",
        },
        {
          name: "List",
          path: "/invoices",
          permission: "invoices:read",
        },
      ],
    },
    {
      name: "Entitlements",
      path: "/entitlement",
      icon: FileText,
      permission: "entitlements:read",
      isSingle: true,
    },
    {
      name: "Customers",
      path: "/customers",
      icon: Users,
      permission: "customers:read",
      isSingle: true,
    },
    {
      name: "Packages",
      path: "/packages",
      icon: Package,
      permission: "packages:read",
      isSingle: true,
    },
  ];

  // Admin-only navigation items
  const adminNavItems = [
    {
      name: "User Management",
      path: "/users",
      icon: UserPlus,
      permission: "users:read",
    },
    {
      name: "Role Management",
      path: "/roles",
      icon: Shield,
      permission: "users:read",
    },
    {
      name: "Activity Logs",
      path: "/activity-logs",
      icon: Activity,
      permission: "logs:read",
    },
  ];

  // Reports submenu
  const reportsItems = [
    // {
    //   name: "Company Reports",
    //   path: "/reports/company",
    //   permission: "reports:read",
    // },
    // {
    //   name: "Data Entry Performance",
    //   path: "/reports/performance",
    //   permission: "reports:read",
    // },
  ];

  // Filter navigation items based on permissions
  const visibleNavItems = baseNavItems.filter((item) => {
    const show =
      !item.permission ||
      hasPermission(item.permission) ||
      hasPermission("all");
    return show;
  });

  const visibleAdminItems = isAdmin() ? adminNavItems : [];

  const visibleReportsItems = reportsItems.filter((item) => {
    const show =
      !item.permission ||
      hasPermission(item.permission) ||
      hasPermission("all");
    return show;
  });

  // Filter navigation groups based on permissions
  const visibleGroups = navGroups.map(group => {
    if (group.isSingle) {
      const show = !group.permission || hasPermission(group.permission) || hasPermission("all");
      return show ? group : null;
    } else {
      const visibleSubItems = group.subItems.filter(sub =>
        !sub.permission || hasPermission(sub.permission) || hasPermission("all")
      );
      return visibleSubItems.length > 0 ? { ...group, subItems: visibleSubItems } : null;
    }
  }).filter(Boolean);

  const NavItem = ({ item, isSubmenu = false }) => {
    const isActivePath = isActive(item.path);
    const className = `flex items-center px-3 sm:px-4 py-3 rounded-lg font-medium transition-all duration-300 group ${
      isActivePath
        ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:text-white shadow-lg"
        : isDark
        ? "text-gray-300 hover:text-gray-300"
        : "text-gray-700 hover:text-gray-700"
    } ${isSubmenu ? "ml-4 sm:ml-6 text-sm" : ""}`;

    if (item.newTab) {
      return (
        <a
          href={item.path}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setIsOpen(false)}
          className={className}
        >
          <item.icon
            className={`h-5 w-5 mr-3 ${isActivePath ? "text-white" : ""}`}
          />
          <span
            className={`text-sm sm:text-base ${
              !isActivePath ? "group-hover:underline" : ""
            }`}
          >
            {item.name}
          </span>
        </a>
      );
    }

    return (
      <Link
        to={item.path}
        onClick={() => setIsOpen(false)}
        className={className}
      >
        <item.icon
          className={`h-5 w-5 mr-3 ${isActivePath ? "text-white" : ""}`}
        />
        <span
          className={`text-sm sm:text-base ${
            !isActivePath ? "group-hover:underline" : ""
          }`}
        >
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={isOpen || isDesktop ? "open" : "closed"}
        variants={{
          open: { x: 0 },
          closed: { x: "-100%" },
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed left-0 top-0 z-50 h-screen w-64 sm:w-72 shadow-2xl lg:sticky lg:z-auto lg:h-screen lg:w-64 lg:shadow-none ${
          isDark
            ? "bg-slate-900 border-r border-slate-800"
            : "bg-white border-r border-slate-200"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
            <Link
              to="/dashboard"
              className="flex items-center space-x-3 group flex-1"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 flex items-center justify-center shadow-md">
                <Building2 className="h-5 w-5 text-white" aria-hidden />
              </div>
              <div
                className={`font-bold text-sm leading-tight ${
                  isDark ? "text-slate-50" : "text-slate-900"
                }`}
              >
                {APP_SHORT_TITLE}
              </div>
            </Link>

            {/* Close button for mobile */}
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 sm:px-4 py-4 space-y-2 overflow-y-auto sidebar-nav">
            {visibleNavItems.map((item) => {
              if (item.subItems) {
                const isOpen = kamOpen;
                const setIsOpen = setKamOpen;
                const isGroupActive = item.subItems.some(sub => isActive(sub.path));
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => setIsOpen(!isOpen)}
                      className={`flex items-center w-full px-3 sm:px-4 py-3 rounded-lg font-medium transition-all duration-300 group ${
                        isGroupActive
                          ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:text-white shadow-lg"
                          : isDark
                          ? "text-gray-300 hover:text-gray-300"
                          : "text-gray-700 hover:text-gray-700"
                      }`}
                      aria-expanded={isOpen}
                      aria-label={`Toggle ${item.name} menu`}
                    >
                      <item.icon className={`h-5 w-5 mr-3 ${isGroupActive ? "text-white" : ""}`} />
                      <span className={`text-sm sm:text-base ${!isGroupActive ? "group-hover:underline" : ""}`}>{item.name}</span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      ) : (
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      )}
                    </button>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-0 mt-2 space-y-1"
                      >
                        {item.subItems.map((sub) => (
                          <NavItem
                            key={sub.path}
                            item={{ ...sub, icon: item.icon }}
                            isSubmenu
                          />
                        ))}
                      </motion.div>
                    )}
                  </div>
                );
              }
              return <NavItem key={item.path} item={item} />;
            })}

            {/* Groups */}
            {visibleGroups.map((group) => {
              if (group.isSingle) {
                return <NavItem key={group.path} item={group} />;
              } else {
                const isOpen = group.name === "Received" ? paymentOpen : invoiceOpen;
                const setIsOpen = group.name === "Received" ? setPaymentOpen : setInvoiceOpen;
                const isGroupActive = group.subItems.some(sub => isActive(sub.path));
                return (
                  <div key={group.name}>
                    <button
                      onClick={() => setIsOpen(!isOpen)}
                      className={`flex items-center w-full px-3 sm:px-4 py-3 rounded-lg font-medium transition-all duration-300 group ${
                        isGroupActive
                          ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:text-white shadow-lg"
                          : isDark
                          ? "text-gray-300 hover:text-gray-300"
                          : "text-gray-700 hover:text-gray-700"
                      }`}
                      aria-expanded={isOpen}
                      aria-label={`Toggle ${group.name} menu`}
                    >
                      <group.icon className={`h-5 w-5 mr-3 ${isGroupActive ? "text-white" : ""}`} />
                      <span className={`text-sm sm:text-base ${!isGroupActive ? "group-hover:underline" : ""}`}>{group.name}</span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      ) : (
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      )}
                    </button>

                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-0 mt-2 space-y-1"
                      >
                        {group.subItems.map((sub) => (
                          <NavItem
                            key={sub.path}
                            item={{ ...sub, icon: group.icon }}
                            isSubmenu
                          />
                        ))}
                      </motion.div>
                    )}
                  </div>
                );
              }
            })}

            {/* Reports Section */}
            {visibleReportsItems.length > 0 && (
              <div>
                <button
                  onClick={() => setReportsOpen(!reportsOpen)}
                  className={`flex items-center w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 group ${
                    isDark
                      ? "text-gray-300 hover:text-gray-300"
                      : "text-gray-700 hover:text-gray-700"
                  }`}
                  aria-expanded={reportsOpen}
                  aria-label="Toggle reports menu"
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
        <span className="group-hover:underline">Reports</span>
                  {reportsOpen ? (
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  ) : (
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  )}
                </button>

                {reportsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-6 mt-2 space-y-1"
                  >
                    {visibleReportsItems.map((item) => (
                      <NavItem
                        key={item.path}
                        item={{ ...item, icon: BarChart3 }}
                        isSubmenu
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* Admin Navigation */}
            {visibleAdminItems.length > 0 && (
              <>
                <div className="pt-4">
                  <div className="px-4 py-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Administration
                    </h3>
                  </div>
                  {visibleAdminItems.map((item) => (
                    <NavItem key={item.path} item={item} />
                  ))}
                </div>
              </>
            )}
          </nav>

          {/* Footer - User Menu with Dropdown */}
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800">
            {/* User Info Dropdown Trigger */}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center w-full px-3 py-2 rounded-lg transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
              aria-expanded={userMenuOpen}
              aria-label="Toggle user menu"
            >
              <div className="w-11 h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-sm">
                  {(user?.username?.charAt(0) || "").toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 ml-3 text-left">
                <p
                  className={`text-sm sm:text-base font-medium truncate ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {user?.username}
                </p>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 capitalize">
                  {typeof user?.role === "string"
                    ? user.role.replace("_", " ")
                    : user?.role_name || "User"}
                </p>
              </div>
              {userMenuOpen ? (
                <ChevronUp className="h-4 w-4 ml-2 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
              )}
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-1"
              >
                {/* Profile */}
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-300 group ${
                    isActive("/profile")
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:text-white shadow-lg"
                      : isDark
                      ? "text-gray-300 hover:text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <User className="h-4 w-4 mr-3" />
                  <span
                    className={`text-sm ${
                      !isActive("/profile") ? "group-hover:underline" : ""
                    }`}
                  >
                    Profile
                  </span>
                </Link>

                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className={`flex items-center w-full px-4 py-2 rounded-lg font-medium transition-all duration-300 group ${
                    isDark
                      ? "text-gray-300 hover:text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {isDark ? (
                    <Sun className="h-4 w-4 mr-3" />
                  ) : (
                    <Moon className="h-4 w-4 mr-3" />
                  )}
                  <span className="text-sm group-hover:underline">
                    {isDark ? "Light Mode" : "Dark Mode"}
                  </span>
                </button>

                {/* Settings */}
                {/* <Link
                  to="/settings"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-300 group ${
                    isActive("/settings")
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:text-white shadow-lg"
                      : isDark
                      ? "text-gray-300 hover:text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Settings className="h-4 w-4 mr-3" />
                  <span
                    className={`text-sm ${
                      !isActive("/settings") ? "group-hover:underline" : ""
                    }`}
                  >
                    Settings
                  </span>
                </Link> */}

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className={`flex items-center w-full px-4 py-2 rounded-lg font-medium transition-all duration-300 group ${
                    isDark
                      ? "text-gray-300 hover:text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  <span className="text-sm group-hover:underline">Logout</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default Sidebar;
