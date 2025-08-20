/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useRef, useContext, Suspense } from "react";
import { motion, AnimatePresence, spring } from "framer-motion";
import {
  FaCreditCard,
  FaMoneyBillWave,
  FaMobileAlt,
  FaHandHoldingUsd,
  FaGift,
  FaUser,
  FaComment,
  FaLock,
  FaCalendar,
  FaTag,
  FaTimes,
} from "react-icons/fa";
import { Toaster, toast } from "react-hot-toast";
import QRCode from "qrcode";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../../../../firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { CounterContext } from "@/lib/CounterContext";
import { useAuth } from "@/context/AuthContext";
import { roundOff } from "@/config/utils";
import { encryptUrl } from "@/services/encryption";
import { collections } from "@/config";
import {
  fetchWhereNotEqual,
  getPrefixForModel,
  multiEntry,
} from "@/services";
import { decryptUrl } from "@/services/encryption";

interface Product {
  id: string;
  name: string;
  QUANTITY: number;
  price: number;
  PRODCODE?: string;
  DESCRIPT?: string;
  GroupDesc?: string;
  SGroupDesc?: string;
  UOM_SALE?: string;
  DISCOUNTAMT?: number;
  IGST?: number;
}

interface CustomerData {
  name: string;
  MOBPHONE: string;
  ADDRESS?: string;
  CITY?: string;
  COUNTRY?: string;
  CUSTCODE?: string;
}

interface PaymentData {
  products: Product[];
  totalAmount: number;
  totalGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  customerData: CustomerData;
  invoiceNumber: string;
  date: string;
}

const PaymentPage: React.FC = () => {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [paymentType, setPaymentType] = useState<"Cash" | "Card" | "UPI" | "Credit" | "Free" | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [shakeError, setShakeError] = useState(false);
  const [amountLeft, setAmountLeft] = useState(0);
  const [saveCard, setSaveCard] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>("");
  const [selectedUpiId, setSelectedUpiId] = useState<string | null>(null);
  const [upiAmounts, setUpiAmounts] = useState<{ [key: string]: string }>({});
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditPlan, setCreditPlan] = useState("");
  const [freeReason, setFreeReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraftProcessing, setIsDraftProcessing] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percentage: number; discount: number } | null>(null);
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [tenantId] = useState("P2324");
  const [modelName] = useState("Sale Bill");
  const successAudioRef = useRef<HTMLAudioElement>(null);
  const failureAudioRef = useRef<HTMLAudioElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, dispatch } = useContext(CounterContext);
  const { myCollection, tenant, user } = useAuth();
  const currentTenant = tenant?.tenant_id || tenantId;
  const currency = state.currency || "₹"
  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
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
    show: { opacity: 1, scale: 1, transition: { duration: 0.3, type: spring, stiffness: 200 } },
  };

  const upiImages: { [key: string]: string } = {
    PhonePe: "/PhonePe.png",
    GooglePay: "/Gpay.webp",
    PAYTM: "/Paytm.png",
    BHIM: "/images/bhim.png",
    Default: "/Upi.jpg",
  };

  const [upiNames, setUpiNames] = useState<any[]>([]);

  // Decode payment data from URL
  useEffect(() => {
    const data = searchParams?.get("data");
    if (data) {
      try {
        const decodedData = JSON.parse(decryptUrl(data));
        setPaymentData(decodedData);
        setOutstandingAmount(decodedData.totalAmount);
        setAmountLeft(decodedData.totalAmount);
      } catch (error) {
        console.error("Error parsing payment data:", error);
        // toast.error("Invalid payment data");
        router.push("/");
      }
    } else {
      // toast.error("No payment data found");
      router.push("/");
    }
  }, [searchParams, router]);

  // Fetch UPI data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchWhereNotEqual(myCollection(collections.GL_MAST), "UPI_NAME", "");
        setUpiNames(data);
      } catch (error) {
        console.error("Failed to fetch UPI data:", error);
      }
    };
    fetchData();
  }, [myCollection]);

  // Fetch saved cards
  useEffect(() => {
    if (paymentType === "Card" && paymentData?.customerData?.MOBPHONE) {
      const fetchSavedCards = async () => {
        try {
          const cardsQuery = query(
            collection(db, `TenantsDb/${currentTenant}/Cards`),
            where("MOBPHONE", "==", paymentData.customerData.MOBPHONE)
          );
          const cardsSnapshot = await getDocs(cardsQuery);
          const cards = cardsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setSavedCards(cards);
        } catch (error) {
          console.error("Failed to fetch saved cards:", error);
          // toast.error("Failed to load saved cards", { position: "bottom-right" });
        }
      };
      fetchSavedCards();
    }
  }, [paymentType, paymentData?.customerData?.MOBPHONE, currentTenant]);

  // Reset payment inputs and apply full amount
  useEffect(() => {
    if (paymentType && ["Cash", "Credit", "Card", "UPI"].includes(paymentType)) {
      const fullAmount = outstandingAmount.toFixed(2);
      if (paymentType === "Cash") {
        setCashAmount(fullAmount);
        setAmountLeft(0);
      }
      if (paymentType === "Credit") {
        setCreditAmount(fullAmount);
        setAmountLeft(0);
      }
      if (paymentType === "Card") {
        setAmountLeft(0);
      }
      if (paymentType === "UPI" && selectedUpiApp) {
        setUpiAmounts({ ...upiAmounts, [selectedUpiApp]: fullAmount });
        setShowQR(true);
        setAmountLeft(0);
      }
    }
  }, [paymentType, outstandingAmount, selectedUpiApp, upiAmounts]);

  // Auto-select first UPI app
  useEffect(() => {
    if (paymentType === "UPI" && upiNames.length > 0 && !selectedUpiApp) {
      const firstUpi = upiNames[0];
      setSelectedUpiApp(firstUpi.UPI_NAME);
      setSelectedUpiId(firstUpi.UPI_ID);
      setUpiAmounts({ [firstUpi.UPI_NAME]: outstandingAmount.toFixed(2) });
      setShowQR(true);
      setAmountLeft(0);
    }
  }, [paymentType, upiNames, outstandingAmount, selectedUpiApp]);

  // Generate QR code
  useEffect(() => {
    if (showQR && qrCanvasRef.current && selectedUpiId && upiAmounts[selectedUpiApp] && Number(upiAmounts[selectedUpiApp]) > 0) {
      const upiUrl = `upi://pay?pa=${selectedUpiId}&am=${Number(upiAmounts[selectedUpiApp]).toFixed(2)}&cu=INR`;
      QRCode.toCanvas(qrCanvasRef.current, upiUrl, { width: 180, margin: 2 }, (err) => {
        if (err) console.error("QR Code generation failed:", err);
      });
    }
  }, [showQR, selectedUpiId, upiAmounts, selectedUpiApp]);

  // Reset payment inputs on type change
  useEffect(() => {
    setUpiAmounts({});
    setCashAmount("");
    setCreditAmount("");
    setShowQR(false);
    setAmountLeft(outstandingAmount);
    if (paymentType !== "UPI") {
      setSelectedUpiApp("");
      setSelectedUpiId(null);
    }
  }, [paymentType, outstandingAmount]);

  // Update amount left
  useEffect(() => {
    let totalPaid = 0;
    if (paymentType === "Cash") totalPaid = Number(cashAmount) || 0;
    else if (paymentType === "Card") totalPaid = outstandingAmount;
    else if (paymentType === "UPI") {
      totalPaid = Object.values(upiAmounts).reduce(
        (sum, amount) => sum + (Number(amount) || 0),
        0
      );
    } else if (paymentType === "Credit") totalPaid = Number(creditAmount) || 0;
    else if (paymentType === "Free") totalPaid = outstandingAmount;
    setAmountLeft(Math.max(outstandingAmount - totalPaid, 0));
  }, [cashAmount, upiAmounts, creditAmount, paymentType, outstandingAmount]);

  // Apply promo code
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      // toast.error("Please enter a promo code", { position: "bottom-right" });
      return;
    }
    try {
      const promo = query(
        collection(db, `TenantsDb/${currentTenant}/PROMOCODES`),
        where("code", "==", promoCode.trim().toUpperCase())
      );
      const promoSnapshot = await getDocs(promo);
      if (promoSnapshot.empty) {
        // toast.error("Invalid promo code", { position: "bottom-right" });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        return;
      }
      const promoData = promoSnapshot.docs[0].data();
      const percentage = Number(promoData.percentage) || 0;
      const discount = Number(
        roundOff(paymentData!.totalAmount * (percentage / 100))
      );
      const newOutstanding = roundOff(
        paymentData!.totalAmount - Number(discount)
      );
      setAppliedPromo({
        code: promoCode.trim().toUpperCase(),
        percentage,
        discount,
      });
      setOutstandingAmount(Number(newOutstanding));
      setAmountLeft(Number(newOutstanding));
      toast.success(
        `Promo code applied! ${percentage}% off (${currency}${discount.toFixed(2)})`,
        {
          position: "bottom-right",
        }
      );
      setPromoCode("");
    } catch (error) {
      console.error("Error applying promo code:", error);
      // toast.error("Failed to apply promo code", { position: "bottom-right" });
    }
  };

  // Remove promo code
  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setOutstandingAmount(paymentData!.totalAmount);
    setAmountLeft(paymentData!.totalAmount);
    toast.success("Promo code removed", { position: "bottom-right" });
  };

  // Handle full payment
  const handleFullPayment = (type: "Cash" | "Credit" | "UPI") => {
    const fullAmount = outstandingAmount.toFixed(2);
    if (type === "Cash") {
      setCashAmount(fullAmount);
      setAmountLeft(0);
    } else if (type === "Credit") {
      setCreditAmount(fullAmount);
      setAmountLeft(0);
    } else if (type === "UPI" && selectedUpiApp) {
      setUpiAmounts({ ...upiAmounts, [selectedUpiApp]: fullAmount });
      setShowQR(true);
      setAmountLeft(0);
    }
  };

  const getDOCnum = async (): Promise<string> => {
    const prefix = await getPrefixForModel(currentTenant, modelName);
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

  // Save customer if not exists
  const saveCustomerIfNotExists = async (customerData: CustomerData) => {
    try {
      if (!customerData.MOBPHONE) return;
      const customerQuery = query(
        collection(db, `TenantsDb/${currentTenant}/Customers`),
        where("MOBPHONE", "==", customerData.MOBPHONE)
      );
      const customerSnapshot = await getDocs(customerQuery);
      if (customerSnapshot.empty) {
        await addDoc(collection(db, `TenantsDb/${currentTenant}/Customers`), {
          NAME: customerData.name || "",
          MOBPHONE: customerData.MOBPHONE || "",
          ADDRESS: customerData.ADDRESS || "",
          CITY: customerData.CITY || "",
          COUNTRY: customerData.COUNTRY || "",
          CUSTCODE: customerData.CUSTCODE || "",
          CUST_VEND: "C",
          createdAt: Timestamp.fromDate(new Date()),
        });
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      // toast.error("Failed to save customer details", { position: "bottom-right" });
    }
  };

  // Handle draft bill
  const handleDraftBill = async () => {
    if (isDraftProcessing || !paymentData?.products.length || !paymentData?.customerData) {
      // toast.error("Missing products or customer information", { position: "bottom-right" });
      return;
    }
    setIsDraftProcessing(true);
    try {
      await saveCustomerIfNotExists(paymentData.customerData);
      const billNo = await generateBillNo();
      const currentTimestamp = Timestamp.fromDate(new Date());
      const customerData = paymentData.customerData;
      const draftRef = query(
        collection(db, "TenantsDb", currentTenant, "DRAFT"),
        where("bill.MOBPHONE", "==", customerData.MOBPHONE || "")
      );
      const snapshot = await getDocs(draftRef);
      if (!snapshot.empty) {
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, "TenantsDb", currentTenant, "DRAFT", docSnap.id));
        }
      }
      const basicAmount = paymentData.products.reduce(
        (sum, item) => sum + Number(item.price) * Math.abs(Number(item.QUANTITY)) - (Number(item.DISCOUNTAMT) || 0),
        0
      );
      const igstPercent = paymentData.products[0]?.IGST || 18;
      const gstAmount = roundOff(basicAmount * (igstPercent / 100));
      const cgstAmount = roundOff(Number(gstAmount) / 2);
      const sgstAmount = roundOff(Number(gstAmount) / 2);
      const discountAmount = appliedPromo ? appliedPromo.discount : 0;
      const netAmount = roundOff(Number(basicAmount) + Number(gstAmount) - discountAmount);
      const billData = {
        BILL_DATE: currentTimestamp,
        BILL_NO: billNo,
        bill: {
          ADDRESS: customerData.ADDRESS || "",
          BASIC: roundOff(basicAmount),
          BILL_DATE: currentTimestamp,
          BILL_NO: billNo,
          CARD_RECEIVED: 0,
          CASH_RECEIVED: 0,
          CGST_AMT: cgstAmount,
          CITY: customerData.CITY || "",
          COUNTRY: customerData.COUNTRY || "",
          CREDIT_RECEIVED: netAmount,
          CUSTCODE: Number(customerData.CUSTCODE) || 0,
          CUSTNAME: customerData.name || "",
          GST_AMT: gstAmount,
          IS_CREDIT: "YES",
          IS_DRAFT: "YES",
          IS_FREE: "NO",
          MOBPHONE: customerData.MOBPHONE || "",
          NET_AMT: netAmount,
          OUTSTANDING_AMT: netAmount,
          PAY_MODE: "CREDIT",
          SGST_AMT: sgstAmount,
          TERMTOTAL: 0,
          UPI_DETAILS: [],
          UPI_RECEIVED: 0,
          PROMO_CODE: appliedPromo ? appliedPromo.code : "",
          PROMO_DISCOUNT: appliedPromo ? appliedPromo.discount : 0,
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
        productEntries: paymentData.products.map((item) => {
          const quantity = Math.abs(Number(item.QUANTITY)) || 0;
          const rate = Number(item.price) || 0;
          const discount = Number(item.DISCOUNTAMT) || 0;
          const baseAmt = rate * quantity - discount;
          const igstRate = Number(item.IGST) || 18;
          const gstAmt = roundOff(baseAmt * (igstRate / 100));
          const cgstAmt = roundOff(Number(gstAmt) / 2);
          const sgstAmt = roundOff(Number(gstAmt) / 2);
          return {
            AMOUNT: roundOff(baseAmt),
            BILL_DATE: currentTimestamp,
            BILL_NO: billNo,
            CGSTAMT: cgstAmt,
            CUSTNAME: customerData.name || "",
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
            SGroupDesc: item.SGroupDesc || "",
            TOTALAMT: roundOff(Number(baseAmt) + Number(gstAmt)),
            UOM: item.UOM_SALE || "PCS",
          };
        }),
      };
      await addDoc(collection(db, "TenantsDb", currentTenant, "DRAFT"), billData);
      // Store bill number in localStorage as lastTransaction for draft
      localStorage.setItem('lastTransaction', billNo);
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

  // Handle payment submission
  const handlePaymentSubmit = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e && typeof (e as React.SyntheticEvent).preventDefault === "function") e.preventDefault();
    if (isProcessing || !paymentData) {
      // toast.error("No payment data available", { position: "bottom-right" });
      return;
    }
    if (!paymentType) {
      // toast.error("Please select a payment type.", { position: "bottom-right" });
      return;
    }
    if (paymentType === "Free" && adminPin !== "admin1234") {
      // toast.error("Incorrect Admin PIN.", { position: "bottom-right" });
      setShakeError(true);
      setTimeout(() => setShakeError(false), 2000);
      return;
    }
    if (amountLeft > 0 && paymentType !== "Free") {
      // toast.error(`Please cover the remaining amount: ${currency} ${amountLeft.toFixed(2)}`, { position: "bottom-right" });
      setShakeError(true);
      setTimeout(() => setShakeError(false), 2000);
      return;
    }
    setIsProcessing(true);
    try {
      await saveCustomerIfNotExists(paymentData.customerData);
      const customerData = paymentData.customerData;
      const draftRef = query(
        collection(db, "TenantsDb", currentTenant, "DRAFT"),
        where("bill.MOBPHONE", "==", customerData.MOBPHONE || "")
      );
      const snapshot = await getDocs(draftRef);
      if (!snapshot.empty) {
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, "TenantsDb", currentTenant, "DRAFT", docSnap.id));
        }
      }
      const invoiceNumber = await generateBillNo();
      const date = new Date();
      if (paymentType === "Card" && saveCard && paymentData.customerData.MOBPHONE) {
        await addDoc(collection(db, `TenantsDb/${currentTenant}/Cards`), {
          cardNumber: cardNumber.replace(/-/g, ""),
          cardExpiry,
          cardCVC,
          cardHolder,
          MOBPHONE: paymentData.customerData.MOBPHONE,
          timestamp: Date.now(),
        });
        setSavedCards([...savedCards, { cardNumber, cardExpiry, cardCVC, cardHolder }]);
      }
      const baseAmount = paymentData.products.reduce(
        (total, product) => total + Number(product.price) * Math.abs(Number(product.QUANTITY)) - (Number(product.DISCOUNTAMT) || 0),
        0
      );
      const discountAmount = appliedPromo ? appliedPromo.discount : 0;
      const productEntries = paymentData.products.map((product) => {
        const quantity = Math.abs(Number(product.QUANTITY)) || 0;
        const rate = Number(product.price) || 0;
        const discount = Number(product.DISCOUNTAMT) || 0;
        const baseAmt = rate * quantity - discount;
        const igstRate = Number(product.IGST) || 18;
        const gstAmt = roundOff(baseAmt * (igstRate / 100));
        const cgstAmt = roundOff(Number(gstAmt) / 2);
        const sgstAmt = roundOff(Number(gstAmt) / 2);
        return {
          collectionRef: myCollection(collections.BILLDET),
          data: {
            BILL_NO: invoiceNumber,
            BILL_DATE: date,
            CUSTNAME: customerData.name || "",
            PRODCODE: product.PRODCODE || "",
            PRODNAME: product.DESCRIPT || product.name || "",
            GroupDesc: product.GroupDesc || "",
            SGroupDesc: product.SGroupDesc || "",
            QUANTITY: quantity,
            UOM: product.UOM_SALE || "",
            RATE: rate,
            PRODTOTAL: roundOff(rate * quantity),
            AMOUNT: roundOff(baseAmt),
            IGSTPER: igstRate,
            IGSTAMT: gstAmt,
            CGSTAMT: cgstAmt,
            SGSTAMT: sgstAmt,
            GSTAMT: gstAmt,
            TOTALAMT: roundOff(Number(baseAmt) + Number(gstAmt)),
          },
        };
      });
      const confirmedPayments = {
        cash: paymentType === "Cash" ? Number(cashAmount) || outstandingAmount : 0,
        card: paymentType === "Card" ? outstandingAmount : 0,
        upi: paymentType === "UPI" ? Object.entries(upiAmounts).filter(([_, amount]) => Number(amount) > 0).map(([method, amount]) => ({ method, amount: Number(amount) })) : [],
        credit: paymentType === "Credit" ? Number(creditAmount) || outstandingAmount : 0,
      };
      const totalUpiAmount = confirmedPayments.upi.reduce((sum, upi) => sum + upi.amount, 0);
      const paymentFields = {
        PAY_MODE: paymentType === "Free" ? "FREE" : [
          confirmedPayments.cash > 0 ? "CASH" : "",
          confirmedPayments.upi.some((upi) => upi.amount > 0) ? "UPI" : "",
          confirmedPayments.card > 0 ? "CARD" : "",
          confirmedPayments.credit > 0 ? "CREDIT" : "",
        ].filter(Boolean).join(", "),
        CASH_AMOUNT: Number(cashAmount) || 0,
        UPI_AMOUNT: totalUpiAmount,
        CARD_AMOUNT: confirmedPayments.card || 0,
        CREDIT_AMOUNT: Number(creditAmount) || 0,
        TOTAL_UPI_AMOUNT: totalUpiAmount || 0,
        UPI_DETAILS: paymentType === "UPI" ? confirmedPayments.upi.map((upi) => ({ method: upi.method || "", amount: Number(upi.amount) || 0 })) : [],
        IS_CREDIT: paymentType === "Credit" || confirmedPayments.credit > 0,
        IS_FREE: paymentType === "Free",
        OUTSTANDING_AMOUNT: roundOff(amountLeft),
        PROMO_CODE: appliedPromo ? appliedPromo.code : "",
        PROMO_DISCOUNT: appliedPromo ? appliedPromo.discount : 0,
      };
      const mainEntry = {
        collectionRef: myCollection(collections.BILL),
        data: {
          BILL_NO: invoiceNumber,
          BILL_DATE: date,
          CUST_CODE: customerData.CUSTCODE || "",
          CUSTNAME: customerData.name || "",
          MOBPHONE: customerData.MOBPHONE || "",
          ADDRESS: customerData.ADDRESS || "",
          CITY: customerData.CITY || "",
          COUNTRY: customerData.COUNTRY || "",
          BASIC: roundOff(baseAmount),
          TERMTOTAL: 0,
          GST_AMOUNT: paymentData.totalGstAmount,
          CGST_AMOUNT: paymentData.cgstAmount,
          SGST_AMOUNT: paymentData.sgstAmount,
          NET_AMOUNT: roundOff(paymentData.totalAmount - discountAmount),
          ...paymentFields,
        },
      };
      const termEntry = {
        collectionRef: myCollection(collections.BILLTERM),
        data: {
          BILL_NO: invoiceNumber,
          BILL_DATE: date,
          SEQUENCE: "",
          PERCENTAGE: "",
          AMOUNT: "",
          DESCRIPT: "",
        },
      };
      await multiEntry([mainEntry, termEntry, ...productEntries]);
      for (const product of paymentData.products) {
        const prodCode = product.PRODCODE;
        if (prodCode) {
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
      }
      await addDoc(collection(db, "TenantsDb", currentTenant, "Payments"), {
        invoiceNumber,
        customerName: customerData.name,
        customerPhone: paymentData.customerData.MOBPHONE,
        products: paymentData.products,
        totalAmount: paymentData.totalAmount - discountAmount,
        totalGstAmount: paymentData.totalGstAmount,
        cgstAmount: paymentData.cgstAmount,
        sgstAmount: paymentData.sgstAmount,
        paymentMethod: paymentType,
        paymentDate: Timestamp.fromDate(date),
        status: "COMPLETED",
        createdAt: Timestamp.fromDate(date),
        promoCode: appliedPromo ? appliedPromo.code : null,
        promoDiscount: appliedPromo ? appliedPromo.discount : 0,
      });
      // Store invoiceNumber in localStorage as lastTransaction
      localStorage.setItem('lastTransaction', invoiceNumber);
      if (successAudioRef.current) {
        successAudioRef.current.currentTime = 0;
        successAudioRef.current.play().catch((err) => console.warn("Success audio playback failed:", err));
      }
      toast.success("Payment recorded successfully!", { position: "bottom-right" });
      const newPaymentData = {
        paymentType,
        products: paymentData.products,
        invoiceNumber,
        date: date.toISOString(),
        customerData,
        totalAmount: paymentData.totalAmount - discountAmount,
        totalGstAmount: paymentData.totalGstAmount,
        cgstAmount: paymentData.cgstAmount,
        sgstAmount: paymentData.sgstAmount,
        confirmedPayments,
        finalOutstandingAmount: amountLeft,
        model: "sale_bill",
        paymentDetails: {
          cashAmount: Number(cashAmount) || 0,
          cardAmount: confirmedPayments.card || 0,
          upiAmounts,
          totalUpiAmount: totalUpiAmount || 0,
          creditAmount: Number(creditAmount) || 0,
        },
        promoCode: appliedPromo ? appliedPromo.code : null,
        promoDiscount: appliedPromo ? appliedPromo.discount : 0,
      };
      const encryptedData = encryptUrl(JSON.stringify(newPaymentData));
      router.push(`/paymentCondition?data=${encryptedData}`);
    } catch (error) {
      console.error("Error recording payment:", error);
      // toast.error(error instanceof Error ? error.message : String(error), { position: "bottom-right" });
      if (failureAudioRef.current) {
        failureAudioRef.current.currentTime = 0;
        failureAudioRef.current.play().catch((err) => console.warn("Failure audio playback failed:", err));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle print bill
  const handlePrintBill = () => {
    window.print();
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join("-");
  };

  const isCardDetailsValid = () => {
    if (paymentType !== "Card") return true;
    return (
      cardNumber.replace(/\D/g, "").length === 12 &&
      /^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(cardExpiry) &&
      cardCVC.length === 3 &&
      cardHolder.trim().length > 0
    );
  };

  if (!paymentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  const { products, totalAmount, totalGstAmount, cgstAmount, sgstAmount, customerData, invoiceNumber, date } = paymentData;

  const payNowColor =
    paymentType === "Cash"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : paymentType === "Card"
      ? "bg-blue-600 hover:bg-blue-700"
      : paymentType === "UPI"
      ? "bg-purple-600 hover:bg-purple-700"
      : paymentType === "Credit"
      ? "bg-orange-600 hover:bg-orange-700"
      : paymentType === "Free"
      ? "bg-pink-600 hover:bg-pink-700"
      : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700";

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-inter">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <h1 className="text-4xl font-bold text-center py-6 text-blue-700">
          Payment & Bill
        </h1>
        <div className="p-8">
          {/* Bill Details */}
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">Invoice Number</p>
                <p className="text-lg text-gray-800">{invoiceNumber}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Date</p>
                <p className="text-lg text-gray-800">{format(new Date(date), "PPP")}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Customer Name</p>
                <p className="text-lg text-gray-800">{customerData.name}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Mobile Number</p>
                <p className="text-lg text-gray-800">{customerData.MOBPHONE}</p>
              </div>
            </div>
          </div>

          {/* Product Table */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Order Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-700">
                <thead className="text-xs uppercase bg-gray-100">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-3">{product.name}</td>
                      <td className="px-4 py-3">{product.QUANTITY}</td>
                      <td className="px-4 py-3">{currency}{product.price.toFixed(2)}</td>
                      <td className="px-4 py-3">{currency}{(product.QUANTITY * product.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Payment Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="text-sm font-semibold text-gray-600">Subtotal</p>
                <p className="text-lg text-gray-800">{currency}{(outstandingAmount - totalGstAmount).toFixed(2)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm font-semibold text-gray-600">CGST (9%)</p>
                <p className="text-lg text-gray-800">{currency}{cgstAmount.toFixed(2)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm font-semibold text-gray-600">SGST (9%)</p>
                <p className="text-lg text-gray-800">{currency}{sgstAmount.toFixed(2)}</p>
              </div>
              {appliedPromo && (
                <div className="flex justify-between">
                  <p className="text-sm font-semibold text-gray-600">Discount ({appliedPromo.percentage}%)</p>
                  <p className="text-lg text-gray-800">{currency}{appliedPromo.discount.toFixed(2)}</p>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <p className="text-lg font-semibold text-gray-800">Total Amount</p>
                <p className="text-lg font-bold text-gray-800">{currency}{outstandingAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <motion.div
            className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-gray-100 max-w-2xl mx-auto w-full"
            variants={itemVariants}
            initial="hidden"
            animate="show"
          >
            {/* Total Amount Due */}
            <motion.div className="flex flex-col items-center mb-8 text-center">
              <span className="text-sm uppercase tracking-widest text-gray-500 font-medium mb-2">
                Total Amount Due
              </span>
              <motion.span
                className="text-5xl font-semibold text-blue-600"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: 0 }}
              >
                {currency}{amountLeft.toFixed(2)}
              </motion.span>
              <div className="w-24 h-1 bg-blue-700 rounded-full mt-3"></div>
              {appliedPromo && (
                <motion.div
                  className="mt-4 text-sm text-green-600 flex items-center gap-2"
                  variants={promoVariants}
                  initial="hidden"
                  animate="show"
                >
                  <FaTag className="text-green-500" />
                  Promo {appliedPromo.code} applied: {appliedPromo.percentage}% off
                  ({currency} {appliedPromo.discount.toFixed(2)})
                  <motion.button
                    className="ml-2 text-red-500 hover:text-red-700"
                    onClick={handleRemovePromo}
                    whileHover="hover"
                    whileTap="tap"
                    aria-label="Remove promo code"
                  >
                    <FaTimes />
                  </motion.button>
                </motion.div>
              )}
            </motion.div>

            {/* Payment Methods */}
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaCreditCard className="text-blue-600" />
              Payment Methods
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {["Cash", "Card", "UPI", "Credit", "Free"].map((type) => (
                <motion.div
                  key={type}
                  className={`p-4 rounded-xl cursor-pointer flex flex-col items-center gap-2 text-center transition-all duration-200 ${
                    paymentType === type
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-blue-100 border border-blue-200"
                  }`}
                  onClick={() => setPaymentType(type as "Cash" | "Card" | "UPI" | "Credit" | "Free")}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPaymentType(type as "Cash" | "Card" | "UPI" | "Credit" | "Free");
                    }
                  }}
                >
                  {type === "Cash" && <FaMoneyBillWave className="text-3xl" />}
                  {type === "Card" && <FaCreditCard className="text-3xl" />}
                  {type === "UPI" && <FaMobileAlt className="text-3xl" />}
                  {type === "Credit" && <FaHandHoldingUsd className="text-3xl" />}
                  {type === "Free" && <FaGift className="text-3xl" />}
                  <span className="text-sm font-medium">{type}</span>
                </motion.div>
              ))}
            </div>

            {/* Payment Details */}
            <AnimatePresence>
              {paymentType && (
                <motion.div
                  className="p-6 bg-gray-50 rounded-xl border border-blue-100 shadow-inner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-gray-600">
                      Amount Left: <span className="text-blue-600">{currency} {amountLeft.toFixed(2)}</span>
                    </span>
                  </div>

                  {paymentType === "Cash" && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <FaMoneyBillWave className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
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
                            className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                              shakeError ? "border-red-500 animate-shake" : "border-gray-200"
                            } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                            aria-label="Cash amount"
                          />
                        </div>
                        <motion.button
                          className="bg-blue-600 px-4 py-3 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                          onClick={() => handleFullPayment("Cash")}
                          variants={buttonVariants}
                          whileHover="hover"
                          whileTap="tap"
                          aria-label="Pay full amount"
                        >
                          Full Amount
                        </motion.button>
                      </div>
                      <div className="relative">
                        <FaComment className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Add a note (optional)"
                          value={cashNote}
                          onChange={(e) => setCashNote(e.target.value)}
                          className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          aria-label="Cash note"
                        />
                      </div>
                    </div>
                  )}

                  {paymentType === "Card" && (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <FaCreditCard className="text-blue-600" />
                        Pay {currency} {outstandingAmount.toFixed(2)} via card
                      </div>
                      {savedCards.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-sm text-gray-600">
                            Saved Cards for {customerData.name || "Customer"}:
                          </label>
                          {savedCards.map((card) => (
                            <motion.button
                              key={card.id}
                              className="w-full p-3 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
                              onClick={() => {
                                setCardNumber(formatCardNumber(card.cardNumber));
                                setCardExpiry(card.cardCVC);
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
                          className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                            shakeError ? "border-red-500 animate-shake" : "border-gray-300"
                          } focus:outline-none focus:ring-2 focus:ring-blue-600`}
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
                                value = value.slice(0, 2) + (value.length > 2 ? "/" + value.slice(2, 4) : "");
                              }
                              setCardExpiry(value.slice(0, 5));
                            }}
                            className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                              shakeError ? "border-red-500 animate-shake" : "border-gray-300"
                            } focus:outline-none focus:ring-2 focus:ring-blue-600`}
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
                            className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                              shakeError ? "border-red-500 animate-shake" : "border-gray-300"
                            } focus:outline-none focus:ring-2 focus:ring-blue-600`}
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
                          className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          aria-label="Cardholder name"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={saveCard}
                          onChange={(e) => setSaveCard(e.target.checked)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                          aria-label="Save card"
                        />
                        <span>Save card for future payments</span>
                      </label>
                    </div>
                  )}

                  {paymentType === "UPI" && (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <FaMobileAlt className="text-blue-600" />
                        Pay via UPI
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {upiNames.map((upiBLANK) => (
                          <motion.button
                            key={upiBLANK.UPI_NAME}
                            className={`p-4 rounded-xl flex flex-col items-center gap-2 text-center transition-all duration-200 ${
                              selectedUpiApp === upiBLANK.UPI_NAME
                                ? "bg-blue-100 border-blue-300"
                                : "bg-white hover:bg-gray-50 border-gray-200"
                            } shadow-sm`}
                            onClick={() => {
                              setSelectedUpiApp(upiBLANK.UPI_NAME);
                              setSelectedUpiId(upiBLANK.UPI_ID);
                              setUpiAmounts({
                                ...upiAmounts,
                                [upiBLANK.UPI_NAME]: outstandingAmount.toFixed(2),
                              });
                              setShowQR(true);
                              setAmountLeft(0);
                            }}
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                            aria-label={`Select ${upiBLANK.UPI_NAME} for UPI payment`}
                          >
                            <img
                              src={upiImages[upiBLANK.UPI_NAME] || upiImages["Default"]}
                              alt={`${upiBLANK.UPI_NAME} logo`}
                              className="h-10 w-auto"
                            />
                            <span className="text-sm font-medium">{upiBLANK.UPI_NAME}</span>
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
                                setUpiAmounts({
                                  ...upiAmounts,
                                  [selectedUpiApp]: value,
                                });
                                setShowQR(Number(value) > 0);
                              }
                            }}
                            className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                              shakeError ? "border-red-500 animate-shake" : "border-gray-300"
                            } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                            aria-label="UPI amount"
                          />
                        </div>
                        <motion.button
                          className="px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
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
                            className="border-2 border-blue-200 rounded-lg shadow-md p-2 bg-white"
                            aria-label="UPI QR code"
                          />
                        </motion.div>
                      )}
                    </div>
                  )}

                  {paymentType === "Credit" && (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <FaHandHoldingUsd className="text-orange-600" />
                        Partial payment (up to {currency}{outstandingAmount.toFixed(2)})
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <FaMoneyBillWave className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="number"
                            placeholder="Enter credit amount"
                            value={creditAmount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (Number(value) > outstandingAmount) {
                                setShakeError(true);
                                setTimeout(() => setShakeError(false), 500);
                              } else {
                                setCreditAmount(value);
                              }
                            }}
                            className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                              shakeError ? "border-red-500 animate-shake" : "border-gray-300"
                            } focus:outline-none focus:ring-2 focus:ring-orange-600`}
                            min="0.01"
                            step="0.01"
                            aria-label="Credit amount"
                          />
                        </div>
                        <motion.button
                          className="px-4 py-3 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
                          onClick={() => handleFullPayment("Credit")}
                          variants={buttonVariants}
                          whileHover="hover"
                          whileTap="tap"
                          aria-label="Pay full amount"
                        >
                          Full Amount
                        </motion.button>
                      </div>
                      <div className="relative">
                        <FaComment className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Reason for credit (e.g., delayed payment)"
                          value={creditReason}
                          onChange={(e) => setCreditReason(e.target.value)}
                          className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-600"
                          aria-label="Credit reason"
                        />
                      </div>
                      <div className="relative">
                        <FaCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          value={creditPlan}
                          onChange={(e) => setCreditPlan(e.target.value)}
                          className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-600"
                          aria-label="Credit plan"
                        >
                          <option value="" disabled>Select Payment Plan</option>
                          <option value="30 Days">30 Days</option>
                          <option value="60 Days">60 Days</option>
                          <option value="90 Days">90 Days</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {paymentType === "Free" && (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <FaGift className="text-pink-600" />
                        Mark as free (0.00) {currency}
                      </div>
                      <div className="relative">
                        <FaComment className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Reason for free bill (e.g., promotion)"
                          value={freeReason}
                          onChange={(e) => setFreeReason(e.target.value)}
                          className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-600"
                          aria-label="Free bill reason"
                        />
                      </div>
                      <div className="relative">
                        <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          placeholder="Admin PIN"
                          value={adminPin}
                          onChange={(e) => setAdminPin(e.target.value)}
                          className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-600"
                          aria-label="Admin PIN"
                        />
                      </div>
                    </div>
                  )}

                  <motion.div className="mt-6 flex flex-col gap-3 justify-center">
                    <motion.button
                      className={`w-full px-6 py-4 rounded-lg text-base font-semibold shadow-lg flex items-center justify-center gap-2 ${payNowColor} text-white disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed`}
                      onClick={handlePaymentSubmit}
                      disabled={
                        isProcessing ||
                        !paymentType ||
                        (paymentType !== "Free" && products.length === 0) ||
                        (paymentType === "UPI" && Object.values(upiAmounts).every((amount) => Number(amount) <= 0)) ||
                        (paymentType === "Free" && !adminPin) ||
                        !isCardDetailsValid()
                      }
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      aria-label={
                        paymentType === "Free" ? "Confirm Free Bill" :
                        paymentType === "UPI" ? "Proceed" :
                        "Pay Now"
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
                      ) : paymentType === "Free" ? (
                        "Confirm Free Bill"
                      ) : paymentType === "UPI" ? (
                        "Proceed"
                      ) : (
                        "Pay Now"
                      )}
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Promo Code Section */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaTag className="text-blue-600" />
                Apply Promo Code
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <FaTag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                      shakeError ? "border-red-500 animate-shake" : "border-gray-300"
                    } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                    aria-label="Promo code"
                  />
                </div>
                <motion.button
                  className="bg-blue-600 px-4 py-3 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
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

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 mt-6">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)" }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handlePrintBill}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-300 transition-all"
              >
                Print Bill
              </motion.button>
              <motion.button
                className={`px-6 py-4 rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed`}
                onClick={handleDraftBill}
                disabled={isDraftProcessing || !products.length || !paymentData.customerData}
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
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="opacity-25"
                      />
                      <path
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                        className="opacity-75"
                      />
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
                        d="M5 4v3H4v3h1v7a1 1 0 001 1h8a1 1 0 001-1V8h1V7h-1V4a1 1 0 00-1-1h-8a1 1 0 00-1 1zm7 6H8v2h4v-2zm0-3H8v2h4V7z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Save Draft
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>

          <audio ref={successAudioRef} src="/audio/PaymentSuccess.mp3" preload="auto" />
          <audio ref={failureAudioRef} src="/audio/PaymentFailure.mp3" preload="auto" />
        </div>

        <style jsx>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .min-h-screen,
            .min-h-screen * {
              visibility: visible;
            }
            .min-h-screen {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              box-shadow: none;
            }
            button,
            .flex.space-x-4 {
              display: none !important;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 10px;
            }
            h2 {
              font-size: 18px;
              margin-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th,
            td {
              border: 1px solid #ddd;
              padding: 8px;
            }
            .bg-gray-50 {
              background: white;
              border: 1px solid #ddd;
            }
            .payment-section {
              display: none !important;
            }
          }

          @keyframes shake {
            0%,
            100% {
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
      </motion.div>
    </div>
  );
};

const PaymentPageOut = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentPage />
    </Suspense>
  );
};

export default PaymentPageOut;