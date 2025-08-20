"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query } from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface Ledger {
  id: string;
  gl_code: string;
  descrip: string;
  pl_bal: string;
  pl_bal_group: string;
  subGroup: string;
  cashGroup: string;
}

export default function Page() {
  const headers = [
    { label: 'GL Code', key: 'gl_code' },
    { label: 'Description', key: 'descrip' },
    { label: 'PL/Balance Sheet', key: 'pl_bal' },
    { label: 'PL/Balance Sheet Group', key: 'pl_bal_group' },
    { label: 'Sub Group', key: 'subGroup' },
    { label: 'Cash/Group', key: 'cashGroup' },
    { label: 'Actions', key: 'actions' },
  ];

  const [data, setData] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);

  useEffect(() => {
    const fetchLedger= async () => {
      setLoading(true);
      try {
        const ledgerRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast") as CollectionReference<DocumentData>;
        const q = query(ledgerRef); // No specific filters, adjust if needed
        const snapshot = await getDocs(q);
        console.log("Fetched ledger documents:", snapshot.docs[0].data());
        if (snapshot.empty) {
          console.warn("No ledgers found in the database.");
          setData([]);
          return;
        }

        const customers: Ledger[] = snapshot.docs
          .map((doc) => {
            const d = doc.data();
              return {
                id: d.GLCODE || "N/A",
                gl_code: d.GLCODE || "N/A",
                descrip: d.DESCRIPT || "N/A",
                pl_bal: d.PL_BALANCE_SHEET || "N/A",
                pl_bal_group: d.PL_BALANCE_GROUP || "N/A",
                subGroup: d.SUB_GROUP || "N/A", // Adjust based on actual Firebase field
                cashGroup: d.CASH_BANK || "N/A", // Adjust based on actual Firebase field
              };
            return null; // Skip non-customer entries
          })
          .filter((item): item is Ledger => item !== null);

        setData(customers);
      } catch (error: unknown) {
        console.error("Error fetching ledgers:", error);
        // toast.error(
        //   `Failed to load ledger: ${
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

    fetchLedger();
  }, []);

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) : (
          <Master_Page page={"Ledger"} headers={headers} data={data} />
        )}
      </section>
    </main>
  );
}