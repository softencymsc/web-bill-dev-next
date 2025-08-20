// /* eslint-disable @typescript-eslint/no-explicit-any */
// /* eslint-disable @typescript-eslint/no-unused-vars */
// "use client";
// import PaymentSection from "@/components/PaymentSection";
// import { motion } from "framer-motion";
// import BillDetails from "@/components/BillDetails";
// import { useContext, useState, useEffect, Suspense } from "react";
// import { useSearchParams } from "next/navigation";
// import { CounterContext } from "@/lib/CounterContext";
// import BackButton from "@/components/BackButton";
// import { collection, query, where, getDocs } from "firebase/firestore";
// import { db } from "../../../../../firebase"; // Adjust path to your Firebase config

// function PaymentPageInner() {
//   const { state } = useContext(CounterContext);
//   const searchParams = useSearchParams();
//   const [showBill, setShowBill] = useState(false);
//   const [advAmount, setAdvAmount] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [isOrder,setIsOrder]=useState<boolean>(false)
//   const billNo = searchParams?.get("billNo") || "N/A";

//   // Fetch advance amount from ORDER collection
//   useEffect(() => {
//     const fetchAdvanceAmount = async () => {
//       try {
//         setLoading(true);
//         const ordersRef = collection(db, `TenantsDb/${state.tenantId}/ORDER`);
//         const q = query(
//           ordersRef,
//           where("BILL_LINK", "==", false),
//           where("OA_NO", "==", billNo)
//         );
//         const querySnapshot = await getDocs(q);
//         console.log(querySnapshot);
        
//         if (!querySnapshot.empty) {
//           const orderDoc = querySnapshot.docs[0].data();
//           setAdvAmount(Number(orderDoc.ADV_AMOUNT) || 0);
//           setIsOrder(true)
//         } else {
//           setAdvAmount(0); // No matching document
//         }
//       } catch (err) {
//         console.error("Error fetching advance amount:", err);
//         setError("Failed to fetch advance amount");
//         setAdvAmount(0);
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (billNo !== "N/A") {
//       fetchAdvanceAmount();
//     } else {
//       setLoading(false);
//       setError("Invalid bill number");
//       setAdvAmount(0);
//     }
//   }, [billNo]);

//   // Filter products with quantity > 0
//   const products = state.products.filter((p) => Number(p.QUANTITY) > 0);

//   // Calculate subtotal (excluding GST)
//   const subtotal = products.reduce((sum, item) => sum + Number(item.QUANTITY) * item.price, 0);

//   // Calculate GST based on IGST field (IGST as amount per unit)
//   const totalGstAmount = products.reduce((sum, item) => {
//     const igstAmount = Number(item.IGST) || 0;
//     return sum + Number(item.QUANTITY) * igstAmount;
//   }, 0);

//   // Split GST into CGST and SGST (50/50)
//   const cgstAmount = totalGstAmount / 2;
//   const sgstAmount = totalGstAmount / 2;

  
//   // Calculate final amount after deducting advance
//   const finalAmount = Math.max(subtotal-advAmount);

//   if (loading) {
//     return (
//       <div className="flex justify-center items-center min-h-screen">
//         <div className="text-lg font-semibold text-gray-600 animate-pulse">
//           Loading...
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="flex justify-center items-center min-h-screen">
//         <div className="text-lg font-semibold text-red-600">{error}</div>
//       </div>
//     );
//   }

//   return (
//     <motion.div
//       className="max-w-full min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-purple-50 p-3 sm:p-4 md:p-6"
//       variants={{
//         hidden: { opacity: 0, y: 20 },
//         visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
//       }}
//       initial="hidden"
//       animate="visible"
//     >
//       <BackButton />
//       <div className="max-w-screen mx-auto bg-white rounded-2xl shadow-lg p-3 sm:p-4 md:p-6">
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
//           {!showBill && (
//             <BillDetails
//               billNo={billNo}
//               customer={state.customerData}
//               products={products}
//               totalAmount={finalAmount}
              
//               page="Bill"
//             />
//           )}
//           <PaymentSection
//             model="sale_bill"
//             products={products}
//             totalAmount={finalAmount}
//             onPayment={() => {}} // Replace with your handler
//             onShowBillChange={setShowBill}
//             outstandingAmount={finalAmount}
//             order_no={billNo}
//             cgstAmount={cgstAmount}
//             is_order={isOrder}
//             sgstAmount={sgstAmount}
//             totalGstAmount={totalGstAmount}
           
//           />
//         </div>
//       </div>
//     </motion.div>
//   );
// }

// const PaymentPage = () => (
//   <Suspense fallback={<div className="flex justify-center items-center min-h-screen text-lg font-semibold text-gray-600">Loading...</div>}>
//     <PaymentPageInner />
//   </Suspense>
// );

// export default PaymentPage;

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import PaymentSection from "@/components/PaymentSection";
import { motion } from "framer-motion";
import BillDetails from "@/components/BillDetails";
import { useContext, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CounterContext } from "@/lib/CounterContext";
import BackButton from "@/components/BackButton";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../../../firebase"; // Adjust path to your Firebase config

function PaymentPageInner() {
  const { state } = useContext(CounterContext);
  const searchParams = useSearchParams();
  const [showBill, setShowBill] = useState(false);
  const [advAmount, setAdvAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOrder, setIsOrder] = useState<boolean>(false);

  const billNo = searchParams?.get("billNo") || "N/A";

  // Fetch advance amount from ORDER collection
  useEffect(() => {
    const fetchAdvanceAmount = async () => {
      try {
        setLoading(true);
        const ordersRef = collection(db, `TenantsDb/${state.tenantId}/ORDER`);
        const q = query(
          ordersRef,
          where("BILL_LINK", "==", false),
          where("OA_NO", "==", billNo)
        );
        const querySnapshot = await getDocs(q);
        console.log(querySnapshot);

        if (!querySnapshot.empty) {
          const orderDoc = querySnapshot.docs[0].data();
          setAdvAmount(Number(orderDoc.ADV_AMOUNT) || 0);
          setIsOrder(true);
        } else {
          setAdvAmount(0); // No matching document
        }
      } catch (err) {
        console.error("Error fetching advance amount:", err);
        setError("Failed to fetch advance amount");
        setAdvAmount(0);
      } finally {
        setLoading(false);
      }
    };

    if (billNo !== "N/A") {
      fetchAdvanceAmount();
    } else {
      setLoading(false);
      setError("Invalid bill number");
      setAdvAmount(0);
    }
    
  }, [billNo, state.tenantId]);

  // Filter products with quantity > 0
  const products = state.products.filter((p) => Number(p.QUANTITY) > 0);

  // Calculate amounts
  const calculations = products.reduce(
    (acc, item) => {
      const quantity = Number(item.QUANTITY) || 0;
      const igstRate = Number(item.IGST) || 0; // IGST as percentage (e.g., 18 for 18%)
      const priceWithGst = Number(item.price) || 0; 
      // MRP, includes GST
      const basePrice = priceWithGst / (1 + (igstRate / 100)); // Base price excluding GST
      const gstPerUnit = basePrice * (igstRate / 100); // GST per unit
      const totalBasePerItem = basePrice * quantity;
      const totalGstPerItem = gstPerUnit * quantity;

      return {
        subtotal: acc.subtotal + totalBasePerItem,
        totalGstAmount: acc.totalGstAmount + totalGstPerItem,
      };
    },
    { subtotal: 0, totalGstAmount: 0 }
  );

  const subtotal = calculations.subtotal;
  const totalGstAmount = calculations.totalGstAmount;
  const cgstAmount = totalGstAmount / 2;
  const sgstAmount = totalGstAmount / 2;
  const totalBeforeAdvance = subtotal + totalGstAmount;
  const finalAmount = Math.max(totalBeforeAdvance - advAmount, 0);
    console.log( `cgstAmount: ${cgstAmount} sgstamount ${sgstAmount} finalAmount : ${finalAmount} subtotal : ${calculations.subtotal} calculations : ${calculations} `);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg font-semibold text-gray-600 animate-pulse">
          Loading...
        </div>
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
              page="Bill"
            />
          )}
          <PaymentSection
            model="sale_bill"
            products={products}
            totalAmount={finalAmount}
            discount={0}
            onPayment={() => {}} // Replace with your handler
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