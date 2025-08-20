/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useContext } from "react";
import BackButton from "@/components/BackButton";
import Image from "next/image";
import { currencies } from "@/utils/pages";
import { CounterContext } from "@/lib/CounterContext";

// Interface for paymentData
interface PaymentData {
  invoiceNumber: string;
  date: string;
  customerData: {
    name: string;
    MOBPHONE: string;
  };
  products: Array<{
    id: string;
    name: string;
    QUANTITY: number;
    price: number;
    uom: string;
    cgstAmount: number;
    sgstAmount: number;
    cgstRate: number;
    sgstRate: number;
    hsncode: string;
  }>;
  totalAmount: number;
  totalGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  advanceAmount?: number;
}

// Interface for company data
interface CompanyData {
  CName: string;
  CAddress: string;
  CContactNo: string;
  CDist: string;
  CState: string;
  CPin: string;
  gstin: string;
  franchiseName: string;
}

// Interface for grouped HSN data
interface HsnGroup {
  hsncode: number | string;
  totalQuantity: number;
  totalTaxableValue: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalTax: number;
  cgstRate: number;
  sgstRate: number;
}

// Interface for CounterContext
interface CounterContextType {
  state: { currency: string };
}

// Utility function to escape HTML to prevent XSS
const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Number to words function
const numberToWords = (num: number, currencySymbol: string): string => {
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const thousands = ["", "Thousand", "Lakh", "Crore"];

  const currency = currencies.find(c => c.code === currencySymbol) || 
    currencies.find(c => c.currencyCode === "INR") || 
    { code: "₹", name: "Indian Rupee", currencyCode: "INR", subunit: "Paise" };

  if (num === 0) return `Zero ${currency.name} Only`;

  const convertLessThanThousand = (n: number): string => {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
    return `${units[Math.floor(n / 100)]} Hundred ${convertLessThanThousand(n % 100)}`.trim();
  };

  const convertLargeNumber = (n: number): string => {
    if (n < 1000) return convertLessThanThousand(n);
    if (n < 100000) {
      return `${convertLessThanThousand(Math.floor(n / 1000))} ${thousands[1]} ${convertLessThanThousand(n % 1000)}`.trim();
    }
    if (n < 10000000) {
      return `${convertLessThanThousand(Math.floor(n / 100000))} ${thousands[2]} ${convertLessThanThousand(n % 100000)}`.trim();
    }
    return `${convertLargeNumber(Math.floor(n / 10000000))} ${thousands[3]} ${convertLessThanThousand(n % 10000000)}`.trim();
  };

  const whole = Math.floor(num);
  const fractional = Math.round((num - whole) * 100);
  let result = ``
  if (whole > 0) {
    result += convertLargeNumber(whole) + ` ${currency.name}`;
  }
  if (fractional > 0 && currency.subunit) {
    result += (whole > 0 ? " and " : "") + convertLessThanThousand(fractional) + ` ${currency.subunit}`;
  }
  return result + " Only";
};

const Print: React.FC<{ paymentData: PaymentData; companyData: CompanyData }> = ({ paymentData, companyData }) => {
  const { state } = useContext(CounterContext) as CounterContextType;
  console.log("Payment data from Print:", paymentData);

  // Format date to DD-MM-YYYY
  const formattedDate = new Date(paymentData.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Group products by HSN code and GST rates
  const hsnGroups: HsnGroup[] = Object.values(
    paymentData.products.reduce((acc, product) => {
      const key = `${product.hsncode}_${product.cgstRate}_${product.sgstRate}`;
      const totalProductAmount = (product.QUANTITY || 0) * (product.price || 0);
      const cgstAmount = product.cgstAmount || 0;
      const sgstAmount = product.sgstAmount || 0;
      const taxableValue = totalProductAmount || 0;

      if (!acc[key]) {
        acc[key] = {
          hsncode: product.hsncode,
          totalQuantity: 0,
          totalTaxableValue: 0,
          totalCgstAmount: 0,
          totalSgstAmount: 0,
          totalTax: 0,
          cgstRate: product.cgstRate || 0,
          sgstRate: product.sgstRate || 0,
        };
      }

      acc[key].totalQuantity += product.QUANTITY || 0;
      acc[key].totalTaxableValue += taxableValue;
      acc[key].totalCgstAmount += cgstAmount;
      acc[key].totalSgstAmount += sgstAmount;
      acc[key].totalTax += cgstAmount + sgstAmount;

      return acc;
    }, {} as Record<string, HsnGroup>)
  );

  // Calculate amounts in words
  const totalAmountInWords = numberToWords(paymentData.totalAmount || 0, state.currency || "₹");
  const totalGstAmountInWords = numberToWords(paymentData.totalGstAmount || 0, state.currency || "₹");
  const advanceAmount = paymentData.advanceAmount || 0;
  const remainingBalance = (paymentData.totalAmount || 0) - advanceAmount;
  const advanceAmountInWords = advanceAmount > 0 ? numberToWords(advanceAmount, state.currency || "₹") : "";
  const remainingBalanceInWords = advanceAmount > 0 ? numberToWords(remainingBalance, state.currency || "₹") : "";

  // Print handler
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>GST Bill</title>
            <style>
              * {
                box-sizing: border-box;
              }
              body {
                margin: 0;
                font-family: 'Inter', sans-serif;
                background: #fff;
                padding: 5px;
                font-size: 0.875rem;
                color: #000000;
              }
              .bill-print {
                width: 100%;
                min-height: 600px;
                padding: 0.5rem 0;
                text-align: left;
                color: #000000;
                font-weight: 700;
                background: #fff;
                margin: 0;
                position: relative;
                border-radius: 0;
              }
              .watermark {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 60%;
                opacity: 0.06;
                transform: translate(-50%, -50%);
                pointer-events: none;
                z-index: 0;
              }
              .content {
                position: relative;
                z-index: 1;
                width: 100%;
                max-width: 8.5cm;
                min-width: 7.8cm;
                margin: 0 auto;
              }
              table {
                width: 100%;
                min-width: 7.8cm;
                max-width: 8.5cm;
                border-collapse: collapse;
                border: 2px solid #374151;
                margin: 0 auto;
              }
              th, td {
                padding: 0.3rem 0.4rem;
                font-weight: 700;
                color: #000000;
                border: 1px solid #d1d5db;
                min-height: 1.2rem;
              }
              .product-table th,
              .product-table td {
                font-size: 0.75rem;
              }
              .product-table thead tr,
              .hsn-table thead tr {
                border: 2px solid #374151;
              }
              .product-table tbody tr:last-child,
              .hsn-table tbody tr:last-child {
                border: 2px solid #374151;
              }
              .hsn-table th,
              .hsn-table td {
                font-size: 0.6875rem;
                padding: 0.2rem 0.3rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .hsn-table th:nth-child(1),
              .hsn-table td:nth-child(1) {
                width: 20%;
              }
              .hsn-table th:nth-child(2),
              .hsn-table td:nth-child(2) {
                width: 15%;
              }
              .hsn-table th:nth-child(3),
              .hsn-table td:nth-child(3) {
                width: 18%;
                min-width: 50px;
              }
              .hsn-table th:nth-child(4),
              .hsn-table td:nth-child(4) {
                width: 15%;
              }
              .hsn-table th:nth-child(5),
              .hsn-table td:nth-child(5) {
                width: 18%;
                min-width: 40px;
              }
              .hsn-table th:nth-child(6),
              .hsn-table td:nth-child(6) {
                width: 18%;
                min-width: 40px;
              }
              .hsn-table th:nth-child(7),
              .hsn-table td:nth-child(7) {
                width: 18%;
                min-width: 50px;
              }
              th {
                text-align: left;
                background: #d1d5db;
                color: #000;
                font-weight: 700;
              }
              td {
                text-align: right;
              }
              td:first-child {
                text-align: left;
                max-width: 100px;
                word-break: break-word;
                overflow-wrap: break-word;
              }
              .text-center {
                text-align: center;
              }
              .text-gray-600 {
                color: #000000;
                font-weight: 700;
              }
              .text-gray-500 {
                color: #000000;
                font-weight: 700;
              }
              .text-gray-900 {
                color: #000000;
                font-weight: 700;
              }
              .font-bold {
                font-weight: 700;
              }
              .font-semibold {
                font-weight: 700;
              }
              .text-lg {
                font-size: 1.125rem;
              }
              .text-[10px] {
                font-size: 0.625rem;
              }
              .text-[9px] {
                font-size: 0.5625rem;
              }
              .text-[8px] {
                font-size: 0.5rem;
              }
              .text-[7px] {
                font-size: 0.4375rem;
              }
              .border-t {
                border-top: 1px solid #000000;
              }
              .border-dashed {
                border-style: dashed;
              }
              .border-gray-400 {
                border-color: #000000;
              }
              .bg-gray-200 {
                background-color: #e5e7eb;
              }
              .bg-yellow-100 {
                background-color: #fefcbf;
              }
              .mt-3 {
                margin-top: 0.75rem;
              }
              .mb-3 {
                margin-bottom: 0.75rem;
              }
              .mb-4 {
                margin-bottom: 1rem;
              }
              .mt-1 {
                margin-top: 0.25rem;
              }
              .flex {
                display: flex;
              }
              .justify-between {
                justify-content: space-between;
              }
              .flex-row {
                display: flex;
                flex-direction: row;
                gap: 0.5rem;
                align-items: center;
                flex-wrap: wrap;
              }
              .top-4 {
                display: none;
              }
              .text-center.mt-4 {
                display: none;
              }
              .amount-in-words {
                word-break: break-word;
                overflow-wrap: break-word;
              }
              .print-button {
                background-color: #3b82f6;
                color: #ffffff;
                padding: 0.5rem 1rem;
                border-radius: 0.25rem;
                cursor: pointer;
                text-align: center;
                margin-top: 1rem;
                display: inline-block;
              }
              .print-button:hover {
                background-color: #2563eb;
              }
            </style>
          </head>
          <body>
            <div class="bill-print">
              <img src="/tnb4.png" class="watermark" alt="Watermark" />
              <div class="content">
                <div style="transform: translateY(10px);" class="text-center mb-4">
                  <h1 style="transform: translateY(10px);" class="text-lg font-bold text-gray-900 tracking-wide">${escapeHtml(companyData.CName || "TEST FRANCHISE")}</h1>
                  <p class="text-[10px] text-gray-600">${escapeHtml(companyData.CAddress || "Halishar")}, ${escapeHtml(companyData.CState || "West Bengal")} ${escapeHtml(companyData.CPin || "743145")}, Mob. ${escapeHtml(companyData.CContactNo || "6289675776")}</p>
                  <p style="transform: translateY(-10px);" class="text-[10px] text-gray-600">GST IN - ${escapeHtml(companyData.gstin || "123456789000")}</p>
                </div>
                <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; text-align: center; font-weight: 700; margin-bottom: 6px;">
                  TAX INVOICE
                </div>
                <div class="flex justify-between text-[10px] mb-3">
                  <div class="flex-row">
                    <div class="font-bold">Bill No.:</div>
                    <div>${escapeHtml(paymentData.invoiceNumber)}</div>
                  </div>
                  <div class="flex-row text-right">
                    <div class="font-bold">Date:</div>
                    <div>${formattedDate}</div>
                  </div>
                </div>
                <div class="flex justify-between text-[10px] mb-4">
                  <div class="flex-row">
                    <div class="font-bold">Name:</div>
                    <div>${escapeHtml(paymentData.customerData.name)}</div>
                  </div>
                  <div class="flex-row text-right">
                    <div class="font-bold">Mobile :</div>
                    <div>${escapeHtml(paymentData.customerData.MOBPHONE)}</div>
                  </div>
                </div>
                <table class="product-table mb-4">
                  <thead>
                    <tr class="text-black font-semibold">
                      <th style="border-right:1px solid black;" class="text-left py-0.3 px-0.4">S.No.</th>
                      <th class="text-left py-0.3 px-0.4 max-w-[100px] break-words">Item Name</th>
                      <th class="text-center py-0.3 px-0.4">Qty.</th>
                      <th class="text-left py-0.3 px-0.4">Uom</th>
                      <th class="text-right py-0.3 px-0.4">Rate</th>
                      <th class="text-right py-0.3 px-0.4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paymentData.products
                      .map(
                        (product, index) => `
                        <tr>
                          <td style="border-right:1px solid black;" class="py-0.3 px-0.4 text-[10px]">${index + 1}</td>
                          <td class="py-0.3 px-0.4 text-[10px] max-w-[100px] break-words">${escapeHtml(product.name)}</td>
                          <td class="text-center text-[10px] py-0.3 px-0.4">${product.QUANTITY || 0}</td>
                          <td class="py-0.3 px-0.4 text-[10px]">${escapeHtml(product.uom)}</td>
                          <td class="text-right text-[10px] py-0.3 px-0.4">${(product.price || 0).toFixed(2)}</td>
                          <td class="text-right text-[10px] py-0.3 px-0.4">${((product.QUANTITY || 0) * (product.price || 0)).toFixed(2)}</td>
                        </tr>`
                      )
                      .join("")}
                    <tr class="bg-gray-200 font-semibold">
                      <td style="border-right:1px solid black;" class="py-0.3 px-0.4 text-[10px]">${advanceAmount > 0 ? `Advance: ${advanceAmount.toFixed(2)}` : ""}</td>
                      <td class="py-0.3 px-0.4"></td>
                      <td class="py-0.3 px-0.4"></td>
                      <td class="py-0.3 px-0.4"></td>
                      <td class="text-right py-0.3 px-0.4 text-[10px]">Total</td>
                      <td class="text-right py-0.3 px-0.4 text-[10px]">${(paymentData.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                    ${advanceAmount > 0 ? `
                    <tr class="bg-gray-200 font-semibold">
                      <td class="py-0.3 px-0.4"></td>
                      <td class="py-0.3 px-0.4"></td>
                      <td class="py-0.3 px-0.4"></td>
                      <td class="py-0.3 px-0.4"></td>
                      <td class="text-right py-0.3 px-0.4 text-[10px]">Balance</td>
                      <td class="text-right py-0.3 px-0.4 text-[10px]">${remainingBalance.toFixed(2)}</td>
                    </tr>` : ""}
                  </tbody>
                </table>
                <div class="font-semibold text-[10px] mb-3 amount-in-words" style="font-style: italic;">
                  Total Amount in Words: ${escapeHtml(totalAmountInWords)}</div>
                ${advanceAmount > 0 ? `
                <div class="font-semibold text-[10px] mb-3 amount-in-words" style="font-style: italic;">
                  Advance Amount in Words: ${escapeHtml(advanceAmountInWords)}</div>
                <div class="font-semibold text-[10px] mb-3 amount-in-words" style="font-style: italic;">
                  Balance Amount in Words: ${escapeHtml(remainingBalanceInWords)}</div>
                ` : ""}
                <table style="transform: scale(0.87) translateX(-6%);" class="hsn-table mb-4">
                  <thead>
                    <tr class="text-gray-700 font-semibold">
                      <th style="border-right:1px solid black;" class="text-left py-0.2 px-0.3">HSN/SAC</th>
                      <th class="text-center py-0.2 px-0.3">Qty</th>
                      <th class="text-right py-0.2 px-0.3">Taxable</th>
                      <th class="text-right py-0.2 px-0.3">GST Rate%</th>
                      <th class="text-right py-0.2 px-0.3">C.Tax</th>
                      <th class="text-right py-0.2 px-0.3">S.Tax</th>
                      <th class="text-right py-0.2 px-0.3">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${hsnGroups
                      .map(
                        (group, index) => `
                          <tr>
                            <td style="border-right:1px solid black;" class="py-0.2 px-0.3 text-[8px]">${escapeHtml(String(group.hsncode))}</td>
                            <td class="text-center py-0.2 px-0.3 text-[8px]">${group.totalQuantity || 0}</td>
                            <td class="text-right py-0.2 px-0.3 text-[8px]">${(group.totalTaxableValue || 0).toFixed(2)}</td>
                            <td class="text-right py-0.2 px-0.3 text-[8px]">${(group.cgstRate || 0).toFixed(1)}+${(group.sgstRate || 0).toFixed(1)}</td>
                            <td class="text-right py-0.2 px-0.3 text-[8px]">${(group.totalCgstAmount || 0).toFixed(2)}</td>
                            <td class="text-right py-0.2 px-0.3 text-[8px]">${(group.totalSgstAmount || 0).toFixed(2)}</td>
                            <td class="text-right py-0.2 px-0.3 text-[8px]">${(group.totalTax || 0).toFixed(2)}</td>
                          </tr>`
                      )
                      .join("")}
                    <tr class="font-semibold border-t border-gray-400 bg-gray-200">
                      <td class="text-center py-0.2 px-0.3 text-[8px]" colspan="2">Total</td>
                      <td class="text-right py-0.2 px-0.3 text-[8px]">${((paymentData.totalAmount || 0)).toFixed(2)}</td>
                      <td class="py-0.2 px-0.3 text-[8px]"></td>
                      <td class="text-right py-0.2 px-0.3 text-[8px]">${(paymentData.cgstAmount || 0).toFixed(2)}</td>
                      <td class="text-right py-0.2 px-0.3 text-[8px]">${(paymentData.sgstAmount || 0).toFixed(2)}</td>
                      <td class="text-right py-0.2 px-0.3 text-[8px]">${(paymentData.totalGstAmount || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
                <div class="font-semibold text-[10px] mb-3 amount-in-words" style="font-style: italic;">
                  GST Amount in Words: ${escapeHtml(totalGstAmountInWords)}
                </div>
                <div class="text-center text-[10px]">
                  <p style="transform: translateY(-5px);" class="font-semibold text-gray-900">Thank you for your purchase!</p>
                  <p style="transform: translateY(-10px);" class="text-gray-600">Visit again - www.tastenbite.com</p>
                </div>
              </div>
            </div>
            <script>
              window.print();
              setTimeout(() => window.close(), 100);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <>
      <div style={{ position: "absolute", top: "5rem", left: "0", zIndex: 20 }}>
        <BackButton />
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "8.5cm",
          minWidth: "7.8cm",
          minHeight: "600px",
          padding: "0rem",
          fontFamily: "'Inter', sans-serif",
          fontSize: "0.875rem",
          color: "#000000",
          margin: "0 auto",
          border: "1px solid #d1d5db",
          borderRadius: "0.375rem",
        }}
      >
        <Image
          src="/tnb4.png"
          alt="Watermark"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "60%",
            opacity: 0.06,
            transform: "translate(-50%, -50%)",
            zIndex: 0,
          }}
          width={180}
          height={180}
          priority
        />
        <div style={{ position: "relative", zIndex: 10 }}>
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#000000", letterSpacing: "0.05em" }}>
              {escapeHtml(companyData.CName || "TEST FRANCHISE")}
            </h1>
            <p style={{ fontSize: "0.625rem", color: "#000000", fontWeight: 700 }}>
              {escapeHtml(companyData.CAddress || "Halishar")}, {escapeHtml(companyData.CState || "West Bengal")} {escapeHtml(companyData.CPin || "743145")}, Mob. {escapeHtml(companyData.CContactNo || "6289675776")}
            </p>
            <p style={{ fontSize: "0.625rem", color: "#000000", fontWeight: 700 }}>
              GST IN - {escapeHtml(companyData.gstin || "123456789000")}
            </p>
            <div
              style={{
                borderTop: "1px solid #000",
                borderBottom: "1px solid #000",
                padding: "4px 0",
                textAlign: "center",
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              TAX INVOICE
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>Bill No.:</div>
              <div>{escapeHtml(paymentData.invoiceNumber)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>Date:</div>
              <div>{formattedDate}</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>Name:</div>
              <div>{escapeHtml(paymentData.customerData.name)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>Mobile No:</div>
              <div>{escapeHtml(paymentData.customerData.MOBPHONE)}</div>
            </div>
          </div>
          <table
            style={{
              width: "100%",
              minWidth: "7.8cm",
              maxWidth: "8.5cm",
              borderCollapse: "collapse",
              border: "2px solid #374151",
              margin: "0 auto",
              marginBottom: "1rem",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#e5e7eb", color: "#000000", fontWeight: 700, border: "2px solid #374151" }}>
                <th style={{ textAlign: "left", padding: "0.3rem 0.4rem", fontSize: "0.75rem" }}>S.No.</th>
                <th style={{ textAlign: "left", padding: "0.3rem 0.4rem", fontSize: "0.75rem", maxWidth: "100px", wordBreak: "break-word" }}>
                  Item Name
                </th>
                <th style={{ textAlign: "center", padding: "0.3rem 0.4rem", fontSize: "0.75rem" }}>Qty.</th>
                <th style={{ textAlign: "left", padding: "0.3rem 0.4rem", fontSize: "0.75rem" }}>Uom</th>
                <th style={{ textAlign: "right", padding: "0.3rem 0.4rem", fontSize: "0.75rem" }}>Rate</th>
                <th style={{ textAlign: "right", padding: "0.3rem 0.4rem", fontSize: "0.75rem" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {paymentData.products.map((product, index) => (
                <tr key={product.id}>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "left" }}>{index + 1}</td>
                  <td
                    style={{
                      padding: "0.3rem 0.4rem",
                      fontSize: "0.625rem",
                      maxWidth: "100px",
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      textAlign: "left",
                    }}
                  >
                    {escapeHtml(product.name)}
                  </td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "center" }}>{product.QUANTITY || 0}</td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "left" }}>{escapeHtml(product.uom)}</td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "right" }}>{(product.price || 0).toFixed(2)}</td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "right" }}>
                    {((product.QUANTITY || 0) * (product.price || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: "#e5e7eb", fontWeight: 700, border: "2px solid #374151" }}>
                <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "left" }}>
                  {advanceAmount > 0 ? `Advance: ${advanceAmount.toFixed(2)}` : ""}
                </td>
                <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem" }}></td>
                <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem" }}></td>
                <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem" }}></td>
                <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "right" }}>Total</td>
                <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "right" }}>{(paymentData.totalAmount || 0).toFixed(2)}</td>
              </tr>
              {advanceAmount > 0 && (
                <tr style={{ backgroundColor: "#e5e7eb", fontWeight: 700, border: "2px solid #374151" }}>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem" }}></td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem" }}></td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem" }}></td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem" }}></td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "right" }}>Balance</td>
                  <td style={{ padding: "0.3rem 0.4rem", fontSize: "0.625rem", textAlign: "right" }}>{remainingBalance.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ fontWeight: 700, fontSize: "0.625rem", marginBottom: "0.75rem", fontStyle: "italic", wordBreak: "break-word", overflowWrap: "break-word" }}>
            Total Amount in Words: {escapeHtml(totalAmountInWords)}
          </div>
          {advanceAmount > 0 && (
            <>
              <div
                style={{ fontWeight: 700, fontSize: "0.625rem", marginBottom: "0.75rem", fontStyle: "italic", wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                Advance Amount in Words: {escapeHtml(advanceAmountInWords)}
              </div>
              <div
                style={{ fontWeight: 700, fontSize: "0.625rem", marginBottom: "0.75rem", fontStyle: "italic", wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                Balance Amount in Words: {escapeHtml(remainingBalanceInWords)}
              </div>
            </>
          )}
          <table
            style={{
              width: "100%",
              minWidth: "7.8cm",
              maxWidth: "8.5cm",
              borderCollapse: "collapse",
              border: "2px solid #374151",
              margin: "0 auto",
              marginBottom: "1rem",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#e5e7eb", color: "#000000", fontWeight: 700, border: "2px solid #374151" }}>
                <th style={{ textAlign: "left", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}>HSN</th>
                <th style={{ textAlign: "center", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem", minWidth: "10px" }}>Taxable</th>
                <th style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}>Rate%</th>
                <th style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem", minWidth: "10px" }}>C.Tax</th>
                <th style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem", minWidth: "10px" }}>S.Tax</th>
                <th style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem", minWidth: "10px" }}>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {hsnGroups.map((group, index) => (
                <tr key={index}>
                  <td style={{ padding: "0.1rem 0.1rem", fontSize: "0.6875rem", textAlign: "left" }}>{escapeHtml(String(group.hsncode))}</td>
                  <td style={{ padding: "0.1rem 0.1rem", fontSize: "0.6875rem", textAlign: "center" }}>{group.totalQuantity}</td>
                  <td style={{ padding: "0.1rem 0.1rem", fontSize: "0.6875rem", textAlign: "right" }}>{(group.totalTaxableValue || 0).toFixed(2)}</td>
                  <td style={{ padding: "0.1rem 0.1rem", fontSize: "0.6875rem", textAlign: "right" }}>{(group.cgstRate || 0).toFixed(1)}</td>
                  <td style={{ padding: "0.1rem 0.1rem", fontSize: "0.6875rem", textAlign: "right" }}>{(group.totalCgstAmount || 0).toFixed(2)}</td>
                  <td style={{ padding: "0.1rem 0.1rem", fontSize: "0.6875rem", textAlign: "right" }}>{(group.totalSgstAmount || 0).toFixed(2)}</td>
                  <td style={{ padding: "0.1rem 0.1rem", fontSize: "0.6875rem", textAlign: "right" }}>{(group.totalTax || 0).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: "1px solid #000000", backgroundColor: "#e5e7eb", border: "2px solid #374151" }}>
                <td style={{ textAlign: "center", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }} colSpan={2}>
                  Total
                </td>
                <td style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}>
                  {((paymentData.totalAmount || 0)).toFixed(2)}
                </td>
                <td style={{ padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}></td>
                <td style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}>{(paymentData.cgstAmount || 0).toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}>{(paymentData.sgstAmount || 0).toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "0.2rem 0.3rem", fontSize: "0.6875rem" }}>{(paymentData.totalGstAmount || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontWeight: 700, fontSize: "0.625rem", marginBottom: "0.75rem", fontStyle: "italic", wordBreak: "break-word", overflowWrap: "break-word" }}>
            GST Amount in Words: {escapeHtml(totalGstAmountInWords)}
          </div>
          <div style={{ textAlign: "center", fontSize: "0.625rem" }}>
            <p style={{ fontWeight: 700, color: "#000000" }}>Thank you for your purchase!</p>
            <p style={{ color: "#000000", fontWeight: 700 }}>Visit again - www.tastenbite.com</p>
          </div>
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              onClick={handlePrint}
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3b82f6")}
            >
              Print Bill
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Print;