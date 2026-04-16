import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Download,
  Plus,
  Minus,
  Grid,
  List,
  Search,
  X,
  Edit2,
  Trash2,
  Eye,
  FileUp,
  FileDown,
  ChevronDown,
  AlertTriangle,
  XCircle,
  Check,
  Save,
  Copy,
  FileText,
  Users,
  Wifi,
  Building2,
  UserCircle,
  MapPin,
  Link2,
  Calendar,
  Activity,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import Pagination from "../components/Pagination";
import { billService } from "../services/billService";
import SearchableSelect from "../components/SearchableSelect";
import { customerService } from "../services/customerService";
import { packageService } from "../services/packageService";

// TODO: Future RBAC Implementation
// - Add role-based access control for different user types (super admin, admin, user)
// - Implement menu access restrictions based on user roles
// - Add authentication middleware to protect routes
// - Create user management system with role assignment
// - Add audit logging for data modifications
// - Implement permission-based UI component visibility

export default function DataEntry() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { showSuccess, showError } = useNotification();
  const { hasPermission } = useAuth();
  const urlParamsProcessed = useRef(false);
  const [viewMode, setViewMode] = useState("table");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false); // initial/customer counts
  const [listLoading, setListLoading] = useState(false); // bills table only
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("");
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [salesUsers, setSalesUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fileType, setFileType] = useState("excel");
  const [expandedRow, setExpandedRow] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingBill, setViewingBill] = useState(null);
  const [selectedCustomerType, setSelectedCustomerType] = useState("");
  const [formCustomerTypeFilter, setFormCustomerTypeFilter] = useState("");
  const [packages, setPackages] = useState([]);
  const [bandwidthPackageRows, setBandwidthPackageRows] = useState([
    {
      id: 1,
      detailId: null,
      packageId: "",
      startDate: "",
      mbps: "",
      unitPrice: "",
      total: "",
    },
  ]);
  const [channelPartnerPackageRows, setChannelPartnerPackageRows] = useState([
    {
      id: 1,
      detailId: null,
      packageId: "",
      startDate: "",
      mbps: "",
      unitPrice: "",
      total: "",
      kloudPercent: "",
      clientPercent: "",
    },
  ]);
  const [sohoPackageRows, setSohoPackageRows] = useState([
    {
      id: 1,
      detailId: null,
      packageId: "",
      mbps: "",
      unitPrice: "",
      total: "",
    },
  ]);
  
  // Track removed package detail IDs for marking as inactive
  const [removedPackageDetailIds, setRemovedPackageDetailIds] = useState([]);
  // Track end dates for removed packages
  const [removedPackageEndDates, setRemovedPackageEndDates] = useState({});
  // End date modal state
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [packageToRemove, setPackageToRemove] = useState(null);
  const [endDateForRemoval, setEndDateForRemoval] = useState("");
  // Track which package rows are in edit mode (for updating existing packages)
  const [editingRowIds, setEditingRowIds] = useState(new Set());

  // Check if there are any new package rows (rows without detailId) when editing
  const hasNewPackageRows = useMemo(() => {
    if (!editingId) return true; // Always show buttons when creating new bill
    
    if (selectedCustomerType === "bw") {
      return bandwidthPackageRows.some(row => !row.detailId && row.packageId);
    } else if (selectedCustomerType === "channel_partner") {
      return channelPartnerPackageRows.some(row => !row.detailId && row.packageId);
    } else if (selectedCustomerType === "soho") {
      return sohoPackageRows.some(row => !row.detailId && row.packageId);
    }
    return false;
  }, [editingId, selectedCustomerType, bandwidthPackageRows, channelPartnerPackageRows, sohoPackageRows]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formData, setFormData] = useState({
    customer_id: "",
    type: "",
    nttn_cap: "",
    nttn_com: "",
    link_scr_id: "",
    link_src_id: "",
    nttn_uses: "",
    active_date: "",
    billing_date: "",
    termination_date: "",
    connection_type: "",
    connected_pop: "",
    type_of_bw: "",
    iig_qt: "",
    iig_qt_price: "",
    igt_qt_total: "",
    fna: "",
    fna_price: "",
    fna_total: "",
    ggc: "",
    ggc_price: "",
    ggc_total: "",
    cdn: "",
    cdn_price: "",
    cdn_total: "",
    bdix: "",
    bdix_price: "",
    bdix_total: "",
    baishan: "",
    baishan_price: "",
    baishan_total: "",
    total_bill: "",
    total_received: "",
    total_due: "",
    discount: "",
    remarks: "",
    status: "active",
    total_client: "",
    total_active_client: "",
    previous_total_client: "",
    free_giveaway_client: "",
    last_bill_invoice_date: "",
    zone_name: "",
  });

  useEffect(() => {
    console.log(
      "useEffect triggered - customerTypeFilter:",
      customerTypeFilter
    );

    // If we have a customerType URL param and it hasn't been processed yet, wait
    const customerTypeParam = searchParams.get("customerType");
    if (customerTypeParam && !urlParamsProcessed.current) {
      console.log(
        "Waiting for URL params to be processed before fetching bills"
      );
      return;
    }

    // Clear bills immediately when any filter changes to prevent showing mismatched data
    setBills([]);
    fetchBills();
  }, [
    currentPage,
    pageSize,
    searchTerm,
    statusFilter,
    monthFilter,
    customerTypeFilter,
  ]);

  useEffect(() => {
    fetchCustomers();
    fetchSalesUsers();
    fetchPackages();
  }, []);

  // Calculate and update NTTN Capacity and NTTN Uses based on total Mbps from package details (Bandwidth only)
  // NTTN Capacity: Sum of ALL Mbps (even if unit_price is 0)
  // NTTN Uses: Sum of Mbps where unit_price > 0
  useEffect(() => {
    if (selectedCustomerType === "bw") {
      // Calculate NTTN Capacity: sum of ALL Mbps
      const totalCapacityMbps = bandwidthPackageRows.reduce((sum, row) => {
        const mbps = parseFloat(row.mbps) || 0;
        return sum + mbps;
      }, 0);
      
      // Calculate NTTN Uses: sum of Mbps where unit_price > 0
      const totalUsesMbps = bandwidthPackageRows.reduce((sum, row) => {
        const mbps = parseFloat(row.mbps) || 0;
        const unitPrice = parseFloat(row.unitPrice) || 0;
        // Only add Mbps if unit_price is greater than 0
        if (unitPrice > 0) {
          return sum + mbps;
        }
        return sum;
      }, 0);
      
      // Format the total Mbps (add "Mbps" suffix, handle decimals appropriately)
      const formattedCapacity = totalCapacityMbps > 0 
        ? `${totalCapacityMbps % 1 === 0 ? totalCapacityMbps : totalCapacityMbps.toFixed(2)} Mbps` 
        : "";
      
      const formattedUses = totalUsesMbps > 0 
        ? `${totalUsesMbps % 1 === 0 ? totalUsesMbps : totalUsesMbps.toFixed(2)} Mbps` 
        : "";
      
      setFormData((prev) => ({
        ...prev,
        nttn_cap: formattedCapacity,
        nttn_uses: formattedUses,
      }));
    }
  }, [bandwidthPackageRows, selectedCustomerType]);

  // Handle URL parameters to auto-open form and set customer type filter
  useEffect(() => {
    // Only process URL params once on mount to avoid resetting filters
    if (urlParamsProcessed.current) {
      return;
    }

    const newParam = searchParams.get("new");
    const editParam = searchParams.get("edit");
    const viewParam = searchParams.get("view");
    const customerTypeParam = searchParams.get("customerType");

    if (newParam === "true") {
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // If customerType is in URL, pre-populate the form customer type filter
      if (customerTypeParam) {
        const typeMap = {
          bw: "bw",
          channel_partner: "channel_partner",
          soho: "soho",
          Bandwidth: "bw",
          Channel: "channel_partner",
          "Home/SOHO": "soho",
        };
        const formTypeValue = typeMap[customerTypeParam] || customerTypeParam;
        console.log("Pre-populating form customer type:", formTypeValue);
        setFormCustomerTypeFilter(formTypeValue);
        setSelectedCustomerType(formTypeValue);
      }
    }

    // Handle edit parameter - load and edit the bill
    if (editParam) {
      const billId = parseInt(editParam);
      if (!isNaN(billId)) {
        // Fetch the bill and call handleEdit
        billService
          .getBillById(billId)
          .then((response) => {
            const bill = response.data || response;
            console.log("Loading bill for edit from URL param:", bill);
            handleEdit(bill);
          })
          .catch((err) => {
            console.error("Error loading bill for edit:", err);
            showError("Failed to load bill for editing");
          });
      }
    }

    // Handle view parameter - load and view the bill
    if (viewParam) {
      const billId = parseInt(viewParam);
      if (!isNaN(billId)) {
        billService
          .getBillById(billId)
          .then((response) => {
            const bill = response.data || response;
            console.log("Loading bill for view from URL param:", bill);
            handleViewClick(bill);
          })
          .catch((err) => {
            console.error("Error loading bill for view:", err);
            showError("Failed to load bill for viewing");
          });
      }
    }

    if (customerTypeParam) {
      // Map from URL parameter to filter value
      const typeMap = {
        bw: "Bandwidth",
        channel_partner: "Channel",
        soho: "Home/SOHO",
      };
      const filterValue = typeMap[customerTypeParam] || customerTypeParam;
      console.log("Setting customerTypeFilter from URL param:", filterValue);
      setCustomerTypeFilter(filterValue);
      setCurrentPage(1);
    }

    urlParamsProcessed.current = true;
  }, [searchParams]);

  // Also update customerTypeFilter when URL params change (for navigation after bill creation)
  useEffect(() => {
    const customerTypeParam = searchParams.get("customerType");
    if (
      customerTypeParam &&
      !searchParams.get("new") &&
      !searchParams.get("edit")
    ) {
      const typeMap = {
        bw: "Bandwidth",
        channel_partner: "Channel",
        soho: "Home/SOHO",
      };
      const filterValue = typeMap[customerTypeParam] || customerTypeParam;
      console.log("Updating customerTypeFilter from URL change:", filterValue);
      setCustomerTypeFilter(filterValue);
    }
  }, [searchParams]);

  useEffect(() => {
    console.log("Customers state updated:", customers.length, "customers");
    if (customers.length > 0) {
      console.log("Sample customer:", customers[0]);
      console.log(
        "Customer types breakdown:",
        customers.reduce((acc, c) => {
          acc[c.customer_type] = (acc[c.customer_type] || 0) + 1;
          return acc;
        }, {})
      );
    }
  }, [customers]);

  // Memoize filtered customers to prevent unnecessary re-filtering
  const filteredCustomers = useMemo(() => {
    console.log("Computing filtered customers...", {
      formCustomerTypeFilter,
      customersIsArray: Array.isArray(customers),
      customersLength: customers?.length,
      firstCustomer: customers?.[0],
    });

    if (!formCustomerTypeFilter || !Array.isArray(customers)) {
      console.log("Returning empty array - no filter or customers not array");
      return [];
    }

    const filtered = customers.filter((customer) => {
      const matches = customer.customer_type === formCustomerTypeFilter;
      if (matches) {
        console.log("Matched customer:", {
          id: customer.id,
          name: customer.customer_name,
          type: customer.customer_type,
        });
      }
      return matches;
    });

    console.log(
      `Memoized filtered customers: Total=${customers.length}, Type=${formCustomerTypeFilter}, Filtered=${filtered.length}`
    );
    console.log(
      "Filtered customer IDs:",
      filtered.map((c) => c.id)
    );
    return filtered;
  }, [customers, formCustomerTypeFilter]);

  // Helper function to format customer type for display
  const formatCustomerType = (type) => {
    const typeMap = {
      soho: "Home/SOHO",
      bw: "Bandwidth",
      channel_partner: "Channel Partner",
    };
    return typeMap[type] || type;
  };

  const fetchSalesUsers = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "/api";
      const response = await fetch(`${API_URL}/customers/kam/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch KAM list");
      }

      const data = await response.json();
      let users = [];
      if (Array.isArray(data)) {
        users = data;
      } else if (data?.data && Array.isArray(data.data)) {
        users = data.data;
      } else if (data?.results && Array.isArray(data.results)) {
        users = data.results;
      }
      setSalesUsers(users);
    } catch (err) {
      console.error("Failed to fetch sales users:", err);
      setSalesUsers([]);
    }
  };

  // Fetch latest bill for a customer and auto-populate fields
  const fetchLatestBillForCustomer = async (customerId, currentFormData) => {
    try {
      // Fetch bills for this customer using the API directly
      const API_URL = import.meta.env.VITE_API_URL || "/api";
      const response = await fetch(
        `${API_URL}/bills/entitlements/?customer_master_id=${customerId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch bills");
      }

      const data = await response.json();

      // Handle different response formats
      let billsData = [];
      if (Array.isArray(data)) {
        billsData = data;
      } else if (data && Array.isArray(data.results)) {
        billsData = data.results;
      } else if (data && Array.isArray(data.data)) {
        billsData = data.data;
      } else if (data?.data?.results && Array.isArray(data.data.results)) {
        billsData = data.data.results;
      }

      if (billsData.length === 0) {
        // No previous bills found, nothing to auto-populate
        return;
      }

      // Sort by ID (descending) or activation_date (descending) to get the latest
      const latestBill = billsData.sort((a, b) => {
        // First try to sort by activation_date
        const dateA = a.activation_date || a.active_date || "";
        const dateB = b.activation_date || b.active_date || "";
        if (dateA && dateB) {
          return new Date(dateB) - new Date(dateA);
        }
        // Fallback to ID
        return (b.id || 0) - (a.id || 0);
      })[0];

      if (!latestBill) {
        return;
      }

      // Auto-populate fields from the latest bill
      const fieldsToUpdate = {
        ...currentFormData,
      };

      // NTTN fields (excluding NTTN Capacity and NTTN Uses)
      if (latestBill.nttn_company || latestBill.nttn_com) {
        fieldsToUpdate.nttn_com = latestBill.nttn_company || latestBill.nttn_com || "";
      }

      // Link/SCR ID
      if (latestBill.link_id || latestBill.link_scr_id || latestBill.link_src_id) {
        const linkId = latestBill.link_id || latestBill.link_scr_id || latestBill.link_src_id;
        fieldsToUpdate.link_scr_id = linkId;
        fieldsToUpdate.link_src_id = linkId;
      }

      // Activation date
      if (latestBill.activation_date || latestBill.active_date) {
        fieldsToUpdate.active_date = latestBill.activation_date || latestBill.active_date || "";
      }

      // Only update if we have at least one field to populate
      const hasUpdates = 
        fieldsToUpdate.nttn_com || 
        fieldsToUpdate.link_scr_id || 
        fieldsToUpdate.active_date;

      if (hasUpdates) {
        setFormData((prev) => ({
          ...prev,
          ...fieldsToUpdate,
        }));
      }
    } catch (error) {
      console.error("Error fetching latest bill for customer:", error);
      // Silently fail - don't show error to user as this is just auto-population
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      setListLoading(true);

      // Also check URL params directly to handle race condition
      const urlCustomerTypeParam = searchParams.get("customerType");
      let effectiveCustomerTypeFilter = customerTypeFilter;

      if (urlCustomerTypeParam && !customerTypeFilter) {
        const typeMap = {
          bw: "Bandwidth",
          channel_partner: "Channel",
          soho: "Home/SOHO",
        };
        effectiveCustomerTypeFilter =
          typeMap[urlCustomerTypeParam] || urlCustomerTypeParam;
        console.log(
          "Using URL param for filter in fetch:",
          effectiveCustomerTypeFilter
        );
      }

      const params = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: searchTerm,
      };

      // Server-side filters for entitlements list
      if (monthFilter) {
        params.month = monthFilter;
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      if (effectiveCustomerTypeFilter) {
        const typeMap = {
          Bandwidth: "bw",
          Channel: "channel_partner",
          "Home/SOHO": "soho",
        };
        params.customer_type = typeMap[effectiveCustomerTypeFilter];
      }

      console.log("Fetching bills with params:", params);
      console.log(
        "Effective customer type filter:",
        effectiveCustomerTypeFilter
      );
      const response = await billService.getAllBills(params);
      console.log("Bills API Response:", response);

      // Handle Django REST Framework paginated response
      let billsData = [];
      let totalCountValue = 0;

      if (Array.isArray(response)) {
        billsData = response;
        totalCountValue = response.length;
      } else if (response && Array.isArray(response.results)) {
        // DRF paginated response format: {count, next, previous, results}
        billsData = response.results;
        totalCountValue = response.count || 0;
      } else if (response && Array.isArray(response.data)) {
        billsData = response.data;
        if (response.pagination) {
          totalCountValue =
            response.pagination.totalCount || response.pagination.total || 0;
        } else {
          totalCountValue = response.data.length;
        }
      } else {
        billsData = [];
        console.warn("Unexpected bills response format:", response);
      }

      console.log("Bills data extracted:", billsData);
      console.log(
        "First bill details:",
        billsData.length > 0 ? billsData[0] : "No bills"
      );
      console.log(
        "First bill customer_master:",
        billsData.length > 0
          ? billsData[0].customer_master
          : "No customer_master"
      );

      setBills(billsData);

      setTotalCount(totalCountValue);
      setTotalPages(Math.ceil(totalCountValue / pageSize));
    } catch (err) {
      setError(err.message || "Failed to fetch bills");
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      // Backend uses limit/offset pagination (max limit=100). Fetch all customers by
      // making multiple requests. This ensures the Customer Name dropdown shows all
      // customers when filtered by type (e.g. Bandwidth), matching what Users see in Customers.
      const allCustomers = [];
      const limit = 100; // max allowed by backend
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await customerService.getAllCustomers({
          limit,
          offset,
        });
        const results = Array.isArray(response)
          ? response
          : Array.isArray(response?.results)
            ? response.results
            : Array.isArray(response?.data)
              ? response.data
              : [];
        allCustomers.push(...results);
        hasMore = results.length === limit;
        offset += limit;
      }

      setCustomers(allCustomers);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      setCustomers((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      // Backend uses limit/offset pagination (max limit=100). Fetch all packages
      // by making multiple requests so the Package Name dropdown shows all
      // Bandwidth/Channel Partner/SOHO packages, matching the Packages page.
      const allPackages = [];
      const limit = 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await packageService.getAllPackages({
          pageSize: limit,
          page: Math.floor(offset / limit) + 1,
        });
        const results = Array.isArray(response)
          ? response
          : Array.isArray(response?.results)
            ? response.results
            : Array.isArray(response?.data)
              ? response.data
              : [];
        allPackages.push(...results);
        hasMore = results.length === limit;
        offset += limit;
      }

      setPackages(allPackages);
    } catch (err) {
      console.error("Failed to fetch packages:", err);
      setPackages([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If form customer type filter is changed
    if (name === "form_customer_type_filter") {
      setFormCustomerTypeFilter(value);
      // Set the selected customer type to match the filter
      setSelectedCustomerType(value);
      // Reset customer selection when customer type changes
      setFormData((prev) => ({
        ...prev,
        customer_id: "",
        kam_name: "",
      }));
      return;
    }

    // If customer is selected, find their type and KAM name
    if (name === "customer_id" && value) {
      const selectedCustomer = customers.find((c) => c.id === parseInt(value));

      if (selectedCustomer) {
        // Validate that the selected customer matches the form customer type filter
        if (
          formCustomerTypeFilter &&
          selectedCustomer.customer_type !== formCustomerTypeFilter
        ) {
          console.error("Customer type mismatch!", {
            formCustomerTypeFilter,
            actualCustomerType: selectedCustomer.customer_type,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.customer_name,
          });
          showError(
            `Selected customer type does not match the filter. Please select a ${formatCustomerType(
              formCustomerTypeFilter
            )} customer.`
          );
          // Reset the customer selection
          setFormData((prev) => ({
            ...prev,
            customer_id: "",
            kam_name: "",
          }));
          return;
        }

        setSelectedCustomerType(selectedCustomer.customer_type || "");

        // Get KAM name from salesUsers using kam_id
        const kamId =
          selectedCustomer.kam_id ||
          selectedCustomer.assigned_sales_person ||
          selectedCustomer.kam;

        let kamName = "";
        if (kamId) {
          const kamUser = salesUsers.find((u) => u.id === parseInt(kamId));
          kamName =
            kamUser?.kam_name || kamUser?.name || kamUser?.username || "";
        }

        // Auto-populate fields from customer data
        const updatedFormData = {
          customer_id: value,
          kam_name: kamName,
        };

        // For Channel Partner customers, auto-populate Channel Partner specific fields
        if (selectedCustomer.customer_type === "channel_partner") {
          updatedFormData.total_client = selectedCustomer.total_client || "";
          updatedFormData.total_active_client =
            selectedCustomer.total_active_client || "";
          updatedFormData.previous_total_client =
            selectedCustomer.previous_total_client || "";
          updatedFormData.free_giveaway_client =
            selectedCustomer.free_giveaway_client || "";

          // Also set default Client % for each package row from customer's default_percentage_share
          if (selectedCustomer.default_percentage_share) {
            setChannelPartnerPackageRows((prev) =>
              prev.map((row) => ({
                ...row,
                clientPercent: selectedCustomer.default_percentage_share || "",
              }))
            );
          }
        }

        setFormData((prev) => ({
          ...prev,
          ...updatedFormData,
        }));

        // If creating a new bill (not editing), fetch latest bill for this customer
        // and auto-populate NTTN fields, Link/SCR ID, and activation date
        if (!editingId) {
          fetchLatestBillForCustomer(parseInt(value), updatedFormData);
        }

        return; // Return early since we've already updated formData
      }
    }

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // Calculate totals
      if (name === "iig_qt" || name === "iig_qt_price") {
        newData.igt_qt_total =
          (parseFloat(newData.iig_qt) || 0) *
          (parseFloat(newData.iig_qt_price) || 0);
      }
      if (name === "fna" || name === "fna_price") {
        newData.fna_total =
          (parseFloat(newData.fna) || 0) * (parseFloat(newData.fna_price) || 0);
      }
      if (name === "ggc" || name === "ggc_price") {
        newData.ggc_total =
          (parseFloat(newData.ggc) || 0) * (parseFloat(newData.ggc_price) || 0);
      }
      if (name === "cdn" || name === "cdn_price") {
        newData.cdn_total =
          (parseFloat(newData.cdn) || 0) * (parseFloat(newData.cdn_price) || 0);
      }
      if (name === "bdix" || name === "bdix_price") {
        newData.bdix_total =
          (parseFloat(newData.bdix) || 0) *
          (parseFloat(newData.bdix_price) || 0);
      }
      if (name === "baishan" || name === "baishan_price") {
        newData.baishan_total =
          (parseFloat(newData.baishan) || 0) *
          (parseFloat(newData.baishan_price) || 0);
      }

      return newData;
    });
  };

  // Handle bandwidth package row changes
  const handleBandwidthPackageChange = (rowId, field, value) => {
    setBandwidthPackageRows((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [field]: value };
          // Calculate total when mbps or unitPrice changes
          if (field === "mbps" || field === "unitPrice") {
            const mbps = parseFloat(field === "mbps" ? value : row.mbps) || 0;
            const unitPrice =
              parseFloat(field === "unitPrice" ? value : row.unitPrice) || 0;
            updatedRow.total = (mbps * unitPrice).toFixed(2);
          }
          return updatedRow;
        }
        return row;
      })
    );
  };

  // Add new bandwidth package row
  const addBandwidthPackageRow = () => {
    const newId = Math.max(...bandwidthPackageRows.map((r) => r.id), 0) + 1;
    setBandwidthPackageRows((prev) => [
      ...prev,
      {
        id: newId,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
      },
    ]);
  };

  // Remove bandwidth package row
  const removeBandwidthPackageRow = (rowId) => {
    // Find the row being removed
    const rowToRemove = bandwidthPackageRows.find((row) => row.id === rowId);
    
    // If editing and package has a detailId, prompt for end date
    if (editingId && rowToRemove?.detailId) {
      setPackageToRemove({ rowId, detailId: rowToRemove.detailId, type: 'bandwidth' });
      setEndDateForRemoval("");
      setShowEndDateModal(true);
    } else {
      // Direct removal for new packages or when not editing
      setBandwidthPackageRows((prev) => prev.filter((row) => row.id !== rowId));
    }
  };

  // Handle channel partner package row changes
  const handleChannelPartnerPackageChange = (rowId, field, value) => {
    setChannelPartnerPackageRows((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [field]: value };

          // When package is selected, auto-populate mbps and unitPrice
          if (field === "packageId" && value) {
            const selectedPackage = packages.find(
              (pkg) => pkg.id === parseInt(value)
            );
            if (selectedPackage) {
              // Get active pricing or first available pricing
              const activePricing =
                selectedPackage.active_pricing ||
                (selectedPackage.pricings && selectedPackage.pricings[0]);

              if (activePricing) {
                updatedRow.mbps = activePricing.mbps?.toString() || "";
                updatedRow.unitPrice = activePricing.rate?.toString() || "";

                // Calculate total automatically
                const mbps = parseFloat(activePricing.mbps) || 0;
                const unitPrice = parseFloat(activePricing.rate) || 0;
                updatedRow.total = (mbps * unitPrice).toFixed(2);
              }
            }
          }

          // Calculate total when mbps or unitPrice changes
          if (field === "mbps" || field === "unitPrice") {
            const mbps = parseFloat(field === "mbps" ? value : row.mbps) || 0;
            const unitPrice =
              parseFloat(field === "unitPrice" ? value : row.unitPrice) || 0;
            updatedRow.total = (mbps * unitPrice).toFixed(2);
          }
          // Calculate complementary percentage when kloudPercent or clientPercent changes
          if (field === "kloudPercent") {
            const kloud = parseFloat(value) || 0;
            updatedRow.clientPercent =
              kloud > 0 ? (100 - kloud).toFixed(2) : "";
          }
          if (field === "clientPercent") {
            const client = parseFloat(value) || 0;
            updatedRow.kloudPercent =
              client > 0 ? (100 - client).toFixed(2) : "";
          }
          return updatedRow;
        }
        return row;
      })
    );
  };

  // Add new channel partner package row
  const addChannelPartnerPackageRow = () => {
    const newId =
      Math.max(...channelPartnerPackageRows.map((r) => r.id), 0) + 1;
    setChannelPartnerPackageRows((prev) => [
      ...prev,
      {
        id: newId,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
        kloudPercent: "",
        clientPercent: "",
      },
    ]);
  };

  // Remove channel partner package row
  const removeChannelPartnerPackageRow = (rowId) => {
    // Find the row being removed
    const rowToRemove = channelPartnerPackageRows.find((row) => row.id === rowId);
    
    // If editing and package has a detailId, prompt for end date
    if (editingId && rowToRemove?.detailId) {
      setPackageToRemove({ rowId, detailId: rowToRemove.detailId, type: 'channel_partner' });
      setEndDateForRemoval("");
      setShowEndDateModal(true);
    } else {
      // Direct removal for new packages or when not editing
      setChannelPartnerPackageRows((prev) =>
        prev.filter((row) => row.id !== rowId)
      );
    }
  };

  // Handle SOHO package row changes
  const handleSohoPackageChange = (rowId, field, value) => {
    setSohoPackageRows((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [field]: value };

          // When package is selected, auto-populate mbps and unitPrice
          if (field === "packageId" && value) {
            const selectedPackage = packages.find(
              (pkg) => pkg.id === parseInt(value)
            );
            if (selectedPackage) {
              // Get active pricing or first available pricing
              const activePricing =
                selectedPackage.active_pricing ||
                (selectedPackage.pricings && selectedPackage.pricings[0]);

              if (activePricing) {
                updatedRow.mbps = activePricing.mbps?.toString() || "";
                updatedRow.unitPrice = activePricing.rate?.toString() || "";

                // Calculate total automatically
                const mbps = parseFloat(activePricing.mbps) || 0;
                const unitPrice = parseFloat(activePricing.rate) || 0;
                updatedRow.total = (mbps * unitPrice).toFixed(2);
              }
            }
          }

          // Calculate total when mbps or unitPrice changes
          if (field === "mbps" || field === "unitPrice") {
            const mbps = parseFloat(field === "mbps" ? value : row.mbps) || 0;
            const unitPrice =
              parseFloat(field === "unitPrice" ? value : row.unitPrice) || 0;
            updatedRow.total = (mbps * unitPrice).toFixed(2);
          }
          return updatedRow;
        }
        return row;
      })
    );
  };

  // Add new SOHO package row
  const addSohoPackageRow = () => {
    const newId = Math.max(...sohoPackageRows.map((r) => r.id), 0) + 1;
    setSohoPackageRows((prev) => [
      ...prev,
      {
        id: newId,
        detailId: null,
        packageId: "",
        mbps: "",
        unitPrice: "",
        total: "",
      },
    ]);
  };

  // Remove SOHO package row
  const removeSohoPackageRow = (rowId) => {
    // Find the row being removed
    const rowToRemove = sohoPackageRows.find((row) => row.id === rowId);
    
    // If editing and package has a detailId, prompt for end date
    if (editingId && rowToRemove?.detailId) {
      setPackageToRemove({ rowId, detailId: rowToRemove.detailId, type: 'soho' });
      setEndDateForRemoval("");
      setShowEndDateModal(true);
    } else {
      // Direct removal for new packages or when not editing
      setSohoPackageRows((prev) => prev.filter((row) => row.id !== rowId));
    }
  };

  // Toggle edit mode for a package row
  const toggleEditMode = (rowId) => {
    setEditingRowIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  // Delete a package row completely (remove from database using DELETE method)
  const deletePackageRow = async (rowId, customerType) => {
    try {
      let rowToDelete = null;
      
      // Find the row to delete based on customer type
      if (customerType === "bw") {
        rowToDelete = bandwidthPackageRows.find((row) => row.id === rowId);
      } else if (customerType === "channel_partner") {
        rowToDelete = channelPartnerPackageRows.find((row) => row.id === rowId);
      } else if (customerType === "soho") {
        rowToDelete = sohoPackageRows.find((row) => row.id === rowId);
      }
      
      // Only proceed if row has a detailId (existing package in database)
      if (!rowToDelete?.detailId) {
        // If it's a new row (no detailId), just remove it from the form
        if (customerType === "bw") {
          setBandwidthPackageRows((prev) => prev.filter((row) => row.id !== rowId));
        } else if (customerType === "channel_partner") {
          setChannelPartnerPackageRows((prev) => prev.filter((row) => row.id !== rowId));
        } else if (customerType === "soho") {
          setSohoPackageRows((prev) => prev.filter((row) => row.id !== rowId));
        }
        toggleEditMode(rowId);
        return;
      }
      
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || "/api";
      
      // Make DELETE request to remove the entitlement detail from database
      const response = await fetch(`${API_URL}/bills/entitlement-details/${rowToDelete.detailId}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete package" }));
        throw new Error(errorData.message || "Failed to delete package");
      }
      
      console.log("Package deleted successfully");
      
      // Remove from form state
      if (customerType === "bw") {
        setBandwidthPackageRows((prev) => prev.filter((row) => row.id !== rowId));
      } else if (customerType === "channel_partner") {
        setChannelPartnerPackageRows((prev) => prev.filter((row) => row.id !== rowId));
      } else if (customerType === "soho") {
        setSohoPackageRows((prev) => prev.filter((row) => row.id !== rowId));
      }
      
      // Exit edit mode for this row
      toggleEditMode(rowId);
      
      showSuccess("Package deleted successfully");
      
      // Refresh the bill data to get updated values
      if (editingId) {
        const billResponse = await billService.getBillById(editingId);
        const bill = billResponse.data || billResponse;
        handleEdit(bill);
      }
      
      // Refresh the bill list to show updated values in the table
      fetchBills();
    } catch (error) {
      console.error("Error deleting package:", error);
      showError(error.message || "Failed to delete package");
    } finally {
      setLoading(false);
    }
  };

  // Update an existing package detail
  const updatePackageDetail = async (row, customerType) => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || "/api";

      // Build the update payload with id
      const updatePayload = {
        id: row.detailId,
      };

      // Add fields based on customer type
      if (customerType === "bw") {
        if (row.packageId) updatePayload.package_master_id = parseInt(row.packageId);
        if (row.mbps) updatePayload.mbps = parseFloat(row.mbps);
        if (row.unitPrice) updatePayload.unit_price = parseFloat(row.unitPrice);
        if (row.startDate) updatePayload.start_date = row.startDate;
        updatePayload.type = "bw";
        updatePayload.cust_entitlement_id = editingId;
      } else if (customerType === "channel_partner") {
        if (row.packageId) updatePayload.package_master_id = parseInt(row.packageId);
        if (row.mbps) updatePayload.mbps = parseFloat(row.mbps);
        if (row.unitPrice) updatePayload.unit_price = parseFloat(row.unitPrice);
        if (row.startDate) updatePayload.start_date = row.startDate;
        if (row.clientPercent) updatePayload.custom_mac_percentage_share = parseFloat(row.clientPercent);
        updatePayload.type = "channel_partner";
        updatePayload.cust_entitlement_id = editingId;
      } else if (customerType === "soho") {
        if (row.packageId) {
          const selectedPackage = packages.find((pkg) => pkg.id === parseInt(row.packageId));
          if (selectedPackage?.active_pricing?.id) {
            updatePayload.package_pricing_id = selectedPackage.active_pricing.id;
          }
        }
        if (row.mbps) updatePayload.mbps = parseFloat(row.mbps);
        if (row.unitPrice) updatePayload.unit_price = parseFloat(row.unitPrice);
        updatePayload.type = "soho";
        updatePayload.cust_entitlement_id = editingId;
      }

      console.log("Updating package detail:", updatePayload);

      const response = await fetch(`${API_URL}/bills/add/entitlements/details/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update package" }));
        throw new Error(errorData.message || "Failed to update package");
      }

      const responseData = await response.json();
      console.log("Package updated successfully:", responseData);

      // Exit edit mode for this row
      toggleEditMode(row.id);

      showSuccess("Package updated successfully");
      
      // Refresh the bill data to get updated values
      if (editingId) {
        const billResponse = await billService.getBillById(editingId);
        const bill = billResponse.data || billResponse;
        handleEdit(bill);
      }
      
      // Refresh the bill list to show updated values in the table
      fetchBills();
    } catch (error) {
      console.error("Error updating package:", error);
      showError(error.message || "Failed to update package");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setValidationErrors({});
      setError(null);

      // Validate required fields
      if (!formData.customer_id) {
        showError("Please select a customer");
        setLoading(false);
        return;
      }

      if (!formData.active_date) {
        showError("Please select an activation date");
        setLoading(false);
        return;
      }

      // Prepare entitlement master data
      const entitlementMasterData = {
        customer_master_id: parseInt(formData.customer_id),
        activation_date: formData.active_date,
        nttn_company: formData.nttn_com || "",
        nttn_capacity: formData.nttn_cap || "",
        link_id: formData.link_scr_id || formData.link_src_id || "",
        nttn_uses: formData.nttn_uses || "",
        // Don't send total_bill - let backend calculate from details
        // total_bill is auto-calculated by the backend based on active entitlement details
        type_of_bw: formData.type_of_bw || "",
        type_of_connection: formData.connection_type || "",
        connected_pop: formData.connected_pop || "",
        zone_name: formData.zone_name || "",
        remarks: formData.remarks || "",
      };

      // Prepare entitlement details based on customer type
      let detailsPayload = null;

      console.log("Selected Customer Type:", selectedCustomerType);
      console.log("Checking if bw:", selectedCustomerType === "bw");
      console.log("Bandwidth Package Rows:", bandwidthPackageRows);

      if (selectedCustomerType === "bw") {
        // Bandwidth customer - prepare bandwidth details
        const bandwidthDetails = bandwidthPackageRows
          .filter((row) => row.packageId && row.mbps && row.unitPrice)
          .map((row) => {
            const selectedPackage = packages.find(
              (pkg) => pkg.id === parseInt(row.packageId)
            );
            const packageName =
              selectedPackage?.package_name?.toLowerCase() || "";

            // Map package names to valid bandwidth types: ipt, gcc, cdn, nix, baishan
            let bandwidthType = "ipt"; // default
            if (packageName.includes("gcc")) bandwidthType = "gcc";
            else if (packageName.includes("cdn")) bandwidthType = "cdn";
            else if (packageName.includes("nix")) bandwidthType = "nix";
            else if (packageName.includes("baishan")) bandwidthType = "baishan";
            else if (packageName.includes("ipt")) bandwidthType = "ipt";
            // FNA, IIG, and other types default to 'ipt'

            // Calculate start_date
            const startDate =
              row.startDate ||
              formData.active_date ||
              new Date().toISOString().split("T")[0];
            
            // Calculate end_date as end of month from start_date
            const endOfMonth = getEndOfMonth(startDate);
            const endDate = endOfMonth 
              ? `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`
              : null;

            const detail = {
              type: "bw",
              package_master_id: parseInt(row.packageId),
              mbps: parseFloat(row.mbps),
              unit_price: parseFloat(row.unitPrice),
              start_date: startDate,
              end_date: endDate,
              is_active:
                formData.status === "Active" || formData.status === "active",
              status: (formData.status || "Active").toLowerCase(),
              remarks: `${bandwidthType.toUpperCase()} - ${
                selectedPackage?.package_name || "Package"
              } - ${formData.remarks || ""}`,
            };

            return detail;
          });

        console.log("Bandwidth Details (filtered):", bandwidthDetails);

        if (bandwidthDetails.length > 0) {
          detailsPayload = bandwidthDetails;
        }

        console.log("Bandwidth Details:", bandwidthDetails);
      } else if (selectedCustomerType === "channel_partner") {
        // Channel Partner customer - prepare channel partner details
        const channelPartnerDetails = channelPartnerPackageRows
          .filter((row) => row.packageId && row.mbps && row.unitPrice)
          .map((row) => ({
            type: "channel_partner",
            package_master_id: parseInt(row.packageId),
            mbps: parseFloat(row.mbps),
            unit_price: parseFloat(row.unitPrice),
            custom_mac_percentage_share: parseFloat(row.clientPercent) || 0,
            start_date:
              row.startDate ||
              formData.active_date ||
              new Date().toISOString().split("T")[0],
            end_date: formData.termination_date || null,
            is_active:
              formData.status === "Active" || formData.status === "active",
            status: (formData.status || "Active").toLowerCase(),
            remarks: formData.remarks || "",
          }));

        if (channelPartnerDetails.length > 0) {
          detailsPayload = channelPartnerDetails;
        }

        console.log("Channel Partner Details:", channelPartnerDetails);
      } else if (selectedCustomerType === "soho") {
        // SOHO customer - prepare SOHO details
        const sohoDetails = sohoPackageRows
          .filter((row) => row.packageId)
          .map((row) => {
            const selectedPackage = packages.find(
              (pkg) => pkg.id === parseInt(row.packageId)
            );

            const detail = {
              type: "soho",
              start_date:
                formData.active_date || new Date().toISOString().split("T")[0],
              end_date: formData.termination_date || null,
              is_active:
                formData.status === "Active" || formData.status === "active",
              status: (formData.status || "Active").toLowerCase(),
              remarks: formData.remarks || "",
            };

            // For SOHO customers, try to get package_pricing_id from the package
            // If the package has an active_pricing, use that
            if (selectedPackage?.active_pricing?.id) {
              detail.package_pricing_id = selectedPackage.active_pricing.id;
            } else if (
              selectedPackage?.pricings &&
              selectedPackage.pricings.length > 0
            ) {
              // Use the first active pricing
              const activePricing = selectedPackage.pricings.find(
                (p) => p.is_active
              );
              if (activePricing) {
                detail.package_pricing_id = activePricing.id;
              }
            }

            // Only include mbps and unit_price if package_pricing_id is not set
            // (for backward compatibility or manual entry)
            if (!detail.package_pricing_id && row.mbps && row.unitPrice) {
              detail.mbps = parseFloat(row.mbps);
              detail.unit_price = parseFloat(row.unitPrice);
            }

            return detail;
          });

        if (sohoDetails.length > 0) {
          detailsPayload = sohoDetails;
        }

        console.log("SOHO Details with package_pricing_id:", sohoDetails);
        console.log("SOHO Details payload:", detailsPayload);
      }

      console.log("Entitlement Master Data:", entitlementMasterData);
      console.log("Details Payload:", detailsPayload);

      const API_URL = import.meta.env.VITE_API_URL || "/api";
      let billId;

      if (editingId) {
        // Update existing bill
        showSuccess("Updating bill entry...");
        const response = await billService.updateBill(
          editingId,
          entitlementMasterData
        );
        billId = editingId;
        console.log("Update Bill Response:", response);
      } else {
        // Create new entitlement master
        const response = await billService.createBill(entitlementMasterData);
        console.log("Create Bill Response:", response);
        billId = response.id;
      }

      console.log("Bill ID:", billId);
      console.log("Details payload exists?", !!detailsPayload);

      // Mark removed packages as inactive before processing updates
      if (editingId && removedPackageDetailIds.length > 0) {
        console.log("Marking removed packages as inactive:", removedPackageDetailIds);
        for (const detailId of removedPackageDetailIds) {
          try {
            const endDate = removedPackageEndDates[detailId] || null;
            const updateData = {
              is_active: false,
              status: "inactive",
            };
            
            // Add end_date if provided
            if (endDate) {
              updateData.end_date = endDate;
            }

            const inactiveResponse = await fetch(
              `${API_URL}/bills/entitlement-details/${detailId}/`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
                },
                body: JSON.stringify(updateData),
              }
            );
            
            if (!inactiveResponse.ok) {
              console.error(`Failed to mark detail ${detailId} as inactive`);
            } else {
              console.log(`Successfully marked detail ${detailId} as inactive`);
            }
          } catch (error) {
            console.error(`Error marking detail ${detailId} as inactive:`, error);
          }
        }
        // Clear the removed IDs and end dates after processing
        setRemovedPackageDetailIds([]);
        setRemovedPackageEndDates({});
      }

      // If we have details and got a successful response, create or update the details
      if (billId && detailsPayload) {
        // Ensure detailsPayload is an array
        const detailsArray = Array.isArray(detailsPayload)
          ? detailsPayload
          : [detailsPayload];

        // Get package rows based on customer type to check for detailId
        let packageRows = [];
        if (selectedCustomerType === "bw") {
          packageRows = bandwidthPackageRows.filter((row) => row.packageId);
        } else if (selectedCustomerType === "channel_partner") {
          packageRows = channelPartnerPackageRows.filter(
            (row) => row.packageId
          );
        } else if (selectedCustomerType === "soho") {
          packageRows = sohoPackageRows.filter((row) => row.packageId);
        }

        console.log("Package rows with detail IDs:", packageRows);

        // When editing, only POST new details (no PATCH for existing ones)
        // Existing packages are preserved in the database and can only be removed (marked inactive)
        for (let i = 0; i < detailsArray.length; i++) {
          const detail = detailsArray[i];
          const packageRow = packageRows[i];
          const detailId = packageRow?.detailId;

          // Skip existing packages when editing - they should not be updated via PATCH
          // Only process new packages (those without detailId)
          if (editingId && detailId) {
            console.log(
              `Skipping existing detail ${detailId} - existing packages are not updated when editing`
            );
            continue;
          }

          // Add entitlement_master_id to the detail
          const detailToSend = {
            ...detail,
            cust_entitlement_id: billId,
          };

          // POST new detail
          // When editing, use the add entitlement details endpoint
          // When creating new bill, use the standard entitlement-details endpoint
          const endpoint = editingId 
            ? `${API_URL}/bills/add/entitlements/details/`
            : `${API_URL}/bills/entitlement-details/`;
          
          console.log(
            editingId ? "POSTing new detail (editing mode):" : "POSTing new detail:",
            JSON.stringify(detailToSend, null, 2)
          );
          console.log("Using endpoint:", endpoint);
          
          const detailsResponse = await fetch(
            endpoint,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem(
                  "accessToken"
                )}`,
              },
              body: JSON.stringify(detailToSend),
            }
          );

          console.log("Details Response Status:", detailsResponse.status);

          let detailsData;
          try {
            const responseText = await detailsResponse.text();

            // Try to parse as JSON first
            try {
              detailsData = JSON.parse(responseText);
              console.log("Details Response Data:", detailsData);
            } catch (jsonError) {
              // Response is HTML error page
              console.error(
                "Details Response HTML (first 1000 chars):",
                responseText.substring(0, 1000)
              );

              // Try to extract error message from HTML
              const errorMatch = responseText.match(
                /<pre class="exception_value">(.*?)<\/pre>/s
              );
              if (errorMatch) {
                const errorMsg = errorMatch[1].replace(/<[^>]*>/g, "").trim();
                console.error("Extracted Error:", errorMsg);
                throw new Error("Failed to save bill details: " + errorMsg);
              }
              throw new Error(
                "Failed to save bill details: Server returned HTML error"
              );
            }
          } catch (error) {
            console.error("Error parsing response:", error);
            throw error;
          }

          if (!detailsResponse.ok) {
            console.error("Failed to save details:", detailsData);
            throw new Error(
              "Failed to save bill details: " + JSON.stringify(detailsData)
            );
          }
        }
      } else {
        console.warn("Skipping details operation:", {
          hasBillId: !!billId,
          hasDetailsPayload: !!detailsPayload,
          detailsPayload: detailsPayload,
        });
      }

      showSuccess(
        editingId ? "Bill updated successfully" : "Bill created successfully"
      );

      // If this flow was started with a customerType param (from Entitlement or DataEntry),
      // navigate back to DataEntry with that customer type filter to show the created bill.
      const originCustomerType = searchParams.get("customerType");
      if (!editingId && originCustomerType) {
        resetForm();
        // Refresh the list before navigating to show the new bill
        await fetchBills();
        navigate(`/data-entry?customerType=${originCustomerType}`);
        return;
      }

      resetForm();
      setCurrentPage(1);
      
      // After creating a new bill entry, set customer type filter to "Bandwidth" by default
      if (!editingId) {
        setCustomerTypeFilter("Bandwidth");
      }
      
      // Refresh the bill list to show the new/updated bill
      await fetchBills();
    } catch (err) {
      console.error("Submit error:", err);

      let errorMessage = err.message || "Failed to save bill";

      // Check if we have validation errors from the API
      if (
        err.validationErrors &&
        Object.keys(err.validationErrors).length > 0
      ) {
        setValidationErrors(err.validationErrors);
        errorMessage = "Please fix the validation errors below";
        showError(errorMessage);
      } else {
        setError(errorMessage);
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      type: "",
      nttn_cap: "",
      nttn_com: "",
      link_scr_id: "",
      link_src_id: "",
      nttn_uses: "",
      active_date: "",
      billing_date: "",
      termination_date: "",
      connection_type: "",
      connected_pop: "",
      type_of_bw: "",
      iig_qt: "",
      iig_qt_price: "",
      igt_qt_total: "",
      fna: "",
      fna_price: "",
      fna_total: "",
      ggc: "",
      ggc_price: "",
      ggc_total: "",
      cdn: "",
      cdn_price: "",
      cdn_total: "",
      bdix: "",
      bdix_price: "",
      bdix_total: "",
      baishan: "",
      baishan_price: "",
      baishan_total: "",
      total_bill: "",
      total_received: "",
      total_due: "",
      discount: "",
      remarks: "",
      status: "active",
      total_client: "",
      total_active_client: "",
      previous_total_client: "",
      free_giveaway_client: "",
      last_bill_invoice_date: "",
      zone_name: "",
    });
    setEditingId(null);
    setShowForm(false);
    setFormCustomerTypeFilter("");
    setSelectedCustomerType("");
    setEditingRowIds(new Set());
    setBandwidthPackageRows([
      {
        id: 1,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
      },
    ]);
    setChannelPartnerPackageRows([
      {
        id: 1,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
        kloudPercent: "",
        clientPercent: "",
      },
    ]);
    setSohoPackageRows([
      {
        id: 1,
        detailId: null,
        packageId: "",
        mbps: "",
        unitPrice: "",
        total: "",
      },
    ]);
    setRemovedPackageDetailIds([]);
    setRemovedPackageEndDates({});
  };

  const handleEdit = (bill) => {
    // Ensure customer_id is set correctly - handle both object and ID formats
    const customerIdValue =
      typeof bill.customer === "object" && bill.customer !== null
        ? bill.customer.id
        : bill.customer || bill.customer_id || bill.customer_master_id;

    // Get customer data for populating additional fields
    const customer =
      customers.find((c) => c.id === customerIdValue) || bill.customer_master;

    // Get KAM name from customer or salesUsers
    let kamName = "";
    if (customer) {
      const kamId = customer.kam_id || customer.kam?.id;
      if (kamId) {
        const kamUser = salesUsers.find((u) => u.id === parseInt(kamId));
        kamName = kamUser?.kam_name || kamUser?.name || kamUser?.username || "";
      }
      // Fallback to direct kam_name fields if no kam_id
      if (!kamName) {
        kamName =
          customer.kam_name ||
          customer.sales_user_name ||
          customer.sales_user ||
          "";
      }
    }

    // Map backend field names to form field names
    const billCustomerType =
      bill.customer_type || bill.customer_master?.customer_type;
    setFormData({
      customer_id: customerIdValue,
      type: bill.type || billCustomerType || "",
      nttn_cap: bill.nttn_capacity || bill.nttn_cap || "",
      nttn_com: bill.nttn_company || bill.nttn_com || "",
      link_scr_id: bill.link_id || bill.link_scr_id || "",
      link_src_id: bill.link_id || bill.link_src_id || "",
      nttn_uses: bill.nttn_uses || "",
      active_date: bill.activation_date || bill.active_date || "",
      billing_date: bill.billing_date || "",
      termination_date: bill.termination_date || "",
      connection_type: bill.type_of_connection || bill.connection_type || "",
      connected_pop: bill.connected_pop || "",
      type_of_bw: bill.type_of_bw || "",
      total_bill: bill.total_bill || "",
      total_received: bill.total_received || "",
      total_due: bill.total_due || "",
      discount: bill.discount || "",
      remarks: bill.remarks || "",
      status: bill.status || "Active",
      // Channel Partner specific fields
      kam_name: kamName || "",
      total_client: bill.total_client || customer?.total_client || "",
      total_active_client:
        bill.total_active_client || customer?.total_active_client || "",
      previous_total_client:
        bill.previous_total_client || customer?.previous_total_client || "",
      free_giveaway_client:
        bill.free_giveaway_client || customer?.free_giveaway_client || "",
      last_bill_invoice_date:
        bill.last_bill_invoice_date || customer?.last_bill_invoice_date || "",
      // Legacy fields for compatibility
      iig_qt: bill.iig_qt || "",
      iig_qt_price: bill.iig_qt_price || "",
      igt_qt_total: bill.igt_qt_total || "",
      fna: bill.fna || "",
      fna_price: bill.fna_price || "",
      fna_total: bill.fna_total || "",
      ggc: bill.ggc || "",
      ggc_price: bill.ggc_price || "",
      ggc_total: bill.ggc_total || "",
      cdn: bill.cdn || "",
      cdn_price: bill.cdn_price || "",
      cdn_total: bill.cdn_total || "",
      bdix: bill.bdix || "",
      bdix_price: bill.bdix_price || "",
      bdix_total: bill.bdix_total || "",
      baishan: bill.baishan || "",
      baishan_price: bill.baishan_price || "",
      baishan_total: bill.baishan_total || "",
      zone_name: bill.zone_name || "",
    });

    // Load existing packages when editing - they will be displayed with disabled fields
    // Users can see previous entries and add new packages (new packages will have detailId: null)
    // Existing packages remain in the database unchanged and can only be removed (marked inactive)
    console.log("Loading existing packages for editing - fields will be disabled");
    console.log("Previous package details:", bill.details);
    
    if (
      bill.details &&
      Array.isArray(bill.details) &&
      bill.details.length > 0
    ) {
      // Filter to only include active details for editing
      const activeDetails = bill.details.filter(
        (d) => d.is_active && d.status === "active"
      );
      
      console.log("Active details to load:", activeDetails);
      console.log("Available packages:", packages);

      // Map existing details to package rows
      const packageRows = activeDetails.map((detail, index) => {
        // Try to find package ID using multiple strategies
        let packageId = "";

        // Strategy 1: Use package_master_id directly if available AND it exists in packages
        if (detail.package_master_id) {
          const pkgExists = packages.find(
            (p) => p.id === detail.package_master_id
          );
          if (pkgExists) {
            packageId = detail.package_master_id.toString();
          }
        }

        // Strategy 2: Use package_pricing_id and find the associated package_master_id
        if (!packageId && detail.package_pricing_id) {
          const pricing = packages.find(
            (p) =>
              p.pricings?.some((pr) => pr.id === detail.package_pricing_id) ||
              p.active_pricing?.id === detail.package_pricing_id
          );
          if (pricing) {
            packageId = pricing.id.toString();
          }
        }

        // Strategy 3: Match by package_name
        if (!packageId && detail.package_name) {
          const pkg = packages.find(
            (p) =>
              p.package_name?.toLowerCase() ===
              detail.package_name?.toLowerCase()
          );
          if (pkg) {
            packageId = pkg.id.toString();
          }
        }

        // Strategy 4: Extract package name from remarks
        if (!packageId && detail.remarks) {
          const parts = detail.remarks.split(" - ");
          if (parts.length >= 2) {
            const packageName = parts[1].trim().toUpperCase();
            const pkg = packages.find(
              (p) => p.package_name?.toUpperCase() === packageName
            );
            if (pkg) {
              packageId = pkg.id.toString();
            }
          }
        }

        // Build the row object based on customer type
        const baseRow = {
          id: index + 1,
          detailId: detail.id || null, // This identifies existing packages
          packageId: packageId,
          startDate: detail.start_date || "",
          mbps: detail.mbps?.toString() || "",
          unitPrice: detail.unit_price?.toString() || "",
          total: (
            parseFloat(detail.mbps || 0) * parseFloat(detail.unit_price || 0)
          ).toFixed(2),
        };

        // Add customer-type specific fields
        if (billCustomerType === "channel_partner") {
          baseRow.clientPercent =
            detail.custom_mac_percentage_share?.toString() || "";
          const clientPercent = parseFloat(
            detail.custom_mac_percentage_share || 0
          );
          baseRow.kloudPercent =
            clientPercent > 0 ? (100 - clientPercent).toString() : "";
        }

        return baseRow;
      });

      // Add an empty row at the end for adding new packages
      const emptyRow = billCustomerType === "bw" ? {
        id: packageRows.length + 1,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
      } : billCustomerType === "channel_partner" ? {
        id: packageRows.length + 1,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
        kloudPercent: "",
        clientPercent: "",
      } : {
        id: packageRows.length + 1,
        detailId: null,
        packageId: "",
        mbps: "",
        unitPrice: "",
        total: "",
      };

      const allPackageRows = [...packageRows, emptyRow];

      // Set the appropriate package rows based on customer type
      if (billCustomerType === "bw") {
        setBandwidthPackageRows(allPackageRows);
      } else if (billCustomerType === "channel_partner") {
        setChannelPartnerPackageRows(allPackageRows);
      } else if (billCustomerType === "soho") {
        setSohoPackageRows(allPackageRows);
      }
    } else {
      // No existing packages - start with empty row
      if (billCustomerType === "bw") {
        setBandwidthPackageRows([
          {
            id: 1,
            detailId: null,
            packageId: "",
            startDate: "",
            mbps: "",
            unitPrice: "",
            total: "",
          },
        ]);
      } else if (billCustomerType === "channel_partner") {
        setChannelPartnerPackageRows([
          {
            id: 1,
            detailId: null,
            packageId: "",
            startDate: "",
            mbps: "",
            unitPrice: "",
            total: "",
            kloudPercent: "",
            clientPercent: "",
          },
        ]);
      } else if (billCustomerType === "soho") {
        setSohoPackageRows([
          {
            id: 1,
            detailId: null,
            packageId: "",
            mbps: "",
            unitPrice: "",
            total: "",
          },
        ]);
      }
    }

    // Set the customer type for form visibility
    const customerType = customer?.customer_type || billCustomerType || "";

    setSelectedCustomerType(customerType);
    setFormCustomerTypeFilter(customerType);

    setEditingId(bill.id);
    setShowForm(true);

    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDuplicate = (bill) => {
    // Clear any existing edit mode states - all rows should be editable for new entry
    setEditingRowIds(new Set());
    
    // Ensure customer_id is set correctly - handle both object and ID formats
    const customerIdValue =
      typeof bill.customer === "object" && bill.customer !== null
        ? bill.customer.id
        : bill.customer || bill.customer_id || bill.customer_master_id;

    // Get customer data for populating additional fields
    const customer =
      customers.find((c) => c.id === customerIdValue) || bill.customer_master;

    // Get KAM name from customer or salesUsers
    let kamName = "";
    if (customer) {
      const kamId = customer.kam_id || customer.kam?.id;
      if (kamId) {
        const kamUser = salesUsers.find((u) => u.id === parseInt(kamId));
        kamName = kamUser?.kam_name || kamUser?.name || kamUser?.username || "";
      }
      // Fallback to direct kam_name fields if no kam_id
      if (!kamName) {
        kamName =
          customer.kam_name ||
          customer.sales_user_name ||
          customer.sales_user ||
          "";
      }
    }

    // Map backend field names to form field names
    const billCustomerType =
      bill.customer_type || bill.customer_master?.customer_type;
    setFormData({
      customer_id: customerIdValue,
      type: bill.type || billCustomerType || "",
      nttn_cap: bill.nttn_capacity || bill.nttn_cap || "",
      nttn_com: bill.nttn_company || bill.nttn_com || "",
      link_scr_id: bill.link_id || bill.link_scr_id || "",
      link_src_id: bill.link_id || bill.link_src_id || "",
      nttn_uses: bill.nttn_uses || "",
      active_date: bill.activation_date || bill.active_date || "",
      billing_date: bill.billing_date || "",
      termination_date: bill.termination_date || "",
      connection_type: bill.type_of_connection || bill.connection_type || "",
      connected_pop: bill.connected_pop || "",
      type_of_bw: bill.type_of_bw || "",
      total_bill: bill.total_bill || "",
      total_received: bill.total_received || "",
      total_due: bill.total_due || "",
      discount: bill.discount || "",
      remarks: bill.remarks || "",
      status: bill.status || "Active",
      // Channel Partner specific fields
      kam_name: kamName || "",
      total_client: bill.total_client || customer?.total_client || "",
      total_active_client:
        bill.total_active_client || customer?.total_active_client || "",
      previous_total_client:
        bill.previous_total_client || customer?.previous_total_client || "",
      free_giveaway_client:
        bill.free_giveaway_client || customer?.free_giveaway_client || "",
      last_bill_invoice_date:
        bill.last_bill_invoice_date || customer?.last_bill_invoice_date || "",
      // Legacy fields for compatibility
      iig_qt: bill.iig_qt || "",
      iig_qt_price: bill.iig_qt_price || "",
      igt_qt_total: bill.igt_qt_total || "",
      fna: bill.fna || "",
      fna_price: bill.fna_price || "",
      fna_total: bill.fna_total || "",
      ggc: bill.ggc || "",
      ggc_price: bill.ggc_price || "",
      ggc_total: bill.ggc_total || "",
      cdn: bill.cdn || "",
      cdn_price: bill.cdn_price || "",
      cdn_total: bill.cdn_total || "",
      bdix: bill.bdix || "",
      bdix_price: bill.bdix_price || "",
      bdix_total: bill.bdix_total || "",
      baishan: bill.baishan || "",
      baishan_price: bill.baishan_price || "",
      baishan_total: bill.baishan_total || "",
    });

    // Load existing packages for duplication - all packages will be new (detailId: null)
    // This allows users to modify all fields and create a new bill entry
    console.log("Duplicating bill entry - all packages will be editable as new entries");
    console.log("Previous package details:", bill.details);
    
    if (
      bill.details &&
      Array.isArray(bill.details) &&
      bill.details.length > 0
    ) {
      // Filter to only include active details for duplication
      const activeDetails = bill.details.filter(
        (d) => d.is_active && d.status === "active"
      );
      
      console.log("Active details to duplicate:", activeDetails);
      console.log("Available packages:", packages);

      // Map existing details to package rows - all with detailId: null (new entries)
      const packageRows = activeDetails.map((detail, index) => {
        // Try to find package ID using multiple strategies
        let packageId = "";

        // Strategy 1: Use package_master_id directly if available AND it exists in packages
        if (detail.package_master_id) {
          const pkgExists = packages.find(
            (p) => p.id === detail.package_master_id
          );
          if (pkgExists) {
            packageId = detail.package_master_id.toString();
          }
        }

        // Strategy 2: Use package_pricing_id and find the associated package_master_id
        if (!packageId && detail.package_pricing_id) {
          const pricing = packages.find(
            (p) =>
              p.pricings?.some((pr) => pr.id === detail.package_pricing_id) ||
              p.active_pricing?.id === detail.package_pricing_id
          );
          if (pricing) {
            packageId = pricing.id.toString();
          }
        }

        // Strategy 3: Match by package_name
        if (!packageId && detail.package_name) {
          const pkg = packages.find(
            (p) =>
              p.package_name?.toLowerCase() ===
              detail.package_name?.toLowerCase()
          );
          if (pkg) {
            packageId = pkg.id.toString();
          }
        }

        // Strategy 4: Extract package name from remarks
        if (!packageId && detail.remarks) {
          const parts = detail.remarks.split(" - ");
          if (parts.length >= 2) {
            const packageName = parts[1].trim().toUpperCase();
            const pkg = packages.find(
              (p) => p.package_name?.toUpperCase() === packageName
            );
            if (pkg) {
              packageId = pkg.id.toString();
            }
          }
        }

        // Build the row object based on customer type - all with detailId: null (new entries)
        const baseRow = {
          id: index + 1,
          detailId: null, // Always null for duplication - these are new entries
          packageId: packageId,
          startDate: detail.start_date || "",
          mbps: detail.mbps?.toString() || "",
          unitPrice: detail.unit_price?.toString() || "",
          total: (
            parseFloat(detail.mbps || 0) * parseFloat(detail.unit_price || 0)
          ).toFixed(2),
        };

        // Add customer-type specific fields
        if (billCustomerType === "channel_partner") {
          baseRow.clientPercent =
            detail.custom_mac_percentage_share?.toString() || "";
          const clientPercent = parseFloat(
            detail.custom_mac_percentage_share || 0
          );
          baseRow.kloudPercent =
            clientPercent > 0 ? (100 - clientPercent).toString() : "";
        }

        return baseRow;
      });

      // Add an empty row at the end for adding more packages
      const emptyRow = billCustomerType === "bw" ? {
        id: packageRows.length + 1,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
      } : billCustomerType === "channel_partner" ? {
        id: packageRows.length + 1,
        detailId: null,
        packageId: "",
        startDate: "",
        mbps: "",
        unitPrice: "",
        total: "",
        kloudPercent: "",
        clientPercent: "",
      } : {
        id: packageRows.length + 1,
        detailId: null,
        packageId: "",
        mbps: "",
        unitPrice: "",
        total: "",
      };

      const allPackageRows = [...packageRows, emptyRow];

      // Set the appropriate package rows based on customer type
      if (billCustomerType === "bw") {
        setBandwidthPackageRows(allPackageRows);
      } else if (billCustomerType === "channel_partner") {
        setChannelPartnerPackageRows(allPackageRows);
      } else if (billCustomerType === "soho") {
        setSohoPackageRows(allPackageRows);
      }
    } else {
      // No existing packages - start with empty row
      if (billCustomerType === "bw") {
        setBandwidthPackageRows([
          {
            id: 1,
            detailId: null,
            packageId: "",
            startDate: "",
            mbps: "",
            unitPrice: "",
            total: "",
          },
        ]);
      } else if (billCustomerType === "channel_partner") {
        setChannelPartnerPackageRows([
          {
            id: 1,
            detailId: null,
            packageId: "",
            startDate: "",
            mbps: "",
            unitPrice: "",
            total: "",
            kloudPercent: "",
            clientPercent: "",
          },
        ]);
      } else if (billCustomerType === "soho") {
        setSohoPackageRows([
          {
            id: 1,
            detailId: null,
            packageId: "",
            mbps: "",
            unitPrice: "",
            total: "",
          },
        ]);
      }
    }

    // Set the customer type for form visibility
    const customerType = customer?.customer_type || billCustomerType || "";

    setSelectedCustomerType(customerType);
    setFormCustomerTypeFilter(customerType);

    // Don't set editingId - this is a new entry, not an edit
    setEditingId(null);
    setShowForm(true);

    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteClick = (bill) => {
    setBillToDelete(bill);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!billToDelete || !billToDelete.id) {
      setError("Invalid bill record");
      setShowDeleteModal(false);
      return;
    }

    try {
      setShowDeleteModal(false);
      setBillToDelete(null);

      // Delete the bill
      await billService.deleteBill(billToDelete.id);

      // Show success notification
      showSuccess("Bill record has been deleted successfully");

      // Force refresh by updating the bills state immediately
      setBills((prevBills) =>
        prevBills.filter((bill) => bill.id !== billToDelete.id)
      );

      // Update total count
      setTotalCount((prevCount) => prevCount - 1);

      // Recalculate total pages
      const newTotalPages = Math.ceil((totalCount - 1) / pageSize);
      setTotalPages(newTotalPages);

      // If current page is now beyond total pages, go to last page
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      } else {
        // Refresh the current page data
        fetchBills();
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message || "Failed to delete bill");
      // Refresh on error to ensure data consistency
      fetchBills();
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setBillToDelete(null);
  };

  // Handle end date modal confirmation
  const handleEndDateConfirm = () => {
    if (!endDateForRemoval) {
      showError("Please enter an end date");
      return;
    }

    if (!packageToRemove) return;

    const { rowId, detailId, type } = packageToRemove;

    // Track the removed package detail ID
    setRemovedPackageDetailIds((prev) => [...prev, detailId]);
    
    // Store the end date for this detail ID
    setRemovedPackageEndDates((prev) => ({
      ...prev,
      [detailId]: endDateForRemoval,
    }));

    // Remove the package row based on type
    if (type === 'bandwidth') {
      setBandwidthPackageRows((prev) => prev.filter((row) => row.id !== rowId));
    } else if (type === 'channel_partner') {
      setChannelPartnerPackageRows((prev) =>
        prev.filter((row) => row.id !== rowId)
      );
    } else if (type === 'soho') {
      setSohoPackageRows((prev) => prev.filter((row) => row.id !== rowId));
    }

    // Close modal and reset state
    setShowEndDateModal(false);
    setPackageToRemove(null);
    setEndDateForRemoval("");
  };

  // Handle end date modal cancellation
  const handleEndDateCancel = () => {
    setShowEndDateModal(false);
    setPackageToRemove(null);
    setEndDateForRemoval("");
  };

  // Helper function to get end of month from a start date
  const getEndOfMonth = (startDate) => {
    if (!startDate) return null;
    const date = new Date(startDate);
    if (isNaN(date.getTime())) return null;
    // Get the last day of the month
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    return lastDay;
  };

  // Helper function to extract service totals from details array
  const getServiceTotals = (bill) => {
    const services = {
      iig_qt: 0,
      iig_qt_price: 0,
      fna: 0,
      fna_price: 0,
      ggc: 0,
      ggc_price: 0,
      gcc: 0,
      gcc_price: 0,
      cdn: 0,
      cdn_price: 0,
      bdix: 0,
      bdix_price: 0,
      nix: 0,
      nix_price: 0,
      baishan: 0,
      baishan_price: 0,
      ipt: 0,
      ipt_price: 0,
    };

    // Check if services are directly on bill object (legacy format)
    if (
      bill.iig_qt_price ||
      bill.fna_price ||
      bill.ggc_price ||
      bill.cdn_price ||
      bill.bdix_price ||
      bill.baishan_price
    ) {
      return {
        iig_qt: bill.iig_qt || 0,
        iig_qt_price: bill.iig_qt_price || 0,
        fna: bill.fna || 0,
        fna_price: bill.fna_price || 0,
        ggc: bill.ggc || 0,
        ggc_price: bill.ggc_price || 0,
        gcc: bill.gcc || 0,
        gcc_price: bill.gcc_price || 0,
        cdn: bill.cdn || 0,
        cdn_price: bill.cdn_price || 0,
        bdix: bill.bdix || 0,
        bdix_price: bill.bdix_price || 0,
        nix: bill.nix || 0,
        nix_price: bill.nix_price || 0,
        baishan: bill.baishan || 0,
        baishan_price: bill.baishan_price || 0,
        ipt: bill.ipt || 0,
        ipt_price: bill.ipt_price || 0,
      };
    }

    // Extract from details array (new format)
    if (bill.details && Array.isArray(bill.details)) {
      bill.details.forEach((detail) => {
        const bandwidthType = (detail.bandwidth_type || "").toLowerCase();
        const packageName = (
          detail.package_name ||
          detail.package ||
          ""
        ).toLowerCase();
        const mbps = parseFloat(detail.mbps || detail.bandwidth || 0);
        const total = parseFloat(detail.total || 0);

        // Map bandwidth_type or package_name to service categories
        if (
          bandwidthType === "ipt" ||
          packageName.includes("ipt") ||
          packageName.includes("iig")
        ) {
          services.iig_qt += mbps;
          services.iig_qt_price += total;
          services.ipt += mbps;
          services.ipt_price += total;
        } else if (
          bandwidthType === "gcc" ||
          packageName.includes("gcc") ||
          packageName.includes("ggc") ||
          packageName.includes("fna")
        ) {
          if (packageName.includes("fna")) {
            services.fna += mbps;
            services.fna_price += total;
          } else {
            services.ggc += mbps;
            services.ggc_price += total;
            services.gcc += mbps;
            services.gcc_price += total;
          }
        } else if (bandwidthType === "cdn" || packageName.includes("cdn")) {
          services.cdn += mbps;
          services.cdn_price += total;
        } else if (
          bandwidthType === "nix" ||
          packageName.includes("bdix") ||
          packageName.includes("nix")
        ) {
          services.bdix += mbps;
          services.bdix_price += total;
          services.nix += mbps;
          services.nix_price += total;
        } else if (
          bandwidthType === "baishan" ||
          packageName.includes("baishan")
        ) {
          services.baishan += mbps;
          services.baishan_price += total;
        }
      });
    }

    return services;
  };

  const handleViewClick = (bill) => {
    console.log("View button clicked - Full bill object:", bill);
    console.log("Bill fields available:", Object.keys(bill));
    console.log("Bill details:", bill.details);
    console.log("Customer master data:", bill.customer_master);
    console.log("Total paid:", bill.customer_master?.total_paid);
    console.log("Total due:", bill.customer_master?.total_due);
    console.log("Service totals:", getServiceTotals(bill));
    setViewingBill(bill);
    setShowViewModal(true);
  };

  const handleViewClose = () => {
    setShowViewModal(false);
    setViewingBill(null);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const API_URL = import.meta.env.VITE_API_URL || "/api";
      const response = await fetch(`${API_URL}/bills/import/`, {
        method: "POST",
        body: formDataToSend,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      // Check content type to handle HTML error responses
      const contentType = response.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        // If response is HTML (error page), extract error message
        const text = await response.text();
        if (!response.ok) {
          throw new Error(
            `Import failed: ${response.status} ${response.statusText}`
          );
        }
        data = {};
      }

      if (!response.ok) {
        // Extract detailed error message
        let errorMessage = "Import failed";

        if (data.error) {
          errorMessage = data.error;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.details) {
          errorMessage = data.details;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (typeof data === "object" && Object.keys(data).length > 0) {
          // Try to extract first error message from object
          const firstKey = Object.keys(data)[0];
          if (firstKey && Array.isArray(data[firstKey])) {
            errorMessage = data[firstKey][0];
          } else if (firstKey && typeof data[firstKey] === "string") {
            errorMessage = data[firstKey];
          }
        }

        throw new Error(errorMessage);
      }

      // Handle success response
      const customersSuccess =
        data.data?.customers?.success || data.customers?.success || 0;
      const billsSuccess =
        data.data?.bills?.success || data.bills?.success || 0;
      const customersFailed =
        data.data?.customers?.failed || data.customers?.failed || 0;
      const billsFailed = data.data?.bills?.failed || data.bills?.failed || 0;

      showSuccess(
        `Import successful! ${customersSuccess} customers and ${billsSuccess} bills imported.${
          customersFailed > 0 || billsFailed > 0
            ? ` (${customersFailed} customers and ${billsFailed} bills failed)`
            : ""
        }`
      );

      if (data.errors && data.errors.length > 0) {
        console.error("Import errors:", data.errors);
      }

      setCurrentPage(1);
      fetchBills();
      fetchCustomers();
    } catch (err) {
      console.error("Import error:", err);
      showError(err.message || "Failed to import data");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || "/api";

      // Fetch all bills data
      const response = await fetch(`${API_URL}/bills/?page_size=10000`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch bills data");
      }

      const data = await response.json();
      const billsData = data.results || data.data || [];

      // Define CSV headers matching backend fields
      const headers = [
        "id",
        "customer",
        "customer_details",
        "nttn_cap",
        "nttn_com",
        "active_date",
        "billing_date",
        "termination_date",
        "iig_qt",
        "iig_qt_price",
        "fna",
        "fna_price",
        "ggc",
        "ggc_price",
        "cdn",
        "cdn_price",
        "bdix",
        "bdix_price",
        "baishan",
        "baishan_price",
        "total_bill",
        "total_received",
        "total_due",
        "discount",
        "status",
        "remarks",
        "created_at",
        "updated_at",
      ];

      // Convert bills data to CSV rows
      const rows = billsData.map((bill) => [
        bill.id || "",
        bill.customer || "",
        bill.customer_details || "",
        bill.nttn_cap || "",
        bill.nttn_com || "",
        bill.active_date || "",
        bill.billing_date || "",
        bill.termination_date || "",
        bill.iig_qt || "",
        bill.iig_qt_price || "",
        bill.fna || "",
        bill.fna_price || "",
        bill.ggc || "",
        bill.ggc_price || "",
        bill.cdn || "",
        bill.cdn_price || "",
        bill.bdix || "",
        bill.bdix_price || "",
        bill.baishan || "",
        bill.baishan_price || "",
        bill.total_bill || "",
        bill.total_received || "",
        bill.total_due || "",
        bill.discount || "",
        bill.status || "",
        bill.remarks || "",
        bill.created_at || "",
        bill.updated_at || "",
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              // Escape quotes and wrap in quotes if contains comma or quotes
              const cellStr = String(cell);
              if (
                cellStr.includes(",") ||
                cellStr.includes('"') ||
                cellStr.includes("\n")
              ) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            })
            .join(",")
        ),
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bills.csv";
      a.click();
      window.URL.revokeObjectURL(url);

      setSuccess("Bills exported successfully as CSV");
    } catch (err) {
      setError(err.message || "Failed to export bills");
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || `Customer #${customerId}`;
  };

  const getCustomerDetails = (bill) => {
    console.log("getCustomerDetails - bill:", bill.id, {
      customer_details: bill.customer_details,
      customer_name: bill.customer_name,
      customer_master: bill.customer_master,
      customer_master_id: bill.customer_master_id,
    });

    // If customer_details is already populated from backend, use it
    if (bill.customer_details) {
      return bill.customer_details;
    }

    // Check if customer_master object exists (from backend nested serializer)
    if (bill.customer_master) {
      const customer = bill.customer_master;

      // Get KAM name - first check if kam_id exists and find from salesUsers
      let kamName = "-";
      const kamId = customer.kam_id || customer.kam;
      if (kamId) {
        const kamUser = salesUsers.find((u) => u.id === parseInt(kamId));
        kamName =
          kamUser?.kam_name || kamUser?.name || kamUser?.username || "-";
      }

      // Fallback to direct kam_name fields if no kam_id
      if (kamName === "-") {
        kamName =
          customer.kam_name ||
          customer.sales_user_name ||
          customer.sales_user ||
          "-";
      }

      console.log(
        "Using customer_master - KAM:",
        kamName,
        "from kam_id:",
        kamId,
        "salesUsers:",
        salesUsers.length
      );

      return {
        name: customer.customer_name || customer.name,
        company_name: customer.company_name,
        email: customer.email || "-",
        phone: customer.phone || "-",
        address: customer.address || "-",
        kam_name: kamName,
      };
    }

    // Check if customer_name is directly on bill (from backend serializer)
    if (bill.customer_name) {
      // Find full customer details from customers array
      const customerId = bill.customer_master_id;
      const customer = customers.find((c) => c.id === customerId);

      console.log(
        "Found customer by customer_master_id:",
        customerId,
        customer
      );

      // Try different field names for KAM
      const kamName =
        customer?.kam_name ||
        customer?.kam ||
        customer?.sales_user_name ||
        customer?.sales_user ||
        "-";

      console.log("KAM name extracted:", kamName, "from customer:", {
        kam_name: customer?.kam_name,
        kam: customer?.kam,
        sales_user_name: customer?.sales_user_name,
        sales_user: customer?.sales_user,
      });

      return {
        name: bill.customer_name,
        company_name: customer?.company_name || bill.customer_name,
        email: customer?.email || "-",
        phone: customer?.phone || "-",
        address: customer?.address || "-",
        kam_name: kamName,
      };
    }

    // Fallback: find customer from customers array using customer_id
    const customerId =
      bill.customer || bill.customer_id || bill.customer_master_id;
    if (customerId) {
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        return {
          id: customer.id,
          name: customer.customer_name || customer.name,
          company_name: customer.company_name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          kam_name: customer.kam_name || customer.kam || "-",
        };
      }
    }

    // Return empty object if no customer found
    return {
      name: "N/A",
      company_name: "-",
      email: "-",
      phone: "-",
      address: "-",
      kam_name: "-",
    };
  };

  const renderCustomerNameWithCompany = (bill) => {
    const d = getCustomerDetails(bill);
    const name = d.name && d.name !== "N/A" ? d.name : "-";
    const rawCo = d.company_name;
    const company =
      rawCo != null &&
      String(rawCo).trim() &&
      String(rawCo).trim() !== "-"
        ? String(rawCo).trim()
        : "";
    const showCompany = Boolean(company && company !== name);
    const title = showCompany ? `${name} — ${company}` : name;
    return (
      <div className="flex flex-col gap-0.5 min-w-0 max-w-[16rem]" title={title}>
        <span className="leading-tight">{name}</span>
        {showCompany ? (
          <span
            className={`text-xs leading-tight ${
              isDark ? "text-silver-500" : "text-gray-500"
            }`}
          >
            {company}
          </span>
        ) : null}
      </div>
    );
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const getFieldClassName = (fieldName) => {
    const hasError = validationErrors[fieldName];
    return `w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
      hasError
        ? isDark
          ? "bg-dark-700 border-red-500 text-white focus:border-red-500"
          : "bg-white border-red-500 text-dark-900 focus:border-red-500"
        : isDark
        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
    } focus:outline-none`;
  };

  const renderFieldError = (fieldName) => {
    if (validationErrors[fieldName]) {
      return (
        <p className="text-red-500 text-xs mt-1">
          {validationErrors[fieldName]}
        </p>
      );
    }
    return null;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Show full page loading only on initial page load, not during searches
  if (loading && bills.length === 0 && !searchTerm && !customerTypeFilter)
    return <LoadingSpinner />;

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden transition-colors duration-300 ${
        isDark ? "bg-dark-950" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <div
        className={`sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 ${
          isDark
            ? "bg-dark-900/80 border-dark-700"
            : "bg-white/80 border-gold-100"
        }`}
      >
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className={`text-3xl sm:text-4xl font-serif font-bold ${
                  isDark ? "text-white" : "text-dark-900"
                }`}
              >
                Bill Records
              </h1>
              <p
                className={`mt-2 ${
                  isDark ? "text-silver-400" : "text-gray-600"
                }`}
              >
                Manage billing records with complete customer information
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* {hasPermission("bills:import") && (
                <label className="relative cursor-pointer px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 shadow-lg">
                  <FileUp size={20} />
                  <span>Import</span>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              )}
              {hasPermission("bills:export") && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 shadow-lg"
                >
                  <FileDown size={20} />
                  <span>Export CSV</span>
                </motion.button>
              )} */}
              {hasPermission("entitlements:create") && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 shadow-lg"
                >
                  <Plus size={20} />
                  <span>New Bill</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <ErrorAlert message={error} onClose={() => setError(null)} />
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 p-4 rounded-lg ${
                isDark
                  ? "bg-green-900/30 border border-green-700 text-green-400"
                  : "bg-green-100 border border-green-300 text-green-700"
              }`}
            >
              {success}
            </motion.div>
          )}

          {/* Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`mb-8 rounded-2xl transition-all duration-300 overflow-visible ${
                    isDark
                      ? "bg-dark-800 border border-dark-700"
                      : "bg-white border border-gold-100"
                }`}
              >
                <div
                  className={`sticky top-0 z-10 p-4 sm:p-6 pb-3 sm:pb-4 ${
                    isDark ? "bg-dark-800" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h2
                      className={`text-xl sm:text-2xl font-serif font-bold ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      {editingId ? "Edit Bill" : "New Bill Record"}
                    </h2>
                    <button
                      onClick={resetForm}
                      className="p-2 rounded-lg transition-all bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 shadow-md"
                    >
                      <X size={20} className="sm:w-6 sm:h-6" />
                    </button>
                  </div>
                </div>

                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-4 sm:space-y-6"
                  >
                    {/* Entitlement Information */}
                    <div
                      className={`rounded-xl border overflow-visible transition-all duration-300 ${
                        isDark
                          ? "bg-dark-800/50 border-dark-600"
                          : "bg-white border-gray-200 shadow-sm"
                      }`}
                    >
                      <div
                        className={`flex items-center gap-3 px-5 py-4 ${
                          isDark
                            ? "bg-dark-700/60 border-b border-dark-600"
                            : "bg-gray-50/80 border-b border-gray-200"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                            isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          <FileText size={22} strokeWidth={2} />
                        </div>
                        <div>
                          <h3
                            className={`text-lg font-semibold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            Entitlement Information
                          </h3>
                          <p
                            className={`text-xs mt-0.5 ${
                              isDark ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            Select customer type and customer for this bill
                          </p>
                        </div>
                      </div>
                      <div className="p-5 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Customer Type */}
                          <div className="space-y-2">
                            <label
                              className={`flex items-center gap-2 text-sm font-medium ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              <Users size={16} className="opacity-70" />
                              Customer Type{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            {editingId !== null ? (
                              <input
                                type="text"
                                value={
                                  selectedCustomerType
                                    ? formatCustomerType(selectedCustomerType)
                                    : ""
                                }
                                readOnly
                                disabled
                                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 cursor-not-allowed opacity-75 ${
                                  isDark
                                    ? "bg-dark-700 border-dark-600 text-white"
                                    : "bg-gray-100 border-gray-200 text-gray-900"
                                } focus:outline-none`}
                              />
                            ) : (
                              <select
                                name="form_customer_type_filter"
                                value={formCustomerTypeFilter}
                                onChange={handleInputChange}
                                required
                                style={{
                                  color: isDark ? "#ffffff" : "#1a1a1a",
                                  backgroundColor: isDark ? "#1f2937" : "#ffffff",
                                }}
                                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 ${
                                  isDark
                                    ? "bg-dark-700 border-dark-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                                    : "bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                } focus:outline-none`}
                              >
                                <option value="">Select Customer Type</option>
                                <option value="bw">Bandwidth</option>
                                <option value="soho">Home/SOHO</option>
                              </select>
                            )}
                          </div>

                          {/* Customer Name */}
                          <div className="space-y-2">
                            <label
                              className={`flex items-center gap-2 text-sm font-medium ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              <UserCircle size={16} className="opacity-70" />
                              Customer Name
                              {!editingId && formCustomerTypeFilter && (
                                <span
                                  className={`ml-1 text-xs font-normal ${
                                    isDark ? "text-blue-400" : "text-blue-600"
                                  }`}
                                >
                                  ({filteredCustomers.length} available)
                                </span>
                              )}
                            </label>
                            {editingId !== null ? (
                              <input
                                type="text"
                                value={
                                  formData.customer_id && Array.isArray(customers)
                                    ? (() => {
                                        const customer = customers.find(
                                          (c) => c.id === parseInt(formData.customer_id)
                                        );
                                        return customer
                                          ? customer.customer_name || customer.name || ""
                                          : "";
                                      })()
                                    : ""
                                }
                                readOnly
                                disabled
                                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 cursor-not-allowed opacity-75 ${
                                  isDark
                                    ? "bg-dark-700 border-dark-600 text-white"
                                    : "bg-gray-100 border-gray-200 text-gray-900"
                                } focus:outline-none`}
                              />
                            ) : (
                              <SearchableSelect
                                options={filteredCustomers.map((customer) => ({
                                  value: customer.id,
                                  label:
                                    customer.customer_name ||
                                    customer.name ||
                                    `Customer ${customer.id}`,
                                }))}
                                value={
                                  formData.customer_id ? parseInt(formData.customer_id) : ""
                                }
                                onChange={(val) => {
                                  const eventLike = {
                                    target: { name: "customer_id", value: val },
                                  };
                                  handleInputChange(eventLike);
                                }}
                                placeholder={
                                  customersLoading
                                    ? "Loading customers..."
                                    : !formCustomerTypeFilter
                                    ? "Select customer type first"
                                    : filteredCustomers.length === 0
                                    ? "No customers available"
                                    : "Search or select customer"
                                }
                                disabled={
                                  !formCustomerTypeFilter ||
                                  customersLoading ||
                                  filteredCustomers.length === 0
                                }
                                isDark={isDark}
                              />
                            )}
                            {validationErrors.customer_id && (
                              <p className="text-red-500 text-xs mt-1">
                                {validationErrors.customer_id}
                              </p>
                            )}
                          </div>

                          {/* Company Name */}
                          {formData.customer_id && (
                            <div className="space-y-2">
                              <label
                                className={`flex items-center gap-2 text-sm font-medium ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                <Building2 size={16} className="opacity-70" />
                                Company Name
                              </label>
                              <input
                                type="text"
                                value={
                                  Array.isArray(customers)
                                    ? (() => {
                                        const customer = customers.find(
                                          (c) => c.id === parseInt(formData.customer_id)
                                        );
                                        return customer ? customer.company_name || "" : "";
                                      })()
                                    : ""
                                }
                                readOnly
                                disabled
                                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 cursor-not-allowed opacity-75 ${
                                  isDark
                                    ? "bg-dark-700 border-dark-600 text-white"
                                    : "bg-gray-100 border-gray-200 text-gray-900"
                                } focus:outline-none`}
                              />
                            </div>
                          )}

                          {/* KAM Name */}
                          {formData.customer_id && (
                            <div className="space-y-2">
                              <label
                                className={`flex items-center gap-2 text-sm font-medium ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                <UserCircle size={16} className="opacity-70" />
                                KAM Name
                              </label>
                              <input
                                type="text"
                                name="kam_name"
                                value={formData.kam_name}
                                readOnly
                                disabled
                                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 cursor-not-allowed opacity-75 ${
                                  isDark
                                    ? "bg-dark-700 border-dark-600 text-white"
                                    : "bg-gray-100 border-gray-200 text-gray-900"
                                } focus:outline-none`}
                              />
                            </div>
                          )}

                          {/* Zone Name */}
                          {formData.customer_id && (
                            <div className="space-y-2 md:col-span-2">
                              <label
                                className={`flex items-center gap-2 text-sm font-medium ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                <MapPin size={16} className="opacity-70" />
                                Zone Name
                              </label>
                              <input
                                type="text"
                                name="zone_name"
                                value={formData.zone_name || ""}
                                onChange={handleInputChange}
                                disabled={
                                  (editingId ? selectedCustomerType : formCustomerTypeFilter) !== "bw"
                                }
                                placeholder={
                                  (editingId ? selectedCustomerType : formCustomerTypeFilter) === "bw"
                                    ? "Optional — enter zone if applicable"
                                    : "Available for Bandwidth customer type only"
                                }
                                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 ${
                                  (editingId ? selectedCustomerType : formCustomerTypeFilter) !== "bw"
                                    ? `cursor-not-allowed opacity-75 ${
                                        isDark
                                          ? "bg-dark-700 border-dark-600 text-white"
                                          : "bg-gray-100 border-gray-200 text-gray-900"
                                      }`
                                    : isDark
                                    ? "bg-dark-700 border-dark-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                                    : "bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                } focus:outline-none`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bandwidth Specific Fields */}
                    {selectedCustomerType === "bw" && (
                      <div
                        className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                          isDark
                            ? "bg-dark-800/50 border-dark-600"
                            : "bg-white border-gray-200 shadow-sm"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-3 px-5 py-4 ${
                            isDark
                              ? "bg-dark-700/60 border-b border-dark-600"
                              : "bg-gray-50/80 border-b border-gray-200"
                          }`}
                        >
                          <div
                            className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                              isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                            }`}
                          >
                            <Wifi size={22} strokeWidth={2} />
                          </div>
                          <div>
                            <h3
                              className={`text-lg font-semibold ${
                                isDark ? "text-white" : "text-gray-900"
                              }`}
                            >
                              Bandwidth Information
                            </h3>
                            <p
                              className={`text-xs mt-0.5 ${
                                isDark ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              Network and activation details for this bill
                            </p>
                          </div>
                        </div>
                        <div className="p-5 sm:p-6 space-y-6">
                          {/* Network details row */}
                          <div>
                            <p
                              className={`text-xs font-medium uppercase tracking-wider mb-3 ${
                                isDark ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              Network details
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <label
                                  className={`flex items-center gap-2 text-sm font-medium ${
                                    isDark ? "text-silver-300" : "text-gray-700"
                                  }`}
                                >
                                  <Link2 size={14} className="opacity-70" />
                                  NTTN
                                </label>
                                <input
                                  type="text"
                                  name="nttn_com"
                                  value={formData.nttn_com}
                                  onChange={handleInputChange}
                                  placeholder="NTTN company"
                                  className={`${getFieldClassName("nttn_com")} px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                                />
                                {renderFieldError("nttn_com")}
                              </div>
                              <div className="space-y-2">
                                <label
                                  className={`flex items-center gap-2 text-sm font-medium ${
                                    isDark ? "text-silver-300" : "text-gray-700"
                                  }`}
                                >
                                  <Link2 size={14} className="opacity-70" />
                                  Link/SCR ID
                                </label>
                                <input
                                  type="text"
                                  name="link_scr_id"
                                  value={formData.link_scr_id}
                                  onChange={handleInputChange}
                                  placeholder="Link or SCR identifier"
                                  className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 ${
                                    isDark
                                      ? "bg-dark-700 border-dark-600 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                                      : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                  } focus:outline-none`}
                                />
                              </div>
                              <div className="space-y-2">
                                <label
                                  className={`flex items-center gap-2 text-sm font-medium ${
                                    isDark ? "text-silver-300" : "text-gray-700"
                                  }`}
                                >
                                  <Activity size={14} className="opacity-70" />
                                  NTTN Capacity
                                </label>
                                <input
                                  type="text"
                                  name="nttn_cap"
                                  value={formData.nttn_cap}
                                  readOnly
                                  disabled
                                  className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 cursor-not-allowed ${
                                    isDark
                                      ? "bg-dark-800 border-dark-600 text-gray-400"
                                      : "bg-gray-100 border-gray-200 text-gray-600"
                                  } focus:outline-none`}
                                />
                                {renderFieldError("nttn_cap")}
                              </div>
                              <div className="space-y-2">
                                <label
                                  className={`flex items-center gap-2 text-sm font-medium ${
                                    isDark ? "text-silver-300" : "text-gray-700"
                                  }`}
                                >
                                  <Activity size={14} className="opacity-70" />
                                  NTTN USES
                                </label>
                                <input
                                  type="text"
                                  name="nttn_uses"
                                  value={formData.nttn_uses}
                                  onChange={handleInputChange}
                                  placeholder="NTTN uses"
                                  className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 ${
                                    isDark
                                      ? "bg-dark-700 border-dark-600 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                                      : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                  } focus:outline-none`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Activation & status row */}
                          <div>
                            <p
                              className={`text-xs font-medium uppercase tracking-wider mb-3 ${
                                isDark ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              Activation & status
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label
                                  className={`flex items-center gap-2 text-sm font-medium ${
                                    isDark ? "text-silver-300" : "text-gray-700"
                                  }`}
                                >
                                  <Calendar size={14} className="opacity-70" />
                                  Activation Date{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                  selected={
                                    formData.active_date
                                      ? new Date(formData.active_date + "T00:00:00")
                                      : null
                                  }
                                  onChange={(date) => {
                                    const event = {
                                      target: {
                                        name: "active_date",
                                        value: date
                                          ? `${date.getFullYear()}-${String(
                                              date.getMonth() + 1
                                            ).padStart(2, "0")}-${String(
                                              date.getDate()
                                            ).padStart(2, "0")}`
                                          : "",
                                      },
                                    };
                                    handleInputChange(event);
                                  }}
                                  dateFormat="yyyy-MM-dd"
                                  placeholderText="Select activation date"
                                  className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 ${
                                    isDark
                                      ? "bg-dark-700 border-dark-600 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                                      : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                  } focus:outline-none`}
                                  wrapperClassName="w-full"
                                  showYearDropdown
                                  showMonthDropdown
                                  dropdownMode="select"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <label
                                  className={`flex items-center gap-2 text-sm font-medium ${
                                    isDark ? "text-silver-300" : "text-gray-700"
                                  }`}
                                >
                                  <Activity size={14} className="opacity-70" />
                                  Status
                                </label>
                                <select
                                  name="status"
                                  value={formData.status}
                                  onChange={handleInputChange}
                                  style={{
                                    color: isDark ? "#ffffff" : "#1a1a1a",
                                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                                  }}
                                  className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-300 ${
                                    isDark
                                      ? "bg-dark-700 border-dark-600 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                                      : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                  } focus:outline-none`}
                                >
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bandwidth Package Details - outside card, same section flow */}
                    {selectedCustomerType === "bw" && (
                      <div className="mb-6">
                        <label
                          className={`block text-sm font-medium mb-3 ${
                            isDark ? "text-silver-300" : "text-gray-700"
                          }`}
                        >
                          Package Details
                        </label>
                        <div className="space-y-3">
                            {bandwidthPackageRows.map((row, index) => {
                              const isEditing = editingRowIds.has(row.id);
                              const isDisabled = editingId && row.detailId && !isEditing;
                              return (
                              <div
                                key={row.id}
                                className="flex flex-wrap items-center gap-3"
                              >
                                {/* Start Date */}
                                <div className="flex items-center gap-2">
                                  <DatePicker
                                    selected={
                                      row.startDate
                                        ? new Date(row.startDate + "T00:00:00")
                                        : null
                                    }
                                    onChange={(date) => {
                                      if (isDisabled) return;
                                      const value = date
                                        ? `${date.getFullYear()}-${String(
                                            date.getMonth() + 1
                                          ).padStart(2, "0")}-${String(
                                            date.getDate()
                                          ).padStart(2, "0")}`
                                        : "";
                                      handleBandwidthPackageChange(
                                        row.id,
                                        "startDate",
                                        value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    dateFormat="yyyy-MM-dd"
                                    placeholderText="Start date"
                                    className={`w-32 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                  />
                                </div>

                                {/* Package Name Dropdown */}
                                <div className="flex-1 min-w-[150px]">
                                  <select
                                    value={row.packageId}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleBandwidthPackageChange(
                                        row.id,
                                        "packageId",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    style={{
                                      color: isDark ? "#ffffff" : "#1a1a1a",
                                      backgroundColor: isDisabled
                                        ? (isDark ? "#374151" : "#f3f4f6")
                                        : (isDark ? "#1f2937" : "#ffffff"),
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  >
                                    <option value="">Package Name</option>
                                    {packages
                                      .filter(
                                        (pkg) => pkg.package_type === "bw"
                                      )
                                      .map((pkg) => (
                                        <option key={pkg.id} value={pkg.id}>
                                          {pkg.package_name || pkg.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>

                                {/* Mbps */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Mbps
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={row.mbps}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleBandwidthPackageChange(
                                        row.id,
                                        "mbps",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    className={`w-20 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Unit Price */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Unit Price
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    step="0.01"
                                    value={row.unitPrice}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleBandwidthPackageChange(
                                        row.id,
                                        "unitPrice",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    className={`w-24 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Total */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Total
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="0.00"
                                    value={row.total}
                                    readOnly
                                    className={`w-24 px-3 py-2 rounded-lg border transition-all duration-300 cursor-not-allowed ${
                                      isDark
                                        ? "bg-dark-800 border-dark-600 text-white"
                                        : "bg-gray-100 border-gold-200 text-dark-900"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Add/Remove/Edit/Save Buttons */}
                                <div className="flex gap-2">
                                  {index ===
                                    bandwidthPackageRows.length - 1 && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={addBandwidthPackageRow}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md"
                                    >
                                      <Plus size={18} />
                                    </motion.button>
                                  )}
                                  {editingId && row.detailId && !isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => toggleEditMode(row.id)}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md"
                                      title="Edit package"
                                    >
                                      <Edit2 size={18} />
                                    </motion.button>
                                  )}
                                  {isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => updatePackageDetail(row, "bw")}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md"
                                      title="Save changes"
                                    >
                                      <Save size={18} />
                                    </motion.button>
                                  )}
                                  {isEditing && row.detailId && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => deletePackageRow(row.id, "bw")}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-md"
                                      title="Delete package"
                                    >
                                      <Trash2 size={18} />
                                    </motion.button>
                                  )}
                                  {isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => toggleEditMode(row.id)}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 shadow-md"
                                      title="Cancel editing"
                                    >
                                      <X size={18} />
                                    </motion.button>
                                  )}
                                  {!isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        removeBandwidthPackageRow(row.id)
                                      }
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-md"
                                      title={editingId && row.detailId ? "Close package" : "Remove package"}
                                    >
                                      {editingId && row.detailId ? (
                                        <XCircle size={18} />
                                      ) : (
                                        <Trash2 size={18} />
                                      )}
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                    )}

                    {/* Channel Specific Fields */}
                    {false && selectedCustomerType === "channel_partner" && (
                      <div>
                        <h3
                          className={`text-lg font-semibold mb-4 pb-2 border-b ${
                            isDark
                              ? "text-blue-400 border-dark-600"
                              : "text-blue-600 border-gray-300"
                          }`}
                        >
                          Channel Partner Information
                        </h3>

                        {/* Network Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          {/* NTTN */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              NTTN
                            </label>
                            <input
                              type="text"
                              name="nttn_com"
                              value={formData.nttn_com}
                              onChange={handleInputChange}
                              className={getFieldClassName("nttn_com")}
                            />
                            {renderFieldError("nttn_com")}
                          </div>

                          {/* NTTN Capacity */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              NTTN Capacity
                            </label>
                            <input
                              type="text"
                              name="nttn_cap"
                              value={formData.nttn_cap}
                              onChange={handleInputChange}
                              className={getFieldClassName("nttn_cap")}
                            />
                            {renderFieldError("nttn_cap")}
                          </div>

                          {/* Link/SRC ID */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Link/SRC ID
                            </label>
                            <input
                              type="text"
                              name="link_src_id"
                              value={formData.link_src_id}
                              onChange={handleInputChange}
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                                isDark
                                  ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                  : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                              } focus:outline-none`}
                            />
                          </div>

                          {/* Activation Date */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Activation Date
                            </label>
                            <DatePicker
                              selected={
                                formData.active_date
                                  ? new Date(formData.active_date + "T00:00:00")
                                  : null
                              }
                              onChange={(date) => {
                                const event = {
                                  target: {
                                    name: "active_date",
                                    value: date
                                      ? `${date.getFullYear()}-${String(
                                          date.getMonth() + 1
                                        ).padStart(2, "0")}-${String(
                                          date.getDate()
                                        ).padStart(2, "0")}`
                                      : "",
                                  },
                                };
                                handleInputChange(event);
                              }}
                              dateFormat="yyyy-MM-dd"
                              placeholderText="Select activation date"
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                                isDark
                                  ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                  : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                              } focus:outline-none`}
                              wrapperClassName="w-full"
                              showYearDropdown
                              showMonthDropdown
                              dropdownMode="select"
                            />
                          </div>

                          {/* Total Client */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Total Client
                            </label>
                            <input
                              type="number"
                              name="total_client"
                              value={formData.total_client}
                              readOnly
                              placeholder="0"
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 cursor-not-allowed ${
                                isDark
                                  ? "bg-dark-800 border-dark-600 text-white"
                                  : "bg-gray-100 border-gray-300 text-gray-700"
                              } focus:outline-none`}
                            />
                          </div>

                          {/* Total Active Client */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Total Active Client
                            </label>
                            <input
                              type="number"
                              name="total_active_client"
                              value={formData.total_active_client}
                              readOnly
                              placeholder="0"
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 cursor-not-allowed ${
                                isDark
                                  ? "bg-dark-800 border-dark-600 text-white"
                                  : "bg-gray-100 border-gray-300 text-gray-700"
                              } focus:outline-none`}
                            />
                          </div>

                          {/* Previous Total Client */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Previous Total Client
                            </label>
                            <input
                              type="number"
                              name="previous_total_client"
                              value={formData.previous_total_client}
                              readOnly
                              placeholder="0"
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 cursor-not-allowed ${
                                isDark
                                  ? "bg-dark-800 border-dark-600 text-white"
                                  : "bg-gray-100 border-gray-300 text-gray-700"
                              } focus:outline-none`}
                            />
                          </div>

                          {/* Free Giveaway Client */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Free Giveaway Client
                            </label>
                            <input
                              type="number"
                              name="free_giveaway_client"
                              value={formData.free_giveaway_client}
                              readOnly
                              placeholder="0"
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 cursor-not-allowed ${
                                isDark
                                  ? "bg-dark-800 border-dark-600 text-white"
                                  : "bg-gray-100 border-gray-300 text-gray-700"
                              } focus:outline-none`}
                            />
                          </div>

                          {/* Status */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Status
                            </label>
                            <select
                              name="status"
                              value={formData.status}
                              onChange={handleInputChange}
                              style={{
                                color: isDark ? "#ffffff" : "#1a1a1a",
                                backgroundColor: isDark ? "#1f2937" : "#ffffff",
                              }}
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                                isDark
                                  ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                  : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                              } focus:outline-none`}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                        </div>

                        {/* Dynamic Package Rows */}
                        <div className="mb-6">
                          <label
                            className={`block text-sm font-medium mb-3 ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Package Details
                          </label>
                          <div className="space-y-3">
                            {channelPartnerPackageRows.map((row, index) => {
                              const isEditing = editingRowIds.has(row.id);
                              const isDisabled = editingId && row.detailId && !isEditing;
                              return (
                              <div
                                key={row.id}
                                className="flex flex-wrap items-center gap-3"
                              >
                                {/* Start Date */}
                                <div className="flex items-center gap-2">
                                  <DatePicker
                                    selected={
                                      row.startDate
                                        ? new Date(row.startDate + "T00:00:00")
                                        : null
                                    }
                                    onChange={(date) => {
                                      if (isDisabled) return;
                                      const value = date
                                        ? `${date.getFullYear()}-${String(
                                            date.getMonth() + 1
                                          ).padStart(2, "0")}-${String(
                                            date.getDate()
                                          ).padStart(2, "0")}`
                                        : "";
                                      handleChannelPartnerPackageChange(
                                        row.id,
                                        "startDate",
                                        value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    dateFormat="yyyy-MM-dd"
                                    placeholderText="Start date"
                                    className={`w-32 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                  />
                                </div>

                                {/* Package Name Dropdown */}
                                <div className="flex-1 min-w-[150px]">
                                  <select
                                    value={row.packageId}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleChannelPartnerPackageChange(
                                        row.id,
                                        "packageId",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    style={{
                                      color: isDark ? "#ffffff" : "#1a1a1a",
                                      backgroundColor: isDisabled
                                        ? (isDark ? "#374151" : "#f3f4f6")
                                        : (isDark ? "#1f2937" : "#ffffff"),
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  >
                                    <option value="">Package Name</option>
                                    {packages
                                      .filter(
                                        (pkg) =>
                                          pkg.package_type === "channel_partner"
                                      )
                                      .map((pkg) => (
                                        <option key={pkg.id} value={pkg.id}>
                                          {pkg.package_name || pkg.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>

                                {/* Mbps */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Mbps
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={row.mbps}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleChannelPartnerPackageChange(
                                        row.id,
                                        "mbps",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    className={`w-20 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Unit Price */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Unit Price
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    step="0.01"
                                    value={row.unitPrice}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleChannelPartnerPackageChange(
                                        row.id,
                                        "unitPrice",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    className={`w-24 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Client % */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Client %
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={row.clientPercent}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleChannelPartnerPackageChange(
                                        row.id,
                                        "clientPercent",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    className={`w-20 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Total */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Total
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="0.00"
                                    value={row.total}
                                    readOnly
                                    className={`w-24 px-3 py-2 rounded-lg border transition-all duration-300 cursor-not-allowed ${
                                      isDark
                                        ? "bg-dark-800 border-dark-600 text-white"
                                        : "bg-gray-100 border-gold-200 text-dark-900"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Add/Remove/Edit/Save Buttons */}
                                <div className="flex gap-2">
                                  {index ===
                                    channelPartnerPackageRows.length - 1 && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={addChannelPartnerPackageRow}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md"
                                    >
                                      <Plus size={18} />
                                    </motion.button>
                                  )}
                                  {editingId && row.detailId && !isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => toggleEditMode(row.id)}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md"
                                      title="Edit package"
                                    >
                                      <Edit2 size={18} />
                                    </motion.button>
                                  )}
                                  {isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => updatePackageDetail(row, "channel_partner")}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md"
                                      title="Save changes"
                                    >
                                      <Save size={18} />
                                    </motion.button>
                                  )}
                                  {isEditing && row.detailId && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => deletePackageRow(row.id, "channel_partner")}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-md"
                                      title="Delete package"
                                    >
                                      <Trash2 size={18} />
                                    </motion.button>
                                  )}
                                  {isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => toggleEditMode(row.id)}
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 shadow-md"
                                      title="Cancel editing"
                                    >
                                      <X size={18} />
                                    </motion.button>
                                  )}
                                  {!isEditing && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        removeChannelPartnerPackageRow(row.id)
                                      }
                                      className="px-3 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-md"
                                      title={editingId && row.detailId ? "Close package" : "Remove package"}
                                    >
                                      {editingId && row.detailId ? (
                                        <XCircle size={18} />
                                      ) : (
                                        <Trash2 size={18} />
                                      )}
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Home/SOHO Specific Fields */}
                    {selectedCustomerType === "soho" && (
                      <div>
                        <h3
                          className={`text-lg font-semibold mb-4 pb-2 border-b ${
                            isDark
                              ? "text-blue-400 border-dark-600"
                              : "text-blue-600 border-gray-300"
                          }`}
                        >
                          Home/SOHO Information
                        </h3>

                        {/* Basic Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          {/* Type of Connection */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Type of Connection
                            </label>
                            <select
                              name="connection_type"
                              value={formData.connection_type}
                              onChange={handleInputChange}
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                                isDark
                                  ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                  : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                              } focus:outline-none`}
                            >
                              <option value="">Select Type</option>
                              <option value="pppoe">pppoe</option>
                              <option value="static">static</option>
                            </select>
                          </div>

                          {/* Connected POP */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Connected POP
                            </label>
                            <input
                              type="text"
                              name="connected_pop"
                              value={formData.connected_pop}
                              onChange={handleInputChange}
                              placeholder="Banani"
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                                isDark
                                  ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                  : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                              } focus:outline-none`}
                            />
                          </div>

                          {/* Activation Date */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Activation Date
                            </label>
                            <DatePicker
                              selected={
                                formData.active_date
                                  ? new Date(formData.active_date + "T00:00:00")
                                  : null
                              }
                              onChange={(date) => {
                                const event = {
                                  target: {
                                    name: "active_date",
                                    value: date
                                      ? `${date.getFullYear()}-${String(
                                          date.getMonth() + 1
                                        ).padStart(2, "0")}-${String(
                                          date.getDate()
                                        ).padStart(2, "0")}`
                                      : "",
                                  },
                                };
                                handleInputChange(event);
                              }}
                              dateFormat="yyyy-MM-dd"
                              placeholderText="Select activation date"
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                                isDark
                                  ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                  : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                              } focus:outline-none`}
                              wrapperClassName="w-full"
                              showYearDropdown
                              showMonthDropdown
                              dropdownMode="select"
                            />
                          </div>

                          {/* Status */}
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              Status
                            </label>
                            <select
                              name="status"
                              value={formData.status}
                              onChange={handleInputChange}
                              style={{
                                color: isDark ? "#ffffff" : "#1a1a1a",
                                backgroundColor: isDark ? "#1f2937" : "#ffffff",
                              }}
                              className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                                isDark
                                  ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                  : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                              } focus:outline-none`}
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                            </select>
                          </div>
                        </div>

                        {/* Dynamic Package Rows */}
                        <div className="mb-6">
                          <label
                            className={`block text-sm font-medium mb-3 ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Package Details
                          </label>
                          <div className="space-y-3">
                            {sohoPackageRows.map((row, index) => {
                              const isEditing = editingRowIds.has(row.id);
                              const isDisabled = editingId && row.detailId && !isEditing;
                              return (
                              <div
                                key={row.id}
                                className="flex flex-wrap items-center gap-3"
                              >
                                {/* Package Name Dropdown */}
                                <div className="flex-1 min-w-[200px]">
                                  <select
                                    value={row.packageId}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleSohoPackageChange(
                                        row.id,
                                        "packageId",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    style={{
                                      color: isDark ? "#ffffff" : "#1a1a1a",
                                      backgroundColor: isDisabled
                                        ? (isDark ? "#374151" : "#f3f4f6")
                                        : (isDark ? "#1f2937" : "#ffffff"),
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  >
                                    <option value="">Select Package</option>
                                    {packages
                                      .filter(
                                        (pkg) => pkg.package_type === "soho"
                                      )
                                      .map((pkg) => (
                                        <option key={pkg.id} value={pkg.id}>
                                          {pkg.package_name || pkg.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>

                                {/* Mbps */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Mbps
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={row.mbps}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleSohoPackageChange(
                                        row.id,
                                        "mbps",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    className={`w-20 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Unit Price */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      isDark
                                        ? "text-silver-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    Unit Price
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    step="0.01"
                                    value={row.unitPrice}
                                    onChange={(e) => {
                                      if (isDisabled) return;
                                      handleSohoPackageChange(
                                        row.id,
                                        "unitPrice",
                                        e.target.value
                                      );
                                    }}
                                    disabled={isDisabled}
                                    className={`w-24 px-3 py-2 rounded-lg border transition-all duration-300 ${
                                      isDisabled
                                        ? isDark
                                          ? "bg-dark-800 border-dark-600 text-gray-400 cursor-not-allowed"
                                          : "bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed"
                                        : isDark
                                          ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                                          : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                                    } focus:outline-none`}
                                  />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  {index === sohoPackageRows.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={addSohoPackageRow}
                                      className={`p-2 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? "bg-green-600 hover:bg-green-700 text-white"
                                          : "bg-green-500 hover:bg-green-600 text-white"
                                      }`}
                                    >
                                      <Plus size={16} />
                                    </button>
                                  )}
                                  {editingId && row.detailId && !isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => toggleEditMode(row.id)}
                                      className={`p-2 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                                          : "bg-blue-500 hover:bg-blue-600 text-white"
                                      }`}
                                      title="Edit package"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  )}
                                  {isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => updatePackageDetail(row, "soho")}
                                      className={`p-2 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? "bg-green-600 hover:bg-green-700 text-white"
                                          : "bg-green-500 hover:bg-green-600 text-white"
                                      }`}
                                      title="Save changes"
                                    >
                                      <Save size={16} />
                                    </button>
                                  )}
                                  {isEditing && row.detailId && (
                                    <button
                                      type="button"
                                      onClick={() => deletePackageRow(row.id, "soho")}
                                      className={`p-2 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? "bg-red-600 hover:bg-red-700 text-white"
                                          : "bg-red-500 hover:bg-red-600 text-white"
                                      }`}
                                      title="Delete package"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                  {isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => toggleEditMode(row.id)}
                                      className={`p-2 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? "bg-gray-600 hover:bg-gray-700 text-white"
                                          : "bg-gray-500 hover:bg-gray-600 text-white"
                                      }`}
                                      title="Cancel editing"
                                    >
                                      <X size={16} />
                                    </button>
                                  )}
                                  {!isEditing && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeSohoPackageRow(row.id)
                                      }
                                      className={`p-2 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? "bg-red-600 hover:bg-red-700 text-white"
                                          : "bg-red-500 hover:bg-red-600 text-white"
                                      }`}
                                      title={editingId && row.detailId ? "Close package" : "Remove package"}
                                    >
                                      {editingId && row.detailId ? (
                                        <XCircle size={16} />
                                      ) : (
                                        <Minus size={16} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Remarks - Common for all customer types */}
                    {selectedCustomerType && (
                      <div>
                        <label
                          className={`block text-sm font-medium mb-2 ${
                            isDark ? "text-silver-300" : "text-gray-700"
                          }`}
                        >
                          Remarks
                        </label>
                        <textarea
                          name="remarks"
                          value={formData.remarks}
                          onChange={handleInputChange}
                          rows="3"
                          placeholder="Enter any additional notes or comments"
                          className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                            isDark
                              ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                              : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                          } focus:outline-none`}
                        />
                      </div>
                    )}

                    {/* Form Actions - always show Submit (Update/Create) and Cancel when form is open */}
                    <div className="flex gap-3 pt-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={loading}
                        className={`flex-1 px-6 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl disabled:opacity-50`}
                      >
                        {loading
                          ? "Saving..."
                          : editingId
                          ? "Update Bill"
                          : "Create Bill"}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={resetForm}
                        className={`flex-1 px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                          isDark
                            ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search and View Toggle - Hidden when editing */}
          {!editingId && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div
                className={`flex-1 relative ${
                  isDark ? "bg-dark-800" : "bg-white"
                } rounded-lg border transition-all duration-300 ${
                  isDark ? "border-dark-700" : "border-gold-200"
                }`}
              >
                <Search
                  className={`absolute left-3 top-3 ${
                    isDark ? "text-silver-500" : "text-gray-400"
                  }`}
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search by customer, company, bill no., NTTN CAP..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg transition-all duration-300 ${
                    isDark
                      ? "bg-dark-800 text-white placeholder-silver-500 focus:outline-none"
                      : "bg-white text-dark-900 placeholder-gray-400 focus:outline-none"
                  }`}
                />
              </div>

              {/* Customer Type Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    console.log("Customer type filter changed to: Bandwidth");
                    setCustomerTypeFilter("Bandwidth");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    customerTypeFilter === "Bandwidth"
                      ? isDark
                        ? "bg-blue-600 text-white"
                        : "bg-blue-600 text-white"
                      : isDark
                      ? "bg-dark-700 text-silver-300 hover:bg-dark-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Bandwidth
                </button>
                <button
                  onClick={() => {
                    console.log("Customer type filter changed to: Home/SOHO");
                    setCustomerTypeFilter("Home/SOHO");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    customerTypeFilter === "Home/SOHO"
                      ? isDark
                        ? "bg-cyan-600 text-white"
                        : "bg-cyan-600 text-white"
                      : isDark
                      ? "bg-dark-700 text-silver-300 hover:bg-dark-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Home/SOHO
                </button>
              </div>

              <div
                className={`relative ${
                  isDark ? "bg-dark-800" : "bg-white"
                } rounded-lg border transition-all duration-300 ${
                  isDark ? "border-dark-700" : "border-gold-200"
                }`}
              >
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full px-4 py-2 pr-8 rounded-lg transition-all duration-300 appearance-none ${
                    isDark
                      ? "bg-dark-800 text-white focus:outline-none"
                      : "bg-white text-dark-900 focus:outline-none"
                  }`}
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div
                className={`relative ${
                  isDark ? "bg-dark-800" : "bg-white"
                } rounded-lg border transition-all duration-300 ${
                  isDark ? "border-dark-700" : "border-gold-200"
                }`}
              >
                <select
                  value={monthFilter}
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full px-4 py-2 pr-8 rounded-lg transition-all duration-300 appearance-none ${
                    isDark
                      ? "bg-dark-800 text-white focus:outline-none"
                      : "bg-white text-dark-900 focus:outline-none"
                  }`}
                >
                  <option value="">All Months</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode("table")}
                  className={`p-2 rounded-lg transition-all duration-300 ${
                    viewMode === "table"
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg"
                      : isDark
                      ? "bg-dark-800 text-silver-400 hover:text-blue-400"
                      : "bg-gray-200 text-gray-600 hover:text-blue-600"
                  }`}
                >
                  <List size={20} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode("card")}
                  className={`p-2 rounded-lg transition-all duration-300 ${
                    viewMode === "card"
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg"
                      : isDark
                      ? "bg-dark-800 text-silver-400 hover:text-blue-400"
                      : "bg-gray-200 text-gray-600 hover:text-blue-600"
                  }`}
                >
                  <Grid size={20} />
                </motion.button>
              </div>
            </div>
          )}

          {/* Table View - Hidden when editing */}
          {!editingId && viewMode === "table" && (
            <motion.div
              key={`table-${currentPage}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className={`rounded-2xl overflow-hidden transition-all duration-300 ${
                isDark
                  ? "bg-dark-800 border border-dark-700"
                  : "bg-white border border-gold-100"
              }`}
            >
              {/* Constrain list to its own scrollable area */}
              <div className="overflow-x-auto overflow-y-auto max-w-full max-h-[65vh]">
                <table className="min-w-[1200px] text-xs sm:text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-dark-800">
                    <tr
                      className={`border-b ${
                        isDark ? "border-dark-700" : "border-gold-100"
                      }`}
                    >
                      {/* Bandwidth specific columns */}
                      {customerTypeFilter === "Bandwidth" && (
                        <>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Bill ID
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Customer / company
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            NTTN
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            NTTN Capacity
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Connection Date
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Status
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-right font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Total
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            KAM Name
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Remarks
                          </th>
                        </>
                      )}

                      {/* Channel specific columns */}
                      {false && customerTypeFilter === "Channel" && (
                        <>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Bill ID
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Customer / company
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            NTTN
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            NTTN Capacity
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Link/SRC ID
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Activation Date
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Total Client
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Total Active Client
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Previous Total Client
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Free Giveaway Client
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Last Bill/Invoice Date
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Mbps
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-right font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Unit Price
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Client %
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-right font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Total
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            KAM Name
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Remarks
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Status
                          </th>
                        </>
                      )}

                      {/* Home/SOHO specific columns */}
                      {customerTypeFilter === "Home/SOHO" && (
                        <>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Bill ID
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Customer / company
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Type of Connection
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Connected POP
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Package Name
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Mbps
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-right font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Unit Price
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-right font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Total
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Addresses
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Contact No
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Activation Date
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Active Status
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            KAM
                          </th>
                          <th
                            className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                              isDark ? "text-silver-300" : "text-gray-700"
                            }`}
                          >
                            Remarks
                          </th>
                        </>
                      )}

                      {/* Actions column - only show when customer type is selected */}
                      {customerTypeFilter && (
                        <th
                          className={`px-2 sm:px-4 py-3 text-left font-semibold whitespace-nowrap ${
                            isDark ? "text-silver-300" : "text-gray-700"
                          }`}
                        >
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className={isDark ? "bg-dark-800" : "bg-white"}>{customerTypeFilter && listLoading ? (
                      <tr>
                        <td colSpan="20" className="px-4 py-8 text-center">
                          <div className="flex items-center justify-center">
                            <div className="relative w-12 h-12">
                              <div className="absolute inset-0 rounded-full border-4 border-blue-400/20"></div>
                              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : customerTypeFilter && bills.length === 0 ? (
                      <tr>
                        <td colSpan="20" className="px-4 py-8 text-center">
                          <span
                            className={
                              isDark ? "text-silver-400" : "text-gray-500"
                            }
                          >
                            No bills found for {customerTypeFilter} customers
                          </span>
                        </td>
                      </tr>
                    ) : (
                      customerTypeFilter &&
                      bills.map((bill, index) => (
                        <tr
                          key={bill.id}
                          className={`border-b transition-colors duration-300 hover:${
                            isDark ? "bg-dark-700" : "bg-gray-50"
                          } ${isDark ? "border-dark-700" : "border-gray-100"}`}
                        >
                          {/* Bandwidth specific columns */}
                          {customerTypeFilter === "Bandwidth" && (
                            <>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.bill_number || bill.id || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium align-top ${
                                  isDark ? "text-gray-100" : "text-gray-900"
                                }`}
                              >
                                {renderCustomerNameWithCompany(bill)}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.nttn_com || bill.nttn_company || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.nttn_cap || bill.nttn_capacity || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-400" : "text-gray-600"
                                }`}
                              >
                                {bill.active_date || bill.activation_date
                                  ? new Date(
                                      bill.active_date || bill.activation_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap`}
                              >
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${(() => {
                                    // Prioritize master bill status
                                    let status = null;
                                    if (bill.status !== null && bill.status !== undefined) {
                                      status = bill.status;
                                    } else if (bill.details && bill.details.length > 0) {
                                      // If master status is missing, check if any detail is active
                                      const hasActiveDetail = bill.details.some(
                                        (detail) => detail.status && detail.status.toLowerCase() === "active"
                                      );
                                      status = hasActiveDetail ? "active" : "inactive";
                                    }
                                    // Default to active if no status found
                                    if (!status) status = "active";
                                    
                                    return status === "Active" ||
                                      status === "active"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
                                  })()}`}
                                >
                                  {(() => {
                                    // Prioritize master bill status
                                    let status = null;
                                    if (bill.status !== null && bill.status !== undefined) {
                                      status = bill.status;
                                    } else if (bill.details && bill.details.length > 0) {
                                      // If master status is missing, check if any detail is active
                                      const hasActiveDetail = bill.details.some(
                                        (detail) => detail.status && detail.status.toLowerCase() === "active"
                                      );
                                      status = hasActiveDetail ? "active" : "inactive";
                                    }
                                    // Default to active if no status found
                                    if (!status) return "Active";
                                    // Capitalize first letter
                                    return (
                                      status.charAt(0).toUpperCase() +
                                      status.slice(1).toLowerCase()
                                    );
                                  })()}
                                </span>
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm text-right font-semibold whitespace-nowrap ${
                                  isDark ? "text-green-400" : "text-green-600"
                                }`}
                              >
                                {(() => {
                                  const totalBill = bill.total_bill || 0;
                                  return parseFloat(totalBill).toLocaleString(
                                    "en-US",
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  );
                                })()}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {getCustomerDetails(bill).kam_name || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm max-w-xs truncate ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                                title={bill.remarks || "-"}
                              >
                                {bill.remarks || "-"}
                              </td>
                            </>
                          )}

                          {/* Channel specific columns */}
                          {false && customerTypeFilter === "Channel" && (
                            <>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap ${
                                  isDark ? "text-blue-400" : "text-blue-600"
                                }`}
                              >
                                {bill.bill_number || bill.id || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium align-top ${
                                  isDark ? "text-gray-100" : "text-gray-900"
                                }`}
                              >
                                {renderCustomerNameWithCompany(bill)}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.nttn_company || bill.nttn_com || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.nttn_capacity || bill.nttn_cap || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.link_id || bill.link_scr_id || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-400" : "text-gray-600"
                                }`}
                              >
                                {bill.activation_date
                                  ? new Date(
                                      bill.activation_date
                                    ).toLocaleDateString()
                                  : bill.created_at
                                  ? new Date(
                                      bill.created_at
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.customer_master?.total_client ||
                                  bill.total_client ||
                                  "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.customer_master?.total_active_client ||
                                  bill.total_active_client ||
                                  "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.customer_master?.previous_total_client ||
                                  bill.previous_total_client ||
                                  "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.customer_master?.free_giveaway_client ||
                                  bill.free_giveaway_client ||
                                  "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-400" : "text-gray-600"
                                }`}
                              >
                                {bill.customer_master?.last_bill_invoice_date ||
                                bill.last_bill_invoice_date
                                  ? new Date(
                                      bill.customer_master
                                        ?.last_bill_invoice_date ||
                                        bill.last_bill_invoice_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {(() => {
                                  // Get all Mbps from details
                                  if (
                                    bill.details &&
                                    Array.isArray(bill.details) &&
                                    bill.details.length > 0
                                  ) {
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {bill.details.map((detail, idx) => (
                                          <div key={idx}>
                                            {detail.mbps || "0"}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return "-";
                                })()}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm text-right ${
                                  isDark ? "text-blue-400" : "text-blue-600"
                                }`}
                              >
                                {(() => {
                                  // Get all unit_prices from details
                                  if (
                                    bill.details &&
                                    Array.isArray(bill.details) &&
                                    bill.details.length > 0
                                  ) {
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {bill.details.map((detail, idx) => (
                                          <div key={idx}>
                                            {detail.unit_price
                                              ? parseFloat(
                                                  detail.unit_price
                                                ).toLocaleString("en-US", {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                })
                                              : "0.00"}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return "0.00";
                                })()}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {(() => {
                                  // Get all Client % from details
                                  if (
                                    bill.details &&
                                    Array.isArray(bill.details) &&
                                    bill.details.length > 0
                                  ) {
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {bill.details.map((detail, idx) => (
                                          <div key={idx}>
                                            {detail.custom_mac_percentage_share ||
                                              "0"}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return "-";
                                })()}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm text-right font-semibold whitespace-nowrap ${
                                  isDark ? "text-blue-400" : "text-blue-600"
                                }`}
                              >
                                {bill.total_bill
                                  ? parseFloat(bill.total_bill).toLocaleString(
                                      "en-US",
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )
                                  : "0.00"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {getCustomerDetails(bill).kam_name || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm max-w-xs truncate ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                                title={bill.remarks || "-"}
                              >
                                {bill.remarks || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap`}
                              >
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${(() => {
                                    // Prioritize master bill status
                                    let status = null;
                                    if (bill.status !== null && bill.status !== undefined) {
                                      status = bill.status;
                                    } else if (bill.details && bill.details.length > 0) {
                                      // If master status is missing, check if any detail is active
                                      const hasActiveDetail = bill.details.some(
                                        (detail) => detail.status && detail.status.toLowerCase() === "active"
                                      );
                                      status = hasActiveDetail ? "active" : "inactive";
                                    }
                                    // Default to active if no status found
                                    if (!status) status = "active";
                                    
                                    return status === "Active" ||
                                      status === "active"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
                                  })()}`}
                                >
                                  {(() => {
                                    // Prioritize master bill status
                                    let status = null;
                                    if (bill.status !== null && bill.status !== undefined) {
                                      status = bill.status;
                                    } else if (bill.details && bill.details.length > 0) {
                                      // If master status is missing, check if any detail is active
                                      const hasActiveDetail = bill.details.some(
                                        (detail) => detail.status && detail.status.toLowerCase() === "active"
                                      );
                                      status = hasActiveDetail ? "active" : "inactive";
                                    }
                                    // Default to active if no status found
                                    if (!status) return "Active";
                                    // Capitalize first letter
                                    return (
                                      status.charAt(0).toUpperCase() +
                                      status.slice(1).toLowerCase()
                                    );
                                  })()}
                                </span>
                              </td>
                            </>
                          )}

                          {/* Home/SOHO specific columns */}
                          {customerTypeFilter === "Home/SOHO" && (
                            <>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap ${
                                  isDark ? "text-blue-400" : "text-blue-600"
                                }`}
                              >
                                {bill.bill_number || bill.id || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium align-top ${
                                  isDark ? "text-gray-100" : "text-gray-900"
                                }`}
                              >
                                {renderCustomerNameWithCompany(bill)}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.type_of_connection || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.connected_pop || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {(() => {
                                  // Get all Package Names from details
                                  if (
                                    bill.details &&
                                    Array.isArray(bill.details) &&
                                    bill.details.length > 0
                                  ) {
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {bill.details.map((detail, idx) => {
                                          // Package name is directly on the detail object
                                          const pkgName =
                                            detail.package_name || "-";
                                          return <div key={idx}>{pkgName}</div>;
                                        })}
                                      </div>
                                    );
                                  }
                                  return "-";
                                })()}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {(() => {
                                  // Get all Mbps from details
                                  if (
                                    bill.details &&
                                    Array.isArray(bill.details) &&
                                    bill.details.length > 0
                                  ) {
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {bill.details.map((detail, idx) => {
                                          // Mbps is directly on the detail object
                                          const mbps = detail.mbps ?? "-";
                                          return (
                                            <div key={idx}>
                                              {mbps !== null && mbps !== ""
                                                ? mbps
                                                : "-"}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                  return "-";
                                })()}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm text-right ${
                                  isDark ? "text-blue-400" : "text-blue-600"
                                }`}
                              >
                                {(() => {
                                  // Get all unit_prices from details
                                  if (
                                    bill.details &&
                                    Array.isArray(bill.details) &&
                                    bill.details.length > 0
                                  ) {
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {bill.details.map((detail, idx) => {
                                          // Unit price is directly on the detail object
                                          const price = detail.unit_price ?? 0;
                                          return (
                                            <div key={idx}>
                                              {price !== null && price !== ""
                                                ? parseFloat(
                                                    price
                                                  ).toLocaleString("en-US", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })
                                                : "-"}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                  return "-";
                                })()}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-right whitespace-nowrap ${
                                  isDark ? "text-green-400" : "text-green-600"
                                }`}
                              >
                                {bill.total_bill
                                  ? parseFloat(bill.total_bill).toLocaleString(
                                      "en-US",
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )
                                  : "0.00"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm max-w-xs truncate ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                                title={getCustomerDetails(bill).address || "-"}
                              >
                                {getCustomerDetails(bill).address || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {getCustomerDetails(bill).phone || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-400" : "text-gray-600"
                                }`}
                              >
                                {bill.activation_date
                                  ? new Date(
                                      bill.activation_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap`}
                              >
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    bill.details &&
                                    bill.details.length > 0 &&
                                    bill.details.some(
                                      (d) =>
                                        d.status === "active" || d.is_active
                                    )
                                      ? isDark
                                        ? "bg-green-900 text-green-300"
                                        : "bg-green-100 text-green-800"
                                      : isDark
                                      ? "bg-red-900 text-red-300"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {bill.details &&
                                  bill.details.length > 0 &&
                                  bill.details.some(
                                    (d) => d.status === "active" || d.is_active
                                  )
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {getCustomerDetails(bill).kam_name || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm max-w-xs truncate ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                                title={bill.remarks || "-"}
                              >
                                {bill.remarks || "-"}
                              </td>
                            </>
                          )}

                          {/* Default columns when no specific type is selected */}
                          {!customerTypeFilter && (
                            <>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap`}
                              >
                                <button
                                  onClick={() => handleViewClick(bill)}
                                  className={`font-medium underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:no-underline ${
                                    isDark
                                      ? "text-blue-400 hover:text-blue-300"
                                      : "text-blue-600 hover:text-blue-700"
                                  }`}
                                >
                                  {bill.bill_number || "-"}
                                </button>
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-400" : "text-gray-600"
                                }`}
                              >
                                {bill.active_date
                                  ? new Date(
                                      bill.active_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-right whitespace-nowrap ${
                                  isDark ? "text-blue-400" : "text-blue-600"
                                }`}
                              >
                                {bill.total_bill?.toLocaleString() || "0"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.nttn_com || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.nttn_cap || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.type || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.connection_type || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.connected_pop || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-400" : "text-gray-600"
                                }`}
                              >
                                {bill.billing_date
                                  ? new Date(
                                      bill.billing_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm max-w-xs truncate ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                                title={bill.remarks || "-"}
                              >
                                {bill.remarks || "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.created_by_details?.username ||
                                  bill.created_by ||
                                  "-"}
                              </td>
                              <td
                                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                {bill.updated_by_details?.username ||
                                  bill.updated_by ||
                                  "-"}
                              </td>
                            </>
                          )}

                          {/* Actions Column - Always visible */}
                          <td
                            className={`px-2 sm:px-4 py-3 text-xs sm:text-sm`}
                          >
                            <div className="flex items-center space-x-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleViewClick(bill)}
                                className={`p-1 sm:p-2 rounded-lg transition-all ${
                                  isDark
                                    ? "bg-dark-700 text-green-400 hover:bg-dark-600"
                                    : "bg-green-50 text-green-600 hover:bg-green-100"
                                }`}
                              >
                                <Eye size={14} />
                              </motion.button>
                              {hasPermission("entitlements:update") && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleEdit(bill)}
                                  className={`p-1 sm:p-2 rounded-lg transition-all ${
                                    isDark
                                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500"
                                      : "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500"
                                  }`}
                                >
                                  <Edit2 size={14} />
                                </motion.button>
                              )}
                              {hasPermission("entitlements:update") && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleDuplicate(bill)}
                                  className={`p-1 sm:p-2 rounded-lg transition-all ${
                                    isDark
                                      ? "bg-dark-700 text-yellow-400 hover:bg-dark-600"
                                      : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                                  }`}
                                  title="Duplicate bill entry"
                                >
                                  <Copy size={14} />
                                </motion.button>
                              )}
                              {hasPermission("entitlements:update") && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleDeleteClick(bill)}
                                  className={`p-1 sm:p-2 rounded-lg transition-all ${
                                    isDark
                                      ? "bg-dark-700 text-red-400 hover:bg-dark-600"
                                      : "bg-red-50 text-red-600 hover:bg-red-100"
                                  }`}
                                >
                                  <Trash2 size={14} />
                                </motion.button>
                              )}
                              {!hasPermission("entitlements:update") &&
                                !hasPermission("entitlements:read") && (
                                  <span
                                    className={`text-xs ${
                                      isDark ? "text-gray-500" : "text-gray-400"
                                    }`}
                                  >
                                    No actions
                                  </span>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Pagination */}
          {!editingId && viewMode === "table" && bills.length > 0 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                totalCount={totalCount}
              />
            </div>
          )}

          {/* Grid View - Hidden when editing */}
          {!editingId && viewMode === "card" && (
            <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
              {listLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-400/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
                  </div>
                </div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-max"
                >
                  {bills.map((bill) => (
                  <motion.div
                    key={bill.id}
                    variants={itemVariants}
                    className={`rounded-2xl p-6 transition-all duration-300 ${
                      isDark
                        ? "bg-dark-800 border border-dark-700 hover:border-blue-500"
                        : "bg-white border border-gray-100 hover:border-blue-500"
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3
                          className={`text-lg font-semibold ${
                            isDark ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          {getCustomerDetails(bill).name}
                        </h3>
                        <p
                          className={`text-sm ${
                            isDark ? "text-silver-400" : "text-gray-600"
                          }`}
                        >
                          Company: {getCustomerDetails(bill).company_name}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${(() => {
                          // Prioritize master bill status
                          let status = null;
                          if (bill.status !== null && bill.status !== undefined) {
                            status = bill.status;
                          } else if (bill.details && bill.details.length > 0) {
                            // If master status is missing, check if any detail is active
                            const hasActiveDetail = bill.details.some(
                              (detail) => detail.status && detail.status.toLowerCase() === "active"
                            );
                            status = hasActiveDetail ? "active" : "inactive";
                          }
                          // Default to active if no status found
                          if (!status) status = "active";
                          
                          return status === "Active" || status === "active"
                            ? isDark
                              ? "bg-green-900/30 text-green-400"
                              : "bg-green-100 text-green-700"
                            : isDark
                            ? "bg-red-900/30 text-red-400"
                            : "bg-red-100 text-red-700";
                        })()}`}
                      >
                        {(() => {
                          // Prioritize master bill status
                          let status = null;
                          if (bill.status !== null && bill.status !== undefined) {
                            status = bill.status;
                          } else if (bill.details && bill.details.length > 0) {
                            // If master status is missing, check if any detail is active
                            const hasActiveDetail = bill.details.some(
                              (detail) => detail.status && detail.status.toLowerCase() === "active"
                            );
                            status = hasActiveDetail ? "active" : "inactive";
                          }
                          // Default to active if no status found
                          if (!status) return "Active";
                          return (
                            status.charAt(0).toUpperCase() +
                            status.slice(1).toLowerCase()
                          );
                        })()}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="space-y-3 mb-4">
                      {/* Contact Info */}
                      {getCustomerDetails(bill).phone &&
                        getCustomerDetails(bill).phone !== "-" && (
                          <div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-silver-400" : "text-gray-600"
                              }`}
                            >
                              Phone
                            </p>
                            <p
                              className={`text-sm ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              {getCustomerDetails(bill).phone}
                            </p>
                          </div>
                        )}

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-2">
                        {bill.active_date && (
                          <div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-silver-400" : "text-gray-600"
                              }`}
                            >
                              Active
                            </p>
                            <p
                              className={`text-sm ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              {new Date(bill.active_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {bill.billing_date && (
                          <div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-silver-400" : "text-gray-600"
                              }`}
                            >
                              Billing
                            </p>
                            <p
                              className={`text-sm ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              {new Date(bill.billing_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Financial Summary */}
                      <div
                        className={`rounded-lg p-3 ${
                          isDark ? "bg-dark-700" : "bg-blue-50"
                        }`}
                      >
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-silver-400" : "text-gray-600"
                              }`}
                            >
                              Total Bill
                            </p>
                            <p
                              className={`text-sm font-semibold ${
                                isDark ? "text-blue-400" : "text-blue-600"
                              }`}
                            >
                              {bill.customer_master?.total_billed !==
                                undefined &&
                              bill.customer_master?.total_billed !== null
                                ? bill.customer_master.total_billed.toLocaleString()
                                : "0"}
                            </p>
                          </div>
                          <div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-silver-400" : "text-gray-600"
                              }`}
                            >
                              Received
                            </p>
                            <p
                              className={`text-sm font-semibold ${
                                isDark ? "text-green-400" : "text-green-600"
                              }`}
                            >
                              {bill.customer_master?.total_paid !== undefined &&
                              bill.customer_master?.total_paid !== null
                                ? bill.customer_master.total_paid.toLocaleString()
                                : "0"}
                            </p>
                          </div>
                          <div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-silver-400" : "text-gray-600"
                              }`}
                            >
                              Due
                            </p>
                            <p
                              className={`text-sm font-semibold ${
                                isDark ? "text-red-400" : "text-red-600"
                              }`}
                            >
                              {bill.customer_master?.total_due !== undefined &&
                              bill.customer_master?.total_due !== null
                                ? bill.customer_master.total_due.toLocaleString()
                                : "0"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Services */}
                      {(bill.iig_qt_price > 0 ||
                        bill.fna_price > 0 ||
                        bill.ggc_price > 0 ||
                        bill.cdn_price > 0 ||
                        bill.bdix_price > 0 ||
                        bill.baishan_price > 0) && (
                        <div>
                          <p
                            className={`text-xs font-medium mb-2 ${
                              isDark ? "text-silver-400" : "text-gray-600"
                            }`}
                          >
                            Services
                          </p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {bill.iig_qt_price > 0 && (
                              <span
                                className={`${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                IIG-QT: {bill.iig_qt_price}
                              </span>
                            )}
                            {bill.fna_price > 0 && (
                              <span
                                className={`${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                FNA: {bill.fna_price}
                              </span>
                            )}
                            {bill.ggc_price > 0 && (
                              <span
                                className={`${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                GGC: {bill.ggc_price}
                              </span>
                            )}
                            {bill.cdn_price > 0 && (
                              <span
                                className={`${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                CDN: {bill.cdn_price}
                              </span>
                            )}
                            {bill.bdix_price > 0 && (
                              <span
                                className={`${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                BDIX: {bill.bdix_price}
                              </span>
                            )}
                            {bill.baishan_price > 0 && (
                              <span
                                className={`${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                BAISHAN: {bill.baishan_price}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Footer - Actions */}
                    <div
                      className="flex items-center space-x-2 pt-4 border-t"
                      style={{
                        borderColor: isDark
                          ? "rgb(55, 65, 81)"
                          : "rgb(229, 231, 235)",
                      }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewClick(bill)}
                        className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg transition-all text-sm ${
                          isDark
                            ? "bg-dark-700 text-green-400 hover:bg-dark-600"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </motion.button>
                      {hasPermission("entitlements:update") && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleEdit(bill)}
                          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg transition-all text-sm bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 shadow-md"
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </motion.button>
                      )}
                      {hasPermission("entitlements:update") && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDuplicate(bill)}
                          className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg transition-all text-sm ${
                            isDark
                              ? "bg-dark-700 text-yellow-400 hover:bg-dark-600"
                              : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                          }`}
                          title="Duplicate bill entry"
                        >
                          <Copy size={14} />
                          <span>Duplicate</span>
                        </motion.button>
                      )}
                      {hasPermission("entitlements:update") && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteClick(bill)}
                          className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg transition-all text-sm ${
                            isDark
                              ? "bg-dark-700 text-red-400 hover:bg-dark-600"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </motion.button>
                      )}
                      {!hasPermission("entitlements:update") &&
                        !hasPermission("entitlements:read") && (
                          <div
                            className={`flex-1 text-center text-xs ${
                              isDark ? "text-gray-500" : "text-gray-400"
                            }`}
                          >
                            No actions available
                          </div>
                        )}
                    </div>
                  </motion.div>
                ))}
                </motion.div>
              )}
            </div>
          )}

          {/* Pagination for Card View */}
          {!editingId && viewMode === "card" && bills.length > 0 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                totalCount={totalCount}
              />
            </div>
          )}
        </div>
      </div>

      {/* View Modal - Bandwidth */}
      <AnimatePresence>
        {showViewModal &&
          viewingBill &&
          (viewingBill.customer_master?.customer_type === "bw" ||
            viewingBill.customer_type === "bw" ||
            customerTypeFilter === "Bandwidth") && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleViewClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={`w-full max-w-4xl rounded-2xl p-6 shadow-2xl ${
                    isDark
                      ? "bg-dark-800 border border-dark-700"
                      : "bg-white border border-gray-200"
                  } max-h-[90vh] overflow-y-auto`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3
                      className={`text-2xl font-serif font-bold ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      Bandwidth Bill Details
                    </h3>
                    <button
                      onClick={handleViewClose}
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        isDark
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Bill Number - Featured */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <div
                        className={`p-4 rounded-lg ${
                          isDark
                            ? "bg-blue-900/20 border border-blue-800"
                            : "bg-blue-50 border border-blue-200"
                        }`}
                      >
                        <label className="block text-sm font-medium mb-1">
                          Bill Number
                        </label>
                        <p
                          className={`text-lg font-semibold ${
                            isDark ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          {viewingBill.bill_number || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Customer Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Customer Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Zone Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.zone_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Company Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).company_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Email
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).email || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Phone
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).phone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Address
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).address || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        KAM
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).kam_name || "N/A"}
                      </p>
                    </div>

                    {/* NTTN Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        NTTN Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        NTTN CAP
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.nttn_cap ||
                          viewingBill.nttn_capacity ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        NTTN COM
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.nttn_com ||
                          viewingBill.nttn_company ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Link/SRC ID
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.link_scr_id ||
                          viewingBill.link_src_id ||
                          viewingBill.link_id ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        NTTN Uses
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.nttn_uses || "N/A"}
                      </p>
                    </div>

                    {/* Channel Partner Information (if applicable) */}
                    {(viewingBill.total_client !== undefined ||
                      viewingBill.total_active_client !== undefined ||
                      viewingBill.previous_total_client !== undefined ||
                      viewingBill.free_giveaway_client !== undefined) && (
                      <>
                        <div className="md:col-span-2 lg:col-span-3">
                          <h4
                            className={`text-lg font-semibold mb-3 mt-4 ${
                              isDark ? "text-blue-400" : "text-blue-600"
                            }`}
                          >
                            Channel Partner Information
                          </h4>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Total Client
                          </label>
                          <p
                            className={`text-sm ${
                              isDark ? "text-silver-400" : "text-gray-600"
                            }`}
                          >
                            {viewingBill.total_client || "0"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Total Active Client
                          </label>
                          <p
                            className={`text-sm ${
                              isDark ? "text-silver-400" : "text-gray-600"
                            }`}
                          >
                            {viewingBill.total_active_client || "0"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Previous Total Client
                          </label>
                          <p
                            className={`text-sm ${
                              isDark ? "text-silver-400" : "text-gray-600"
                            }`}
                          >
                            {viewingBill.previous_total_client || "0"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Free Giveaway Client
                          </label>
                          <p
                            className={`text-sm ${
                              isDark ? "text-silver-400" : "text-gray-600"
                            }`}
                          >
                            {viewingBill.free_giveaway_client || "0"}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Dates */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Dates
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Active Date
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.activation_date || viewingBill.active_date
                          ? new Date(
                              viewingBill.activation_date ||
                                viewingBill.active_date
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Billing Date
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.billing_date
                          ? new Date(
                              viewingBill.billing_date
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>

                    {/* <div>
                    <label className="block text-sm font-medium mb-1">
                      Termination Date
                    </label>
                    <p
                      className={`text-sm ${
                        isDark ? "text-silver-400" : "text-gray-600"
                      }`}
                    >
                      {viewingBill.termination_date
                        ? new Date(
                            viewingBill.termination_date
                          ).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div> */}

                    {/* Package Details - Latest/Active */}
                    {(() => {
                      const allDetails = viewingBill.details;
                      // Filter for active details only
                      const activeDetails =
                        allDetails?.filter(
                          (d) => d.is_active && d.status === "active"
                        ) || [];

                      console.log("Package Details check:", {
                        hasDetails: !!allDetails,
                        isArray: Array.isArray(allDetails),
                        totalLength: allDetails?.length,
                        activeLength: activeDetails.length,
                        allDetails: allDetails,
                      });

                      if (
                        !activeDetails ||
                        !Array.isArray(activeDetails) ||
                        activeDetails.length === 0
                      ) {
                        return null;
                      }

                      return (
                        <>
                          <div className="md:col-span-2 lg:col-span-3">
                            <h4
                              className={`text-lg font-semibold mb-3 mt-4 ${
                                isDark ? "text-blue-400" : "text-blue-600"
                              }`}
                            >
                              Package Details (Current)
                            </h4>
                          </div>
                          <div className="md:col-span-2 lg:col-span-3">
                            <div className="overflow-x-auto">
                              <table
                                className={`w-full text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                <thead
                                  className={`${
                                    isDark ? "bg-dark-700" : "bg-gray-100"
                                  }`}
                                >
                                  <tr>
                                    <th className="px-3 py-2 text-left">
                                      Package Name
                                    </th>
                                    
                                    <th className="px-3 py-2 text-left">
                                      Start Date
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      End Date
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      MBPS
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Unit Price
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>{activeDetails.map((detail, index) => {
                                    // Extract package name from various fields
                                    let packageName =
                                      detail.package_name ||
                                      detail.package ||
                                      "";
                                    if (!packageName && detail.remarks) {
                                      // Try to extract from remarks format: "PACKAGE_NAME - other info"
                                      const match =
                                        detail.remarks.match(/^([^-]+)/);
                                      if (match) {
                                        packageName = match[1].trim();
                                      }
                                    }
                                    if (!packageName) packageName = "N/A";

                                    const bandwidthType =
                                      detail.bandwidth_type ||
                                      detail.type ||
                                      "-";
                                    const mbps = parseFloat(
                                      detail.mbps || detail.bandwidth || 0
                                    );
                                    const unitPrice = parseFloat(
                                      detail.unit_price || 0
                                    );
                                    const total = detail.total
                                      ? parseFloat(detail.total)
                                      : mbps * unitPrice;
                                    const startDate = detail.start_date
                                      ? new Date(
                                          detail.start_date
                                        ).toLocaleDateString()
                                      : "-";
                                    // Use end_date if available, otherwise calculate end of month from start_date
                                    const endDate = detail.end_date
                                      ? new Date(
                                          detail.end_date
                                        ).toLocaleDateString()
                                      : detail.start_date
                                      ? getEndOfMonth(detail.start_date)?.toLocaleDateString() || "-"
                                      : "-";

                                    return (
                                      <tr
                                        key={index}
                                        className={`border-t ${
                                          isDark
                                            ? "border-dark-600"
                                            : "border-gray-200"
                                        }`}
                                      >
                                        <td className="px-3 py-2">
                                          {packageName}
                                        </td>
                                        
                                        <td className="px-3 py-2">
                                          {startDate}
                                        </td>
                                        <td className="px-3 py-2">{endDate}</td>
                                        <td className="px-3 py-2">{mbps}</td>
                                        <td className="px-3 py-2 text-right">
                                          BDT{" "}
                                          {parseFloat(
                                            unitPrice
                                          ).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold">
                                          BDT{" "}
                                          {parseFloat(total).toLocaleString()}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Package History - All Details Including Expired */}
                    {(() => {
                      const allDetails = viewingBill.details;
                      // Filter for inactive/expired details
                      const historicalDetails =
                        allDetails?.filter(
                          (d) => !d.is_active || d.status !== "active"
                        ) || [];

                      if (
                        !historicalDetails ||
                        !Array.isArray(historicalDetails) ||
                        historicalDetails.length === 0
                      ) {
                        return null;
                      }

                      return (
                        <>
                          <div className="md:col-span-2 lg:col-span-3">
                            <h4
                              className={`text-lg font-semibold mb-3 mt-4 ${
                                isDark ? "text-amber-400" : "text-amber-600"
                              }`}
                            >
                              Package History (Previous Changes)
                            </h4>
                          </div>
                          <div className="md:col-span-2 lg:col-span-3">
                            <div className="overflow-x-auto">
                              <table
                                className={`w-full text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                <thead
                                  className={`${
                                    isDark ? "bg-dark-700" : "bg-gray-100"
                                  }`}
                                >
                                  <tr>
                                    <th className="px-3 py-2 text-left">
                                      Package Name
                                    </th>
                                    
                                    <th className="px-3 py-2 text-left">
                                      Start Date
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      End Date
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      MBPS
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Unit Price
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Total
                                    </th>
                                    <th className="px-3 py-2 text-center">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>{historicalDetails
                                    .sort(
                                      (a, b) =>
                                        new Date(b.start_date) -
                                        new Date(a.start_date)
                                    )
                                    .map((detail, index) => {
                                      // Extract package name from various fields
                                      let packageName =
                                        detail.package_name ||
                                        detail.package ||
                                        "";
                                      if (!packageName && detail.remarks) {
                                        // Try to extract from remarks format: "PACKAGE_NAME - other info"
                                        const match =
                                          detail.remarks.match(/^([^-]+)/);
                                        if (match) {
                                          packageName = match[1].trim();
                                        }
                                      }
                                      if (!packageName) packageName = "N/A";

                                      const bandwidthType =
                                        detail.bandwidth_type ||
                                        detail.type ||
                                        "-";
                                      const mbps = parseFloat(
                                        detail.mbps || detail.bandwidth || 0
                                      );
                                      const unitPrice = parseFloat(
                                        detail.unit_price || 0
                                      );
                                      const total = detail.total
                                        ? parseFloat(detail.total)
                                        : mbps * unitPrice;
                                      const startDate = detail.start_date
                                        ? new Date(
                                            detail.start_date
                                          ).toLocaleDateString()
                                        : "-";
                                      // Use end_date if available, otherwise calculate end of month from start_date
                                      const endDate = detail.end_date
                                        ? new Date(
                                            detail.end_date
                                          ).toLocaleDateString()
                                        : detail.start_date
                                        ? getEndOfMonth(detail.start_date)?.toLocaleDateString() || "-"
                                        : "-";

                                      return (
                                        <tr
                                          key={`history-${index}`}
                                          className={`border-t ${
                                            isDark
                                              ? "border-dark-600 opacity-70"
                                              : "border-gray-200 opacity-70"
                                          }`}
                                        >
                                          <td className="px-3 py-2">
                                            {packageName}
                                          </td>
                                          
                                          <td className="px-3 py-2">
                                            {startDate}
                                          </td>
                                          <td className="px-3 py-2">
                                            {endDate}
                                          </td>
                                          <td className="px-3 py-2">{mbps}</td>
                                          <td className="px-3 py-2 text-right">
                                            BDT{" "}
                                            {parseFloat(
                                              unitPrice
                                            ).toLocaleString()}
                                          </td>
                                          <td className="px-3 py-2 text-right font-semibold">
                                            BDT{" "}
                                            {parseFloat(total).toLocaleString()}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span
                                              className={`px-2 py-1 text-xs rounded ${
                                                detail.status === "expired"
                                                  ? isDark
                                                    ? "bg-red-900/30 text-red-400"
                                                    : "bg-red-100 text-red-700"
                                                  : isDark
                                                  ? "bg-gray-700 text-gray-400"
                                                  : "bg-gray-200 text-gray-700"
                                              }`}
                                            >
                                              {detail.status}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Services */}
                    {(() => {
                      const services = getServiceTotals(viewingBill);
                      const hasServices =
                        services.iig_qt_price > 0 ||
                        services.fna_price > 0 ||
                        services.ggc_price > 0 ||
                        services.cdn_price > 0 ||
                        services.bdix_price > 0 ||
                        services.baishan_price > 0;

                      if (!hasServices) return null;

                      return (
                        <>
                          <div className="md:col-span-2 lg:col-span-3">
                            <h4
                              className={`text-lg font-semibold mb-3 mt-4 ${
                                isDark ? "text-blue-400" : "text-blue-600"
                              }`}
                            >
                              Services
                            </h4>
                          </div>
                          {services.iig_qt_price > 0 && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  IIG-QT (MBPS)
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  {services.iig_qt.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  IIG-QT Price
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  BDT {services.iig_qt_price.toLocaleString()}
                                </p>
                              </div>
                            </>
                          )}
                          {services.fna_price > 0 && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  FNA (MBPS)
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  {services.fna.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  FNA Price
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  BDT {services.fna_price.toLocaleString()}
                                </p>
                              </div>
                            </>
                          )}
                          {services.ggc_price > 0 && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  GGC (MBPS)
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  {services.ggc.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  GGC Price
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  BDT {services.ggc_price.toLocaleString()}
                                </p>
                              </div>
                            </>
                          )}
                          {services.cdn_price > 0 && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  CDN (MBPS)
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  {services.cdn.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  CDN Price
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  BDT {services.cdn_price.toLocaleString()}
                                </p>
                              </div>
                            </>
                          )}
                          {services.bdix_price > 0 && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  BDIX (MBPS)
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  {services.bdix.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  BDIX Price
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  BDT {services.bdix_price.toLocaleString()}
                                </p>
                              </div>
                            </>
                          )}
                          {services.baishan_price > 0 && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  BAISHAN (MBPS)
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  {services.baishan.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  BAISHAN Price
                                </label>
                                <p
                                  className={`text-sm ${
                                    isDark ? "text-silver-400" : "text-gray-600"
                                  }`}
                                >
                                  BDT {services.baishan_price.toLocaleString()}
                                </p>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}

                    {/* Financial Summary */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Financial Summary
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Bill incl VAT
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_billed !==
                          undefined &&
                        viewingBill.customer_master?.total_billed !== null
                          ? `BDT ${viewingBill.customer_master.total_billed.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Received
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-green-400" : "text-green-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_paid !==
                          undefined &&
                        viewingBill.customer_master?.total_paid !== null
                          ? `BDT ${viewingBill.customer_master.total_paid.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Due
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-red-400" : "text-red-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_due !== undefined &&
                        viewingBill.customer_master?.total_due !== null
                          ? `BDT ${viewingBill.customer_master.total_due.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Discount
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.discount
                          ? `BDT ${viewingBill.discount.toLocaleString()}`
                          : "0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Status
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.status || "N/A"}
                      </p>
                    </div>

                    {/* Remarks */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium mb-1">
                        Remarks
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.remarks || "N/A"}
                      </p>
                    </div>

                    {/* Audit Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Audit Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Created By
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.created_by_details?.username ||
                          viewingBill.created_by ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Updated By
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.updated_by_details?.username ||
                          viewingBill.updated_by ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Created At
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.created_at
                          ? new Date(viewingBill.created_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Updated At
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.updated_at
                          ? new Date(viewingBill.updated_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleViewClose}
                      className={`px-6 py-2 rounded-lg font-medium ${
                        isDark
                          ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Close
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
      </AnimatePresence>

      {/* View Modal - Channel Partner */}
      <AnimatePresence>
        {showViewModal &&
          viewingBill &&
          false &&
          (viewingBill.customer_master?.customer_type === "channel_partner" ||
            viewingBill.customer_type === "channel_partner" ||
            customerTypeFilter === "Channel") && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleViewClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={`w-full max-w-4xl rounded-2xl p-6 shadow-2xl ${
                    isDark
                      ? "bg-dark-800 border border-dark-700"
                      : "bg-white border border-gray-200"
                  } max-h-[90vh] overflow-y-auto`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3
                      className={`text-2xl font-serif font-bold ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      Channel Partner Bill Details
                    </h3>
                    <button
                      onClick={handleViewClose}
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        isDark
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Bill Number - Featured */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <div
                        className={`p-4 rounded-lg ${
                          isDark
                            ? "bg-blue-900/20 border border-blue-800"
                            : "bg-blue-50 border border-blue-200"
                        }`}
                      >
                        <label className="block text-sm font-medium mb-1">
                          Bill Number
                        </label>
                        <p
                          className={`text-lg font-semibold ${
                            isDark ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          {viewingBill.bill_number || viewingBill.id || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Customer Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Customer Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        NTTN
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.nttn_company ||
                          viewingBill.nttn_com ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        NTTN Capacity
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.nttn_capacity ||
                          viewingBill.nttn_cap ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Link/SRC ID
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.link_id ||
                          viewingBill.link_scr_id ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Activation Date
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.activation_date
                          ? new Date(
                              viewingBill.activation_date
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>

                    {/* Channel Partner Specific Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Channel Partner Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Client
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_client ||
                          viewingBill.total_client ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Active Client
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_active_client ||
                          viewingBill.total_active_client ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Previous Total Client
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.customer_master?.previous_total_client ||
                          viewingBill.previous_total_client ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Free Giveaway Client
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.customer_master?.free_giveaway_client ||
                          viewingBill.free_giveaway_client ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Last Bill/Invoice Date
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.customer_master?.last_bill_invoice_date ||
                        viewingBill.last_bill_invoice_date
                          ? new Date(
                              viewingBill.customer_master
                                ?.last_bill_invoice_date ||
                                viewingBill.last_bill_invoice_date
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>

                    {/* Package Details - Current */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Package Details (Current)
                      </h4>
                    </div>
                    {(() => {
                      const activeDetails =
                        viewingBill.details?.filter(
                          (d) => d.is_active && d.status === "active"
                        ) || [];
                      return activeDetails.length > 0 ? (
                        <div className="md:col-span-2 lg:col-span-3">
                          <div className="overflow-x-auto">
                            <table
                              className={`w-full text-sm ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              <thead
                                className={`${
                                  isDark ? "bg-dark-700" : "bg-gray-100"
                                }`}
                              >
                                <tr>
                                  <th className="px-3 py-2 text-left">
                                    Package Name
                                  </th>
                                  <th className="px-3 py-2 text-left">Mbps</th>
                                  <th className="px-3 py-2 text-right">
                                    Unit Price
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Client %
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Start Date
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    End Date
                                  </th>
                                </tr>
                              </thead>
                              <tbody>{activeDetails.map((detail, index) => (
                                  <tr
                                    key={index}
                                    className={`border-t ${
                                      isDark
                                        ? "border-dark-600"
                                        : "border-gray-200"
                                    }`}
                                  >
                                    <td className="px-3 py-2">
                                      {detail.package_name || "N/A"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {detail.mbps || "0"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {detail.unit_price
                                        ? parseFloat(
                                            detail.unit_price
                                          ).toLocaleString()
                                        : "0"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {detail.custom_mac_percentage_share ||
                                        "0"}
                                      %
                                    </td>
                                    <td className="px-3 py-2">
                                      {detail.start_date
                                        ? new Date(
                                            detail.start_date
                                          ).toLocaleDateString()
                                        : "N/A"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {detail.end_date
                                        ? new Date(
                                            detail.end_date
                                          ).toLocaleDateString()
                                        : new Date().toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="md:col-span-2 lg:col-span-3">
                          <p
                            className={`text-sm ${
                              isDark ? "text-silver-400" : "text-gray-600"
                            }`}
                          >
                            No active package details available
                          </p>
                        </div>
                      );
                    })()}

                    {/* Package History */}
                    {(() => {
                      const historicalDetails =
                        viewingBill.details?.filter(
                          (d) => !d.is_active || d.status !== "active"
                        ) || [];
                      return historicalDetails.length > 0 ? (
                        <>
                          <div className="md:col-span-2 lg:col-span-3">
                            <h4
                              className={`text-lg font-semibold mb-3 mt-4 ${
                                isDark ? "text-amber-400" : "text-amber-600"
                              }`}
                            >
                              Package History (Previous Changes)
                            </h4>
                          </div>
                          <div className="md:col-span-2 lg:col-span-3">
                            <div className="overflow-x-auto">
                              <table
                                className={`w-full text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                <thead
                                  className={`${
                                    isDark ? "bg-dark-700" : "bg-gray-100"
                                  }`}
                                >
                                  <tr>
                                    <th className="px-3 py-2 text-left">
                                      Package Name
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      Mbps
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Unit Price
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      Client %
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      Start Date
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      End Date
                                    </th>
                                    <th className="px-3 py-2 text-center">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>{historicalDetails
                                    .sort(
                                      (a, b) =>
                                        new Date(b.start_date) -
                                        new Date(a.start_date)
                                    )
                                    .map((detail, index) => (
                                      <tr
                                        key={`history-${index}`}
                                        className={`border-t ${
                                          isDark
                                            ? "border-dark-600 opacity-70"
                                            : "border-gray-200 opacity-70"
                                        }`}
                                      >
                                        <td className="px-3 py-2">
                                          {detail.package_name || "N/A"}
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.mbps || "0"}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {detail.unit_price
                                            ? parseFloat(
                                                detail.unit_price
                                              ).toLocaleString()
                                            : "0"}
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.custom_mac_percentage_share ||
                                            "0"}
                                          %
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.start_date
                                            ? new Date(
                                                detail.start_date
                                              ).toLocaleDateString()
                                            : "N/A"}
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.end_date
                                            ? new Date(
                                                detail.end_date
                                              ).toLocaleDateString()
                                            : new Date().toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span
                                            className={`px-2 py-1 text-xs rounded ${
                                              detail.status === "expired"
                                                ? isDark
                                                  ? "bg-red-900/30 text-red-400"
                                                  : "bg-red-100 text-red-700"
                                                : isDark
                                                ? "bg-gray-700 text-gray-400"
                                                : "bg-gray-200 text-gray-700"
                                            }`}
                                          >
                                            {detail.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      ) : null;
                    })()}

                    {/* Financial Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Financial Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Bill incl VAT
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_billed !==
                          undefined &&
                        viewingBill.customer_master?.total_billed !== null
                          ? `BDT ${viewingBill.customer_master.total_billed.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Received
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-green-400" : "text-green-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_paid !==
                          undefined &&
                        viewingBill.customer_master?.total_paid !== null
                          ? `BDT ${viewingBill.customer_master.total_paid.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Due
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-red-400" : "text-red-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_due !== undefined &&
                        viewingBill.customer_master?.total_due !== null
                          ? `BDT ${viewingBill.customer_master.total_due.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        KAM Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).kam_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Status
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {(() => {
                          // Prioritize master bill status
                          if (viewingBill.status !== null && viewingBill.status !== undefined) {
                            return viewingBill.status;
                          }
                          // If master status is missing, check if any detail is active
                          if (viewingBill.details && viewingBill.details.length > 0) {
                            const hasActiveDetail = viewingBill.details.some(
                              (detail) => detail.status && detail.status.toLowerCase() === "active"
                            );
                            return hasActiveDetail ? "Active" : "Inactive";
                          }
                          return "N/A";
                        })()}
                      </p>
                    </div>

                    {/* Remarks */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium mb-1">
                        Remarks
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.remarks || "N/A"}
                      </p>
                    </div>

                    {/* Audit Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Audit Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Created By
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.created_by_details?.username ||
                          viewingBill.created_by ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Updated By
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.updated_by_details?.username ||
                          viewingBill.updated_by ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Created At
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.created_at
                          ? new Date(viewingBill.created_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Updated At
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.updated_at
                          ? new Date(viewingBill.updated_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleViewClose}
                      className={`px-6 py-2 rounded-lg font-medium ${
                        isDark
                          ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Close
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
      </AnimatePresence>

      {/* View Modal - Home/SOHO */}
      <AnimatePresence>
        {showViewModal &&
          viewingBill &&
          (viewingBill.customer_master?.customer_type === "soho" ||
            viewingBill.customer_type === "soho" ||
            customerTypeFilter === "Home/SOHO") && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleViewClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={`w-full max-w-4xl rounded-2xl p-6 shadow-2xl ${
                    isDark
                      ? "bg-dark-800 border border-dark-700"
                      : "bg-white border border-gray-200"
                  } max-h-[90vh] overflow-y-auto`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3
                      className={`text-2xl font-serif font-bold ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      Home/SOHO Bill Details
                    </h3>
                    <button
                      onClick={handleViewClose}
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        isDark
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Bill Number - Featured */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <div
                        className={`p-4 rounded-lg ${
                          isDark
                            ? "bg-blue-900/20 border border-blue-800"
                            : "bg-blue-50 border border-blue-200"
                        }`}
                      >
                        <label className="block text-sm font-medium mb-1">
                          Bill Number
                        </label>
                        <p
                          className={`text-lg font-semibold ${
                            isDark ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          {viewingBill.bill_number || viewingBill.id || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Customer Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Customer Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Type of Connection
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.type_of_connection || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Connected POP
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.connected_pop || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Address
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).address || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Contact Number
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).phone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Activation Date
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.created_at
                          ? new Date(
                              viewingBill.created_at
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>

                    {/* Package Details - Current */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Package Details (Current)
                      </h4>
                    </div>
                    {(() => {
                      const activeDetails =
                        viewingBill.details?.filter(
                          (d) => d.is_active && d.status === "active"
                        ) || [];
                      return activeDetails.length > 0 ? (
                        <div className="md:col-span-2 lg:col-span-3">
                          <div className="overflow-x-auto">
                            <table
                              className={`w-full text-sm ${
                                isDark ? "text-silver-300" : "text-gray-700"
                              }`}
                            >
                              <thead
                                className={`${
                                  isDark ? "bg-dark-700" : "bg-gray-100"
                                }`}
                              >
                                <tr>
                                  <th className="px-3 py-2 text-left">
                                    Package Name
                                  </th>
                                  <th className="px-3 py-2 text-left">Mbps</th>
                                  <th className="px-3 py-2 text-right">
                                    Unit Price
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Start Date
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    End Date
                                  </th>
                                </tr>
                              </thead>
                              <tbody>{activeDetails.map((detail, index) => (
                                  <tr
                                    key={index}
                                    className={`border-t ${
                                      isDark
                                        ? "border-dark-600"
                                        : "border-gray-200"
                                    }`}
                                  >
                                    <td className="px-3 py-2">
                                      {detail.package_name || "N/A"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {detail.mbps || "0"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {detail.unit_price
                                        ? parseFloat(
                                            detail.unit_price
                                          ).toLocaleString()
                                        : "0"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {detail.start_date
                                        ? new Date(
                                            detail.start_date
                                          ).toLocaleDateString()
                                        : "N/A"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {detail.end_date
                                        ? new Date(
                                            detail.end_date
                                          ).toLocaleDateString()
                                        : detail.start_date
                                        ? getEndOfMonth(detail.start_date)?.toLocaleDateString() || "-"
                                        : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="md:col-span-2 lg:col-span-3">
                          <p
                            className={`text-sm ${
                              isDark ? "text-silver-400" : "text-gray-600"
                            }`}
                          >
                            No active package details available
                          </p>
                        </div>
                      );
                    })()}

                    {/* Package History */}
                    {(() => {
                      const historicalDetails =
                        viewingBill.details?.filter(
                          (d) => !d.is_active || d.status !== "active"
                        ) || [];
                      return historicalDetails.length > 0 ? (
                        <>
                          <div className="md:col-span-2 lg:col-span-3">
                            <h4
                              className={`text-lg font-semibold mb-3 mt-4 ${
                                isDark ? "text-amber-400" : "text-amber-600"
                              }`}
                            >
                              Package History (Previous Changes)
                            </h4>
                          </div>
                          <div className="md:col-span-2 lg:col-span-3">
                            <div className="overflow-x-auto">
                              <table
                                className={`w-full text-sm ${
                                  isDark ? "text-silver-300" : "text-gray-700"
                                }`}
                              >
                                <thead
                                  className={`${
                                    isDark ? "bg-dark-700" : "bg-gray-100"
                                  }`}
                                >
                                  <tr>
                                    <th className="px-3 py-2 text-left">
                                      Package Name
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      Mbps
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Unit Price
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      Start Date
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      End Date
                                    </th>
                                    <th className="px-3 py-2 text-center">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>{historicalDetails
                                    .sort(
                                      (a, b) =>
                                        new Date(b.start_date) -
                                        new Date(a.start_date)
                                    )
                                    .map((detail, index) => (
                                      <tr
                                        key={`history-${index}`}
                                        className={`border-t ${
                                          isDark
                                            ? "border-dark-600 opacity-70"
                                            : "border-gray-200 opacity-70"
                                        }`}
                                      >
                                        <td className="px-3 py-2">
                                          {detail.package_name || "N/A"}
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.mbps || "0"}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {detail.unit_price
                                            ? parseFloat(
                                                detail.unit_price
                                              ).toLocaleString()
                                            : "0"}
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.start_date
                                            ? new Date(
                                                detail.start_date
                                              ).toLocaleDateString()
                                            : "N/A"}
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.end_date
                                            ? new Date(
                                                detail.end_date
                                              ).toLocaleDateString()
                                            : "-"}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span
                                            className={`px-2 py-1 text-xs rounded ${
                                              detail.status === "expired"
                                                ? isDark
                                                  ? "bg-red-900/30 text-red-400"
                                                  : "bg-red-100 text-red-700"
                                                : isDark
                                                ? "bg-gray-700 text-gray-400"
                                                : "bg-gray-200 text-gray-700"
                                            }`}
                                          >
                                            {detail.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      ) : null;
                    })()}

                    {/* Financial Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Financial Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Bill incl VAT
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_billed !==
                          undefined &&
                        viewingBill.customer_master?.total_billed !== null
                          ? `BDT ${viewingBill.customer_master.total_billed.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Received
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-green-400" : "text-green-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_paid !==
                          undefined &&
                        viewingBill.customer_master?.total_paid !== null
                          ? `BDT ${viewingBill.customer_master.total_paid.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Total Due
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? "text-red-400" : "text-red-600"
                        }`}
                      >
                        {viewingBill.customer_master?.total_due !== undefined &&
                        viewingBill.customer_master?.total_due !== null
                          ? `BDT ${viewingBill.customer_master.total_due.toLocaleString()}`
                          : "BDT 0"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        KAM Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getCustomerDetails(viewingBill).kam_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Status
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.details &&
                        viewingBill.details.length > 0 &&
                        viewingBill.details.some(
                          (d) => d.status === "active" || d.is_active
                        )
                          ? "Active"
                          : "Inactive"}
                      </p>
                    </div>

                    {/* Remarks */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium mb-1">
                        Remarks
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.remarks || "N/A"}
                      </p>
                    </div>

                    {/* Audit Information */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <h4
                        className={`text-lg font-semibold mb-3 mt-4 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Audit Information
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Created By
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.created_by_details?.username ||
                          viewingBill.created_by ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Updated By
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.updated_by_details?.username ||
                          viewingBill.updated_by ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Created At
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.created_at
                          ? new Date(viewingBill.created_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Updated At
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingBill.updated_at
                          ? new Date(viewingBill.updated_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleViewClose}
                      className={`px-6 py-2 rounded-lg font-medium ${
                        isDark
                          ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Close
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
      </AnimatePresence>

      {/* End Date Modal */}
      <AnimatePresence>
        {showEndDateModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleEndDateCancel}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${
                  isDark
                    ? "bg-dark-800 border border-dark-700"
                    : "bg-white border border-gray-200"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3
                  className={`text-xl font-bold text-center mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Enter End Date for Package
                </h3>

                {/* Message */}
                <p
                  className={`text-center mb-4 ${
                    isDark ? "text-silver-400" : "text-gray-600"
                  }`}
                >
                  Please enter the end date for closing this package.
                </p>

                {/* Date Picker */}
                <div className="mb-6">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={endDateForRemoval ? new Date(endDateForRemoval) : null}
                    onChange={(date) => {
                      if (date) {
                        // Format date in local timezone to avoid timezone shift issues
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        setEndDateForRemoval(formattedDate);
                      } else {
                        setEndDateForRemoval("");
                      }
                    }}
                    dateFormat="yyyy-MM-dd"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholderText="Select end date"
                    required
                  />
                </div>

                {/* Buttons */}
                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleEndDateCancel}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 text-white hover:bg-dark-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleEndDateConfirm}
                    className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Confirm
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleDeleteCancel}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${
                  isDark
                    ? "bg-dark-800 border border-dark-700"
                    : "bg-white border border-gray-200"
                }`}
              >
                {/* Warning Icon */}
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      isDark ? "bg-red-900/30" : "bg-red-100"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-8 h-8 ${
                        isDark ? "text-red-400" : "text-red-600"
                      }`}
                    />
                  </div>
                </div>

                {/* Title */}
                <h3
                  className={`text-xl font-bold text-center mb-2 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Delete Bill Record
                </h3>

                {/* Message */}
                <p
                  className={`text-center mb-6 ${
                    isDark ? "text-silver-400" : "text-gray-600"
                  }`}
                >
                  Are you sure you want to delete the bill record for{" "}
                  <span className="font-semibold text-red-500">
                    "
                    {billToDelete
                      ? getCustomerDetails(billToDelete).name
                      : "Unknown"}
                    "
                  </span>
                  ? This action cannot be undone.
                </p>

                {/* Buttons */}
                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeleteCancel}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 text-white hover:bg-dark-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeleteConfirm}
                    className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
