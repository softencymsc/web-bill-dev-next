/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import Master_Page from '@/components/Master_Page';
import React, { useEffect, useState, useContext, useCallback } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query, setDoc, doc, writeBatch, Timestamp } from "firebase/firestore";
import { db } from "../../../../firebase";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";
import { toast } from 'react-toastify';
import axios from "axios";
import { useAuth } from "@/context/AuthContext";

interface Bill {
  id: string;
  purchaseDate: string;
  purchaseBillNo: string;
  vendorName: string;
  contact: string;
  amount: number | string;
}

interface MySQLBill {
  ADDRESS: string;
  BASIC: string;
  BILL_DATE: string;
  BILL_NO: string;
  CARD_AMOUNT: number;
  CASH_AMOUNT: number;
  CGST_AMOUNT: number;
  CITY: string;
  COUNTRY: string;
  CREDIT_AMOUNT: number;
  CUSTNAME: string;
  CUST_CODE: string;
  FREE_AMOUNT: number;
  GST_AMOUNT: number;
  IS_CREDIT: string;
  IS_FREE: string;
  IS_OWNER_DISCOUNT: string;
  MOBPHONE: string;
  NET_AMOUNT: string;
  OUTSTANDING_AMOUNT: string;
  OWNER_DISCOUNT_AMOUNT: number;
  PAY_MODE: string;
  PROMO_CODE: string;
  PROMO_DISCOUNT: number;
  SGST_AMOUNT: number;
  TERMTOTAL: number;
  UPI_AMOUNT: number;
  UPI_DETAILS: string;
  WEBIMPORT: number;
}

export default function BillPage() {
  const headers = [
    { label: 'Purchase Date', key: 'purchaseDate' },
    { label: 'Purchase Bill No', key: 'purchaseBillNo' },
    { label: 'Vendor Name', key: 'vendorName' },
    { label: 'Contact', key: 'contact' },
    { label: 'Amount', key: 'amount' },
    { label: 'Actions', key: 'actions' },
  ];

  const [data, setData] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { state } = useContext(CounterContext);
  const { user } = useAuth();

  // Parse date (Timestamp, ISO string, custom string, or invalid)
  const parseBillDate = (dateValue: string | Timestamp | null | undefined): Date => {
    if (!dateValue) {
      console.warn("Invalid date value: null or undefined");
      return new Date();
    }
    if (dateValue instanceof Timestamp) {
      return dateValue.toDate();
    }
    if (typeof dateValue === 'string') {
      // Try parsing as ISO string
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
      // Try parsing custom format (e.g., "August 20, 2025 at 7:26:19 AM UTC+5:30")
      const customDate = new Date(dateValue.replace("UTC+5:30", "+0530"));
      if (!isNaN(customDate.getTime())) {
        return customDate;
      }
    }
    console.warn(`Invalid date value: ${JSON.stringify(dateValue)}`);
    return new Date();
  };

  // Fetch bills from Firestore
  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      if (!state.tenantId) {
        throw new Error("Tenant ID is missing");
      }
      const billRef = collection(db, "TenantsDb", state.tenantId, "BILLIN") as CollectionReference<DocumentData>;
      const q = query(billRef);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.warn("No bills found in the database.");
        setData([]);
        return;
      }
      console.log("Fetched bill documents:", snapshot.docs.length);

      const bills: Bill[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        console.log("Raw BILL_DATE:", d.BILL_DATE, "Type:", typeof d.BILL_DATE); // Debug
        const billDate = parseBillDate(d.BILL_DATE);
        return {
          id: d.BILL_NO || "N/A",
          purchaseDate: billDate.toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "2-digit",
          }) || "N/A",
          purchaseBillNo: d.BILL_NO || "N/A",
          vendorName: d.CUSTNAME || "Unknown",
          contact: d.MOBPHONE || "N/A",
          amount: d.NET_AMOUNT || "N/A",
        };
      });

      setData(bills);
    } catch (error: unknown) {
      console.error("Error fetching bills:", error);
      toast.error(
        `Failed to load bills: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          position: "top-center",
          autoClose: 3000,
        }
      );
    } finally {
      setLoading(false);
    }
  }, [state.tenantId]);

  // Synchronize data from MySQL to Firestore
  const handleSynchronize = async () => {
    if (!user) {
      toast.error("You must be logged in to synchronize data", {
        position: "top-center",
        autoClose: 3000,
      });
      return;
    }

    setIsSyncing(true);
    try {
      console.log("Current user:", user); // Debug
      // Fetch MySQL data
      const response = await axios.get(`/api/pbillsync`, {
        params: { tenantId: state.tenantId },
      });

      const { data: mysqlBills, count } = response.data;
      console.log("Fetched MySQL bills:", count);

      if (!mysqlBills || mysqlBills.length === 0) {
        toast.warn("No bills to synchronize", {
          position: "top-center",
          autoClose: 3000,
        });
        return;
      }

      // Upload to Firestore with batched writes
      const billRef = collection(db, "TenantsDb", state.tenantId, "BILLIN");
      let batch = writeBatch(db);
      let operationCount = 0;
      const syncedBillNos: string[] = [];

      for (const bill of mysqlBills as MySQLBill[]) {
        if (!bill.BILL_NO) {
          console.warn("Skipping bill with missing BILL_NO:", bill);
          continue;
        }
        // Ensure BILL_DATE is an ISO string
        const billDate = bill.BILL_DATE && !isNaN(new Date(bill.BILL_DATE).getTime())
          ? new Date(bill.BILL_DATE).toISOString()
          : new Date().toISOString();
        
        const docRef = doc(billRef, bill.BILL_NO);
        batch.set(docRef, { ...bill, BILL_DATE: billDate, WEBIMPORT: 1 }, { merge: true });
        syncedBillNos.push(bill.BILL_NO);
        operationCount++;

        if (operationCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      // Update WEBIMPORT in MySQL
      if (syncedBillNos.length > 0) {
        await axios.post("/api/update-webimport", { billNos: syncedBillNos });
        console.log(`Updated WEBIMPORT for ${syncedBillNos.length} bills in MySQL`);
      }

      toast.success(`Successfully synchronized ${syncedBillNos.length} bills to Firestore`, {
        position: "top-center",
        autoClose: 3000,
      });

      // Refresh the displayed bills
      await fetchBills();
    } catch (error: unknown) {
      console.error("Sync failed:", error);
      toast.error(
        `Failed to synchronize bills: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          position: "top-center",
          autoClose: 3000,
        }
      );
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  return (
    <main className="flex w-full min-h-screen flex-col md:flex-row overflow-x-hidden">
      <section className="md:w-[100%] md:h-full w-full h-full">
        {loading ? (
          <Loader />
        ) : (
          <Master_Page
            page={"Purchase Bill"}
            headers={headers}
            data={data}
            onSynchronize={handleSynchronize}
            isSyncing={isSyncing}
          />
        )}
      </section>
    </main>
  );
}