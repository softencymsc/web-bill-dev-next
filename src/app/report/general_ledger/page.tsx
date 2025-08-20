/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useContext, useRef } from 'react';
import { db } from '../../../../firebase'; // Adjust path to your Firebase config
import { collection, query, where, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
import { CounterContext } from '@/lib/CounterContext'; // Adjust path to your context

interface Ledger {
  AMOUNT: number;
  CASH_BANK: string;
  CASH_BANK_CODE: string;
  DESCRIPT: string;
  GLCODE: string;
  INITIAL_NAME: string;
  NARRATION: string;
  PAYEE_R_CODE: string;
  PAYEE_R_NAME: string;
  TRNNO: string;
  TRN_DATE: string;
  TYPE: string;
  createdAt: string;
  OPENING_VALUE?: number;
}

interface Transaction {
  AMOUNT: number;
  CASH_BANK: string;
  CASH_BANK_CODE: string;
  CASH_BOOK: string;
  CHEQUE_DT: string;
  CHEQUE_ON: string;
  CHEQUE_TRANS_ID: string;
  DESCRIPT: string;
  GLCODE: string;
  INITIAL_NAME: string;
  NARRATION: string;
  PAYEE_R_CODE: string;
  PAYEE_R_NAME: string;
  TRNNO: string;
  TRN_DATE: string;
  TYPE: string;
  createdAt: string;
}

interface GLSelection {
  desc: string;
  glcode: string;
}

interface DisplayRow {
  type: 'Opening Balance' | 'Transaction' | 'Day Closing' | 'Closing Balance';
  AMOUNT?: number;
  balance: number;
  TRNNO: string;
  TRN_DATE: string;
  PAYEE_R_NAME: string;
  TYPE?: string;
  NARRATION?: string;
  totalReceipts?: number;
  totalPayments?: number;
}

const GeneralLedger: React.FC = () => {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [filteredLedgers, setFilteredLedgers] = useState<Ledger[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);
  const [selectedGLs, setSelectedGLs] = useState<GLSelection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showData, setShowData] = useState(false);
  const [company, setCompany] = useState<any>({});
  const [groupedBalances, setGroupedBalances] = useState<Record<string, DisplayRow[]>>({});
  const [viewMode, setViewMode] = useState<'summary' | 'details'>('details');
  const [showDayClosing, setShowDayClosing] = useState(true);
  const [showErpDetails, setShowErpDetails] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { state } = useContext(CounterContext);

  // Get company details from localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('company');
      setCompany(stored ? JSON.parse(stored) : {});
    }
  }, []);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch ledgers
  useEffect(() => {
    const fetchLedgers = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, `TenantsDb/${state.tenantId}/GL_Mast`),
          where('CASH_BANK', '==', 'Yes')
        );
        const querySnapshot = await getDocs(q);
        const ledgerData: Ledger[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
            OPENING_VALUE: data.OPENING_VALUE || 0,
          } as Ledger;
        });
        setLedgers(ledgerData);
        setFilteredLedgers(ledgerData);
      } catch (error) {
        console.error('Error fetching ledgers:', error);
        setLedgers([]);
        setFilteredLedgers([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (state.tenantId) {
      fetchLedgers();
    }
  }, [state.tenantId]);

  // Fetch transactions from TRNS1 only
  useEffect(() => {
    if (!showData) {
      setTransactions([]);
      setGroupedBalances({});
      return;
    }

    const fetchTransactions = async () => {
      if (selectedGLs.length === 0) {
        setTransactions([]);
        setGroupedBalances({});
        return;
      }

      setIsLoading(true);
      try {
        const transactionData: Transaction[] = [];

        // Fetch TRNS1 transactions
        for (const selected of selectedGLs) {
          const q = query(
            collection(db, `TenantsDb/${state.tenantId}/TRNS1`),
            where('CASH_BANK_CODE', '==', selected.desc)
          );
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach(doc => {
            transactionData.push({
              ...doc.data(),
              createdAt: doc.data().createdAt.toDate().toISOString(),
            } as Transaction);
          });
        }

        // Filter transactions by date range
        let filteredTransactions = transactionData;
        if (fromDate && toDate) {
          filteredTransactions = transactionData.filter(transaction => {
            const trnDate = new Date(transaction.TRN_DATE);
            return trnDate >= new Date(fromDate) && trnDate <= new Date(toDate);
          });
        }

        // Sort transactions by date
        filteredTransactions.sort((a, b) => new Date(a.TRN_DATE).getTime() - new Date(b.TRN_DATE).getTime());
        setTransactions(filteredTransactions);

        // Calculate balances for each group
        const grouped = filteredTransactions.reduce((acc, transaction) => {
          const key = transaction.CASH_BANK_CODE;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(transaction);
          return acc;
        }, {} as Record<string, Transaction[]>);

        const newGroupedBalances: Record<string, DisplayRow[]> = {};
        for (const [cashBankCode, txns] of Object.entries(grouped)) {
          newGroupedBalances[cashBankCode] = await calculateBalances(txns, cashBankCode);
        }
        setGroupedBalances(newGroupedBalances);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setGroupedBalances({});
      } finally {
        setIsLoading(false);
      }
    };

    if (state.tenantId) {
      fetchTransactions();
    }
  }, [selectedGLs, fromDate, toDate, showData, state.tenantId, ledgers]);

  // Create unique GLs with GLCODE and DESCRIPT
  const uniqueGLs = Array.from(
    new Set(ledgers.map(ledger => `${ledger.GLCODE}-${ledger.DESCRIPT}`))
  )
    .map(gl => {
      const [glcode, desc] = gl.split('-', 2);
      return { glcode, desc };
    })
    .sort((a, b) => `${a.glcode}-${a.desc}`.localeCompare(`${b.glcode}-${b.desc}`));

  const handleFilter = () => {
    setIsLoading(true);
    setShowData(true);
    let filtered = ledgers;
    if (selectedGLs.length > 0) {
      filtered = filtered.filter(ledger =>
        selectedGLs.some(selected => ledger.DESCRIPT === selected.desc)
      );
    }
    setFilteredLedgers(filtered);
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleCheckboxChange = (desc: string, glcode: string) => {
    setSelectedGLs(prev => {
      const isSelected = prev.some(item => item.desc === desc);
      if (isSelected) {
        return prev.filter(item => item.desc !== desc);
      }
      return [...prev, { desc, glcode }];
    });
  };

  const handleSelectAll = () => {
    if (selectedGLs.length === uniqueGLs.length) {
      setSelectedGLs([]); // Deselect all
    } else {
      setSelectedGLs(uniqueGLs); // Select all
    }
  };

  const calculateBalances = async (transactions: Transaction[], cashBankCode: string): Promise<DisplayRow[]> => {
    const ledger = ledgers.find(l => l.DESCRIPT === cashBankCode);
    let balance = ledger?.OPENING_VALUE || 0;
    let totalReceipts = 0;
    let totalPayments = 0;

    // Calculate opening balance as the closing balance of the day before fromDate
    if (fromDate) {
      const previousDay = new Date(fromDate);
      previousDay.setDate(previousDay.getDate() - 1);
      const previousDayStr = previousDay.toISOString().split('T')[0];

      // Fetch all transactions up to the previous day for this cashBankCode
      const allTransactions: Transaction[] = [];

      // Fetch TRNS1 transactions
      const trns1Query = query(
        collection(db, `TenantsDb/${state.tenantId}/TRNS1`),
        where('CASH_BANK_CODE', '==', cashBankCode)
      );
      const trns1Snapshot = await getDocs(trns1Query);
      trns1Snapshot.forEach(doc => {
        allTransactions.push({
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate().toISOString(),
        } as Transaction);
      });

      // Filter transactions up to previous day and calculate balance
      const previousDayTransactions = allTransactions.filter(t => {
        const trnDate = new Date(t.TRN_DATE);
        return trnDate <= previousDay;
      });

      previousDayTransactions.forEach(t => {
        balance += t.TYPE === 'Receipt' ? t.AMOUNT : -t.AMOUNT;
      });
    }

    console.log(`Calculating balances for ${cashBankCode} with opening balance: ${balance}`);

    const result: DisplayRow[] = [];
    result.push({
      type: 'Opening Balance',
      balance,
      TRNNO: '',
      TRN_DATE: fromDate || new Date().toISOString().split('T')[0],
      PAYEE_R_NAME: '',
      NARRATION: '',
      totalReceipts: 0,
      totalPayments: 0,
    });

    const transactionsByDate = transactions.reduce((acc, transaction) => {
      const date = transaction.TRN_DATE;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);

    Object.keys(transactionsByDate)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .forEach(date => {
        const dailyTransactions = transactionsByDate[date];
        let dailyReceipts = 0;
        let dailyPayments = 0;

        dailyTransactions.forEach((transaction) => {
          const amount = transaction.AMOUNT;
          if (transaction.TYPE === 'Receipt') {
            balance += amount;
            totalReceipts += amount;
            dailyReceipts += amount;
          } else {
            balance -= amount;
            totalPayments += amount;
            dailyPayments += amount;
          }
          result.push({
            type: 'Transaction',
            AMOUNT: amount,
            balance,
            TRNNO: transaction.TRNNO,
            TRN_DATE: transaction.TRN_DATE,
            PAYEE_R_NAME: transaction.PAYEE_R_NAME,
            TYPE: transaction.TYPE,
            NARRATION: transaction.NARRATION,
            totalReceipts: 0,
            totalPayments: 0,
          });
        });

        result.push({
          type: 'Day Closing',
          balance,
          TRNNO: '',
          TRN_DATE: date,
          PAYEE_R_NAME: '',
          NARRATION: '',
          totalReceipts: dailyReceipts,
          totalPayments: dailyPayments,
        });
      });

    result.push({
      type: 'Closing Balance',
      balance,
      TRNNO: '',
      TRN_DATE: transactions[transactions.length - 1]?.TRN_DATE || fromDate || new Date().toISOString().split('T')[0],
      PAYEE_R_NAME: '',
      NARRATION: '',
      totalReceipts,
      totalPayments,
    });

    return result;
  };

  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getAmountColor = (type: string | undefined) => {
    return type === 'Receipt' ? 'text-green-600' : 'text-red-600';
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();

    const companyTitle = company.CName || 'General Ledger';
    const addressLine1 = `${company.CAddress || ''}${company.address1 ? ', ' + company.address1 : ''}`;
    const addressLine2 = `City: ${company.city || ''}${company.CState ? ', ' + company.CState : ''}${company.CPin ? ' ' + company.CPin : ''}`;
    const gstinLine = company.gstin ? `GSTIN: ${company.gstin}` : '';

    // Centered company title
    doc.setFontSize(16);
    doc.setTextColor(33, 150, 243);
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(companyTitle, pageWidth / 2, 15, { align: 'center' });

    // Centered address
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    if (addressLine1.trim()) {
      doc.text(addressLine1, pageWidth / 2, 23, { align: 'center' });
    }
    if (addressLine2.trim()) {
      doc.text(addressLine2, pageWidth / 2, 30, { align: 'center' });
    }
    if (gstinLine) {
      doc.text(gstinLine, pageWidth / 2, 37, { align: 'center' });
    }

    // Centered table title
    doc.setFontSize(15);
    doc.setTextColor(33, 150, 243);
    doc.text(`General Ledger ${viewMode === 'summary' ? 'Summary' : 'Transactions'}`, pageWidth / 2, 47, { align: 'center' });

    // Filter for summary view or day closing
    if (viewMode === 'summary') {
      const summaryRows = Object.entries(groupedBalances).map(([cashBankCode, transactionsWithBalances]) => {
        const ledger = ledgers.find(l => l.DESCRIPT === cashBankCode);
        const openingBalanceRow = transactionsWithBalances.find(row => row.type === 'Opening Balance');
        const closingBalanceRow = transactionsWithBalances.find(row => row.type === 'Closing Balance');
        const totalReceipts = closingBalanceRow?.totalReceipts || 0;
        const totalPayments = closingBalanceRow?.totalPayments || 0;
        return [
          ledger?.GLCODE || '',
          cashBankCode,
          openingBalanceRow?.balance.toFixed(2) || '0.00',
          totalReceipts.toFixed(2) || '0.00',
          totalPayments.toFixed(2) || '0.00',
          closingBalanceRow?.balance.toFixed(2) || '0.00',
        ];
      });

      autoTable(doc, {
        startY: 55,
        head: [['GLCODE', 'DESCRIPT', 'Opening Balance', 'Receipt', 'Payment', 'Closing Balance']],
        body: summaryRows,
        theme: 'striped',
        headStyles: { fillColor: [200, 200, 200], textColor: [50, 50, 50] },
        bodyStyles: { fontSize: 10, cellPadding: 3, textColor: [50, 50, 50], fillColor: [255, 255, 255] },
        columnStyles: {
          0: { textColor: [50, 50, 50], fontStyle: 'bold' },
          1: { textColor: [50, 50, 50], fontStyle: 'bold' },
          2: { textColor: [50, 50, 50], fontStyle: 'bold' },
          3: { textColor: [50, 50, 50], fontStyle: 'bold' },
          4: { textColor: [50, 50, 50], fontStyle: 'bold' },
          5: { textColor: [50, 50, 50], fontStyle: 'bold' },
        },
        margin: { left: 10, right: 10 },
        didDrawPage: () => {},
      });
    } else {
      let firstTable = true;
      for (const [cashBankCode, transactionsWithBalances] of Object.entries(groupedBalances)) {
        if (!firstTable) {
          doc.addPage();
          // Repeat company title and address on new pages
          doc.setFontSize(16);
          doc.setTextColor(33, 150, 243);
          doc.text(companyTitle, pageWidth / 2, 15, { align: 'center' });
          doc.setFontSize(12);
          doc.setTextColor(50, 50, 50);
          if (addressLine1.trim()) {
            doc.text(addressLine1, pageWidth / 2, 23, { align: 'center' });
          }
          if (addressLine2.trim()) {
            doc.text(addressLine2, pageWidth / 2, 30, { align: 'center' });
          }
          if (gstinLine) {
            doc.text(gstinLine, pageWidth / 2, 37, { align: 'center' });
          }
          // Table title
          doc.setFontSize(15);
          doc.setTextColor(33, 150, 243);
          const ledger = ledgers.find(l => l.DESCRIPT === cashBankCode);
          const displayCode = ledger ? `${ledger.GLCODE}-${cashBankCode}` : cashBankCode;
          doc.text(`${displayCode} Transactions`, pageWidth / 2, 47, { align: 'center' });
        }
        firstTable = false;

        const rowsToShow = showDayClosing
          ? transactionsWithBalances
          : transactionsWithBalances.filter(row => row.type !== 'Day Closing');

        autoTable(doc, {
          startY: 55,
          head: [['VOUCHER NO', 'DATE', 'PARTICULARS', 'RECEIPT', 'PAYMENT', 'BALANCE']],
          body: rowsToShow.map(row => [
            (row.type === 'Transaction' ? row.TRNNO : row.type) || '',
            row.TRN_DATE || '',
            row.PAYEE_R_NAME ? `${row.PAYEE_R_NAME}${row.NARRATION ? `\n${row.NARRATION.toLowerCase()}` : ''}` : row.NARRATION?.toLowerCase() || '',
            row.type === 'Transaction' && row.TYPE === 'Receipt' ? row.AMOUNT?.toFixed(2) || '' : row.type === 'Day Closing' || row.type === 'Closing Balance' ? row.totalReceipts?.toFixed(2) || '' : '',
            row.type === 'Transaction' && row.TYPE === 'Payment' ? row.AMOUNT?.toFixed(2) || '' : row.type === 'Day Closing' || row.type === 'Closing Balance' ? row.totalPayments?.toFixed(2) || '' : '',
            row.balance.toFixed(2) || '',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [200, 200, 200], textColor: [50, 50, 50] },
          bodyStyles: { fontSize: 10, cellPadding: 3, textColor: [50, 50, 50], fillColor: [255, 255, 255] },
          columnStyles: {
            2: { fontSize: 10 },
            5: { textColor: [50, 50, 50], fontStyle: 'bold' },
          },
          margin: { left: 10, right: 10 },
          didDrawPage: () => {},
        });
      }
    }

    doc.save(`GeneralLedger_${viewMode}.pdf`);
  };

  // Display selected ledgers in the input box
  const displaySelectedLedgers = () => {
    if (selectedGLs.length === 0) {
      return 'Select Ledgers';
    }
    if (selectedGLs.length > 3) {
      return `${selectedGLs.length} selected`;
    }
    return selectedGLs.map(gl => `${gl.glcode}-${gl.desc}`).join(', ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-6 transition-all duration-1000 ease-in-out">
      <div className="container mx-auto max-w-6xl bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
          General Ledger
        </h1>

        <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-4 md:space-y-0 md:space-x-4">
          {/* Left: Day Closing & ERP Details */}
          <div className="flex flex-row space-x-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showDayClosing}
                onChange={() => setShowDayClosing(!showDayClosing)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all duration-200"
              />
              <label className="ml-2 text-sm text-gray-700 hover:text-blue-600 transition-colors duration-200">
                Show Day Closing
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showErpDetails}
                onChange={() => setShowErpDetails(!showErpDetails)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all duration-200"
              />
              <label className="ml-2 text-sm text-gray-700 hover:text-blue-600 transition-colors duration-200">
                Show ERP Details
              </label>
            </div>
          </div>
          {/* Right: Report Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={() => setViewMode('summary')}
              className={`py-2 px-6 rounded-lg font-semibold shadow-lg ${
                viewMode === 'summary' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Summary Report
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`py-2 px-6 rounded-lg font-semibold shadow-lg ${
                viewMode === 'details' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Details Report
            </button>
            <button
              onClick={exportToPDF}
              disabled={isLoading || Object.keys(groupedBalances).length === 0}
              className={`bg-gradient-to-r from-green-600 to-green-700 text-white py-2 px-6 rounded-lg font-semibold shadow-lg ${
                isLoading || Object.keys(groupedBalances).length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 hover:shadow-md"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 hover:shadow-md"
            />
          </div>
          <div className="md:col-span-2 relative" ref={dropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <div
              className="w-full p-3 border border-gray-300 rounded-lg bg-white/80 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 hover:shadow-md flex items-center justify-between"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="text-sm text-gray-700">
                {displaySelectedLedgers()}
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {isDropdownOpen && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                <div className="p-3 border-b border-gray-200">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedGLs.length === uniqueGLs.length}
                      onChange={handleSelectAll}
                      className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all duration-200"
                    />
                    <label className="ml-2 text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors duration-200">
                      Select All
                    </label>
                  </div>
                </div>
                {uniqueGLs.map((gl) => (
                  <div key={`${gl.glcode}-${gl.desc}`} className="flex items-center p-3 hover:bg-blue-50">
                    <input
                      type="checkbox"
                      checked={selectedGLs.some(item => item.desc === gl.desc)}
                      onChange={() => handleCheckboxChange(gl.desc, gl.glcode)}
                      className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all duration-200"
                    />
                    <label className="ml-2 text-sm text-gray-700 hover:text-blue-600 transition-colors duration-200">
                      {`${gl.glcode}-${gl.desc}`}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <button
            onClick={handleFilter}
            disabled={isLoading}
            className={`bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-8 rounded-lg font-semibold shadow-lg ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-700 hover:to-purple-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Loading...
              </div>
            ) : (
              'Apply Filters'
            )}
          </button>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : showData && Object.keys(groupedBalances).length > 0 ? (
            <div className="mb-8">
              {viewMode === 'summary' ? (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    General Ledger Summary
                  </h2>
                  <div className="bg-white/50 backdrop-blur-sm rounded-lg overflow-hidden shadow-lg">
                    <table className="min-w-full table-auto border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700">
                          <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">GLCODE</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">DESCRIPT</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">Opening Balance</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">Receipt</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">Payment</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">Closing Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(groupedBalances).map(([cashBankCode, transactionsWithBalances], index) => {
                          const ledger = ledgers.find(l => l.DESCRIPT === cashBankCode);
                          const openingBalanceRow = transactionsWithBalances.find(row => row.type === 'Opening Balance');
                          const closingBalanceRow = transactionsWithBalances.find(row => row.type === 'Closing Balance');
                          const totalReceipts = closingBalanceRow?.totalReceipts || 0;
                          const totalPayments = closingBalanceRow?.totalPayments || 0;
                          return (
                            <tr key={index} className="border-b bg-gradient-to-r from-gray-100 to-gray-200 font-semibold">
                              <td className="px-6 py-3 text-sm font-semibold">{ledger?.GLCODE || ''}</td>
                              <td className="px-6 py-3 text-sm font-semibold">{cashBankCode}</td>
                              <td className={`px-6 py-3 text-sm font-bold ${getBalanceColor(openingBalanceRow?.balance || 0)}`}>
                                {openingBalanceRow?.balance.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-6 py-3 text-sm font-semibold text-green-600">
                                {totalReceipts.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-6 py-3 text-sm font-semibold text-red-600">
                                {totalPayments.toFixed(2) || '0.00'}
                              </td>
                              <td className={`px-6 py-3 text-sm font-bold ${getBalanceColor(closingBalanceRow?.balance || 0)}`}>
                                {closingBalanceRow?.balance.toFixed(2) || '0.00'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                Object.entries(groupedBalances).map(([cashBankCode, transactionsWithBalances]) => {
                  const ledger = ledgers.find(l => l.DESCRIPT === cashBankCode);
                  const displayCode = ledger ? `${ledger.GLCODE}-${cashBankCode}` : cashBankCode;
                  return (
                    <div key={cashBankCode} className="mb-8">
                      <h2 className="text-2xl font-semibold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {displayCode} Transactions
                      </h2>
                      <div className="bg-white/50 backdrop-blur-sm rounded-lg overflow-hidden shadow-lg">
                        <table className="min-w-full table-auto border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700">
                              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">VOUCHER NO</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">DATE</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">PARTICULARS</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">RECEIPT</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">PAYMENT</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">BALANCE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(showDayClosing
                              ? transactionsWithBalances
                              : transactionsWithBalances.filter(row => row.type !== 'Day Closing')
                            ).map((item, index) => (
                              <tr
                                key={index}
                                className={`border-b ${
                                  item.type !== 'Transaction' ? 'bg-gradient-to-r from-gray-100 to-gray-200 font-semibold' : 'hover:bg-blue-50 hover:shadow-md'
                                }`}
                              >
                                <td className="px-6 py-3 text-sm font-medium">
                                  {item.type === 'Transaction' ? item.TRNNO : item.type}
                                </td>
                                <td className="px-6 py-3 text-sm">{item.TRN_DATE}</td>
                                <td className="px-6 py-3 text-sm">
                                  {item.PAYEE_R_NAME}
                                  {item.NARRATION && (
                                    <div className="text-sm text-gray-500 lowercase">
                                      {item.NARRATION}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-3 text-sm font-semibold">
                                  {(item.type === 'Transaction' && item.TYPE === 'Receipt') || item.type === 'Day Closing' || item.type === 'Closing Balance' ? (
                                    <span className="text-green-600">
                                      {(item.type === 'Transaction' ? item.AMOUNT : item.totalReceipts)?.toFixed(2)}
                                    </span>
                                  ) : ''}
                                </td>
                                <td className="px-6 py-3 text-sm font-semibold">
                                  {(item.type === 'Transaction' && item.TYPE === 'Payment') || item.type === 'Day Closing' || item.type === 'Closing Balance' ? (
                                    <span className="text-red-600">
                                      {(item.type === 'Transaction' ? item.AMOUNT : item.totalPayments)?.toFixed(2)}
                                    </span>
                                  ) : ''}
                                </td>
                                <td className={`px-6 py-3 text-sm font-bold ${getBalanceColor(item.balance)}`}>
                                  {item.balance.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneralLedger;