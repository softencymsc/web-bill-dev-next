/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useContext, useRef, useCallback, Suspense } from 'react';
import { collection, getDocs, query, where, serverTimestamp, runTransaction, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { toast } from 'react-hot-toast';
import { CounterContext } from '@/lib/CounterContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Select from 'react-select';

interface TransactionEntry {
  transactionAmount: string;
  debitAmount: string;
  generalLedger: string;
  glDescription: string;
  description: string;
}

interface FormData {
  journalNo: string;
  date: string;
  transactions: TransactionEntry[];
}

interface GLCode {
  code: string;
  description: string;
  cashBank?: string;
}

interface SelectOption {
  value: string;
  label: string;
  description: string;
}

interface JournalFormProps {}

const UpdateJournalForm: React.FC<JournalFormProps> = () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<FormData>({
    journalNo: '',
    date: currentDate,
    transactions: [{ transactionAmount: '', debitAmount: '', generalLedger: '', glDescription: '', description: '' }],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableGLCodes, setAvailableGLCodes] = useState<GLCode[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const { state } = useContext(CounterContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const journalId = searchParams?.get('id') ?? '';
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Fetch GL codes and journal data
  const fetchJournalAndGLCodes = useCallback(async (): Promise<{ journalData: FormData | null; glCodes: GLCode[] }> => {
    try {
      if (!state.tenantId) {
        throw new Error('Tenant ID is not available');
      }
      if (!journalId) {
        throw new Error('Journal ID not provided in search parameters');
      }

      // Fetch GL codes
      const ledgersRef = collection(db, 'TenantsDb', state.tenantId, 'GL_Mast');
      const ledgerSnapshot = await getDocs(ledgersRef);
      const glCodes: GLCode[] = ledgerSnapshot.docs
        .map((doc) => ({
          code: doc.data().GLCODE ?? '',
          description: doc.data().DESCRIPT || 'No description available',
          cashBank: doc.data().CASH_BANK || 'N/A',
        }))
        .filter((item) => item.code && item.cashBank === 'No' && item.code !== '5000');

      // Fetch journal data
      const journalsRef = collection(db, 'TenantsDb', state.tenantId, 'TRNS1');
      const q = query(journalsRef, where('JOURNAL_NO', '==', journalId));
      const journalSnapshot = await getDocs(q);

      if (journalSnapshot.empty) {
        throw new Error('No journal found with the provided ID');
      }

      const journalDocs = journalSnapshot.docs;
      const validTransactions: TransactionEntry[] = [];
      const skippedDocs: string[] = [];

      journalDocs.forEach((doc) => {
        const data = doc.data();
        const transactionType = data.TRANSACTION_TYPE;

        // Validate TRANSACTION_TYPE
        if (!['Credit', 'Debit'].includes(transactionType)) {
          console.warn(`Skipping journal document ${doc.id}: Invalid TRANSACTION_TYPE "${transactionType}"`);
          skippedDocs.push(doc.id);
          return;
        }

        // Validate TRANSACTION_AMOUNT
        const transactionAmount = Number(data.TRANSACTION_AMOUNT);
        if (isNaN(transactionAmount) || transactionAmount < 0) {
          console.warn(`Skipping journal document ${doc.id}: Invalid TRANSACTION_AMOUNT "${data.TRANSACTION_AMOUNT}"`);
          skippedDocs.push(doc.id);
          return;
        }

        validTransactions.push({
          transactionAmount: transactionType === 'Credit' ? transactionAmount.toString() : '',
          debitAmount: transactionType === 'Debit' ? transactionAmount.toString() : '',
          generalLedger: data.GENERAL_LEDGER || '',
          glDescription: glCodes.find((gl) => gl.code === data.GENERAL_LEDGER)?.description || 'No description available',
          description: data.DESCRIPTION || '',
        });
      });

      if (validTransactions.length === 0) {
        throw new Error(`No valid transactions found for journal ID ${journalId}. Skipped documents: ${skippedDocs.join(', ')}`);
      }

      if (skippedDocs.length > 0) {
        console.warn(`Skipped ${skippedDocs.length} invalid journal documents: ${skippedDocs.join(', ')}`);
        toast(`Skipped ${skippedDocs.length} invalid journal entries due to missing or invalid data.`, {
          icon: '⚠️',
          style: {
            border: '1px solid #FFA500',
            background: '#FFF3CD',
            color: '#664D03',
          },
        });
      }

      const journalData: FormData = {
        journalNo: journalId,
        date: journalDocs[0].data().DATE
          ? (journalDocs[0].data().DATE instanceof Timestamp
              ? journalDocs[0].data().DATE.toDate().toISOString().split('T')[0]
              : typeof journalDocs[0].data().DATE === 'string'
              ? journalDocs[0].data().DATE
              : currentDate)
          : currentDate,
        transactions: validTransactions,
      };

      return { journalData, glCodes };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching journal or GL codes:', errorMessage);
      throw new Error(`Failed to fetch data: ${errorMessage}`);
    }
  }, [journalId, state.tenantId, currentDate]);

  // Initialize form
  useEffect(() => {
    const initializeForm = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { journalData, glCodes } = await fetchJournalAndGLCodes();
        if (glCodes.length === 0) {
          setError('No General Ledger codes with CASH_BANK = "No" and excluding code "5000" found.');
          // toast.error('No valid General Ledger codes available.');
        } else if (journalData) {
          setFormData(journalData);
          setAvailableGLCodes(glCodes);
        } else {
          setError('No journal data found for the provided ID.');
          // toast.error('No journal data found.');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        // toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    initializeForm();
  }, [fetchJournalAndGLCodes]);

  // Redirect if no journalId
  useEffect(() => {
    if (!journalId && !isLoading) {
      toast.error('No journal ID provided. Redirecting to journal list.');
      router.push('/entry/journal');
    }
  }, [journalId, isLoading, router]);

  // Focus description input
  useEffect(() => {
    if (isEditing && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  }, [isEditing]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { name, value } = e.target;
    if ((name === 'transactionAmount' || name === 'debitAmount') && value && Number(value) < 0) {
      // toast.error('Amounts cannot be negative.');
      return;
    }
    setFormData((prev) => {
      const newTransactions = [...prev.transactions];
      newTransactions[index] = {
        ...newTransactions[index],
        [name]: value,
        ...(name === 'transactionAmount' && value ? { debitAmount: '', description: 'To' } : {}),
        ...(name === 'debitAmount' && value ? { transactionAmount: '', description: 'By' } : {}),
        ...(name === 'description' ? { description: value } : {}),
      };
      return { ...prev, transactions: newTransactions };
    });
  };

  // Handle GL code selection
  const handleGLSelectChange = (option: SelectOption | null, index: number) => {
    setFormData((prev) => {
      const newTransactions = [...prev.transactions];
      newTransactions[index] = {
        ...newTransactions[index],
        generalLedger: option?.value || '',
        glDescription: option?.description || '',
      };
      return { ...prev, transactions: newTransactions };
    });
  };

  // Add transaction entry
  const addTransactionEntry = () => {
    setFormData((prev) => ({
      ...prev,
      transactions: [...prev.transactions, { transactionAmount: '', debitAmount: '', generalLedger: '', glDescription: '', description: '' }],
    }));
  };

  // Remove transaction entry
  const removeTransactionEntry = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((_, i) => i !== index),
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.journalNo) {
      // toast.error('Invalid Journal No.');
      return;
    }
    if (error) {
      // toast.error('Cannot submit form due to data error.');
      return;
    }
    if (!formData.date) {
      // toast.error('Date is required.');
      return;
    }
    if (formData.transactions.length === 0) {
      // toast.error('At least one transaction entry is required.');
      return;
    }
    for (let i = 0; i < formData.transactions.length; i++) {
      const transaction = formData.transactions[i];
      if (!transaction.generalLedger) {
        // toast.error(`Please select a General Ledger for transaction ${i + 1}.`);
        return;
      }
      if (!transaction.description) {
        // toast.error(`Please enter a Description for transaction ${i + 1}.`);
        return;
      }
      const creditAmount = Number(transaction.transactionAmount);
      const debitAmount = Number(transaction.debitAmount);
      if (!creditAmount && !debitAmount) {
        // toast.error(`Please enter a Credit or Debit Amount for transaction ${i + 1}.`);
        return;
      }
      if (creditAmount > 0 && debitAmount > 0) {
        // toast.error(`Only one of Credit or Debit Amount can be filled for transaction ${i + 1}.`);
        return;
      }
    }
    if (!isBalanced) {
      // toast.error(`Credit (${totalCredit}) and Debit (${totalDebit}) amounts must be equal and greater than 0.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const journalsRef = collection(db, 'TenantsDb', state.tenantId, 'TRNS1');
      const q = query(journalsRef, where('JOURNAL_NO', '==', formData.journalNo));

      await runTransaction(db, async (transaction) => {
        const journalSnapshot = await getDocs(q);
        journalSnapshot.docs.forEach((journalDoc) => {
          transaction.delete(doc(db, 'TenantsDb', state.tenantId, 'TRNS1', journalDoc.id));
        });

        formData.transactions.forEach((txnEntry) => {
          const amount = Number(txnEntry.transactionAmount) || Number(txnEntry.debitAmount);
          const journalData = {
            TRANSACTION_TYPE: txnEntry.transactionAmount ? 'Credit' : 'Debit',
            JOURNAL_NO: formData.journalNo,
            DATE: formData.date,
            DESCRIPTION: txnEntry.description,
            TRANSACTION_AMOUNT: amount,
            GENERAL_LEDGER: txnEntry.generalLedger,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          const newDocRef = doc(journalsRef);
          transaction.set(newDocRef, journalData);
        });
      });

      toast.success('Journal entries updated successfully!');
      setIsEditing(false);
      router.push('/entry/journal');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating journal entries:', errorMessage);
      // toast.error(`Failed to update journal entries: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push('/entry/journal');
  };

  // Handle edit
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Calculate totals
  const totalCredit = formData.transactions
    .reduce((sum, transaction) => sum + Number(transaction.transactionAmount || 0), 0)
    .toFixed(2);
  const totalDebit = formData.transactions
    .reduce((sum, transaction) => sum + Number(transaction.debitAmount || 0), 0)
    .toFixed(2);
  const isBalanced = Math.abs(Number(totalCredit) - Number(totalDebit)) < 0.01 && Number(totalCredit) > 0;

  // GL options for select
  const glOptions: SelectOption[] = availableGLCodes.map((glCode) => ({
    value: glCode.code,
    label: `${glCode.code} - ${glCode.description}`,
    description: glCode.description,
  }));

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center p-4">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-gray-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-gray-600 text-center">Loading journal data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || availableGLCodes.length === 0) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center p-4">
        <div className="text-red-500 text-center">{error || 'No General Ledger codes available. Please contact support.'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <main className="w-full max-w-7xl bg-white rounded-lg overflow-hidden p-6 md:p-8 mx-auto border-2">
        <form onSubmit={handleSubmit} className="w-full" aria-label="Update Journal Form">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[#2c5aa0] text-xl font-semibold text-center">Update Journal</h2>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-red-500 text-white text-sm font-semibold rounded-full shadow-md hover:bg-red-600 hover:shadow-lg transition-shadow"
                aria-label="Cancel journal update"
              >
                Cancel
              </button>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="px-6 py-2 bg-blue-500 text-white text-sm font-medium rounded-full shadow-md hover:bg-blue-600 hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                  disabled={isLoading || !!error}
                  aria-label="Edit journal entries"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="journalNo" className="text-gray-600 text-sm font-medium mb-1 block">
                  Journal No
                </label>
                <input
                  type="text"
                  id="journalNo"
                  name="journalNo"
                  placeholder="Journal No"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.journalNo}
                  disabled
                  aria-readonly="true"
                />
              </div>
              <div>
                <label htmlFor="date" className="text-gray-600 text-sm font-medium mb-1 block">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  disabled={!isEditing}
                  required
                  aria-required="true"
                />
              </div>
            </div>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-2">
                <div className="text-gray-600 text-sm font-medium">General Ledger Code</div>
                <div className="text-gray-600 text-sm font-medium">GL Description</div>
                <div className="text-gray-600 text-sm font-medium">Credit Amount</div>
                <div className="text-gray-600 text-sm font-medium">Debit Amount</div>
                <div className="text-gray-600 text-sm font-medium">Description</div>
                <div></div>
              </div>
              {formData.transactions.map((transaction, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4 items-end">
                  <div>
                    <Select
                      inputId={`generalLedger-${index}`}
                      options={glOptions}
                      value={glOptions.find((option) => option.value === transaction.generalLedger) || null}
                      onChange={(option) => handleGLSelectChange(option, index)}
                      getOptionLabel={(option) => option.label}
                      getOptionValue={(option) => option.value}
                      formatOptionLabel={(option, { context }) => (context === 'value' ? option.value : option.label)}
                      className="text-gray-600 text-sm"
                      styles={{
                        control: (base) => ({
                          ...base,
                          border: 'none',
                          borderBottom: '1px solid #d1d5db',
                          boxShadow: 'none',
                          '&:hover': {
                            borderBottom: '1px solid #2c5aa0',
                          },
                        }),
                        valueContainer: (base) => ({
                          ...base,
                          padding: '8px 0',
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: '#4b5563',
                        }),
                        menu: (base) => ({
                          ...base,
                          zIndex: 9999,
                        }),
                      }}
                      isClearable
                      placeholder="Select General Ledger Code"
                      isDisabled={!isEditing}
                      aria-label={`General Ledger Code for transaction ${index + 1}`}
                    />
                    {transaction.generalLedger === '' && isEditing && (
                      <p className="text-red-500 text-xs mt-1">General Ledger is required.</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={transaction.glDescription}
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 bg-gray-50"
                      disabled
                      aria-readonly="true"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      id={`transactionAmount-${index}`}
                      name="transactionAmount"
                      placeholder="Enter Credit Amount"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={transaction.transactionAmount}
                      onChange={(e) => handleChange(e, index)}
                      min="0"
                      step="0.01"
                      disabled={!isEditing}
                      aria-label={`Credit Amount for transaction ${index + 1}`}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      id={`debitAmount-${index}`}
                      name="debitAmount"
                      placeholder="Enter Debit Amount"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={transaction.debitAmount}
                      onChange={(e) => handleChange(e, index)}
                      min="0"
                      step="0.01"
                      disabled={!isEditing}
                      aria-label={`Debit Amount for transaction ${index + 1}`}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      id={`description-${index}`}
                      name="description"
                      placeholder="Enter Description"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={transaction.description}
                      onChange={(e) => handleChange(e, index)}
                      disabled={!isEditing}
                      required
                      ref={index === 0 ? descriptionInputRef : null}
                      aria-label={`Description for transaction ${index + 1}`}
                      aria-required="true"
                    />
                    {transaction.description === '' && isEditing && (
                      <p className="text-red-500 text-xs mt-1">Description is required.</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={addTransactionEntry}
                          className="w-8 h-8 bg-green-500 text-white text-lg font-semibold rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                          title="Add Transaction"
                          aria-label="Add new transaction"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTransactionEntry(index)}
                          className="w-8 h-8 bg-red-600 text-white text-lg font-semibold rounded-full flex items-center justify-center hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                          disabled={formData.transactions.length === 1}
                          title="Remove Transaction"
                          aria-label="Remove transaction"
                        >
                          -
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="mt-6">
                <table className="w-full table-auto border-collapse border border-gray-300" aria-describedby="transaction-totals">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-6 py-2 text-gray-600 text-sm font-medium text-left">General Ledger Code</th>
                      <th className="border border-gray-300 px-6 py-2 text-gray-600 text-sm font-medium text-left">GL Description</th>
                      <th className="border border-gray-300 px-6 py-2 text-gray-600 text-sm font-medium text-left">Credit Amount</th>
                      <th className="border border-gray-300 px-6 py-2 text-gray-600 text-sm font-medium text-left">Debit Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.transactions.map((transaction, index) => (
                      <tr key={index} className="bg-gray-50 odd:bg-white">
                        <td className="border border-gray-300 px-3 py-2 text-gray-600 text-sm">{transaction.generalLedger || '-'}</td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-600 text-sm">{transaction.glDescription || '-'}</td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-600 text-sm">{transaction.transactionAmount || '0'}</td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-600 text-sm">{transaction.debitAmount || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold" id="transaction-totals">
                      <td colSpan={2} className="border border-gray-300 px-6 py-2 text-gray-600 text-sm text-left">Total</td>
                      <td className="border border-gray-300 px-6 py-2 text-gray-600 text-sm">{totalCredit}</td>
                      <td className="border border-gray-300 px-6 py-2 text-gray-600 text-sm">{totalDebit}</td>
                    </tr>
                  </tfoot>
                </table>
                {!isBalanced && (
                  <p className="text-red-500 text-sm mt-2">
                    Credit ({totalCredit}) and Debit ({totalDebit}) amounts must be equal and greater than 0.
                  </p>
                )}
              </div>
            </div>
            {isEditing && (
              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="submit"
                  className="px-10 py-4 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow duration-200 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isSubmitting || isLoading || !!error || !isBalanced}
                  aria-label="Update journal entries"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update'
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <div className="min-h-screen w-screen flex items-center justify-center p-4">
        <div className="text-gray-600">Loading...</div>
      </div>
    }
  >
    <UpdateJournalForm />
  </Suspense>
);

export default Page;