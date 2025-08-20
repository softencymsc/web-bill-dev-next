/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useRef, useContext, Suspense } from "react";
import { motion, AnimatePresence, easeInOut } from "framer-motion";
import {
  FaCreditCard,
  FaMoneyBillWave,
  FaMobileAlt,
  FaComment,
  FaLock,
  FaCalendar,
  FaTag,
  FaTimes,
  FaUser,
  FaGift,
  FaFileInvoice,
  FaPercentage,
} from "react-icons/fa";
import { Toaster, toast } from "react-hot-toast";
import QRCode from "qrcode";
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from "next/navigation";
import { collections } from "@/config";
import { db } from "../../firebase";
import {
  getDocs,
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { roundOff } from "@/config/utils";
import {
  fetchWhereNotEqual,
  getPrefixForModel,
  multiEntry,
  updateDocWithSingleWhere,
} from "@/services";
import { encryptUrl } from "@/services/encryption";
import axios from 'axios';
import { generatePDFAndSendWhatsApp } from "./PDFGenerator";
type PaymentSectionProps = {
  products: any[];
  outstandingAmount: number;
  onPayment?: (paymentPayload: any) => void;
  onShowBillChange?: (show: boolean) => void;
  totalAmount: number;
  totalGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  order_no: string;
  discount: number;
  is_order: boolean;
  model: "sale_bill" | "purchaseBill";
};

const PaymentSection: React.FC<PaymentSectionProps> = ({
  products,
  outstandingAmount: initialOutstandingAmount,
  onPayment,
  onShowBillChange,
  totalAmount,
  order_no,
  is_order,
  totalGstAmount,
  cgstAmount,
  discount,
  sgstAmount,
  model,
}) => {
  const [paymentType, setPaymentType] = useState<"Cash" | "Card" | "UPI" | "Free" | "Credit" | "OwnerDiscount" | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [storedAdminPin, setStoredAdminPin] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const [amountLeft, setAmountLeft] = useState(initialOutstandingAmount);
  const [saveCard, setSaveCard] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>("");
  const [selectedUpiId, setSelectedUpiId] = useState<string | null>(null);
  const [upiAmounts, setUpiAmounts] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullPayment, setIsFullPayment] = useState(true);
  const [upiNames, setUpiNames] = useState<any[]>([]);
  const [showBill, setShowBill] = useState(false);
  const [isDraftProcessing, setIsDraftProcessing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    percentage: number;
    discount: number;
  } | null>(null);
  const [outstandingAmount, setOutstandingAmount] = useState(initialOutstandingAmount);
  const [ownerNumber, setOwnerNumber] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [appliedOwnerDiscount, setAppliedOwnerDiscount] = useState<{
    type: "percentage" | "amount";
    value: number;
    discount: number;
  } | null>(null);
  const successAudioRef = useRef<HTMLAudioElement>(null);
  const failureAudioRef = useRef<HTMLAudioElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch } = useContext(CounterContext);
  const router = useRouter();
  const { myCollection, tenant } = useAuth();
  const currentTenant = tenant?.tenant_id || "";
  const [modelName, setModelName] = useState(model === "sale_bill" ? "Sale Bill" : "Purchase Bill");
  const currency = state.currency
  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.3, ease: easeInOut },
    },
  };

  const cardVariants = {
    inactive: { scale: 0.95, opacity: 0.7 },
    active: { scale: 1, opacity: 1, transition: { duration: 0.2 } },
  };

  const buttonVariants = {
    hover: { scale: 1.05, transition: { duration: 0.2 } },
    tap: { scale: 0.95, transition: { duration: 0.2 } },
  };

  const promoVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, type: "spring" as const, stiffness: 200 },
    },
  };

  const upiImages: { [key: string]: string } = {
    PhonePe: "/PhonePe.png",
    GooglePay: "/Gpay.webp",
    PAYTM: "/Paytm.png",
    BHIM: "/images/bhim.png",
    Default: "/Upi.jpg",
  };

  // Fetch admin PIN and owner number from SETTINGS
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const adminPinDocRef = doc(db, `TenantsDb/${currentTenant}/SETTINGS/adminPin`);
        const ownerNumberDocRef = doc(db, `TenantsDb/${currentTenant}/SETTINGS/ownerNumber`);

        const [adminPinSnap, ownerNumberSnap] = await Promise.all([
          getDoc(adminPinDocRef),
          getDoc(ownerNumberDocRef),
        ]);

        if (adminPinSnap.exists()) {
          const adminPinData = adminPinSnap.data();
          setStoredAdminPin(adminPinData.pin || null);
        } else {
          console.warn("No admin PIN document found in SETTINGS");
          // toast.error("Admin PIN not configured", { position: "bottom-right" });
        }

        if (ownerNumberSnap.exists()) {
          const ownerNumberData = ownerNumberSnap.data();
          setOwnerNumber(ownerNumberData.number || null);
        } else {
          console.warn("No owner number document found in SETTINGS");
          // toast.error("Owner number not configured", { position: "bottom-right" });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
        // toast.error("Failed to load settings", { position: "bottom-right" });
      }
    };
    fetchSettings();
  }, [currentTenant]);

  // Fetch UPI data
  // Inside the useEffect hook for fetching UPI data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchWhereNotEqual(myCollection(collections.GL_MAST), "UPI_NAME", "");
        // Ensure DESCRIPT is included in the data
        setUpiNames(data.map(item => ({
          UPI_NAME: item.UPI_NAME,
          UPI_ID: item.UPI_ID,
          DESCRIPT: item.DESCRIPT || "" // Include DESCRIPT, default to empty string if not present
        })));
      } catch (error) {
        console.error("Failed to fetch UPI data:", error);
        // toast.error("Failed to load UPI options", { position: "bottom-right" });
      }
    };
    fetchData();
  }, [myCollection]);

  // Fetch saved cards for the current customer based on MOBPHONE
  useEffect(() => {
    if (paymentType === "Card" && state.customerData?.MOBPHONE) {
      const fetchSavedCards = async () => {
        try {
          const cardsQuery = query(
            collection(db, `TenantsDb/${currentTenant}/Cards`),
            where("MOBPHONE", "==", state.customerData?.MOBPHONE)
          );
          const cardsSnapshot = await getDocs(cardsQuery);
          const cards = cardsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSavedCards(cards);
        } catch (error) {
          console.error("Failed to fetch saved cards:", error);
          // toast.error("Failed to load saved cards", { position: "bottom-right" });
        }
      };
      fetchSavedCards();
    }
  }, [paymentType, state.customerData?.MOBPHONE, currentTenant]);

  // Reset payment inputs and apply full amount when payment type or outstanding amount changes
  useEffect(() => {
    if (paymentType === "Cash" || paymentType === "Card" || paymentType === "UPI" || paymentType === "Credit") {
      const fullAmount = outstandingAmount.toFixed(2);
      if (paymentType === "Cash") {
        setCashAmount(fullAmount);
        setAmountLeft(0);
      }
      if (paymentType === "Card") {
        setIsFullPayment(true);
        setAmountLeft(0);
      }
      if (paymentType === "UPI" && selectedUpiApp) {
        setUpiAmounts({ ...upiAmounts, [selectedUpiApp]: fullAmount });
        setShowQR(true);
        setAmountLeft(0);
      }
      if (paymentType === "Credit") {
        setAmountLeft(outstandingAmount);
      }
    }
    if (paymentType === "Free" || paymentType === "OwnerDiscount") {
      setAmountLeft(0);
    }
  }, [paymentType, outstandingAmount, selectedUpiApp]);

  // Auto-select first UPI app and apply full amount
  useEffect(() => {
    if (paymentType === "UPI" && upiNames.length > 0 && !selectedUpiApp) {
      const firstUpi = upiNames[0];
      setSelectedUpiApp(firstUpi.UPI_NAME);
      setSelectedUpiId(firstUpi.UPI_ID);
      setUpiAmounts({ [firstUpi.UPI_NAME]: outstandingAmount.toFixed(2) });
      setShowQR(true);
      setAmountLeft(0);
    }
  }, [paymentType, upiNames, outstandingAmount]);

  // Generate QR code for UPI
  useEffect(() => {
    if (
      showQR &&
      qrCanvasRef.current &&
      selectedUpiId &&
      upiAmounts[selectedUpiApp] &&
      Number(upiAmounts[selectedUpiApp]) > 0
    ) {
      const upiUrl = `upi://pay?pa=${selectedUpiId}&am=${Number(upiAmounts[selectedUpiApp]).toFixed(2)}&cu=INR`;
      QRCode.toCanvas(qrCanvasRef.current, upiUrl, { width: 180, margin: 2 }, (err) => {
        if (err) console.error("QR Code generation failed:", err);
      });
    }
  }, [showQR, selectedUpiId, upiAmounts, selectedUpiApp]);

  // Reset payment inputs when payment type changes
  useEffect(() => {
    setIsFullPayment(true);
    setUpiAmounts({});
    setCashAmount("");
    setShowQR(false);
    setAdminPin("");
    setOtp("");
    setOtpSent(false);
    setDiscountType("percentage");
    setDiscountValue("");
    setAmountLeft(outstandingAmount);
    if (paymentType !== "UPI") {
      setSelectedUpiApp("");
      setSelectedUpiId(null);
    }
  }, [paymentType, outstandingAmount]);

  // Update amount left based on payment inputs
  useEffect(() => {
    let totalPaid = 0;
    if (paymentType === "Cash") totalPaid = Number(cashAmount) || 0;
    else if (paymentType === "Card") totalPaid = outstandingAmount;
    else if (paymentType === "UPI") {
      totalPaid = Object.values(upiAmounts).reduce(
        (sum, amount) => sum + (Number(amount) || 0),
        0
      );
    }
    else if (paymentType === "Free" || paymentType === "OwnerDiscount") totalPaid = outstandingAmount;
    else if (paymentType === "Credit") totalPaid = 0;
    setAmountLeft(Math.max(outstandingAmount - totalPaid, 0));
  }, [cashAmount, upiAmounts, paymentType, outstandingAmount]);

  // Update showBill callback
  useEffect(() => {
    if (onShowBillChange) onShowBillChange(showBill);
  }, [showBill, onShowBillChange]);

  function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  // Send OTP for Owner's Discount
  const sendOtp = async () => {
    if (!ownerNumber) {
      // toast.error("Owner number not configured", { position: "bottom-right" });
      return;
    }
    const otp = generateOtp();
    setGeneratedOtp(otp); // Store OTP in state for later verification

    try {
      const response = await fetch("/api/sendotp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: currentTenant, phoneNumber: ownerNumber, otp }),
      });
      if (response.ok) {
        setOtpSent(true);
        toast.success("OTP sent to owner number", { position: "bottom-right" });
      } else {
        throw new Error("Failed to send OTP");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      // toast.error("Failed to send OTP", { position: "bottom-right" });
    }
  };
  const sendWhatsAppMessage = async (
    tenantId: string,
    phoneNumber: string,
    customerName: string,
    invoiceNumber: string,
    totalAmount: string,
    date: string,
    items: string,
    contactEmail: string,
    cgst: string,
    sgst: string,
    totalTax: string
  ) => {
    try {
      const payload = {
        tenantId,
        phoneNumber,
        customerName,
        invoiceNumber,
        totalAmount,
        date,
        items,
        contactEmail,
        cgst,
        sgst,
        totalTax
      };

      const response = await axios.post('/api/sendwhatsapp', payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (response.status === 200 && response.data.success) {
        toast.success('WhatsApp bill message sent successfully.', { position: 'bottom-right' });
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to send WhatsApp message.');
      }
    } catch (error: any) {
      // toast.error(`WhatsApp send failed: ${error.message}`, { position: 'bottom-right' });
      throw error;
    }
  };
  // Verify OTP and apply owner's discount
  const verifyOtpAndApplyDiscount = async () => {
    if (!otp.trim()) {
      // toast.error("Please enter OTP", { position: "bottom-right" });
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }
    if (!discountValue || Number(discountValue) <= 0) {
      // toast.error("Please enter a valid discount value", { position: "bottom-right" });
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }
    try {
      const response = await axios.post("/api/verifyotp", {
        tenantId: currentTenant,
        phoneNumber: ownerNumber,
        otp, // user input
        generatedOtp, // send the generated OTP for backend verification
      });
      if (response.status === 200) {
        const discountNum = Number(discountValue);
        let discount = 0;
        if (discountType === "percentage") {
          if (discountNum > 100) {
            // toast.error("Percentage discount cannot exceed 100%", { position: "bottom-right" });
            setShakeError(true);
            setTimeout(() => setShakeError(false), 500);
            return;
          }
          discount = Number(roundOff(initialOutstandingAmount * (discountNum / 100)));
        } else {
          if (discountNum > initialOutstandingAmount) {
            // toast.error("Discount amount cannot exceed outstanding amount", { position: "bottom-right" });
            setShakeError(true);
            setTimeout(() => setShakeError(false), 500);
            return;
          }
          discount = discountNum;
        }
        const newOutstanding = roundOff(initialOutstandingAmount - discount);
        setAppliedOwnerDiscount({
          type: discountType,
          value: discountNum,
          discount,
        });
        setOutstandingAmount(Number(newOutstanding));
        setAmountLeft(Number(newOutstanding));
        toast.success(`Owner's discount applied: ${currency + " "}${discount.toFixed(2)}`, { position: "bottom-right" });
        setOtp("");
        setDiscountValue("");
        setOtpSent(false);
      } else {
        // toast.error("Invalid OTP", { position: "bottom-right" });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      // toast.error("Failed to verify OTP", { position: "bottom-right" });
    }
  };

  // Remove owner's discount
  const handleRemoveOwnerDiscount = () => {
    setAppliedOwnerDiscount(null);
    setOutstandingAmount(initialOutstandingAmount);
    setAmountLeft(initialOutstandingAmount);
    toast.success("Owner's discount removed", { position: "bottom-right" });
  };

  // Apply promo code
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      // toast.error("Please enter a promo code", { position: "bottom-right" });
      return;
    }
    try {
      const promoQuery = query(
        collection(db, `TenantsDb/${currentTenant}/PROMOCODES`),
        where("code", "==", promoCode.trim().toUpperCase())
      );
      const promoSnapshot = await getDocs(promoQuery);
      if (promoSnapshot.empty) {
        // toast.error("Invalid promo code", { position: "bottom-right" });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        return;
      }
      const promoData = promoSnapshot.docs[0].data();
      const percentage = Number(promoData.percentage) || 0;
      const discount = Number(roundOff(initialOutstandingAmount * (percentage / 100)));
      const newOutstanding = roundOff(initialOutstandingAmount - Number(discount));
      setAppliedPromo({
        code: promoCode.trim().toUpperCase(),
        percentage,
        discount,
      });
      setOutstandingAmount(Number(newOutstanding));
      setAmountLeft(Number(newOutstanding));
      toast.success(`Promo code applied! ${percentage}% off (${currency + " "}${discount.toFixed(2)})`, {
        position: "bottom-right",
      });
      setPromoCode("");
    } catch (error) {
      console.error("Error applying promo code:", error);
      // toast.error("Failed to apply promo code", { position: "bottom-right" });
    }
  };

  // Remove promo code
  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setOutstandingAmount(initialOutstandingAmount);
    setAmountLeft(initialOutstandingAmount);
    toast.success("Promo code removed", { position: "bottom-right" });
  };

  // Reset to full payment amount
  const handleFullPayment = (type: "Cash" | "UPI") => {
    const fullAmount = outstandingAmount.toFixed(2);
    if (type === "Cash") {
      setCashAmount(fullAmount);
      setAmountLeft(0);
    } else if (type === "UPI" && selectedUpiApp) {
      setUpiAmounts({ ...upiAmounts, [selectedUpiApp]: fullAmount });
      setShowQR(true);
      setAmountLeft(0);
    }
  };

  const getDOCnum = async (): Promise<string> => {
    const modelName = model === "sale_bill" ? "Sale Bill" : "Purchase Bill";
    setModelName(modelName);
    const prefix = await getPrefixForModel(state.tenantId, modelName);
    return prefix;
  };

  const generateBillNo = async () => {
    try {
      const prefix = await getDOCnum();
      return `${prefix}-${Date.now()}`;
    } catch (error) {
      console.error("Error generating bill number:", error);
      return `ERROR-${Date.now()}`;
    }
  };

  // Save customer to Customers collection if not exists
  const saveCustomerIfNotExists = async (customerData: any) => {
    try {
      if (!customerData?.MOBPHONE) {
        console.warn("No mobile number provided for customer, skipping save.");
        return;
      }
      const customerQuery = query(
        collection(db, `TenantsDb/${currentTenant}/Customers`),
        where("MOBPHONE", "==", customerData.MOBPHONE)
      );
      const customerSnapshot = await getDocs(customerQuery);
      if (customerSnapshot.empty) {
        const customerRef = collection(db, `TenantsDb/${currentTenant}/Customers`);
        const isVendor = model === "purchaseBill";
        const CUST_VEND = isVendor ? "V" : "C";
        await addDoc(customerRef, {
          NAME: customerData.NAME || "",
          MOBPHONE: customerData.MOBPHONE || "",
          ADDRESS: customerData.ADDRESS || "",
          CITY: customerData.CITY || "",
          COUNTRY: customerData.COUNTRY || "",
          CUSTCODE: customerData.CUSTCODE || "",
          CUST_VEND: CUST_VEND,
          createdAt: Timestamp.fromDate(new Date()),
        });
        console.log("Customer saved successfully:", customerData.MOBPHONE);
      } else {
        console.log("Customer already exists with MOBPHONE:", customerData.MOBPHONE);
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      // toast.error("Failed to save customer details", { position: "bottom-right" });
    }
  };

  const handleDraftBill = async () => {
    if (isDraftProcessing || model !== "sale_bill") return;
    if (!products.length || !state.customerData) {
      // toast.error("Missing products or customer information", { position: "bottom-right" });
      return;
    }
    setIsDraftProcessing(true);
    try {
      await saveCustomerIfNotExists(state.customerData);
      const billNo = await generateBillNo();
      const currentTimestamp = Timestamp.fromDate(new Date());
      const customerData = state.customerData;
      const draftRef = query(
        collection(db, `TenantsDb/${currentTenant}/DRAFT`),
        where("MOBPHONE", "==", customerData?.MOBPHONE || "")
      );
      const snapshot = await getDocs(draftRef);
      if (!snapshot.empty) {
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, `TenantsDb/${currentTenant}/DRAFT`, docSnap.id));
        }
      }
      const basicAmount = products.reduce(
        (sum, item) =>
          sum +
          Number(item.price) * Math.abs(Number(item.QUANTITY)) -
          (Number(item.DISCOUNTAMT) || 0),
        0
      );
      const igstPercent = products[0]?.IGST || 0;
      const gstAmount = roundOff(basicAmount * (igstPercent / 100));
      const cgstAmount = roundOff(Number(gstAmount) / 2);
      const sgstAmount = roundOff(Number(gstAmount) / 2);
      const discountAmount = appliedPromo ? appliedPromo.discount : (appliedOwnerDiscount ? appliedOwnerDiscount.discount : 0);
      const netAmount = roundOff(basicAmount + gstAmount - discountAmount);
      const billData = {
        BILL_DATE: currentTimestamp,
        BILL_NO: billNo,
        bill: {
          ADDRESS: customerData?.ADDRESS || "",
          BASIC: roundOff(basicAmount),
          BILL_DATE: currentTimestamp,
          BILL_NO: billNo,
          CARD_RECEIVED: 0,
          CASH_RECEIVED: 0,
          CGST_AMT: cgstAmount,
          CITY: customerData?.CITY || "",
          COUNTRY: customerData?.COUNTRY || "",
          CREDIT_RECEIVED: netAmount,
          CUSTCODE: Number(customerData?.CUSTCODE) || 0,
          CUSTNAME: customerData?.NAME || "",
          GST_AMT: gstAmount,
          IS_CREDIT: "YES",
          IS_DRAFT: "YES",
          IS_FREE: "NO",
          MOBPHONE: customerData?.MOBPHONE || "",
          NET_AMT: netAmount,
          OUTSTANDING_AMT: netAmount,
          PAY_MODE: "CREDIT",
          SGST_AMT: sgstAmount,
          TERMTOTAL: 0,
          UPI_DETAILS: [],
          UPI_RECEIVED: 0,
          PROMO_CODE: appliedPromo ? appliedPromo.code : (appliedOwnerDiscount ? `OWNER_${appliedOwnerDiscount.type.toUpperCase()}` : ""),
          PROMO_DISCOUNT: discountAmount,
        },
        billTerm: {
          AMOUNT: "",
          BILL_DATE: currentTimestamp,
          BILL_NO: billNo,
          DESCRIPT: "",
          PERCENTAGE: "",
          SEQUENCE: "",
        },
        createdAt: currentTimestamp,
        productEntries: products.map((item) => {
          const quantity = Math.abs(Number(item.QUANTITY)) || 0;
          const rate = Number(item.price) || 0;
          const discount = Number(item.DISCOUNTAMT) || 0;
          const baseAmt = rate * quantity - discount;
          const igstRate = Number(item.IGST) || 0;
          const gstAmt = roundOff(baseAmt * (igstRate / 100));
          const cgstAmt = roundOff(Number(gstAmt) / 2);
          const sgstAmt = roundOff(Number(gstAmt) / 2);
          return {
            AMOUNT: roundOff(baseAmt),
            BILL_DATE: currentTimestamp,
            BILL_NO: billNo,
            CGSTAMT: cgstAmt,
            CUSTNAME: customerData?.NAME || "",
            GSTAMT: gstAmt,
            GroupDesc: item.GroupDesc || "Finish Goods",
            IGSTAMT: gstAmt,
            IGSTPER: igstRate,
            PRODCODE: item.PRODCODE || "",
            PRODNAME: item.name || "",
            PRODTOTAL: roundOff(rate * quantity),
            QUANTITY: quantity,
            RATE: String(rate),
            SGSTAMT: sgstAmt,
            HSNCODE: item.HSNCODE,
            SGroupDesc: item.SGroupDesc || "",
            TOTALAMT: roundOff(Number(baseAmt)),
            UOM: item.UOM_SALE || "PCS",
          };
        }),
      };
      const billRef = collection(db, `TenantsDb/${currentTenant}/DRAFT`);
      await addDoc(billRef, billData);
      toast.success("Draft bill saved successfully!", { position: "bottom-right" });
      dispatch({ type: "SET_CUSTOMER", payload: undefined });
      dispatch({ type: "SET_ADDED_PRODUCTS", payload: [] });
      sessionStorage.removeItem("products");
      sessionStorage.removeItem("addedProducts");
      router.push("/sale/bill/add");
    } catch (error) {
      console.error("Error saving draft bill:", error);
      // toast.error("Failed to save draft bill", { position: "bottom-right" });
    } finally {
      setIsDraftProcessing(false);
    }
  };

  const isPaymentValid = () => {
    if (paymentType === "Cash") {
      return Number(cashAmount) >= 0 && Number(cashAmount) <= outstandingAmount;
    }
    if (paymentType === "Card") {
      return (
        cardNumber.replace(/\D/g, "").length === 12 &&
        cardExpiry.match(/^(0[1-9]|1[0-2])\/\d{2}$/) &&
        cardCVC.length === 3 &&
        cardHolder.trim().length > 0
      );
    }
    if (paymentType === "UPI") {
      return Object.values(upiAmounts).some((amount) => Number(amount) > 0);
    }
    if (paymentType === "Free") {
      return adminPin === storedAdminPin;
    }
    if (paymentType === "Credit" || paymentType === "OwnerDiscount") {
      return true;
    }
    return false;
  };

  const handlePayment = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e && typeof (e as React.SyntheticEvent).preventDefault === "function") e.preventDefault();
    if (isProcessing) return;
    if (!paymentType) {
      // toast.error("Please select a payment type.", { position: "bottom-right" });
      return;
    }
    if (paymentType !== "Free" && paymentType !== "Credit" && paymentType !== "OwnerDiscount" && amountLeft > 0) {
      // toast.error(`Please cover the remaining amount: ${currency + " "}${amountLeft.toFixed(2)}`, {
      //   position: "bottom-right",
      // });
      setShakeError(true);
      setTimeout(() => setShakeError(false), 2000);
      return;
    }
    if (!isPaymentValid()) {
      if (paymentType === "Free") {
        // toast.error("Invalid admin PIN", { position: "bottom-right" });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
      } else {
        // toast.error("Please fill in all required payment details", { position: "bottom-right" });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
      }
      return;
    }
    setIsProcessing(true);
    try {
      if (!products.length || !state.customerData) {
        // toast.error("Missing products or customer information", { position: "bottom-right" });
        return;
      }
      if (!currentTenant) throw new Error("Tenant ID is undefined");
      await saveCustomerIfNotExists(state.customerData);
      const customerData = state.customerData;
      const draftRef = query(
        collection(db, `TenantsDb/${currentTenant}/DRAFT`),
        where("bill.MOBPHONE", "==", customerData?.MOBPHONE || "")
      );
      const snapshot = await getDocs(draftRef);
      if (!snapshot.empty) {
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, `TenantsDb/${currentTenant}/DRAFT`, docSnap.id));
        }
      }
      const invoiceNumber = await generateBillNo();
      if (!invoiceNumber) throw new Error("Failed to generate invoice number");
      const date = new Date();
      if (paymentType === "Card" && saveCard && state.customerData?.MOBPHONE) {
        const cardData = {
          cardNumber: cardNumber.replace(/-/g, ""),
          cardExpiry,
          cardCVC,
          cardHolder,
          MOBPHONE: state.customerData.MOBPHONE,
          timestamp: Date.now(),
        };
        await addDoc(collection(db, `TenantsDb/${currentTenant}/Cards`), cardData);
        setSavedCards([...savedCards, cardData]);
      }
      const baseAmount = products.reduce(
        (total, product) =>
          total +
          Number(product.price) * Math.abs(Number(product.QUANTITY)) -
          (Number(product.DISCOUNTAMT) || 0),
        0
      );
      const discountAmount = appliedPromo ? appliedPromo.discount : (appliedOwnerDiscount ? appliedOwnerDiscount.discount : 0);
      const productEntries = products.map((product) => {
        const quantity = Math.abs(Number(product.QUANTITY)) || 0;
        const rate = Number(product.price) || 0;
        const discount = Number(product.DISCOUNTAMT) || 0;
        const baseAmt = rate * quantity - discount;
        const igstRate = Number(product.IGST) || 0;
        const totalAmt = rate * quantity;
        const gstAmt = Number(((baseAmt * igstRate) / (100 + igstRate)).toFixed(11));
        const cgstAmt = Number((gstAmt / 2).toFixed(11));
        const sgstAmt = Number((gstAmt / 2).toFixed(11));
        const discountPercent = (model == "purchaseBill" ? product.DISCPER : 0);
        return {
          collectionRef: myCollection(
            model === "sale_bill" ? collections.BILLDET : collections.BLLINDET
          ),
          data: {
            BILL_NO: invoiceNumber,
            BILL_DATE: date,
            CUSTNAME: customerData?.NAME || "",
            PRODCODE: product.PRODCODE || "",
            PRODNAME: product.DESCRIPT || product.name || "",
            GroupDesc: product.GroupDesc || "",
            SGroupDesc: product.SGroupDesc || "",
            QUANTITY: quantity,
            UOM: product.UOM_SALE || "",
            RATE: rate,
            PRODTOTAL: roundOff(totalAmt),
            AMOUNT: roundOff(baseAmt),
            IGSTPER: igstRate,
            IGSTAMT: gstAmt,
            CGSTAMT: cgstAmt,
            SGSTAMT: sgstAmt,
            DISCPER: discountPercent,
            HSNCODE: product.HSNCODE,
            Taxable_Amount: Number(roundOff(baseAmt)) - Number(roundOff(cgstAmt + sgstAmt)),
            GSTAMT: gstAmt,
            TOTALAMT: roundOff(baseAmt),
          },
        };
      });
      const confirmedPayments: {
        cash: number;
        card: number;
        upi: { method: string; amount: number; description: string }[];
        free: number;
        credit: number;
        ownerDiscount: number;
      } = {
        cash: 0,
        card: 0,
        upi: [],
        free: 0,
        credit: 0,
        ownerDiscount: 0,
      };
      let totalUpiAmount = 0;
      if (paymentType === "Cash") {
        confirmedPayments.cash = Number(cashAmount) || outstandingAmount;
      } else if (paymentType === "Card") {
        confirmedPayments.card = outstandingAmount;
      } else if (paymentType === "UPI") {
        confirmedPayments.upi = Object.entries(upiAmounts)
          .filter(([method, amount]) => Number(amount) > 0 && upiNames.some(upi => upi.UPI_NAME === method))
          .map(([method, amount]) => {
            const upiData = upiNames.find((name) => name.UPI_NAME === method);
            return {
              method,
              amount: Number(amount),
              description: upiData?.DESCRIPT || "",
            };
          });
        totalUpiAmount = confirmedPayments.upi.reduce((sum, upi) => sum + upi.amount, 0);
      } else if (paymentType === "Free") {
        confirmedPayments.free = outstandingAmount;
      } else if (paymentType === "Credit") {
        confirmedPayments.credit = outstandingAmount;
      } else if (paymentType === "OwnerDiscount") {
        confirmedPayments.ownerDiscount = outstandingAmount;
      }
      const paymentFields = {
        PAY_MODE: [
          confirmedPayments.cash > 0 ? "CASH" : "",
          confirmedPayments.upi.some((upi) => upi.amount > 0) ? "UPI" : "",
          confirmedPayments.card > 0 ? "CARD" : "",
          confirmedPayments.free > 0 ? "FREE" : "",
          confirmedPayments.credit > 0 ? "CREDIT" : "",
          confirmedPayments.ownerDiscount > 0 ? "OWNER_DISCOUNT" : "",
        ]
          .filter(Boolean)
          .join(", "),
        CASH_AMOUNT: Number(cashAmount) || 0,
        UPI_AMOUNT: totalUpiAmount,
        CARD_AMOUNT: confirmedPayments.card || 0,
        FREE_AMOUNT: confirmedPayments.free || 0,
        CREDIT_AMOUNT: confirmedPayments.credit || 0,
        OWNER_DISCOUNT_AMOUNT: confirmedPayments.ownerDiscount || 0,
        UPI_DETAILS: paymentType === "UPI"
          ? confirmedPayments.upi.map((upi) => ({
            method: upi.method,
            amount: upi.amount,
            description: upi.description || "",
          }))
          : [],
        OUTSTANDING_AMOUNT: roundOff(amountLeft),
        IS_FREE: paymentType === "Free" ? "YES" : "NO",
        IS_CREDIT: paymentType === "Credit" ? "YES" : "NO",
        IS_OWNER_DISCOUNT: paymentType === "OwnerDiscount" ? "YES" : "NO",
        PROMO_CODE: appliedPromo ? appliedPromo.code : (appliedOwnerDiscount ? `OWNER_${appliedOwnerDiscount.type.toUpperCase()}` : ""),
        PROMO_DISCOUNT: discountAmount,
      };
      const mainEntry = {
        collectionRef: myCollection(model === "sale_bill" ? collections.BILL : collections.BILLIN),
        data: {
          BILL_NO: invoiceNumber,
          BILL_DATE: date,
          CUST_CODE: customerData?.CUSTCODE || "",
          CUSTNAME: customerData?.NAME || "",
          MOBPHONE: customerData?.MOBPHONE || "",
          ADDRESS: customerData?.ADDRESS || "",
          CITY: customerData?.CITY || "",
          COUNTRY: customerData?.COUNTRY || "",
          BASIC: roundOff(baseAmount),
          TERMTOTAL: 0,
          GST_AMOUNT: totalGstAmount,
          CGST_AMOUNT: cgstAmount,
          SGST_AMOUNT: sgstAmount,
          NET_AMOUNT: roundOff(totalAmount - discountAmount),
          ...paymentFields,
        },
      };
      const termEntry = {
        collectionRef: myCollection(model === "sale_bill" ? collections.BILLTERM : collections.BLINTERM),
        data: {
          BILL_NO: invoiceNumber,
          BILL_DATE: date,
          SEQUENCE: "",
          PERCENTAGE: "",
          AMOUNT: "",
          DESCRIPT: "",
        },
      };
      const entries = [mainEntry, termEntry, ...productEntries];
      await multiEntry(entries);
      if (model === "sale_bill") {
        for (const product of products) {
          const prodCode = product.PRODCODE;
          if (!prodCode) continue;
          const productQuery = query(
            collection(db, `TenantsDb/${currentTenant}/Products`),
            where("PRODCODE", "==", prodCode)
          );
          const snapshot = await getDocs(productQuery);
          if (!snapshot.empty) {
            const productDoc = snapshot.docs[0];
            const productData = productDoc.data();
            const currentOpeningQ = Number(productData.OPENING_Q) || 0;
            const soldQuantity = Math.abs(Number(product.QUANTITY)) || 0;
            const newOpeningQ = (currentOpeningQ - soldQuantity).toString();
            await updateDoc(productDoc.ref, { OPENING_Q: newOpeningQ });
          }
        }
        if (is_order && order_no) {
          const orderCollection = collection(db, `TenantsDb/${currentTenant}/${collections.ORDER}`);
          const orderQuery = query(orderCollection, where("OA_NO", "==", order_no));
          const orderSnapshot = await getDocs(orderQuery);
          if (!orderSnapshot.empty) {
            const orderDoc = orderSnapshot.docs[0];
            await updateDoc(orderDoc.ref, { BILL_LINK: true });
            console.log(`Updated BILL_LINK to true for OA_NO: ${order_no} in ORDER collection`);
          } else {
            console.warn(`No order found with OA_NO: ${order_no}`);
          }
        }
      } else if (model === "purchaseBill") {
        for (const product of products) {
          const prodCode = product.PRODCODE;
          if (!prodCode) continue;
          const productQuery = query(
            collection(db, `TenantsDb/${currentTenant}/Products`),
            where("PRODCODE", "==", prodCode)
          );
          const productSnapshot = await getDocs(productQuery);
          if (!productSnapshot.empty) {
            const productDoc = productSnapshot.docs[0];
            const productData = productDoc.data();
            const currentOpeningQ = Number(productData.OPENING_QUANTITY) || 0;
            const receivedQuantity = Number(product.QUANTITY) || 0;
            const newOpeningQ = (currentOpeningQ + receivedQuantity).toString();
            await updateDoc(productDoc.ref, { OPENING_Q: newOpeningQ });
          }
        }
        if (is_order && order_no) {
          const orderCollection = collection(db, `TenantsDb/${currentTenant}/${collections.PORDER}`);
          const orderQuery = query(orderCollection, where("BILL_NO", "==", order_no));
          const orderSnapshot = await getDocs(orderQuery);
          if (!orderSnapshot.empty) {
            const orderDoc = orderSnapshot.docs[0];
            await updateDoc(orderDoc.ref, { BILL_LINK: true });
            console.log(`Updated BILL_LINK to true for BILL_NO: ${order_no} in PORDER collection`);
          } else {
            console.warn(`No order found with BILL_NO: ${order_no}`);
          }
        }
      }
      const paymentData = {
        paymentType,
        products,
        invoiceNumber,
        date: date.toISOString(),
        customerData,
        totalAmount: totalAmount - discountAmount,
        totalGstAmount,
        cgstAmount,
        sgstAmount,
        confirmedPayments,
        finalOutstandingAmount: amountLeft,
        model,
        paymentDetails: {
          cashAmount: Number(cashAmount) || 0,
          cardAmount: confirmedPayments.card || 0,
          upiAmounts,
          totalUpiAmount: totalUpiAmount || 0,
          freeAmount: confirmedPayments.free || 0,
          creditAmount: confirmedPayments.credit || 0,
          ownerDiscountAmount: confirmedPayments.ownerDiscount || 0,
        },
        promoCode: appliedPromo ? appliedPromo.code : null,
        promoDiscount: appliedPromo ? appliedPromo.discount : 0,
        ownerDiscount: appliedOwnerDiscount ? {
          type: appliedOwnerDiscount.type,
          value: appliedOwnerDiscount.value,
          discount: appliedOwnerDiscount.discount,
        } : null,
      };
      localStorage.setItem('lastTransaction', JSON.stringify(paymentData));
      if (successAudioRef.current) {
        successAudioRef.current.currentTime = 0;
        successAudioRef.current.play().catch((err) => console.warn("Success audio playback failed:", err));
      }
      const rawPhone = customerData?.MOBPHONE || "";
      console.log("Raw MOBPHONE:", rawPhone, "Time:", new Date().toISOString());

      if (!rawPhone) {
        console.error("Customer phone number is empty or undefined");
        // toast.error("Customer phone number is missing for WhatsApp message", {
        //   position: "bottom-right",
        // });
        return;
      }

      const cleanedPhone = rawPhone.replace(/[^0-9]/g, "");
      const wpNo = cleanedPhone.length === 10 ? `+91${cleanedPhone}` : cleanedPhone;

      const phoneRegex = /^\+91\d{10}$/;
      if (phoneRegex.test(wpNo)) {
        console.log(
          "Preparing WhatsApp send:",
          {
            phone: wpNo,
            invoice: invoiceNumber,
            customer: customerData?.NAME,
            totalAmount: paymentData?.totalAmount?.toFixed(2),
            tenant: state.tenantId,
          },
          "Time:",
          new Date().toISOString()
        );

        function numberToWords(num: number): string {
          if (num === 0) return "Zero Rupees Only";
          const belowTwenty = [
            "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
            "Sixteen", "Seventeen", "Eighteen", "Nineteen"
          ];
          const tens = [
            "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
            "Eighty", "Ninety"
          ];
          const thousands = ["", "Thousand", "Million", "Billion"];

          const helper = (n: number): string => {
            if (n === 0) return "";
            else if (n < 20) return belowTwenty[n] + " ";
            else if (n < 100) return tens[Math.floor(n / 10)] + " " + helper(n % 10);
            else return belowTwenty[Math.floor(n / 100)] + " Hundred " + helper(n % 100);
          };

          let word = "";
          let i = 0;
          while (num > 0) {
            if (num % 1000 !== 0) {
              word = helper(num % 1000) + thousands[i] + " " + word;
            }
            num = Math.floor(num / 1000);
            i++;
          }
          return word.trim() + " Rupees Only";
        }

        const formatDate = (date: Date): string => {
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          return `${day}-${month}-${year}`;
        };

        (async () => {
          try {
            const items = paymentData?.products
              ?.map((item: any) => `${item.DESCRIPT} x ${item.QUANTITY}`)
              .join(", ") || "Item x 1";

            const date = paymentData?.date
              ? formatDate(new Date(paymentData.date))
              : formatDate(new Date());

            const totalAmount = paymentData?.totalAmount?.toFixed(2) || "0.00";
            const cgst = paymentData?.cgstAmount?.toFixed(2) || "0.00";
            const sgst = paymentData?.sgstAmount?.toFixed(2) || "0.00";
            const totalTax = paymentData?.totalGstAmount?.toFixed(2) || "0.00";

            const contactEmail = "contact@tastenbite.com";

         await generatePDFAndSendWhatsApp(
  paymentData,
  paymentData.customerData?.NAME || 'Valued Customer',
  paymentData.customerData?.MOBPHONE || ''
)
.then(() => {
  toast.success("WhatsApp message sent successfully!");
})
.catch((err) => {
  // toast.error("Failed to send WhatsApp message.");
  console.error(err);
});

          } catch (error: any) {
            console.error("Failed to send WhatsApp message:", {
              message: error.message,
              phone: wpNo,
              invoice: invoiceNumber,
              time: new Date().toISOString(),
            });
            // toast.error(`Failed to send WhatsApp message: ${error.message}`, {
            //   position: "bottom-right",
            // });
          }
        })();

      } else {
        console.error("Invalid WhatsApp number:", wpNo, "Raw:", rawPhone);
        // toast.error(`Invalid customer phone number for WhatsApp: ${wpNo}`, {
        //   position: "bottom-right",
        // });
      }

      if (onPayment) {
        await onPayment(paymentData);
      }
      sessionStorage.removeItem("products");
      sessionStorage.removeItem("addedProducts");
      dispatch({
        type: "RESET_STATE",
        payload: {
          products: [],
          addedProducts: [],
          customerData: undefined,
          tenantId: state.tenantId,
          oaNo: undefined,
          currency: currency
        },
      });
      const routeData = {
        number: invoiceNumber,
        model,
      };
      const encryptedData = encryptUrl(JSON.stringify(routeData));
      router.push(`/paymentCondition?data=${encryptedData}`);
    } catch (error) {
      console.error("Error in handlePayment:", error);
      // toast.error(error instanceof Error ? error.message : String(error), {
      //   position: "bottom-right",
      // });
      if (failureAudioRef.current) {
        failureAudioRef.current.currentTime = 0;
        failureAudioRef.current.play().catch((err) => console.warn("Failure audio playback failed:", err));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const payNowColor =
    paymentType === "Cash"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : paymentType === "Card"
        ? "bg-blue-600 hover:bg-blue-700"
        : paymentType === "UPI"
          ? "bg-purple-600 hover:bg-purple-700"
          : paymentType === "Free"
            ? "bg-teal-600 hover:bg-teal-700"
            : paymentType === "Credit"
              ? "bg-indigo-600 hover:bg-indigo-700"
              : paymentType === "OwnerDiscount"
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700";

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join("-");
  };

  return (
    <Suspense
      fallback={
        <div className="text-center text-gray-500 w-full p-4">
          Loading payment options...
        </div>
      }
    >
      <motion.div
        className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-gray-100 max-w-2xl mx-auto w-full"
        variants={itemVariants}
        initial="hidden"
        animate="show"
      >
        {/* Total Amount Due */}
        <motion.div className="flex flex-col items-center mb-8">
          <span className="text-sm uppercase tracking-widest text-gray-400 font-semibold mb-2">
            Total Amount Due
          </span>
          <motion.span
            className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            {currency + " "}{outstandingAmount.toFixed(2)}
          </motion.span>
          <div className="w-24 h-1 bg-gradient-to-r from-teal-400 to-blue-400 rounded-full mt-3"></div>
          {appliedPromo && (
            <motion.div
              className="mt-3 text-sm text-teal-600 flex items-center gap-2"
              variants={promoVariants}
              initial="hidden"
              animate="show"
            >
              <FaTag />
              Promo {appliedPromo.code} applied: {appliedPromo.percentage}% off
              ({currency + " "}{appliedPromo.discount.toFixed(2)})
              <motion.button
                className="ml-2 text-red-500 hover:text-red-700"
                onClick={handleRemovePromo}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Remove promo code"
              >
                <FaTimes />
              </motion.button>
            </motion.div>
          )}
          {appliedOwnerDiscount && (
            <motion.div
              className="mt-3 text-sm text-orange-600 flex items-center gap-2"
              variants={promoVariants}
              initial="hidden"
              animate="show"
            >
              <FaPercentage />
              Owner&rsquo;s Discount applied: {appliedOwnerDiscount.type === "percentage" ? `${appliedOwnerDiscount.value}% off` : `${currency + " "}${appliedOwnerDiscount.value}`}
              ({currency + " "}{appliedOwnerDiscount.discount.toFixed(2)})
              <motion.button
                className="ml-2 text-red-500 hover:text-red-700"
                onClick={handleRemoveOwnerDiscount}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Remove owner's discount"
              >
                <FaTimes />
              </motion.button>
            </motion.div>
          )}
        </motion.div>

        {/* Payment Methods */}
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FaCreditCard className="text-teal-600" /> Payment Methods
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4 mb-8">
          {["Cash", "Card", "UPI", "Free", "Credit", "OwnerDiscount"].map((type) => (
            <motion.div
              key={type}
              className={`p-4 rounded-xl cursor-pointer flex flex-col items-center gap-2 text-center transition-all duration-200 ${paymentType === type
                  ? "bg-teal-500 text-white shadow-lg"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              onClick={() => setPaymentType(type as "Cash" | "Card" | "UPI" | "Free" | "Credit" | "OwnerDiscount")}
              variants={cardVariants}
              animate={paymentType === type ? "active" : "inactive"}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && setPaymentType(type as "Cash" | "Card" | "UPI" | "Free" | "Credit" | "OwnerDiscount")
              }
            >
              {type === "Cash" && <FaMoneyBillWave className="text-3xl" />}
              {type === "Card" && <FaCreditCard className="text-3xl" />}
              {type === "UPI" && <FaMobileAlt className="text-3xl" />}
              {type === "Free" && <FaGift className="text-3xl" />}
              {type === "Credit" && <FaFileInvoice className="text-3xl" />}
              {type === "OwnerDiscount" && <FaPercentage className="text-3xl" />}
              <span className="text-sm font-semibold">{type === "OwnerDiscount" ? "Owner's Discount" : type}</span>
            </motion.div>
          ))}
        </div>

        {/* Payment Details */}
        <AnimatePresence>
          {paymentType && (
            <motion.div
              className="p-6 bg-gray-50 rounded-xl shadow-inner border border-gray-100"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-gray-600">
                  Amount Left:{" "}
                  <span className="text-teal-600">{currency + " "}{amountLeft.toFixed(2)}</span>
                </span>
              </div>

              {paymentType === "Cash" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <FaMoneyBillWave className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter cash amount"
                        value={cashAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (Number(value) > outstandingAmount) {
                            setShakeError(true);
                            setTimeout(() => setShakeError(false), 500);
                          } else {
                            setCashAmount(value);
                          }
                        }}
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                          } focus:outline-none focus:ring-2 focus:ring-teal-500`}
                        aria-label="Cash amount"
                      />
                    </div>
                    <motion.button
                      className="px-4 py-3 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                      onClick={() => handleFullPayment("Cash")}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      aria-label="Pay full amount"
                    >
                      All
                    </motion.button>
                  </div>
                  <div className="relative">
                    <FaComment className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Add a note (optional)"
                      value={cashNote}
                      onChange={(e) => setCashNote(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      aria-label="Cash note"
                    />
                  </div>
                </div>
              )}

              {paymentType === "Card" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <FaCreditCard className="text-blue-600" />
                    Pay {currency + " "}{outstandingAmount.toFixed(2)} via card
                  </div>
                  {savedCards.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm text-gray-600">
                        Saved Cards for {state.customerData?.NAME || "Customer"}:
                      </label>
                      {savedCards.map((card) => (
                        <motion.button
                          key={card.id}
                          className="w-full p-3 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
                          onClick={() => {
                            setCardNumber(formatCardNumber(card.cardNumber));
                            setCardExpiry(card.cardExpiry);
                            setCardCVC(card.cardCVC);
                            setCardHolder(card.cardHolder);
                          }}
                          variants={buttonVariants}
                          whileHover="hover"
                          whileTap="tap"
                        >
                          {card.cardNumber.slice(-4)} (Exp: {card.cardExpiry})
                        </motion.button>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <FaCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Card Number (1234-5678-9012)"
                      value={cardNumber}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, "").slice(0, 12);
                        const formattedValue = formatCardNumber(rawValue);
                        if (e.target.value.replace(/\D/g, "") !== rawValue) {
                          setShakeError(true);
                          setTimeout(() => setShakeError(false), 500);
                        }
                        setCardNumber(formattedValue);
                      }}
                      className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      maxLength={14}
                      aria-label="Card number"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <FaCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, "");
                          if (value.length >= 2) {
                            const month = parseInt(value.slice(0, 2));
                            if (month > 12) {
                              setShakeError(true);
                              setTimeout(() => setShakeError(false), 500);
                              return;
                            }
                            value =
                              value.slice(0, 2) +
                              (value.length > 2 ? "/" + value.slice(2, 4) : "");
                          }
                          setCardExpiry(value.slice(0, 5));
                        }}
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        maxLength={5}
                        aria-label="Card expiry"
                      />
                    </div>
                    <div className="relative flex-1">
                      <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="CVC (3 digits)"
                        value={cardCVC}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 3);
                          if (e.target.value !== value) {
                            setShakeError(true);
                            setTimeout(() => setShakeError(false), 500);
                          }
                          setCardCVC(value);
                        }}
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        maxLength={3}
                        aria-label="Card CVC"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cardholder name"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Cardholder name"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-500"
                      aria-label="Save card"
                    />
                    <span>Save card for future payments</span>
                  </label>
                </div>
              )}

              {paymentType === "UPI" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <FaMobileAlt className="text-purple-600" />
                    Pay via UPI
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {upiNames.map((upi) => (
                      <motion.button
                        key={upi.UPI_NAME}
                        className={`p-4 rounded-xl flex flex-col items-center gap-2 text-center transition-all duration-200 ${selectedUpiApp === upi.UPI_NAME
                            ? "bg-purple-100 border-purple-300"
                            : "bg-white hover:bg-gray-50 border border-gray-200"
                          } shadow-sm`}
                        onClick={() => {
                          setSelectedUpiApp(upi.UPI_NAME);
                          setSelectedUpiId(upi.UPI_ID);
                          setUpiAmounts({
                            ...upiAmounts,
                            [upi.UPI_NAME]: outstandingAmount.toFixed(2),
                          });
                          setShowQR(true);
                          setAmountLeft(0);
                        }}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        aria-label={`Select ${upi.UPI_NAME} for UPI payment`}
                      >
                        <img
                          src={upiImages[upi.UPI_NAME] || upiImages["Default"]}
                          alt={`${upi.UPI_NAME} logo`}
                          className="h-10 w-auto"
                        />
                        <span className="text-sm font-medium">{upi.UPI_NAME}</span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <FaMoneyBillWave className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter UPI amount"
                        value={upiAmounts[selectedUpiApp] || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (Number(value) > outstandingAmount) {
                            setShakeError(true);
                            setTimeout(() => setShakeError(false), 500);
                          } else {
                            setUpiAmounts({ ...upiAmounts, [selectedUpiApp]: value });
                            setShowQR(Number(value) > 0);
                          }
                        }}
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        aria-label="UPI amount"
                      />
                    </div>
                    <motion.button
                      className="px-4 py-3 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                      onClick={() => handleFullPayment("UPI")}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      aria-label="Pay full amount"
                    >
                      Full Amount
                    </motion.button>
                  </div>
                  {showQR && (
                    <motion.div
                      className="flex justify-center mt-4"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <canvas
                        ref={qrCanvasRef}
                        className="border-2 border-purple-200 rounded-lg shadow-md p-2 bg-white"
                        aria-label="UPI QR code"
                      />
                    </motion.div>
                  )}
                </div>
              )}

              {paymentType === "Free" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <FaGift className="text-teal-600" />
                    Free Bill (Admin PIN Required)
                  </div>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      placeholder="Enter Admin PIN"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                        } focus:outline-none focus:ring-2 focus:ring-teal-500`}
                      aria-label="Admin PIN"
                    />
                  </div>
                </div>
              )}

              {paymentType === "Credit" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <FaFileInvoice className="text-indigo-600" />
                    Credit Payment ({currency + " "}{outstandingAmount.toFixed(2)} will be marked as outstanding)
                  </div>
                </div>
              )}

              {paymentType === "OwnerDiscount" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 flex  items-center gap-2">
                    <FaPercentage className="text-orange-600" />
                    Owner&#39;s Discount (OTP Required)
                  </div>
                  <div className="flex lg:flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as "percentage" | "amount")}
                        className="w-full pl-3 pr-8 py-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        aria-label="Discount type"
                      >
                        <option value="percentage">Percentage</option>
                        <option value="amount">Amount</option>
                      </select>
                    </div>
                    <div className="relative flex-1">
                      <FaPercentage className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step={discountType === "percentage" ? "1" : "0.01"}
                        placeholder={`Enter ${discountType === "percentage" ? "percentage" : "amount"}`}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                          } focus:outline-none focus:ring-2 focus:ring-orange-500`}
                        aria-label="Discount value"
                      />
                    </div>
                    <motion.button
                      className="px-4 py-3 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      onClick={sendOtp}
                      disabled={!discountValue || Number(discountValue) <= 0 || otpSent}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      aria-label="Send OTP"
                    >
                      Send OTP
                    </motion.button>
                  </div>
                  {otpSent && (
                    <div className="relative">
                      <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                          } focus:outline-none focus:ring-2 focus:ring-orange-500`}
                        aria-label="OTP"
                      />
                    </div>
                  )}
                </div>
              )}

              <motion.div className="mt-6 flex flex-col gap-3 justify-center">
                <motion.button
                  className={`w-full px-6 py-4 rounded-lg text-base font-semibold shadow-lg flex items-center justify-center gap-2 ${payNowColor} text-white disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed`}
                  onClick={paymentType === "OwnerDiscount" ? verifyOtpAndApplyDiscount : handlePayment}
                  disabled={
                    isProcessing ||
                    !paymentType ||
                    products.length === 0 ||
                    (paymentType === "UPI" &&
                      Object.values(upiAmounts).every((amount) => Number(amount) <= 0)) ||
                    !isPaymentValid()
                  }
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  aria-label={
                    paymentType === "UPI"
                      ? "Proceed"
                      : paymentType === "Free"
                        ? "Process Free Bill"
                        : paymentType === "Credit"
                          ? "Process Credit"
                          : paymentType === "OwnerDiscount"
                            ? "Apply Discount"
                            : "Pay Now"
                  }
                >
                  {isProcessing ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : paymentType === "UPI" ? (
                    "Proceed"
                  ) : paymentType === "Free" ? (
                    "Process Free Bill"
                  ) : paymentType === "Credit" ? (
                    "Process Credit"
                  ) : paymentType === "OwnerDiscount" ? (
                    "Apply Discount"
                  ) : (
                    "Pay Now"
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Promo Code Section */}
        {appliedPromo === null && appliedOwnerDiscount === null ? (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaTag className="text-teal-600" /> Apply Promo Code
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <FaTag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500`}
                  aria-label="Promo code"
                />
              </div>
              <motion.button
                className="px-4 py-3 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                onClick={handleApplyPromo}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                aria-label="Apply promo code"
              >
                Apply
              </motion.button>
            </div>
          </div>
        ) : (
          <></>
        )}

        {/* Draft Bill Button */}
        {model === "sale_bill" && (
          <motion.button
            className={`w-full mt-6 px-6 py-4 rounded-lg text-base font-semibold text-white shadow-lg flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed`}
            onClick={handleDraftBill}
            disabled={isDraftProcessing || !products.length || !state.customerData}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            aria-label="Save Draft Bill"
          >
            {isDraftProcessing ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                Saving Draft...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 4v3H4v1h1v7a1 1 0 001 1h8a1 1 0 001-1V8h1V7h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm7 6H8v2h4v-2zm0-3H8v2h4V7z"
                    clipRule="evenodd"
                  />
                </svg>
                Save Draft
              </>
            )}
          </motion.button>
        )}

        <audio ref={successAudioRef} src="/PaymentSucess.mp3" preload="auto" />
        <audio ref={failureAudioRef} src="/PaymentFailed.mp3" preload="auto" />
      </motion.div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </Suspense>
  );
};

export default PaymentSection;