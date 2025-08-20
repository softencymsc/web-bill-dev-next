/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useContext, useEffect, JSX } from "react";
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from "next/navigation";
import { Product, Customer } from "@/types/page";
import Image from "next/image";
import { getPrefixForModel } from "@/services";
import { db } from "../../firebase";
import { collections } from "../config";
import {
  collection,
  Timestamp,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  limit,
  orderBy,
} from "firebase/firestore";
import { createData } from "@/services";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { BiCaretRight } from "react-icons/bi";
import {
  MdOutlineBookmarkBorder,
  MdOutlineDrafts,
  MdOutlineHistory,
  MdOutlineReceiptLong,
} from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";

type AddedProduct = Product;
interface Bill {
  id: string;
  BILL_NO?: string;
  [key: string]: any;
}

interface BillDetail {
  id: string;
  [key: string]: any;
}

interface DetailedBill {
  bill: Bill;
  details: BillDetail[];
}

const AddCustomer = ({
  page,
  id,
}: {
  page: string;
  id: string | null;
}): JSX.Element => {
  const { state, dispatch } = useContext(CounterContext);
  const { products, customerData, tenantId } = state;
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [custCodeLoading, setCustCodeLoading] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [orderData, setOrderData] = useState<any[]>([]);
  const [oaNo, setOANo] = useState<string>("");
  const [draftData, setDraftData] = useState<any[]>([]);
  const [previousBills, setPreviousBills] = useState<DetailedBill[]>([]);
  const [showPreviousBills, setShowPreviousBills] = useState(false);
  const [customer, setCustomer] = useState<Customer>({
    NAME: "",
    number: "",
    ADDRESS: "",
    CITY: "",
    COUNTRY: "",
    CUSTCODE: "",
    MOBPHONE: "",
    anniversary: "",
    birthday: "",
    paymentDate: undefined,
    invoiceNumber: undefined,
    GSTIn: "",
  });
  const [addedProducts, setAddedProducts] = useState<AddedProduct[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [numberSuggestions, setNumberSuggestions] = useState<any[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<any[]>([]);
  const [showNumberSuggestions, setShowNumberSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<"MOBPHONE" | "NAME" | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [modelName, setModelName] = useState("Sale Bill");
  const currency = state.currency ||  "₹"
  const fetchPreviousBills = async (
    MbNum: string
  ): Promise<DetailedBill[] | undefined> => {
    try {
      if (!MbNum) {
        // toast.error("Customer mobile number missing");
        return;
      }

      const billRef = query(
        collection(db, "TenantsDb", tenantId, collections.BILL),
        where("MOBPHONE", "==", MbNum),
        orderBy("BILL_DATE", "desc"),
        limit(5)
      );

      const billSnapshot = await getDocs(billRef);

      const bills: Bill[] = billSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Bill, "id">),
      }));

      console.log(`✅ Fetched ${bills.length} latest bills for customer.`);

      const detailedBills: DetailedBill[] = [];

      for (const bill of bills) {
        const billNo = bill.BILL_NO;
        if (!billNo) continue;

        const billDetRef = query(
          collection(db, "TenantsDb", tenantId, collections.BILLDET),
          where("BILL_NO", "==", billNo)
        );

        const billDetSnapshot = await getDocs(billDetRef);

        const billDetails: BillDetail[] = billDetSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        detailedBills.push({
          bill,
          details: billDetails,
        });
      }

      return detailedBills;
    } catch (error) {
      console.error("❌ Error fetching previous bills:", error);
    }
  };

  const handleFetchPreviousBills = async (MbNum: any) => {
    const data = await fetchPreviousBills(MbNum);
    if (data) setPreviousBills(data);
  };

  const generateUniqueCustomerCode = async (): Promise<string> => {
    try {
      const custRef = collection(
        db,
        "TenantsDb",
        tenantId,
        collections.CUSTOMERS
      );
      const modelType =
        page === "Purchase Order" || page === "Purchase Bill"
          ? "Vendor"
          : "Customer";
      const custVend = modelType === "Customer" ? "C" : "V";
      const defaultPrefix = modelType === "Customer" ? "CUS" : "VEN";

      let prefix: string;
      try {
        prefix = await getPrefixForModel(tenantId, modelType);
      } catch (error) {
        console.warn(
          `Prefix not found for ${modelType}, using default: ${defaultPrefix}`,
          error
        );
        prefix = defaultPrefix;

        try {
          const docnumRef = doc(db, "TenantsDb", tenantId, "DOCNUM", modelType);
          await setDoc(docnumRef, { prefix }, { merge: true });
        } catch (setError) {
          console.error(`Failed to save default prefix to DOCNUM:`, setError);
        }
      }

      const querySnapshot = await getDocs(custRef);
      let maxCodeNumber = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const custCode = data.CUSTCODE;
        const docCustVend = data.CUST_VEND;

        if (
          typeof custCode === "string" &&
          custCode.startsWith(prefix) &&
          docCustVend === custVend
        ) {
          const codeNumberStr = custCode.replace(prefix, "");
          const codeNumber = parseInt(codeNumberStr, 10);
          if (!isNaN(codeNumber) && codeNumber > maxCodeNumber) {
            maxCodeNumber = codeNumber;
          }
        }
      });

      const nextCodeNumber = maxCodeNumber + 1;
      const formattedCodeNumber = nextCodeNumber.toString().padStart(3, "0");

      return `${prefix}${formattedCodeNumber}`;
    } catch (error) {
      console.error("Error generating customer code:", error);
      throw new Error("Failed to generate customer code");
    }
  };

  const setUniqueCode = async () => {
    setCustCodeLoading(true);
    setCodeError(null);
    try {
      const newCode = await generateUniqueCustomerCode();
      setCustomer((prev) => ({ ...prev, CUSTCODE: newCode }));
    } catch (error) {
      console.error("Error generating customer code:", error);
      setCodeError("Failed to generate customer code. Please try again.");
      // toast.error("Failed to generate customer code. Please try again.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    } finally {
      setCustCodeLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      setUniqueCode();
    } else {
      setCustCodeLoading(false);
      setCodeError("Tenant ID is missing.");
      // toast.error("Tenant ID is missing.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    }
  }, [tenantId, page]);

  useEffect(() => {
    const savedProducts = sessionStorage.getItem("products");
    const savedAddedProducts = sessionStorage.getItem("addedProducts");

    if (savedProducts && products.length === 0) {
      try {
        let parsedProducts = JSON.parse(savedProducts);
        if (Array.isArray(parsedProducts)) {
          parsedProducts = parsedProducts.filter(
            (p: Product) => Number(p.QUANTITY) > 0
          );
          dispatch({ type: "SET_PRODUCTS", payload: parsedProducts });
          sessionStorage.setItem("products", JSON.stringify(parsedProducts));
        }
      } catch (error) {
        console.error("Failed to parse sessionStorage products:", error);
        sessionStorage.removeItem("products");
      }
    }

    if (savedAddedProducts && addedProducts.length === 0) {
      try {
        let parsedAddedProducts = JSON.parse(savedAddedProducts);
        if (Array.isArray(parsedAddedProducts)) {
          parsedAddedProducts = parsedAddedProducts.filter(
            (p: Product) => Number(p.QUANTITY) > 0
          );
          setAddedProducts(parsedAddedProducts);
          dispatch({
            type: "SET_ADDED_PRODUCTS",
            payload: parsedAddedProducts,
          });
          sessionStorage.setItem(
            "addedProducts",
            JSON.stringify(parsedAddedProducts)
          );
        }
      } catch (error) {
        console.error("Failed to parse sessionStorage addedProducts:", error);
        sessionStorage.removeItem("addedProducts");
      }
    }
  }, [dispatch, products.length, addedProducts.length]);

  useEffect(() => {
    if (Array.isArray(products) && products.length > 0) {
      const filteredProducts = products.filter((p) => Number(p.QUANTITY) > 0);
      sessionStorage.setItem("products", JSON.stringify(filteredProducts));
    } else {
      sessionStorage.setItem("products", JSON.stringify([]));
    }
    if (Array.isArray(addedProducts) && addedProducts.length > 0) {
      const filteredAddedProducts = addedProducts.filter(
        (p) => Number(p.QUANTITY) > 0
      );
      sessionStorage.setItem(
        "addedProducts",
        JSON.stringify(filteredAddedProducts)
      );
    } else {
      sessionStorage.setItem("addedProducts", JSON.stringify([]));
    }
  }, [products, addedProducts]);

  useEffect(() => {
    if (customerData) {
      setCustomer({
        NAME: customerData.NAME || customerData.name || "",
        number: customerData.number || customerData.MOBPHONE || "",
        ADDRESS: customerData.ADDRESS || "",
        CITY: customerData.CITY || "",
        COUNTRY: customerData.COUNTRY || "",
        CUSTCODE: customerData.CUSTCODE || "",
        MOBPHONE: customerData.MOBPHONE || customerData.number || "",
        anniversary:
          customerData.anniversary || customerData.MarriageAnniversary || "",
        birthday: customerData.birthday || customerData.DOB || "",
        paymentDate: customerData.paymentDate || undefined,
        invoiceNumber: customerData.invoiceNumber || undefined,
        GSTIn: customerData.GSTIn || "",
      });
      setIsSubmitted(true);
      setCustCodeLoading(false);
      setCodeError(null);
    } else {
      setCustomer({
        NAME: "",
        number: "",
        ADDRESS: "",
        CITY: "",
        COUNTRY: "",
        CUSTCODE: customer.CUSTCODE,
        MOBPHONE: "",
        anniversary: "",
        birthday: "",
        paymentDate: undefined,
        invoiceNumber: undefined,
        GSTIn: "",
      });
      setIsSubmitted(false);
    }
  }, [customerData]);

  useEffect(() => {
    if (Array.isArray(products)) {
      const filtered = products
        .filter((item) => Number(item.QUANTITY) > 0)
        .map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          OPENING_Q: item.OPENING_Q || "0",
          QUANTITY: item.QUANTITY || "0",
          image: item.image ?? null,
          UOM_SALE: item.UOM_SALE || "",
          SGroupDesc: item.SGroupDesc || "",
          GroupDesc: item.GroupDesc || "",
          DESCRIPT: item.DESCRIPT || "",
          IGST: item.IGST || 0,
          DISCOUNTAMT: Number(item.DISCOUNTAMT || 0),
          MRP_RATE: Number(item.MRP_RATE || 0),
          PRODCODE: item.PRODCODE || "",
          category: item.category || "",
          FOOD_TYPE: item.FOOD_TYPE ?? 0,
        }));
      setAddedProducts(filtered);
      dispatch({ type: "SET_ADDED_PRODUCTS", payload: filtered });
      sessionStorage.setItem("addedProducts", JSON.stringify(filtered));
    }
  }, [products, dispatch]);

  useEffect(() => {
    const fetchAllCustomers = async () => {
      try {
        const custRef = query(
          collection(db, "TenantsDb", tenantId, collections.CUSTOMERS),
          where("CUST_VEND", "==", page.includes("Purchase") ? "V" : "C")
        );

        const snapshot = await getDocs(custRef);

        const results = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setAllCustomers(results);
      } catch (error) {
        console.error("❌ Error fetching customers/vendors:", error);
        // toast.error("Failed to load customers/vendors", {
        //   position: "top-center",
        //   autoClose: 2000,
        // });
      }
    };

    fetchAllCustomers();
  }, [tenantId, page]);

  useEffect(() => {
    if (
      (page === "Sale Bill" || page === "Purchase Bill") &&
      isSubmitted &&
      customer.MOBPHONE
    ) {
      const fetchDraftBills = async () => {
        try {
          const draftRef = query(
            collection(db, "TenantsDb", tenantId, "DRAFT"),
            where("bill.MOBPHONE", "==", customer.MOBPHONE || "")
          );
          const snapshot = await getDocs(draftRef);
          const results = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setDraftData(results);
        } catch (error) {
          console.error("Error fetching draft bills:", error);
          // toast.error("Failed to load draft bills", {
          //   position: "top-center",
          //   autoClose: 2000,
          // });
        }
      };

      const fetchOrders = async () => {
        try {
          const collectionName =
            page === "Sale Bill" ? collections.ORDER : collections.PORDER;
          const orderRef = query(
            collection(db, "TenantsDb", tenantId, collectionName),
            where("MOBPHONE", "==", customer.MOBPHONE || ""),
            where("BILL_LINK", "==", false)
          );

          const snapshot = await getDocs(orderRef);

          const results = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setOrderData(results);
        } catch (error) {
          console.error("❌ Error fetching orders:", error);
          // toast.error("Failed to load orders", {
          //   position: "top-center",
          //   autoClose: 2000,
          // });
        }
      };

      fetchDraftBills();
      fetchOrders();
    }
  }, [isSubmitted, customer.MOBPHONE, tenantId, page]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "NAME") {
      const nameRegex = /^[a-zA-Z\s'-]*$/;
      if (!nameRegex.test(value)) {
        setNameError(
          "Name can only contain letters, spaces, hyphens, or apostrophes"
        );
        return;
      } else {
        setNameError(null);
      }

      if (value.length >= 1) {
        const filtered = allCustomers.filter(
          (c) => c.NAME && c.NAME.toLowerCase().includes(value.toLowerCase())
        );
        setNameSuggestions(filtered);
        setShowNameSuggestions(true);
        setActiveInput("NAME");
      } else {
        setNameSuggestions([]);
        setShowNameSuggestions(false);
        if (!customer.MOBPHONE) setActiveInput(null);
      }
    }
    setCustomer((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "MOBPHONE") {
      setCustomer((prev) => ({ ...prev, MOBPHONE: value, number: value }));

      if (value.length >= 1) {
        const filtered = allCustomers.filter(
          (c) => c.MOBPHONE && c.MOBPHONE.toString().includes(value)
        );
        setNumberSuggestions(filtered);
        setShowNumberSuggestions(true);
        setActiveInput("MOBPHONE");
      } else {
        setNumberSuggestions([]);
        setShowNumberSuggestions(false);
        if (!customer.NAME) setActiveInput(null);
      }
    }
  };

  const handleSuggestionClick = async (selectedCustomer: any) => {
    setSuggestionLoading(true);
    try {
      const formattedCustomer: Customer = {
        id: selectedCustomer.id || "",
        number: selectedCustomer.MOBPHONE
          ? String(selectedCustomer.MOBPHONE)
          : "",
        NAME: selectedCustomer.NAME || "",
        MOBPHONE: selectedCustomer.MOBPHONE
          ? String(selectedCustomer.MOBPHONE)
          : "",
        ADDRESS: selectedCustomer.ADDRESS || "",
        CITY: selectedCustomer.CITY || "",
        COUNTRY: selectedCustomer.COUNTRY || "",
        CUSTCODE: selectedCustomer.CUSTCODE
          ? String(selectedCustomer.CUSTCODE)
          : "",
        anniversary: selectedCustomer.MarriageAnniversary
          ? selectedCustomer.MarriageAnniversary.toDate
            ? format(
                selectedCustomer.MarriageAnniversary.toDate(),
                "yyyy-MM-dd"
              )
            : format(
                new Date(selectedCustomer.MarriageAnniversary),
                "yyyy-MM-dd"
              )
          : "",
        birthday: selectedCustomer.DOB
          ? selectedCustomer.DOB.toDate
            ? format(selectedCustomer.DOB.toDate(), "yyyy-MM-dd")
            : format(new Date(selectedCustomer.DOB), "yyyy-MM-dd")
          : "",
        paymentDate: selectedCustomer.paymentDate || undefined,
        invoiceNumber: selectedCustomer.invoiceNumber || undefined,
        GSTIn: selectedCustomer.GSTIn || "",
      };
      handleFetchPreviousBills(formattedCustomer.MOBPHONE);
      setCustomer(formattedCustomer);
      dispatch({ type: "SET_CUSTOMER", payload: formattedCustomer });
      setSuggestions([]);
      setNumberSuggestions([]);
      setNameSuggestions([]);
      setShowNumberSuggestions(false);
      setShowNameSuggestions(false);
      setActiveInput(null);
      setNameError(null);
      setCustCodeLoading(false);
      setCodeError(null);

      setIsSubmitted(true);
      setIsEditing(false);
    } catch (error) {
      console.error("Error processing suggestion:", error);
      // toast.error("Failed to load customer data", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    } finally {
      setSuggestionLoading(false);
    }
  };

  const getCustDOCnum = async (): Promise<string> => {
    let model: string;
    switch (page) {
      case "Purchase Bill":
        model = "purchaseBill";
        break;
      case "Purchase Order":
        model = "purchaseOrder";
        break;
      case "Sale Order":
        model = "order";
        break;
      case "Sale Bill":
        model = "sale_bill";
        break;
      default:
        model = "sale_bill";
        break;
    }

    let modelName: string;
    switch (model) {
      case "purchaseBill":
        modelName = "Vendor";
        break;
      case "purchaseOrder":
        modelName = "Vendor";
        break;
      case "order":
        modelName = "Customer";
        break;
      case "sale_bill":
        modelName = "Customer";
        break;
      default:
        modelName = "Customer";
        break;
    }
    setModelName(modelName);
    const prefix = await getPrefixForModel(tenantId, modelName);
    return prefix;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nameError) {
      // toast.error("Please fix the name input error before submitting", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    if (codeError) {
      // toast.error("Cannot submit form due to code generation error.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    if (!customer.CUSTCODE) {
      // toast.error("Invalid customer code.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    setCustCodeLoading(true);
    try {
      const custRef = collection(
        db,
        "TenantsDb",
        tenantId,
        collections.CUSTOMERS
      );
      const modelType =
        page === "Purchase Order" || page === "Purchase Bill" ? "V" : "C";

      const customerQuery = query(
        custRef,
        where("MOBPHONE", "==", customer.MOBPHONE)
      );
      const customerSnapshot = await getDocs(customerQuery);

      if (customerSnapshot.empty) {
        const newCustomerData = {
          number: customer.number,
          NAME: customer.NAME,
          MOBPHONE: customer.MOBPHONE,
          ADDRESS: customer.ADDRESS,
          CITY: customer.CITY,
          COUNTRY: customer.COUNTRY,
          CUSTCODE: customer.CUSTCODE,
          CUST_VEND: modelType,
          anniversary: customer.anniversary
            ? Timestamp.fromDate(new Date(customer.anniversary))
            : null,
          birthday: customer.birthday
            ? Timestamp.fromDate(new Date(customer.birthday))
            : null,
          GSTIn: customer.GSTIn || "",
          createdAt: Timestamp.fromDate(new Date()),
        };
        await createData(custRef, newCustomerData);
        toast.success(
          `${modelType === "V" ? "Vendor" : "Customer"} added successfully`,
          {
            position: "top-center",
            autoClose: 2000,
          }
        );
      }

      const updatedCustomer = { ...customer };
      dispatch({ type: "SET_CUSTOMER", payload: updatedCustomer });

      setIsSubmitted(true);
      setIsEditing(false);

      await setUniqueCode();
    } catch (error) {
      console.error("Error adding customer:", error);
      // toast.error(
      //   `Failed to add ${
      //     page === "Purchase Order" || page === "Purchase Bill"
      //       ? "vendor"
      //       : "customer"
      //   }`,
      //   {
      //     position: "top-center",
      //     autoClose: 2000,
      //   }
      // );
      setCodeError("Failed to save customer data.");
    } finally {
      setCustCodeLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setIsSubmitted(false);
  };

  const handleReset = () => {
    setCustomer({
      NAME: "",
      number: "",
      ADDRESS: "",
      CITY: "",
      COUNTRY: "",
      CUSTCODE: "",
      MOBPHONE: "",
      anniversary: "",
      birthday: "",
      paymentDate: undefined,
      invoiceNumber: undefined,
      GSTIn: "",
    });
    setIsEditing(false);
    setIsSubmitted(false);
    dispatch({ type: "SET_CUSTOMER", payload: undefined });
    dispatch({ type: "SET_PRODUCTS", payload: [] });
    setAddedProducts([]);
    sessionStorage.removeItem("products");
    sessionStorage.removeItem("addedProducts");
    setDraftData([]);
    setNameSuggestions([]);
    setNumberSuggestions([]);
    setShowNameSuggestions(false);
    setShowNumberSuggestions(false);
    setActiveInput(null);
    setPreviousBills([]);
    setNameError(null);
    setOrderData([]);
    setUniqueCode();
  };

  const getDOCnum = async (): Promise<string> => {
    let model: string;
    switch (page) {
      case "Purchase Bill":
        model = "purchaseBill";
        break;
      case "Purchase Order":
        model = "purchaseOrder";
        break;
      case "Sale Order":
        model = "order";
        break;
      case "Sale Bill":
        model = "sale_bill";
        break;
      default:
        model = "sale_bill";
        break;
    }

    let modelName: string;
    switch (model) {
      case "purchaseBill":
        modelName = "Purchase Bill";
        break;
      case "purchaseOrder":
        modelName = "Purchase Order";
        break;
      case "order":
        modelName = "Sale Order";
        break;
      case "sale_bill":
        modelName = "Sale Bill";
        break;
      default:
        modelName = "Sale Bill";
        break;
    }
    setModelName(modelName);
    const prefix = await getPrefixForModel(tenantId, modelName);
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

  const handleProceed = async () => {
    if (nameError) {
      // toast.error("Please fix the name input error before proceeding", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    if (codeError) {
      // toast.error("Cannot proceed due to code generation error.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    let billNo = "";
    billNo = await generateBillNo();
    if (page === "Sale Order") {
      dispatch({ type: "SET_CUSTOMER", payload: customer });
      dispatch({ type: "SET_BILL_NO", payload: billNo });
      router.push(
        `/sale/order/payment?billNo=${billNo}&page=${encodeURIComponent(page)}`
      );
    } else if (page === "Purchase Order") {
      billNo = await generateBillNo();
      dispatch({ type: "SET_CUSTOMER", payload: customer });
      dispatch({ type: "SET_BILL_NO", payload: billNo });
      router.push(
        `/purchase/order/payment?billNo=${billNo}&page=${encodeURIComponent(
          page
        )}`
      );
    } else if (page === "Purchase Bill") {
      if (oaNo !== "") {
        billNo = oaNo;
      } else {
        billNo = await generateBillNo();
      }

      dispatch({ type: "SET_CUSTOMER", payload: customer });
      dispatch({ type: "SET_BILL_NO", payload: billNo });
      router.push(
        `/purchase/bill/payment?billNo=${billNo}&page=${encodeURIComponent(
          page
        )}`
      );
    } else {
      if (oaNo !== "") {
        billNo = oaNo;
      } else {
        billNo = await generateBillNo();
      }
      dispatch({ type: "SET_CUSTOMER", payload: customer });
      dispatch({ type: "SET_BILL_NO", payload: billNo });
      router.push(
        `/sale/bill/payment?billNo=${billNo}&page=${encodeURIComponent(page)}`
      );
    }
  };

  const handleDraftBill = async () => {
    if (nameError) {
      // toast.error("Please fix the name input error before saving draft", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    if (codeError) {
      // toast.error("Cannot save draft due to code generation error.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    setDraftLoading(true);
    try {
      const billNo = await generateBillNo();
      const currentTimestamp = Timestamp.fromDate(new Date());

      const draftRef = query(
        collection(db, "TenantsDb", tenantId, "DRAFT"),
        where("bill.MOBPHONE", "==", customer.MOBPHONE || "")
      );
      const snapshot = await getDocs(draftRef);
      if (!snapshot.empty) {
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, "TenantsDb", tenantId, "DRAFT", docSnap.id));
        }
      }

      const basicAmount = addedProducts.reduce(
        (sum, item) => sum + Number(item.QUANTITY) * item.price,
        0
      );
      const igstPercent = addedProducts[0]?.IGST || 18;
      const gstAmount = basicAmount * (igstPercent / 100);
      const cgstAmount = gstAmount / 2;
      const sgstAmount = gstAmount / 2;
      const netAmount = basicAmount + gstAmount;

      const billData = {
        BILL_DATE: currentTimestamp,
        BILL_NO: billNo,
        bill: {
          ADDRESS: customer.ADDRESS || "",
          BASIC: basicAmount,
          BILL_DATE: currentTimestamp,
          BILL_NO: billNo,
          CARD_RECEIVED: 0,
          CASH_RECEIVED: 0,
          CGST_AMT: cgstAmount,
          CITY: customer.CITY || "",
          COUNTRY: customer.COUNTRY || "",
          CREDIT_RECEIVED: netAmount,
          CUSTCODE: customer.CUSTCODE || "",
          CUSTNAME: customer.NAME || "",
          GST_AMT: gstAmount,
          IS_CREDIT: "YES",
          IS_DRAFT: "YES",
          IS_FREE: "NO",
          MOBPHONE: customer.MOBPHONE || "",
          NET_AMT: netAmount,
          OUTSTANDING_AMT: netAmount,
          PAY_MODE: "CREDIT",
          SGST_AMT: sgstAmount,
          TERMTOTAL: 0,
          UPI_DETAILS: [],
          UPI_RECEIVED: 0,
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
        productEntries: addedProducts.map((item) => ({
          AMOUNT: Number(item.QUANTITY) * item.price,
          BILL_DATE: currentTimestamp,
          BILL_NO: billNo,
          CGSTAMT:
            (Number(item.QUANTITY) * item.price * (item.IGST || 18)) / 200,
          CUSTNAME: customer.NAME || "",
          GSTAMT:
            (Number(item.QUANTITY) * item.price * (item.IGST || 18)) / 100,
          GroupDesc: item.GroupDesc || "Finish Goods",
          IGSTAMT:
            (Number(item.QUANTITY) * item.price * (item.IGST || 18)) / 100,
          IGSTPER: item.IGST || 18,
          PRODCODE: item.PRODCODE || "",
          PRODNAME: item.name || "",
          PRODTOTAL: Number(item.QUANTITY) * item.price,
          QUANTITY: Number(item.QUANTITY),
          RATE: String(item.price),
          SGSTAMT:
            (Number(item.QUANTITY) * item.price * (item.IGST || 18)) / 200,
          SGroupDesc: item.SGroupDesc || "",
          TOTALAMT:
            Number(item.QUANTITY) * item.price +
            (Number(item.QUANTITY) * item.price * (item.IGST || 18)) / 100,
          UOM: item.UOM_SALE || "PCS",
        })),
      };

      const billRef = collection(db, "TenantsDb", tenantId, "DRAFT");
      await addDoc(billRef, billData);

      const updatedDraft = { id: billNo, ...billData };
      setDraftData([updatedDraft]);

      toast.success("Draft bill saved successfully!", {
        position: "top-center",
        autoClose: 2000,
      });

      handleReset();
    } catch (error) {
      console.error("Error saving draft bill:", error);
      // toast.error("Failed to save draft bill", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    } finally {
      setDraftLoading(false);
    }
  };

  const handleDraftClick = async (draft: any) => {
    try {
      const formattedCustomer: Customer = {
        NAME: draft.bill.CUSTNAME || "",
        number: draft.bill.MOBPHONE || "",
        MOBPHONE: draft.bill.MOBPHONE || "",
        ADDRESS: draft.bill.ADDRESS || "",
        CITY: draft.bill.CITY || "",
        COUNTRY: draft.bill.COUNTRY || "",
        CUSTCODE: String(draft.bill.CUSTCODE) || "",
        anniversary: "",
        birthday: "",
        paymentDate: undefined,
        invoiceNumber: undefined,
        GSTIn: "",
      };
      setCustomer(formattedCustomer);
      dispatch({ type: "SET_CUSTOMER", payload: formattedCustomer });

      let updatedProducts = [...products];
      let updatedAddedProducts = [...addedProducts];

      draft.productEntries.forEach((item: any, index: number) => {
        const draftProduct = {
          id: String(index + 1),
          name: item.PRODNAME || "",
          price: Number(item.RATE) || 0,
          QUANTITY: String(item.QUANTITY) || "0",
          OPENING_Q: "0",
          image: null,
          UOM_SALE: item.UOM || "PCS",
          SGroupDesc: item.SGroupDesc || "",
          GroupDesc: item.GroupDesc || "Finish Goods",
          DESCRIPT: "",
          IGST: item.IGSTPER || 18,
          DISCOUNTAMT: 0,
          MRP_RATE: Number(item.RATE) || 0,
          PRODCODE: item.PRODCODE || "",
          category: "",
          FOOD_TYPE: 0,
        };

        const existingProductIndex = updatedProducts.findIndex(
          (p) => p.PRODCODE === draftProduct.PRODCODE
        );
        if (existingProductIndex !== -1) {
          updatedProducts[existingProductIndex] = {
            ...updatedProducts[existingProductIndex],
            QUANTITY: String(
              Number(updatedProducts[existingProductIndex].QUANTITY || 0) +
                Number(draftProduct.QUANTITY)
            ),
          };
        } else {
          updatedProducts.push(draftProduct);
        }

        const existingAddedProductIndex = updatedAddedProducts.findIndex(
          (p) => p.PRODCODE === draftProduct.PRODCODE
        );
        if (existingAddedProductIndex !== -1) {
          updatedAddedProducts[existingAddedProductIndex] = {
            ...updatedAddedProducts[existingAddedProductIndex],
            QUANTITY: String(
              Number(
                updatedAddedProducts[existingAddedProductIndex].QUANTITY || 0
              ) + Number(draftProduct.QUANTITY)
            ),
          };
        } else {
          updatedAddedProducts.push(draftProduct);
        }
      });

      dispatch({ type: "SET_PRODUCTS", payload: updatedProducts });
      setAddedProducts(updatedAddedProducts);
      sessionStorage.setItem("products", JSON.stringify(updatedProducts));
      sessionStorage.setItem(
        "addedProducts",
        JSON.stringify(updatedAddedProducts)
      );

      setShowDrafts(false);
      setIsSubmitted(true);
      setIsEditing(false);
      toast.success("Draft bill products added successfully!", {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (error) {
      console.error("Error loading draft bill:", error);
      // toast.error("Failed to load draft bill", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    }
  };

  interface OrderDetail {
    id: string;
    PRODNAME?: string;
    SGroupDesc?: string;
    RATE?: string | number;
    PRODIMG?: string | null;
    UOM?: string;
    GroupDesc?: string;
    DESCRIPT?: string;
    IGSTPER?: string | number;
    DISCOUNTAMT?: string | number;
    QUANTITY?: string | number;
    PRODCODE?: string;
    FOOD_TYPE?: string | number;
    OA_NO?: string;
    BILL_NO?: string;
  }

  const handleOrderClick = async (order: any) => {
    try {
      const collectionName =
        page === "Sale Bill" ? collections.ORDERDET : collections.PORDERDET;
      const orderField = page === "Sale Bill" ? "OA_NO" : "BILL_NO";
      const orderNumber = page === "Sale Bill" ? order.OA_NO : order.BILL_NO;

      const dataRef = collection(db, "TenantsDb", tenantId, collectionName);

      const orderDetailsQuery = query(
        dataRef,
        where(orderField, "==", orderNumber)
      );

      const snapshot = await getDocs(orderDetailsQuery);

      const results: OrderDetail[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (!results || results.length === 0) {
        console.warn(`No order details found for ${orderField}:`, orderNumber);
        toast.warn("No products found for this order", {
          position: "top-center",
          autoClose: 2000,
        });
        return;
      }

      setOANo(orderNumber);

      let updatedProducts = [...products];
      let updatedAddedProducts = [...addedProducts];

      results.forEach((item) => {
        const orderProduct = {
          id: String(item.id || Date.now()),
          name: item.PRODNAME || "",
          category: item.SGroupDesc || "",
          price: Number(item.RATE) || 0,
          image: item.PRODIMG || null,
          OPENING_Q: "0",
          UOM_SALE: item.UOM || "PCS",
          SGroupDesc: item.SGroupDesc || "",
          GroupDesc: item.GroupDesc || "Finish Goods",
          DESCRIPT: item.DESCRIPT || "",
          IGST: Number(item.IGSTPER) || 18,
          DISCOUNTAMT: Number(item.DISCOUNTAMT) || 0,
          MRP_RATE: Number(item.RATE) || 0,
          QUANTITY: Number(item.QUANTITY) || 0,
          PRODCODE: String(item.PRODCODE || ""),
          FOOD_TYPE: Number(item.FOOD_TYPE) || 0,
        };

        const existingProductIndex = updatedProducts.findIndex(
          (p) => p.PRODCODE === orderProduct.PRODCODE
        );

        if (existingProductIndex !== -1) {
          updatedProducts[existingProductIndex] = {
            ...updatedProducts[existingProductIndex],
            QUANTITY: String(
              Number(updatedProducts[existingProductIndex].QUANTITY || 0) +
                orderProduct.QUANTITY
            ),
          };
        } else {
          updatedProducts.push(orderProduct);
        }

        const existingAddedProductIndex = updatedAddedProducts.findIndex(
          (p) => p.PRODCODE === orderProduct.PRODCODE
        );

        if (existingAddedProductIndex !== -1) {
          updatedAddedProducts[existingAddedProductIndex] = {
            ...updatedAddedProducts[existingAddedProductIndex],
            QUANTITY: String(
              Number(
                updatedAddedProducts[existingAddedProductIndex].QUANTITY || 0
              ) + orderProduct.QUANTITY
            ),
          };
        } else {
          updatedAddedProducts.push(orderProduct);
        }
      });

      dispatch({ type: "SET_PRODUCTS", payload: updatedProducts });
      setAddedProducts(updatedAddedProducts);

      sessionStorage.setItem("products", JSON.stringify(updatedProducts));
      sessionStorage.setItem(
        "addedProducts",
        JSON.stringify(updatedAddedProducts)
      );

      dispatch({ type: "SET_OA_NO", payload: String(orderNumber) });
      setShowOrder(false);

      toast.success("Order products added successfully!", {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (error) {
      console.error("Error handling order click:", error);
      // toast.error("Failed to load order products", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    }
  };

  const handleIncrement = (item: AddedProduct) => {
    const currentQuantity = Number(item.QUANTITY) || 0;
    const newQuantity = currentQuantity + 1;

    let updatedProducts = products.map((p) =>
      p.id === item.id ? { ...p, QUANTITY: String(newQuantity) } : p
    );

    let updatedAddedProducts: AddedProduct[];

    if (addedProducts.some((p) => p.id === item.id)) {
      updatedAddedProducts = addedProducts.map((p) =>
        p.id === item.id ? { ...p, QUANTITY: String(newQuantity) } : p
      );
    } else {
      updatedAddedProducts = [
        ...addedProducts,
        { ...item, QUANTITY: String(newQuantity) },
      ];
    }

    dispatch({
      type: "UPDATE_PRODUCT",
      payload: { id: String(item.id), QUANTITY: String(newQuantity) },
    });
    dispatch({ type: "SET_PRODUCTS", payload: updatedProducts });
    dispatch({ type: "SET_ADDED_PRODUCTS", payload: updatedAddedProducts });

    sessionStorage.setItem("products", JSON.stringify(updatedProducts));
    sessionStorage.setItem(
      "addedProducts",
      JSON.stringify(updatedAddedProducts)
    );

    setAddedProducts(updatedAddedProducts);
  };

  const handleDecrement = (item: AddedProduct) => {
    const currentQuantity = Number(item.QUANTITY) || 0;
    const newQuantity = currentQuantity > 1 ? currentQuantity - 1 : 0;

    let updatedProducts = [...products];
    let updatedAddedProducts = [...addedProducts];

    if (newQuantity === 0) {
      updatedProducts = updatedProducts.map((p) =>
        p.id === item.id ? { ...p, QUANTITY: "0" } : p
      );
      updatedAddedProducts = updatedAddedProducts.filter(
        (p) => p.id !== item.id
      );

      dispatch({ type: "REMOVE_PRODUCT", payload: String(item.id) });
      dispatch({ type: "SET_PRODUCTS", payload: updatedProducts });
      dispatch({ type: "SET_ADDED_PRODUCTS", payload: updatedAddedProducts });
    } else {
      updatedProducts = updatedProducts.map((p) =>
        p.id === item.id ? { ...p, QUANTITY: String(newQuantity) } : p
      );
      updatedAddedProducts = updatedAddedProducts.map((p) =>
        p.id === item.id ? { ...p, QUANTITY: String(newQuantity) } : p
      );

      dispatch({
        type: "UPDATE_PRODUCT",
        payload: { id: String(item.id), QUANTITY: String(newQuantity) },
      });
      dispatch({ type: "SET_ADDED_PRODUCTS", payload: updatedAddedProducts });
    }

    sessionStorage.setItem("products", JSON.stringify(updatedProducts));
    sessionStorage.setItem(
      "addedProducts",
      JSON.stringify(updatedAddedProducts)
    );
    setAddedProducts(updatedAddedProducts);
  };

  const canProceed =
    customer.NAME.trim() !== "" &&
    customer.CUSTCODE.trim() !== "" &&
    customer.MOBPHONE?.trim() !== "" &&
    addedProducts.length > 0 &&
    !nameError &&
    !codeError;

  const isDisabled = isSubmitted && !isEditing;

  return (
    <div className="bg-white overflow-hidden min-h-screen relative flex flex-col items-center w-full">
      <div className="w-full lg:max-w-3xl mx-auto">
        <form
          className="bg-white p-4 w-full shadow-sm space-y-1"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col md:flex-row gap-2 mt-2">
            <div className="flex items-center gap-2 absolute top-2 right-2 z-40">
              {(page === "Sale Bill" || page === "Purchase Bill") && isSubmitted && (
                <>
                  <div
                    onClick={() => setShowOrder(!showOrder)}
                    className="flex items-center justify-center relative w-8 h-8 bg-green-500 text-white rounded-full cursor-pointer hover:scale-110 duration-150 ease-in-out"
                  >
                    <MdOutlineBookmarkBorder />
                    {orderData.length > 0 && (
                      <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none min-w-[1rem] h-[1rem] flex items-center justify-center font-bold z-50">
                        {orderData.length > 9 ? "9+" : orderData.length}
                      </span>
                    )}
                  </div>
                  <div
                    onClick={() => {
                      setShowPreviousBills(!showPreviousBills);
                      if (!showPreviousBills && previousBills.length === 0) {
                        handleFetchPreviousBills(customer.MOBPHONE);
                      }
                    }}
                    className="flex items-center justify-center relative w-8 h-8 bg-yellow-500 text-white rounded-full cursor-pointer hover:scale-110 duration-150 ease-in-out"
                  >
                    <MdOutlineHistory />
                    {previousBills.length > 0 && (
                      <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none min-w-[1rem] h-[1rem] flex items-center justify-center font-bold z-50">
                        {previousBills.length > 9 ? "9+" : previousBills.length}
                      </span>
                    )}
                  </div>
                  <div
                    onClick={() => setShowDrafts(!showDrafts)}
                    className="flex items-center relative w-8 h-8 bg-blue-500 text-white justify-center rounded-full cursor-pointer hover:scale-110 duration-150 ease-in-out"
                  >
                    <MdOutlineDrafts />
                    {draftData.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none min-w-[1rem] h-[1rem] flex items-center justify-center font-bold z-50">
                        {draftData.length > 9 ? "9+" : draftData.length}
                      </span>
                    )}
                  </div>
                </>
              )}
              <div
                onClick={() => router.push('/view')}
                className="flex items-center justify-center relative w-8 h-8 bg-purple-500 text-white rounded-full cursor-pointer hover:scale-110 duration-150 ease-in-out"
                title="Recent Transactions"
              >
                <MdOutlineReceiptLong />
              </div>
            </div>
            {(page === "Sale Bill" || page === "Purchase Bill") && (
              <AnimatePresence>
                {showOrder && (
                  <motion.div
                    key="order-box"
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    className="bg-white border border-blue-200 rounded-lg shadow-lg absolute top-12 left-0 w-full max-h-[60%] overflow-y-auto z-40"
                  >
                    <div className="border-b border-blue-200 p-3 text-black">
                      <h3 className="text-sm md:text-base font-semibold mb-2 text-blue-700">
                        📦 Orders
                      </h3>
                      {orderData.length > 0 ? (
                        <ul className="space-y-2">
                          {orderData.map((order) => (
                            <li
                              onClick={() => handleOrderClick(order)}
                              key={
                                order.id ||
                                (page === "Sale Bill"
                                  ? order.OA_NO
                                  : order.BILL_NO)
                              }
                              className="border border-blue-100 rounded p-2 hover:bg-blue-50 cursor-pointer duration-150"
                            >
                              <div className="flex justify-between items-center text-xs md:text-sm">
                                <span className="font-medium text-blue-800">
                                  {page === "Sale Bill"
                                    ? order.OA_NO
                                    : order.BILL_NO || "No Order Number"}
                                </span>
                                <span className="text-blue-600">
                                  {(
                                    page === "Sale Bill"
                                      ? order.OA_DATE
                                      : order.BILL_DATE
                                  )
                                    ? format(
                                        page === "Sale Bill"
                                          ? order.OA_DATE.toDate()
                                          : order.BILL_DATE.toDate(),
                                        "dd/MM/yyyy"
                                      )
                                    : "No Date"}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-xs md:text-sm text-center py-3">
                          No orders found
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
                <AnimatePresence>
                  {showPreviousBills && (
                    <motion.div
                      key="previous-bills-box"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      className="bg-white border border-gray-300 absolute top-12 left-0 w-full max-h-[70%] md:max-h-[80%] overflow-y-auto rounded-lg shadow z-30"
                    >
                      <div className="border-b border-gray-200 p-3 text-black">
                        <h3 className="text-sm md:text-base font-semibold mb-2 text-blue-700 flex items-center gap-1">
                          🛒 Parked Bills
                        </h3>

                        {previousBills.length > 0 ? (
                          <div className="space-y-3">
                            {previousBills.map((billWrapper) => {
                              const bill = billWrapper.bill;
                              const details = billWrapper.details;

                              const topItemId = details.reduce(
                                (top, item) => {
                                  const qty = Number(item.QUANTITY) || 0;
                                  return qty > top.qty
                                    ? { id: item.id, qty }
                                    : top;
                                },
                                { id: "", qty: 0 }
                              ).id;

                              const billDate = bill.BILL_DATE?.toDate
                                ? format(bill.BILL_DATE.toDate(), "dd/MM/yyyy")
                                : "No Date";

                              return (
                                <div
                                  key={bill.id}
                                  className="border rounded-md shadow-sm hover:shadow duration-150 bg-gradient-to-tr from-white to-blue-50"
                                >
                                  <div className="bg-blue-100 p-1.5 md:p-2 font-semibold text-[11px] md:text-xs flex justify-between items-center text-blue-900">
                                    <span>📅 {billDate}</span>
                                    <span className="text-blue-800">
                                      🧾 {bill.BILL_NO || "No Bill No"}
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-[10px] md:text-[11px]">
                                      <thead className="bg-blue-200 text-blue-900">
                                        <tr>
                                          <th className="text-left p-1 md:p-1.5">
                                            Product
                                          </th>
                                          <th className="text-center p-1 md:p-1.5">
                                            Qty
                                          </th>
                                          <th className="text-right p-1 md:p-1.5">
                                            Rate
                                          </th>
                                          <th className="text-right p-1 md:p-1.5">
                                            Total
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {details.map((item) => {
                                          const quantity =
                                            Number(item.QUANTITY) || 0;
                                          const price = Number(item.RATE) || 0;
                                          const total = quantity * price;
                                          const isTopProduct =
                                            item.id === topItemId;

                                          return (
                                            <tr
                                              key={item.id}
                                              className={`border-b hover:bg-blue-50 cursor-pointer duration-100 ${
                                                isTopProduct
                                                  ? "bg-yellow-100 font-semibold"
                                                  : ""
                                              }`}
                                              onClick={() =>
                                                console.log(
                                                  "Clicked item:",
                                                  item
                                                )
                                              }
                                            >
                                              <td className="p-1 md:p-1.5 truncate max-w-[8rem] flex items-center gap-1">
                                                {item.PRODNAME || "Unnamed"}
                                                {isTopProduct && (
                                                  <span className="bg-yellow-300 text-yellow-900 rounded-full px-1 text-[8px]">
                                                    Top
                                                  </span>
                                                )}
                                              </td>
                                              <td className="p-1 md:p-1.5 text-center">
                                                {quantity}
                                              </td>
                                              <td className="p-1 md:p-1.5 text-right">
                                                {currency} {price.toFixed(2)}
                                              </td>
                                              <td className="p-1 md:p-1.5 text-right">
                                                {currency} {total.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-xs md:text-sm text-center py-3">
                            No previous purchases found.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {showDrafts && (
                  <motion.div
                    key="draft-box"
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    className="bg-white border border-blue-200 rounded-lg shadow-lg absolute top-12 left-0 w-full max-h-[60%] overflow-y-auto z-40"
                  >
                    <div className="p-3 border-b border-blue-200 text-black">
                      <h3 className="text-sm md:text-base font-semibold mb-2 text-blue-700 flex items-center gap-1">
                        📝 Park Transaction
                      </h3>

                      {draftData.length > 0 ? (
                        <ul className="space-y-2">
                          {draftData.map((bill) => (
                            <li
                              key={bill.id || bill.bill.BILL_NO}
                              onClick={() => handleDraftClick(bill)}
                              className="border border-blue-100 rounded p-2 hover:bg-blue-50 cursor-pointer duration-150"
                            >
                              <div className="flex justify-between items-center text-xs md:text-sm">
                                <span className="font-medium text-blue-800 truncate max-w-[10rem]">
                                  🧾 {bill.bill?.BILL_NO || "No Bill No."}
                                </span>
                                <span className="text-blue-600">
                                  {bill.bill?.BILL_DATE
                                    ? format(
                                        bill.bill.BILL_DATE.toDate(),
                                        "dd/MM/yyyy"
                                      )
                                    : "No Date"}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-xs md:text-sm text-center py-3">
                          No drafts found.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="CUSTCODE"
              >
                {page === "Purchase Order" || page === "Purchase Bill"
                  ? "Vendor Code"
                  : "Customer Code"}
              </label>
              <input
                type="text"
                id="CUSTCODE"
                name="CUSTCODE"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                value={
                  custCodeLoading
                    ? "Loading..."
                    : codeError || customer.CUSTCODE
                }
                disabled={true}
                required
                autoComplete="off"
              />
              {codeError && (
                <p className="text-red-500 text-xs mt-1">{codeError}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="relative flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="MOBPHONE"
              >
                {page === "Purchase Order" || page === "Purchase Bill"
                  ? "Vendor Number"
                  : "Customer Number"}
              </label>
              <input
                type="number"
                id="MOBPHONE"
                name="MOBPHONE"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={customer.MOBPHONE}
                onChange={handleInputChange}
                maxLength={10}
                disabled={isDisabled || suggestionLoading}
                autoComplete="off"
                required
                onFocus={() => {
                  if (
                    customer.MOBPHONE.length >= 1 &&
                    numberSuggestions.length > 0
                  ) {
                    setShowNumberSuggestions(true);
                    setActiveInput("MOBPHONE");
                  }
                }}
                onBlur={() =>
                  setTimeout(() => {
                    if (activeInput === "MOBPHONE") {
                      setShowNumberSuggestions(false);
                      if (!customer.NAME) setActiveInput(null);
                    }
                  }, 150)
                }
              />
              {showNumberSuggestions &&
                numberSuggestions.length > 0 &&
                activeInput === "MOBPHONE" && (
                  <div className="w-full absolute top-full left-0 bg-white z-20 border-b border-gray-200 shadow rounded max-h-48 overflow-y-auto mt-2">
                    <table className="table-auto w-full text-xs">
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
                        {numberSuggestions.map((suggestion) => (
                          <tr
                            key={suggestion.id || suggestion.CUSTCODE}
                            className="hover:bg-blue-50 cursor-pointer"
                            onMouseDown={() =>
                              handleSuggestionClick(suggestion)
                            }
                          >
                            <td className="px-2 py-1">
                              {suggestion.NAME || "Unknown"}
                            </td>
                            <td className="px-2 py-1">
                              {suggestion.MOBPHONE || "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              {suggestionLoading && (
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  <div className="loader w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="NAME"
              >
                {page === "Purchase Order" || page === "Purchase Bill"
                  ? "Vendor Name"
                  : "Customer Name"}
              </label>
              <input
                type="text"
                id="NAME"
                name="NAME"
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  nameError ? "border-red-500" : "border-gray-300"
                }`}
                value={customer.NAME || ""}
                onChange={handleChange}
                disabled={isDisabled || suggestionLoading}
                autoComplete="off"
                required
                onFocus={() => {
                  if (customer.NAME.length >= 1 && nameSuggestions.length > 0) {
                    setShowNameSuggestions(true);
                    setActiveInput("NAME");
                  }
                }}
                onBlur={() =>
                  setTimeout(() => {
                    if (activeInput === "NAME") {
                      setShowNameSuggestions(false);
                      if (!customer.MOBPHONE) setActiveInput(null);
                    }
                  }, 100)
                }
              />
              {nameError && (
                <p className="text-red-500 text-xs mt-1">{nameError}</p>
              )}
              {showNameSuggestions &&
                nameSuggestions.length > 0 &&
                activeInput === "NAME" && (
                  <div className="w-full top-full absolute left-0 bg-white z-20 border-b border-gray-200 shadow-lg rounded max-h-48 overflow-y-auto mt-2">
                    <table className="table-auto w-full text-xs">
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
                        {nameSuggestions.map((suggestion) => (
                          <tr
                            key={suggestion.id || suggestion.CUSTCODE}
                            className="hover:bg-blue-50 cursor-pointer"
                            onMouseDown={() =>
                              handleSuggestionClick(suggestion)
                            }
                          >
                            <td className="px-2 py-2">
                              {suggestion.NAME || "Unknown"}
                            </td>
                            <td className="px-2 py-2">
                              {suggestion.MOBPHONE || "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
          <div className="flex sm:flex-row flex-col gap-3">
            <div className="flex flex-col flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="anniversary"
              >
                Anniversary
                <span className="text-gray-400"> (optional)</span>
              </label>
              <input
                type="date"
                id="anniversary"
                name="anniversary"
                className="p-2 border rounded-lg text-xs border-gray-300 focus:outline-none focus:ring-blue-700 focus:ring-2"
                value={customer.anniversary}
                onChange={handleChange}
                disabled={isDisabled || suggestionLoading}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="birthday"
              >
                DOB
                <span className="text-gray-400"> (optional)</span>
              </label>
              <input
                type="date"
                id="birthday"
                name="birthday"
                className="p-2 border rounded-lg text-xs border-gray-300 focus:outline-none focus:ring-blue-600 focus:ring-2"
                value={customer.birthday}
                onChange={handleChange}
                disabled={isDisabled || suggestionLoading}
                autoComplete="off"
              />
            </div>
          </div>
          {!showMore && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-blue-600 underline text-xs"
                onClick={() => setShowMore(true)}
              >
                Show More
              </button>
            </div>
          )}
          {showMore && (
            <div className="flex flex-col gap-3 ">
              <div className="relative flex flex-1 flex-col">
                <label
                  className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                  htmlFor="ADDRESS"
                >
                  Address
                </label>
                <input
                  type="text"
                  id="ADDRESS"
                  name="ADDRESS"
                  className="p-2 w-full border text-sm rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={customer.ADDRESS || ""}
                  onChange={handleChange}
                  disabled={isDisabled || suggestionLoading}
                  autoComplete="off"
                />
              </div>
              <div className="relative flex flex-1 flex-col">
                <label
                  className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                  htmlFor="CITY"
                >
                  City
                </label>
                <input
                  type="text"
                  id="CITY"
                  name="CITY"
                  className="p-2 w-full border text-sm rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={customer.CITY || ""}
                  onChange={handleChange}
                  disabled={isDisabled || suggestionLoading}
                  autoComplete="off"
                />
              </div>
              <div className="relative flex-1 flex-col">
                <label
                  className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                  htmlFor="COUNTRY"
                >
                  Country
                </label>
                <input
                  type="text"
                  id="COUNTRY"
                  name="COUNTRY"
                  className="p-2 w-full border text-sm rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={customer.COUNTRY || ""}
                  onChange={handleChange}
                  disabled={isDisabled || suggestionLoading}
                  autoComplete="off"
                />
              </div>
              {(page === "Purchase Order" || page === "Purchase Bill") && (
                <div className="relative flex-1 flex-col">
                  <label
                    className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                    htmlFor="GSTIN"
                  >
                    GSTIN
                    <span className="text-gray-400"> (optional)</span>
                  </label>
                  <input
                    type="text"
                    id="GSTIN"
                    name="GSTIn"
                    className="p-2 w-full border text-sm rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={customer.GSTIn || ""}
                    onChange={handleChange}
                    disabled={isDisabled || suggestionLoading}
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="flex justify-end ">
                <button
                  type="button"
                  className="text-blue-600 underline text-xs"
                  onClick={() => setShowMore(false)}
                >
                  Hide
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {(!isSubmitted || isEditing) && (
              <>
                <input
                  type="reset"
                  value="Reset"
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg cursor-pointer hover:bg-gray-300"
                  onClick={handleReset}
                />
                <input
                  type="submit"
                  value={isEditing ? "Save" : "Submit"}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg cursor-pointer hover:bg-blue-700"
                  disabled={
                    suggestionLoading ||
                    nameError !== null ||
                    custCodeLoading ||
                    codeError !== null
                  }
                />
              </>
            )}
            {isSubmitted && !isEditing && (
              <button
                type="button"
                className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg cursor-pointer hover:bg-yellow-600"
                onClick={handleEdit}
                disabled={suggestionLoading}
              >
                Edit
              </button>
            )}
          </div>
        </form>
        <div className="bg-white p-2 w-full shadow-sm space-y-1">
          <div className="rounded overflow-x-auto">
            <div className="max-h-48 overflow-y-auto">
              <table className="min-w-full table-auto border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-1.5 py-1.5 text-left font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="px-1.5 py-1.5 text-center font-semibold text-gray-700 w-14">
                      Qty
                    </th>
                    <th className="px-1.5 py-1.5 text-right font-semibold text-gray-700 w-20">
                      Total
                    </th>
                    <th className="px-1 py-1 text-center font-semibold text-gray-700 w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addedProducts.map((item) => (
                    <tr
                      key={item.id || item.PRODCODE || "unknown"}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-1.5 py-1 font-semibold text-gray-900 truncate max-w-[100px]">
                        {item.name || "Unknown"}
                      </td>
                      <td className="px-1.5 py-1 text-center text-gray-600">
                        {item.QUANTITY || "0"}
                      </td>
                      <td className="px-1.5 py-1 text-right font-semibold text-blue-700">
                        {currency } {(Number(item.QUANTITY) * item.price).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 flex justify-center gap-1">
                        <button
                          className=" bg-green-500 px-2 text-black   bg rounded-md text-base"
                          onClick={() => handleIncrement(item)}
                          title="Decrement"
                        >
                          +
                        </button>
                        <button
                          className=" bg-red-500 px-2 text-black   bg rounded-md text-base"
                          onClick={() => handleDecrement(item)}
                          title="Decrement"
                        >
                          –
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 px-1 py-0.5 rounded"
                          onClick={() => {
                            setAddedProducts((prev) =>
                              prev.filter((p) => p.id !== item.id)
                            );
                            const updatedProducts = products.map((p) =>
                              p.id === item.id ? { ...p, QUANTITY: "0" } : p
                            );
                            dispatch({
                              type: "SET_PRODUCTS",
                              payload: updatedProducts,
                            });
                            sessionStorage.setItem(
                              "products",
                              JSON.stringify(updatedProducts)
                            );
                            sessionStorage.setItem(
                              "addedProducts",
                              JSON.stringify(
                                addedProducts.filter((p) => p.id !== item.id)
                              )
                            );
                          }}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 w-full shadow-sm border-t border-gray-200">
          <div className="flex justify-between items-center gap-3">
            <div className="flex flex-row items-center gap-1">
              <span className="font-semibold text-gray-800 text-xs">
                Total Qty:
              </span>
              <span className="text-gray-600 text-sm">
                {products.reduce(
                  (sum, item) => sum + Math.abs(Number(item.QUANTITY)),
                  0
                )}
              </span>
            </div>
            <div className="flex flex-row items-center gap-1 pr-4">
              <span className="font-semibold text-gray-800 text-xs">
                Total Amount:
              </span>
              <span className="font-semibold text-blue-700 text-sm">
                {currency +" "}  
                {products
                  .reduce(
                    (sum, item) =>
                      sum + Math.abs(Number(item.QUANTITY) * item.price || 0),
                    0
                  )
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 w-full shadow-md border-t border-gray-200">
          <div className="flex sm:flex-row flex-col gap-2">
            {(page === "Sale Bill" || page === "Purchase Bill") && (
              <button
                onClick={handleDraftBill}
                className={`w-full py-2 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
                  draftLoading || !canProceed
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                disabled={draftLoading || !canProceed}
              >
                {draftLoading ? (
                  <div className="loader w-5 h-5 border-2 border-gray-200 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <MdOutlineDrafts />
                    Save as Draft
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleProceed}
              className={`w-full py-2 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
                !canProceed
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
              disabled={!canProceed}
            >
              <BiCaretRight />
              Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCustomer;