"use client";
import React, { useState, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Customer, Product } from "@/types/page";
import { CounterContext } from "@/lib/CounterContext"; // Import CounterContext

interface BillDetailsProps {
  billNo: string;
  customer?: Customer;
  products: Product[];
  totalAmount: number;
  page: "Purchase Order" | "Bill" | "Sale Order";
}

const BillDetails: React.FC<BillDetailsProps> = ({ page, billNo, customer, products, totalAmount }) => {
  const { state } = useContext(CounterContext); // Access CounterContext state
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [currencyCode, setCurrencyCode] = useState<string>("₹");

  useEffect(() => {
    // Fetch currency from localStorage
    let fetchedCurrency = "₹";
    try {
      const storedCurrency = localStorage.getItem("tenant_currency");
      if (storedCurrency) {
        fetchedCurrency = storedCurrency;
      }
    } catch (err) {
      console.error("Error reading currency from localStorage:", err);
    }

    // Alternatively, use currency from CounterContext (commented out for preference)
    // if (state.currency) {
    //   fetchedCurrency = state.currency;
    // }

    // Set the currency code
    setCurrencyCode(fetchedCurrency);

    // Update date and time
    const updateDateTime = () => {
      const now = new Date();
      const currentTime = now.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const currentDate = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      setCurrentDate(currentDate);
      setCurrentTime(currentTime);
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, [state.currency]); // Add state.currency to dependencies if using CounterContext

  const toNumber = (value: number | string): number => {
    return typeof value === "string" ? parseFloat(value) || 0 : value;
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="lg:col-span-2 space-y-6 flex flex-col font-sans text-gray-800 bg-white p-8 rounded-lg shadow-lg">
      {/* Header */}
      <motion.div className="flex justify-between items-center" variants={itemVariants}>
        <h1 className="text-4xl font-bold text-gray-900">{page}</h1>
      </motion.div>
      {/* Date and Time */}
      <motion.div
        className="flex justify-between items-center bg-blue-600 p-4 rounded-md border border-blue-200 shadow-sm"
        variants={itemVariants}
      >
        <p className="text-base font-semibold text-white">{currentDate}</p>
        <p className="text-blue-600 bg-white px-2 text-sm font-bold uppercase rounded-xl">{currentTime}</p>
        <div className="text-sm font-semibold">
          <span className="text-blue-600 bg-white pl-2 pr-1 mr-1 rounded-xl">Bill No: </span>
          <span className="text-white">{billNo}</span>
        </div>
      </motion.div>

      {/* Customer/Vendor Details */}
      <motion.div
        className="bg-white border border-gray-300 p-6 rounded-md shadow-sm"
        variants={itemVariants}
      >
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          {page === "Purchase Order" ? "Vendor Details" : "Customer Details"}
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-white px-2 py-1 rounded-full bg-blue-600">Name:</span>
            <span className="ml-2 font-semibold text-gray-800">{customer?.NAME || customer?.name || "Guest"}</span>
          </div>
          <div>
            <span className="font-semibold text-white px-2 py-1 rounded-full bg-blue-600">Number:</span>
            <span className="ml-2 font-semibold text-gray-800">{customer?.MOBPHONE || customer?.number || "N/A"}</span>
          </div>
        </div>
      </motion.div>

      {/* Order Details Table */}
      <motion.div
        className="bg-white border border-gray-300 p-6 rounded-md shadow-sm"
        variants={itemVariants}
      >
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Product Details</h2>
        <div className="overflow-x-auto">
          {products.length === 0 ? (
            <p className="text-sm text-gray-500 text-center">No items in the order.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-blue-100 border-b border-blue-200">
                  <th className="py-3 px-4 text-left font-semibold text-blue-800">Item</th>
                  <th className="py-3 px-4 text-right font-semibold text-blue-800">Qty</th>
                  <th className="py-3 px-4 text-right font-semibold text-blue-800">UOM</th>
                  <th className="py-3 px-4 text-right font-semibold text-blue-800">Price</th>
                  <th className="py-3 px-4 text-right font-semibold text-blue-800">Total</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {products.map((p: Product, index) => (
                    <motion.tr
                      key={p.id}
                      className={`border-b border-gray-200 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors duration-200`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="py-3 px-4 text-left max-w-[40%] text-gray-800">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-12 h-12 object-cover rounded-md border border-gray-300"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-image.png"; // Fallback image
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md border border-gray-300 bg-gray-100 flex items-center justify-center text-gray-500 text-xs">
                              No Image
                            </div>
                          )}
                          <span className="truncate font-semibold">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-800">{toNumber(p.QUANTITY).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-800">{p.UOM_SALE || "N/A"}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-800">{toNumber(p.price).toFixed(2)} {currencyCode}</td>
                      <td className="py-3 px-4 text-right font-semibold text-blue-600">
                        {(toNumber(p.QUANTITY) * toNumber(p.price)).toFixed(2)} {currencyCode}
                      </td>
                    </motion.tr>
                  ))}
                  <motion.tr
                    className="border-t border-gray-200 bg-blue-100"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <td className="py-3 px-4 text-left font-bold text-gray-900" colSpan={4}>
                      Total Amount
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-600">
                      {totalAmount.toFixed(2)} {currencyCode}
                    </td>
                  </motion.tr>
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default BillDetails;