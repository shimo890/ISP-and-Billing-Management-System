import { useLocation, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, Printer, Share2 } from 'lucide-react';
import { COMPANY_LEGAL_NAME } from '../constants/branding';

const PaymentView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const payment = location.state?.payment;
  const paymentRef = useRef();
  const [showShare, setShowShare] = useState(false);

  if (!payment) {
    return (
      <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Payment Data</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Please select a payment from the payments list.</p>
            <button
              onClick={() => navigate('/payments')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Back to Payments
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleBackToPayments = () => {
    navigate('/payments');
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    const canvas = await html2canvas(paymentRef.current, {
      useCORS: true,
      allowTaint: true
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 30;
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`payment-${payment.id}.pdf`);
  };

  const handleShareEmail = () => {
    const subject = `Payment ${payment.id}`;
    const body = `Dear Customer,\n\nPlease find your payment details.\n\nPayment ID: ${payment.id}\nTotal Amount: ${payment.total_paid} BDT\n\nRegards,\n${COMPANY_LEGAL_NAME}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleShareWhatsApp = async () => {
    const canvas = await html2canvas(paymentRef.current, {
      useCORS: true,
      allowTaint: true
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 30;
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], `payment-${payment.id}.pdf`, { type: 'application/pdf' });

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment ${payment.id}`,
          text: `Payment ${payment.id}\nTotal: ${payment.total_paid} BDT\nFrom ${COMPANY_LEGAL_NAME}`,
          files: [file]
        });
      } catch (error) {
        console.error('Error sharing:', error);
        // Fallback to download
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payment-${payment.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      // Fallback to download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-${payment.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
              padding: 20px;
              box-shadow: none;
              background-color: white;
              border-radius: 0;
            }
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center no-print">
          <div className="flex gap-2">
          <button
            onClick={handleBackToPayments}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Payments
          </button>
          <button
            onClick={() => navigate(`/payment-edit/${payment.id}`, { state: { payment } })}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Payment
          </button>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleDownloadPDF}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </button>
            <div className="relative">
              <button
                onClick={() => setShowShare(!showShare)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </button>
              {showShare && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
                  <button onClick={() => { handleShareEmail(); setShowShare(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Email</button>
                  <button onClick={() => { handleShareWhatsApp(); setShowShare(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">WhatsApp</button>
                </div>
              )}
            </div>
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
          </div>
        </div>

        <div ref={paymentRef} className="print-content" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', lineHeight: '1.4', margin: '0 auto', padding: '20px', width: '210mm', height: '297mm', boxSizing: 'border-box', backgroundColor: 'white', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', position: 'relative' }}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Details</h1>
            <div className="text-sm text-gray-600">Payment ID: {payment.id}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Date</label>
                  <p className="text-sm text-gray-900">{new Date(payment.payment_date).toLocaleDateString('en-GB')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                  <p className="text-sm text-gray-900">{payment.payment_method}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                    payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {payment.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="text-sm text-gray-900">{new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(payment.total_paid || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Remarks</label>
                  <p className="text-sm text-gray-900">{payment.remarks || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer & Invoice Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer Name</label>
                  <p className="text-sm text-gray-900">{payment.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer ID</label>
                  <p className="text-sm text-gray-900">{payment.customer_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Invoice Number</label>
                  <p className="text-sm text-gray-900">{payment.invoice_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Invoice Amount</label>
                  <p className="text-sm text-gray-900">{new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(payment.invoice_amount || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Invoice Balance</label>
                  <p className="text-sm text-gray-900">{new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(payment.invoice_balance || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {payment.details && payment.details.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remarks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payment.details.map((detail) => (
                      <tr key={detail.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.transaction_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(detail.pay_amount || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            detail.status === 'completed' ? 'bg-green-100 text-green-800' :
                            detail.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {detail.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.remarks || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(detail.created_at).toLocaleDateString('en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div>
                <strong>Created By:</strong> {payment.created_by?.username || 'N/A'}
              </div>
              <div>
                <strong>Received By:</strong> {payment.received_by?.username || 'N/A'}
              </div>
              <div>
                <strong>Created At:</strong> {new Date(payment.created_at).toLocaleString('en-GB')}
              </div>
              <div>
                <strong>Updated At:</strong> {new Date(payment.updated_at).toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentView;