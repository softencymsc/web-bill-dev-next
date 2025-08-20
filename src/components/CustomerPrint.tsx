/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";
import BackButton from "@/components/BackButton";
import Image from "next/image";

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

// Utility function to escape HTML to prevent XSS
const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const Print: React.FC<{ paymentData: PaymentData; companyData: CompanyData }> = ({ paymentData, companyData }) => {
  // Format date to DD-MM-YYYY
  const formattedDate = new Date(paymentData.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Group products by HSN code
  const hsnGroups: HsnGroup[] = Object.values(
    paymentData.products.reduce((acc, product) => {
      const totalProductAmount = (product.QUANTITY || 0) * (product.price || 0);
      const cgstAmount = product.cgstAmount || 0;
      const sgstAmount = product.sgstAmount || 0;
      const taxableValue = totalProductAmount - cgstAmount - sgstAmount;

      if (!acc[product.hsncode]) {
        acc[product.hsncode] = {
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

      acc[product.hsncode].totalQuantity += product.QUANTITY || 0;
      acc[product.hsncode].totalTaxableValue += taxableValue;
      acc[product.hsncode].totalCgstAmount += cgstAmount;
      acc[product.hsncode].totalSgstAmount += sgstAmount;
      acc[product.hsncode].totalTax += cgstAmount + sgstAmount;

      return acc;
    }, {} as Record<string, HsnGroup>)
  );

  // Calculate total amount in words, handling lakhs and crores
  const numberToWords = (num: number): string => {
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = [
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const thousands = ["", "Thousand", "Lakh", "Crore"];

    if (num === 0) return "Zero";

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

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let result = "₹ ";
    if (rupees > 0) {
      result += convertLargeNumber(rupees) + " Rupees";
    }
    if (paise > 0) {
      result += (rupees > 0 ? " and " : "") + convertLessThanThousand(paise) + " Paise";
    }
    return result + " Only";
  };

  const totalAmountInWords = numberToWords(paymentData.totalAmount || 0);
  const totalGstAmountInWords = numberToWords(paymentData.totalGstAmount || 0);
  const advanceAmount = paymentData.advanceAmount || 0;
  const remainingBalance = (paymentData.totalAmount || 0) - advanceAmount;
  const advanceAmountInWords = advanceAmount > 0 ? numberToWords(advanceAmount) : "";
  const remainingBalanceInWords = advanceAmount > 0 ? numberToWords(remainingBalance) : "";

  // Print handler
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>GST Bill</title>
            <style>
              body {
                margin: 0;
                font-family: 'Inter', sans-serif;
                background: #fff;
              }
              .bill-print {
                width: 288px;
                min-height: 600px;
                padding: 1.5rem;
                text-align: left;
                color: #111827;
                font-size: 0.625rem;
                background: #fff;
                margin: 0 auto;
                position: relative;
                border: 1px solid #d1d5db;
                border-radius: 0.375rem;
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
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                padding: 0.125rem 0.125rem;
              }
              .product-table th,
              .product-table td {
                font-size: 0.5rem;
              }
              .hsn-table th,
              .hsn-table td {
                font-size: 0.45rem;
                padding: 0.1rem 0.2rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .hsn-table th:nth-child(1),
              .hsn-table td:nth-child(1) {
                width: 18%;
              }
              .hsn-table th:nth-child(2),
              .hsn-table td:nth-child(2) {
                width: 10%;
              }
              .hsn-table th:nth-child(3),
              .hsn-table td:nth-child(3) {
                width: 18%;
              }
              .hsn-table th:nth-child(4),
              .hsn-table td:nth-child(4) {
                width: 10%;
              }
              .hsn-table th:nth-child(5),
              .hsn-table td:nth-child(5) {
                width: 18%;
              }
              .hsn-table th:nth-child(6),
              .hsn-table td:nth-child(6) {
                width: 18%;
              }
              .hsn-table th:nth-child(7),
              .hsn-table td:nth-child(7) {
                width: 18%;
              }
              th {
                text-align: left;
                background: #e5e7eb;
                color: #374151;
                font-weight: 600;
              }
              td {
                text-align: right;
              }
              td:first-child {
                text-align: left;
                max-width: 80px;
                word-break: break-word;
              }
              .text-center {
                text-align: center;
              }
              .text-gray-600 {
                color: #4b5563;
              }
              .text-gray-500 {
                color: #6b7280;
              }
              .text-gray-900 {
                color: #111827;
              }
              .font-bold {
                font-weight: 700;
              }
              .font-semibold {
                font-weight: 600;
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
                border-top: 1px solid #d1d5db;
              }
              .border-dashed {
                border-style: dashed;
              }
              .border-gray-400 {
                border-color: #9ca3af;
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
              .flex-col {
                flex-direction: column;
              }
              .top-4 {
                display: none;
              }
              .text-center.mt-4 {
                display: none;
              }
            </style>
          </head>
          <body>
            <div class="bill-print">
              <img src="/tnb4.png" class="watermark" alt="Watermark" />
              <div class="content">
                <div class="text-center mb-4">
                  <h1 class="text-lg font-bold text-gray-900 tracking-wide">${escapeHtml(companyData.CName || "TEST FRANCHISE")}</h1>
                  <p class="text-[10px] text-gray-600">${escapeHtml(companyData.CAddress || "Halishar")}, ${escapeHtml(companyData.CState || "West Bengal")} ${escapeHtml(companyData.CPin || "743145")}, Mob. ${escapeHtml(companyData.CContactNo || "6289675776")}</p>
                  <p class="text-[10px] text-gray-600">GST IN - ${escapeHtml(companyData.gstin || "123456789000")}</p>
                  <div class="border-t border-dashed border-gray-400 mt-3"></div>
                </div>
                <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; text-align: center; font-weight: bold; margin-bottom: 6px;">
                  TAX INVOICE
                </div>
                <div class="flex justify-between text-[10px] mb-3">
                  <div class="flex-col">
                    <div class="font-bold">Bill No.:</div>
                    <div>${escapeHtml(paymentData.invoiceNumber)}</div>
                  </div>
                  <div class="flex-col text-right">
                    <div class="font-bold">Date:</div>
                    <div>${formattedDate}</div>
                  </div>
                </div>
                <div class="flex justify-between text-[10px] mb-4">
                  <div class="flex-col">
                    <div class="font-bold">Name:</div>
                    <div>${escapeHtml(paymentData.customerData.name)}</div>
                  </div>
                  <div class="flex-col text-right">
                    <div class="font-bold">Mobile No:</div>
                    <div>${escapeHtml(paymentData.customerData.MOBPHONE)}</div>
                  </div>
                </div>
                <table class="w-full product-table mb-4">
                  <thead>
                    <tr class="bg-gray-200 text-gray-700 font-semibold">
                      <th class="text-left py-1 px-1">S.No.</th>
                      <th class="text-left py-1 px-1 max-w-[80px] break-words">Item Name</th>
                      <th class="text-center py-1 px-1">Qty.</th>
                      <th class="text-left py-1 px-1">Uom</th Usom
                      <th class="text-right py-1 px-1">Rate</th>
                      <th class="text-right py-1 px-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paymentData.products
                      .map(
                        (product, index) => `
                        <tr>
                          <td class="py-1 px-1">${index + 1}</td>
                          <td class="py-1 px-1 max-w-[80px] break-words">${escapeHtml(product.name)}</td>
                          <td class="text-center py-1 px-1">${product.QUANTITY || 0}</td>
                          <td class="py-1 px-1">${escapeHtml(product.uom)}</td>
                          <td class="text-right py-1 px-1">${(product.price || 0).toFixed(2)}</td>
                          <td class="text-right py-1 px-1">${((product.QUANTITY || 0) * (product.price || 0)).toFixed(2)}</td>
                        </tr>`
                      )
                      .join("")}
                    <tr class="bg-gray-200 font-semibold">
                      <td class="py-1 px-1">${advanceAmount > 0 ? `Advance: ${advanceAmount.toFixed(2)}` : ""}</td>
                      <td class="py-1 px-1"></td>
                      <td class="py-1 px-1"></td>
                      <td class="py-1 px-1"></td>
                      <td class="text-right py-1 px-1">Total</td>
                      <td class="text-right py-1 px-1">${(paymentData.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                    ${advanceAmount > 0 ? `
                    <tr class="bg-gray-200 font-semibold">
                    <td class="py-1 px-1"></td>
                    <td class="py-1 px-1"></td>
                    <td class="py-1 px-1"></td>
                    <td class="py-1 px-1"></td>
                    <td class="py-1 px-1"></td>
                    <td class="py-1 px-1">Balance: ${remainingBalance.toFixed(2)}</td>
                    </tr>` : ""}
                  </tbody>
                </table>
                <div class="font-semibold text-[10px] mb-3" style="font-style: italic;">
                  Total Amount in Word: ${escapeHtml(totalAmountInWords)}</div>
                ${advanceAmount > 0 ? `
                <div class="font-semibold text-[10px] mb-3" style="font-style: italic;">
                  Advance Amount in Word: ${escapeHtml(advanceAmountInWords)}</div>
                <div class="font-semibold text-[10px] mb-3" style="font-style: italic;">
                  Balance Amount in Word: ${escapeHtml(remainingBalanceInWords)}</div>
                ` : ""}
                <table class="w-full hsn-table mb-4">
                  <thead>
                    <tr class="bg-gray-200 text-gray-700 font-semibold">
                      <th class="text-left py-0.5 px-0.2">HSN/SAC</th>
                      <th class="text-center py-0.5 px-0.2">Qty</th>
                      <th class="text-right py-0.5 px-0.2">Taxable Value</th>
                      <th class="text-right py-0.5 px-0.2">Rate%</th>
                      <th class="text-right py-0.5 px-0.2">Central Tax</th>
                      <th class="text-right py-0.5 px-0.2">State Tax</th>
                      <th class="text-right py-0.5 px-0.2">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${hsnGroups
                      .map(
                        (group, index) => `
                          <tr>
                            <td class="py-0.5 px-0.2">${escapeHtml(String(group.hsncode))}</td>
                            <td class="text-center py-0.5 px-0.2">${group.totalQuantity}</td>
                            <td class="text-right py-0.5 px-0.2">${(group.totalTaxableValue || 0).toFixed(2)}</td>
                            <td class="text-right py-0.5 px-0.2">${(group.cgstRate || 0).toFixed(1)}</td>
                            <td class="text-right py-0.5 px-0.2">${(group.totalCgstAmount || 0).toFixed(2)}</td>
                            <td class="text-right py-0.5 px-0.2">${(group.totalSgstAmount || 0).toFixed(2)}</td>
                            <td class="text-right py-0.5 px-0.2">${(group.totalTax || 0).toFixed(2)}</td>
                          </tr>`
                      )
                      .join("")}
                    <tr class="font-semibold border-t border-gray-400 bg-gray-200">
                      <td class="text-center py-0.5 px-0.2" colspan="2">Total</td>
                      <td class="text-right py-0.5 px-0.2">${((paymentData.totalAmount || 0) - (paymentData.cgstAmount || 0) - (paymentData.sgstAmount || 0)).toFixed(2)}</td>
                      <td class="py-0.5 px-0.2"></td>
                      <td class="text-right py-0.5 px-0.2">${(paymentData.cgstAmount || 0).toFixed(2)}</td>
                      <td class="text-right py-0.5 px-0.2">${(paymentData.sgstAmount || 0).toFixed(2)}</td>
                      <td class="text-right py-0.5 px-0.2">${(paymentData.totalGstAmount || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
                <div class="font-semibold text-[10px] mb-3" style="font-style: italic;">
                  GST Amount in Word: ${escapeHtml(totalGstAmountInWords)}
                </div>
                <div class="text-center text-[10px]">
                  <p class="font-semibold text-gray-900">Thank you for your purchase!</p>
                  <p class="text-gray-600">Visit again - www.tastenbite.com</p>
                  <p class="text-[9px] text-gray-500 mt-1">Computer-generated bill</p>
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
      <div className="top-4 left-0 z-20">
      </div>
      <div className="bill-print relative w-[288px] min-h-[600px] p-6 text-gray-900 font-inter text-xs mx-auto" style={{ border: "1px solid #d1d5db", borderRadius: "0.375rem" }}>
        <Image
          src="/tnb4.png"
          alt="Watermark"
          className="pointer-events-none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "60%",
            opacity: 0.06,
            transform: "translate(-50%, -50%)",
            zIndex: 0
          }}
          width={180}
          height={180}
          priority
        />
        <div className="relative z-10">
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold text-gray-900 tracking-wide">{companyData.CName || "TEST FRANCHISE"}</h1>
            <p className="text-[10px] text-gray-600">{companyData.CAddress || "Halishar"}, {companyData.CState || "West Bengal"} {companyData.CPin || "743145"}, Mob. {companyData.CContactNo || "6289675776"}</p>
            <p className="text-[10px] text-gray-600">GST IN - {companyData.gstin || "123456789000"}</p>
            <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "4px 0", textAlign: "center", fontWeight: "bold", marginBottom: 6 }}>
              TAX INVOICE
            </div>
          </div>
          <div className="flex justify-between text-[10px] mb-3">
            <div className="flex">
              <div className="font-bold">Bill No.:</div>
              <div>{paymentData.invoiceNumber}</div>
            </div>
            <div className="flex text-right">
              <div className="font-bold">Date:</div>
              <div>{formattedDate}</div>
            </div>
          </div>
          <div className="flex justify-between text-[10px] mb-4">
            <div className="flex">
              <div className="font-bold">Name:</div>
              <div>{paymentData.customerData.name}</div>
            </div>
            <div className="flex text-right">
              <div className="font-bold">Mobile No:</div>
              <div>{paymentData.customerData.MOBPHONE}</div>
            </div>
          </div>
          <table className="w-full text-[8px] mb-4">
            <thead>
              <tr className="bg-gray-200 text-gray-700 font-semibold">
                <th className="text-left py-1 px-1">S.No.</th>
                <th className="text-left py-1 px-1 max-w-[80px] break-words">Item Name</th>
                <th className="text-center py-1 px-1">Qty.</th>
                <th className="text-left py-1 px-1">Uom</th>
                <th className="text-right py-1 px-1">Rate</th>
                <th className="text-right py-1 px-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {paymentData.products.map((product, index) => (
                <tr key={product.id}>
                  <td className="py-1 px-1">{index + 1}</td>
                  <td className="py-1 px-1 max-w-[80px] break-words">{product.name}</td>
                  <td className="text-center py-1 px-1">{product.QUANTITY || 0}</td>
                  <td className="py-1 px-1">{product.uom}</td>
                  <td className="text-right py-1 px-1">{(product.price || 0).toFixed(2)}</td>
                  <td className="text-right py-1 px-1">{((product.QUANTITY || 0) * (product.price || 0)).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-gray-200 font-semibold">
                <td className="py-1 px-1">{advanceAmount > 0 ? `Advance:` : ""}</td>
                <td className="py-1 px-1">{advanceAmount > 0 ? `${advanceAmount.toFixed(2)}` : ""}</td>
                <td className="py-1 px-1"></td>
                <td className="py-1 px-1"></td>
                <td className="text-right py-1 px-1">Total:</td>
                <td className="text-right py-1 px-1">{(paymentData.totalAmount || 0).toFixed(2)}</td>
              </tr>
              {advanceAmount > 0 && (
                <tr className="bg-gray-200 font-semibold">
                  <td className="py-1 px-1"></td>
                  <td className="py-1 px-1"></td>
                  <td className="py-1 px-1"></td>
                  <td className="py-1 px-1"></td>
                  <td className="py-1 px-1">Balance:</td>
                  <td className="py-1 px-1">{remainingBalance.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="font-semibold text-[10px] mb-3" style={{ fontStyle: "italic" }}>
            Total Amount in Word: {totalAmountInWords}
          </div>
          {/* {advanceAmount > 0 && (
            <>
              <div className="font-semibold text-[10px] mb-3" style={{ fontStyle: "italic" }}>
                Advance Amount in Word: {advanceAmountInWords}
              </div>
              <div className="font-semibold text-[10px] mb-3" style={{ fontStyle: "italic" }}>
                Balance Amount in Word: {remainingBalanceInWords}
              </div>
            </>
          )} */}
          <table className="w-full text-[8px] mb-4">
            <thead>
              <tr className="bg-gray-200 text-gray-700 font-semibold">
                <th className="text-left py-0.5 px-0.2">HSN/SAC</th>
                <th className="text-center py-0.5 px-0.2">Qty</th>
                <th className="text-right py-0.5 px-0.2">Taxable Value</th>
                <th className="text-right py-0.5 px-0.2">Rate%</th>
                <th className="text-right py-0.5 px-0.2">Central Tax</th>
                <th className="text-right py-0.5 px-0.2">State Tax</th>
                <th className="text-right py-0.5 px-0.2">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {hsnGroups.map((group, index) => (
                <tr key={index}>
                  <td className="py-0.5 px-0.2 max-w-[80px] break-words">{group.hsncode}</td>
                  <td className="text-center py-0.5 px-0.2">{group.totalQuantity}</td>
                  <td className="text-right py-0.5 px-0.2">{(group.totalTaxableValue || 0).toFixed(2)}</td>
                  <td className="text-right py-0.5 px-0.2">{(group.cgstRate || 0).toFixed(1)}</td>
                  <td className="text-right py-0.5 px-0.2">{(group.totalCgstAmount || 0).toFixed(2)}</td>
                  <td className="text-right py-0.5 px-0.2">{(group.totalSgstAmount || 0).toFixed(2)}</td>
                  <td className="text-right py-0.5 px-0.2">{(group.totalTax || 0).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-semibold border-t border-gray-400 bg-gray-200">
                <td className="text-center py-0.5 px-0.2" colSpan={2}>Total</td>
                <td className="text-right py-0.5 px-0.2">{((paymentData.totalAmount || 0) - (paymentData.cgstAmount || 0) - (paymentData.sgstAmount || 0)).toFixed(2)}</td>
                <td className="py-0.5 px-0.2"></td>
                <td className="text-right py-0.5 px-0.2">{(paymentData.cgstAmount || 0).toFixed(2)}</td>
                <td className="text-right py-0.5 px-0.2">{(paymentData.sgstAmount || 0).toFixed(2)}</td>
                <td className="text-right py-0.5 px-0.2">{(paymentData.totalGstAmount || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div className="font-semibold text-[10px] mb-3" style={{ fontStyle: "italic" }}>
            GST Amount in Word: {totalGstAmountInWords}
          </div>
          <div className="text-center text-[10px]">
            <p className="font-semibold text-gray-900">Thank you for your purchase!</p>
            <p className="text-gray-600">Visit again - www.tastenbite.com</p>
            <p className="text-[9px] text-gray-500 mt-1">Computer-generated bill</p>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={handlePrint}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
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