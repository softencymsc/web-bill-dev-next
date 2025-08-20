"use client";
import React, { useEffect, useState } from 'react';
import Print from '../../components/Print'; // Adjust the import path as needed

// Define the PaymentData interface to match Print component expectations
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

// Mock company data (adjust as needed)
const companyData = {
  CName: "TEST FRANCHISE",
  CAddress: "Halishar",
  CContactNo: "6289675776",
  CDist: "",
  CState: "West Bengal",
  CPin: "743145",
  gstin: "123456789000",
  franchiseName: "TEST FRANCHISE",
};

const Page = () => {
  // State to hold transaction data
  const [transactionData, setTransactionData] = useState<PaymentData | null>(null);

  useEffect(() => {
    // Fetch lastTransaction from localStorage
    const lastTransaction = localStorage.getItem('lastTransaction');
    if (lastTransaction) {
      const parsedData = JSON.parse(lastTransaction);
      
      // Calculate total quantity for proportional distribution
      const totalQuantity = parsedData.products.reduce((sum: number, product: any) => sum + parseFloat(product.QUANTITY), 0);
      
      // Map the transaction data to match PaymentData interface
      const formattedData: PaymentData = {
        invoiceNumber: parsedData.invoiceNumber,
        date: parsedData.date,
        customerData: {
          name: parsedData.customerData.NAME,
          MOBPHONE: parsedData.customerData.MOBPHONE,
        },
        products: parsedData.products.map((product: any) => {
          const productQuantity = parseFloat(product.QUANTITY);
          // Proportionally distribute CGST and SGST based on quantity
          const productShare = productQuantity / totalQuantity;
          return {
            id: product.id,
            name: product.name,
            QUANTITY: productQuantity,
            price: product.price,
            uom: product.UOM_SALE,
            cgstAmount: parsedData.cgstAmount * productShare,
            sgstAmount: parsedData.sgstAmount * productShare,
            cgstRate: product.IGST / 2, // Assuming IGST is split equally between CGST and SGST
            sgstRate: product.IGST / 2,
            hsncode: product.HSNCODE.toString(),
          };
        }),
        totalAmount: parsedData.totalAmount,
        totalGstAmount: parsedData.totalGstAmount,
        cgstAmount: parsedData.cgstAmount,
        sgstAmount: parsedData.sgstAmount,
        advanceAmount: parsedData.paymentDetails.cashAmount, // Assuming cashAmount as advance
      };
      setTransactionData(formattedData);
    }
  }, []);

  return (
    <div>
      {transactionData ? (
        <Print paymentData={transactionData} companyData={companyData} />
      ) : (
        <div className="text-center text-gray-600 text-lg mt-10">
          No Transaction
        </div>
      )}
    </div>
  );
};

export default Page;