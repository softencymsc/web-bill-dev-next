/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useContext, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../../firebase"; // Adjust the path to your Firebase config
import { CounterContext } from "@/lib/CounterContext";
import Print from "@/components/Print";
import Loader from "@/components/Loader";

// Context type
interface CounterContextType {
  state: {
    tenantId: string;
  };
}

// Interface for BILLIN data
interface BillIn {
  ADDRESS: string;
  BASIC: string;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CARD_AMOUNT: number;
  CASH_AMOUNT: number;
  CGSTAMT?: string | number;
  CITY: string;
  COUNTRY: string;
  CREDIT_AMOUNT: number;
  CUSTCODE: string;
  CUSTNAME: string;
  GST_AMOUNT: number;
  IS_CREDIT: boolean | string;
  IS_FREE: boolean | string;
  MOBPHONE: string;
  NET_AMOUNT: string;
  OUTSTANDING_AMOUNT: string;
  PAY_MODE: string;
  PROMO_CODE: string;
  PROMO_DISCOUNT: number;
  SGST_AMOUNT?: string | number;
  TERMTOTAL: number;
  TOTAL_UPI_AMOUNT: number;
  UPI_AMOUNT: number;
  UPI_DETAILS: Array<{ amount: number; method: string }>;
}

// Interface for BLLINDET data
interface BllInDet {
  AMOUNT: string;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CGSTAMT: string | number;
  CUSTNAME: string;
  GSTAMT: string;
  GroupDesc: string;
  IGSTAMT: string;
  IGSTPER: number;
  PRODCODE: string;
  PRODNAME: string;
  PRODTOTAL: string;
  QUANTITY: number;
  RATE: number;
  SGSTAMT: string | number;
  SGroupDesc: string;
  TOTALAMT: string;
  UOM: string;
  HSNCODE: string | number;
}

// Interface for paymentData prop in Print component
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
  advanceAmount: number;
}

// Interface for companyData prop in Print component
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

const PageContent: React.FC = () => {
  const { state } = useContext(CounterContext) as CounterContextType;
  const searchParams = useSearchParams();
  const id = searchParams?.get("id") ?? "";
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);

  useEffect(() => {
    // Fetch company data from local storage
    const company = JSON.parse(localStorage.getItem("company") || "{}");
    setCompanyData(company);

    const fetchBillInData = async () => {
      try {
        // Fetch BILLIN data
        const billInQuery = query(collection(db, "TenantsDb", state.tenantId, "BILLIN"), where("BILL_NO", "==", id));
        const billInSnapshot = await getDocs(billInQuery);

        if (billInSnapshot.empty) {
          console.error("No purchase bill found for BILL_NO:", id);
          return;
        }

        const billInData = billInSnapshot.docs[0].data() as BillIn;

        // Fetch BLLINDET data
        const bllInDetQuery = query(collection(db, "TenantsDb", state.tenantId, "BLLINDET"), where("BILL_NO", "==", id));
        const bllInDetSnapshot = await getDocs(bllInDetQuery);

        // Map BLLINDET to products
        const products = bllInDetSnapshot.docs.map((doc) => {
          const data = doc.data() as BllInDet;
          const cgstAmount = parseFloat(data.CGSTAMT.toString()) || 0;
          const sgstAmount = parseFloat(data.SGSTAMT.toString()) || 0;
          const totalProductAmount = (data.QUANTITY || 0) * (data.RATE || 0);
          const totalGstRate = data.IGSTPER || 0;
          const cgstRate = totalGstRate > 0 ? totalGstRate / 2 : 0;
          const sgstRate = totalGstRate > 0 ? totalGstRate / 2 : 0;
          const taxableValue = totalGstRate > 0 ? totalProductAmount / (1 + totalGstRate / 100) : totalProductAmount;
          const finalCgstRate = totalGstRate > 0 ? cgstRate : taxableValue > 0 ? (cgstAmount / taxableValue) * 100 : 0;
          const finalSgstRate = totalGstRate > 0 ? sgstRate : taxableValue > 0 ? (sgstAmount / taxableValue) * 100 : 0;

          return {
            id: data.PRODCODE || "",
            name: data.PRODNAME || "",
            QUANTITY: data.QUANTITY || 0,
            price: data.RATE || 0,
            uom: data.UOM || "",
            cgstAmount,
            sgstAmount,
            cgstRate: finalCgstRate,
            sgstRate: finalSgstRate,
            hsncode: data.HSNCODE.toString() || "19059030",
          };
        });

        // Aggregate CGSTAMT and SGSTAMT from BLLINDET
        const totalCgst = products.reduce((sum, product) => sum + (product.cgstAmount || 0), 0);
        const totalSgst = products.reduce((sum, product) => sum + (product.sgstAmount || 0), 0);

        // Map data to paymentData
        const mappedPaymentData: PaymentData = {
          invoiceNumber: billInData.BILL_NO || "",
          date: billInData.BILL_DATE?.toDate().toISOString() || new Date().toISOString(),
          customerData: {
            name: billInData.CUSTNAME || "",
            MOBPHONE: billInData.MOBPHONE || "",
          },
          products,
          totalAmount: parseFloat(billInData.NET_AMOUNT) || 0,
          totalGstAmount: totalCgst + totalSgst,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          advanceAmount: parseFloat(billInData.OUTSTANDING_AMOUNT) || 0, // Assuming OUTSTANDING_AMOUNT is the paid amount
        };

        setPaymentData(mappedPaymentData);
      } catch (error) {
        console.error("Error fetching purchase bill data:", error);
      }
    };

    if (id && state.tenantId) {
      fetchBillInData();
    }
  }, [id, state.tenantId]);

  if (!paymentData || !companyData) {
    return <div className="flex items-center justify-center h-screen w-screen"><Loader /></div>;
  }

  return (
    <main className="flex max-w-full overflow-hidden h-full flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        <Print paymentData={paymentData} companyData={companyData} />
      </section>
    </main>
  );
};

const Page: React.FC = () => {
  return (
    <Suspense fallback={<div><Loader /></div>}>
      <PageContent />
    </Suspense>
  );
};

export default Page;