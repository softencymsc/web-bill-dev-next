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

// Interface for BILL data
interface Bill {
  ADDRESS: string;
  BASIC: string;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CARD_AMOUNT: number;
  CASH_AMOUNT: number;
  CGST_AMOUNT: number;
  CITY: string;
  COUNTRY: string;
  CREDIT_AMOUNT: number;
  CUSTNAME: string;
  CUST_CODE: string;
  GST_AMOUNT: number;
  IS_CREDIT: string;
  IS_FREE: string;
  MOBPHONE: string;
  NET_AMOUNT: string;
  OUTSTANDING_AMOUNT: string;
  PAY_MODE: string;
  PROMO_CODE: string;
  PROMO_DISCOUNT: number;
  SGST_AMOUNT: number;
  TERMTOTAL: number;
  UPI_AMOUNT: number;
}

// Interface for BILLDET data
interface BillDet {
  AMOUNT: string;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CGSTAMT: number;
  CUSTNAME: string;
  DISCPER: number;
  GSTAMT: number;
  GroupDesc: string;
  HSNCODE: number;
  IGSTAMT: number;
  IGSTPER: number;
  PRODCODE: string;
  PRODNAME: string;
  PRODTOTAL: string;
  QUANTITY: number;
  RATE: number;
  SGSTAMT: number;
  SGroupDesc: string;
  TOTALAMT: string;
  UOM: string;
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
    const fetchBillData = async () => {
      try {
        // Fetch BILL data
        const billQuery = query(
          collection(db, "TenantsDb", state.tenantId, "BILL"),
          where("BILL_NO", "==", id)
        );
        const billSnapshot = await getDocs(billQuery);

        if (billSnapshot.empty) {
          console.error("No bill found for BILL_NO:", id);
          return;
        }

        const billData = billSnapshot.docs[0].data() as Bill;

        // Fetch BILLDET data
        const billDetQuery = query(
          collection(db, "TenantsDb", state.tenantId, "BILLDET"),
          where("BILL_NO", "==", id)
        );
        const billDetSnapshot = await getDocs(billDetQuery);

        // Map BILLDET to products
        const products = billDetSnapshot.docs.map((doc) => {
          const data = doc.data() as BillDet;
          return {
            id: data.PRODCODE,
            name: data.PRODNAME,
            QUANTITY: data.QUANTITY,
            price: data.RATE,
            uom: data.UOM,
            cgstAmount: data.CGSTAMT,
            sgstAmount: data.SGSTAMT,
            cgstRate: data.IGSTPER / 2, // Assuming IGSTPER is split equally between CGST and SGST
            sgstRate: data.IGSTPER / 2,
            hsncode: data.HSNCODE.toString(),
          };
        });

        // Map data to paymentData
        const mappedPaymentData: PaymentData = {
          invoiceNumber: billData.BILL_NO,
          date: billData.BILL_DATE.toDate().toISOString(),
          customerData: {
            name: billData.CUSTNAME,
            MOBPHONE: billData.MOBPHONE,
          },
          products,
          totalAmount: parseFloat(billData.NET_AMOUNT),
          totalGstAmount: billData.GST_AMOUNT,
          cgstAmount: billData.CGST_AMOUNT,
          sgstAmount: billData.SGST_AMOUNT,
        };

        // Define companyData (you may need to fetch this from a Firestore collection or configuration)
        const mappedCompanyData: CompanyData = {
          CName: "TEST FRANCHISE", // Replace with actual data or fetch from Firestore
          CAddress: billData.ADDRESS || "Halishar",
          CContactNo: "6289675776", // Replace with actual data or fetch from Firestore
          CDist: billData.CITY || "",
          CState: billData.COUNTRY || "West Bengal",
          CPin: "743145", // Replace with actual data or fetch from Firestore
          gstin: "123456789000", // Replace with actual data or fetch from Firestore
          franchiseName: "TEST FRANCHISE", // Replace with actual data or fetch from Firestore
        };

        setPaymentData(mappedPaymentData);
        setCompanyData(mappedCompanyData);
      } catch (error) {
        console.error("Error fetching bill data:", error);
      }
    };

    if (id && state.tenantId) {
      fetchBillData();
    }
  }, [id, state.tenantId]);

  if (!paymentData || !companyData) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        Loading...
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
    <Suspense fallback={<div><Loader /></div>}>
      <PageContent />
    </Suspense>
  );
};

export default Page;