/* eslint-disable */
"use client";
import React, { useContext, useEffect, useState } from "react";
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from "next/navigation";
import { db } from "../../../../../firebase";
import { collections } from "@/config";
import {
  collection,
  updateDoc,
  doc,
  writeBatch,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { Product, Customer } from "@/types/page";

interface BillData {
  BILL_NO: string;
  CUSTNAME: string;
  MOBPHONE: string;
  RECEIPT_NO: string;
}

const Payment: React.FC = () => {
  const { state, dispatch } = useContext(CounterContext);
  const { products, billData, customerData, tenantId, currency } = state;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billNo, setBillNo] = useState<string>(""); // State to hold billNo

  // Initialize billNo on the client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Access sessionStorage only on the client
      const storedBillNo = sessionStorage.getItem("purchaseBillNo") || "";
      setBillNo(billData?.BILL_NO || storedBillNo);
    }
  }, [billData]);

  // Redirect back if no bill data or products
  useEffect(() => {
    if (!billData || products.length === 0) {
      router.push("/purchase/return/");
    }
  }, [billData, products, router]);

  const handleSubmit = async () => {
    if (isSubmitting || !billNo) return; // Ensure billNo is available
    setIsSubmitting(true);

    try {
      const batch = writeBatch(db);

      // Check for existing documents in BILLIN
      const billInRef = query(
        collection(db, "TenantsDb", tenantId, collections.BILLIN),
        where("BILL_NO", "==", billNo)
      );
      const billInSnapshot = await getDocs(billInRef);
      const existingBillInDocs = billInSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Check for existing documents in BLLINDET
      const billDetRef = query(
        collection(db, "TenantsDb", tenantId, collections.BLLINDET),
        where("BILL_NO", "==", billNo)
      );
      const billDetSnapshot = await getDocs(billDetRef);
      const existingBillDetDocs = billDetSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Log existing documents (for debugging)
      if (existingBillInDocs.length > 0 || existingBillDetDocs.length > 0) {
        console.log("Existing BILLIN documents:", existingBillInDocs);
        console.log("Existing BLLINDET documents:", existingBillDetDocs);
      }

      // Track returned quantities for each product
      const productReturnMap = new Map<string, number>();
      products
        .filter((p) => Number(p.QUANTITY) > 0)
        .forEach((product) => {
          const prodCode = product.PRODCODE || "";
          const returnQty = Number(product.QUANTITY) || 0;
          productReturnMap.set(prodCode, returnQty);
        });

      // Update BLLINDET: Add RETURNED_QUANTITY and set returned if any quantity is returned
      let hasAnyReturns = false;
      existingBillDetDocs.forEach((billDet: any) => {
        const billDetDocRef = doc(db, "TenantsDb", tenantId, collections.BLLINDET, billDet.id);
        const prodCode = billDet.PRODCODE || "";
        const originalQty = Number(billDet.QUANTITY) || 0;
        const currentReturnedQty = Number(billDet.RETURNED_QUANTITY) || 0;
        const newReturnQty = productReturnMap.get(prodCode) || 0;
        const totalReturnedQty = currentReturnedQty + newReturnQty;

        // Update only if there is a return quantity for this product
        if (newReturnQty > 0) {
          batch.update(billDetDocRef, {
            RETURNED_QUANTITY: totalReturnedQty,
            returned: true, // Set to true if any quantity is returned
          });
          hasAnyReturns = true; // Mark that at least one product has been returned
        }
      });

      // Update BILLIN: Add RETURNED_QUANTITY and set returned if any products are returned
      existingBillInDocs.forEach((bill: any) => {
        const billInDocRef = doc(db, "TenantsDb", tenantId, collections.BILLIN, bill.id);
        const currentBillReturnedQty = Number(bill.RETURNED_QUANTITY) || 0;
        const newBillReturnedQty = Array.from(productReturnMap.values()).reduce(
          (sum, qty) => sum + qty,
          0
        );
        const totalBillReturnedQty = currentBillReturnedQty + newBillReturnedQty;

        batch.update(billInDocRef, {
          RETURNED_QUANTITY: totalBillReturnedQty,
          returned: hasAnyReturns, // Set to true if any products are returned
        });
      });

      // Prepare data for DBNOTE
      const dbNoteData = {
        BILL_NO: billNo,
        RECEIPT_NO: billData?.RECEIPT_NO || "",
        CUSTNAME: billData?.CUSTNAME || "",
        MOBPHONE: billData?.MOBPHONE || "",
        ADDRESS: (customerData as Customer)?.ADDRESS || "",
        CITY: (customerData as Customer)?.CITY || "",
        COUNTRY: (customerData as Customer)?.COUNTRY || "",
        CUST_CODE: (customerData as Customer)?.CUSTCODE || "",
        BILL_DATE: Timestamp.fromDate(new Date()),
        TENANT_ID: tenantId,
        TOTAL_AMOUNT: products.reduce(
          (sum, item) => sum + Math.abs(Number(item.QUANTITY) * item.price || 0),
          0
        ),
      };

      // Add to DBNOTE collection
      const dbNoteRef = collection(db, "TenantsDb", tenantId, collections.DBNOTE);
      const dbNoteDocRef = doc(dbNoteRef);
      batch.set(dbNoteDocRef, dbNoteData);

      // Add to PRETDET collection
      const pretDetRef = collection(db, "TenantsDb", tenantId, collections.PRETDET);
      products
        .filter((p) => Number(p.QUANTITY) > 0)
        .forEach((product) => {
          const pretDetData = {
            BILL_NO: billNo,
            RECEIPT_NO: billData?.RECEIPT_NO || "",
            PRODNAME: product.name || "",
            PRODCODE: product.PRODCODE || "",
            QUANTITY: Number(product.QUANTITY) || 0,
            RATE: product.price || 0,
            UOM: product.UOM_SALE || "PCS",
            IGSTPER: product.IGST || 18,
            SGroupDesc: product.SGroupDesc || "",
            GroupDesc: product.GroupDesc || "Finish Goods",
            TOTALAMT: Number(product.QUANTITY) * product.price || 0,
            BILL_DATE: Timestamp.fromDate(new Date()),
            HSNCODE: product.HSNCODE || 0,
            DISCPER: product.DISCOUNTAMT
              ? Number(product.DISCOUNTAMT) / (product.price || 1) * 100
              : 0,
            Taxable_Amount: Number(product.QUANTITY) * product.price || 0,
          };
          const pretDetDocRef = doc(pretDetRef);
          batch.set(pretDetDocRef, pretDetData);
        });

      // Update PRODUCTS collection (reduce OPENING_Q)
      const productsRef = collection(db, "TenantsDb", tenantId, collections.PRODUCTS);
      products
        .filter((p) => Number(p.QUANTITY) > 0)
        .forEach((product) => {
          const productDocRef = doc(productsRef, product.id);
          const currentOpeningQ = Number(product.OPENING_Q) || 0;
          const quantityToSubtract = Number(product.QUANTITY) || 0;
          const newOpeningQ = Math.max(0, currentOpeningQ - quantityToSubtract);
          batch.update(productDocRef, { OPENING_Q: String(newOpeningQ) });
        });

      // Commit the batch
      await batch.commit();

      // Clear state and sessionStorage
      dispatch({
        type: "RESET_STATE",
        payload: {
          products: [],
          addedProducts: [],
          customerData: undefined,
          tenantId: tenantId,
          oaNo: undefined,
          currency: currency,
        },
      });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("billData");
        sessionStorage.removeItem("purchaseBillNo");
        sessionStorage.removeItem("products");
        sessionStorage.removeItem("addedProducts");
        sessionStorage.removeItem("draftBill");
      }

      toast.success("Bill processed successfully!", {
        position: "top-center",
        autoClose: 2000,
      });

      // Redirect back to the bill creation page
      router.push("/purchase/return");
    } catch (error) {
      console.error("Error processing bill:", error);
      // toast.error("Failed to process bill. Please try again.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate total amount
  const totalAmount = products
    .reduce((sum, item) => sum + Math.abs(Number(item.QUANTITY) * item.price || 0), 0)
    .toFixed(2);

  const totalQuantity = products.reduce((sum, item) => sum + Math.abs(Number(item.QUANTITY)), 0);

  return (
    <div className="bg-white min-h-screen flex flex-col items-center w-full p-4">
      <div className="w-full lg:max-w-3xl mx-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Purchase Return Confirmation</h2>
        <div className="bg-white p-4 shadow-sm rounded-lg">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Receipt No:</span>
              <span className="text-gray-600 text-sm">{billData?.RECEIPT_NO || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Purchase Bill No:</span>
              <span className="text-gray-600 text-sm">{billNo || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Customer Name:</span>
              <span className="text-gray-600 text-sm">{billData?.CUSTNAME || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Mobile Number:</span>
              <span className="text-gray-600 text-sm">{billData?.MOBPHONE || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Address:</span>
              <span className="text-gray-600 text-sm">
                {(customerData as Customer)?.ADDRESS || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">City:</span>
              <span className="text-gray-600 text-sm">{(customerData as Customer)?.CITY || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Country:</span>
              <span className="text-gray-600 text-sm">
                {(customerData as Customer)?.COUNTRY || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Customer Code:</span>
              <span className="text-gray-600 text-sm">
                {(customerData as Customer)?.CUSTCODE || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Total Quantity:</span>
              <span className="text-gray-600 text-sm">{totalQuantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-sm">Total Amount:</span>
              <span className="font-semibold text-blue-700 text-sm">
                {currency} {totalAmount}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-2 mt-4 shadow-sm rounded-lg">
          <div className="max-h-48 overflow-y-auto">
            <table className="min-w-full table-auto border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-1.5 py-1.5 text-left font-semibold text-gray-700">Name</th>
                  <th className="px-1.5 py-1.5 text-center font-semibold text-gray-700 w-14">
                    Qty
                  </th>
                  <th className="px-1.5 py-1.5 text-right font-semibold text-gray-700 w-20">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) => Number(p.QUANTITY) > 0)
                  .map((item) => (
                    <tr
                      key={item.id || item.PRODCODE || "unknown"}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-1.5 py-1 font-semibold text-gray-900 truncate max-w-[100px]">
                        {item.name || "Unknown"}
                      </td>
                      <td className="px-1.5 py-1 text-center text-gray-600">
                        {item.QUANTITY || "0"}
                      </td>
                      <td className="px-1.5 py-1 text-right font-semibold text-blue-700">
                        {currency} {(Number(item.QUANTITY) * item.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white p-4 mt-4 shadow-md border-t border-gray-200">
          <div className="flex sm:flex-row flex-col gap-2">
            <button
              onClick={handleSubmit}
              className={`w-full py-2 font-semibold text-sm rounded-lg transition-all ${
                isSubmitting
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
              disabled={isSubmitting || !billNo} // Disable if billNo is not set
            >
              {isSubmitting ? "Processing..." : "Confirm and Submit"}
            </button>
            <button
              onClick={() => router.push("/purchase/return")}
              className="w-full py-2 font-semibold text-sm rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;