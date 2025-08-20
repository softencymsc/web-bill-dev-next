"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from "next/navigation";

interface ProductOpening {
  id: string;
  code: string;
  description: string;
  group: string;
  uom: string;
  mrp: number;
  qty: number;
}

export default function ProductsOpening() {
  const headers = [
    { label: 'Code', key: 'code' },
    { label: 'Description', key: 'description' },
    { label: 'Group', key: 'group' },
    { label: 'UOM', key: 'uom' },
    { label: 'MRP', key: 'mrp' },
    { label: 'Qty', key: 'qty' },
    { label: 'actions', key: 'actions' },
  ];

  const [data, setData] = useState<ProductOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);
  const router = useRouter();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        if (!state.tenantId) {
          toast.error("Tenant ID is missing. Cannot fetch products.", {
            position: "top-center",
            autoClose: 3000,
          });
          setData([]);
          setLoading(false);
          return;
        }

        const productRef = collection(db, "TenantsDb", state.tenantId, "Products") as CollectionReference<DocumentData>;
        const q = query(productRef, where("AVAILABLE", "==", true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.warn("No products found in the database.");
          toast.error("No products found in the database.", { position: "top-center", autoClose: 3000 });
          setData([]);
          return;
        }

        const products: ProductOpening[] = snapshot.docs
          .map((doc) => {
            const d = doc.data();
            console.log("Fetched product document:", d);
            if (d.AVAILABLE === true) {
              return {
                id: d.PRODCODE || "N/A",
                code: d.PRODCODE || "N/A",
                description: d.DESCRIPT || "Unknown",
                group: d.SGroupDesc || "N/A",
                uom: d.UOM_SALE || "N/A",
                mrp: parseFloat(d.MRP_RATE) || 0,
                qty: parseFloat(d.OPENING_Q) || 0,
              };
            }
            return null;
          })
          .filter((item): item is ProductOpening => item !== null);

        setData(products);
      } catch (error: unknown) {
        console.error("Error fetching products:", error);
        toast.error(
          `Failed to load products: ${
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

    fetchProducts();
  }, [state.tenantId]);

  const handleAddProductOpening = () => {
    router.push('/master/productopening/add');
  };

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) : (
          <div className="p-4">
            <Master_Page
              page="ProductOpening"
              headers={headers.filter(h => h.label !== 'Actions' || h.key !== 'actions')}
              data={data}
            />
          </div>
        )}
      </section>
    </main>
  );
}