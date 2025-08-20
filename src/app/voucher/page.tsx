"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { toast } from "react-toastify";
import Load from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface Voucher {
  id: string;
  type: string;
  voucherNo: string;
  voucherDate: string;
  glCode: string;
  glAccount: string;
  cashBank: string;
  cashBankCode: string;
  initialName: string;
  narration: string;
  payToReceiptFrom: string;
  chequeNoTransId: string;
  drawnOn: string;
  chequeDate: string;
  amount: number;
}

export default function VoucherPage() {
  const headers = [
    { label: 'Type', key: 'type' },
    { label: 'Voucher No', key: 'voucherNo' },
    { label: 'Voucher Date', key: 'voucherDate' },
    { label: 'GL Code', key: 'glCode' },
    { label: 'GL Account', key: 'glAccount' },
    { label: 'Cash/Bank', key: 'cashBank' },
    { label: 'Cash/Bank Code', key: 'cashBankCode' },
    { label: 'Initial Name', key: 'initialName' },
    { label: 'Narration', key: 'narration' },
    { label: 'Pay To / Receipt From', key: 'payToReceiptFrom' },
    { label: 'Cheque No / Trans ID', key: 'chequeNoTransId' },
    { label: 'Drawn On', key: 'drawnOn' },
    { label: 'Cheque Date', key: 'chequeDate' },
    { label: 'Amount', key: 'amount' },
    { label: 'Actions', key: 'actions' },
  ];
    const { state } = useContext(CounterContext);
  
  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVouchers = async () => {
      setLoading(true);
      try {
        // Fetch GL_Mast collection
        const glMastRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast") as CollectionReference<DocumentData>;
        const glMastSnapshot = await getDocs(query(glMastRef));
        
        // Create a map of GLCODE to DESCRIPT for GL_Account
        const glMastMap = new Map<string, string>();
        glMastSnapshot.forEach((doc) => {
          const data = doc.data();
          glMastMap.set(data.GLCODE, data.DESCRIPT || "N/A");
        });

        // Fetch TRNS1 collection
        const trns1Ref = collection(db, "TenantsDb", state.tenantId, "TRNS1") as CollectionReference<DocumentData>;
        const trns1Snapshot = await getDocs(query(trns1Ref));

        if (trns1Snapshot.empty) {
          console.warn("No transactions found in TRNS1.");
          setData([]);
          return;
        }

        // Join TRNS1 with GL_Mast based on GLCODE
        const vouchers: Voucher[] = trns1Snapshot.docs
          .map((doc) => {
            const d = doc.data();
            const glAccount = glMastMap.get(d.GLCODE) || "Unknown";
            return {
              id:  d.TRNNO || "N/A",
              type: d.TYPE || "N/A",
              voucherNo: d.TRNNO || "N/A",
              voucherDate: d.TRN_DATE || "N/A",
              glCode: d.GLCODE || "N/A",
              glAccount: glAccount,
              cashBank: d.CASH_BANK || "N/A",
              cashBankCode: d.CASH_BANK_CODE || "N/A",
              initialName: d.INITIAL_NAME || "N/A",
              narration: d.NARRATION || "N/A",
              payToReceiptFrom: d.PAYEE_R || "N/A",
              chequeNoTransId: d.CHEQUE_TRANS_ID || "N/A",
              drawnOn: d.CHEQUE_ON || "N/A",
              chequeDate: d.CHEQUE_DT || "N/A",
              amount: d.AMOUNT || 0,
            };
          })
          .filter((voucher) => voucher.glCode !== "N/A"); // Ensure GLCODE exists

        setData(vouchers);
      } catch (error: unknown) {
        console.error("Error fetching vouchers:", error);
        // toast.error(
        //   `Failed to load vouchers: ${
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

    fetchVouchers();
  }, []);

  // Delete function for vouchers
  const deleteVoucher = async (id: string) => {
    try {
      const voucherRef = doc(db, "TenantsDb", state.tenantId, "TRNS1", id);
      await deleteDoc(voucherRef);
      setData((prev) => prev.filter((voucher) => voucher.id !== id));
      toast.success("Voucher deleted successfully", { position: "top-center" });
    } catch (error: unknown) {
      console.error("Error deleting voucher:", error);
      // toast.error(
      //   `Failed to delete voucher: ${
      //     error instanceof Error ? error.message : "Unknown error"
      //   }`,
      //   { position: "top-center" }
      // );
    }
  };

  // Add delete action to each voucher
  const dataWithActions = data.map((voucher) => ({
    ...voucher,
    actions: (
      <button
        onClick={() => deleteVoucher(voucher.id)}
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
          <Load />
        ) : (
          <Master_Page page={"Voucher"} headers={headers} data={dataWithActions.reverse()} onDraftClick={undefined} collectionName={undefined} renderCell={undefined} />
        )}
      </section>
    </main>
  );
}
