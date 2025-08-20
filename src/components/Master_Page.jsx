"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import CustomTable from "@/components/CustomTable";
import Link from "next/link";

/**
 * @typedef {Object} MasterPageProps
 * @property {string} page
 * @property {any[]} headers
 * @property {any[]} data
 * @property {(event?: any) => void=} onDraftClick
 * @property {string=} collectionName
 * @property {(item: any, key: string) => any=} renderCell
 * @property {(() => void | Promise<void>)=} onSynchronize
 * @property {boolean=} isSyncing
 */

/**
 * @param {MasterPageProps} props
 */
export default function Master_Page({
  page,
  headers,
  data,
  onDraftClick,
  collectionName,
  renderCell,
  onSynchronize,
  isSyncing,
}) {
  let heading = "";
  if (page === 'purchase/special') {
    heading = "Special Purchase";
  } else if (page === 'entry/journal') {
    heading = "Journal";
  } else if (typeof page === "string") {
    heading = page
      .split("/")
      .pop()
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  console.log(page);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Dynamic filter based on available keys
  const filteredData = data.filter((row) => {
    if (!row || typeof row !== "object") return false; // Prevents error if row is undefined/null

    const query = searchQuery.toLowerCase();
    // For Customer
    if (row.name && row.contact && row.gstNumber) {
      return (
        row.name.toLowerCase().includes(query) ||
        row.contact.toLowerCase().includes(query) ||
        row.gstNumber.toLowerCase().includes(query)
      );
    }
    // For Product
    if (row.description && row.group && row.uom) {
      return (
        row.description.toLowerCase().includes(query) ||
        row.group.toLowerCase().includes(query) ||
        row.uom.toLowerCase().includes(query)
      );
    }
    // For Sale Bill or Draft
    if (row.customerName && row.contact && row.billNo) {
      return (
        row.customerName.toLowerCase().includes(query) ||
        row.contact.toLowerCase().includes(query) ||
        row.billNo.toLowerCase().includes(query) ||
        row.payMode.toLowerCase().includes(query)
      );
    }
    // Fallback: search all string fields
    return Object.values(row)
      .filter((v) => typeof v === "string")
      .some((v) => v.toLowerCase().includes(query));
  });

  return (
    <div className="bg-gradient-to-b from-blue-100 to-white min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
      <motion.div
        className="w-full max-w-7xl bg-white rounded-2xl shadow-lg p-8 mx-auto"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <motion.h1
            className="text-4xl font-extrabold text-blue-800 text-center sm:text-left"
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {heading}
          </motion.h1>
          <motion.div
            className={`flex gap-3 ${page === "Purchase Bill" ? "flex-col items-stretch" : ""}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {page === "Bill" && (
              <button
                className={`bg-gradient-to-r ${
                  collectionName === "BILL"
                    ? "from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    : "from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                } text-white px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium`}
                onClick={onDraftClick}
              >
                {collectionName === "BILL" ? "Draft" : "Bill"}
              </button>
            )}
            {page === "Customer" || page === "Vendor" || page === "Ledger" || page === "Product" || page=='ProductOpening' ? (
            
              <Link
                href={"/master/" + page.toLowerCase() + "/add"}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium"
              >
                Add {heading}
              </Link>
            ) : (
              <Link
                href={`/${page.toLowerCase().split(" ").join("/")}/add`}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium"
              >
                Add {heading}
              </Link>
            )}

            {page === "Purchase Bill" && typeof onSynchronize === "function" && (
              <button
                onClick={onSynchronize}
                disabled={!!isSyncing}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium disabled:opacity-60"
              >
                {isSyncing ? "Syncing..." : "Synchronize"}
              </button>
            )}
          </motion.div>
        </div>

        {/* Search Bar */}
        <motion.div
          className="relative mb-8 max-w-md w-full mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <input
            type="text"
            placeholder={`Search ${heading || page}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-300 text-sm text-gray-700 placeholder-gray-400"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </motion.div>

        {/* Table */}
        <motion.div
          className="w-full overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <CustomTable
            page={page}
            headers={headers}
            data={filteredData}
            renderCell={renderCell}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
