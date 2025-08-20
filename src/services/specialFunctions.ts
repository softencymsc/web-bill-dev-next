/* eslint-disable @typescript-eslint/no-explicit-any */
import { collection, doc, setDoc, CollectionReference, DocumentData } from "firebase/firestore";
import { db } from "../../firebase";

export interface StructuredDoc {
  id: string;
  data: Record<string, any>;
}

// Shapes raw BILLIN rows into Firestore-ready docs
export const createFirebaseStructureOfBill = (rows: any[]): StructuredDoc[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row)
    .map((row) => {
      const id = String(row.BILL_NO ?? row.id ?? row.bill_no ?? "").trim();
      const billDateValue = row.BILL_DATE || row.bill_date || row.date;
      const billDate = billDateValue ? new Date(billDateValue) : new Date();

      const data = {
        ...row,
        BILL_NO: id || String(row.BILL_NO || ""),
        BILL_DATE: billDate,
      } as Record<string, any>;

      return { id: id || `${Date.now()}-${Math.random().toString(36).slice(2)}`, data };
    });
};

// Shapes raw BLLINDET rows into Firestore-ready docs
// productsRef can be used in future to resolve product references if needed
export const createFirebaseStructureOfBillDet = (
  rows: any[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  productsRef?: CollectionReference<DocumentData> | null
): StructuredDoc[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row)
    .map((row, index) => {
      const billNo = String(row.BILL_NO ?? row.bill_no ?? "").trim();
      const lineNo = row.SRNO ?? row.SNO ?? row.LINE_NO ?? index + 1;
      const id = `${billNo}-${lineNo}`;
      const data = {
        ...row,
        BILL_NO: billNo,
        LINE_NO: lineNo,
      } as Record<string, any>;
      return { id, data };
    });
};

// Writes an array of { id, data } docs into TenantsDb/{tenantId}/{collectionName}
export const addDataIntoCollection = async (
  docs: StructuredDoc[],
  tenantId: string,
  collectionName: string
): Promise<void> => {
  if (!tenantId || !collectionName || !Array.isArray(docs)) return;

  const targetCollection = collection(db, "TenantsDb", tenantId, collectionName);

  const tasks = docs.map(async (item) => {
    const docId = (item && item.id ? String(item.id) : "").trim();
    const payload = item?.data || {};
    const targetDoc = doc(targetCollection, docId || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await setDoc(targetDoc, payload, { merge: true });
  });

  await Promise.all(tasks);
};

