/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { motion } from "framer-motion";
import BillDetails from "@/components/BillDetails";
import { useContext, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CounterContext } from "@/lib/CounterContext";
import SaleOrderPayment from "@/components/SaleOrderPayment";
import { roundOff } from "@/config/utils"; // Assumes this exists

function PaymentPageInner() {
  const { state, dispatch } = useContext(CounterContext);
  const searchParams = useSearchParams();
  const [showBill, setShowBill] = useState(false);
  const billNo = searchParams?.get("billNo") || "N/A";

  // Filter products with positive quantity
  const products = state.products.filter((p) => Number(p.QUANTITY) > 0);

  // Precise GST + Discount calculation
  const calculations = products.reduce(
    (acc, item) => {
      const quantity = Math.abs(Number(item.QUANTITY)) || 0;
      const igstRate = Number(item.IGST) || 0; // as percentage
      const price = Number(item.price) || 0;

      const basePrice = price / (1 + igstRate / 100); // excl GST
      const gstPerUnit = basePrice * (igstRate / 100);
      const totalBasePerItem = basePrice * quantity;
      const totalGstPerItem = gstPerUnit * quantity;

      return {
        subtotal: acc.subtotal + totalBasePerItem,
        totalGstAmount: acc.totalGstAmount + totalGstPerItem,
      };
    },
    { subtotal: 0, totalGstAmount: 0 }
  );

  const subtotal = roundOff(calculations.subtotal);
  const totalGstAmount = roundOff(calculations.totalGstAmount);
  const cgstAmount = roundOff(Number(totalGstAmount) / 2);
  const sgstAmount = roundOff(Number(totalGstAmount) / 2);
  const totalAmountWithGst = roundOff(Number(subtotal) + Number(totalGstAmount));

  return (
    <motion.div
      className="max-w-full min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-purple-50 p-3 sm:p-4 md:p-6"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: "easeOut" },
        },
      }}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-3 sm:p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {!showBill && (
            <BillDetails
              billNo={billNo}
              customer={state.customerData}
              products={products}
              totalAmount={Number(totalAmountWithGst)}
              page="Sale Order"
            />
          )}
          <SaleOrderPayment
            model="order"
            products={products}
            onPayment={() => {}}
            cgstAmount={Number(cgstAmount)}
            sgstAmount={Number(sgstAmount)}
            totalGstAmount={Number(totalGstAmount)}
            outstandingAmount={Number(totalAmountWithGst)}
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