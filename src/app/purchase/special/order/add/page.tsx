/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useContext, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../../../../firebase";
import { CounterContext } from "@/lib/CounterContext";
import DropdownCustom from "@/components/DropDownCustom";
import { getPrefixForModel } from "@/services";
import { format } from "date-fns";
import { collections } from "../../../../../config";
import { useRouter } from "next/navigation";
import { Customer } from "@/types/page";
import { encryptUrl } from "@/services/encryption";


interface FormData {
  CAKETYPE: "Catalog" | "Customize" | "Normal";
  CATEGORY: string;
  CFLAVOR: string;
  CMESSAGE: string;
  CREMARKS: string;
  CUSTOMIZETYPE: string;
  DLVDATE: string;
  PCS: string;
  PRODCODE: string;
  RATE: string;
  AMOUNT: number;
  SGroupDes: string;
  WEIGHT: "500 GM" | "1 KG" | "2 KG" | "3 KG" | "5 KG" | "";
  PHOTOFILES: any[];
  CUSTOMER_NAME: string;
  CUSTOMER_CODE: string;
  MOBILE_NUMBER: string;
  ANNIVERSARY?: string;
  DOB?: string;
}

interface Product {
  id: string;
  PRODCODE: string;
  DESCRIPT: string;
  SGroupDesc: string;
  RATE: number;
  AVAILABLE: boolean;
}

const CompactOrderForm: React.FC = () => {
  const { state, dispatch } = useContext(CounterContext);
  const tenantId = state.tenantId ;
  const [activeTab, setActiveTab] = useState<
    "Catalog" | "Customize" | "Normal"
  >("Catalog");
  const [formData, setFormData] = useState<FormData>({
    CAKETYPE: "Catalog",
    CATEGORY: "",
    CFLAVOR: "",
    CMESSAGE: "",
    CREMARKS: "",
    CUSTOMIZETYPE: "",
    DLVDATE: "",
    PCS: "1",
    PRODCODE: "",
    RATE: "",
    AMOUNT: 0,
    SGroupDes: "",
    WEIGHT: "",
    PHOTOFILES: [],
    CUSTOMER_NAME: state.customerData?.name || "",
    CUSTOMER_CODE: state.customerData?.CUSTCODE || "",
    MOBILE_NUMBER: state.customerData?.MOBPHONE || "",
    ANNIVERSARY: state.customerData?.anniversary || "",
    DOB: state.customerData?.birthday || "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [custCodeLoading, setCustCodeLoading] = useState(false);
  const [custCodeError, setCustCodeError] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [numberSuggestions, setNumberSuggestions] = useState<Customer[]>([]);
  const [showNumberSuggestions, setShowNumberSuggestions] = useState(false);
  const [isCustomerSubmitted, setIsCustomerSubmitted] = useState(
    !!state.customerData
  );
  const [isCustomerEditing, setIsCustomerEditing] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const router = useRouter();

  const categoryOptions = [
    { value: "3d", label: "3D Cake" },
    { value: "Alphabet", label: "Alphabet and Numeric" },
    { value: "Designer", label: "Designer Cake" },
    { value: "Inspirational", label: "Inspirational Cake" },
    { value: "Photo", label: "Photo Cake" },
  ];

  const products = {
    "3d": [
      { id: "3D001", name: "3D Unicorn Cake" },
      { id: "3D002", name: "3D Car Cake" },
    ],
  };

  const flavorOptions = [
    { value: "VANILLA", label: "Vanilla" },
    { value: "CHOCOLATE", label: "Chocolate" },
    { value: "STRAWBERRY", label: "Strawberry" },
    { value: "RED_VELVET", label: "Red Velvet" },
  ];

  const customizeTypeOptions = [
    { value: "Photo", label: "Photo Cake" },
    { value: "Themed", label: "Themed Cake" },
    { value: "Sculpted", label: "Sculpted Cake" },
  ];

  const weightOptions = [
    { value: "500 GM", label: "500 GM" },
    { value: "1 KG", label: "1 KG" },
    { value: "2 KG", label: "2 KG" },
    { value: "3 KG", label: "3 KG" },
    { value: "5 KG", label: "5 KG" },
  ];

  // Generate unique customer code
  const generateUniqueCustomerCode = async (): Promise<string> => {
    try {
      if (!tenantId) throw new Error("Tenant ID is missing");
      const customersRef = collection(db, "TenantsDb", tenantId, collections.CUSTOMERS);
      const prefix = await getPrefixForModel(tenantId, "Customer"); // e.g., "CUS-"
      if (!prefix) throw new Error("Customer code prefix not found");
      const custVend = "C";

      // Query only customers with this prefix and CUST_VEND, order by CUSTCODE descending
      const customerQuery = query(
        customersRef,
        where("CUST_VEND", "==", custVend),
        where("CUSTCODE", ">=", prefix),
        where("CUSTCODE", "<", prefix + "\uf8ff"),
        orderBy("CUSTCODE", "desc"),
        limit(1)
      );
      const snapshot = await getDocs(customerQuery);

      let nextCodeNumber = 1;
      if (!snapshot.empty) {
        const lastCode = snapshot.docs[0].data().CUSTCODE as string;
        const codeNumberStr = lastCode.replace(prefix, "");
        const codeNumber = parseInt(codeNumberStr, 10);
        if (!isNaN(codeNumber)) {
          nextCodeNumber = codeNumber + 1;
        }
      }

      const formattedCodeNumber = nextCodeNumber.toString().padStart(3, "0");
      return `${prefix}${formattedCodeNumber}`;
    } catch (error) {
      console.error("Error generating customer code:", error);
      throw new Error("Failed to generate customer code");
    }
  };

  // Set unique customer code when mobile number changes or tenantId is available
  useEffect(() => {
    const setUniqueCode = async () => {
      if (!formData.MOBILE_NUMBER || custCodeLoading) return;

      setCustCodeLoading(true);
      setCustCodeError(null);
      try {
        const customersRef = collection(db, "TenantsDb", tenantId, collections.CUSTOMERS);
        const customerQuery = query(customersRef, where("MOBPHONE", "==", formData.MOBILE_NUMBER));
        const customerSnapshot = await getDocs(customerQuery);

        let custCode = formData.CUSTOMER_CODE;
        if (customerSnapshot.empty) {
          custCode = await generateUniqueCustomerCode();
          setFormData((prev) => ({ ...prev, CUSTOMER_CODE: custCode }));
        } else {
          custCode = customerSnapshot.docs[0].data().CUSTCODE || custCode;
          setFormData((prev) => ({ ...prev, CUSTOMER_CODE: custCode }));
        }
      } catch (error) {
        console.error('Error generating customer code:', error);
        setCustCodeError('Failed to generate customer code. Please try again.');
        // toast.error('Failed to generate customer code. Please try again.');
      } finally {
        setCustCodeLoading(false);
      }
    };

    if (tenantId && formData.MOBILE_NUMBER && !isCustomerSubmitted) {
      setUniqueCode();
    } else if (!tenantId) {
      setCustCodeLoading(false);
      setCustCodeError('Tenant ID is missing.');
      // toast.error('Tenant ID is missing.');
    }
  }, [tenantId, formData.MOBILE_NUMBER, isCustomerSubmitted]);

  // Fetch all customers and products on mount
  useEffect(() => {
    const fetchAllCustomers = async () => {
      try {
        const custRef = collection(
          db,
          "TenantsDb",
          tenantId,
          collections.CUSTOMERS
        );
        const snapshot = await getDocs(custRef);
        const results: Customer[] = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data();
            return {
              id: doc.id,
              MOBPHONE: data.MOBPHONE || "",
              NAME: data.NAME || "",
              CUSTCODE: data.CUSTCODE || "",
              ADDRESS: data.ADDRESS || "",
              CITY: data.CITY || "",
              COUNTRY: data.COUNTRY || "",
              MarriageAnniversary: data.MarriageAnniversary
                ? data.MarriageAnniversary instanceof Timestamp
                  ? format(data.MarriageAnniversary.toDate(), "yyyy-MM-dd")
                  : data.MarriageAnniversary
                : "",
              DOB: data.DOB
                ? data.DOB instanceof Timestamp
                  ? format(data.DOB.toDate(), "yyyy-MM-dd")
                  : data.DOB
                : "",
              GSTIn: data.GSTIn || "",
              number: data.MOBPHONE || "",
              name: data.NAME || "",
              anniversary: data.MarriageAnniversary
                ? data.MarriageAnniversary instanceof Timestamp
                  ? format(data.MarriageAnniversary.toDate(), "yyyy-MM-dd")
                  : data.MarriageAnniversary
                : "",
              birthday: data.DOB
                ? data.DOB instanceof Timestamp
                  ? format(data.DOB.toDate(), "yyyy-MM-dd")
                  : data.DOB
                : "",
            };
          }
        );
        setAllCustomers(results);
      } catch (error) {
        console.error("Error fetching customers:", error);
        // toast.error("Failed to load customers");
      }
    };

    const fetchAvailableProducts = async () => {
      try {
        const productsRef = query(
          collection(db, "TenantsDb", tenantId, collections.PRODUCTS),
          where("AVAILABLE", "==", true)
        );
        const snapshot = await getDocs(productsRef);
        const results: Product[] = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data();
            return {
              id: doc.id,
              PRODCODE: data.PRODCODE || "",
              DESCRIPT: data.DESCRIPT || "",
              SGroupDesc: data.SGroupDesc || "",
              RATE: data.RATE || 0,
              AVAILABLE: data.AVAILABLE || false,
            };
          }
        );
        setAvailableProducts(results);
      } catch (error) {
        console.error("Error fetching products:", error);
        // toast.error("Failed to load products");
      }
    };

    fetchAllCustomers();
    fetchAvailableProducts();
  }, [tenantId]);

  // Validate form
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.DLVDATE) newErrors.DLVDATE = "Delivery date is required";
    if (!formData.AMOUNT) newErrors.AMOUNT = "Amount is required";
    if (!formData.CUSTOMER_NAME)
      newErrors.CUSTOMER_NAME = "Customer name is required";
    if (!formData.CUSTOMER_CODE)
      newErrors.CUSTOMER_CODE = "Customer code is required";
    if (!formData.MOBILE_NUMBER)
      newErrors.MOBILE_NUMBER = "Mobile number is required";
    if (activeTab === "Catalog") {
      if (!formData.CATEGORY) newErrors.CATEGORY = "Category is required";
      if (formData.CATEGORY === "3d" && !formData.PRODCODE)
        newErrors.PRODCODE = "Product is required";
      if (!formData.CFLAVOR) newErrors.CFLAVOR = "Flavor is required";
      if (formData.CATEGORY === "Photo" && !formData.PHOTOFILES.length)
        newErrors.PHOTOFILES = "Image is required";
    }
    if (activeTab === "Customize") {
      if (!formData.CUSTOMIZETYPE)
        newErrors.CUSTOMIZETYPE = "Customize type is required";
      if (!formData.CFLAVOR) newErrors.CFLAVOR = "Flavor is required";
    }
    if (activeTab === "Normal") {
      if (!formData.SGroupDes) newErrors.SGroupDes = "Subgroup is required";
      if (!formData.PRODCODE) newErrors.PRODCODE = "Product is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input changes for order fields
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [name]: name === "AMOUNT" ? parseFloat(value) || 0 : value,
      };
      if (name === "RATE" || name === "PCS" || name === "WEIGHT") {
        const rate = parseFloat(updatedData.RATE) || 0;
        const quantity = parseFloat(updatedData.PCS) || 1;
        const weightMultiplier = {
          "500 GM": 0.5,
          "1 KG": 1,
          "2 KG": 2,
          "3 KG": 3,
          "5 KG": 5,
          "": 1,
        }[updatedData.WEIGHT] || 1;
        updatedData.AMOUNT = rate * quantity * weightMultiplier;
      }
      if (name === "CATEGORY") {
        updatedData.PRODCODE = "";
        updatedData.PHOTOFILES = [];
      }
      if (name === "PRODCODE" && activeTab === "Normal") {
        const selectedProduct = availableProducts.find(
          (p) => p.PRODCODE === value
        );
        updatedData.RATE = selectedProduct
          ? selectedProduct.RATE.toString()
          : "";
        const rate = parseFloat(updatedData.RATE) || 0;
        const quantity = parseFloat(updatedData.PCS) || 1;
        const weightMultiplier = {
          "500 GM": 0.5,
          "1 KG": 1,
          "2 KG": 2,
          "3 KG": 3,
          "5 KG": 5,
          "": 1,
        }[updatedData.WEIGHT] || 1;
        updatedData.AMOUNT = rate * quantity * weightMultiplier;
      }
      return updatedData;
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // Handle customer input changes
  const handleCustomerInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));

    if (name === "MOBILE_NUMBER" && value.length >= 3) {
      const filtered = allCustomers.filter((c) =>
        c.MOBPHONE?.startsWith(value)
      );
      setNumberSuggestions(filtered);
      setShowNumberSuggestions(true);
    } else if (name === "MOBILE_NUMBER") {
      setNumberSuggestions([]);
      setShowNumberSuggestions(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = async (selectedCustomer: Customer) => {
    setSuggestionLoading(true);
    try {
      const updatedFormData: FormData = {
        ...formData,
        CUSTOMER_NAME: selectedCustomer.NAME || "",
        CUSTOMER_CODE: selectedCustomer.CUSTCODE || "",
        MOBILE_NUMBER: selectedCustomer.MOBPHONE || "",
        ANNIVERSARY: selectedCustomer.anniversary || "",
        DOB: selectedCustomer.birthday || "",
      };

      setFormData(updatedFormData);

      const formattedCustomer: Customer = {
        id: selectedCustomer.id,
        MOBPHONE: selectedCustomer.MOBPHONE || "",
        NAME: selectedCustomer.NAME || "",
        CUSTCODE: selectedCustomer.CUSTCODE || "",
        ADDRESS: selectedCustomer.ADDRESS || "",
        CITY: selectedCustomer.CITY || "",
        COUNTRY: selectedCustomer.COUNTRY || "",
        MarriageAnniversary: selectedCustomer.anniversary || "",
        DOB: selectedCustomer.birthday || "",
        GSTIn: selectedCustomer.GSTIn || "",
        number: selectedCustomer.MOBPHONE || "",
        name: selectedCustomer.NAME || "",
        anniversary: selectedCustomer.anniversary || "",
        birthday: selectedCustomer.birthday || "",
      };

      dispatch({
        type: "SET_CUSTOMER",
        payload: formattedCustomer,
      });

      setNumberSuggestions([]);
      setShowNumberSuggestions(false);
      setIsCustomerSubmitted(true);
      setIsCustomerEditing(false);
    } catch (error) {
      console.error("Error processing suggestion:", error);
      // toast.error("Failed to load customer data");
    } finally {
      setSuggestionLoading(false);
    }
  };

  // Handle file changes
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData((prev) => ({
        ...prev,
        PHOTOFILES: Array.from(e.target.files!),
      }));
      setErrors((prev) => ({ ...prev, PHOTOFILES: "" }));
    }
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      setFormData((prev) => ({
        ...prev,
        PHOTOFILES: Array.from(e.dataTransfer.files),
      }));
      setErrors((prev) => ({ ...prev, PHOTOFILES: "" }));
    }
  };

  const getDOCnum = async (): Promise<string> => {
    const prefix = await getPrefixForModel(tenantId, "Special Order");
    return prefix;
  };

  // Generate bill number
  const generateBillNo = async () => {
    try {
      const prefix = await getDOCnum();
      return `${prefix}-${Date.now()}`;
    } catch (error) {
      console.error("Error generating bill number:", error);
      return `ERROR-${Date.now()}`;
    }
  };

  // Get slot from delivery date
  const getSlotFromDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const hours = date.getHours();
    const period = hours >= 12 ? "PM" : "AM";
    const hour = hours % 12 || 12;
    return `${hour}${period}`;
  };

  // Handle customer submission
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (custCodeError) {
      // toast.error('Cannot submit due to code generation error.');
      return;
    }
    if (!formData.CUSTOMER_NAME || !formData.MOBILE_NUMBER || !formData.CUSTOMER_CODE) {
      setErrors({
        CUSTOMER_NAME: !formData.CUSTOMER_NAME
          ? "Customer name is required"
          : "",
        MOBILE_NUMBER: !formData.MOBILE_NUMBER
          ? "Mobile number is required"
          : "",
        CUSTOMER_CODE: !formData.CUSTOMER_CODE
          ? "Customer code is required"
          : "",
      });
      return;
    }

    setCustCodeLoading(true);
    try {
      const customersRef = collection(
        db,
        "TenantsDb",
        tenantId,
        collections.CUSTOMERS
      );

      // Check if customer exists
      const customerQuery = query(
        customersRef,
        where("MOBPHONE", "==", formData.MOBILE_NUMBER)
      );
      const customerSnapshot = await getDocs(customerQuery);

      let custCode = formData.CUSTOMER_CODE;
      if (customerSnapshot.empty) {
        // Create new customer
        const customerData: Customer = {
          MOBPHONE: formData.MOBILE_NUMBER,
          NAME: formData.CUSTOMER_NAME,
          CUSTCODE: custCode,
          ADDRESS: "",
          CITY: "",
          COUNTRY: "",
          MarriageAnniversary: formData.ANNIVERSARY || "",
          DOB: formData.DOB || "",
          GSTIn: "",
          number: formData.MOBILE_NUMBER,
          name: formData.CUSTOMER_NAME,
          anniversary: formData.ANNIVERSARY || "",
          birthday: formData.DOB || "",
        };

        await addDoc(customersRef, {
          NAME: customerData.NAME,
          MOBPHONE: customerData.MOBPHONE,
          CUSTCODE: customerData.CUSTCODE,
          ADDRESS: customerData.ADDRESS,
          CITY: customerData.CITY,
          COUNTRY: customerData.COUNTRY,
          CUST_VEND: "C",
          MarriageAnniversary: customerData.anniversary
            ? Timestamp.fromDate(new Date(customerData.anniversary))
            : null,
          DOB: customerData.birthday
            ? Timestamp.fromDate(new Date(customerData.birthday))
            : null,
          GSTIn: customerData.GSTIn,
          createdAt: Timestamp.fromDate(new Date()),
        });

        dispatch({
          type: "SET_CUSTOMER",
          payload: customerData,
        });

        toast.success("Customer added successfully");
      } else {
        // Use existing customer
        const existingCustomer = customerSnapshot.docs[0].data();
        custCode = existingCustomer.CUSTCODE || custCode;
        setFormData((prev) => ({ ...prev, CUSTOMER_CODE: custCode }));

        const customerData: Customer = {
          id: customerSnapshot.docs[0].id,
          MOBPHONE: existingCustomer.MOBPHONE || "",
          NAME: existingCustomer.NAME || "",
          CUSTCODE: custCode,
          ADDRESS: existingCustomer.ADDRESS || "",
          CITY: existingCustomer.CITY || "",
          COUNTRY: existingCustomer.COUNTRY || "",
          MarriageAnniversary: existingCustomer.MarriageAnniversary
            ? existingCustomer.MarriageAnniversary instanceof Timestamp
              ? format(existingCustomer.MarriageAnniversary.toDate(), "yyyy-MM-dd")
              : existingCustomer.MarriageAnniversary
            : "",
          DOB: existingCustomer.DOB
            ? existingCustomer.DOB instanceof Timestamp
              ? format(existingCustomer.DOB.toDate(), "yyyy-MM-dd")
              : existingCustomer.DOB
            : "",
          GSTIn: existingCustomer.GSTIn || "",
          number: existingCustomer.MOBPHONE || "",
          name: existingCustomer.NAME || "",
          anniversary: existingCustomer.MarriageAnniversary
            ? existingCustomer.MarriageAnniversary instanceof Timestamp
              ? format(existingCustomer.MarriageAnniversary.toDate(), "yyyy-MM-dd")
              : existingCustomer.MarriageAnniversary
            : "",
          birthday: existingCustomer.DOB
            ? existingCustomer.DOB instanceof Timestamp
              ? format(existingCustomer.DOB.toDate(), "yyyy-MM-dd")
              : existingCustomer.DOB
            : "",
        };

        dispatch({
          type: "SET_CUSTOMER",
          payload: customerData,
        });
      }

      setIsCustomerSubmitted(true);
      setIsCustomerEditing(false);
    } catch (error) {
      console.error("Error adding customer:", error);
      // toast.error("Failed to add customer");
    } finally {
      setCustCodeLoading(false);
    }
  };

  // Handle customer edit
  const handleCustomerEdit = () => {
    setIsCustomerEditing(true);
    setIsCustomerSubmitted(false);
  };

  // Handle customer reset
  const handleCustomerReset = () => {
    setFormData((prev) => ({
      ...prev,
      CUSTOMER_NAME: "",
      CUSTOMER_CODE: "",
      MOBILE_NUMBER: "",
      ANNIVERSARY: "",
      DOB: "",
    }));
    setCustCodeError(null);
    setIsCustomerSubmitted(false);
    setIsCustomerEditing(false);
    dispatch({ type: "SET_CUSTOMER", payload: undefined });
    setNumberSuggestions([]);
    setShowNumberSuggestions(false);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      // toast.error("Please fill all required fields");
      return;
    }
    if (custCodeError) {
      // toast.error('Cannot submit order due to customer code error.');
      return;
    }

    setIsSubmitting(true);
    try {
      const imageUrls: string[] = [];
      if (formData.PHOTOFILES.length > 0) {
        for (const file of formData.PHOTOFILES) {
          const storageRef = ref(
            storage,
            `images/${tenantId}/specialOrder_${Date.now()}_${file.name}`
          );
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
        }
      }

      const orderData = {
        ADDRESS: "",
        ADVANCE: "10",
        AMOUNT: formData.AMOUNT,
        BILL_DATE: Timestamp.fromDate(new Date()),
        BILL_NO: await generateBillNo(),
        CAKETYPE: formData.CAKETYPE,
        CATEGORY: formData.CATEGORY || "",
        CFLAVOR: formData.CFLAVOR || "",
        CIMAGEURL: imageUrls,
        CITY: "",
        CMESSAGE: formData.CMESSAGE || "",
        COMPANY: "TEST FRANCHISE",
        COUNTRY: "",
        CREMARKS: formData.CREMARKS || "",
        CUSTCODE: formData.CUSTOMER_CODE,
        CUSTNAME: formData.CUSTOMER_NAME || "",
        CUSTOMIZETYPE: formData.CUSTOMIZETYPE || "",
        DESCRIPT: "",
        DLVDATE: formData.DLVDATE
          ? Timestamp.fromDate(new Date(formData.DLVDATE))
          : null,
        MOBPHONE: formData.MOBILE_NUMBER || "",
        PCS: formData.PCS || "1",
        PRODCODE: formData.PRODCODE || "",
        RATE: formData.RATE || "",
        SECURITYRIGHTS: [],
        SEQUENCE: 0,
        SGroupDesc: formData.SGroupDes || "",
        STATUS: "PENDING",
        WEIGHT: formData.WEIGHT || "",
        slot: getSlotFromDate(formData.DLVDATE),
      };

      const specialOrderRef = collection(
        db,
        "TenantsDb",
        tenantId,
        collections.SPLORDER
      );
      await addDoc(specialOrderRef, orderData);

      const paymentDataForUrl = {
        products: [
          {
            id: orderData.PRODCODE,
            name: orderData.CAKETYPE || orderData.DESCRIPT,
            QUANTITY: Number(orderData.PCS),
            price: Number(orderData.RATE),
          },
        ],
        totalAmount: Number(orderData.AMOUNT),
        totalGstAmount: Number(orderData.AMOUNT) * 0.18,
        cgstAmount: Number(orderData.AMOUNT) * 0.09,
        sgstAmount: Number(orderData.AMOUNT) * 0.09,
        customerData: {
          name: orderData.CUSTNAME,
          MOBPHONE: orderData.MOBPHONE,
        },
        invoiceNumber: orderData.BILL_NO,
        date: orderData.BILL_DATE?.toDate().toISOString(),
      };

      toast.success("Order submitted successfully!");
      const encodedOrderData = encryptUrl(JSON.stringify(paymentDataForUrl));
      router.push(`/purchase/special/order/payment?data=${encodedOrderData}`);

      setFormData({
        CAKETYPE: "Catalog",
        CATEGORY: "",
        CFLAVOR: "",
        CMESSAGE: "",
        CREMARKS: "",
        CUSTOMIZETYPE: "",
        DLVDATE: "",
        PCS: "1",
        PRODCODE: "",
        RATE: "",
        AMOUNT: 0,
        SGroupDes: "",
        WEIGHT: "",
        PHOTOFILES: [],
        CUSTOMER_NAME: "",
        CUSTOMER_CODE: "",
        MOBILE_NUMBER: "",
        ANNIVERSARY: "",
        DOB: "",
      });
      setErrors({});
      setCustCodeError(null);
      setIsCustomerSubmitted(false);
      setIsCustomerEditing(false);
      dispatch({ type: "SET_CUSTOMER", payload: undefined });
    } catch (err) {
      console.error("Error submitting order:", err);
      // toast.error("Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCustomerDisabled = isCustomerSubmitted && !isCustomerEditing;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-inter">
     
      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full md:w-2/3 bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <h1 className="text-4xl tracking-wide font-bold text-center py-6 text-blue-700">
            Create Special Order
          </h1>
          <div className="flex justify-evenly py-2 bg-[#ececec] gap-4">
            {["Catalog", "Customize", "Normal"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <motion.button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab as "Catalog" | "Customize" | "Normal");
                    setFormData((prev) => ({
                      ...prev,
                      CAKETYPE: tab as "Catalog" | "Customize" | "Normal",
                      CATEGORY: "",
                      PRODCODE: "",
                      SGroupDes: "",
                      CUSTOMIZETYPE: "",
                      PHOTOFILES: [],
                      CFLAVOR: "",
                      RATE: "",
                      AMOUNT: 0,
                    }));
                    setErrors({});
                  }}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    backgroundColor: isActive ? "#3b82f6" : "#fff",
                    color: isActive ? "#fff" : "#3347f8",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="h-10 w-1/3 rounded-lg font-semibold text-sm sm:text-base shadow-xl"
                >
                  {tab}
                </motion.button>
              );
            })}
          </div>
          <form onSubmit={handleSubmit} className="p-8">
            <AnimatePresence mode="wait">
              {activeTab === "Catalog" && (
                <motion.div
                  key="catalog"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-lg shadow-md"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Category *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={categoryOptions}
                          name="CATEGORY"
                          value={formData.CATEGORY}
                          onChange={handleInputChange}
                        />
                      </div>
                      {errors.CATEGORY && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.CATEGORY}
                        </p>
                      )}
                    </div>
                    {formData.CATEGORY === "3d" && (
                      <div>
                        <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                          Product *
                        </label>
                        <div className="relative">
                          <DropdownCustom
                            items={products["3d"].map((product) => ({
                              value: product.id,
                              label: product.name,
                            }))}
                            name="PRODCODE"
                            value={formData.PRODCODE}
                            onChange={handleInputChange}
                            placeholder="Select Product"
                          />
                        </div>
                        {errors.PRODCODE && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.PRODCODE}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Weight *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={weightOptions}
                          name="WEIGHT"
                          value={formData.WEIGHT}
                          onChange={handleInputChange}
                          placeholder="Select Weight"
                        />
                      </div>
                      {errors.WEIGHT && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.WEIGHT}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="text"
                        name="PCS"
                        value={formData.PCS}
                        onChange={handleInputChange}
                        placeholder="Enter quantity"
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Rate *
                      </label>
                      <input
                        type="text"
                        name="RATE"
                        value={formData.RATE}
                        onChange={handleInputChange}
                        placeholder="Enter rate per unit"
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Amount *
                      </label>
                      <input
                        type="number"
                        name="AMOUNT"
                        value={formData.AMOUNT}
                        readOnly
                        className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 text-sm font-light cursor-not-allowed outline-none"
                      />
                      {errors.AMOUNT && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.AMOUNT}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Delivery Date *
                      </label>
                      <input
                        type="datetime-local"
                        name="DLVDATE"
                        value={formData.DLVDATE}
                        onChange={handleInputChange}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                        required
                      />
                      {errors.DLVDATE && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.DLVDATE}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Flavor *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={flavorOptions}
                          name="CFLAVOR"
                          value={formData.CFLAVOR}
                          onChange={handleInputChange}
                          placeholder="Select Flavor"
                        />
                      </div>
                      {errors.CFLAVOR && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.CFLAVOR}
                        </p>
                      )}
                    </div>
                    {formData.CATEGORY === "Photo" && (
                      <div
                        className={`p-4 rounded-lg transition-all ${
                          isDragging
                            ? "border-2 border-dashed border-gray-600 bg-gray-50"
                            : errors.PHOTOFILES
                            ? "border-2 border-dashed border-gray-600 bg-gray-50"
                            : "border-2 border-dashed border-gray-300"
                        } bg-white`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                      >
                        <label className="block text-sm font-light text-gray-700 mb-1">
                          Upload Photo *
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          id="photo-upload"
                        />
                        <label
                          htmlFor="photo-upload"
                          className="flex items-center justify-center text-center cursor-pointer text-sm text-gray-600 hover:underline"
                        >
                          Click or drag files here to upload
                        </label>
                        {formData.PHOTOFILES.length > 0 && (
                          <p className="mt-1 text-xs text-green-600">
                            {formData.PHOTOFILES.length} file(s) selected
                          </p>
                        )}
                        {errors.PHOTOFILES && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.PHOTOFILES}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Message on Cake
                      </label>
                      <textarea
                        name="CMESSAGE"
                        value={formData.CMESSAGE}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                        placeholder="Happy Birthday, Congrats..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Remarks
                      </label>
                      <textarea
                        name="CREMARKS"
                        value={formData.CREMARKS}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                        placeholder="Enter any special notes or remarks"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === "Customize" && (
                <motion.div
                  key="customize"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-lg shadow-md"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Customize Type *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={customizeTypeOptions}
                          name="CUSTOMIZETYPE"
                          value={formData.CUSTOMIZETYPE}
                          onChange={handleInputChange}
                          placeholder="Select Customize Type"
                        />
                      </div>
                      {errors.CUSTOMIZETYPE && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.CUSTOMIZETYPE}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Weight *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={weightOptions}
                          name="WEIGHT"
                          value={formData.WEIGHT}
                          onChange={handleInputChange}
                          placeholder="Select Weight"
                        />
                      </div>
                      {errors.WEIGHT && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.WEIGHT}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="text"
                        name="PCS"
                        value={formData.PCS}
                        onChange={handleInputChange}
                        placeholder="Enter quantity"
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Rate *
                      </label>
                      <input
                        type="text"
                        name="RATE"
                        value={formData.RATE}
                        onChange={handleInputChange}
                        placeholder="Enter rate per unit"
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Amount *
                      </label>
                      <input
                        type="number"
                        name="AMOUNT"
                        value={formData.AMOUNT}
                        readOnly
                        className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 text-sm font-light cursor-not-allowed outline-none"
                      />
                      {errors.AMOUNT && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.AMOUNT}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Delivery Date *
                      </label>
                      <input
                        type="datetime-local"
                        name="DLVDATE"
                        value={formData.DLVDATE}
                        onChange={handleInputChange}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                        required
                      />
                      {errors.DLVDATE && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.DLVDATE}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Flavor *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={flavorOptions}
                          name="CFLAVOR"
                          value={formData.CFLAVOR}
                          onChange={handleInputChange}
                          placeholder="Select Flavor"
                        />
                      </div>
                      {errors.CFLAVOR && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.CFLAVOR}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Message on Cake
                      </label>
                      <textarea
                        name="CMESSAGE"
                        value={formData.CMESSAGE}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                        placeholder="Happy Birthday, Congrats..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Remarks
                      </label>
                      <textarea
                        name="CREMARKS"
                        value={formData.CREMARKS}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                        placeholder="Enter any special notes or remarks"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === "Normal" && (
                <motion.div
                  key="normal"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-lg shadow-md"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Subgroup *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={Array.from(
                            new Set(
                              availableProducts.map(
                                (product) => product.SGroupDesc
                              )
                            )
                          ).map((group) => ({
                            value: group,
                            label: group,
                          }))}
                          name="SGroupDes"
                          value={formData.SGroupDes}
                          onChange={handleInputChange}
                          placeholder="Select Subgroup"
                        />
                      </div>
                      {errors.SGroupDes && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.SGroupDes}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Product *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={availableProducts
                            .filter(
                              (product) =>
                                !formData.SGroupDes ||
                                product.SGroupDesc === formData.SGroupDes
                            )
                            .map((product) => ({
                              value: product.PRODCODE,
                              label: product.DESCRIPT,
                            }))}
                          name="PRODCODE"
                          value={formData.PRODCODE}
                          onChange={handleInputChange}
                          placeholder="Select Product"
                        />
                      </div>
                      {errors.PRODCODE && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.PRODCODE}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Weight *
                      </label>
                      <div className="relative">
                        <DropdownCustom
                          items={weightOptions}
                          name="WEIGHT"
                          value={formData.WEIGHT}
                          onChange={handleInputChange}
                          placeholder="Select Weight"
                        />
                      </div>
                      {errors.WEIGHT && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.WEIGHT}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="text"
                        name="PCS"
                        value={formData.PCS}
                        onChange={handleInputChange}
                        placeholder="Enter quantity"
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Rate *
                      </label>
                      <input
                        type="text"
                        name="RATE"
                        value={formData.RATE}
                        onChange={handleInputChange}
                        placeholder="Enter rate per unit"
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Amount *
                      </label>
                      <input
                        type="number"
                        name="AMOUNT"
                        value={formData.AMOUNT}
                        readOnly
                        className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 text-sm font-light cursor-not-allowed outline-none"
                      />
                      {errors.AMOUNT && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.AMOUNT}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Delivery Date *
                      </label>
                      <input
                        type="datetime-local"
                        name="DLVDATE"
                        value={formData.DLVDATE}
                        onChange={handleInputChange}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
                        required
                      />
                      {errors.DLVDATE && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.DLVDATE}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                        Remarks
                      </label>
                      <textarea
                        name="CREMARKS"
                        value={formData.CREMARKS}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 text-sm"
                        placeholder="Enter any special notes or remarks"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-end space-x-4 mt-8">
              <motion.button
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 4px 12px rgba(0, 0, 2, 0.2)",
                }}
                whileTap={{ scale: 0.95 }}
                type="button"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300 transition-all duration-200"
                onClick={() =>
                  setFormData({
                    ...formData,
                    CAKETYPE: "Catalog",
                    CATEGORY: "",
                    CFLAVOR: "",
                    CMESSAGE: "",
                    CREMARKS: "",
                    CUSTOMIZETYPE: "",
                    DLVDATE: "",
                    PCS: "1",
                    PRODCODE: "",
                    RATE: "",
                    AMOUNT: 0,
                    SGroupDes: "",
                    WEIGHT: "",
                    PHOTOFILES: [],
                  })
                }
              >
                Reset Order
              </motion.button>
              <motion.button
                whileHover={{
                  scale: isSubmitting ? 1 : 1.05,
                  boxShadow: isSubmitting
                    ? "none"
                    : "0 4px 12px rgba(99, 102, 241, 0.3)",
                }}
                whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-3 text-white rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isSubmitting
                    ? "bg-indigo-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {isSubmitting ? "Submitting..." : "Submit Order"}
              </motion.button>
            </div>
          </form>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full md:w-1/3 bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <h2 className="text-4xl font-bold text-center py-6 text-blue-700">
            Customer Details
          </h2>
          <form onSubmit={handleCustomerSubmit} className="p-8 space-y-4">
            <div>
              <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                Customer Code *
              </label>
              <input
                type="text"
                name="CUSTOMER_CODE"
                value={custCodeLoading ? "Loading..." : (custCodeError || formData.CUSTOMER_CODE)}
                disabled
                className="w-full p-3 rounded-lg bg-gray-100 text-gray-700 text-sm font-normal cursor-not-allowed border border-gray-300"
              />
              {custCodeError && (
                <p className="text-red-500 text-xs mt-1">{custCodeError}</p>
              )}
              {errors.CUSTOMER_CODE && (
                <p className="text-red-500 text-xs mt-1">{errors.CUSTOMER_CODE}</p>
              )}
            </div>
            <div className="relative">
              <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="number"
                name="MOBILE_NUMBER"
                value={formData.MOBILE_NUMBER}
                onChange={handleCustomerInputChange}
                placeholder="Enter mobile number"
                className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 text-gray-700 outline-blue-700 transition-all"
                disabled={isCustomerDisabled || suggestionLoading}
                maxLength={10}
                onFocus={() => {
                  if (
                    formData.MOBILE_NUMBER.length >= 3 &&
                    numberSuggestions.length > 0
                  ) {
                    setShowNumberSuggestions(true);
                  }
                }}
                onBlur={() =>
                  setTimeout(() => setShowNumberSuggestions(false), 150)
                }
                required
              />
              {showNumberSuggestions && numberSuggestions.length > 0 && (
                <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded shadow w-full max-h-48 overflow-y-auto mt-1">
                  <table className="w-full table-auto text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1 text-left font-semibold">
                          Name
                        </th>
                        <th className="px-2 py-1 text-left font-semibold">
                          Number
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {numberSuggestions.map((s) => (
                        <tr
                          key={s.CUSTCODE}
                          className="hover:bg-blue-50 cursor-pointer"
                          onMouseDown={() => handleSuggestionClick(s)}
                        >
                          <td className="px-2 py-1">{s.NAME || "Unknown"}</td>
                          <td className="px-2 py-1">{s.MOBPHONE || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {suggestionLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
              {errors.MOBILE_NUMBER && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.MOBILE_NUMBER}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                name="CUSTOMER_NAME"
                value={formData.CUSTOMER_NAME}
                onChange={handleCustomerInputChange}
                placeholder="Enter customer name"
                className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 text-gray-700 outline-blue-700 transition-all"
                disabled={isCustomerDisabled || suggestionLoading}
                required
              />
              {errors.CUSTOMER_NAME && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.CUSTOMER_NAME}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                Anniversary
              </label>
              <input
                type="date"
                name="ANNIVERSARY"
                value={formData.ANNIVERSARY || ""}
                onChange={handleCustomerInputChange}
                className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 text-gray-700 outline-blue-700 transition-all"
                disabled={isCustomerDisabled || suggestionLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                name="DOB"
                value={formData.DOB || ""}
                onChange={handleCustomerInputChange}
                className="w-full p-3 rounded-lg bg-white text-sm font-normal border border-gray-300 text-gray-700 outline-blue-700 transition-all"
                disabled={isCustomerDisabled || suggestionLoading}
              />
            </div>
            <div className="flex justify-end gap-2">
              
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="px-4 py-2 text-sm bg-gray-200 font-semibold text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                  onClick={handleCustomerReset}
                  disabled={suggestionLoading || custCodeLoading}
                >
                  Reset
                </motion.button>
              {!isCustomerSubmitted || isCustomerEditing ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="px-4 py-2 text-sm bg-green-600 font-semibold text-white rounded-lg hover:bg-green-700 transition-all"
                  disabled={suggestionLoading || custCodeLoading}
                >
                  {isCustomerEditing ? "Save" : "Submit"}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="px-4 py-2 text-sm bg-yellow-500 font-semibold text-white rounded-lg hover:bg-yellow-600 transition-all"
                  onClick={handleCustomerEdit}
                  disabled={suggestionLoading || custCodeLoading}
                >
                  Edit
                </motion.button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
      <style jsx>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default CompactOrderForm;