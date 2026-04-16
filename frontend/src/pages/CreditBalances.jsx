import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(value ?? 0);
}

export default function CreditBalances() {
  const { isDark } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get("/customers/credit-balances/")
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch((e) => {
        setError(e.response?.data?.error || e.message || "Failed to load credit balances");
        setCustomers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalCredit = customers.reduce((sum, c) => sum + (c.credit_balance || 0), 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Customer Credit Balances</h1>
        <p className={`mt-1 text-sm ${isDark ? "text-silver-400" : "text-gray-500"}`}>
          Customers with advance/overpayment credit. Use in Payment (Credit Balance) or Fund Transfer.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {!loading && (
        <>
          <div className={`mb-6 p-4 rounded-lg ${isDark ? "bg-dark-600" : "bg-gray-50"}`}>
            <p className={`text-sm ${isDark ? "text-silver-300" : "text-gray-600"}`}>Total Credit Across Customers</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCredit)}</p>
          </div>

          <div className={`rounded-lg shadow-sm border overflow-hidden ${isDark ? "bg-dark-700 border-dark-600" : "bg-white border-gray-200"}`}>
            {customers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No customers with credit balance.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={isDark ? "bg-dark-600" : "bg-gray-50"}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer #</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit Balance</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-gray-200 ${isDark ? "bg-dark-700" : "bg-white"}`}>
                    {customers.map((c) => (
                      <tr key={c.customer_id} className={isDark ? "hover:bg-dark-600" : "hover:bg-gray-50"}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-silver-200">
                          {c.customer_name || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-silver-400">
                          {c.customer_number || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                          {formatCurrency(c.credit_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
