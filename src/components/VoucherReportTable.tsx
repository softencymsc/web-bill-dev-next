/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { collection, getDocs, query, where } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { db } from "../../firebase";
import { CounterContext } from "@/lib/CounterContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Customer, Voucher } from "@/types/page";
import { Doughnut, Pie, Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface VoucherReportTableProps {
  apply: {
    reportType: "Payee" | "TransactionType";
    payee: string;
    startDate: string;
    endDate: string;
    paymentMode: string;
    payees: Customer[];
  };
}

const VoucherReportTable: React.FC<VoucherReportTableProps> = ({ apply }) => {
  const [collections, setCollections] = useState<{ col1: string }>({ col1: "" });
  const [voucherData, setVoucherData] = useState<Voucher[]>([]);
  const [showCharts, setShowCharts] = useState(false);
  const { state } = useContext(CounterContext);
  const currency = state.currency
  useEffect(() => {
    if (apply && state?.tenantId) {
      const startDate = apply.startDate;
      const endDate = apply.endDate;

      if (!startDate || !endDate) return;

      const fromDate = new Date(startDate);
      const toDate = new Date(endDate);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return;

      const col1 = "TRNS1";
      const col1DateField = "TRN_DATE";
      setCollections({ col1 });
      fetchVoucherData(state.tenantId, fromDate, toDate, col1, col1DateField, apply);
    }
  }, [apply, state?.tenantId]);

  const fetchVoucherData = async (
    tenantId: string,
    fromDate: Date,
    toDate: Date,
    col1: string,
    col1DateField: string,
    filters: VoucherReportTableProps["apply"]
  ) => {
    if (!filters) return;
    try {
      const adjustedToDate = new Date(toDate);
      adjustedToDate.setHours(23, 59, 59, 999);

      let col1Ref = collection(db, `TenantsDb/${tenantId}/${col1}`);
      let col1Query = query(
        col1Ref,
        where(col1DateField, ">=", fromDate.toISOString().split("T")[0]),
        where(col1DateField, "<=", adjustedToDate.toISOString().split("T")[0])
      );

      if (filters.paymentMode !== "All") {
        if (filters.paymentMode === "CASH") {
          col1Query = query(col1Query, where("CASH_BANK", "==", "No"));
        } else if (filters.paymentMode === "CHEQUE") {
          col1Query = query(col1Query, where("CHEQUE_TRANS_ID", "!=", ""));
        } else if (filters.paymentMode === "UPI") {
          col1Query = query(col1Query, where("UPI_TRANS_ID", "!=", ""));
        }
      }
      if (filters.payee !== "All") {
        const payeeArray = filters.payee.split(",").map((p) => p.trim());
        if (payeeArray.length > 0 && payeeArray.length <= 10) {
          col1Query = query(col1Query, where("PAYEE_R_NAME", "in", payeeArray));
        }
      }

      const col1Snap = await getDocs(col1Query);
      const col1Data = col1Snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Voucher[];

      setVoucherData(col1Data);
    } catch (error) {
      console.error("Failed to fetch voucher data", error);
    }
  };

  const totalBasic = voucherData.reduce((sum, voucher) => sum + (Number(voucher.AMOUNT) || 0), 0);
  const transactionCount = voucherData.length;

  const formatDate = (date?: string | { seconds: number; nanoseconds: number }): string => {
    if (!date) return "N/A";
    if (typeof date === "string") {
      return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return new Date(date.seconds * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getHeaders = () => [
    "Voucher No",
    "Date",
    "Payee",
    "Type",
    "Amount",
    "Cash/Bank",
    "Narration",
  ];

  const getRows = () =>
    voucherData.map((voucher) => [
      voucher.TRNNO || "N/A",
      formatDate(voucher.TRN_DATE),
      voucher.PAYEE_R_NAME || "N/A",
      voucher.TYPE || "N/A",
      (Number(voucher.AMOUNT) || 0).toFixed(2),
      voucher.CASH_BANK || "N/A",
      voucher.NARRATION || "N/A",
    ]);

  const getFootRow = () => [
    { value: "Total", colSpan: 4 },
    { value: totalBasic.toFixed(2), colSpan: 1, align: "right" },
    { value: "", colSpan: 1 },
    { value: "", colSpan: 1 },
  ];

  // Card Data
  const topPayee = voucherData.reduce((acc, v) => {
    const payee = v.PAYEE_R_NAME || "Unknown";
    acc[payee] = (acc[payee] || 0) + (Number(v.AMOUNT) || 0);
    return acc;
  }, {} as Record<string, number>);
  const topPayeeName = Object.entries(topPayee).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  const topPayeeAmount = Object.entries(topPayee).sort((a, b) => b[1] - a[1])[0]?.[1]?.toFixed(2) || "0.00";

  const paymentModes = {
    Cash: voucherData.filter((v) => v.CASH_BANK === "No").reduce((sum, v) => sum + (Number(v.AMOUNT) || 0), 0),
    Cheque: voucherData.filter((v) => v.CHEQUE_TRANS_ID && v.CHEQUE_TRANS_ID !== "").reduce((sum, v) => sum + (Number(v.AMOUNT) || 0), 0),
  
  };
  const topPaymentMode = Object.entries(paymentModes).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  const topPaymentModeAmount = Object.entries(paymentModes).sort((a, b) => b[1] - a[1])[0]?.[1]?.toFixed(2) || "0.00";

  // Chart Data Preparation
  const paymentModeData = {
    labels: ["Cash", "Cheque", "UPI"],
    datasets: [
      {
        label: "Amount by Payment Mode",
        data: [
          paymentModes.Cash,
          paymentModes.Cheque,
        ],
        backgroundColor: ["#3B82F6", "#10B981", "#F59E0B"],
      },
    ],
  };

  const transactionTypeData = {
    labels: [...new Set(voucherData.map((v) => v.TYPE || "Unknown"))],
    datasets: [
      {
        label: "Transaction Types",
        data: [...new Set(voucherData.map((v) => v.TYPE || "Unknown"))].map(
          (type) =>
            voucherData
              .filter((v) => (v.TYPE || "Unknown") === type)
              .reduce((sum, v) => sum + (Number(v.AMOUNT) || 0), 0)
        ),
        backgroundColor: ["#EF4444", "#8B5CF6", "#EC4899", "#6EE7B7", "#FBBF24"],
      },
    ],
  };

  const dateWiseData = () => {
    const dateMap = voucherData.reduce((acc, v) => {
      const date = formatDate(v.TRN_DATE);
      acc[date] = (acc[date] || 0) + (Number(v.AMOUNT) || 0);
      return acc;
    }, {} as Record<string, number>);
    return {
      labels: Object.keys(dateMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
      datasets: [
        {
          label: "Amount Over Time",
          data: Object.keys(dateMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).map((date) => dateMap[date]),
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          fill: true,
        },
      ],
    };
  };

  const topPayeeData = {
    labels: Object.entries(topPayee).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([payee]) => payee),
    datasets: [
      {
        label: "Top Payees by Amount",
        data: Object.entries(topPayee).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([, amount]) => amount),
        backgroundColor: "#10B981",
      },
    ],
  };

  const exportToPDF = () => {
    if (!apply) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Voucher Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Date Range: ${apply.startDate || "N/A"} to ${apply.endDate || "N/A"}`, 14, 28);
    doc.text(
      `Filters: Report Type: ${apply.reportType}, Payment Mode: ${apply.paymentMode || "All"}, Payee: ${apply.payee}`,
      14,
      34
    );

    const headers = getHeaders();
    const rows = getRows();
    const footRow = getFootRow().map(cell => cell.value);

    autoTable(doc, {
      startY: 42,
      head: [headers],
      body: rows,
      foot: [footRow],
      theme: "striped",
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8, halign: "center" },
      bodyStyles: { fontSize: 7, cellPadding: 2, halign: "center" },
      footStyles: { fillColor: [243, 244, 246], textColor: 0, fontSize: 8, halign: "center" },
      columnStyles: {
        0: { cellWidth: 20, halign: "left" },
        1: { cellWidth: 15, halign: "center" },
        2: { cellWidth: 35, halign: "left" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 15, halign: "center" },
        6: { halign: "left" },
      },
    });

    doc.save(`Voucher_Report_${apply.reportType}.pdf`);
  };

  const exportToExcel = () => {
    if (!apply) return;
    const wsData: any[] = [];
    wsData.push(["Voucher Report"]);
    wsData.push([`Date Range: ${apply.startDate || "N/A"} to ${apply.endDate || "N/A"}`]);
    wsData.push([
      `Filters: Report Type: ${apply.reportType}, Payment Mode: ${apply.paymentMode || "All"}, Payee: ${apply.payee}`,
    ]);
    wsData.push([]);

    const headers = getHeaders();
    const rows = getRows();
    const footRow = getFootRow().map(cell => cell.value);
    wsData.push(headers, ...rows, footRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Voucher Report");
    XLSX.writeFile(wb, `Voucher_Report_${apply.reportType}.xlsx`);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-800">Total Amount</h3>
            <p className="text-lg font-bold text-blue-600">{currency+ " "}{totalBasic.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-800">Transaction Count</h3>
            <p className="text-lg font-bold text-blue-600">{transactionCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-800">Top Payee</h3>
            <p className="text-lg font-bold text-blue-600">{topPayeeName} ({currency+ " "}{topPayeeAmount})</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-800">Top Payment Mode</h3>
            <p className="text-lg font-bold text-blue-600">{topPaymentMode} ({currency+ " "}{topPaymentModeAmount})</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Voucher Report</h2>
          <div className="space-x-3 flex gap-2">
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6m6 6v-8m6 8v-4m-6-6V5m-6 8V9" />
              </svg>
              <span>{showCharts ? "Hide Charts" : "Show Charts"}</span>
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export PDF</span>
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8m4 0v-8m4 8v-8M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {showCharts && voucherData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-3 rounded-lg shadow" style={{ maxHeight: "300px" }}>
              <h3 className="text-md font-semibold mb-2">Payment Mode Distribution</h3>
              <div style={{ height: "200px" }}>
                <Doughnut
                  data={paymentModeData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "top", labels: { font: { size: 10 } } }, title: { display: true, text: "Amount by Payment Mode", font: { size: 12 } } },
                  }}
                />
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow" style={{ maxHeight: "300px" }}>
              <h3 className="text-md font-semibold mb-2">Transaction Type Distribution</h3>
              <div style={{ height: "200px" }}>
                <Pie
                  data={transactionTypeData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "top", labels: { font: { size: 10 } } }, title: { display: true, text: "Transaction Types", font: { size: 12 } } },
                  }}
                />
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow" style={{ maxHeight: "300px" }}>
              <h3 className="text-md font-semibold mb-2">Amount Over Time</h3>
              <div style={{ height: "200px" }}>
                <Line
                  data={dateWiseData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "top", labels: { font: { size: 10 } } }, title: { display: true, text: "Amount Over Time", font: { size: 12 } } },
                    scales: { y: { ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } } },
                  }}
                />
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow" style={{ maxHeight: "300px" }}>
              <h3 className="text-md font-semibold mb-2">Top 5 Payees by Amount</h3>
              <div style={{ height: "200px" }}>
                <Bar
                  data={topPayeeData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "top", labels: { font: { size: 10 } } }, title: { display: true, text: "Top 5 Payees by Amount", font: { size: 12 } } },
                    scales: { y: { ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } } },
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {showCharts && voucherData.length === 0 && (
          <div className="bg-white p-4 rounded-lg shadow text-center text-gray-500 mb-6">No data available for charts.</div>
        )}

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed border border-gray-200">
              <thead className="bg-blue-600 text-white">
                <tr>
                  {getHeaders().map((header, index) => (
                    <th
                      key={index}
                      className="py-3 px-4 text-xs font-semibold text-left sticky top-0 bg-blue-600 border-r border-gray-200"
                      style={{ width: `${[12, 10, 25, 12, 10, 10, 30][index]}%` }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {voucherData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-500">No data available for the selected filters.</td>
                  </tr>
                ) : (
                  getRows().map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 transition-colors duration-200">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`py-3 px-6 text-sm text-gray-800 whitespace-normal break-words ${cellIndex === 4 ? "text-right" : ""} border-r border-gray-200`}
                          style={{ maxWidth: cellIndex === 6 ? "none" : "200px" }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  {getFootRow().map((cell, index) => (
                    <td
                      key={index}
                      className={`py-3 px-6 text-sm font-semibold text-gray-800 ${cell.align === "right" ? "text-right" : ""} border-r border-gray-200`}
                      colSpan={cell.colSpan}
                    >
                      {cell.value}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherReportTable;