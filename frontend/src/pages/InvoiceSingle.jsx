import { useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import api from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import { Printer } from "lucide-react";
import "../styles/InvoiceSingle.css";
import qrWebsite from '../assets/qr website.png';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_BILLING_ADDRESS,
  COMPANY_BILLING_CONTACT,
  INVOICE_PAYMENT_FOOTER_NOTE,
} from '../constants/branding';

const InvoiceSingle = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const previewData = location.state?.previewData;
  const requestData = location.state?.requestData;

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);
  const [enrichedDetails, setEnrichedDetails] = useState(null);
  const [loadingEnrichment, setLoadingEnrichment] = useState(false);
  const [mergedDetails, setMergedDetails] = useState(null);

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '') return '';
    
    const numStr = num.toString();
    const parts = numStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    
    // Indian numbering system: first comma after 3 digits, then every 2 digits
    let formatted = '';
    const len = integerPart.length;
    
    if (len <= 3) {
      formatted = integerPart;
    } else {
      // First 3 digits from right
      formatted = integerPart.slice(-3);
      let remaining = integerPart.slice(0, -3);
      
      // Then every 2 digits
      while (remaining.length > 0) {
        if (remaining.length >= 2) {
          formatted = remaining.slice(-2) + ',' + formatted;
          remaining = remaining.slice(0, -2);
        } else {
          formatted = remaining + ',' + formatted;
          remaining = '';
        }
      }
    }
    
    return decimalPart ? `${formatted}.${decimalPart}` : formatted;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  };

  const getPackageName = (detail) => {
    const isGenericPackageName =
      !detail.package_name ||
      ["bw", "soho"].includes(
        String(detail.package_name).toLowerCase()
      );
    if (!isGenericPackageName) return detail.package_name;
    if (detail.remarks && detail.remarks.includes(" - ")) {
      const parts = detail.remarks.split(" - ").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) return parts[1];
      if (parts.length === 1) return parts[0];
    }
    if (detail.bandwidth_type) return detail.bandwidth_type;
    if (detail.remarks && detail.remarks.trim()) return detail.remarks.trim();
    return "-";
  };

  const renderDetailRow = (detail, index) => {
    const packageName = getPackageName(detail);
    return (
      <tr key={detail.detail_id || `detail-${index}`}>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>{index + 1}</td>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>{formatDate(detail.start_date)}</td>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>{formatDate(detail.end_date)}</td>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "left" }}>{packageName}</td>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right" }}>{detail.mbps ?? "-"}</td>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right" }}>{detail.days || "-"}</td>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right" }}>{detail.unit_price ?? detail.package_rate ? formatNumber(detail.unit_price ?? detail.package_rate) : "-"}</td>
        <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right" }}>{formatNumber(detail.amount)}</td>
      </tr>
    );
  };

  const numberToWords = (num) => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const convertHundreds = (n) => {
      if (n === 0) return '';
      let words = '';
      if (n >= 100) {
        words += ones[Math.floor(n / 100)] + ' hundred ';
        n %= 100;
      }
      if (n >= 20) {
        words += tens[Math.floor(n / 10)];
        if (n % 10 > 0) {
          words += '-' + ones[n % 10];
        }
        words += ' ';
        n = 0;
      }
      if (n >= 10) {
        words += teens[n - 10] + ' ';
      } else if (n > 0) {
        words += ones[n] + ' ';
      }
      return words.trim();
    };

    const convertInteger = (n) => {
      if (n === 0) return 'zero';
      let words = '';
      if (n >= 10000000) {
        const crores = Math.floor(n / 10000000);
        words += convertHundreds(crores) + ' crore ';
        n %= 10000000;
      }
      if (n >= 100000) {
        const lakhs = Math.floor(n / 100000);
        words += convertHundreds(lakhs) + ' lac ';
        n %= 100000;
      }
      if (n >= 1000) {
        const thousands = Math.floor(n / 1000);
        words += convertHundreds(thousands) + ' thousand ';
        n %= 1000;
      }
      if (n > 0) {
        words += convertHundreds(n);
      }
      return words.trim();
    };

    const capitalizeEachWord = (str) => {
      if (!str) return str;
      return str
        .split(' ')
        .map(word => {
          // Handle hyphenated words like "twenty-four"
          if (word.includes('-')) {
            return word
              .split('-')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join('-');
          }
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    };

    const parts = num.toString().split('.');
    let result = convertInteger(parseInt(parts[0])) + ' taka';
    if (parts[1] && parseInt(parts[1]) > 0) {
      const decimalPart = parts[1].padEnd(2, '0').substring(0, 2);
      const paise = parseInt(decimalPart);
      if (paise > 0) {
        result += ' and ' + convertHundreds(paise) + ' paise';
      }
    }
    return capitalizeEachWord(result.trim());
  };

  if (!previewData) {
    return (
      <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              No Preview Data
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please generate an invoice preview first from the invoice form.
            </p>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Back to Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Support both single-entitlement and multi-entitlement (zones) preview response
  const isMultiEntitlement = Array.isArray(previewData.entitlements) && previewData.entitlements.length > 0;
  const customer = previewData.customer;
  const originalCalculation = isMultiEntitlement
    ? previewData.aggregated
    : previewData.calculation;
  const entitlement = isMultiEntitlement
    ? previewData.entitlements[0]
    : previewData.entitlement;

  // Use merged details if available, otherwise use original calculation
  const calculation = mergedDetails || originalCalculation;

  // Discount: prefer form input (requestData) so entered value shows; fallback to calculation from API
  const _rawDiscount = requestData?.discount_rate ?? calculation?.discount_rate ?? 0;
  const discountRateNum = Number.isFinite(Number(_rawDiscount)) ? Number(_rawDiscount) : 0;
  const subtotalBill = Number(calculation?.total_bill ?? 0) || 0;
  const totalDiscountAmount =
    Number(calculation?.total_discount_amount ?? null) ??
    (discountRateNum > 0 ? subtotalBill * (discountRateNum / 100) : 0);
  const amountAfterDiscount = subtotalBill - totalDiscountAmount;
  const vatRateNum = Number(calculation?.vat_rate ?? 0) || 0;
  const displayTotalVatAmount =
    Number(calculation?.total_vat_amount ?? null) ??
    (amountAfterDiscount * (vatRateNum / 100));
  const displayTotalBillAmount =
    Number(calculation?.total_bill_amount ?? null) ??
    amountAfterDiscount + displayTotalVatAmount;

  // Fetch entitlement details to enrich package names for channel partners
  useEffect(() => {
    const enrichInvoiceDetails = async () => {
      // Use merged details if available, otherwise use original calculation
      const currentCalculation = mergedDetails || originalCalculation;
      
      if (!currentCalculation?.details || currentCalculation.details.length === 0) {
        return;
      }

      // Check if we need to enrich (missing package names or MBPS values)
      const needsEnrichment = currentCalculation.details.some(
        detail => detail.detail_id && (!detail.package_name || (detail.mbps == null))
      );

      if (!needsEnrichment) {
        console.log("No enrichment needed, all details have package names and MBPS");
        return;
      }
      
        console.log("Enrichment needed for details:", currentCalculation.details);

      setLoadingEnrichment(true);
      try {
        // Use customer_id from requestData or customer object
        const customerId = requestData?.customer_id || customer?.id;
        
        if (!customerId) {
          console.warn("No customer ID available for enrichment");
          return;
        }

        console.log("Fetching entitlements for customer:", customerId);
        
        // Fetch entitlement details for the customer
        const response = await api.get(
          `/bills/entitlements/?customer_id=${customerId}`
        );
        
        console.log("Entitlements API response:", response);
        
        const entitlementDetailsMap = {};
        // The API returns an array of entitlements, each with a details array
        // Handle both direct array and paginated response with results
        const entitlements = Array.isArray(response) ? response : (response?.results || []);
        
        entitlements.forEach(entitlement => {
          if (entitlement.details && Array.isArray(entitlement.details)) {
            entitlement.details.forEach(detail => {
              entitlementDetailsMap[detail.id] = detail;
            });
          }
        });

        console.log("Entitlement details map:", entitlementDetailsMap);
        console.log("Calculation details to enrich:", currentCalculation.details);

        // Enrich calculation details with package names and MBPS
        const enriched = currentCalculation.details.map(detail => {
          const entDetail = entitlementDetailsMap[detail.detail_id];
          console.log(`Matching detail_id ${detail.detail_id}:`, entDetail);
          
          if (entDetail) {
            const enrichedDetail = { ...detail };
            
            // Enrich package name for channel partner customers
            if (!detail.package_name) {
              if (entDetail.package_name) {
                enrichedDetail.package_name = entDetail.package_name;
              } else if (entDetail.mbps) {
                // Fallback: Generate package name from MBPS if package not assigned
                enrichedDetail.package_name = `${entDetail.mbps} Mbps`;
              }
            }
            
            // Enrich MBPS for all customers (especially SOHO)
            // Check multiple possible sources for MBPS
            // Only enrich if mbps is null or undefined (not if it's 0)
            if (detail.mbps == null) {
              console.log(`Enriching MBPS for detail ${detail.detail_id}:`, {
                entDetail_mbps: entDetail.mbps,
                package_pricing_mbps: entDetail.package_pricing?.mbps,
                package_master_mbps: entDetail.package_master?.mbps
              });
              
              if (entDetail.mbps != null) {
                enrichedDetail.mbps = entDetail.mbps;
                console.log(`Set MBPS from entDetail.mbps: ${entDetail.mbps}`);
              } else if (entDetail.package_pricing?.mbps != null) {
                enrichedDetail.mbps = entDetail.package_pricing.mbps;
                console.log(`Set MBPS from package_pricing: ${entDetail.package_pricing.mbps}`);
              } else if (entDetail.package_master?.mbps != null) {
                enrichedDetail.mbps = entDetail.package_master.mbps;
                console.log(`Set MBPS from package_master: ${entDetail.package_master.mbps}`);
              }
            }
            
            return enrichedDetail;
          }
          
          return detail;
        });

        console.log("Enriched details:", enriched);
        setEnrichedDetails(enriched);
      } catch (error) {
        console.error("Error enriching invoice details:", error);
        console.error("Error details:", error.response?.data);
        // If enrichment fails, continue with original data
      } finally {
        setLoadingEnrichment(false);
      }
    };

    enrichInvoiceDetails();
  }, [mergedDetails, originalCalculation, requestData]);

  // Fetch all entitlement details (including inactive) and merge with preview (single entitlement only)
  useEffect(() => {
    const fetchAndMergeInactivePackages = async () => {
      if (!originalCalculation?.details || !requestData?.entitlement_id) {
        return;
      }
      if (requestData?.entitlement_ids?.length > 1) {
        return; // Skip merge for multi-entitlement (zones) preview
      }

      setLoadingEnrichment(true);
      try {
        // Fetch all entitlement details for this entitlement (active and inactive)
        const entitlementResponse = await api.get(
          `/bills/entitlements/${requestData.entitlement_id}/details/`
        );
        
        const allDetails = Array.isArray(entitlementResponse) 
          ? entitlementResponse 
          : (entitlementResponse?.results || entitlementResponse?.data || []);

        console.log("All entitlement details (active and inactive):", allDetails);
        console.log("Preview calculation details:", originalCalculation.details);

        // Get detail IDs that are already in the preview
        const previewDetailIds = new Set(
          originalCalculation.details
            .map(d => d.detail_id)
            .filter(id => id != null)
        );

        // Find inactive details that are not in the preview
        const inactiveDetails = allDetails.filter(
          detail => 
            (!detail.is_active || detail.status === 'inactive') &&
            !previewDetailIds.has(detail.id)
        );

        console.log("Inactive details not in preview:", inactiveDetails);

        if (inactiveDetails.length === 0) {
          // No inactive packages to add
          setMergedDetails(null);
          return;
        }

        // Calculate billing for inactive packages
        const billingStartDate = new Date(originalCalculation.billing_start_date);
        const billingEndDate = new Date(originalCalculation.billing_end_date);
        
        const inactiveDetailsWithBilling = inactiveDetails.map(detail => {
          // Determine the actual billing period for this inactive package
          const detailStartDate = new Date(detail.start_date);
          const detailEndDate = detail.end_date ? new Date(detail.end_date) : billingEndDate;
          
          // Use the overlap period between detail dates and billing period
          const effectiveStartDate = detailStartDate > billingStartDate ? detailStartDate : billingStartDate;
          const effectiveEndDate = detailEndDate < billingEndDate ? detailEndDate : billingEndDate;
          
          // Calculate days
          const days = Math.max(1, Math.ceil((effectiveEndDate - effectiveStartDate) / (1000 * 60 * 60 * 24)) + 1);
          
          // Get unit price
          const unitPrice = detail.unit_price || detail.package_pricing?.unit_price || 0;
          
          // Calculate amount
          const amount = (unitPrice * days) || 0;
          
          // Get package name
          const packageName = detail.package_name || 
                             detail.package_master?.package_name || 
                             detail.bandwidth_type || 
                             detail.remarks?.split(' - ')[1] || 
                             'N/A';
          
          // Get MBPS
          const mbps = detail.mbps || 
                      detail.package_pricing?.mbps || 
                      detail.package_master?.mbps || 
                      null;

          return {
            detail_id: detail.id,
            package_name: packageName,
            start_date: effectiveStartDate.toISOString().split('T')[0],
            end_date: effectiveEndDate.toISOString().split('T')[0],
            days: days,
            mbps: mbps,
            unit_price: unitPrice,
            amount: amount,
            remarks: detail.remarks || '',
            is_inactive: true // Flag to identify inactive packages
          };
        });

        // Merge inactive details with preview details
        const merged = [...originalCalculation.details, ...inactiveDetailsWithBilling];
        
        // Recalculate totals (with optional discount: subtotal -> discount -> VAT on amount after discount)
        const newTotalBill = merged.reduce((sum, detail) => sum + (detail.amount || 0), 0);
        const vatRate = originalCalculation.vat_rate || 0;
        const discountRate = originalCalculation.discount_rate ?? requestData?.discount_rate ?? 0;
        const newTotalDiscountAmount = discountRate > 0 ? newTotalBill * (discountRate / 100) : 0;
        const newAmountAfterDiscount = newTotalBill - newTotalDiscountAmount;
        const newTotalVatAmount = newAmountAfterDiscount * (vatRate / 100);
        const newTotalBillAmount = newAmountAfterDiscount + newTotalVatAmount;

        console.log("Merged details with inactive packages:", merged);
        console.log("New totals:", { newTotalBill, newTotalDiscountAmount, newTotalVatAmount, newTotalBillAmount });

        setMergedDetails({
          ...originalCalculation,
          details: merged,
          total_bill: newTotalBill,
          discount_rate: discountRate,
          total_discount_amount: newTotalDiscountAmount,
          total_vat_amount: newTotalVatAmount,
          total_bill_amount: newTotalBillAmount,
          details_count: merged.length
        });
      } catch (error) {
        console.error("Error fetching and merging inactive packages:", error);
        // If error, continue with original preview data
        setMergedDetails(null);
      } finally {
        setLoadingEnrichment(false);
      }
    };

    fetchAndMergeInactivePackages();
  }, [originalCalculation, requestData]);

  const handleBackToForm = () => {
    navigate("/invoice");
  };

  const handlePrint = () => window.print();

  const handleCreateInvoice = async () => {
    if (!requestData) return;

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const createData = { ...requestData, force: false };
      console.log("Creating invoice with data:", createData);
      const response = await api.post(
        "/bills/invoices/auto-generate/",
        createData
      );
      console.log("Create invoice response:", response);
      
      const invoiceId = response.invoice?.id || response?.id;
      
      // If we have merged details with inactive packages, add them to the invoice
      if (mergedDetails && invoiceId && mergedDetails.details) {
        try {
          // Get the inactive packages that were added in the preview
          const inactivePackagesInPreview = mergedDetails.details.filter(
            detail => detail.is_inactive === true
          );
          
          if (inactivePackagesInPreview.length > 0) {
            console.log("Adding inactive packages to invoice:", inactivePackagesInPreview);
            
            // Fetch all entitlement details to get full detail objects
            const entitlementResponse = await api.get(
              `/bills/entitlements/${requestData.entitlement_id}/details/`
            );
            
            const allDetails = Array.isArray(entitlementResponse) 
              ? entitlementResponse 
              : (entitlementResponse?.results || entitlementResponse?.data || []);
            
            // Get existing invoice details to check what's already included
            const invoiceDetailsResponse = await api.get(
              `/bills/invoice-details/?invoice_master_id=${invoiceId}`
            );
            
            const existingDetails = Array.isArray(invoiceDetailsResponse)
              ? invoiceDetailsResponse
              : (invoiceDetailsResponse?.results || invoiceDetailsResponse?.data || []);
            
            const existingDetailIds = new Set(
              existingDetails.map(d => d.entitlement_details_id?.id || d.entitlement_details_id)
            );
            
            // Create invoice details for missing inactive packages
            for (const inactiveDetail of inactivePackagesInPreview) {
              const entitlementDetail = allDetails.find(d => d.id === inactiveDetail.detail_id);
              
              if (entitlementDetail && !existingDetailIds.has(entitlementDetail.id)) {
                // Calculate VAT for this detail
                const subTotal = inactiveDetail.amount || 0;
                const vatRate = mergedDetails.vat_rate || 0;
                const vatAmount = subTotal * (vatRate / 100);
                
                // Format dates properly (ensure they're strings in YYYY-MM-DD format)
                const formatDate = (dateStr) => {
                  if (!dateStr) return null;
                  const date = new Date(dateStr);
                  if (isNaN(date.getTime())) return null;
                  return date.toISOString().split('T')[0];
                };
                
                // Create invoice detail
                const invoiceDetailData = {
                  invoice_master_id: invoiceId,
                  entitlement_details_id: entitlementDetail.id,
                  sub_total: parseFloat(subTotal.toFixed(2)),
                  vat_rate: parseFloat(vatRate.toFixed(2)),
                  start_date: formatDate(inactiveDetail.start_date),
                  end_date: formatDate(inactiveDetail.end_date),
                  type: customer?.type || 'bw',
                  package_pricing_id: entitlementDetail.package_pricing_id || null,
                  package_master_id: entitlementDetail.package_master_id || null,
                  mbps: entitlementDetail.mbps || inactiveDetail.mbps || null,
                  unit_price: entitlementDetail.unit_price || inactiveDetail.unit_price || null,
                  custom_mac_percentage_share: entitlementDetail.custom_mac_percentage_share || null,
                  remarks: inactiveDetail.remarks || entitlementDetail.remarks || ''
                };
                
                console.log("Creating invoice detail for inactive package:", invoiceDetailData);
                
                await api.post("/bills/invoice-details/", invoiceDetailData);
              }
            }
            
            console.log("Successfully added inactive packages to invoice");
          }
        } catch (addError) {
          console.error("Error adding inactive packages to invoice:", addError);
          // Don't fail the entire operation if adding inactive packages fails
          // The invoice was created successfully, just missing inactive packages
        }
      }
      
      setCreateSuccess(
        `Invoice ${response.invoice?.invoice_number || "created"} successfully!`
      );
      // Navigate to invoice view to show created invoice with all zones
      setTimeout(() => {
        if (response.invoice) {
          navigate("/invoice-view", { state: { invoice: response.invoice } });
        } else {
          navigate("/invoices");
        }
      }, 2000);
    } catch (err) {
      console.error("Error creating invoice:", err);
      console.error("Error response:", err.response);
      console.error("Error response data:", err.response?.data);
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to create invoice. Please try again.";
      setCreateError(errorMessage);
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
            .fixed.left-0 {
              display: none !important;
            }
            .fixed.inset-0 {
              display: none !important;
            }
            .fixed.top-4.right-4 {
              display: none !important;
            }
            .print-content {
              margin: 0;
              padding: 0px;
              box-shadow: none;
              background-color: white;
            }
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center no-print">
          <button
            onClick={handleBackToForm}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Form
          </button>

          <div className="flex space-x-2">
            <button
              onClick={handleCreateInvoice}
              disabled={creating}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center ${
                creating
                  ? "bg-gray-400 cursor-not-allowed text-gray-200"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {creating ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Creating...</span>
                </>
              ) : (
                "Create Invoice"
              )}
            </button>
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
          </div>
        </div>

        {/* Create Error Alert */}
        {createError && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700">
            {createError}
          </div>
        )}

        {/* Create Success Alert */}
        {createSuccess && (
          <div className="mb-6 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700">
            {createSuccess}
          </div>
        )}
        <div
          className="print-content"
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: "12px",
            lineHeight: "1.4",
            margin: "0 auto",
            padding: "20px",
            width: "200mm",
            height: "280mm",
            boxSizing: "border-box",
            backgroundColor: "white",
            boxShadow: "none",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "400px",
              height: "400px",
              opacity: "0.05",
              zIndex: "1000",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: "120px",
                fontWeight: 800,
                color: "rgba(15, 23, 42, 0.06)",
              }}
              aria-hidden
            >
              ISP
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "00px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                width: "200px",
                minHeight: "60px",
                display: "flex",
                alignItems: "center",
                fontWeight: 800,
                fontSize: "18px",
                color: "#0f172a",
              }}
            >
              {COMPANY_LEGAL_NAME}
            </div>
            <div style={{ textAlign: 'center', flex: '1' }}>
              <h1 style={{ fontSize: '24px', margin: '0' }}>INVOICE</h1>
            </div>
            <div style={{ width: '200px', height: 'auto', display: 'flex', justifyContent: 'flex-end' }} >
            <img 
              src={qrWebsite} 
              alt="QR Code" 
              style={{ width: '80px', height: 'auto', boxShadow: 'none', display: 'block', objectFit: 'contain', minHeight: '60px' }}
              onError={(e) => { 
                console.error('Failed to load QR image:', e.target.src);
                // Keep image visible even on error - don't hide it
                e.target.style.border = '1px dashed #ccc';
                e.target.style.backgroundColor = '#f9f9f9';
              }}
              onLoad={() => {
                console.log('QR image loaded successfully');
              }}
            />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <p>
              <strong>{COMPANY_LEGAL_NAME}</strong>
            </p>
            <p>{COMPANY_BILLING_ADDRESS}</p>
            <p>{COMPANY_BILLING_CONTACT}</p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            <div style={{ width: "48%" }}>
              <p>
                <strong>Name: </strong>
                {entitlement?.customer_master?.company_name || customer?.name || '-'}
              </p>
              {/* <p>
                <strong>Customer ID: </strong>
                {customer.id}
              </p> */}
              {/* <p>
                <strong>Customer Type: </strong>
                {customer.type}
              </p> */}
              <p>
                <strong>Issue Date: </strong>
                {formatDate(new Date().toISOString())}
              </p>
            </div>
            <div style={{ width: "48%" }}>
              <p>
                <strong>Invoice For:</strong>{" "}
                {formatDate(calculation.billing_start_date)}{" "}
                <strong>-</strong>{" "}
                {formatDate(calculation.billing_end_date)}
              </p>
              <p>
                <strong>Invoice No:</strong> Preview
              </p>
            </div>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "center",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  SL No.
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "center",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  Start Date
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "center",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  End Date
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "left",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  Package
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "right",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  MBPS
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "right",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  Days
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "right",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  Rate
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "right",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  Total (taka)
                </th>
              </tr>
            </thead>
            <tbody>
              {isMultiEntitlement
                ? (() => {
                    // Flatten all details from entitlements into a single list (no zone grouping)
                    const allDetails = (previewData.entitlements || []).flatMap(
                      (ent) => ent.calculation?.details || []
                    );
                    return allDetails.length > 0
                      ? allDetails.map((detail, index) => renderDetailRow(detail, index))
                      : (
                          <tr>
                            <td
                              colSpan={8}
                              style={{
                                border: "1px solid #000",
                                padding: "8px 4px",
                                textAlign: "center",
                                fontStyle: "italic",
                                color: "#666",
                              }}
                            >
                              No billable items for this period
                            </td>
                          </tr>
                        );
                  })()
                : (() => {
                    const detailsToRender =
                      enrichedDetails ||
                      (mergedDetails?.details || calculation?.details || []);
                    return (detailsToRender || []).map((detail, index) =>
                      renderDetailRow(detail, index)
                    );
                  })()}
              <tr>
                <td colSpan={7} style={{ border: "1px solid #000", padding: "2px", textAlign: "right", fontWeight: "bold" }}>Subtotal (without VAT):</td>
                <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right", fontWeight: "bold" }}>{formatNumber(subtotalBill)}</td>
              </tr>
              {totalDiscountAmount > 0 && (
                <tr>
                  <td colSpan={7} style={{ border: "1px solid #000", padding: "2px", textAlign: "right", fontWeight: "bold" }}>
                    {discountRateNum > 0 ? `Discount (${discountRateNum}%):` : "Discount:"}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right", fontWeight: "bold" }}>-{formatNumber(totalDiscountAmount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={7} style={{ border: "1px solid #000", padding: "2px", textAlign: "right", fontWeight: "bold" }}>
                  VAT ({(calculation?.vat_rate ?? 0)}%):
                </td>
                <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right", fontWeight: "bold" }}>{formatNumber(displayTotalVatAmount)}</td>
              </tr>
              <tr>
                <td colSpan={7} style={{ border: "1px solid #000", padding: "5px", textAlign: "right", fontWeight: "bold" }}>Total (with VAT):</td>
                <td style={{ border: "1px solid #000", padding: "2px", textAlign: "right", fontWeight: "bold" }}>{formatNumber(displayTotalBillAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div data-invoice-footer style={{ paddingTop: '10px', fontSize: '10px' }}>
            <h4 style={{ fontFamily: '"Inter", sans-serif', fontSize: '16px', }}>Total: {formatNumber(displayTotalBillAmount)} BDT</h4>
            <h5 style={{ fontFamily: '"Inter", sans-serif', fontSize: '12px', }}>In Word: {numberToWords(displayTotalBillAmount)} Only</h5>
            <p>Thank you for being a valued customer.</p>
            <p style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>System Generated Invoice</p>
            <hr />
            <h5>Payment</h5>
            <p>{INVOICE_PAYMENT_FOOTER_NOTE}</p>
          </div>
          
        </div>


        </div>
      </div>
  );
};

export default InvoiceSingle;
