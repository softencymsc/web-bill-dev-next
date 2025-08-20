"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import {collection,CollectionReference,DocumentData,getDocs,query,} from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface Product {
  id: string;
  code: string;
  description: string;
  group: string;
  uom: string;
  mrp: number;
  qty: number;
  createdBy : string;
}

export default function Page() {
  const headers = [
    { label: 'Code', key: 'code' },
    { label: 'Description', key: 'description' },
    { label: 'Group', key: 'group' },
    { label: 'UOM', key: 'uom' },
    { label: 'MRP', key: 'mrp' },
    { label: 'Qty', key: 'qty' },
    { label: 'actions', key: 'actions' },
  ];

  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const productRef = collection(db, "TenantsDb", state.tenantId, "Products") as CollectionReference<DocumentData>;
        const q = query(productRef);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.warn("No products found in the database.");
          setData([]);
          return;
        }

        const products: Product[] = snapshot.docs
          .map((doc) => {
            const d = doc.data();
            console.log("Fetched product document:", d);
            if(d.AVAILABLE=== true || d.createdBy !== "company") {
            return {
              id: d.PRODCODE || "N/A",
              code: d.PRODCODE || "N/A",
              description: d.DESCRIPT || "Unknown",
              group: d.SGroupDesc || "N/A",
              uom: d.UOM_SALE || "N/A",
              mrp: parseInt(d.MRP_RATE) || 0,
              qty: parseInt(d.OPENING_Q) || 0,
              createdBy: d.createdBy || "N/A",
            };
          }
          })
          .filter((item): item is Product => item !== null);

        setData(products);
      } catch (error: unknown) {
        console.error("Error fetching products:", error);
        // toast.error(
        //   `Failed to load products: ${
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

    fetchProducts();
  }, []);

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) : (
          <Master_Page page="Product" headers={headers.filter(h => h.label !== 'Actions' || h.key !== 'actions')} data={data} />
        )}
      </section>
    </main>
  );
}
 