"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface Staff {
  id: string; // Firestore document ID
  staffid: string; // Custom staff ID field
  companyName: string;
  email: string;
  name: string;
  role: string;
  securityRights: string[];
}

export default function Page() {
  // Updated headers to exclude duplicate ID field (only showing staffid)
  const headers = [
    { label: 'Staff ID', key: 'staffid' }, // Use staffid explicitly
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Role', key: 'role' },
    { label: 'Company Name', key: 'companyName' },
    { label: 'Actions', key: 'actions' },
  ];

  const { state } = useContext(CounterContext);
  const [data, setData] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true);
      try {
        const staffRef = collection(db, "TenantsDb", state.tenantId, "STAFF") as CollectionReference<DocumentData>;
        const q = query(staffRef);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.warn("No staff found in the database.");
          setData([]);
          return;
        }

        const staff: Staff[] = snapshot.docs.map((doc) => ({
          id: doc.id, // Keep document ID for internal use (e.g., updates/deletes)
          staffid: doc.data().staffId || "N/A", // Use the custom staffId field
          companyName: doc.data().companyName || "N/A",
          email: doc.data().email || "N/A",
          name: doc.data().name || "Unknown",
          role: doc.data().role || "N/A",
          securityRights: doc.data().securityRights || [],
        }));

        setData(staff);
      } catch (error: unknown) {
        console.error("Error fetching staff:", error);
        // toast.error(
        //   `Failed to load staff: ${
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

    fetchStaff();
  }, [state.tenantId]);

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) : (
          <Master_Page 
            page={"Staff"} 
            headers={headers} 
            data={data} 
          />
        )}
      </section>
    </main>
  );
}