/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useRef, useContext } from "react";
import { motion, AnimatePresence, easeInOut } from "framer-motion";
import {
  FaCreditCard,
  FaMoneyBillWave,
  FaMobileAlt,
  FaComment,
  FaTrash,
  FaPercentage,
} from "react-icons/fa";
import { Toaster, toast } from "react-hot-toast";
import QRCode from "qrcode";
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from "next/navigation";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { fetchWhereNotEqual, multiEntry } from "@/services";
import { collections } from "@/config";
import { encryptUrl } from "@/services/encryption";
import axios from "axios";

type SaleOrderPaymentProps = {
  outstandingAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGstAmount: number;
  model: "order" | "purchaseOrder";
  products: any[];
  onPayment?: (paymentPayload: any) => void;
};

const SaleOrderPayment: React.FC<SaleOrderPaymentProps> = ({
  outstandingAmount: initialOutstandingAmount,
  cgstAmount: propCgstAmount,
  sgstAmount: propSgstAmount,
  totalGstAmount: propTotalGstAmount,
  model,
  products,
  onPayment,
}) => {
  const [paymentType, setPaymentType] = useState<
    "Cash" | "Card" | "UPI" | "Discount" | null
  >(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  interface CardData {
    id?: string;
    cardNumber: string;
    cardExpiry: string;
    cardCVC: string;
    cardHolder: string;
    MOBPHONE?: string;
    timestamp?: number;
  }

  interface UpiName {
    UPI_NAME: string;
    UPI_ID: string;
    DESCRIPT: string; // Added DESCRIPT field
  }

  interface PaymentEntryDetails {
    note?: string;
    cardNumber?: string;
    cardExpiry?: string;
    cardCVC?: string;
    cardHolder?: string;
    upiApp?: string;
    upiId?: string;
    upiDescription?: string; // Added to store DESCRIPT for UPI
    discountType?: "Percentage" | "Amount";
    originalDiscountValue?: number;
  }

  interface PaymentEntry {
    type: "Cash" | "Card" | "UPI" | "Discount";
    amount: number;
    details?: PaymentEntryDetails;
  }

  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCVC, setCardCVC] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [shakeError, setShakeError] = useState(false);
  const [amountLeft, setAmountLeft] = useState<number>(
    Number(initialOutstandingAmount)
  );
  const [saveCard, setSaveCard] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>("");
  const [selectedUpiId, setSelectedUpiId] = useState<string | null>(null);
  const [upiAmounts, setUpiAmounts] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [upiNames, setUpiNames] = useState<UpiName[]>([]); // Updated to use UpiName interface
  const [paymentEntries, setPaymentEntries] = useState<
    {
      type: "Cash" | "Card" | "UPI" | "Discount";
      amount: number;
      details?: any;
    }[]
  >([]);
  const [discountType, setDiscountType] = useState<"Percentage" | "Amount">(
    "Amount"
  );
  const [discountValue, setDiscountValue] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [ownerNumber, setOwnerNumber] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const successAudioRef = useRef<HTMLAudioElement>(null);
  const failureAudioRef = useRef<HTMLAudioElement>(null);
  const { state, dispatch } = useContext(CounterContext);
  const { myCollection, tenant } = useAuth();
  const router = useRouter();
  const currentTenant = tenant?.tenant_id || "";
  const currency = state.currency;

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

  const upiImages: { [key: string]: string } = {
    PhonePe: "/PhonePe.png",
    GooglePay: "/Gpay.webp",
    PAYTM: "/Paytm.png",
    BHIM: "/images/bhim.png",
    Default: "/Upi.jpg",
  };

  // Fetch owner number
  useEffect(() => {
    const fetchOwnerNumber = async () => {
      try {
        const settingsRef = doc(
          db,
          `TenantsDb/${currentTenant}/SETTINGS/ownerNumber`
        );
        const settingsDoc = await getDoc(settingsRef);
        if (settingsDoc.exists()) {
          setOwnerNumber(settingsDoc.data().number || null);
        } else {
          // toast.error("Owner number not found.", { position: "bottom-right" });
        }
      } catch (error) {
        console.error("Failed to fetch owner number:", error);
        // toast.error("Failed to fetch owner number.", {
        //   position: "bottom-right",
        // });
      }
    };
    fetchOwnerNumber();
  }, [currentTenant]);

  // Fetch UPI data with DESCRIPT
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchWhereNotEqual(
          myCollection(collections.GL_MAST),
          "UPI_NAME",
          ""
        );
        setUpiNames(data); // Data now includes DESCRIPT
      } catch (error) {
        console.error("Failed to fetch UPI data:", error);
        // toast.error("Failed to load UPI options", { position: "bottom-right" });
      }
    };
    fetchData();
  }, [myCollection]);

  // Fetch saved cards
  useEffect(() => {
    if (state.customerData?.MOBPHONE) {
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
          // toast.error("Failed to load saved cards", {
          //   position: "bottom-right",
          // });
        }
      };
      fetchSavedCards();
    }
  }, [state.customerData?.MOBPHONE, currentTenant]);

  // Auto-select first UPI app
  useEffect(() => {
    if (paymentType === "UPI" && upiNames.length > 0 && !selectedUpiApp) {
      const firstUpi = upiNames[0];
      setSelectedUpiApp(firstUpi.UPI_NAME);
      setSelectedUpiId(firstUpi.UPI_ID);
      setUpiAmounts({ ...upiAmounts, [firstUpi.UPI_NAME]: "" });
      setShowQR(false);
    }
  }, [paymentType, upiNames]);

  // Generate QR code for UPI
  useEffect(() => {
    if (
      showQR &&
      qrCanvasRef.current &&
      selectedUpiId &&
      upiAmounts[selectedUpiApp] &&
      Number(upiAmounts[selectedUpiApp]) > 0
    ) {
      const upiUrl = `upi://pay?pa=${selectedUpiId}&am=${Number(
        upiAmounts[selectedUpiApp]
      ).toFixed(2)}&cu=INR`;
      QRCode.toCanvas(
        qrCanvasRef.current,
        upiUrl,
        { width: 180, margin: 2 },
        (err) => {
          if (err) console.error("QR Code generation failed:", err);
        }
      );
    }
  }, [showQR, selectedUpiId, upiAmounts, selectedUpiApp]);

  // Update amount left
  useEffect(() => {
    const totalPaid = paymentEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
    setAmountLeft(
      Math.max(
        roundOff(Number(initialOutstandingAmount) - Number(totalPaid)),
        0
      )
    );
  }, [paymentEntries, initialOutstandingAmount]);

  function roundOff(value: number): number {
    return Math.round(value * 100) / 100; // 2 decimal rounding
  }

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join("-");
  };

  const isCardDetailsValid = () => {
    return (
      cardNumber.replace(/\D/g, "").length === 12 &&
      cardExpiry.match(/^(0[1-9]|1[0-2])\/\d{2}$/) &&
      cardCVC.length === 3 &&
      cardHolder.trim().length > 0 &&
      Number(cashAmount) > 0
    );
  };

  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  const sendOtp = async () => {
    if (!ownerNumber) {
      // toast.error("Owner number not available.", { position: "bottom-right" });
      return;
    }
    const otp = generateOtp();
    setGeneratedOtp(otp);

    try {
      const response = await fetch("/api/sendotp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant,
          phoneNumber: ownerNumber,
          otp,
        }),
      });
      if (response.ok) {
        setIsOtpSent(true);
        toast.success("OTP sent to owner.", { position: "bottom-right" });
      } else {
        throw new Error("Failed to send OTP.");
      }
    } catch (error) {
      console.error("Failed to send OTP:", error);
      // toast.error("Failed to send OTP.", {
      //   position: "bottom-right",
      // });
    }
  };

  const verifyOtp = async () => {
    try {
      const response = await fetch("/api/verifyotp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant,
          phoneNumber: ownerNumber,
          otp,
          generatedOtp,
        }),
      });
      if (response.ok) {
        return true;
      } else {
        throw new Error("Invalid OTP.");
      }
    } catch (error) {
      console.error("OTP verification failed:", error);
      // toast.error("Invalid OTP.", { position: "bottom-right" });
      return false;
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
        totalTax,
      };

      const response = await axios.post("/api/sendwhatsapp", payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (response.status === 200 && response.data.success) {
        toast.success("WhatsApp bill message sent successfully.", {
          position: "bottom-right",
        });
        return response.data;
      } else {
        throw new Error(
          response.data.message || "Failed to send WhatsApp message."
        );
      }
    } catch (error: any) {
      // toast.error(`WhatsApp send failed: ${error.message}`, {
      //   position: "bottom-right",
      // });
      throw error;
    }
  };

  const addPaymentEntry = async () => {
    if (!paymentType) {
      // toast.error("Please select a payment type.", {
      //   position: "bottom-right",
      // });
      return;
    }
    let amount = 0;
    let details = {};

    // Calculate base amount for discount calculations
    const baseAmount = products.reduce(
      (total, product) =>
        total +
        Number(product.price) * Math.abs(Number(product.QUANTITY)) -
        (Number(product.DISCOUNTAMT) || 0),
      0
    );

    if (paymentType === "Cash") {
      amount = Number(cashAmount) || 0;
      if (amount <= 0) {
        // toast.error("Please enter a valid cash amount.", {
        //   position: "bottom-right",
        // });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        return;
      }
      details = { note: cashNote };
    } else if (paymentType === "Card") {
      amount = Number(cashAmount) || 0;
      if (!isCardDetailsValid()) {
        // toast.error("Please enter valid card details.", {
        //   position: "bottom-right",
        // });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        return;
      }
      details = { cardNumber, cardExpiry, cardCVC, cardHolder };
    } else if (paymentType === "UPI") {
      amount = Number(upiAmounts[selectedUpiApp]) || 0;
      if (amount <= 0) {
        // toast.error("Please enter a valid UPI amount.", {
        //   position: "bottom-right",
        // });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        return;
      }
      // Find the selected UPI's DESCRIPT
      const selectedUpi = upiNames.find(
        (upi) => upi.UPI_NAME === selectedUpiApp
      );
      details = {
        upiApp: selectedUpiApp,
        upiId: selectedUpiId,
        upiDescription: selectedUpi ? selectedUpi.DESCRIPT : "",
      };
    } else if (paymentType === "Discount") {
      amount = Number(discountValue) || 0;
      if (amount <= 0) {
        // toast.error("Please enter a valid discount amount.", {
        //   position: "bottom-right",
        // });
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        return;
      }
      if (discountType === "Percentage") {
        amount = (baseAmount * amount) / 100; // Apply discount to base amount (excluding GST)
      }
      if (!isOtpSent) {
        await sendOtp();
        return;
      }
      const isValidOtp = await verifyOtp();
      if (!isValidOtp) {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        return;
      }
      details = { discountType, originalDiscountValue: Number(discountValue) };
    }

    const totalPaid = paymentEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
    if (totalPaid + amount > initialOutstandingAmount) {
      // toast.error("Total payment exceeds outstanding amount.", {
      //   position: "bottom-right",
      // });
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }

    setPaymentEntries([
      ...paymentEntries,
      { type: paymentType, amount, details },
    ]);
    setCashAmount("");
    setUpiAmounts({ ...upiAmounts, [selectedUpiApp]: "" });
    setCardNumber("");
    setCardExpiry("");
    setCardCVC("");
    setCardHolder("");
    setSaveCard(false);
    setShowQR(false);
    setDiscountValue("");
    setOtp("");
    setIsOtpSent(false);
    setPaymentType(null);
  };

  const removePaymentEntry = (index: number) => {
    setPaymentEntries(paymentEntries.filter((_, i) => i !== index));
  };

  const handlePayment = async () => {
    if (isProcessing) return;
    if (paymentEntries.length === 0) {
      // toast.error("Please add at least one payment.", {
      //   position: "bottom-right",
      // });
      return;
    }
    setIsProcessing(true);
    try {
      if (!products.length || !state.customerData) {
        // toast.error("Missing products or customer information", {
        //   position: "bottom-right",
        // });
        return;
      }
      if (!currentTenant) throw new Error("Tenant ID is undefined");

      // Save card if selected
      for (const entry of paymentEntries) {
        if (entry.type === "Card" && saveCard && state.customerData?.MOBPHONE) {
          const cardData = {
            cardNumber: entry.details.cardNumber.replace(/-/g, ""),
            cardExpiry: entry.details.cardExpiry,
            cardCVC: entry.details.cardCVC,
            cardHolder: entry.details.cardHolder,
            MOBPHONE: state.customerData.MOBPHONE,
            timestamp: Date.now(),
          };
          await addDoc(
            collection(db, `TenantsDb/${currentTenant}/Cards`),
            cardData
          );
          setSavedCards([...savedCards, cardData]);
        }
      }

      // Prepare payment data
      const confirmedPayments: {
        cash: number;
        card: number;
        upi: { method: string; amount: number; description: string }[];
        discount: number;
      } = {
        cash: 0,
        card: 0,
        upi: [],
        discount: 0,
      };
      paymentEntries.forEach((entry) => {
        if (entry.type === "Cash") {
          confirmedPayments.cash += entry.amount;
        } else if (entry.type === "Card") {
          confirmedPayments.card += entry.amount;
        } else if (entry.type === "UPI") {
          confirmedPayments.upi.push({
            method: entry.details.upiApp,
            amount: entry.amount,
            description: entry.details.upiDescription || "",
          });
        } else if (entry.type === "Discount") {
          confirmedPayments.discount += entry.amount;
        }
      });
      const totalUpiAmount = confirmedPayments.upi.reduce(
        (sum, upi) => sum + upi.amount,
        0
      );
      const totalAdvanceAmount =
        confirmedPayments.cash +
        confirmedPayments.card +
        totalUpiAmount +
        confirmedPayments.discount;

      const paymentFields = {
        PAY_MODE: paymentEntries.map((entry) => entry.type).join(", "),
        CASH_AMOUNT: confirmedPayments.cash,
        UPI_AMOUNT: totalUpiAmount,
        CARD_AMOUNT: confirmedPayments.card,
        DISCOUNT_AMOUNT: confirmedPayments.discount,
        UPI_DETAILS: confirmedPayments.upi, // Now includes description
        ADV_AMOUNT: totalAdvanceAmount,
      };

      // Prepare order entry
      const date = new Date();
      const invoiceNumber = `${model === "order" ? "SO" : "PO"}-${Date.now()}`;
      const baseAmount = products.reduce(
        (total, product) =>
          total +
          Number(product.price) * Math.abs(Number(product.QUANTITY)) -
          (Number(product.DISCOUNTAMT) || 0),
        0
      );

      // Calculate per-product GST and totals
      const productGstDetails = products.map((product) => {
        const quantity = Math.abs(Number(product.QUANTITY)) || 0;
        const rate = Number(product.price) || 0;
        const discount = Number(product.DISCOUNTAMT) || 0;
        const baseAmt = rate * quantity - discount;
        const igstRate = Number(product.IGST) || 0;
        // Calculate GST as inclusive tax (since initialOutstandingAmount includes GST)
        const gstAmt = Number(
          (baseAmt - baseAmt / (1 + igstRate / 100)).toFixed(11)
        );
        const cgstAmt = Number((gstAmt / 2).toFixed(11));
        const sgstAmt = Number((gstAmt / 2).toFixed(11));
        return { gstAmt, cgstAmt, sgstAmt, baseAmt, igstRate };
      });

      // Sum per-product GST for totals
      const calculatedTotalGstAmount = productGstDetails.reduce(
        (sum, { gstAmt }) => sum + gstAmt,
        0
      );
      const calculatedCgstAmount = productGstDetails.reduce(
        (sum, { cgstAmt }) => sum + cgstAmt,
        0
      );
      const calculatedSgstAmount = productGstDetails.reduce(
        (sum, { sgstAmt }) => sum + sgstAmt,
        0
      );

      // Validate against props
      if (
        Math.abs(calculatedTotalGstAmount - propTotalGstAmount) > 0.01 ||
        Math.abs(calculatedCgstAmount - propCgstAmount) > 0.01 ||
        Math.abs(calculatedSgstAmount - propSgstAmount) > 0.01
      ) {
        console.warn(
          "GST mismatch: Calculated vs Provided",
          {
            calculatedTotalGstAmount,
            propTotalGstAmount,
            calculatedCgstAmount,
            propCgstAmount,
            calculatedSgstAmount,
            propSgstAmount,
          }
        );
        // Use calculated values to ensure consistency
      }

      const customerData = state.customerData;
      let mainEntry;
      if (model === "order") {
        mainEntry = {
          collectionRef: myCollection(collections.ORDER),
          data: {
            OA_NO: invoiceNumber,
            OA_DATE: date,
            CUST_CODE: customerData?.CUSTCODE || "",
            CUSTNAME: customerData?.NAME || "",
            MOBPHONE: customerData?.MOBPHONE || "",
            ADDRESS: customerData?.ADDRESS || "",
            CITY: customerData?.CITY || "",
            COUNTRY: customerData?.COUNTRY || "",
            BASE_AMOUNT: roundOff(baseAmount),
            GST_AMOUNT: roundOff(calculatedTotalGstAmount),
            CGST_AMOUNT: roundOff(calculatedCgstAmount),
            SGST_AMOUNT: roundOff(calculatedSgstAmount),
            BILL_LINK: false,
            NET_AMOUNT: roundOff(baseAmount - confirmedPayments.discount),
            ...paymentFields,
          },
        };
      } else {
        mainEntry = {
          collectionRef: myCollection(collections.PORDER),
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
            GST_AMOUNT: roundOff(calculatedTotalGstAmount),
            CGST_AMOUNT: roundOff(calculatedCgstAmount),
            SGST_AMOUNT: roundOff(calculatedSgstAmount),
            BILL_LINK: false,
            NET_AMOUNT: roundOff(baseAmount - confirmedPayments.discount),
            ...paymentFields,
          },
        };
      }

      const productEntries = products.map((product, index) => {
        const quantity = Math.abs(Number(product.QUANTITY)) || 0;
        const rate = Number(product.price) || 0;
        const discount = Number(product.DISCOUNTAMT) || 0;
        const baseAmt = rate * quantity - discount;
        const igstRate = Number(product.IGST) || 0;
        const { gstAmt, cgstAmt, sgstAmt } = productGstDetails[index];
        const discountPercent = model === "purchaseOrder" ? product.DISCPER : 0;
        return {
          collectionRef:
            model === "order"
              ? myCollection(collections.ORDERDET)
              : myCollection(collections.PORDERDET),
          data: {
            [model === "order" ? "OA_NO" : "BILL_NO"]: invoiceNumber,
            [model === "order" ? "OA_DATE" : "BILL_DATE"]: date,
            CUSTNAME: customerData?.NAME || "",
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
            IGSTAMT: roundOff(gstAmt),
            CGSTAMT: roundOff(cgstAmt),
            SGSTAMT: roundOff(sgstAmt),
            HSNCODE: product.HSNCODE,
            DISCPER: discountPercent,
            GSTAMT: roundOff(gstAmt),
            TOTALAMT: roundOff(baseAmt),
          },
        };
      });

      const entries = [mainEntry, ...productEntries];
      await multiEntry(entries);

      const paymentData = {
        paymentEntries,
        products,
        invoiceNumber,
        date: date.toISOString(),
        customerData,
        totalAmount: initialOutstandingAmount,
        totalGstAmount: calculatedTotalGstAmount,
        cgstAmount: calculatedCgstAmount,
        sgstAmount: calculatedSgstAmount,
        confirmedPayments,
        finalOutstandingAmount: amountLeft,
        model,
        paymentDetails: {
          cashAmount: confirmedPayments.cash,
          cardAmount: confirmedPayments.card,
          upiAmounts: confirmedPayments.upi, // Now includes description
          discountAmount: confirmedPayments.discount,
          totalUpiAmount,
        },
      };

      // Store entire paymentData in localStorage as lastTransaction
      localStorage.setItem("lastTransaction", JSON.stringify(paymentData));

      if (successAudioRef.current) {
        successAudioRef.current.currentTime = 0;
        successAudioRef.current
          .play()
          .catch((err) => console.warn("Success audio playback failed:", err));
      }

      const rawPhone = customerData?.MOBPHONE || "";
      console.log("Raw MOBPHONE:", rawPhone, "Time:", new Date().toISOString());

      // Validate raw phone number early
      if (!rawPhone) {
        console.error("Customer phone number is empty or undefined");
        // toast.error("Customer phone number is missing for WhatsApp message", {
        //   position: "bottom-right",
        // });
        return;
      }

      // Clean and normalize phone number
      const cleanedPhone = rawPhone.replace(/[^0-9]/g, "");
      const wpNo = cleanedPhone.length === 10 ? `+91${cleanedPhone}` : cleanedPhone;

      // Validate phone number format
      const phoneRegex = /^\+91\d{10}$/;
      if (phoneRegex.test(wpNo)) {
        console.log(
          "Preparing WhatsApp send:",
          {
            phone: wpNo,
            invoice: invoiceNumber,
            customer: customerData?.NAME,
            totalAmount: paymentData.totalAmount.toFixed(2),
            tenant: state.tenantId,
          },
          "Time:",
          new Date().toISOString()
        );

        // Helper: Number to words
        function numberToWords(num: number): string {
          if (num === 0) return "Zero Rupees Only";
          const belowTwenty = [
            "",
            "One",
            "Two",
            "Three",
            "Four",
            "Five",
            "Six",
            "Seven",
            "Eight",
            "Nine",
            "Ten",
            "Eleven",
            "Twelve",
            "Thirteen",
            "Fourteen",
            "Fifteen",
            "Sixteen",
            "Seventeen",
            "Eighteen",
            "Nineteen",
          ];
          const tens = [
            "",
            "",
            "Twenty",
            "Thirty",
            "Forty",
            "Fifty",
            "Sixty",
            "Seventy",
            "Eighty",
            "Ninety",
          ];
          const thousands = ["", "Thousand", "Million", "Billion"];

          const helper = (n: number): string => {
            if (n === 0) return "";
            else if (n < 20) return belowTwenty[n] + " ";
            else if (n < 100)
              return tens[Math.floor(n / 10)] + " " + helper(n % 10);
            else
              return (
                belowTwenty[Math.floor(n / 100)] +
                " Hundred " +
                helper(n % 100)
              );
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

        // Helper: Format date
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

            const totalAmount = paymentData?.totalAmount.toFixed(2) || "0.00";
            const cgst = paymentData?.cgstAmount.toFixed(2) || "0.00";
            const sgst = paymentData?.sgstAmount.toFixed(2) || "0.00";
            const totalTax = paymentData?.totalGstAmount.toFixed(2) || "0.00";

            const contactEmail = "support@yourdomain.com"; // Replace with actual or dynamic email if needed

            await sendWhatsAppMessage(
              state.tenantId,
              wpNo,
              customerData?.NAME || "Valued Customer",
              invoiceNumber,
              totalAmount,
              date,
              items,
              contactEmail,
              cgst,
              sgst,
              totalTax
            );
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

      // Clear session storage and reset state
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
          currency: currency,
        },
      });

      toast.success("Advance payment recorded successfully!", {
        position: "bottom-right",
      });
      const routeData = {
        number: invoiceNumber,
        model,
      };
      const encryptedData = encryptUrl(JSON.stringify(routeData));
      router.push(`/paymentCondition?data=${encryptedData}`);
    } catch (error) {
      console.error("Error in handlePayment:", error);
      // toast.error(
      //   error instanceof Error ? error.message : "Failed to process payment",
      //   {
      //     position: "bottom-right",
      //   }
      // );
      if (failureAudioRef.current) {
        failureAudioRef.current.currentTime = 0;
        failureAudioRef.current
          .play()
          .catch((err) => console.warn("Failure audio playback failed:", err));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const payNowColor =
    paymentEntries.length > 0
      ? "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
      : paymentType === "Cash"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : paymentType === "Card"
      ? "bg-blue-600 hover:bg-blue-700"
      : paymentType === "UPI"
      ? "bg-purple-600 hover:bg-purple-700"
      : paymentType === "Discount"
      ? "bg-orange-600 hover:bg-orange-700"
      : "bg-gray-400";

  function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  return (
    <motion.div
      className="bg-gray-100 w-full min-h-full rounded-2xl shadow-xl border border-gray-100"
      variants={itemVariants}
      initial="hidden"
      animate="show"
    >
      <h1 className="text-xl font-semibold text-blue-500 p-4 mb-4">
        {model === "order" ? "Sale Order Advance" : "Purchase Order Advance"}
      </h1>

      {/* Total Amount Due */}
      <motion.div className="flex flex-col items-center mb-6 px-4">
        <span className="text-sm uppercase tracking-widest text-gray-400 font-semibold mb-2">
          Advance Payment
        </span>
        <motion.span
          className="text-4xl font-bold text-blue-500"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
        >
          {currency + " "}{initialOutstandingAmount.toFixed(2)}
        </motion.span>
        <span className="text-sm font-medium text-gray-600 mt-2">
          Amount Left:{" "}
          <span className="text-blue-500">{currency + " "}{amountLeft.toFixed(2)}</span>
        </span>
      </motion.div>

      {/* Payment Methods */}
      <div className="px-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FaCreditCard className="text-blue-500" /> Payment Methods
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {["Cash", "Card", "UPI", "Discount"].map((type) => (
            <motion.div
              key={type}
              className={`p-4 rounded-xl cursor-pointer flex flex-col items-center gap-2 text-center transition-all duration-200 ${
                paymentType === type
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() =>
                setPaymentType(type as "Cash" | "Card" | "UPI" | "Discount")
              }
              variants={cardVariants}
              animate={paymentType === type ? "active" : "inactive"}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                setPaymentType(type as "Cash" | "Card" | "UPI" | "Discount")
              }
            >
              {type === "Cash" && <FaMoneyBillWave className="text-3xl" />}
              {type === "Card" && <FaCreditCard className="text-3xl" />}
              {type === "UPI" && <FaMobileAlt className="text-3xl" />}
              {type === "Discount" && <FaPercentage className="text-3xl" />}
              <span className="text-sm font-semibold">{type}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payment Entries Summary */}
      {paymentEntries.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FaMoneyBillWave className="text-blue-500" /> Payment Summary
          </h2>
          <div className="bg-white rounded-xl shadow-inner border border-gray-100 p-4">
            {paymentEntries.map((entry, index) => (
              <motion.div
                key={index}
                className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-sm font-medium text-gray-600">
                  {entry.type}: {currency + " "}{entry.amount.toFixed(2)}
                  {entry.type === "UPI" && ` (${entry.details.upiApp}${entry.details.upiDescription ? ` - ${entry.details.upiDescription}` : ""})`}
                  {entry.type === "Card" &&
                    ` (****${entry.details.cardNumber.slice(-4)})`}
                  {entry.type === "Cash" &&
                    entry.details.note &&
                    ` (${entry.details.note})`}
                  {entry.type === "Discount" &&
                    ` (${
                      entry.details.discountType === "Percentage"
                        ? `${entry.details.originalDiscountValue}%`
                        : `${currency + " "}${entry.details.originalDiscountValue}`
                    })`}
                </span>
                <motion.button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => removePaymentEntry(index)}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  aria-label={`Remove ${entry.type} payment`}
                >
                  <FaTrash />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Details */}
      <AnimatePresence>
        {paymentType && (
          <motion.div
            className="px-4 pb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-4 bg-white rounded-xl shadow-inner border border-gray-100">
              {paymentType === "Cash" && (
                <div className="space-y-4">
                  <div className="relative">
                    <FaMoneyBillWave className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter cash amount"
                      value={cashAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCashAmount(value);
                      }}
                      className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                        shakeError
                          ? "border-red-500 animate-shake"
                          : "border-gray-200"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      aria-label="Cash amount"
                    />
                  </div>
                  <div className="relative">
                    <FaComment className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Add a note (optional)"
                      value={cashNote}
                      onChange={(e) => setCashNote(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Cash note"
                    />
                  </div>
                </div>
              )}

              {paymentType === "Card" && (
                <div className="space-y-4">
                  <div className="relative">
                    <FaMoneyBillWave className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter card payment amount"
                      value={cashAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCashAmount(value);
                      }}
                      className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                        shakeError
                          ? "border-red-500 animate-shake"
                          : "border-gray-200"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      aria-label="Card payment amount"
                    />
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
                        const rawValue = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 12);
                        const formattedValue = formatCardNumber(rawValue);
                        if (e.target.value.replace(/\D/g, "") !== rawValue) {
                          setShakeError(true);
                          setTimeout(() => setShakeError(false), 500);
                        }
                        setCardNumber(formattedValue);
                      }}
                      className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                        shakeError
                          ? "border-red-500 animate-shake"
                          : "border-gray-200"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      maxLength={14}
                      aria-label="Card number"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <FaCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                          shakeError
                            ? "border-red-500 animate-shake"
                            : "border-gray-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        maxLength={5}
                        aria-label="Card expiry"
                      />
                    </div>
                    <div className="relative flex-1">
                      <FaCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="CVC (3 digits)"
                        value={cardCVC}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 3);
                          if (e.target.value !== value) {
                            setShakeError(true);
                            setTimeout(() => setShakeError(false), 500);
                          }
                          setCardCVC(value);
                        }}
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                          shakeError
                            ? "border-red-500 animate-shake"
                            : "border-gray-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        maxLength={3}
                        aria-label="Card CVC"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <FaCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                    <FaMobileAlt className="text-blue-500" />
                    Pay via UPI
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {upiNames.map((upi) => (
                      <motion.button
                        key={upi.UPI_NAME}
                        className={`p-4 rounded-xl flex flex-col items-center gap-2 text-center transition-all duration-200 ${
                          selectedUpiApp === upi.UPI_NAME
                            ? "bg-blue-100 border-blue-300"
                            : "bg-white hover:bg-gray-50 border border-gray-200"
                        } shadow-sm`}
                        onClick={() => {
                          setSelectedUpiApp(upi.UPI_NAME);
                          setSelectedUpiId(upi.UPI_ID);
                          setUpiAmounts({ ...upiAmounts, [upi.UPI_NAME]: "" });
                          setShowQR(false);
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
                        <span className="text-sm font-medium">
                          {upi.UPI_NAME}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="relative">
                    <FaMoneyBillWave className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter UPI amount"
                      value={upiAmounts[selectedUpiApp] || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setUpiAmounts({
                          ...upiAmounts,
                          [selectedUpiApp]: value,
                        });
                        setShowQR(Number(value) > 0);
                      }}
                      className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                        shakeError
                          ? "border-red-500 animate-shake"
                          : "border-gray-200"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      aria-label="UPI amount"
                    />
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

              {paymentType === "Discount" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <FaPercentage className="text-blue-500" />
                    Owner’s Discount
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                      className={`flex-1 p-3 rounded-lg text-sm font-medium ${
                        discountType === "Amount"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setDiscountType("Amount")}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      aria-label="Discount by Amount"
                    >
                      Amount
                    </motion.button>
                    <motion.button
                      className={`flex-1 p-3 rounded-lg text-sm font-medium ${
                        discountType === "Percentage"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setDiscountType("Percentage")}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      aria-label="Discount by Percentage"
                    >
                      Percentage
                    </motion.button>
                  </div>
                  <div className="relative">
                    <FaPercentage className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step={discountType === "Percentage" ? "0.01" : "0.01"}
                      placeholder={`Enter discount ${discountType.toLowerCase()}`}
                      value={discountValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (
                          discountType === "Percentage" &&
                          Number(value) > 100
                        ) {
                          setShakeError(true);
                          setTimeout(() => setShakeError(false), 500);
                          return;
                        }
                        setDiscountValue(value);
                      }}
                      className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                        shakeError
                          ? "border-red-500 animate-shake"
                          : "border-gray-200"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      aria-label={`Discount ${discountType}`}
                    />
                  </div>
                  {isOtpSent && (
                    <div className="relative">
                      <FaComment className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter OTP"
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        className={`w-full pl-10 pr-3 py-3 text-sm rounded-lg border ${
                          shakeError
                            ? "border-red-500 animate-shake"
                            : "border-gray-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        maxLength={6}
                        aria-label="OTP"
                      />
                    </div>
                  )}
                </div>
              )}

              <motion.button
                className="w-full mt-4 px-6 py-3 rounded-lg text-base font-semibold text-white bg-blue-500 hover:bg-blue-600 shadow-lg"
                onClick={addPaymentEntry}
                disabled={
                  isProcessing ||
                  !paymentType ||
                  (paymentType === "UPI" &&
                    (!upiAmounts[selectedUpiApp] ||
                      Number(upiAmounts[selectedUpiApp]) <= 0)) ||
                  (paymentType === "Card" && !isCardDetailsValid()) ||
                  (paymentType === "Cash" && Number(cashAmount) <= 0) ||
                  (paymentType === "Discount" &&
                    (!discountValue ||
                      Number(discountValue) <= 0 ||
                      (isOtpSent && !otp)))
                }
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                aria-label={
                  paymentType === "Discount" && !isOtpSent
                    ? "Send OTP"
                    : "Add Payment"
                }
              >
                {paymentType === "Discount" && !isOtpSent
                  ? "Send OTP"
                  : "Add Payment"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-4">
        <motion.button
          className={`w-full px-6 py-4 rounded-lg text-base font-semibold text-white shadow-lg flex items-center justify-center gap-2 ${payNowColor} disabled:bg-gray-400 disabled:cursor-not-allowed`}
          onClick={handlePayment}
          disabled={isProcessing || paymentEntries.length === 0}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          aria-label="Confirm Advance Payment"
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
          ) : (
            "Confirm Advance Payment"
          )}
        </motion.button>
      </div>

      <audio ref={successAudioRef} src="/PaymentSucess.mp3" preload="auto" />
      <audio ref={failureAudioRef} src="/PaymentFailed.mp3" preload="auto" />
      <style jsx>{`
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
  );
};

export default SaleOrderPayment;