"use client";
import Master_Page from '@/components/Master_Page';
import React, { useContext, useEffect, useState } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query, Timestamp } from "firebase/firestore";
import { db } from "../../../../firebase";
import { toast } from "react-toastify";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

interface Transaction {
  transactionAmount: number;
  generalLedger: string;
  transactionType: 'Credit' | 'Debit';
}

interface Journal {
  id: string;
  journalId: string;
  date: string;
  description: string;
  transactions: Transaction[];
  totalCredit: string;
  totalDebit: string;
  glCodes: string;
}

export default function JournalPage() {
  const headers = [
    { label: 'Date', key: 'date' }, // Moved Date to the first column for emphasis
    { label: 'Journal ID', key: 'journalId' },
    { label: 'Description', key: 'description' },
    { label: 'Total Credit', key: 'totalCredit' },
    { label: 'Total Debit', key: 'totalDebit' },
    { label: 'GL Codes', key: 'glCodes' },
    { label: 'Actions', key: 'actions' },
  ];

  const [data, setData] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);

  useEffect(() => {
    const fetchJournals = async () => {
      setLoading(true);
      try {
        // Fetch journals from TRNS1
        const journalRef = collection(db, "TenantsDb", state.tenantId, "TRNS1") as CollectionReference<DocumentData>;
        const journalSnapshot = await getDocs(query(journalRef));
        console.log(`Fetched ${journalSnapshot.docs.length} journals from TRNS1`);

        if (journalSnapshot.empty) {
          console.warn("No journals found in the TRNS1 collection.");
          setData([]);
          return;
        }

        const rawJournals = journalSnapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data(),
        }));
        console.log("Raw journal data:", rawJournals);

        // Group journals by JOURNAL_NO
        const journalMap = new Map<string, Journal>();
        rawJournals.forEach(({ data }) => {
          const transactionType = data.TRANSACTION_TYPE || "";
          if (transactionType !== "Credit" && transactionType !== "Debit") {
            console.log(`Skipping journal ${data.JOURNAL_NO}: Invalid TRANSACTION_TYPE "${transactionType}"`);
            return;
          }

          const journalId = data.JOURNAL_NO || "N/A";
          const existingJournal = journalMap.get(journalId);

          // Ensure date is consistently formatted
          let dateStr: string;
          if (data.DATE instanceof Timestamp) {
            dateStr = data.DATE.toDate().toISOString().split('T')[0];
          } else if (typeof data.DATE === 'string' && data.DATE) {
            // Validate and normalize date string (assuming format YYYY-MM-DD)
            const parsedDate = new Date(data.DATE);
            dateStr = isNaN(parsedDate.getTime()) ? "N/A" : parsedDate.toISOString().split('T')[0];
          } else {
            dateStr = "N/A";
          }

          if (existingJournal) {
            // Add transaction to existing journal
            existingJournal.transactions.push({
              transactionAmount: data.TRANSACTION_AMOUNT || 0,
              generalLedger: data.GENERAL_LEDGER || "N/A",
              transactionType,
            });
          } else {
            // Create new journal entry
            journalMap.set(journalId, {
              id: journalId,
              journalId,
              date: dateStr,
              description: data.DESCRIPTION || "N/A",
              transactions: [
                {
                  transactionAmount: data.TRANSACTION_AMOUNT || 0,
                  generalLedger: data.GENERAL_LEDGER || "N/A",
                  transactionType,
                },
              ],
              totalCredit: "0.00",
              totalDebit: "0.00",
              glCodes: "",
            });
          }
        });

        // Convert map to array and calculate totals
        let journals: Journal[] = Array.from(journalMap.values()).map((journal) => {
          const totalCredit = journal.transactions
            .filter((txn) => txn.transactionType === 'Credit')
            .reduce((sum, txn) => sum + Number(txn.transactionAmount), 0)
            .toFixed(2);
          const totalDebit = journal.transactions
            .filter((txn) => txn.transactionType === 'Debit')
            .reduce((sum, txn) => sum + Number(txn.transactionAmount), 0)
            .toFixed(2);
          const glCodes = Array.from(
            new Set(journal.transactions.map((txn) => txn.generalLedger))
          ).join(', ');

          return {
            ...journal,
            totalCredit,
            totalDebit,
            glCodes,
          };
        });

        // Sort journals by date (ascending)
        journals = journals.sort((a, b) => {
          const dateA = a.date === "N/A" ? new Date(0) : new Date(a.date);
          const dateB = b.date === "N/A" ? new Date(0) : new Date(b.date);
          return dateA.getTime() - dateB.getTime();
        });

        console.log(`Grouped and sorted to ${journals.length} unique journals`, journals);
        setData(journals);
      } catch (error: unknown) {
        console.error("Error fetching journals:", error);
        // toast.error(
        //   `Failed to load journals: ${
        //     error instanceof Error ? error.message : "Unknown error"
        //   }`,
        //   {
        //     position: "top-center",
        //     autoClose: 3000,
        //   }
        // );
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchJournals();
  }, [state.tenantId]);

  // Custom renderCell function to handle aggregated data
  const renderCell = (item: Journal, key: string) => {
    if (key === 'totalCredit') {
      return item.totalCredit;
    }
    if (key === 'totalDebit') {
      return item.totalDebit;
    }
    if (key === 'glCodes') {
      return item.glCodes || 'N/A';
    }
    return item[key as keyof Journal];
  };

  return (
    <main className="flex w-screen h-screen flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        {loading ? (
          <Loader />
        ) : (
          <Master_Page
            page={"entry/journal"}
            headers={headers}
            data={data}
            renderCell={renderCell}
          />
        )}
      </section>
    </main>
  );
}