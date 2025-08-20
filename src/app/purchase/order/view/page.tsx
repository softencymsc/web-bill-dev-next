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

// Interface for PORDER data
interface POrder {
  ADDRESS: string;
  ADV_AMOUNT: number;
  BASIC: number;
  BILL_DATE: { toDate: () => Date };
  BILL_LINK: boolean;
  BILL_NO: string;
  CARD_AMOUNT: number;
  CASH_AMOUNT: number;
  CGST_AMOUNT: number;
  CITY: string;
  COUNTRY: string;
  CUSTNAME: string;
  CUST_CODE: string;
  GST_AMOUNT: number;
  MOBPHONE: string;
  NET_AMOUNT: number;
  PAY_MODE: string;
  SGST_AMOUNT: number;
  UPI_AMOUNT: number;
  UPI_DETAILS: Array<{ amount: number; method: string }>;
}

// Interface for PORDERDET data
interface POrderDet {
  AMOUNT: number;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CGSTAMT: number;
  CUSTNAME: string;
  DISCOUNTAMT: number;
  DISCOUNTPER: number;
  GSTAMT: number;
  IGSTAMT: number;
  IGSTPER: number;
  PRODCODE: string;
  PRODNAME: string;
  PRODTOTAL: number;
  QUANTITY: number;
  RATE: number;
  SGSTAMT: number;
  SGroupDesc: string;
  TOTALAMT: number;
  UOM: string;
  HSNCODE?: string;
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

    const fetchPOrderData = async () => {
      try {
        // Fetch PORDER data
        const pOrderQuery = query(collection(db, "TenantsDb", state.tenantId, "PORDER"), where("BILL_NO", "==", id));
        const pOrderSnapshot = await getDocs(pOrderQuery);

        if (pOrderSnapshot.empty) {
          console.error("No purchase order found for BILL_NO:", id);
          return;
        }

        const pOrderData = pOrderSnapshot.docs[0].data() as POrder;

        // Fetch PORDERDET data
        const pOrderDetQuery = query(collection(db, "TenantsDb", state.tenantId, "PORDERDET"), where("BILL_NO", "==", id));
        const pOrderDetSnapshot = await getDocs(pOrderDetQuery);

        // Map PORDERDET to products
        const products = pOrderDetSnapshot.docs.map((doc) => {
          const data = doc.data() as POrderDet;
          const cgstAmount = data.CGSTAMT || 0;
          const sgstAmount = data.SGSTAMT || 0;
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
            hsncode: data.HSNCODE || "19059030",
          };
        });

        // Aggregate CGSTAMT and SGSTAMT from PORDERDET
        const totalCgst = products.reduce((sum, product) => sum + (product.cgstAmount || 0), 0);
        const totalSgst = products.reduce((sum, product) => sum + (product.sgstAmount || 0), 0);

        // Map data to paymentData
        const mappedPaymentData: PaymentData = {
          invoiceNumber: pOrderData.BILL_NO || "",
          date: pOrderData.BILL_DATE?.toDate().toISOString() || new Date().toISOString(),
          customerData: {
            name: pOrderData.CUSTNAME || "",
            MOBPHONE: pOrderData.MOBPHONE || "",
          },
          products,
          totalAmount: pOrderData.NET_AMOUNT || 0,
          totalGstAmount: totalCgst + totalSgst,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          advanceAmount: pOrderData.ADV_AMOUNT || 0,
        };

        setPaymentData(mappedPaymentData);
      } catch (error) {
        console.error("Error fetching purchase order data:", error);
      }
    };

    if (id && state.tenantId) {
      fetchPOrderData();
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