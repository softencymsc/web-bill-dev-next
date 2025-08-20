"use client";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import {
  collection,
  CollectionReference,
  DocumentData,
  getDocs,
  query,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import { db } from "../../../../../firebase";
import { CounterContext } from "@/lib/CounterContext";
import Link from "next/link";

interface OrderData {
  id: string;
  ADDRESS?: string;
  ADVANCE?: string;
  AMOUNT?: number;
  BILL_DATE?: string;
  BILL_NO?: string;
  CAKETYPE?: string;
  CATEGORY?: string;
  CFLAVOUR?: string;
  CIMAGEURL?: string;
  CITY?: string;
  CMESSAGE?: string;
  COMPANY?: string;
  COUNTRY?: string;
  CREMARKS?: string;
  CUSTCODE?: number;
  CUSTNAME?: string;
  CUSTOMISETYPE?: string;
  DESCRIPT?: string;
  DLVDATE?: string;
  MOBPHONE?: string;
  PCS?: string;
  PRODCODE?: string;
  RATE?: string;
  SEQUENCE?: number;
  SGroupDesc?: string;
  STATUS?: string;
}

interface Header {
  label: string;
  key: string;
}

const headers: Header[] = [
  { label: "Bill No", key: "BILL_NO" },
  { label: "Customer Name", key: "CUSTNAME" },
  { label: "Cake Type", key: "CAKETYPE" },
  { label: "Flavour", key: "CFLAVOR" },
  { label: "Image", key: "CIMAGEURL" },
  { label: "Amount", key: "AMOUNT" },
  { label: "Status", key: "STATUS" },
  { label: "Actions", key: "actions" },
];

export default function SpecialOrderTable() {
  const router = useRouter();
  const { state } = useContext(CounterContext);
  const tenantId = state.tenantId || "default-tenant";
  const [data, setData] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | "all">(10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [deletedRowIds, setDeletedRowIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<string[]>([]);

  // Fetch special orders
  const fetchSpecialOrders = async () => {
    setLoading(true);
    try {
      const specialOrderRef = collection(
        db,
        "TenantsDb",
        tenantId,
        "SPLORDER"
      ) as CollectionReference<DocumentData>;
      const q = query(specialOrderRef);
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        console.warn("No special orders found in the database.");
        setData([]);
        return;
      }

      const orders: OrderData[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setData(orders);
    } catch (error: unknown) {
      console.error("Error fetching orders:", error);
      // toast.error(
      //   `Failed to fetch orders: ${
      //     error instanceof Error ? error.message : "Unknown error"
      //   }`,
      //   {
      //     position: "top-right",
      //   }
      // );
      setError("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchSpecialOrders();
    }
  }, [tenantId]);

  // Dynamic filter based on available keys
  const filteredData = data.filter((row) => {
    if (!row || typeof row !== "object") return false;

    const query = searchQuery.toLowerCase();
    return (
      (row.CUSTNAME?.toLowerCase().includes(query) || false) ||
      (row.BILL_NO?.toLowerCase().includes(query) || false) ||
      (row.CAKETYPE?.toLowerCase().includes(query) || false) ||
      (row.CFLAVOUR?.toLowerCase().includes(query) || false) ||
      (row.STATUS?.toLowerCase().includes(query) || false)
    );
  });

  const sortData = (
    data: OrderData[],
    key: string,
    direction: "asc" | "desc"
  ): OrderData[] => {
    return [...data].sort((a, b) => {
      const valueA = a[key as keyof OrderData] ?? "";
      const valueB = b[key as keyof OrderData] ?? "";
      if (typeof valueA === "number" && typeof valueB === "number") {
        return direction === "asc" ? valueA - valueB : valueB - valueA;
      }
      const strA = valueA.toString().toLowerCase();
      const strB = valueB.toString().toLowerCase();
      return direction === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortedData = sortKey ? sortData(filteredData, sortKey, sortDirection) : filteredData;

  const totalRows = sortedData.length;
  const totalPages =
    rowsPerPage === "all" ? 1 : Math.ceil(totalRows / (rowsPerPage as number));
  const startIndex =
    rowsPerPage === "all" ? 0 : (currentPage - 1) * (rowsPerPage as number);
  const endIndex =
    rowsPerPage === "all" ? totalRows : startIndex + (rowsPerPage as number);
  const paginatedData =
    rowsPerPage === "all" ? sortedData : sortedData.slice(startIndex, endIndex);

  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, delay: i * 0.1 },
    }),
    deleted: { opacity: 0, x: -50, transition: { duration: 0.5 } },
  };

  const handleView = (row: OrderData) => {
    const id = row.id;
    if (!id) {
      // toast.error(`No ID found for row`);
      return;
    }
    router.push(`/purchase/special/order/view?id=${id}`);
  };

  const handleDelete = async (row: OrderData) => {
    const id = row.id;
    if (!id) {
      // toast.error(`No ID found for row`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete order ${id}?`)) {
      setIsDeleting((prev) => [...prev, id]);
      try {
        const orderRef = doc(db, `TenantsDb/${tenantId}/SPLORDER`, id);
        await deleteDoc(orderRef);
        setDeletedRowIds((prev) => [...prev, id]);
        toast.success(`Order ${id} deleted successfully!`);
        setTimeout(() => {
          setData((prev) => prev.filter((r) => r.id !== id));
          setIsDeleting((prev) => prev.filter((d) => d !== id));
          if (paginatedData.length === 1 && currentPage > 1) {
            setCurrentPage((prev) => prev - 1);
          }
        }, 500);
      } catch (error: unknown) {
        console.error("Error deleting order:", error);
        // toast.error(
        //   `Failed to delete order ${id}: ${
        //     error instanceof Error ? error.message : "Unknown error"
        //   }`
        // );
        setIsDeleting((prev) => prev.filter((d) => d !== id));
      }
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= totalPages) {
      setCurrentPage(value);
    }
  };

  const renderCell = (row: OrderData, key: string) => {
    if (key === "CIMAGEURL") {
      return row.CIMAGEURL ? (
        <img
          src={row.CIMAGEURL}
          alt="Cake"
          className="w-16 h-16 object-cover rounded"
          onError={(e) =>
            (e.currentTarget.src = "https://via.placeholder.com/150")
          }
        />
      ) : (
        <img
          src="https://via.placeholder.com/150"
          alt="Placeholder"
          className="w-16 h-16 object-cover rounded"
        />
      );
    } else if (key === "actions") {
      return (
        <div className="flex space-x-2">
          <motion.button
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300 flex items-center gap-1 ${
              deletedRowIds.includes(row.id) || isDeleting.includes(row.id)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            whileHover={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 1.05 }}
            whileTap={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 0.95 }}
            onClick={() => !deletedRowIds.includes(row.id) && !isDeleting.includes(row.id) && handleView(row)}
            disabled={deletedRowIds.includes(row.id) || isDeleting.includes(row.id)}
            aria-label={`View ${row.id}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </motion.button>
          <motion.button
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300 flex items-center gap-1 ${
              deletedRowIds.includes(row.id) || isDeleting.includes(row.id)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            whileHover={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 1.05 }}
            whileTap={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 0.95 }}
            onClick={() => !deletedRowIds.includes(row.id) && !isDeleting.includes(row.id) && handleDelete(row)}
            disabled={deletedRowIds.includes(row.id) || isDeleting.includes(row.id)}
            aria-label={`Delete ${row.id}`}
          >
            {isDeleting.includes(row.id) ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            Delete
          </motion.button>
        </div>
      );
    }
    return row[key as keyof OrderData] ?? "N/A";
  };

  return (
    <div className="bg-gradient-to-b from-blue-100 to-white min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
     
      <motion.div
        className="w-full max-w-5xl bg-white rounded-2xl shadow-lg p-8 mx-auto"
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
            Special Order
          </motion.h1>
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link
              href="/purchase/special/order/add"
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium"
            >
              Add Special Order
            </Link>
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
            placeholder="Search Special Order..."
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
          {loading ? (
            <div className="text-center p-6">Loading...</div>
          ) : error ? (
            <div className="text-center p-6 text-red-500">{error}</div>
          ) : (
            <div className="w-full max-w-[90vw] mx-auto rounded-xl overflow-hidden">
              <div className="overflow-x-auto bg-white shadow-xl rounded-xl">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-700 to-blue-900 text-white">
                      {headers.map((header, index) => (
                        <th
                          key={header.key}
                          className={`px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-blue-800 transition-colors duration-200 ${
                            index === 0 ? 'rounded-tl-xl' : index === headers.length - 1 ? 'rounded-tr-xl' : ''
                          }`}
                          onClick={() => header.key !== 'actions' && handleSort(header.key)}
                          aria-sort={sortKey === header.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <div className="flex items-center gap-2">
                            <span>{header.label}</span>
                            {sortKey === header.key && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={headers.length} className="px-4 py-6 text-center text-gray-500 text-sm">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((row, rowIndex) => (
                        <motion.tr
                          key={row.id}
                          variants={rowVariants}
                          initial="hidden"
                          animate={deletedRowIds.includes(row.id) ? 'deleted' : 'visible'}
                          custom={rowIndex}
                          className="hover:bg-gray-50 transition-colors duration-200"
                        >
                          {headers.map((header, colIndex) => (
                            <td
                              key={`${row.id}-${header.key}`}
                              className={`px-4 py-3 text-sm border-b border-gray-200 ${
                                colIndex === 0 ? 'font-semibold text-gray-800 bg-blue-50' : 'text-gray-600'
                              } ${colIndex === headers.length - 1 ? 'bg-gray-50' : ''}`}
                            >
                              {renderCell(row, header.key)}
                            </td>
                          ))}
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-6 py-4 bg-gray-50 rounded-b-xl">
                <div className="flex items-center space-x-3 mb-4 sm:mb-0">
                  <span className="text-sm text-gray-600">Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRowsPerPage(value === 'all' ? 'all' : parseInt(value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded-lg shadow-sm bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Rows per page"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="flex items-center space-x-3">
                  <motion.button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors duration-300 ${
                      currentPage === 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
                    whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
                    aria-label="Previous page"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </motion.button>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Page</span>
                    <input
                      type="number"
                      value={currentPage}
                      onChange={handlePageInput}
                      className="w-16 h-10 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={1}
                      max={totalPages}
                      aria-label="Current page"
                    />
                    <span className="text-sm text-gray-600">of {totalPages}</span>
                  </div>
                  <motion.button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors duration-300 ${
                      currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
                    whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
                    aria-label="Next page"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}