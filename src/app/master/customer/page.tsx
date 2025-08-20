"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import {collection,CollectionReference,DocumentData,getDocs,query,
} from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";


interface Customer {
  id: string;
  code: string;
  name: string;
  contact: string;
  gstNumber: string;
}

export default function Page() {
  const headers = [
    { label: 'Code', key: 'code' },
    { label: 'Name', key: 'name' },
    { label: 'Contact', key: 'contact' },
    { label: 'GST Number', key: 'gstNumber' },
    { label: 'Actions', key: 'actions' },
  ];
  const { state } = useContext(CounterContext);

  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const customerRef = collection(db, "TenantsDb", state.tenantId, "Customers") as CollectionReference<DocumentData>;
        const q = query(customerRef); // No specific filters, adjust if needed
        const snapshot = await getDocs(q);
        console.log("Fetched customer documents:", snapshot.docs[0].data());
        if (snapshot.empty) {
          console.warn("No customers found in the database.");
          setData([]);
          return;
        }

        const customers: Customer[] = snapshot.docs
          .map((doc) => {
            const d = doc.data();
            if (d.CUST_VEND === 'C') {
              return {
                id: d.CUSTCODE,
                code: d.CUSTCODE || "N/A",
                name: d.NAME || "Unknown",
                contact: d.MOBPHONE || "N/A",
                gstNumber: d.GSTIn || "N/A",
              };
            }
            return null; // Skip non-customer entries
          })
          .filter((item): item is Customer => item !== null);

        setData(customers);
      } catch (error: unknown) {
        console.error("Error fetching customers:", error);
        toast.error(
          `Failed to load customers: ${
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
    };

    fetchCustomers();
  }, []);

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) : (
          <Master_Page page={"Customer"} headers={headers} data={data} />
        )}
      </section>
    </main>
  );
}