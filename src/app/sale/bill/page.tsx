"use client";
import Master_Page from "@/components/Master_Page";
import React, { useContext, useEffect, useState } from "react";
import {
  collection,
  CollectionReference,
  DocumentData,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from "@/components/Loader";
import { CounterContext } from "@/lib/CounterContext";

interface SaleBill {
  id: string;
  billDate: string;
  billNo: string;
  customerName: string;
  contact: string;
  amount: number;
  outstandingAmount: number;
  payMode: string;
}

export default function SaleBillPage() {
  const headers = [
    { label: "Bill Date", key: "billDate" },
    { label: "Bill No", key: "billNo" },
    { label: "Customer Name", key: "customerName" },
    { label: "Contact", key: "contact" },
    { label: "Amount", key: "amount" },
    { label: "Outstanding Amount", key: "outstandingAmount" },
    { label: "Pay Mode", key: "payMode" },
    { label: "Actions", key: "actions" },
  ];
    const { state } = useContext(CounterContext);

  const [data, setData] = useState<SaleBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionName, setCollectionName] = useState<"BILL" | "DRAFT">(
    "BILL"
  );

  useEffect(() => {
    const fetchSaleBills = async () => {
      setLoading(true);
      try {
        const billRef = collection(
          db,
          "TenantsDb",
          state.tenantId,
          collectionName
        ) as CollectionReference<DocumentData>;
        // Order by BILL_DATE in descending order
        const q = query(billRef, orderBy("BILL_DATE", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.warn(
            `No ${collectionName.toLowerCase()} found in the database.`
          );
          setData([]);
          return;
        }

        const saleBills: SaleBill[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          // For DRAFT, fields are nested under 'bill' subfield; for BILL, fields are at root
          const isDraft = collectionName === "DRAFT";
          const billData = isDraft ? d.bill || {} : d;

          console.log(billData);
          // Convert BILL_DATE timestamp to readable date string (e.g., "2025-06-02")
          const billDate =
            d.BILL_DATE && typeof d.BILL_DATE.toDate === "function"
              ? d.BILL_DATE.toDate().toISOString().split("T")[0]
              : "N/A";
          return {
            id: billData.BILL_NO || d.BILL_NO || "N/A",
            billDate,
            billNo: billData.BILL_NO || "N/A",
            customerName: billData.CUSTNAME || "Unknown",
            contact: billData.MOBPHONE || "N/A",
            amount: billData.NET_AMOUNT || 0, // NET_AMT for BILL, OUTSTANDING_AMT for DRAFT
            outstandingAmount: billData.OUTSTANDING_AMOUNT || 0,
            payMode: billData.PAY_MODE || "N/A",
          };
        });

        setData(saleBills);
      } catch (error: unknown) {
        console.error(`Error fetching ${collectionName.toLowerCase()}:`, error);
        // toast.error(
        //   `Failed to load ${collectionName.toLowerCase()}: ${
        //     error instanceof Error ? error.message : "Unknown error"
        //   }`,
        //   {
        //     position: "top-center",
        //     autoClose: 3000,
        //   }
        // );
      } finally {
        setLoading(false);
      }
    };

    fetchSaleBills();
  }, [collectionName]);

  // Handle Draft/Bill toggle
  const handleDraftClick = () => {
    setCollectionName((prev) => (prev === "BILL" ? "DRAFT" : "BILL"));
  };

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ): (
          <Master_Page
            page={"Sale Bill"}
            headers={headers}
            data={data}
            onDraftClick={handleDraftClick}
            collectionName={collectionName}
            renderCell={undefined}
          />
        )}
      </section>
    </main>
  );
}
