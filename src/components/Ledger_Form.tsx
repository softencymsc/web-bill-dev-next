/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useContext, useRef } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-hot-toast';
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from 'next/navigation';

interface LedgerFormProps {
  page: string;
  onSubmit?: (formData: FormData) => void;
}

interface FormData {
  glCode: string;
  description: string;
  openingValue: string;
  plBalanceSheet: 'Profit & Loss' | 'Balance Sheet' | '';
  plSheetGroup: string;
  subGroup: string;
  cashBank: 'Yes' | 'No' | '';
  currency: string;
  cashBankCode: string;
  initialName: string;
  upiName: string;
  upiId: string;
  cashBook: 'Yes' | 'No' | '';
  minimumBalance: string;
  altGlCode: string;
}

interface LedgerData {
  GLCODE: string;
  UPI_NAME: string;
  UPI_ID: string;
}

const LedgerForm: React.FC<LedgerFormProps> = ({ page, onSubmit }) => {
  const [formData, setFormData] = useState<FormData>({
    glCode: '',
    description: '',
    openingValue: '',
    plBalanceSheet: '',
    plSheetGroup: '',
    subGroup: '',
    cashBank: '',
    currency: '',
    cashBankCode: '',
    initialName: '',
    upiName: '',
    upiId: '',
    cashBook: '',
    minimumBalance: '',
    altGlCode: '',
  });
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpiNameAvailable, setIsUpiNameAvailable] = useState<boolean | null>(null);
  const [isUpiIdAvailable, setIsUpiIdAvailable] = useState<boolean | null>(null);
  const { state } = useContext(CounterContext);
  const router = useRouter();
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const fetchLedgerCodes = async (): Promise<LedgerData[]> => {
    try {
      const ledgersRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast");
      const querySnapshot = await getDocs(ledgersRef);
      const data: LedgerData[] = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          GLCODE: docData.GLCODE || '',
          UPI_NAME: docData.UPI_NAME || '',
          UPI_ID: docData.UPI_ID || '',
        });
      });
      return data;
    } catch (error) {
      console.error('Error fetching ledger data:', error);
      throw new Error('Failed to fetch ledger data');
    }
  };

  const generateUniqueGLCode = async (): Promise<string> => {
    const ledgerData = await fetchLedgerCodes();
    const existingCodes = ledgerData.map(item => item.GLCODE);
    const maxRetries = 100;
    const codeLength = 4;
    const characters = '0123456789';
    let retries = 0;

    while (retries < maxRetries) {
      let result = '';
      for (let i = 0; i < codeLength; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      if (!existingCodes.includes(result)) {
        return result;
      }
      retries++;
    }
    throw new Error('Unable to generate a unique GL code after maximum retries');
  };

  const checkUpiAvailability = async (upiName: string, upiId: string) => {
    try {
      const ledgerData = await fetchLedgerCodes();
      const existingUpiNames = ledgerData
        .map(item => item.UPI_NAME.replace(/\s/g, '').toLowerCase())
        .filter(name => name);
      const existingUpiIds = ledgerData
        .map(item => item.UPI_ID.replace(/\s/g, '').toLowerCase())
        .filter(id => id);
      
      setIsUpiNameAvailable(upiName ? !existingUpiNames.includes(upiName.replace(/\s/g, '').toLowerCase()) : null);
      setIsUpiIdAvailable(upiId ? !existingUpiIds.includes(upiId.replace(/\s/g, '').toLowerCase()) : null);
    } catch (error) {
      console.error('Error checking UPI availability:', error);
      setIsUpiNameAvailable(null);
      setIsUpiIdAvailable(null);
      // toast.error('Failed to verify UPI details. Please try again.');
    }
  };

  useEffect(() => {
    const setUniqueCode = async () => {
      setIsLoadingCode(true);
      setCodeError(null);
      try {
        const newCode = await generateUniqueGLCode();
        setFormData((prev) => ({ ...prev, glCode: newCode }));
      } catch (error) {
        console.error('Error generating GL code:', error);
        setCodeError('Failed to generate GL code. Please try again.');
        // toast.error('Failed to generate GL code. Please try again.');
      } finally {
        setIsLoadingCode(false);
      }
    };
    setUniqueCode();
  }, []);

  useEffect(() => {
    if (formData.cashBank === 'Yes' && (formData.upiName || formData.upiId)) {
      checkUpiAvailability(formData.upiName, formData.upiId);
    } else {
      setIsUpiNameAvailable(null);
      setIsUpiIdAvailable(null);
    }
  }, [formData.upiName, formData.upiId, formData.cashBank]);

  useEffect(() => {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.glCode) {
      // toast.error('Invalid GL code.');
      return;
    }
    if (codeError) {
      // toast.error('Cannot submit form due to code generation error.');
      return;
    }
    if (!formData.description) {
      // toast.error('Description is required.');
      return;
    }
    if (!formData.plBalanceSheet) {
      // toast.error('Please select PL/Balance Sheet.');
      return;
    }
    if (!formData.cashBank) {
      // toast.error('Please select Cash Bank.');
      return;
    }
    if (!formData.cashBook) {
      // toast.error('Please select Cash Book.');
      return;
    }
    if (formData.cashBank === 'Yes' && formData.minimumBalance && isNaN(Number(formData.minimumBalance))) {
      // toast.error('Minimum Balance must be a valid number.');
      return;
    }
    if (formData.openingValue && isNaN(Number(formData.openingValue))) {
      // toast.error('Opening Value must be a valid number.');
      return;
    }
    if (formData.cashBank === 'Yes' && formData.upiName && isUpiNameAvailable === false) {
      // toast.error('UPI Name already exists (case-insensitive and ignoring spaces).');
      return;
    }
    if (formData.cashBank === 'Yes' && formData.upiId && isUpiIdAvailable === false) {
      // toast.error('UPI ID already exists (case-insensitive and ignoring spaces).');
      return;
    }

    setIsSubmitting(true);
    try {
      const ledgersRef = collection(db, "TenantsDb", state.tenantId, 'GL_Mast');
      const ledgerData = {
        GLCODE: formData.glCode || '',
        DESCRIPT: formData.description || '',
        OPENING_VALUE: Number(formData.openingValue) || 0,
        PL_BALANCE_SHEET: formData.plBalanceSheet || '',
        PL_BALANCE_GROUP: formData.plSheetGroup || '',
        SUB_GROUP: formData.subGroup || '',
        CASH_BANK: formData.cashBank || '',
        CURRENCY: formData.cashBank === 'Yes' ? formData.currency || '' : '',
        CASH_BANK_CODE: formData.cashBank === 'Yes' ? formData.cashBankCode || '' : '',
        INITIAL_NAME: formData.cashBank === 'Yes' ? formData.initialName || '' : '',
        UPI_NAME: formData.cashBank === 'Yes' ? formData.upiName || '' : '',
        UPI_ID: formData.cashBank === 'Yes' ? formData.upiId || '' : '',
        CASH_BOOK: formData.cashBook || '',
        MINIMUM_BALANCE: formData.cashBank === 'Yes' ? Number(formData.minimumBalance) || 0 : 0,
        ALT_GL_CODE: formData.altGlCode || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(ledgersRef, ledgerData);
      toast.success('Ledger data saved successfully to GL_Mast!');
      if (onSubmit) {
        onSubmit(formData);
      }
      setFormData({
        glCode: '',
        description: '',
        openingValue: '',
        plBalanceSheet: '',
        plSheetGroup: '',
        subGroup: '',
        cashBank: '',
        currency: '',
        cashBankCode: '',
        initialName: '',
        upiName: '',
        upiId: '',
        cashBook: '',
        minimumBalance: '',
        altGlCode: '',
      });
      const newCode = await generateUniqueGLCode();
      setFormData((prev) => ({ ...prev, glCode: newCode }));
    } catch (error: any) {
      console.error('Error saving ledger data to GL_Mast:', error);
      // toast.error(`Failed to save ledger data: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      glCode: formData.glCode,
      description: '',
      openingValue: '',
      plBalanceSheet: '',
      plSheetGroup: '',
      subGroup: '',
      cashBank: '',
      currency: '',
      cashBankCode: '',
      initialName: '',
      upiName: '',
      upiId: '',
      cashBook: '',
      minimumBalance: '',
      altGlCode: '',
    });
    setIsUpiNameAvailable(null);
    setIsUpiIdAvailable(null);
  };

  const handleCancel = () => {
    router.push('/master/ledger');
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <main className="w-full max-w-5xl bg-white rounded-lg overflow-hidden p-6 md:p-8 mx-auto border-2 flex items-center justify-center">
        <form className="w-full" onSubmit={handleSubmit}>
          <h2 className="text-[#2c5aa0] text-xl font-semibold mb-6 text-center">{page}</h2>
          <div className="grid gap-6">
            {/* Row 1: GL Code, Description, Opening Value */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="glCode" className="text-gray-600 text-sm font-medium mb-1 block">
                  GL Code
                </label>
                <input
                  type="text"
                  id="glCode"
                  name="glCode"
                  placeholder="GL Code"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={isLoadingCode ? 'Loading...' : (codeError || formData.glCode)}
                  onChange={handleChange}
                />
                {codeError && <p className="text-red-500 text-xs mt-1">{codeError}</p>}
              </div>
              <div>
                <label htmlFor="description" className="text-gray-600 text-sm font-medium mb-1 block">
                  Description
                </label>
                <input
                  ref={descriptionInputRef}
                  type="text"
                  id="description"
                  name="description"
                  placeholder="Description"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.description}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="openingValue" className="text-gray-600 text-sm font-medium mb-1 block">
                  Opening Value
                </label>
                <input
                  type="number"
                  id="openingValue"
                  name="openingValue"
                  placeholder="Opening Value"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.openingValue}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Row 2: PL/Balance Sheet, PL Sheet Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="plBalanceSheet" className="text-gray-600 text-sm font-medium mb-1 block">
                  PL/Balance Sheet
                </label>
                <select
                  id="plBalanceSheet"
                  name="plBalanceSheet"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.plBalanceSheet}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Select PL/Balance Sheet</option>
                  <option value="Profit & Loss">Profit and Loss</option>
                  <option value="Balance Sheet">Balance Sheet</option>
                </select>
              </div>
              <div>
                <label htmlFor="plSheetGroup" className="text-gray-600 text-sm font-medium mb-1 block">
                  PL Balance Group
                </label>
                <input
                  type="text"
                  id="plSheetGroup"
                  name="plSheetGroup"
                  placeholder="PL Balance Group"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.plSheetGroup}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Row 3: Sub Group, Cash Bank */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="subGroup" className="text-gray-600 text-sm font-medium mb-1 block">
                  Sub Group
                </label>
                <input
                  type="text"
                  id="subGroup"
                  name="subGroup"
                  placeholder="Sub Group"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.subGroup}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="cashBank" className="text-gray-600 text-sm font-medium mb-1 block">
                  Cash Bank
                </label>
                <select
                  id="cashBank"
                  name="cashBank"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.cashBank}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Cash Bank</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
            {/* Conditional Fields for Cash Bank = Yes */}
            {formData.cashBank === 'Yes' && (
              <>
                {/* Row 4: Currency, Cash/Bank Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="currency" className="text-gray-600 text-sm font-medium mb-1 block">
                      Currency
                    </label>
                    <input
                      type="text"
                      id="currency"
                      name="currency"
                      placeholder="Currency"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={formData.currency}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="cashBankCode" className="text-gray-600 text-sm font-medium mb-1 block">
                      Cash/Bank Code
                    </label>
                    <input
                      type="text"
                      id="cashBankCode"
                      name="cashBankCode"
                      placeholder="Cash/Bank Code"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={formData.cashBankCode}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                {/* Row 5: Initial Name, UPI Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="initialName" className="text-gray-600 text-sm font-medium mb-1 block">
                      Initial Name
                    </label>
                    <input
                      type="text"
                      id="initialName"
                      name="initialName"
                      placeholder="Initial Name"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={formData.initialName}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="upiName" className="text-gray-600 text-sm font-medium mb-1 block">
                      UPI Name
                    </label>
                    <input
                      type="text"
                      id="upiName"
                      name="upiName"
                      placeholder="UPI Name"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={formData.upiName}
                      onChange={handleChange}
                    />
                    {formData.upiName && isUpiNameAvailable !== null && (
                      <p className={`text-xs mt-1 ${isUpiNameAvailable ? 'text-green-500' : 'text-red-500'}`}>
                        {isUpiNameAvailable ? 'Available' : 'Not Available'}
                      </p>
                    )}
                  </div>
                </div>
                {/* Row 6: UPI ID, Minimum Balance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="upiId" className="text-gray-600 text-sm font-medium mb-1 block">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      id="upiId"
                      name="upiId"
                      placeholder="UPI ID"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={formData.upiId}
                      onChange={handleChange}
                    />
                    {formData.upiId && isUpiIdAvailable !== null && (
                      <p className={`text-xs mt-1 ${isUpiIdAvailable ? 'text-green-500' : 'text-red-500'}`}>
                        {isUpiIdAvailable ? 'Available' : 'Not Available'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="minimumBalance" className="text-gray-600 text-sm font-medium mb-1 block">
                      Minimum Balance
                    </label>
                    <input
                      type="number"
                      id="minimumBalance"
                      name="minimumBalance"
                      placeholder="Minimum Balance"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                      value={formData.minimumBalance}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            )}
            {/* Row 7: Cash Book, ALT GL Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cashBook" className="text-gray-600 text-sm font-medium mb-1 block">
                  Cash Book
                </label>
                <select
                  id="cashBook"
                  name="cashBook"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.cashBook}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Cash Book</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label htmlFor="altGlCode" className="text-gray-600 text-sm font-medium mb-1 block">
                  ALT GL Code
                </label>
                <input
                  type="text"
                  id="altGlCode"
                  name="altGlCode"
                  placeholder="ALT GL Code"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.altGlCode}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Buttons */}
            <div className="flex xs:justify-center md:justify-end gap-4 mt-8">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-red-500 text-white text-sm font-semibold rounded-full shadow-md hover:bg-red-600 hover:shadow-lg transition-shadow"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 bg-gray-300 text-gray-600 text-sm font-semibold rounded-full shadow-md hover:bg-gray-400 hover:shadow-lg transition-shadow disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                disabled={isSubmitting || isLoadingCode || !!codeError}
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

export default LedgerForm;