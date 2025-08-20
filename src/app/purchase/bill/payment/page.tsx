/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import PaymentSection from "@/components/PaymentSection";
import { motion } from "framer-motion";
import BillDetails from "@/components/BillDetails";
import { useContext, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CounterContext } from "@/lib/CounterContext";
import BackButton from "@/components/BackButton";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../../../firebase"; // Adjust as needed

function PaymentPageInner() {
  const { state } = useContext(CounterContext);
  const searchParams = useSearchParams();
  const [showBill, setShowBill] = useState(false);
  const [advAmount, setAdvAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOrder, setIsOrder] = useState<boolean>(false);

  const billNo = searchParams?.get("billNo") || "N/A";

  // Fetch advance amount if PO linked
  useEffect(() => {
    const fetchAdvanceAmount = async () => {
      try {
        setLoading(true);
        const ordersRef = collection(db, `TenantsDb/${state.tenantId}/PORDER`);
        const q = query(
          ordersRef,
          where("BILL_LINK", "==", false),
          where("BILL_NO", "==", billNo)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setAdvAmount(Number(data.ADV_AMOUNT) || 0);
          setIsOrder(true);
        } else {
          setAdvAmount(0);
        }
      } catch (err) {
        console.error("Error fetching advance:", err);
        setError("Failed to fetch advance amount");
      } finally {
        setLoading(false);
      }
    };

    if (billNo !== "N/A") fetchAdvanceAmount();
    else {
      setLoading(false);
      setError("Invalid bill number");
    }
  }, [billNo, state.tenantId]);

  const products = state.products.filter((p) => Number(p.QUANTITY) > 0);

  // -------------------------------
  // Calculation Block
  // -------------------------------
  const calculations = products.reduce(
    (acc, item) => {
      const qty = Number(item.QUANTITY) || 0;
      const igstRate = Number(item.IGST) || 0;
      const price = Number(item.price) || 0;
      const discPer = Number(item.DISCPER) || 0;

      const discountedPrice = price * (1 - discPer / 100);
      const discountPerUnit = price - discountedPrice;

      const basePrice = discountedPrice / (1 + igstRate / 100);
      const gstPerUnit = basePrice * (igstRate / 100);

      const totalBase = basePrice * qty;
      const totalGst = gstPerUnit * qty;
      const totalDiscount = discountPerUnit * qty;

      return {
        subtotal: acc.subtotal + totalBase,
        totalGstAmount: acc.totalGstAmount + totalGst,
        discount: acc.discount + totalDiscount,
      };
    },
    { subtotal: 0, totalGstAmount: 0, discount: 0 }
  );

  const subtotal = calculations.subtotal;
  const totalGstAmount = calculations.totalGstAmount;
  const cgstAmount = totalGstAmount / 2;
  const sgstAmount = totalGstAmount / 2;
  const discount = calculations.discount;
  const totalBeforeAdvance = subtotal + totalGstAmount;
  const finalAmount = Math.max(totalBeforeAdvance - advAmount, 0);

  console.log({
    subtotal,
    totalGstAmount,
    cgstAmount,
    sgstAmount,
    discount,
    advAmount,
    finalAmount,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg font-semibold text-gray-600 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg font-semibold text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-full min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-purple-50 p-3 sm:p-4 md:p-6"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
      }}
      initial="hidden"
      animate="visible"
    >
      <BackButton />
      <div className="max-w-screen mx-auto bg-white rounded-2xl shadow-lg p-3 sm:p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {!showBill && (
            <BillDetails
              billNo={billNo}
              customer={state.customerData}
              products={products}
              totalAmount={finalAmount}
              page="Purchase Order"
            />
          )}
          <PaymentSection
            model="purchaseBill"
            products={products}
            discount={discount} // ✅ Added discount prop here
            totalAmount={finalAmount}
            onPayment={() => {}}
            onShowBillChange={setShowBill}
            outstandingAmount={finalAmount}
            cgstAmount={cgstAmount}
            sgstAmount={sgstAmount}
            is_order={isOrder}
            order_no={billNo}
            totalGstAmount={totalGstAmount}
          />
        </div>
      </div>
    </motion.div>
  );
}

const PaymentPage = () => (
  <Suspense fallback={<div className="flex justify-center items-center min-h-screen text-lg font-semibold text-gray-600">Loading...</div>}>
    <PaymentPageInner />
  </Suspense>
);

export default PaymentPage;
