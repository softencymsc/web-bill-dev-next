/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
import { CounterContext } from '@/lib/CounterContext';

interface JournalEntry {
  JOURNAL_NO: string;
  DATE: string;
  GENERAL_LEDGER: string;
  DESCRIPTION: string;
  TRANSACTION_AMOUNT: number;
  TRANSACTION_TYPE: 'Credit' | 'Debit';
  createdAt: string;
  POSTED?: boolean;
}

interface GLCode {
  GLCODE: string;
  DESCRIPT: string;
}

interface GLSelection {
  code: string;
}

interface DisplayRow {
  JOURNAL_NO: string;
  DATE: string;
  GENERAL_LEDGER: string;
  GL_DESCRIPTION: string;
  DESCRIPTION: string;
  CREDIT_AMOUNT: number;
  DEBIT_AMOUNT: number;
}

const JournalReport: React.FC = () => {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [glCodes, setGLCodes] = useState<GLCode[]>([]);
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);
  const [selectedGLs, setSelectedGLs] = useState<GLSelection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showData, setShowData] = useState(false);
  const [company, setCompany] = useState<any>({});
  const [groupedEntries, setGroupedEntries] = useState<Record<string, DisplayRow[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [showPostedOnly, setShowPostedOnly] = useState(false);
  const [showNarration, setShowNarration] = useState(true);
  const { state } = useContext(CounterContext);
  const router = useRouter();

  // Get company details from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('company');
      setCompany(stored ? JSON.parse(stored) : {});
    }
  }, []);

  // Fetch GL codes
  useEffect(() => {
    const fetchGLCodes = async () => {
      if (!state.tenantId) {
        setError('Tenant ID is missing.');
        return;
      }
      setIsLoading(true);
      try {
        const q = query(collection(db, `TenantsDb/${state.tenantId}/GL_Mast`));
        const querySnapshot = await getDocs(q);
        const glData: GLCode[] = querySnapshot.docs.map(doc => ({
          GLCODE: doc.data().GLCODE || '',
          DESCRIPT: doc.data().DESCRIPT || 'No description',
        }));
        setGLCodes(glData);
      } catch (error) {
        console.error('Error fetching GL codes:', error);
        setError('Failed to fetch GL codes.');
        setGLCodes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGLCodes();
  }, [state.tenantId]);

  // Fetch journal entries
  useEffect(() => {
    if (!showData) {
      setJournalEntries([]);
      setGroupedEntries({});
      return;
    }

    const fetchJournalEntries = async () => {
      if (!state.tenantId) {
        setError('Tenant ID is missing.');
        return;
      }
      setIsLoading(true);
      try {
        let entries: JournalEntry[] = [];
        if (selectedGLs.length === 0) {
          const q = query(collection(db, `TenantsDb/${state.tenantId}/TRNS1`));
          const querySnapshot = await getDocs(q);
          entries = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              JOURNAL_NO: data.JOURNAL_NO || '',
              DATE: data.JOURNAL_NO || '',
              GENERAL_LEDGER: data.GENERAL_LEDGER || '',
              DESCRIPTION: data.DESCRIPTION || '',
              TRANSACTION_AMOUNT: data.TRANSACTION_AMOUNT || 0,
              TRANSACTION_TYPE: data.TRANSACTION_TYPE || 'Credit',
              createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
              POSTED: data.POSTED || false,
            };
          });
        } else {
          for (const selected of selectedGLs) {
            const q = query(
              collection(db, `TenantsDb/${state.tenantId}/TRNS1`),
              where('GENERAL_LEDGER', '==', selected.code)
            );
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
              const data = doc.data();
              entries.push({
                JOURNAL_NO: data.JOURNAL_NO || '',
                DATE: data.JOURNAL_NO || '',
                GENERAL_LEDGER: data.GENERAL_LEDGER || '',
                DESCRIPTION: data.DESCRIPTION || '',
                TRANSACTION_AMOUNT: data.TRANSACTION_AMOUNT || 0,
                TRANSACTION_TYPE: data.TRANSACTION_TYPE || 'Credit',
                createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
                POSTED: data.POSTED || false,
              });
            });
          }
        }

        // Filter by date range
        if (fromDate && toDate) {
          entries = entries.filter(entry => {
            const entryDate = new Date(entry.DATE);
            return entryDate >= new Date(fromDate) && entryDate <= new Date(toDate);
          });
        }

        // Filter by posted status if showPostedOnly is true
        if (showPostedOnly) {
          entries = entries.filter(entry => entry.POSTED);
        }

        // Sort by date
        entries.sort((a, b) => new Date(a.DATE).getTime() - new Date(b.DATE).getTime());
        setJournalEntries(entries);

        // Group by JOURNAL_NO and include GL description
        const grouped = entries.reduce((acc, entry) => {
          const key = entry.JOURNAL_NO;
          if (!acc[key]) {
            acc[key] = [];
          }
          const glDescription = glCodes.find(gl => gl.GLCODE === entry.GENERAL_LEDGER)?.DESCRIPT || 'No description';
          const displayRow: DisplayRow = {
            JOURNAL_NO: entry.JOURNAL_NO,
            DATE: entry.DATE,
            GENERAL_LEDGER: entry.GENERAL_LEDGER,
            GL_DESCRIPTION: glDescription,
            DESCRIPTION: entry.DESCRIPTION,
            CREDIT_AMOUNT: entry.TRANSACTION_TYPE === 'Credit' ? entry.TRANSACTION_AMOUNT : 0,
            DEBIT_AMOUNT: entry.TRANSACTION_TYPE === 'Debit' ? entry.TRANSACTION_AMOUNT : 0,
          };
          acc[key].push(displayRow);
          return acc;
        }, {} as Record<string, DisplayRow[]>);

        setGroupedEntries(grouped);
        setError(null);
      } catch (error) {
        console.error('Error fetching journal entries:', error);
        setError('Failed to fetch journal entries.');
        setGroupedEntries({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchJournalEntries();
  }, [selectedGLs, fromDate, toDate, showData, state.tenantId, glCodes, showPostedOnly]);

  // Create unique GL codes for selection
  const uniqueGLs = Array.from(new Set(glCodes.map(gl => gl.GLCODE)))
    .map(code => ({
      code,
      desc: glCodes.find(gl => gl.GLCODE === code)?.DESCRIPT || code,
    }))
    .sort((a, b) => a.desc.localeCompare(b.desc));

  const handleFilter = () => {
    setIsLoading(true);
    setShowData(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleCheckboxChange = (code: string) => {
    setSelectedGLs(prev => {
      const isSelected = prev.some(item => item.code === code);
      if (isSelected) {
        return prev.filter(item => item.code !== code);
      }
      return [...prev, { code }];
    });
  };

  const handleBack = () => {
    router.push('/entry/journal');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    const companyTitle = company.CName || 'Journal Report';
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

    // Centered report title
    doc.setFontSize(14);
    doc.setTextColor(33, 150, 243);
    doc.text('Journal Report', pageWidth / 2, 47, { align: 'center' });

    // Prepare single table body with all journal entries
    const head = showNarration
      ? [['Journal No', 'Date', 'GL Code', 'GL Description', 'Narration', 'Credit', 'Debit']]
      : [['Journal No', 'Date', 'GL Code', 'GL Description', 'Credit', 'Debit']];
    const body: string[][] = [];

    // Iterate through grouped entries to build the table
    Object.entries(groupedEntries).forEach(([journalNo, entries]) => {
      // Add journal entries
      entries.forEach((entry, index) => {
        const row = showNarration
          ? [
              index === 0 ? journalNo : '', // Show journal number only on the first row
              index === 0 ? entry.DATE : '', // Show date only on the first row
              entry.GENERAL_LEDGER,
              entry.GL_DESCRIPTION,
              entry.DESCRIPTION,
              entry.CREDIT_AMOUNT > 0 ? entry.CREDIT_AMOUNT.toFixed(2) : '',
              entry.DEBIT_AMOUNT > 0 ? entry.DEBIT_AMOUNT.toFixed(2) : '',
            ]
          : [
              index === 0 ? journalNo : '',
              index === 0 ? entry.DATE : '',
              entry.GENERAL_LEDGER,
              entry.GL_DESCRIPTION,
              entry.CREDIT_AMOUNT > 0 ? entry.CREDIT_AMOUNT.toFixed(2) : '',
              entry.DEBIT_AMOUNT > 0 ? entry.DEBIT_AMOUNT.toFixed(2) : '',
            ];
        body.push(row);
      });

      // Add total row for this journal
      const totalCredit = entries.reduce((sum, entry) => sum + entry.CREDIT_AMOUNT, 0);
      const totalDebit = entries.reduce((sum, entry) => sum + entry.DEBIT_AMOUNT, 0);
      const totalRow = showNarration
        ? ['', '', '', '', 'Total', totalCredit.toFixed(2), totalDebit.toFixed(2)]
        : ['', '', '', 'Total', totalCredit.toFixed(2), totalDebit.toFixed(2)];
      body.push(totalRow);

      // Add empty row for separation
      body.push(showNarration ? ['', '', '', '', '', '', ''] : ['', '', '', '', '', '']);
    });

    // Remove the last empty row if it exists
    if (body.length > 0 && body[body.length - 1].every(cell => cell === '')) {
      body.pop();
    }

    // Grand totals
    const grandTotalCredit = journalEntries.reduce((sum, entry) => sum + (entry.TRANSACTION_TYPE === 'Credit' ? entry.TRANSACTION_AMOUNT : 0), 0);
    const grandTotalDebit = journalEntries.reduce((sum, entry) => sum + (entry.TRANSACTION_TYPE === 'Debit' ? entry.TRANSACTION_AMOUNT : 0), 0);
    const grandTotalRow = showNarration
      ? ['', '', '', '', 'Grand Total', grandTotalCredit.toFixed(2), grandTotalDebit.toFixed(2)]
      : ['', '', '', 'Grand Total', grandTotalCredit.toFixed(2), grandTotalDebit.toFixed(2)];
    body.push(grandTotalRow);

    // Generate the table
    autoTable(doc, {
      startY: 55,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontSize: 10 },
      bodyStyles: { fontSize: 9, cellPadding: 4, textColor: [33, 33, 33] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: showNarration
        ? {
            0: { cellWidth: 'wrap' },
            3: { fontSize: 8, cellWidth: 'wrap' },
            4: { fontSize: 8, cellWidth: 'wrap' },
            5: { textColor: [0, 128, 0], halign: 'right' },
            6: { textColor: [255, 0, 0], halign: 'right' },
          }
        : {
            0: { cellWidth: 'wrap' },
            3: { fontSize: 8, cellWidth: 'wrap' },
            4: { textColor: [0, 128, 0], halign: 'right' },
            5: { textColor: [255, 0, 0], halign: 'right' },
          },
      margin: { left: 10, right: 10 },
      didParseCell: (data) => {
        // Bold the total and grand total rows
        const cellText = data.row.cells[showNarration ? 4 : 3]?.text;
        const cellContent = Array.isArray(cellText) ? cellText.join('') : cellText;
        if (cellContent === 'Total' || cellContent === 'Grand Total') {
          Object.values(data.row.cells).forEach(cell => {
            cell.styles.fontStyle = 'bold';
          });
        }
      },
    });

    doc.save('JournalReport.pdf');
  };

  return (
    <div className="min-h-screen w-full bg-gray-100 p-4">
      <div className="w-full bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Journal Report</h1>

        {error && (
          <div className="mb-4 text-red-600 text-center text-sm">{error}</div>
        )}

        <div className="flex justify-between items-center mb-6">
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
          <button
            onClick={exportToPDF}
            disabled={isLoading || Object.keys(groupedEntries).length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Export to PDF
          </button>
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
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showPostedOnly}
                onChange={() => setShowPostedOnly(prev => !prev)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                aria-label="Show Posted Journals Only"
              />
              <span className="ml-2">Posted Only</span>
            </label>
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showNarration}
                onChange={() => setShowNarration(prev => !prev)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                aria-label="Show Narration"
              />
              <span className="ml-2">Narration</span>
            </label>
          </div>
          <div>
            <button
              onClick={handleFilter}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              aria-label="Apply Filters"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading...
                </div>
              ) : (
                'Apply Filters'
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : showData && Object.keys(groupedEntries).length > 0 ? (
            Object.entries(groupedEntries).map(([journalNo, entries]) => (
              <div key={journalNo} className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Journal No: {journalNo}</h2>
                <div className="bg-white rounded-md shadow-md overflow-hidden">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">GL Code</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">GL Description</th>
                        {showNarration && (
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Narration</th>
                        )}
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Credit</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Debit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-700">{index === 0 ? entry.DATE : ''}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{entry.GENERAL_LEDGER}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{entry.GL_DESCRIPTION}</td>
                          {showNarration && (
                            <td className="px-4 py-2 text-sm text-gray-700">{entry.DESCRIPTION}</td>
                          )}
                          <td className="px-4 py-2 text-sm text-green-600 text-right">
                            {entry.CREDIT_AMOUNT > 0 ? entry.CREDIT_AMOUNT.toFixed(2) : ''}
                          </td>
                          <td className="px-4 py-2 text-sm text-red-600 text-right">
                            {entry.DEBIT_AMOUNT > 0 ? entry.DEBIT_AMOUNT.toFixed(2) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={showNarration ? 4 : 3} className="px-4 py-2 text-sm text-gray-700 text-right">Total</td>
                        <td className="px-4 py-2 text-sm text-green-600 text-right">
                          {entries.reduce((sum, entry) => sum + entry.CREDIT_AMOUNT, 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-red-600 text-right">
                          {entries.reduce((sum, entry) => sum + entry.DEBIT_AMOUNT, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-gray-500">
                {error || 'No journal entries found. Please select filters and apply.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalReport;