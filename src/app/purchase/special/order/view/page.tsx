/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useContext, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../../../firebase"; // Adjust the path to your Firebase config
import { CounterContext } from "@/lib/CounterContext";
import Print from "@/components/Print";
import Loader from "@/components/Loader";

// Context type
interface CounterContextType {
  state: {
    tenantId: string;
  };
}

// Interface for SPLORDER data
interface SplOrder {
  ADDRESS: string;
  ADVANCE: string;
  AMOUNT: number;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CAKETYPE: string;
  CATEGORY: string;
  CFLAVOR: string;
  CIMAGEURL: Array<string>;
  CITY: string;
  CMESSAGE: string;
  COMPANY: string;
  COUNTRY: string;
  CREMARKS: string;
  CUSTCODE: string;
  CUSTNAME: string;
  CUSTOMIZETYPE: string;
  DESCRIPT: string;
  DLVDATE: { toDate: () => Date };
  MOBPHONE: string;
  PCS: string;
  PRODCODE: string;
  RATE: string;
  SECURITYRIGHTS: Array<string>;
  SEQUENCE: number;
  SGroupDesc: string;
  STATUS: string;
  WEIGHT: string;
  slot: string;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch company data from local storage
    const company = JSON.parse(localStorage.getItem("company") || "{}");
    setCompanyData(company);

    const fetchSplOrderData = async () => {
      try {
        if (!id || !state.tenantId) {
          setError("Invalid order ID or tenant ID.");
          return;
        }

        // Fetch SPLORDER data using document ID
        const splOrderDocRef = doc(db, "TenantsDb", state.tenantId, "SPLORDER", id);
        const splOrderSnapshot = await getDoc(splOrderDocRef);

        if (!splOrderSnapshot.exists()) {
          setError(`No special order found for ID: ${id}`);
          return;
        }

        const splOrderData = splOrderSnapshot.data() as SplOrder;

        // Map SPLORDER to products (single product in this case)
        const products = [
          {
            id: splOrderData.PRODCODE || "N/A",
            name: `${splOrderData.CFLAVOR} ${splOrderData.WEIGHT} ${splOrderData.CATEGORY} Cake`,
            QUANTITY: parseInt(splOrderData.PCS) || 1,
            price: parseFloat(splOrderData.RATE) || 0,
            uom: "PCS",
            cgstAmount: 0, // No GST data in SPLORDER, set to 0
            sgstAmount: 0, // No GST data in SPLORDER, set to 0
            cgstRate: 0, // No GST data in SPLORDER, set to 0
            sgstRate: 0, // No GST data in SPLORDER, set to 0
            hsncode: "19059030", // Default HSN code as per first page
          },
        ];

        // No GST data provided in SPLORDER, so set to 0
        const totalCgst = 0;
        const totalSgst = 0;

        // Map data to paymentData
        const mappedPaymentData: PaymentData = {
          invoiceNumber: splOrderData.BILL_NO || "N/A",
          date: splOrderData.BILL_DATE?.toDate().toISOString() || new Date().toISOString(),
          customerData: {
            name: splOrderData.CUSTNAME || "Unknown",
            MOBPHONE: splOrderData.MOBPHONE || "",
          },
          products,
          totalAmount: splOrderData.AMOUNT || 0,
          totalGstAmount: totalCgst + totalSgst,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          advanceAmount: parseFloat(splOrderData.ADVANCE) || 0,
        };

        setPaymentData(mappedPaymentData);
      } catch (error) {
        console.error("Error fetching special order data:", error);
        setError("Failed to fetch special order data. Please try again.");
      }
    };

    fetchSplOrderData();
  }, [id, state.tenantId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!paymentData || !companyData) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Loader />
      </div>
    );
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen w-screen">
          <Loader />
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
};

export default Page;