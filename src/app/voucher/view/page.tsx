/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useState, useEffect, useContext, ReactNode, Suspense } from "react";
import { toast } from "react-toastify";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  DocumentData,
} from "firebase/firestore";
import { db } from "../../../../firebase";
import Select, { ActionMeta, SingleValue } from "react-select";
import { useRouter, useSearchParams } from "next/navigation";
import { CounterContext } from "@/lib/CounterContext";

// Define interfaces for data structures
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

const VoucherViewPage: React.FC = () => {
  const router = useRouter();
  const { state } = useContext(CounterContext);
  const currentTenant: string = state.tenantId;
  const searchParams = useSearchParams();
  const voucherNo = searchParams?.get("id");

  const [glCodes, setGlCodes] = useState<GLCode[]>([]);
  const [cashBankGlCodes, setCashBankGlCodes] = useState<GLCode[]>([]);
  const [vendors, setVendors] = useState<CustomerVendor[]>([]);
  const [customers, setCustomers] = useState<CustomerVendor[]>([]);
  const [voucher, setVoucher] = useState<Voucher>({
    TYPE: "Payment",
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
  const [errors, setErrors] = useState<Partial<Record<keyof Voucher, string>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(true);

  // Compute label and placeholder for PAYEE_R based on TYPE
  const payeeLabel: string = voucher.TYPE === "Receipt" ? "Receipt From" : "Pay To";
  const payeeCodePlaceholder: string =
    voucher.TYPE === "Receipt" ? "Receipt From Code" : "Pay To Code";
  const payeeNamePlaceholder: string =
    voucher.TYPE === "Receipt" ? "Receipt From Name" : "Pay To Name";

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
        console.log("Cash/Bank GL Codes:", cashBankCodes);
      } catch (error) {
        // toast.error("Failed to fetch GL data.");
        console.error("Error fetching GL codes:", error);
      }
    };
    fetchGlData();
  }, [currentTenant]);

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
        const vendorList: CustomerVendor[] = querySnapshot.docs.map(
          (doc: DocumentData) => ({
            id: doc.id,
            ...doc.data(),
          })
        );
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
        const customerList: CustomerVendor[] = querySnapshot.docs.map(
          (doc: DocumentData) => ({
            id: doc.id,
            ...doc.data(),
          })
        );
        setCustomers(customerList);
        console.log("Customers fetched:", customerList);
      } catch (error) {
        // toast.error("Failed to fetch customers.");
        console.error("Error fetching customers:", error);
      }
    };
    fetchCustomers();
  }, [currentTenant]);

  // Fetch voucher by TRNNO
  useEffect(() => {
    const fetchVoucher = async () => {
      if (!voucherNo) {
        // toast.error("No voucher number provided.");
        setIsFetching(false);
        return;
      }
      setIsFetching(true);
      try {
        console.log("Fetching voucher with TRNNO:", voucherNo);
        const q = query(
          collection(db, `TenantsDb/${currentTenant}/TRNS1`),
          where("TRNNO", "==", voucherNo)
        );
        const querySnapshot = await getDocs(q);
        console.log("TRNS1 data snapshot:", querySnapshot.docs.map(doc => doc.data()));
        if (querySnapshot.empty) {
          // toast.error("Voucher not found.");
          console.log("No voucher found with TRNNO:", voucherNo);
          setIsFetching(false);
          return;
        }
        const voucherData = querySnapshot.docs[0].data() as Voucher;
        const voucherId = querySnapshot.docs[0].id;
        setVoucher({
          id: voucherId,
          TYPE: voucherData.TYPE || "Payment",
          TRNNO: voucherData.TRNNO || "",
          TRN_DATE: voucherData.TRN_DATE || getCurrentDate(),
          GLCODE: voucherData.GLCODE || "",
          DESCRIPT: voucherData.DESCRIPT || "",
          CASH_BANK: voucherData.CASH_BANK || "",
          CASH_BOOK: voucherData.CASH_BOOK || "",
          CASH_BANK_CODE: voucherData.CASH_BANK_CODE || "",
          INITIAL_NAME: voucherData.INITIAL_NAME || "",
          NARRATION: voucherData.NARRATION || "",
          PAYEE_R_CODE: voucherData.PAYEE_R_CODE || "",
          PAYEE_R_NAME: voucherData.PAYEE_R_NAME || "",
          CHEQUE_TRANS_ID: voucherData.CHEQUE_TRANS_ID || "",
          CHEQUE_ON: voucherData.CHEQUE_ON || "",
          CHEQUE_DT: voucherData.CHEQUE_DT || getCurrentDate(),
          AMOUNT: voucherData.AMOUNT || "",
          createdAt: voucherData.createdAt
            ? new Date(voucherData.createdAt)
            : undefined,
        });
        console.log("Voucher fetched:", { id: voucherId, ...voucherData });
      } catch (error) {
        console.error("Error fetching voucher:", error);
        // toast.error("Failed to fetch voucher.");
      } finally {
        setIsFetching(false);
      }
    };
    fetchVoucher();
  }, [voucherNo, currentTenant]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof Voucher, string>> = {};
    if (!voucher.TYPE) newErrors.TYPE = "Type is required";
    if (!voucher.TRN_DATE) newErrors.TRN_DATE = "Voucher Date is required";
    if (!voucher.GLCODE) newErrors.GLCODE = "GL Code is required";
    if (!voucher.CASH_BANK) newErrors.CASH_BANK = "Cash/Bank is required";
    if (
      voucher.CASH_BANK === "Yes" &&
      voucher.CASH_BOOK === "No" &&
      voucher.TYPE === "Payment"
    ) {
      if (!voucher.CHEQUE_TRANS_ID)
        newErrors.CHEQUE_TRANS_ID = "Cheque No / Trans ID is required";
      if (!voucher.CHEQUE_ON) newErrors.CHEQUE_ON = "Drawn On is required";
      if (!voucher.CHEQUE_DT) newErrors.CHEQUE_DT = "Cheque Date is required";
    }
    if (!voucher.AMOUNT) {
      newErrors.AMOUNT = "Amount is required";
    } else if (parseFloat(voucher.AMOUNT.toString()) <= 0) {
      newErrors.AMOUNT = "Amount must be a positive number";
    }
    if (!voucher.TRNNO) newErrors.TRNNO = "Voucher number is required";
    setErrors(newErrors);
    console.log("Form validation errors:", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    console.log(`Input change - ${name}:`, value);
    if (name === "GLCODE") {
      const selectedGl = glCodes.find((gl) => gl.GLCODE === value);
      setVoucher((prev: Voucher) => ({
        ...prev,
        GLCODE: value,
        DESCRIPT: selectedGl ? selectedGl.DESCRIPT : "",
        CASH_BANK: selectedGl ? selectedGl.CASH_BANK : "",
        CASH_BOOK: selectedGl ? selectedGl.CASH_BOOK : "",
        CASH_BANK_CODE:
          selectedGl && selectedGl.CASH_BANK === "Yes"
            ? selectedGl.CASH_BANK_CODE
            : "",
        INITIAL_NAME:
          selectedGl && selectedGl.CASH_BANK === "Yes"
            ? selectedGl.INITIAL_NAME
            : "",
        PAYEE_R_CODE: "",
        PAYEE_R_NAME: "",
      }));
      setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
        ...prev,
        GLCODE: "",
        CASH_BANK: "",
        CASH_BANK_CODE: "",
        INITIAL_NAME: "",
        PAYEE_R_CODE: "",
        PAYEE_R_NAME: "",
      }));
    } else if (name === "AMOUNT") {
      const numValue = parseFloat(value);
      setVoucher((prev: Voucher) => ({
        ...prev,
        [name]: isNaN(numValue) ? "" : numValue,
      }));
      setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
        ...prev,
        [name]: "",
      }));
    } else {
      setVoucher((prev: Voucher) => ({ ...prev, [name]: value }));
      setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Handle react-select change for Vendor
  const handleVendorChange = (
    newValue: SingleValue<SelectOption>,
    _actionMeta: ActionMeta<SelectOption>
  ) => {
    console.log("Vendor selected:", newValue);
    setVoucher((prev: Voucher) => ({
      ...prev,
      PAYEE_R_CODE: newValue?.value ?? "",
      PAYEE_R_NAME: newValue?.value
        ? vendors.find((v: CustomerVendor) => v.id === newValue.value)?.NAME ?? ""
        : "",
    }));
    setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
      ...prev,
      PAYEE_R_CODE: "",
      PAYEE_R_NAME: "",
    }));
  };

  // Handle react-select change for Customer
  const handleCustomerChange = (
    newValue: SingleValue<SelectOption>,
    _actionMeta: ActionMeta<SelectOption>
  ) => {
    console.log("Customer selected:", newValue);
    setVoucher((prev: Voucher) => ({
      ...prev,
      PAYEE_R_CODE: newValue?.value ?? "",
      PAYEE_R_NAME: newValue?.value
        ? customers.find((c: CustomerVendor) => c.id === newValue.value)?.NAME ??
          ""
        : "",
    }));
    setErrors((prev: Partial<Record<keyof Voucher, string>>) => ({
      ...prev,
      PAYEE_R_CODE: "",
      PAYEE_R_NAME: "",
    }));
  };

  // Update voucher
  const handleUpdateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!voucher.id) {
      // toast.error("No voucher ID found.");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Updating voucher with TRNNO:", voucher.TRNNO);
      const voucherData: Omit<Voucher, "id"> = {
        TYPE: voucher.TYPE,
        TRNNO: voucher.TRNNO,
        TRN_DATE: voucher.TRN_DATE,
        GLCODE: voucher.GLCODE,
        DESCRIPT: voucher.DESCRIPT,
        CASH_BANK: voucher.CASH_BANK,
        CASH_BOOK: voucher.CASH_BOOK,
        CASH_BANK_CODE: voucher.CASH_BANK_CODE,
        INITIAL_NAME: voucher.INITIAL_NAME,
        NARRATION: voucher.NARRATION,
        PAYEE_R_CODE: voucher.PAYEE_R_CODE,
        PAYEE_R_NAME: voucher.PAYEE_R_NAME,
        CHEQUE_TRANS_ID: voucher.CHEQUE_TRANS_ID,
        CHEQUE_ON: voucher.CHEQUE_ON,
        CHEQUE_DT: voucher.CHEQUE_DT,
        AMOUNT: parseFloat((voucher.AMOUNT ?? 0).toString()),
        createdAt: voucher.createdAt,
      };

      await updateDoc(
        doc(db, `TenantsDb/${currentTenant}/TRNS1`, voucher.id),
        voucherData
      );
      toast.success("Voucher updated successfully!");
      console.log("Voucher updated successfully:", voucherData);
      router.push(
        "/voucher?updatedVoucher=" +
          encodeURIComponent(JSON.stringify({ id: voucher.id, ...voucherData }))
      );
    } catch (error) {
      console.error("Error updating voucher:", error);
      // toast.error("Failed to update voucher.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    console.log("Cancelling edit, navigating back to voucher list");
    router.push("/voucher");
  };

  if (isFetching) {
    return <p className="text-center my-20">Loading voucher...</p>;
  }

  if (!voucher.TRNNO) {
    return (
      <p className="text-red-500 font-semibold text-center my-20">
        Voucher not found.
      </p>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white shadow-lg rounded-lg p-8 mb-6">
        <h3 className="text-2xl font-semibold text-gray-800 mb-6">
          Edit Voucher: {voucher.TRNNO}
        </h3>
        {glCodes.length === 0 && (
          <p className="text-red-500 mb-4">
            No GL Codes available. Please create a General Ledger first in{" "}
            <a
              href="/master/generalLedger"
              className="text-blue-600 hover:underline"
            >
              General Ledger
            </a>
            .
          </p>
        )}
        {cashBankGlCodes.length === 0 && (
          <p className="text-red-500 mb-4">
            No Cash/Bank GL Codes available. Please ensure General Ledger has
            accounts marked as Cash/Bank.
          </p>
        )}
        <form onSubmit={handleUpdateVoucher} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="TYPE"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Type
              </label>
              <select
                name="TYPE"
                value={voucher.TYPE}
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
              {errors.TYPE && (
                <p className="text-red-500 text-sm mt-1">{errors.TYPE}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="TRNNO"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Voucher No
              </label>
              <input
                type="text"
                name="TRNNO"
                value={voucher.TRNNO}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
              {errors.TRNNO && (
                <p className="text-red-500 text-sm mt-1">{errors.TRNNO}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="TRN_DATE"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Voucher Date
              </label>
              <input
                type="date"
                name="TRN_DATE"
                value={voucher.TRN_DATE}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
                disabled={isLoading || glCodes.length === 0}
              />
              {errors.TRN_DATE && (
                <p className="text-red-500 text-sm mt-1">{errors.TRN_DATE}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="GLCODE"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                GL Code
              </label>
              <select
                name="GLCODE"
                value={voucher.GLCODE}
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
              {errors.GLCODE && (
                <p className="text-red-500 text-sm mt-1">{errors.GLCODE}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="DESCRIPT"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                GL Account
              </label>
              <input
                type="text"
                name="DESCRIPT"
                value={voucher.DESCRIPT}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label
                htmlFor="CASH_BANK"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Cash/Bank
              </label>
              <input
                type="text"
                name="CASH_BANK"
                value={voucher.CASH_BANK}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
              {errors.CASH_BANK && (
                <p className="text-red-500 text-sm mt-1">{errors.CASH_BANK}</p>
              )}
            </div>
            {voucher.CASH_BANK === "Yes" && (
              <>
                <div>
                  <label
                    htmlFor="CASH_BANK_CODE"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Cash/Bank Code
                  </label>
                  <input
                    type="text"
                    name="CASH_BANK_CODE"
                    value={voucher.CASH_BANK_CODE}
                    onChange={handleInputChange}
                    placeholder="Cash/Bank Code"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                    disabled={isLoading || glCodes.length === 0}
                  />
                  {errors.CASH_BANK_CODE && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.CASH_BANK_CODE}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="INITIAL_NAME"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Cash/Bank Description
                  </label>
                  <input
                    type="text"
                    name="INITIAL_NAME"
                    value={voucher.INITIAL_NAME}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </>
            )}
            <div>
              <label
                htmlFor="PAYEE_R_CODE"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {payeeLabel} Code
              </label>
              {voucher.GLCODE === "1301" ? (
                <Select
                  name="PAYEE_R_CODE"
                  value={
                    voucher.PAYEE_R_CODE
                      ? {
                          value: voucher.PAYEE_R_CODE,
                          label: vendors.find(
                            (v: CustomerVendor) => v.id === voucher.PAYEE_R_CODE
                          )?.CUSTCODE
                            ? `${
                                vendors.find(
                                  (v: CustomerVendor) =>
                                    v.id === voucher.PAYEE_R_CODE
                                )!.CUSTCODE
                              } - ${
                                vendors.find(
                                  (v: CustomerVendor) =>
                                    v.id === voucher.PAYEE_R_CODE
                                )!.NAME || ""
                              }`
                            : voucher.PAYEE_R_CODE,
                        }
                      : null
                  }
                  onChange={handleVendorChange}
                  options={vendors.map((vendor: CustomerVendor) => ({
                    value: vendor.id,
                    label: vendor.CUSTCODE
                      ? `${vendor.CUSTCODE} - ${vendor.NAME || vendor.id}`
                      : `${vendor.id} - ${vendor.NAME || ""}`,
                  }))}
                  isDisabled={isLoading || vendors.length === 0}
                  placeholder="Select Vendor Code"
                  isClearable
                  className="w-full"
                  classNamePrefix="react-select"
                />
              ) : voucher.GLCODE === "1101" || voucher.GLCODE === "2301" ? (
                <Select
                  name="PAYEE_R_CODE"
                  value={
                    voucher.PAYEE_R_CODE
                      ? {
                          value: voucher.PAYEE_R_CODE,
                          label: customers.find(
                            (c: CustomerVendor) => c.id === voucher.PAYEE_R_CODE
                          )?.CUSTCODE
                            ? `${
                                customers.find(
                                  (c: CustomerVendor) =>
                                    c.id === voucher.PAYEE_R_CODE
                                )!.CUSTCODE
                              } - ${
                                customers.find(
                                  (c: CustomerVendor) =>
                                    c.id === voucher.PAYEE_R_CODE
                                )!.NAME || ""
                              }`
                            : voucher.PAYEE_R_CODE,
                        }
                      : null
                  }
                  onChange={handleCustomerChange}
                  options={customers.map((customer: CustomerVendor) => ({
                    value: customer.id,
                    label: customer.CUSTCODE
                      ? `${customer.CUSTCODE} - ${customer.NAME || customer.id}`
                      : `${customer.id} - ${customer.NAME || ""}`,
                  }))}
                  isDisabled={isLoading || customers.length === 0}
                  placeholder="Select Customer Code"
                  isClearable
                  className="w-full"
                  classNamePrefix="react-select"
                />
              ) : voucher.GLCODE === "5000" ? (
                <select
                  name="PAYEE_R_CODE"
                  value={voucher.PAYEE_R_CODE}
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
                  value={voucher.PAYEE_R_CODE}
                  onChange={handleInputChange}
                  placeholder={payeeCodePlaceholder}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={isLoading}
                />
              )}
              {errors.PAYEE_R_CODE && (
                <p className="text-red-500 text-sm mt-1">{errors.PAYEE_R_CODE}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="PAYEE_R_NAME"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {payeeLabel} Name
              </label>
              <input
                type="text"
                name="PAYEE_R_NAME"
                value={voucher.PAYEE_R_NAME}
                onChange={handleInputChange}
                placeholder={payeeNamePlaceholder}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={
                  isLoading ||
                  voucher.GLCODE === "1301" ||
                  voucher.GLCODE === "1101" ||
                  voucher.GLCODE === "2301" ||
                  voucher.GLCODE === "5000"
                }
              />
              {errors.PAYEE_R_NAME && (
                <p className="text-red-500 text-sm mt-1">{errors.PAYEE_R_NAME}</p>
              )}
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label
                htmlFor="NARRATION"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Narration
              </label>
              <input
                type="text"
                name="NARRATION"
                value={voucher.NARRATION}
                onChange={handleInputChange}
                placeholder="Narration"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isLoading || glCodes.length === 0}
              />
            </div>
            <div>
              <label
                htmlFor="CHEQUE_TRANS_ID"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Cheque No / Trans ID
              </label>
              <input
                type="text"
                name="CHEQUE_TRANS_ID"
                value={voucher.CHEQUE_TRANS_ID}
                onChange={handleInputChange}
                placeholder="Cheque No / Trans ID"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required={
                  voucher.CASH_BANK === "Yes" &&
                  voucher.CASH_BOOK === "No" &&
                  voucher.TYPE === "Payment"
                }
                disabled={isLoading}
              />
              {errors.CHEQUE_TRANS_ID && (
                <p className="text-red-500 text-sm mt-1">{errors.CHEQUE_TRANS_ID}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="CHEQUE_ON"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Drawn On
              </label>
              <input
                type="text"
                name="CHEQUE_ON"
                value={voucher.CHEQUE_ON}
                onChange={handleInputChange}
                placeholder="Drawn On"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required={
                  voucher.CASH_BANK === "Yes" &&
                  voucher.CASH_BOOK === "No" &&
                  voucher.TYPE === "Payment"
                }
                disabled={isLoading}
              />
              {errors.CHEQUE_ON && (
                <p className="text-red-500 text-sm mt-1">{errors.CHEQUE_ON}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="CHEQUE_DT"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Cheque Date
              </label>
              <input
                type="date"
                name="CHEQUE_DT"
                value={voucher.CHEQUE_DT}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required={
                  voucher.CASH_BANK === "Yes" &&
                  voucher.CASH_BOOK === "No" &&
                  voucher.TYPE === "Payment"
                }
                disabled={isLoading}
              />
              {errors.CHEQUE_DT && (
                <p className="text-red-500 text-sm mt-1">{errors.CHEQUE_DT}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="AMOUNT"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Amount
              </label>
              <input
                type="number"
                name="AMOUNT"
                value={voucher.AMOUNT || ""}
                onChange={handleInputChange}
                placeholder="Amount"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
                min="0.01"
                step="0.01"
                disabled={isLoading || glCodes.length === 0}
              />
              {errors.AMOUNT && (
                <p className="text-red-500 text-sm mt-1">{errors.AMOUNT}</p>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-300 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={isLoading || glCodes.length === 0 || cashBankGlCodes.length === 0}
            >
              {isLoading ? "Saving..." : "Update Voucher"}
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
      <VoucherViewPage />
    </Suspense>
  );
}
export default Page