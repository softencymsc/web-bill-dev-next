/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { Suspense, useState, useEffect, useContext } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { CounterContext } from "@/lib/CounterContext";

interface FormData {
  glCode: string;
  description: string;
  openingValue: string;
  plBalanceSheet: 'PL' | 'Balance Sheet' | '';
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
  DESCRIPT: string;
  OPENING_VALUE: number;
  PL_BALANCE_SHEET: 'PL' | 'Balance Sheet' | '';
  PL_BALANCE_GROUP: string;
  SUB_GROUP: string;
  CASH_BANK: 'Yes' | 'No' | '';
  CURRENCY: string;
  CASH_BANK_CODE: string;
  INITIAL_NAME: string;
  UPI_NAME: string;
  UPI_ID: string;
  CASH_BOOK: 'Yes' | 'No' | '';
  MINIMUM_BALANCE: number;
  ALT_GL_CODE: string;
  createdAt?: any;
  updatedAt?: any;
}

const LedgerForm: React.FC = ({ onSubmit, page }: any) => {
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
  const [isEditing, setIsEditing] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [isUpiNameAvailable, setIsUpiNameAvailable] = useState<boolean | null>(null);
  const [isUpiIdAvailable, setIsUpiIdAvailable] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state } = useContext(CounterContext);

  const fetchLedgerCodes = async (): Promise<string[]> => {
    try {
      const ledgersRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast");
      const querySnapshot = await getDocs(ledgersRef);
      const codes: string[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.GLCODE) {
          codes.push(data.GLCODE);
        }
      });
      return codes;
    } catch (error) {
      console.error('Error fetching ledger codes:', error);
      throw new Error('Failed to fetch ledger codes');
    }
  };

  const fetchLedgerDataForUpiCheck = async (): Promise<LedgerData[]> => {
    try {
      const ledgersRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast");
      const querySnapshot = await getDocs(ledgersRef);
      const data: LedgerData[] = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        if (doc.id !== docId) { // Skip the current document when editing
          data.push({
            GLCODE: docData.GLCODE || '',
            DESCRIPT: docData.DESCRIPT || '',
            OPENING_VALUE: docData.OPENING_VALUE || 0,
            PL_BALANCE_SHEET: docData.PL_BALANCE_SHEET || '',
            PL_BALANCE_GROUP: docData.PL_BALANCE_GROUP || '',
            SUB_GROUP: docData.SUB_GROUP || '',
            CASH_BANK: docData.CASH_BANK || '',
            CURRENCY: docData.CURRENCY || '',
            CASH_BANK_CODE: docData.CASH_BANK_CODE || '',
            INITIAL_NAME: docData.INITIAL_NAME || '',
            UPI_NAME: docData.UPI_NAME || '',
            UPI_ID: docData.UPI_ID || '',
            CASH_BOOK: docData.CASH_BOOK || '',
            MINIMUM_BALANCE: docData.MINIMUM_BALANCE || 0,
            ALT_GL_CODE: docData.ALT_GL_CODE || '',
          });
        }
      });
      return data;
    } catch (error) {
      console.error('Error fetching ledger data for UPI check:', error);
      throw new Error('Failed to fetch ledger data');
    }
  };

  const generateUniqueGLCode = async (): Promise<string> => {
    const existingCodes = await fetchLedgerCodes();
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

  const fetchLedgerData = async (glCode: string): Promise<void> => {
    try {
      const ledgersRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast");
      const q = query(ledgersRef, where("GLCODE", "==", glCode));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data() as LedgerData;
        setDocId(doc.id);
        const newFormData: FormData = {
          glCode: data.GLCODE || '',
          description: data.DESCRIPT || '',
          openingValue: data.OPENING_VALUE !== undefined && data.OPENING_VALUE !== null ? String(data.OPENING_VALUE) : '',
          plBalanceSheet: (data.PL_BALANCE_SHEET === 'PL' || data.PL_BALANCE_SHEET === 'Balance Sheet') ? data.PL_BALANCE_SHEET : '',
          plSheetGroup: data.PL_BALANCE_GROUP || '',
          subGroup: data.SUB_GROUP || '',
          cashBank: (data.CASH_BANK === 'Yes' || data.CASH_BANK === 'No') ? data.CASH_BANK : '',
          currency: data.CURRENCY || '',
          cashBankCode: data.CASH_BANK_CODE || '',
          initialName: data.INITIAL_NAME || '',
          upiName: data.UPI_NAME || '',
          upiId: data.UPI_ID || '',
          cashBook: (data.CASH_BOOK === 'Yes' || data.CASH_BOOK === 'No') ? data.CASH_BOOK : '',
          minimumBalance: data.MINIMUM_BALANCE !== undefined && data.MINIMUM_BALANCE !== null ? String(data.MINIMUM_BALANCE) : '',
          altGlCode: data.ALT_GL_CODE || '',
        };
        setFormData(newFormData);
      } else {
        setCodeError('Ledger not found for the provided GL Code.');
        toast.error('Ledger not found for the provided GL Code.');
      }
    } catch (error) {
      console.error('Error fetching ledger data:', error);
      setCodeError('Failed to fetch ledger data. Please try again.');
      // toast.error('Failed to fetch ledger data. Please try again.');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const checkUpiAvailability = async (upiName: string, upiId: string) => {
    try {
      const ledgerData = await fetchLedgerDataForUpiCheck();
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
    const glCode = searchParams?.get('id');
    if (glCode) {
      setIsLoadingCode(true);
      setCodeError(null);
      fetchLedgerData(glCode);
    } else {
      setIsEditing(true);
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
    }
  }, [searchParams]);

  useEffect(() => {
    if (formData.cashBank === 'Yes' && (formData.upiName || formData.upiId)) {
      checkUpiAvailability(formData.upiName, formData.upiId);
    } else {
      setIsUpiNameAvailable(null);
      setIsUpiIdAvailable(null);
    }
  }, [formData.upiName, formData.upiId, formData.cashBank, docId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditToggle = () => {
    setIsEditing(true);
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
        updatedAt: serverTimestamp(),
      };

      if (docId) {
        const ledgerRef = doc(db, "TenantsDb", state.tenantId, "GL_Mast", docId);
        await updateDoc(ledgerRef, ledgerData);
        toast.success('Ledger data updated successfully in GL_Mast!');
        setIsEditing(false);
      } else {
        const ledgersRef = collection(db, "TenantsDb", state.tenantId, "GL_Mast");
        const newDoc = await addDoc(ledgersRef, {
          ...ledgerData,
          createdAt: serverTimestamp(),
        });
        setDocId(newDoc.id);
        toast.success('Ledger data created successfully in GL_Mast!');
        setIsEditing(false);
      }

      if (onSubmit) {
        onSubmit(formData);
      }
    } catch (error: any) {
      console.error('Error saving ledger data to GL_Mast:', error);
      // toast.error(`Failed to save ledger data: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/master/ledger/');
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
      <main className="w-full max-w-4xl bg-white rounded-lg shadow-xl overflow-hidden p-6 md:p-8 mx-auto">
        <form className="w-full" onSubmit={handleSubmit}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[#2c5aa0] text-xl font-semibold">{page || 'Ledger Form'}</h2>
            <div className="flex justify-end gap-4">
              {docId && !isEditing ? (
                <button
                  type="button"
                  onClick={handleEditToggle}
                  className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                  disabled={isLoadingCode || !!codeError}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 bg-red-500 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                    disabled={isLoadingCode || !!codeError || isSubmitting || !isEditing}
                  >
                    {isSubmitting ? 'Updating...' : docId ? 'Update' : 'Create'}
                  </button>
                </>
              )}
            </div>
          </div>
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
                  disabled
                />
                {codeError && <p className="text-red-500 text-xs mt-1">{codeError}</p>}
              </div>
              <div>
                <label htmlFor="description" className="text-gray-600 text-sm font-medium mb-1 block">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  name="description"
                  placeholder="Description"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  disabled={!isEditing}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.openingValue}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>
            {/* Row 2: PL/Balance Sheet, PL Balance Group, Sub Group */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="plBalanceSheet" className="text-gray-600 text-sm font-medium mb-1 block">
                  PL/Balance Sheet
                </label>
                <select
                  id="plBalanceSheet"
                  name="plBalanceSheet"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.plBalanceSheet}
                  onChange={handleChange}
                  required
                  disabled={!isEditing}
                >
                  <option value="" disabled>Select PL/Balance Sheet</option>
                  <option value="PL">Profit and Loss</option>
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.plSheetGroup}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label htmlFor="subGroup" className="text-gray-600 text-sm font-medium mb-1 block">
                  Sub Group
                </label>
                <input
                  type="text"
                  id="subGroup"
                  name="subGroup"
                  placeholder="Sub Group"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.subGroup}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>
            {/* Row 3: Cash Bank, Currency, Cash/Bank Code (Conditional) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cashBank" className="text-gray-600 text-sm font-medium mb-1 block">
                  Cash Bank
                </label>
                <select
                  id="cashBank"
                  name="cashBank"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.cashBank}
                  onChange={handleChange}
                  required
                  disabled={!isEditing}
                >
                  <option value="" disabled>Cash Bank</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              {formData.cashBank === 'Yes' && (
                <>
                  <div>
                    <label htmlFor="currency" className="text-gray-600 text-sm font-medium mb-1 block">
                      Currency
                    </label>
                    <input
                      type="text"
                      id="currency"
                      name="currency"
                      placeholder="Currency"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.currency}
                      onChange={handleChange}
                      disabled={!isEditing}
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
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.cashBankCode}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                </>
              )}
            </div>
            {/* Row 4: Initial Name, UPI Name, UPI ID (Conditional) */}
            {formData.cashBank === 'Yes' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="initialName" className="text-gray-600 text-sm font-medium mb-1 block">
                    Initial Name
                  </label>
                  <input
                    type="text"
                    id="initialName"
                    name="initialName"
                    placeholder="Initial Name"
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                    value={formData.initialName}
                    onChange={handleChange}
                    disabled={!isEditing}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                    value={formData.upiName}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  {formData.upiName && isUpiNameAvailable !== null && (
                    <p className={`text-xs mt-1 ${isUpiNameAvailable ? 'text-green-500' : 'text-red-500'}`}>
                      {isUpiNameAvailable ? 'Available' : 'Not Available'}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="upiId" className="text-gray-600 text-sm font-medium mb-1 block">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    id="upiId"
                    name="upiId"
                    placeholder="UPI ID"
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                    value={formData.upiId}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  {formData.upiId && isUpiIdAvailable !== null && (
                    <p className={`text-xs mt-1 ${isUpiIdAvailable ? 'text-green-500' : 'text-red-500'}`}>
                      {isUpiIdAvailable ? 'Available' : 'Not Available'}
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* Row 5: Cash Book, Minimum Balance (Conditional), ALT GL Code */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cashBook" className="text-gray-600 text-sm font-medium mb-1 block">
                  Cash Book
                </label>
                <select
                  id="cashBook"
                  name="cashBook"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.cashBook}
                  onChange={handleChange}
                  required
                  disabled={!isEditing}
                >
                  <option value="" disabled>Cash Book</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              {formData.cashBank === 'Yes' && (
                <div>
                  <label htmlFor="minimumBalance" className="text-gray-600 text-sm font-medium mb-1 block">
                    Minimum Balance
                  </label>
                  <input
                    type="number"
                    id="minimumBalance"
                    name="minimumBalance"
                    placeholder="Minimum Balance"
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                    value={formData.minimumBalance}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              )}
              <div>
                <label htmlFor="altGlCode" className="text-gray-600 text-sm font-medium mb-1 block">
                  ALT GL Code
                </label>
                <input
                  type="text"
                  id="altGlCode"
                  name="altGlCode"
                  placeholder="ALT GL Code"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.altGlCode}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

const Page = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <LedgerForm />
  </Suspense>
);

export default Page;