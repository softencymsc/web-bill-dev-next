"use client";
import Master_Page from '@/components/Master_Page';
import React, { useEffect, useState,useContext } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query } from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface ORDER {
  id: string;
  purchaseDate: string;
  purchaseBillNo: string;
  vendorName: string;
  contact: string;
  amount: number | string;
}

export default function OrderPage() {
  const headers = [
    { label: 'Purchase Date', key: 'purchaseDate' },
    { label: 'Purchase Bill No', key: 'purchaseBillNo' },
    { label: 'Vendor Name', key: 'vendorName' },
    { label: 'Contact', key: 'contact' },
    { label: 'Amount', key: 'amount' },
    { label: 'Actions', key: 'actions' },
  ];

  const [data, setData] = useState<ORDER[]>([]);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);

  useEffect(() => {
    const fetchBills = async () => {
      setLoading(true);
      try {
        const orderRef = collection(db, "TenantsDb", state.tenantId, "PORDER") as CollectionReference<DocumentData>;
        const q = query(orderRef);
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          console.warn("No orders found in the database.");
          setData([]);
          return;
        }
        console.log("Fetched order documents:", snapshot.docs.length);

        const orders: ORDER[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          console.log(d)
          return {
            id: d.BILL_NO,
            purchaseDate: d.BILL_DATE?.toDate().toLocaleDateString() || "N/A",
            purchaseBillNo: d.BILL_NO || "N/A",
            vendorName: d.CUSTNAME || "Unknown",
            contact: d.MOBPHONE || "N/A",
            amount: d.NET_AMOUNT || "N/A",
          };
        });

        setData(orders);
      } catch (error: unknown) {
        console.error("Error fetching orders:", error);
        // toast.error(
        //   `Failed to load orders: ${
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

    fetchBills();
  }, []);

  return (
    <main className="flex w-full min-h-screen flex-col md:flex-row overflow-x-hidden">
      <section className="md:w-[100%] md:h-full w-full h-full">
        {loading ? (
          <Loader/>
        ) :  (
          <Master_Page 
            page={"Purchase Order"} 
            headers={headers} 
            data={data} 
          />
        )}
      </section>
    </main>
  );
}