/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
} from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

export default function Page(): any {
  const headers: any = [
    { label: 'Code', key: 'code' },
    { label: 'Name', key: 'name' },
    { label: 'Contact', key: 'contact' },
    { label: 'GST Number', key: 'gstNumber' },
    { label: 'Actions', key: 'actions' },
  ];

  type Vendor = {
    id: string;
    code: string;
    name: string;
    contact: string;
    gstNumber: string;
  };

  const [data, setData] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);

  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        const vendorRef = collection(db, "TenantsDb", state.tenantId, "Customers");
        const q = query(vendorRef);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.warn("No vendors found in the database.");
          setData([]);
          return;
        }

        const vendors = snapshot.docs
          .map((doc) => {
            const d = doc.data();
            if (d.CUST_VEND === 'V') {
              console.log("Fetched vendor document:", d);
              return {
                id: d.CUSTCODE,
                code: d.CUSTCODE || "N/A",
                name: d.NAME || "Unknown",
                contact: d.MOBPHONE || "N/A",
                gstNumber: d.GSTIn || "N/A",
              };
            }
            return null;
          })
          .filter((item: any): item is any => item !== null);

        setData(vendors);
      } catch (error) {
        console.error("Error fetching vendors:", error);
        // toast.error(
        //   `Failed to load vendors: ${
        //     typeof error === "object" && error !== null && "message" in error
        //       ? (error as { message?: string }).message
        //       : "Unknown error"
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

    fetchVendors();
  }, []);

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) :(
          <Master_Page page="Vendor" headers={headers} data={data} />
        )}
      </section>
    </main>
  );
}