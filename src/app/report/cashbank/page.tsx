/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useContext, useRef } from 'react';
import { db } from '../../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
import { CounterContext } from '@/lib/CounterContext';

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

interface Bill {
  BILL_NO: string;
  BILL_DATE: any;
  CUSTNAME: string;
  CUST_CODE?: string;
  NET_AMOUNT: string;
  PAY_MODE: string;
  UPI_DETAILS?: { amount: number; descript: string; method: string }[];
}

interface Order {
  OA_NO: string;
  OA_DATE: any;
  CUSTNAME: string;
  CUST_CODE?: string;
  ADV_AMOUNT: number;
  NET_AMOUNT: number;
  PAY_MODE: string;
  UPI_DETAILS?: { amount: number; description: string; method: string }[];
}

interface Porder {
  BILL_NO: string;
  BILL_DATE: any;
  CUSTNAME: string;
  CUST_CODE?: string;
  ADV_AMOUNT: number;
  NET_AMOUNT: number;
  PAY_MODE: string;
  UPI_DETAILS?: { amount: number; description: string; method: string }[];
}

interface BillIn {
  BILL_NO: string;
  BILL_DATE: any;
  CUSTNAME: string;
  CUST_CODE?: string;
  NET_AMOUNT: string;
  PAY_MODE: string;
  UPI_DETAILS?: { amount: number; description: string; method: string }[];
}

interface GLSelection {
  desc: string;
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

const CashBankReport: React.FC = () => {
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

  // Get company details from localStorage
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

  // Fetch transactions from all collections
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

        // Fetch BILL collection
        const billQuery = query(
          collection(db, `TenantsDb/${state.tenantId}/BILL`),
          where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
        );
        const billSnapshot = await getDocs(billQuery);
        const billData: Bill[] = billSnapshot.docs.map(doc => doc.data() as Bill);

        // Fetch ORDER collection
        const orderQuery = query(
          collection(db, `TenantsDb/${state.tenantId}/ORDER`),
          where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
        );
        const orderSnapshot = await getDocs(orderQuery);
        const orderData: Order[] = orderSnapshot.docs.map(doc => doc.data() as Order);

        // Fetch PORDER collection
        const porderQuery = query(
          collection(db, `TenantsDb/${state.tenantId}/PORDER`),
          where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
        );
        const porderSnapshot = await getDocs(porderQuery);
        const porderData: Porder[] = porderSnapshot.docs.map(doc => doc.data() as Porder);

        // Fetch BILLIN collection
        const billinQuery = query(
          collection(db, `TenantsDb/${state.tenantId}/BILLIN`),
          where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
        );
        const billinSnapshot = await getDocs(billinQuery);
        const billinData: BillIn[] = billinSnapshot.docs.map(doc => doc.data() as BillIn);

        // Process BILL transactions
        for (const bill of billData) {
          let matchedLedger: Ledger | undefined;
          if (bill.PAY_MODE.toLowerCase() === 'cash') {
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
          } else if (bill.PAY_MODE === 'UPI' && bill.UPI_DETAILS && bill.UPI_DETAILS.length > 0) {
            const lastUpiDetail = bill.UPI_DETAILS[bill.UPI_DETAILS.length - 1];
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.descript);
          }

          if (matchedLedger && selectedGLs.some(gl => gl.desc === matchedLedger?.DESCRIPT)) {
            transactionData.push({
              AMOUNT: parseFloat(bill.NET_AMOUNT),
              CASH_BANK: matchedLedger.CASH_BANK,
              CASH_BANK_CODE: matchedLedger.DESCRIPT,
              CASH_BOOK: '',
              CHEQUE_DT: '',
              CHEQUE_ON: '',
              CHEQUE_TRANS_ID: '',
              DESCRIPT: matchedLedger.DESCRIPT,
              GLCODE: matchedLedger.GLCODE,
              INITIAL_NAME: matchedLedger.INITIAL_NAME,
              NARRATION: `Bill Payment via ${bill.PAY_MODE}`,
              PAYEE_R_CODE: bill.CUST_CODE || '',
              PAYEE_R_NAME: bill.CUSTNAME,
              TRNNO: bill.BILL_NO,
              TRN_DATE: bill.BILL_DATE.toDate().toISOString().split('T')[0],
              TYPE: 'Receipt',
              createdAt: bill.BILL_DATE.toDate().toISOString(),
            });
          }
        }

        // Process ORDER transactions
        for (const order of orderData) {
          let matchedLedger: Ledger | undefined;
          if (order.PAY_MODE.toLowerCase() === 'cash') {
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
          } else if (order.PAY_MODE === 'UPI' && order.UPI_DETAILS && order.UPI_DETAILS.length > 0) {
            const lastUpiDetail = order.UPI_DETAILS[order.UPI_DETAILS.length - 1];
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.description);
          }

          if (matchedLedger && selectedGLs.some(gl => gl.desc === matchedLedger?.DESCRIPT)) {
            transactionData.push({
              AMOUNT: order.ADV_AMOUNT,
              CASH_BANK: matchedLedger.CASH_BANK,
              CASH_BANK_CODE: matchedLedger.DESCRIPT,
              CASH_BOOK: '',
              CHEQUE_DT: '',
              CHEQUE_ON: '',
              CHEQUE_TRANS_ID: '',
              DESCRIPT: matchedLedger.DESCRIPT,
              GLCODE: matchedLedger.GLCODE,
              INITIAL_NAME: matchedLedger.INITIAL_NAME,
              NARRATION: `Order Advance via ${order.PAY_MODE}`,
              PAYEE_R_CODE: order.CUST_CODE || '',
              PAYEE_R_NAME: order.CUSTNAME,
              TRNNO: order.OA_NO,
              TRN_DATE: order.OA_DATE.toDate().toISOString().split('T')[0],
              TYPE: 'Receipt',
              createdAt: order.OA_DATE.toDate().toISOString(),
            });
          }
        }

        // Process PORDER transactions
        for (const porder of porderData) {
          let matchedLedger: Ledger | undefined;
          if (porder.PAY_MODE.toLowerCase() === 'cash') {
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
          } else if (porder.PAY_MODE === 'UPI' && porder.UPI_DETAILS && porder.UPI_DETAILS.length > 0) {
            const lastUpiDetail = porder.UPI_DETAILS[porder.UPI_DETAILS.length - 1];
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.description);
          }

          if (matchedLedger && selectedGLs.some(gl => gl.desc === matchedLedger?.DESCRIPT)) {
            transactionData.push({
              AMOUNT: porder.ADV_AMOUNT,
              CASH_BANK: matchedLedger.CASH_BANK,
              CASH_BANK_CODE: matchedLedger.DESCRIPT,
              CASH_BOOK: '',
              CHEQUE_DT: '',
              CHEQUE_ON: '',
              CHEQUE_TRANS_ID: '',
              DESCRIPT: matchedLedger.DESCRIPT,
              GLCODE: matchedLedger.GLCODE,
              INITIAL_NAME: matchedLedger.INITIAL_NAME,
              NARRATION: `Purchase Order Payment via ${porder.PAY_MODE}`,
              PAYEE_R_CODE: porder.CUST_CODE || '',
              PAYEE_R_NAME: porder.CUSTNAME,
              TRNNO: porder.BILL_NO,
              TRN_DATE: porder.BILL_DATE.toDate().toISOString().split('T')[0],
              TYPE: 'Payment',
              createdAt: porder.BILL_DATE.toDate().toISOString(),
            });
          }
        }

        // Process BILLIN transactions
        for (const billin of billinData) {
          let matchedLedger: Ledger | undefined;
          if (billin.PAY_MODE.toLowerCase() === 'cash') {
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
          } else if (billin.PAY_MODE === 'UPI' && billin.UPI_DETAILS && billin.UPI_DETAILS.length > 0) {
            const lastUpiDetail = billin.UPI_DETAILS[billin.UPI_DETAILS.length - 1];
            matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.description);
          }

          if (matchedLedger && selectedGLs.some(gl => gl.desc === matchedLedger?.DESCRIPT)) {
            transactionData.push({
              AMOUNT: parseFloat(billin.NET_AMOUNT),
              CASH_BANK: matchedLedger.CASH_BANK,
              CASH_BANK_CODE: matchedLedger.DESCRIPT,
              CASH_BOOK: '',
              CHEQUE_DT: '',
              CHEQUE_ON: '',
              CHEQUE_TRANS_ID: '',
              DESCRIPT: matchedLedger.DESCRIPT,
              GLCODE: matchedLedger.GLCODE,
              INITIAL_NAME: matchedLedger.INITIAL_NAME,
              NARRATION: `Bill In Payment via ${billin.PAY_MODE}`,
              PAYEE_R_CODE: billin.CUST_CODE || '',
              PAYEE_R_NAME: billin.CUSTNAME,
              TRNNO: billin.BILL_NO,
              TRN_DATE: billin.BILL_DATE.toDate().toISOString().split('T')[0],
              TYPE: 'Payment',
              createdAt: billin.BILL_DATE.toDate().toISOString(),
            });
          }
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

  // Create unique Descriptions
  const uniqueGLs = Array.from(
    new Set(ledgers.map(ledger => ledger.DESCRIPT))
  )
    .map(desc => ({ desc }))
    .sort((a, b) => a.desc.localeCompare(b.desc));

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

  const handleCheckboxChange = (desc: string) => {
    setSelectedGLs(prev => {
      const isSelected = prev.some(item => item.desc === desc);
      if (isSelected) {
        return prev.filter(item => item.desc !== desc);
      }
      return [...prev, { desc }];
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

      // Fetch BILL transactions
      const billQuery = query(
        collection(db, `TenantsDb/${state.tenantId}/BILL`),
        where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
      );
      const billSnapshot = await getDocs(billQuery);
      const billData: Bill[] = billSnapshot.docs.map(doc => doc.data() as Bill);

      // Fetch ORDER transactions
      const orderQuery = query(
        collection(db, `TenantsDb/${state.tenantId}/ORDER`),
        where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
      );
      const orderSnapshot = await getDocs(orderQuery);
      const orderData: Order[] = orderSnapshot.docs.map(doc => doc.data() as Order);

      // Fetch PORDER transactions
      const porderQuery = query(
        collection(db, `TenantsDb/${state.tenantId}/PORDER`),
        where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
      );
      const porderSnapshot = await getDocs(porderQuery);
      const porderData: Porder[] = porderSnapshot.docs.map(doc => doc.data() as Porder);

      // Fetch BILLIN transactions
      const billinQuery = query(
        collection(db, `TenantsDb/${state.tenantId}/BILLIN`),
        where('PAY_MODE', 'in', ['Cash', 'cash', 'CASH', 'UPI'])
      );
      const billinSnapshot = await getDocs(billinQuery);
      const billinData: BillIn[] = billinSnapshot.docs.map(doc => doc.data() as BillIn);

      // Process BILL transactions
      for (const bill of billData) {
        let matchedLedger: Ledger | undefined;
        if (bill.PAY_MODE.toLowerCase() === 'cash') {
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
        } else if (bill.PAY_MODE === 'UPI' && bill.UPI_DETAILS && bill.UPI_DETAILS.length > 0) {
          const lastUpiDetail = bill.UPI_DETAILS[bill.UPI_DETAILS.length - 1];
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.descript);
        }

        if (matchedLedger && matchedLedger.DESCRIPT === cashBankCode) {
          allTransactions.push({
            AMOUNT: parseFloat(bill.NET_AMOUNT),
            CASH_BANK: matchedLedger.CASH_BANK,
            CASH_BANK_CODE: matchedLedger.DESCRIPT,
            CASH_BOOK: '',
            CHEQUE_DT: '',
            CHEQUE_ON: '',
            CHEQUE_TRANS_ID: '',
            DESCRIPT: matchedLedger.DESCRIPT,
            GLCODE: matchedLedger.GLCODE,
            INITIAL_NAME: matchedLedger.INITIAL_NAME,
            NARRATION: `Bill Payment via ${bill.PAY_MODE}`,
            PAYEE_R_CODE: bill.CUST_CODE || '',
            PAYEE_R_NAME: bill.CUSTNAME,
            TRNNO: bill.BILL_NO,
            TRN_DATE: bill.BILL_DATE.toDate().toISOString().split('T')[0],
            TYPE: 'Receipt',
            createdAt: bill.BILL_DATE.toDate().toISOString(),
          });
        }
      }

      // Process ORDER transactions
      for (const order of orderData) {
        let matchedLedger: Ledger | undefined;
        if (order.PAY_MODE.toLowerCase() === 'cash') {
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
        } else if (order.PAY_MODE === 'UPI' && order.UPI_DETAILS && order.UPI_DETAILS.length > 0) {
          const lastUpiDetail = order.UPI_DETAILS[order.UPI_DETAILS.length - 1];
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.description);
        }

        if (matchedLedger && matchedLedger.DESCRIPT === cashBankCode) {
          allTransactions.push({
            AMOUNT: order.ADV_AMOUNT,
            CASH_BANK: matchedLedger.CASH_BANK,
            CASH_BANK_CODE: matchedLedger.DESCRIPT,
            CASH_BOOK: '',
            CHEQUE_DT: '',
            CHEQUE_ON: '',
            CHEQUE_TRANS_ID: '',
            DESCRIPT: matchedLedger.DESCRIPT,
            GLCODE: matchedLedger.GLCODE,
            INITIAL_NAME: matchedLedger.INITIAL_NAME,
            NARRATION: `Order Advance via ${order.PAY_MODE}`,
            PAYEE_R_CODE: order.CUST_CODE || '',
            PAYEE_R_NAME: order.CUSTNAME,
            TRNNO: order.OA_NO,
            TRN_DATE: order.OA_DATE.toDate().toISOString().split('T')[0],
            TYPE: 'Receipt',
            createdAt: order.OA_DATE.toDate().toISOString(),
          });
        }
      }

      // Process PORDER transactions
      for (const porder of porderData) {
        let matchedLedger: Ledger | undefined;
        if (porder.PAY_MODE.toLowerCase() === 'cash') {
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
        } else if (porder.PAY_MODE === 'UPI' && porder.UPI_DETAILS && porder.UPI_DETAILS.length > 0) {
          const lastUpiDetail = porder.UPI_DETAILS[porder.UPI_DETAILS.length - 1];
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.description);
        }

        if (matchedLedger && matchedLedger.DESCRIPT === cashBankCode) {
          allTransactions.push({
            AMOUNT: porder.ADV_AMOUNT,
            CASH_BANK: matchedLedger.CASH_BANK,
            CASH_BANK_CODE: matchedLedger.DESCRIPT,
            CASH_BOOK: '',
            CHEQUE_DT: '',
            CHEQUE_ON: '',
            CHEQUE_TRANS_ID: '',
            DESCRIPT: matchedLedger.DESCRIPT,
            GLCODE: matchedLedger.GLCODE,
            INITIAL_NAME: matchedLedger.INITIAL_NAME,
            NARRATION: `Purchase Order Payment via ${porder.PAY_MODE}`,
            PAYEE_R_CODE: porder.CUST_CODE || '',
            PAYEE_R_NAME: porder.CUSTNAME,
            TRNNO: porder.BILL_NO,
            TRN_DATE: porder.BILL_DATE.toDate().toISOString().split('T')[0],
            TYPE: 'Payment',
            createdAt: porder.BILL_DATE.toDate().toISOString(),
          });
        }
      }

      // Process BILLIN transactions
      for (const billin of billinData) {
        let matchedLedger: Ledger | undefined;
        if (billin.PAY_MODE.toLowerCase() === 'cash') {
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT.toLowerCase().includes('cash'));
        } else if (billin.PAY_MODE === 'UPI' && billin.UPI_DETAILS && billin.UPI_DETAILS.length > 0) {
          const lastUpiDetail = billin.UPI_DETAILS[billin.UPI_DETAILS.length - 1];
          matchedLedger = ledgers.find(ledger => ledger.DESCRIPT === lastUpiDetail.description);
        }

        if (matchedLedger && matchedLedger.DESCRIPT === cashBankCode) {
          allTransactions.push({
            AMOUNT: parseFloat(billin.NET_AMOUNT),
            CASH_BANK: matchedLedger.CASH_BANK,
            CASH_BANK_CODE: matchedLedger.DESCRIPT,
            CASH_BOOK: '',
            CHEQUE_DT: '',
            CHEQUE_ON: '',
            CHEQUE_TRANS_ID: '',
            DESCRIPT: matchedLedger.DESCRIPT,
            GLCODE: matchedLedger.GLCODE,
            INITIAL_NAME: matchedLedger.INITIAL_NAME,
            NARRATION: `Bill In Payment via ${billin.PAY_MODE}`,
            PAYEE_R_CODE: billin.CUST_CODE || '',
            PAYEE_R_NAME: billin.CUSTNAME,
            TRNNO: billin.BILL_NO,
            TRN_DATE: billin.BILL_DATE.toDate().toISOString().split('T')[0],
            TYPE: 'Payment',
            createdAt: billin.BILL_DATE.toDate().toISOString(),
          });
        }
      }

      // Filter transactions up to previous day and calculate balance
      const previousDayTransactions = allTransactions.filter(t => {
        const trnDate = new Date(t.TRN_DATE);
        return trnDate <= new Date(previousDayStr);
      });

      previousDayTransactions.forEach(t => {
        balance += t.TYPE === 'Receipt' ? t.AMOUNT : -t.AMOUNT;
      });
    }

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

    const companyTitle = company.CName || 'Cash Bank Report';
    const addressLine1 = `${company.CAddress || ''}${company.address1 ? ', ' + company.address1 : ''}`;
    const addressLine2 = `City: ${company.city || ''}${company.CState ? ', ' + company.CState : ''}${company.CPin ? ' ' + company.CPin : ''}`;
    const gstinLine = company.gstin ? `GSTIN: ${company.gstin}` : '';

    let firstTable = true;

    for (const [cashBankCode, transactionsWithBalances] of Object.entries(groupedBalances)) {
      if (!firstTable) {
        doc.addPage();
      }
      firstTable = false;

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
      doc.setFontSize(14);
      doc.setTextColor(33, 150, 243);
      doc.text(`${cashBankCode} ${viewMode === 'summary' ? 'Summary' : 'Transactions'}`, pageWidth / 2, 47, { align: 'center' });

      // Filter for summary view or day closing
      if (viewMode === 'summary') {
        const openingBalanceRow = transactionsWithBalances.find(row => row.type === 'Opening Balance');
        const closingBalanceRow = transactionsWithBalances.find(row => row.type === 'Closing Balance');
        const totalReceipts = closingBalanceRow?.totalReceipts || 0;
        const totalPayments = closingBalanceRow?.totalPayments || 0;

        autoTable(doc, {
          startY: 55,
          head: [['Opening Balance', 'Receipts', 'Payments', 'Closing Balance']],
          body: [[
            openingBalanceRow?.balance.toFixed(2) || '0.00',
            totalReceipts.toFixed(2) || '0.00',
            totalPayments.toFixed(2) || '0.00',
            closingBalanceRow?.balance.toFixed(2) || '0.00',
          ]],
          theme: 'grid',
          headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontSize: 10 },
          bodyStyles: { fontSize: 9, cellPadding: 4, textColor: [33, 33, 33] },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { textColor: openingBalanceRow?.balance ? (openingBalanceRow.balance >= 0 ? [0, 128, 0] : [255, 0, 0]) : [33, 33, 33], halign: 'right' },
            1: { textColor: [0, 128, 0], halign: 'right' },
            2: { textColor: [255, 0, 0], halign: 'right' },
            3: { textColor: closingBalanceRow?.balance ? (closingBalanceRow.balance >= 0 ? [0, 128, 0] : [255, 0, 0]) : [33, 33, 33], halign: 'right' },
          },
          margin: { left: 10, right: 10 },
        });
      } else {
        const rowsToShow = showDayClosing
          ? transactionsWithBalances
          : transactionsWithBalances.filter(row => row.type !== 'Day Closing');

        autoTable(doc, {
          startY: 55,
          head: [['Voucher No', 'Date', 'Particulars', 'Receipts', 'Payments', 'Balance']],
          body: rowsToShow.map(row => [
            (row.type === 'Transaction' ? row.TRNNO : row.type) || '',
            row.TRN_DATE || '',
            row.PAYEE_R_NAME ? `${row.PAYEE_R_NAME}${row.NARRATION ? `\n${row.NARRATION.toLowerCase()}` : ''}` : row.NARRATION?.toLowerCase() || '',
            row.type === 'Transaction' && row.TYPE === 'Receipt' ? row.AMOUNT?.toFixed(2) || '' : row.type === 'Day Closing' || row.type === 'Closing Balance' ? row.totalReceipts?.toFixed(2) || '' : '',
            row.type === 'Transaction' && row.TYPE === 'Payment' ? row.AMOUNT?.toFixed(2) || '' : row.type === 'Day Closing' || row.type === 'Closing Balance' ? row.totalPayments?.toFixed(2) || '' : '',
            row.balance.toFixed(2) || '',
          ]),
          theme: 'grid',
          headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontSize: 10 },
          bodyStyles: { fontSize: 9, cellPadding: 4, textColor: [33, 33, 33] },
          alternateRowStyles: { fillColor: [245, 245, 245] },
           columnStyles: {
    2: { fontSize: 8, cellWidth: 'wrap' },
    3: { textColor: [0, 128, 0], halign: 'right' },
    4: { textColor: [255, 0, 0], halign: 'right' },
    5: { halign: 'right' } // Remove textColor here
  },
          margin: { left: 10, right: 10 },
        });
      }
    }

    doc.save(`CashBankReport_${viewMode}.pdf`);
  };

  // Display selected ledgers in the input box
  const displaySelectedLedgers = () => {
    if (selectedGLs.length === 0) {
      return 'Select Ledgers';
    }
    if (selectedGLs.length > 3) {
      return `${selectedGLs.length} Ledgers Selected`;
    }
    return selectedGLs.map(gl => gl.desc).join(', ');
  };

  return (
    <div className="min-h-screen w-full bg-gray-100 p-4">
      <div className="w-full bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Cash Bank Report</h1>

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex flex-row space-x-4">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showDayClosing}
                onChange={() => setShowDayClosing(!showDayClosing)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                aria-label="Show Day Closing"
              />
              <span className="ml-2">Day Closing</span>
            </label>
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showErpDetails}
                onChange={() => setShowErpDetails(!showErpDetails)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                aria-label="Show ERP Details"
              />
              <span className="ml-2">ERP Details</span>
            </label>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Summary Report
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${viewMode === 'details' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Details Report
            </button>
            <button
              onClick={exportToPDF}
              disabled={isLoading || Object.keys(groupedBalances).length === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Export to PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="From Date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="To Date"
            />
          </div>
          <div className="md:col-span-2 relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cash/Bank Accounts</label>
            <div
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-700 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="text-sm">{displaySelectedLedgers()}</span>
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
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <label className="flex items-center text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedGLs.length === uniqueGLs.length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2">Select All</span>
                  </label>
                </div>
                {uniqueGLs.map((gl) => (
                  <label key={gl.desc} className="flex items-center p-2 hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedGLs.some(item => item.desc === gl.desc)}
                      onChange={() => handleCheckboxChange(gl.desc)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm">{gl.desc}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <button
            onClick={handleFilter}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : showData && Object.keys(groupedBalances).length > 0 ? (
            Object.entries(groupedBalances).map(([cashBankCode, transactionsWithBalances]) => (
              <div key={cashBankCode} className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{cashBankCode} {viewMode === 'summary' ? 'Summary' : 'Transactions'}</h2>
                <div className="bg-white rounded-md shadow-md overflow-hidden">
                  <table className="min-w-full border-collapse">
                    <thead>
                      {viewMode === 'summary' ? (
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Opening Balance</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Receipts</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Payments</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Closing Balance</th>
                        </tr>
                      ) : (
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Voucher No</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Particulars</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Receipts</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Payments</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Balance</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {viewMode === 'summary' ? (
                        (() => {
                          const openingBalanceRow = transactionsWithBalances.find(row => row.type === 'Opening Balance');
                          const closingBalanceRow = transactionsWithBalances.find(row => row.type === 'Closing Balance');
                          const totalReceipts = closingBalanceRow?.totalReceipts || 0;
                          const totalPayments = closingBalanceRow?.totalPayments || 0;
                          return (
                            <tr className="bg-gray-50 font-semibold">
                              <td className={`px-4 py-2 text-sm text-right ${getBalanceColor(openingBalanceRow?.balance || 0)}`}>
                                {openingBalanceRow?.balance.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-4 py-2 text-sm text-green-600 text-right">
                                {totalReceipts.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-4 py-2 text-sm text-red-600 text-right">
                                {totalPayments.toFixed(2) || '0.00'}
                              </td>
                              <td className={`px-4 py-2 text-sm text-right ${getBalanceColor(closingBalanceRow?.balance || 0)}`}>
                                {closingBalanceRow?.balance.toFixed(2) || '0.00'}
                              </td>
                            </tr>
                          );
                        })()
                      ) : (
                        (showDayClosing
                          ? transactionsWithBalances
                          : transactionsWithBalances.filter(row => row.type !== 'Day Closing')
                        ).map((item, index) => (
                          <tr
                            key={index}
                            className={`border-b ${item.type !== 'Transaction' ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {item.type === 'Transaction' ? item.TRNNO : item.type}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">{item.TRN_DATE}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {item.PAYEE_R_NAME}
                              {item.NARRATION && (
                                <div className="text-sm text-gray-500 lowercase">
                                  {item.NARRATION}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-green-600 text-right">
                              {(item.type === 'Transaction' && item.TYPE === 'Receipt') || item.type === 'Day Closing' || item.type === 'Closing Balance' ? (
                                (item.type === 'Transaction' ? item.AMOUNT : item.totalReceipts)?.toFixed(2)
                              ) : ''}
                            </td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">
                              {(item.type === 'Transaction' && item.TYPE === 'Payment') || item.type === 'Day Closing' || item.type === 'Closing Balance' ? (
                                (item.type === 'Transaction' ? item.AMOUNT : item.totalPayments)?.toFixed(2)
                              ) : ''}
                            </td>
                            <td className={`px-4 py-2 text-sm text-right ${getBalanceColor(item.balance)}`}>
                              {item.balance.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-gray-500">
                No transactions found. Please select filters and apply.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashBankReport;