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

// Interface for ORDER data
interface Order {
  ADDRESS: string;
  ADV_AMOUNT: number;
  BASE_AMOUNT: number;
  BILL_LINK: boolean;
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
  OA_DATE: { toDate: () => Date };
  OA_NO: string;
  PAY_MODE: string;
  SGST_AMOUNT: number;
  UPI_AMOUNT: number;
}

// Interface for ORDERDET data
interface OrderDet {
  AMOUNT: number;
  CGSTAMT: number;
  CUSTNAME: string;
  DISCPER: number;
  GSTAMT: number;
  GroupDesc: string;
  HSNCODE: number;
  IGSTAMT: number;
  IGSTPER: number;
  OA_DATE: { toDate: () => Date };
  OA_NO: string;
  PRODCODE: string;
  PRODNAME: string;
  PRODTOTAL: number;
  QUANTITY: number;
  RATE: number;
  SGSTAMT: number;
  SGroupDesc: string;
  TOTALAMT: number;
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
    const fetchOrderData = async () => {
      try {
        // Fetch ORDER data
        const orderQuery = query(
          collection(db, "TenantsDb", state.tenantId, "ORDER"),
          where("OA_NO", "==", id)
        );
        const orderSnapshot = await getDocs(orderQuery);

        if (orderSnapshot.empty) {
          console.error("No order found for OA_NO:", id);
          return;
        }

        const orderData = orderSnapshot.docs[0].data() as Order;

        // Fetch ORDERDET data
        const orderDetQuery = query(
          collection(db, "TenantsDb", state.tenantId, "ORDERDET"),
          where("OA_NO", "==", id)
        );
        const orderDetSnapshot = await getDocs(orderDetQuery);

        // Map ORDERDET to products
        const products = orderDetSnapshot.docs.map((doc) => {
          const data = doc.data() as OrderDet;
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
          invoiceNumber: orderData.OA_NO,
          date: orderData.OA_DATE.toDate().toISOString(),
          customerData: {
            name: orderData.CUSTNAME,
            MOBPHONE: orderData.MOBPHONE,
          },
          products,
          totalAmount: orderData.NET_AMOUNT,
          totalGstAmount: orderData.GST_AMOUNT,
          cgstAmount: orderData.CGST_AMOUNT,
          sgstAmount: orderData.SGST_AMOUNT,
          advanceAmount: orderData.ADV_AMOUNT, // <-- Added this line
        };

        // Define companyData (you may need to fetch this from a Firestore collection or configuration)
        const mappedCompanyData: CompanyData = {
          CName: "TEST FRANCHISE", // Replace with actual data or fetch from Firestore
          CAddress: orderData.ADDRESS || "Halishar",
          CContactNo: "6289675776", // Replace with actual data or fetch from Firestore
          CDist: orderData.CITY || "",
          CState: orderData.COUNTRY || "West Bengal",
          CPin: "743145", // Replace with actual data or fetch from Firestore
          gstin: "123456789000", // Replace with actual data or fetch from Firestore
          franchiseName: "TEST FRANCHISE", // Replace with actual data or fetch from Firestore
        };

        setPaymentData(mappedPaymentData);
        setCompanyData(mappedCompanyData);
      } catch (error) {
        console.error("Error fetching order data:", error);
      }
    };

    if (id && state.tenantId) {
      fetchOrderData();
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