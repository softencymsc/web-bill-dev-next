/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useContext, useRef } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'react-hot-toast';
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from 'next/navigation';
import Select from 'react-select';

interface JournalFormProps {
  page: string;
  onSubmit?: (formData: FormData) => void;
}

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

const JournalForm: React.FC<JournalFormProps> = ({ page, onSubmit }) => {
  const currentDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<FormData>({
    journalNo: '',
    date: currentDate,
    transactions: [{ transactionAmount: '', debitAmount: '', generalLedger: '', glDescription: '', description: '' }],
  });
  const [isLoadingId, setIsLoadingId] = useState(true);
  const [idError, setIdError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableGLCodes, setAvailableGLCodes] = useState<GLCode[]>([]);
  const { state } = useContext(CounterContext);
  const router = useRouter();
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const fetchJournalNosAndGLCodes = async (): Promise<{ journalNos: string[]; glCodes: GLCode[] }> => {
    try {
      const journalsRef = collection(db, "TenantsDb", state.tenantId, "TRNS1");
      const journalSnapshot = await getDocs(journalsRef);
      const journalNos: string[] = journalSnapshot.docs
        .map((doc) => doc.data().JOURNAL_NO)
        .filter((id) => id);

      const ledgersRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast");
      console.log('Fetching GL codes from:', ledgersRef);
      const ledgerSnapshot = await getDocs(ledgersRef);
      const glCodes: GLCode[] = ledgerSnapshot.docs
        .map((doc) => ({
          code: doc.data().GLCODE,
          description: doc.data().DESCRIPT || 'No description available',
          cashBank: doc.data().CASH_BANK || 'N/A',
        }))
        .filter((item) => item.code && item.cashBank === 'No' && item.code !== '5000');

      return { journalNos, glCodes };
    } catch (error) {
      console.error('Error fetching journal numbers or GL codes:', error);
      throw new Error('Failed to fetch data');
    }
  };

  const generateUniqueJournalNo = async (): Promise<string> => {
    const { journalNos } = await fetchJournalNosAndGLCodes();
    const maxRetries = 100;
    const codeLength = 6;
    const characters = '0123456789';
    let retries = 0;

    while (retries < maxRetries) {
      let result = 'J';
      for (let i = 0; i < codeLength - 1; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      if (!journalNos.includes(result)) {
        return result;
      }
      retries++;
    }
    throw new Error('Unable to generate a unique Journal No after maximum retries');
  };

  useEffect(() => {
    const initializeForm = async () => {
      setIsLoadingId(true);
      setIdError(null);
      try {
        const { glCodes } = await fetchJournalNosAndGLCodes();
        if (glCodes.length === 0) {
          setIdError('No General Ledger codes with CASH_BANK = "No" and excluding code "5000" found.');
          // toast.error('No valid General Ledger codes available.');
        }
        setAvailableGLCodes(glCodes);
        const newNo = await generateUniqueJournalNo();
        setFormData((prev) => ({ ...prev, journalNo: newNo }));
      } catch (error) {
        console.error('Error initializing form:', error);
        setIdError('Failed to generate Journal No or fetch GL codes. Please try again.');
        // toast.error('Failed to initialize form. Please try again.');
      } finally {
        setIsLoadingId(false);
      }
    };
    initializeForm();
  }, [state.tenantId]);

  useEffect(() => {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newTransactions = [...prev.transactions];
      newTransactions[index] = {
        ...newTransactions[index],
        [name]: value,
        ...(name === 'transactionAmount' && value ? { debitAmount: '0', description: 'To' } : {}),
        ...(name === 'debitAmount' && value ? { transactionAmount: '0', description: 'By' } : {}),
        ...(name === 'description' ? { description: value } : {}),
      };
      return { ...prev, transactions: newTransactions };
    });
  };

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
    console.log('Selected General Ledger for transaction', index, ':', {
      code: option?.value || '',
      description: option?.description || 'No description available',
    });
  };

  const addTransactionEntry = () => {
    setFormData((prev) => ({
      ...prev,
      transactions: [...prev.transactions, { transactionAmount: '', debitAmount: '', generalLedger: '', glDescription: '', description: '' }],
    }));
  };

  const removeTransactionEntry = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.journalNo) {
      // toast.error('Invalid Journal No.');
      return;
    }
    if (idError) {
      // toast.error('Cannot submit form due to ID generation error.');
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
      if (creditAmount < 0 || debitAmount < 0) {
        // toast.error(`Amounts must be positive for transaction ${i + 1}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const journalsRef = collection(db, "TenantsDb", state.tenantId, "TRNS1");
      for (const transaction of formData.transactions) {
        const creditAmount = Number(transaction.transactionAmount);
        const debitAmount = Number(transaction.debitAmount);
        const amount = creditAmount || debitAmount;
        const journalData = {
          TRANSACTION_TYPE: creditAmount > 0 ? 'Credit' : 'Debit',
          JOURNAL_NO: formData.journalNo,
          DATE: formData.date,
          DESCRIPTION: transaction.description,
          TRANSACTION_AMOUNT: amount,
          GENERAL_LEDGER: transaction.generalLedger,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await addDoc(journalsRef, journalData);
      }
      toast.success('Journal entries saved successfully!');
      if (onSubmit) {
        onSubmit(formData);
      }
      // Redirect to /entry/journal after successful submission
      router.push('/entry/journal');
    } catch (error: any) {
      console.error('Error saving journal entries:', error);
      // toast.error(`Failed to save journal entries: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/entry/journal');
  };

  const totalCredit = formData.transactions
    .reduce((sum, transaction) => sum + Number(transaction.transactionAmount || 0), 0)
    .toFixed(2);
  const totalDebit = formData.transactions
    .reduce((sum, transaction) => sum + Number(transaction.debitAmount || 0), 0)
    .toFixed(2);

  const isBalanced = Number(totalCredit) === Number(totalDebit) && Number(totalCredit) > 0;

  const glOptions: SelectOption[] = availableGLCodes.map((glCode) => ({
    value: glCode.code,
    label: `${glCode.code} - ${glCode.description}`,
    description: glCode.description,
  }));

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <main className="w-full max-w-full bg-white rounded-lg overflow-hidden p-6 md:p-8 mx-auto border-2 flex items-center justify-center">
        <form className="w-full" onSubmit={handleSubmit}>
          <h2 className="text-[#2c5aa0] text-xl font-semibold mb-6 text-center">{page}</h2>
          <div className="grid gap-6">
            {/* Journal No and Date Row */}
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
                  value={isLoadingId ? 'Loading...' : (idError || formData.journalNo)}
                  onChange={(e) => setFormData((prev) => ({ ...prev, journalNo: e.target.value }))}
                  disabled
                />
                {idError && <p className="text-red-500 text-xs mt-1">{idError}</p>}
              </div>
              <div>
                <label htmlFor="date" className="text-gray-600 text-sm font-medium mb-1 block">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
            </div>
            {/* Transaction Fields with Description After Debit Amount */}
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
                      placeholder="General Ledger"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={transaction.glDescription}
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 bg-gray-50"
                      disabled
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      id={`transactionAmount-${index}`}
                      name="transactionAmount"
                      placeholder="Enter Credit Amount"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={transaction.transactionAmount}
                      onChange={(e) => handleChange(e, index)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      id={`debitAmount-${index}`}
                      name="debitAmount"
                      placeholder="Enter Debit Amount"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={transaction.debitAmount}
                      onChange={(e) => handleChange(e, index)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      id={`description-${index}`}
                      name="description"
                      placeholder="Description"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={transaction.description}
                      onChange={(e) => handleChange(e, index)}
                      required
                      ref={index === 0 ? descriptionInputRef : null}
                    />
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      type="button"
                      onClick={addTransactionEntry}
                      className="w-8 h-8 bg-green-500 text-white text-lg font-semibold rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                      title="Add Transaction"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTransactionEntry(index)}
                      className="w-8 h-8 bg-red-500 text-white text-lg font-semibold rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      disabled={formData.transactions.length === 1}
                      title="Remove Transaction"
                    >
                      -
                    </button>
                  </div>
                </div>
              ))}
              <div className="mt-6">
                <table className="w-full table-auto border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-gray-600 text-sm font-medium text-left">General Ledger Code</th>
                      <th className="border border-gray-300 px-4 py-2 text-gray-600 text-sm font-medium text-left">GL Description</th>
                      <th className="border border-gray-300 px-4 py-2 text-gray-600 text-sm font-medium text-left">Credit Amount</th>
                      <th className="border border-gray-300 px-4 py-2 text-gray-600 text-sm font-medium text-left">Debit Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.transactions.map((transaction, index) => (
                      <tr key={index} className="bg-gray-50 odd:bg-white">
                        <td className="border border-gray-300 px-4 py-2 text-gray-600 text-sm">{transaction.generalLedger || '-'}</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-600 text-sm">{transaction.glDescription || '-'}</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-600 text-sm">{transaction.transactionAmount || '0'}</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-600 text-sm">{transaction.debitAmount || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td colSpan={2} className="border border-gray-300 px-4 py-2 text-gray-600 text-sm text-left">Total</td>
                      <td className="border border-gray-300 px-4 py-2 text-gray-600 text-sm">{totalCredit}</td>
                      <td className="border border-gray-300 px-4 py-2 text-gray-600 text-sm">{totalDebit}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-8">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-red-500 text-white text-sm font-semibold rounded-full shadow-md hover:bg-red-600 hover:shadow-lg transition-shadow"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-medium rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                disabled={isSubmitting || isLoadingId || !!idError || !isBalanced}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default JournalForm;