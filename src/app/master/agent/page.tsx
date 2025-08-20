"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query } from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface Agent {
  id: string;
  code: string;
  name: string;
  contact: string;
  commissionPercentage: string;
  status: string;
}

export default function Page() {
  const headers = [
    { label: 'Code', key: 'code' },
    { label: 'Name', key: 'name' },
    { label: 'Contact', key: 'contact' },
    { label: 'Commission %', key: 'commissionPercentage' },
    { label: 'Status', key: 'status' },
    { label: 'Actions', key: 'actions' },
  ];
  const { state } = useContext(CounterContext);

  const [data, setData] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
      try {
        const agentRef = collection(db, "TenantsDb", state.tenantId, "AGENTS") as CollectionReference<DocumentData>;
        const q = query(agentRef);
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          console.warn("No agents found in the database.");
          setData([]);
          return;
        }

        const agents: Agent[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: d.AGENTCODE,
            code: d.AGENTCODE || "N/A",
            name: d.NAME || "Unknown",
            contact: d.PHONENUMBER || "N/A",
            commissionPercentage: d.COMMISSIONPERCENTAGE || "0",
            status: d.STATUS || "N/A",
          };
        });

        setData(agents);
      } catch (error: unknown) {
        console.error("Error fetching agents:", error);
        // toast.error(
        //   `Failed to load agents: ${
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

    fetchAgents();
  }, [state.tenantId]);

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) : (
          <Master_Page 
            page={"Agent"} 
            headers={headers} 
            data={data} 
          />
        )}
      </section>
    </main>
  );
}