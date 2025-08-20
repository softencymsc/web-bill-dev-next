"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface SaleOrder {
  id: string;
  orderDate: string;
  orderNo: string;
  customerName: string;
  contact: string;
  advance: number;
  amount: number;
}

export default function SaleOrderPage() {
  const headers = [
    { label: 'Order Date', key: 'orderDate' },
    { label: 'Order No', key: 'orderNo' },
    { label: 'Customer Name', key: 'customerName' },
    { label: 'Contact', key: 'contact' },
    { label: 'Advance', key: 'advance' },
    { label: 'Amount', key: 'amount' },
    { label: 'Actions', key: 'actions' },
  ];

  const [data, setData] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);

  useEffect(() => {
    const fetchSaleOrders = async () => {
      setLoading(true);
      try {
        const orderRef = collection(db, "TenantsDb", state.tenantId, "ORDER") as CollectionReference<DocumentData>;
        const q = query(orderRef);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.warn("No sale orders found in the database.");
          setData([]);
          return;
        }

        const saleOrders: SaleOrder[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          // Convert OA_DATE timestamp to readable date string (e.g., "2025-06-02")
          const orderDate =
            d.OA_DATE && typeof d.OA_DATE.toDate === "function"
              ? d.OA_DATE.toDate().toISOString().split("T")[0]
              : "N/A";

          return {
            id: d.OA_NO || "N/A",
            orderDate,
            orderNo: d.OA_NO || "N/A",
            customerName: d.CUSTNAME || "Unknown",
            contact: d.MOBPHONE || "N/A",
            advance: d.ADV_AMOUNT || 0,
            amount: d.NET_AMOUNT|| 0,
          };
        });

        // Sort saleOrders by orderDate in descending order
        saleOrders.sort((a, b) => {
          const dateA = a.orderDate === "N/A" ? new Date(0) : new Date(a.orderDate);
          const dateB = b.orderDate === "N/A" ? new Date(0) : new Date(b.orderDate);
          return dateB.getTime() - dateA.getTime();
        });

        setData(saleOrders);
      } catch (error: unknown) {
        console.error("Error fetching sale orders:", error);
        // toast.error(
        //   `Failed to load sale orders: ${
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

    fetchSaleOrders();
  }, []);

  // Delete function for sale orders
  const deleteSaleOrder = async (id: string) => {
    try {
      const orderRef = doc(db, "TenantsDb", state.tenantId, "ORDER", id);
      await deleteDoc(orderRef);
      setData((prev) => prev.filter((order) => order.id !== id));
      toast.success("Sale order deleted successfully", { position: "top-center" });
    } catch (error: unknown) {
      console.error("Error deleting sale order:", error);
      // toast.error(
      //   `Failed to delete sale order: ${
      //     error instanceof Error ? error.message : "Unknown error"
      //   }`,
      //   { position: "top-center" }
      // );
    }
  };

  // Add delete action to each sale order
  const dataWithActions = data.map((order) => ({
    ...order,
    actions: (
      <button
        onClick={() => deleteSaleOrder(order.id)}
        className="text-red-600 hover:text-red-800"
      >
        Delete
      </button>
    ),
  }));

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader/>
        ) :
          (<Master_Page page={"Sale Order"} headers={headers} data={dataWithActions} />
        )}
      </section>
    </main>
  );
}