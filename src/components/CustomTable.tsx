/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import deleteById from '@/config/delete';

type Header = {
  label: string;
  key: string;
};

type Row = {
  [key: string]: any;
};

interface CustomTableProps {
  page: string;
  headers: Header[];
  data: Row[];
  renderCell?: (row: Row, key: string) => React.ReactNode;
}

const CustomTable: React.FC<CustomTableProps> = ({ page, headers, data, renderCell }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deletedRowIds, setDeletedRowIds] = useState<(string | number)[]>([]);
  const [tableData, setTableData] = useState<Row[]>(data);
  const [isDeleting, setIsDeleting] = useState<(string | number)[]>([]);
  const router = useRouter();

  useEffect(() => {
    setTableData(data);
    setCurrentPage(1);
  }, [data]);

  const sortData = (data: Row[], key: string, direction: 'asc' | 'desc'): Row[] => {
    return [...data].sort((a, b) => {
      const valueA = a[key] ?? '';
      const valueB = b[key] ?? '';
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return direction === 'asc' ? valueA - valueB : valueB - valueA;
      }
      const strA = valueA.toString().toLowerCase();
      const strB = valueB.toString().toLowerCase();
      return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedData = sortKey ? sortData(tableData, sortKey, sortDirection) : tableData;

  const totalRows = sortedData.length;
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(totalRows / (rowsPerPage as number));
  const startIndex = rowsPerPage === 'all' ? 0 : (currentPage - 1) * (rowsPerPage as number);
  const endIndex = rowsPerPage === 'all' ? totalRows : startIndex + (rowsPerPage as number);
  const paginatedData = rowsPerPage === 'all' ? sortedData : sortedData.slice(startIndex, endIndex);

  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, delay: i * 0.1 },
    }),
    deleted: { opacity: 0, x: -50, transition: { duration: 0.5 } },
  };

  const handleViewClick = (row: Row, rowIndex: number) => {
    const id = row.id;
    if (!id) {
      // toast.error(`No ID found for row ${startIndex + rowIndex + 1}`);
      return;
    }

    const pageLower = page.toLowerCase();
    let route: string;
    switch (pageLower) {
      case 'customer':
        route = `/master/customer/view?id=${id}`;
        break;
      case 'agent':
        route = `/master/agent/view?id=${id}`;
        break;
      case 'product':
        route = `/master/product/view?id=${id}`;
        break;
      case 'vendor':
        route = `/master/vendor/view?id=${id}`;
        break;
      case 'ledger':
        route = `/master/ledger/view?id=${id}`;
        break;
      case 'voucher':
        route = `/voucher/view?id=${id}`;
        break;
      case 'productopening':
        route = `/master/productopening/view?id=${id}`;
        break;
      case 'sale order':
        route = `/sale/order/view?id=${id}`;
        break;
      case 'sale bill':
        route = `/sale/bill/view?id=${id}`;
        break;
      case 'purchase order':
        route = `/purchase/order/view?id=${id}`;
        break;
      case 'purchase bill':
        route = `/purchase/bill/view?id=${id}`;
        break;
      case 'staff':
        route = `/staff/view?id=${id}`;
        break;
      case 'entry/journal':
        route = `/entry/journal/view?id=${id}`;
        break;
      default:
        // toast.error(`Invalid page type: ${page}`);
        return;
    }
    router.push(route);
  };

  const handleDeleteClick = async (row: Row, rowIndex: number) => {
    const id = row.id;
    if (!id) {
      // toast.error(`No ID found for row ${startIndex + rowIndex + 1}`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${id}?`)) {
      setIsDeleting((prev) => [...prev, id]);
      try {
        const result = await deleteById(id, page);
        if (result === id) {
          setDeletedRowIds((prev) => [...prev, id]);
          toast.success(`${page} ${id} deleted successfully!`);
          setTimeout(() => {
            setTableData((prev) => prev.filter((r) => r.id !== id));
            setIsDeleting((prev) => prev.filter((d) => d !== id));
            if (paginatedData.length === 1 && currentPage > 1) {
              setCurrentPage((prev) => prev - 1);
            }
          }, 500);
        } else {
          throw new Error(`Delete operation returned unexpected result: ${result}`);
        }
      } catch (error) {
        console.error('Error deleting row:', error);
        // toast.error(`Failed to delete ${page.toLowerCase()} ${id}`);
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

  return (
    <div className="w-full max-w-[90vw] mx-auto rounded-xl overflow-hidden">
      <Toaster />
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
                  key={row.id || `row-${startIndex + rowIndex}`}
                  variants={rowVariants}
                  initial="hidden"
                  animate={deletedRowIds.includes(row.id) ? 'deleted' : 'visible'}
                  custom={rowIndex}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  {headers.map((header, colIndex) => (
                    <td
                      key={`${row.id || startIndex + rowIndex}-${header.key}`}
                      className={`px-4 py-3 text-sm border-b border-gray-200 ${
                        colIndex === 0 ? 'font-semibold text-gray-800 bg-blue-50' : 'text-gray-600'
                      } ${colIndex === headers.length - 1 ? 'bg-gray-50' : ''}`}
                    >
                      {header.key === 'actions' ? (
                        <div className="flex space-x-2">
                          {page.toLowerCase() !== 'productopening' && (
                            <motion.button
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300 flex items-center gap-1 ${
                                deletedRowIds.includes(row.id) || isDeleting.includes(row.id)
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                              whileHover={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 1.05 }}
                              whileTap={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 0.95 }}
                              onClick={() => !deletedRowIds.includes(row.id) && !isDeleting.includes(row.id) && handleViewClick(row, rowIndex)}
                              disabled={deletedRowIds.includes(row.id) || isDeleting.includes(row.id)}
                              aria-label={`View ${row.id}`}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </motion.button>
                          )}
                          {!(page.toLowerCase() === 'product' && row.createdBy === 'company') && (
                            <motion.button
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300 flex items-center gap-1 ${
                                deletedRowIds.includes(row.id) || isDeleting.includes(row.id)
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                              whileHover={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 1.05 }}
                              whileTap={{ scale: deletedRowIds.includes(row.id) || isDeleting.includes(row.id) ? 1 : 0.95 }}
                              onClick={() => !deletedRowIds.includes(row.id) && !isDeleting.includes(row.id) && handleDeleteClick(row, rowIndex)}
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
                          )}
                        </div>
                      ) : renderCell ? (
                        renderCell(row, header.key)
                      ) : (
                        row[header.key] ?? 'N/A'
                      )}
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
  );
};

export default CustomTable;