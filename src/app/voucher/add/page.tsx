/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useState, useEffect, useContext, Suspense } from "react";
import { toast } from "react-toastify";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  deleteDoc,
  doc,
  DocumentData,
} from "firebase/firestore";
import { db } from "../../../../firebase"; // Adjusted to src/firebase.ts
import Select, { ActionMeta, SingleValue } from "react-select";
import { useRouter, useSearchParams } from "next/navigation";
import { getPrefixForModel } from "@/services"; // Adjusted to src/services/index.ts
import { CounterContext } from "@/lib/CounterContext"; // Adjusted to src/lib/CounterContext.tsx

// Define interfaces
interface GLCode {
  GLCODE: string;
  DESCRIPT: string;
  CASH_BANK?: string;
  CASH_BOOK?: string;
  CASH_BANK_CODE?: string;
  INITIAL_NAME?: string;
}

interface CustomerVendor {
  id: string;
  CUSTCODE?: string;
  NAME?: string;
  CUST_VEND: "C" | "V";
}

interface Voucher {
  id?: string;
  TYPE?: string;
  TRNNO?: string;
  TRN_DATE?: string;
  GLCODE?: string;
  DESCRIPT?: string;
  CASH_BANK?: string;
  CASH_BOOK?: string;
  CASH_BANK_CODE?: string;
  INITIAL_NAME?: string;
  NARRATION?: string;
  PAYEE_R_CODE?: string;
  PAYEE_R_NAME?: string;
  CHEQUE_TRANS_ID?: string;
  CHEQUE_ON?: string;
  CHEQUE_DT?: string;
  AMOUNT?: number | string;
  createdAt?: Date;
}

interface SelectOption {
  value: string;
  label: string;
}

// Utility: Get current date in YYYY-MM-DD format
const getCurrentDate = (): string => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

// Format date for display
const formatDate = (dateString: string): string => {
  if (!dateString || typeof dateString !== "string") return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

const VoucherPage: React.FC = () => {
  const router = useRouter();
  const { state } = useContext(CounterContext);
  console.log("Current tenant ID from context:", state);
  
  const currentTenant: string = state.tenantId;
  const searchParams = useSearchParams();

  const [glCodes, setGlCodes] = useState<GLCode[]>([]);
  const [cashBankGlCodes, setCashBankGlCodes] = useState<GLCode[]>([]);
  const [vendors, setVendors] = useState<CustomerVendor[]>([]);
  const [customers, setCustomers] = useState<CustomerVendor[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Voucher, string>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [voucherNumberLoading, setVoucherNumberLoading] = useState<boolean>(false);

  // State for new voucher form
  const [newVoucher, setNewVoucher] = useState<Voucher>({
    TYPE: "",
    TRNNO: "",
    TRN_DATE: getCurrentDate(),
    GLCODE: "",
    DESCRIPT: "",
    CASH_BANK: "",
    CASH_BOOK: "",
    CASH_BANK_CODE: "",
    INITIAL_NAME: "",
    NARRATION: "",
    PAYEE_R_CODE: "",
    PAYEE_R_NAME: "",
    CHEQUE_TRANS_ID: "",
    CHEQUE_ON: "",
    CHEQUE_DT: getCurrentDate(),
    AMOUNT: "",
  });

  // Compute label and placeholder for PAYEE_R based on TYPE
  const payeeLabel: string = newVoucher.TYPE === "Receipt" ? "Receipt From" : "Pay To";
  const payeeCodePlaceholder: string = newVoucher.TYPE === "Receipt" ? "Receipt From Code" : "Pay To Code";
  const payeeNamePlaceholder: string = newVoucher.TYPE === "Receipt" ? "Receipt From Name" : "Pay To Name";

  // Fetch GL Codes from GL_Mast
  useEffect(() => {
    const fetchGlData = async () => {
      try {
        console.log("Fetching GL data for tenant:", currentTenant);
        const q = query(collection(db, `TenantsDb/${currentTenant}/GL_Mast`));
        const querySnapshot = await getDocs(q);
        const codes: GLCode[] = querySnapshot.docs.map((doc: DocumentData) => ({
          GLCODE: doc.data().GLCODE,
          DESCRIPT: doc.data().DESCRIPT,
          CASH_BANK: doc.data().CASH_BANK || "No",
          CASH_BOOK: doc.data().CASH_BOOK || "",
          CASH_BANK_CODE: doc.data().CASH_BANK_CODE || "",
          INITIAL_NAME: doc.data().INITIAL_NAME || "",
        }));
        setGlCodes(codes);
        const cashBankCodes = codes.filter((gl) => gl.CASH_BANK === "Yes");
        setCashBankGlCodes(cashBankCodes);
        console.log("GL Codes fetched:", codes);
        console.log("Cash/Bank GL Codes:", cashBankGlCodes);
      } catch (error) {
        // toast.error("Failed to fetch GL data.");
        console.error("Error fetching GL codes:", error);
      }
    };
    fetchGlData();
  }, [currentTenant]);

  // Fetch voucher number
  useEffect(() => {
    const fetchVoucherNumber = async () => {
      if (newVoucher.TYPE) {
        setVoucherNumberLoading(true);
        try {
          console.log("Generating voucher number for type:", newVoucher.TYPE);
          const newTRNNO = await generateVoucherNumber();
          console.log("Generated voucher number:", newTRNNO);
          setNewVoucher((prev) => ({ ...prev, TRNNO: newTRNNO }));
        } catch (error) {
          console.error("Failed to generate voucher number:", error);
          setNewVoucher((prev) => ({ ...prev, TRNNO: "V00001" }));
          // toast.error("Failed to generate voucher number.");
        } finally {
          setVoucherNumberLoading(false);
        }
      } else {
        console.log("No voucher type selected, skipping voucher number generation");
      }
    };
    fetchVoucherNumber();
  }, [newVoucher.TYPE, currentTenant]);

  // Fetch vendor details (only where CUST_VEND === "V")
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        console.log("Fetching vendors for tenant:", currentTenant);
        const q = query(
          collection(db, `TenantsDb/${currentTenant}/Customers`),
          where("CUST_VEND", "==", "V")
        );
        const querySnapshot = await getDocs(q);
        const vendorList: CustomerVendor[] = querySnapshot.docs.map((doc: DocumentData) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setVendors(vendorList);
        console.log("Vendors fetched:", vendorList);
      } catch (error) {
        // toast.error("Failed to fetch vendors.");
        console.error("Error fetching vendors:", error);
      }
    };
    fetchVendors();
  }, [currentTenant]);

  // Fetch customer details (only where CUST_VEND === "C")
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        console.log("Fetching customers for tenant:", currentTenant);
        const q = query(
          collection(db, `TenantsDb/${currentTenant}/Customers`),
          where("CUST_VEND", "==", "C")
        );
        const querySnapshot = await getDocs(q);
        const customerList: CustomerVendor[] = querySnapshot.docs.map((doc: DocumentData) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCustomers(customerList);
        console.log("Customers fetched:", customerList);
      } catch (error) {
        // toast.error("Failed to fetch customers.");
        console.error("Error fetching customers:", error);
      }
    };
    fetchCustomers();
  }, [currentTenant]);

  // Fetch vouchers from TRNS1
  useEffect(() => {
    const fetchVouchers = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching vouchers for tenant:", currentTenant);
        const q = query(
          collection(db, `TenantsDb/${currentTenant}/TRNS1`),
          orderBy("TRNNO", "desc")
        );
        const querySnapshot = await getDocs(q);
        const vouchersData: Voucher[] = querySnapshot.docs.map((doc: DocumentData) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setVouchers(vouchersData);
        console.log("Vouchers fetched:", vouchersData);
      } catch (error) {
        console.error("Error fetching vouchers:", error);
        // toast.error("Failed to fetch vouchers.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchVouchers();
  }, [currentTenant]);

  // Handle updated voucher from query params
  useEffect(() => {
    const updatedVoucher = searchParams?.get("updatedVoucher");
    if (updatedVoucher) {
      try {
        console.log("Processing updated voucher from query params");
        const voucher = JSON.parse(decodeURIComponent(updatedVoucher));
        setVouchers((prevData) =>
          prevData.map((item) => (item.id === voucher.id ? voucher : item))
        );
        router.replace("/voucher/add", { scroll: false });
        console.log("Updated vouchers list:", vouchers);
      } catch (error) {
        console.error("Error parsing updated voucher:", error);
      }
    }
  }, [searchParams, router, vouchers]);

  // Get document prefix
  const getDOCnum = async (): Promise<string> => {
    try {
      console.log("Fetching prefix for Voucher model, tenant:", state.tenantId);
      const prefix = await getPrefixForModel(state.tenantId, "Voucher");
      console.log("Prefix fetched:", prefix);
      return prefix || "V";
    } catch (error) {
      console.error("Error fetching prefix:", error);
      return "V";
    }
  };

  // Generate voucher number
  const generateVoucherNumber = async (): Promise<string> => {
    try {
      const prefix = await getDOCnum();
      console.log("Using prefix for voucher number:", prefix);
      const q = query(
        collection(db, `TenantsDb/${state.tenantId}/TRNS1`),
        orderBy("TRNNO", "desc")
      );
      const querySnapshot = await getDocs(q);
      const voucherNumbers = querySnapshot.docs
        .map((doc) => {
          const trnno = doc.data().TRNNO;
          if (typeof trnno !== "string" || !trnno.startsWith(prefix)) {
            return NaN;
          }
          const numPart = trnno.replace(prefix, "").replace(/[^0-9]/g, "");
          const num = parseInt(numPart, 10);
          return isNaN(num) ? NaN : num;
        })
        .filter((num: number) => !isNaN(num));
      const maxNumber = voucherNumbers.length > 0 ? Math.max(...voucherNumbers) : 0;
      const newNumber = String(maxNumber + 1).padStart(5, "0");
      const newVoucherNumber = `${prefix}${newNumber}`;
      console.log("Generated new voucher number:", newVoucherNumber);
      return newVoucherNumber;
    } catch (error) {
      console.error("Error generating voucher number:", error);
      // toast.error("Failed to generate voucher number. Using fallback.");
      const fallbackNumber = `V${String(Date.now()).slice(-5)}`;
      console.log("Using fallback voucher number:", fallbackNumber);
      return fallbackNumber;
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof Voucher, string>> = {};
    if (!newVoucher.TYPE) newErrors.TYPE = "Type is required";
    if (!newVoucher.TRN_DATE) newErrors.TRN_DATE = "Voucher Date is required";
    if (!newVoucher.GLCODE) newErrors.GLCODE = "GL Code is required";
    if (!newVoucher.CASH_BANK) newErrors.CASH_BANK = "Cash/Bank is required";
    if (newVoucher.GLCODE === "5000" && !newVoucher.PAYEE_R_CODE) {
      newErrors.PAYEE_R_CODE = `${payeeLabel} Code is required`;
    }
    if (newVoucher.GLCODE === "1301" && !newVoucher.PAYEE_R_CODE) {
      newErrors.PAYEE_R_CODE = "Vendor Code is required";
    }
    if ((newVoucher.GLCODE === "1101" || newVoucher.GLCODE === "2301") && !newVoucher.PAYEE_R_CODE) {
      newErrors.PAYEE_R_CODE = "Customer Code is required";
    }
    if (!newVoucher.AMOUNT) {
      newErrors.AMOUNT = "Amount is required";
    } else if (parseFloat(newVoucher.AMOUNT.toString()) <= 0) {
      newErrors.AMOUNT = "Amount must be a positive number";
    }
    if (!newVoucher.TRNNO || newVoucher.TRNNO === "Generating...") {
      newErrors.TRNNO = "Voucher number is not generated";
    }
    if (
      newVoucher.CASH_BANK === "Yes" &&
      newVoucher.CASH_BOOK === "No" &&
      newVoucher.TYPE === "Payment"
    ) {
      if (!newVoucher.CHEQUE_TRANS_ID)
        newErrors.CHEQUE_TRANS_ID = "Cheque No / Trans ID is required";
      if (!newVoucher.CHEQUE_ON) newErrors.CHEQUE_ON = "Drawn On is required";
      if (!newVoucher.CHEQUE_DT) newErrors.CHEQUE_DT = "Cheque Date is required";
    }
    setErrors(newErrors);
    console.log("Form validation errors:", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`Input change - ${name}:`, value);
    if (name === "CASH_BANK") {
      const selectedGl = cashBankGlCodes.find((gl) => gl.GLCODE === value);
      setNewVoucher((prev: Voucher) => ({
        ...prev,
        CASH_BANK: value,
        CASH_BANK_CODE: selectedGl ? selectedGl.DESCRIPT : "",
        INITIAL_NAME: selectedGl ? selectedGl.INITIAL_NAME : "",
      }));
      setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
        ...prev,
        CASH_BANK: "",
        CASH_BANK_CODE: "",
        INITIAL_NAME: "",
      }));
    } else if (name === "PAYEE_R_CODE") {
      let payeeName = "";
      if (newVoucher.GLCODE === "5000") {
        const selectedGl = cashBankGlCodes.find((gl) => gl.GLCODE === value);
        payeeName = selectedGl ? selectedGl.DESCRIPT : "";
      } else if (newVoucher.GLCODE === "1301") {
        const selectedVendor = vendors.find((v) => v.id === value);
        payeeName = selectedVendor ? selectedVendor.NAME || "" : "";
      } else if (newVoucher.GLCODE === "1101" || newVoucher.GLCODE === "2301") {
        const selectedCustomer = customers.find((c) => c.id === value);
        payeeName = selectedCustomer ? selectedCustomer.NAME || "" : "";
      } else {
        payeeName = newVoucher.PAYEE_R_NAME || "";
      }
      setNewVoucher((prev: Voucher) => ({
        ...prev,
        PAYEE_R_CODE: value,
        PAYEE_R_NAME: payeeName,
      }));
      setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
        ...prev,
        PAYEE_R_CODE: "",
        PAYEE_R_NAME: "",
      }));
    } else if (name === "AMOUNT") {
      const numValue = parseFloat(value);
      setNewVoucher((prev: Voucher) => ({
        ...prev,
        [name]: isNaN(numValue) ? "" : numValue,
      }));
      setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
        ...prev,
        [name]: "",
      }));
    } else {
      setNewVoucher((prev: Voucher) => ({ ...prev, [name]: value }));
      setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Handle react-select change for Vendor
  const handleVendorChange = (newValue: SingleValue<SelectOption>, _actionMeta: ActionMeta<SelectOption>) => {
    console.log("Vendor selected:", newValue);
    const selectedVendor = vendors.find((v) => v.id === newValue?.value);
    setNewVoucher((prev: Voucher) => ({
      ...prev,
      PAYEE_R_CODE: newValue?.value ?? "",
      PAYEE_R_NAME: selectedVendor ? selectedVendor.NAME ?? "" : "",
    }));
    setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
      ...prev,
      PAYEE_R_CODE: "",
      PAYEE_R_NAME: "",
    }));
  };

  // Handle react-select change for Customer
  const handleCustomerChange = (newValue: SingleValue<SelectOption>, _actionMeta: ActionMeta<SelectOption>) => {
    console.log("Customer selected:", newValue);
    const selectedCustomer = customers.find((c) => c.id === newValue?.value);
    setNewVoucher((prev: Voucher) => ({
      ...prev,
      PAYEE_R_CODE: newValue?.value ?? "",
      PAYEE_R_NAME: selectedCustomer ? selectedCustomer.NAME ?? "" : "",
    }));
    setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
      ...prev,
      PAYEE_R_CODE: "",
      PAYEE_R_NAME: "",
    }));
  };

  // Add new voucher
  const handleAddVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const newTRNNO = await generateVoucherNumber();
      console.log("Adding voucher with TRNNO:", newTRNNO);
      const voucherData: Omit<Voucher, "id"> = {
        TYPE: newVoucher.TYPE,
        TRNNO: newTRNNO,
        TRN_DATE: newVoucher.TRN_DATE,
        GLCODE: newVoucher.GLCODE,
        DESCRIPT: newVoucher.DESCRIPT,
        CASH_BANK: newVoucher.CASH_BANK,
        CASH_BOOK: newVoucher.CASH_BOOK,
        CASH_BANK_CODE: newVoucher.CASH_BANK_CODE,
        INITIAL_NAME: newVoucher.INITIAL_NAME,
        NARRATION: newVoucher.NARRATION,
        PAYEE_R_CODE: newVoucher.PAYEE_R_CODE,
        PAYEE_R_NAME: newVoucher.PAYEE_R_NAME,
        CHEQUE_TRANS_ID: newVoucher.CHEQUE_TRANS_ID,
        CHEQUE_ON: newVoucher.CHEQUE_ON,
        CHEQUE_DT: newVoucher.CHEQUE_DT,
        AMOUNT: parseFloat((newVoucher.AMOUNT ?? 0).toString()),
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, `TenantsDb/${currentTenant}/TRNS1`), voucherData);
      setVouchers((prev) => [{ id: docRef.id, ...voucherData }, ...prev]);
      setNewVoucher({
        TYPE: "",
        TRNNO: "",
        TRN_DATE: getCurrentDate(),
        GLCODE: "",
        DESCRIPT: "",
        CASH_BANK: "",
        CASH_BOOK: "",
        CASH_BANK_CODE: "",
        INITIAL_NAME: "",
        NARRATION: "",
        PAYEE_R_CODE: "",
        PAYEE_R_NAME: "",
        CHEQUE_TRANS_ID: "",
        CHEQUE_ON: "",
        CHEQUE_DT: getCurrentDate(),
        AMOUNT: "",
      });
      setErrors({});
      toast.success("Voucher added successfully!");
      console.log("Voucher added successfully:", voucherData);
    } catch (error) {
      // toast.error("Failed to add voucher.");
      console.error("Error adding voucher:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete voucher
  const deleteVoucher = async (id: string) => {
    if (window.confirm("Are you sure that you want to delete this Voucher?")) {
      try {
        console.log("Deleting voucher with id:", id);
        await deleteDoc(doc(db, `TenantsDb/${currentTenant}/TRNS1`, id));
        setVouchers(vouchers.filter((item) => item.id !== id));
        toast.success("Voucher deleted successfully!");
        console.log("Voucher deleted successfully, id:", id);
      } catch (error) {
        console.error("Error deleting voucher:", error);
        // toast.error("Failed to delete voucher.");
      }
    }
  };

  // Navigate to edit voucher
  const handleUpdate = (id: string) => {
    console.log("Navigating to edit voucher with id:", id);
    const voucher = vouchers.find((item) => item.id === id);
    const encodedVoucher = encodeURIComponent(JSON.stringify(voucher));
    router.push(`/voucher/edit/${id}?voucher=${encodedVoucher}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white shadow-lg rounded-lg p-8 mb-6">
        <h3 className="text-2xl font-semibold text-gray-800 mb-6">Add New Voucher</h3>
        {glCodes.length === 0 && (
          <p className="text-red-500 mb-4">
            No GL Codes available. Please create a General Ledger first in{" "}
            <a href="/master/generalLedger" className="text-blue-600 hover:underline">
              General Ledger
            </a>.
          </p>
        )}
        {cashBankGlCodes.length === 0 && (
          <p className="text-red-500 mb-4">
            No Cash/Bank GL Codes available. Please ensure General Ledger has accounts marked as Cash/Bank.
          </p>
        )}
        <form onSubmit={handleAddVoucher} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="TYPE" className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                name="TYPE"
                value={newVoucher.TYPE}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
                disabled={isLoading || glCodes.length === 0}
              >
                <option value="" disabled>
                  Select Type
                </option>
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
              </select>
              {errors.TYPE && <p className="text-red-500 text-sm mt-1">{errors.TYPE}</p>}
            </div>
            <div>
              <label htmlFor="TRNNO" className="block text-sm font-medium text-gray-700 mb-1">
                Voucher No
              </label>
              <input
                type="text"
                name="TRNNO"
                value={voucherNumberLoading ? "Generating..." : newVoucher.TRNNO || "Waiting..."}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
              {errors.TRNNO && <p className="text-red-500 text-sm mt-1">{errors.TRNNO}</p>}
            </div>
            <div>
              <label htmlFor="TRN_DATE" className="block text-sm font-medium text-gray-700 mb-1">
                Voucher Date
              </label>
              <input
                type="date"
                name="TRN_DATE"
                value={newVoucher.TRN_DATE}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
                disabled={isLoading || glCodes.length === 0}
              />
              {errors.TRN_DATE && <p className="text-red-500 text-sm mt-1">{errors.TRN_DATE}</p>}
            </div>
            <div>
              <label htmlFor="GLCODE" className="block text-sm font-medium text-gray-700 mb-1">
                GL Code
              </label>
              {newVoucher.GLCODE ? (
                <input
                  type="text"
                  value={newVoucher.GLCODE}
                  readOnly
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-pointer"
                  onClick={() => setNewVoucher((prev) => ({ ...prev, GLCODE: "", DESCRIPT: "", CASH_BANK: "", CASH_BOOK: "", CASH_BANK_CODE: "", INITIAL_NAME: "" }))}
                  title="Click to change"
                />
              ) : (
                <select
                  name="GLCODE"
                  value={newVoucher.GLCODE}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                  disabled={isLoading || glCodes.length === 0}
                >
                  <option value="" disabled>
                    Select GL Code
                  </option>
                  {glCodes.map((gl: GLCode) => (
                    <option key={gl.GLCODE} value={gl.GLCODE}>
                      {gl.GLCODE} - {gl.DESCRIPT}
                    </option>
                  ))}
                </select>
              )}
              {errors.GLCODE && <p className="text-red-500 text-sm mt-1">{errors.GLCODE}</p>}
            </div>
            <div>
              <label htmlFor="DESCRIPT" className="block text-sm font-medium text-gray-700 mb-1">
                GL Description
              </label>
              <input
                type="text"
                name="DESCRIPT"
                value={glCodes.find((gl) => gl.GLCODE === newVoucher.GLCODE)?.DESCRIPT || ""}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="CASH_BANK" className="block text-sm font-medium text-gray-700 mb-1">
                Cash/Bank Code
              </label>
              {newVoucher.CASH_BANK ? (
                <input
                  type="text"
                  value={newVoucher.CASH_BANK}
                  readOnly
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-pointer"
                  onClick={() => setNewVoucher((prev) => ({ ...prev, CASH_BANK: "", CASH_BANK_CODE: "", INITIAL_NAME: "" }))}
                  title="Click to change"
                />
              ) : (
                <select
                  name="CASH_BANK"
                  value={newVoucher.CASH_BANK}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                  disabled={isLoading || glCodes.length === 0 || cashBankGlCodes.length === 0}
                >
                  <option value="" disabled>
                    Select Cash/Bank Code
                  </option>
                  {cashBankGlCodes.map((gl: GLCode) => (
                    <option key={gl.GLCODE} value={gl.GLCODE}>
                      {gl.GLCODE} - {gl.DESCRIPT}
                    </option>
                  ))}
                </select>
              )}
              {errors.CASH_BANK && <p className="text-red-500 text-sm mt-1">{errors.CASH_BANK}</p>}
            </div>
            <div>
              <label htmlFor="CASH_BANK_CODE" className="block text-sm font-medium text-gray-700 mb-1">
                Cash/Bank Description
              </label>
              <input
                type="text"
                name="CASH_BANK_CODE"
                value={newVoucher.CASH_BANK_CODE}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="PAYEE_R_CODE" className="block text-sm font-medium text-gray-700 mb-1">
                {payeeLabel} Code
              </label>
              {newVoucher.PAYEE_R_CODE && (newVoucher.GLCODE === "1301" || newVoucher.GLCODE === "1101" || newVoucher.GLCODE === "2301" || newVoucher.GLCODE === "5000") ? (
                <input
                  type="text"
                  value={
                    newVoucher.GLCODE === "1301"
                      ? vendors.find((v) => v.id === newVoucher.PAYEE_R_CODE)?.CUSTCODE || newVoucher.PAYEE_R_CODE
                      : newVoucher.GLCODE === "1101" || newVoucher.GLCODE === "2301"
                      ? customers.find((c) => c.id === newVoucher.PAYEE_R_CODE)?.CUSTCODE || newVoucher.PAYEE_R_CODE
                      : newVoucher.PAYEE_R_CODE
                  }
                  readOnly
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-pointer"
                  onClick={() => setNewVoucher((prev) => ({ ...prev, PAYEE_R_CODE: "", PAYEE_R_NAME: "" }))}
                  title="Click to change"
                />
              ) : newVoucher.GLCODE === "1301" ? (
                <Select
                  name="PAYEE_R_CODE"
                  value={
                    newVoucher.PAYEE_R_CODE
                      ? {
                          value: newVoucher.PAYEE_R_CODE,
                          label: vendors.find((v: CustomerVendor) => v.id === newVoucher.PAYEE_R_CODE)?.CUSTCODE
                            ? `${vendors.find((v: CustomerVendor) => v.id === newVoucher.PAYEE_R_CODE)!.CUSTCODE} - ${vendors.find((v: CustomerVendor) => v.id === newVoucher.PAYEE_R_CODE)!.NAME || ""}`
                            : newVoucher.PAYEE_R_CODE,
                        }
                      : null
                  }
                  onChange={handleVendorChange}
                  options={vendors.map((vendor: CustomerVendor) => ({
                    value: vendor.id,
                    label: vendor.CUSTCODE ? `${vendor.CUSTCODE} - ${vendor.NAME || vendor.id}` : `${vendor.id} - ${vendor.NAME || ""}`,
                  }))}
                  isDisabled={isLoading || vendors.length === 0}
                  placeholder="Select Vendor Code"
                  isClearable
                  className="w-full"
                  classNamePrefix="react-select"
                />
              ) : newVoucher.GLCODE === "1101" || newVoucher.GLCODE === "2301" ? (
                <Select
                  name="PAYEE_R_CODE"
                  value={
                    newVoucher.PAYEE_R_CODE
                      ? {
                          value: newVoucher.PAYEE_R_CODE,
                          label: customers.find((c: CustomerVendor) => c.id === newVoucher.PAYEE_R_CODE)?.CUSTCODE
                            ? `${customers.find((c: CustomerVendor) => c.id === newVoucher.PAYEE_R_CODE)!.CUSTCODE} - ${customers.find((c: CustomerVendor) => c.id === newVoucher.PAYEE_R_CODE)!.NAME || ""}`
                            : newVoucher.PAYEE_R_CODE,
                        }
                      : null
                  }
                  onChange={handleCustomerChange}
                  options={customers.map((customer: CustomerVendor) => ({
                    value: customer.id,
                    label: customer.CUSTCODE ? `${customer.CUSTCODE} - ${customer.NAME || customer.id}` : `${customer.id} - ${customer.NAME || ""}`,
                  }))}
                  isDisabled={isLoading || customers.length === 0}
                  placeholder="Select Customer Code"
                  isClearable
                  className="w-full"
                  classNamePrefix="react-select"
                />
              ) : newVoucher.GLCODE === "5000" ? (
                <select
                  name="PAYEE_R_CODE"
                  value={newVoucher.PAYEE_R_CODE}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                  disabled={isLoading || cashBankGlCodes.length === 0}
                >
                  <option value="" disabled>
                    Select {payeeLabel} Code
                  </option>
                  {cashBankGlCodes.map((gl: GLCode) => (
                    <option key={gl.GLCODE} value={gl.GLCODE}>
                      {gl.GLCODE} - {gl.DESCRIPT}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="PAYEE_R_CODE"
                  value={newVoucher.PAYEE_R_CODE}
                  onChange={handleInputChange}
                  placeholder={payeeCodePlaceholder}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={isLoading}
                />
              )}
              {errors.PAYEE_R_CODE && <p className="text-red-500 text-sm mt-1">{errors.PAYEE_R_CODE}</p>}
            </div>
            <div>
              <label htmlFor="PAYEE_R_NAME" className="block text-sm font-medium text-gray-700 mb-1">
                {payeeLabel} Name
              </label>
              <input
                type="text"
                name="PAYEE_R_NAME"
                value={newVoucher.PAYEE_R_NAME}
                onChange={handleInputChange}
                placeholder={payeeNamePlaceholder}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isLoading || newVoucher.GLCODE === "1301" || newVoucher.GLCODE === "1101" || newVoucher.GLCODE === "2301" || newVoucher.GLCODE === "5000"}
              />
              {errors.PAYEE_R_NAME && <p className="text-red-500 text-sm mt-1">{errors.PAYEE_R_NAME}</p>}
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label htmlFor="NARRATION" className="block text-sm font-medium text-gray-700 mb-1">
                Narration
              </label>
              <input
                type="text"
                name="NARRATION"
                value={newVoucher.NARRATION}
                onChange={handleInputChange}
                placeholder="Narration"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isLoading || glCodes.length === 0}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="CHEQUE_TRANS_ID" className="block text-sm font-medium text-gray-700 mb-1">
                Cheque No / Trans ID
              </label>
              <input
                type="text"
                name="CHEQUE_TRANS_ID"
                value={newVoucher.CHEQUE_TRANS_ID}
                onChange={handleInputChange}
                placeholder="Cheque No / Trans ID"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isLoading}
              />
              {errors.CHEQUE_TRANS_ID && <p className="text-red-500 text-sm mt-1">{errors.CHEQUE_TRANS_ID}</p>}
            </div>
            <div>
              <label htmlFor="CHEQUE_ON" className="block text-sm font-medium text-gray-700 mb-1">
                Drawn On
              </label>
              <input
                type="text"
                name="CHEQUE_ON"
                value={newVoucher.CHEQUE_ON}
                onChange={handleInputChange}
                placeholder="Drawn On"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isLoading}
              />
              {errors.CHEQUE_ON && <p className="text-red-500 text-sm mt-1">{errors.CHEQUE_ON}</p>}
            </div>
            <div>
              <label htmlFor="CHEQUE_DT" className="block text-sm font-medium text-gray-700 mb-1">
                Cheque Date
              </label>
              <input
                type="date"
                name="CHEQUE_DT"
                value={newVoucher.CHEQUE_DT}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isLoading}
              />
              {errors.CHEQUE_DT && <p className="text-red-500 text-sm mt-1">{errors.CHEQUE_DT}</p>}
            </div>
            <div>
              <label htmlFor="AMOUNT" className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                name="AMOUNT"
                value={newVoucher.AMOUNT || ""}
                onChange={handleInputChange}
                placeholder="Amount"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
                min="0.01"
                step="0.01"
                disabled={isLoading || glCodes.length === 0}
              />
              {errors.AMOUNT && <p className="text-red-500 text-sm mt-1">{errors.AMOUNT}</p>}
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => {
                setErrors({});
                setNewVoucher({
                  TYPE: "",
                  TRNNO: "",
                  TRN_DATE: getCurrentDate(),
                  GLCODE: "",
                  DESCRIPT: "",
                  CASH_BANK: "",
                  CASH_BOOK: "",
                  CASH_BANK_CODE: "",
                  INITIAL_NAME: "",
                  NARRATION: "",
                  PAYEE_R_CODE: "",
                  PAYEE_R_NAME: "",
                  CHEQUE_TRANS_ID: "",
                  CHEQUE_ON: "",
                  CHEQUE_DT: getCurrentDate(),
                  AMOUNT: "",
                });
                console.log("Form cancelled, resetting state");
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-300 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={isLoading || voucherNumberLoading || glCodes.length === 0 || cashBankGlCodes.length === 0}
            >
              {isLoading ? "Saving..." : "Save Voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Page: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VoucherPage />
    </Suspense>
  );
};

export default Page;