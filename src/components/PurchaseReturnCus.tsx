/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useContext, useEffect } from "react";
import { CounterContext } from "@/lib/CounterContext";
import { useRouter } from "next/navigation";
import { Product, Customer } from "@/types/page";
import { db } from "../../firebase";
import { collections } from "../config";
import {
  collection,
  Timestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { BiCaretRight } from "react-icons/bi";
import { MdOutlineHistory } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";

export interface Bill {
  id: string;
  BILL_NO: string;
  CUSTNAME: string;
  MOBPHONE?: string;
  RECEIPT_NO?: string;
  BILL_DATE: any; // or Timestamp
  TOTAL_AMOUNT?: number;
  TOTAL_QUANTITY?: number;
  returned?: boolean;
}

interface BillDetail {
  id: string;
  PRODNAME?: string;
  QUANTITY?: string | number;
  RETURNED_QUANTITY?: number;
  RATE?: string | number;
  PRODCODE?: string;
  UOM?: string;
  IGSTPER?: number;
  SGroupDesc?: string;
  GroupDesc?: string;
  [key: string]: any;
}

interface DetailedBill {
  bill: Bill;
  details: BillDetail[];
}

interface Draft {
  bill: {
    CUSTNAME?: string;
    MOBPHONE?: string;
    ADDRESS?: string;
    CITY?: string;
    COUNTRY?: string;
    CUSTCODE?: string | number;
  };
  productEntries: {
    PRODNAME?: string;
    RATE?: string | number;
    QUANTITY?: string | number;
    PRODCODE?: string;
    UOM?: string;
    IGSTPER?: number;
    SGroupDesc?: string;
    GroupDesc?: string;
  }[];
}

const AddBill: React.FC<{ page: string; id: string | null }> = ({ page, id }) => {
  const { state, dispatch } = useContext(CounterContext);
  const { products, customerData, tenantId } = state;
  const router = useRouter();
  const [billSuggestions, setBillSuggestions] = useState<Bill[]>([]);
  const [billNoLoading, setBillNoLoading] = useState(false);
  const [billNoError, setBillNoError] = useState<string | null>(null);
  const [previousBills, setPreviousBills] = useState<DetailedBill[]>([]);
  const [showPreviousBills, setShowPreviousBills] = useState(false);
  const [billData, setBillData] = useState({
    BILL_NO: "",
    CUSTNAME: "",
    MOBPHONE: "",
    RECEIPT_NO: "",
  });
  const [addedProducts, setAddedProducts] = useState<Product[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showBillSuggestions, setShowBillSuggestions] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [activeInput, setActiveInput] = useState<"BILL_NO" | "CUSTNAME" | null>(null);
  const currency = state.currency || "₹";

  const handleDraftClick = async (draft: Draft) => {
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
      dispatch({ type: "SET_CUSTOMER", payload: formattedCustomer });

      let updatedProducts = [...products];
      let updatedAddedProducts = [...addedProducts];

      draft.productEntries.forEach((item, index) => {
        const draftProduct: Product = {
          id: String(index + 1),
          name: item.PRODNAME || "",
          price: Number(item.RATE) || 0,
          QUANTITY: String(item.QUANTITY || "0"),
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
              Number(updatedAddedProducts[existingAddedProductIndex].QUANTITY || 0) +
                Number(draftProduct.QUANTITY)
            ),
          };
        } else {
          updatedAddedProducts.push(draftProduct);
        }
      });

      dispatch({ type: "SET_PRODUCTS", payload: updatedProducts });
      setAddedProducts(updatedAddedProducts);
      sessionStorage.setItem("products", JSON.stringify(updatedProducts));
      sessionStorage.setItem("addedProducts", JSON.stringify(updatedAddedProducts));

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

  const fetchPreviousBills = async (billNo: string): Promise<DetailedBill[] | undefined> => {
    try {
      if (!billNo) {
        // toast.error("Bill number missing");
        return;
      }

      const billRef = query(
        collection(db, "TenantsDb", tenantId, collections.BILLIN),
        where("BILL_NO", "==", billNo),
        orderBy("BILL_DATE", "desc"),
        limit(5)
      );

      const billSnapshot = await getDocs(billRef);

      const bills: Bill[] = billSnapshot.docs.map((doc) => {
        const data = doc.data();
        if (!data.BILL_NO) {
          throw new Error("BILL_NO is missing in bill document");
        }
        return {
          id: doc.id,
          ...data,
        } as Bill;
      });

      const detailedBills: DetailedBill[] = [];

      for (const bill of bills) {
        const billDetRef = query(
          collection(db, "TenantsDb", tenantId, collections.BLLINDET),
          where("BILL_NO", "==", bill.BILL_NO)
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
      console.error("Error fetching previous bills:", error);
      // toast.error("Failed to fetch previous bills", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    }
  };

  const handleFetchPreviousBills = async (billNo: string) => {
    const data = await fetchPreviousBills(billNo);
    if (data) setPreviousBills(data);
  };

  const generateUniqueReceiptNo = async (): Promise<string> => {
    try {
      const dbnoteRef = collection(db, "TenantsDb", tenantId, collections.DBNOTE);
      const prefix = "REC";
      let maxReceiptNo = 0;

      const querySnapshot = await getDocs(dbnoteRef);
      console.log("Query snapshot:", querySnapshot.docs.length);
      maxReceiptNo = querySnapshot.docs.length;

      const nextReceiptNo = maxReceiptNo + 1;
      const newReceiptNo = `${prefix}${nextReceiptNo.toString().padStart(3, "0")}`;
      return newReceiptNo;
    } catch (error) {
      console.error("Error generating receipt number:", error);
      throw new Error("Failed to generate receipt number");
    }
  };

  const setUniqueReceiptNo = async () => {
    setBillNoLoading(true);
    setBillNoError(null);
    try {
      const newReceiptNo = await generateUniqueReceiptNo();
      setBillData((prev) => ({ ...prev, RECEIPT_NO: newReceiptNo }));
    } catch (error) {
      setBillNoError("Failed to generate receipt number. Please try again.");
      // toast.error("Failed to generate receipt number.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    } finally {
      setBillNoLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      setUniqueReceiptNo();
    } else {
      setBillNoLoading(false);
      setBillNoError("Tenant ID is missing.");
      // toast.error("Tenant ID is missing.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    }
  }, [tenantId]);

  useEffect(() => {
    const savedProducts = sessionStorage.getItem("products");
    const savedAddedProducts = sessionStorage.getItem("addedProducts");
    const savedDraft = sessionStorage.getItem("draftBill");

    if (savedProducts && products.length === 0) {
      try {
        let parsedProducts = JSON.parse(savedProducts);
        if (Array.isArray(parsedProducts)) {
          parsedProducts = parsedProducts.filter((p: Product) => Number(p.QUANTITY) > 0);
          dispatch({ type: "SET_PRODUCTS", payload: parsedProducts });
          setAddedProducts(parsedProducts);
          sessionStorage.setItem("addedProducts", JSON.stringify(parsedProducts));
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
          sessionStorage.setItem("addedProducts", JSON.stringify(parsedAddedProducts));
        }
      } catch (error) {
        console.error("Failed to parse sessionStorage addedProducts:", error);
        sessionStorage.removeItem("addedProducts");
      }
    }

    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as Draft;
        handleDraftClick(draft);
      } catch (error) {
        console.error("Failed to parse sessionStorage draftBill:", error);
        sessionStorage.removeItem("draftBill");
      }
    }
  }, [dispatch, products.length, addedProducts.length]);

  useEffect(() => {
    const filteredProducts = products.filter((p) => Number(p.QUANTITY) > 0);
    setAddedProducts(filteredProducts);
    sessionStorage.setItem("addedProducts", JSON.stringify(filteredProducts));
  }, [products]);

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
    const fetchBillSuggestions = async () => {
      try {
        const billRef = query(
          collection(db, "TenantsDb", tenantId, collections.BILLIN),
          orderBy("BILL_DATE", "desc"),
          limit(20)
        );

        const snapshot = await getDocs(billRef);
        const results = snapshot.docs
          .map((doc) => {
            const data = doc.data() as Omit<Bill, "id">;
            return { id: doc.id, ...data };
          })
          .filter((bill) => bill.returned !== true);

        setBillSuggestions(results.slice(0, 10));
      } catch (error) {
        console.error("Error fetching bill suggestions:", error);
        // toast.error("Failed to load bill suggestions", {
        //   position: "top-center",
        //   autoClose: 2000,
        // });
      }
    };

    if (tenantId) {
      fetchBillSuggestions();
    }
  }, [tenantId]);

  const handleBillSuggestionClick = async (selectedBill: Bill) => {
    setBillNoLoading(true);
    try {
      // Fetch bill details from BLLINDET
      const billDetRef = query(
        collection(db, "TenantsDb", tenantId, collections.BLLINDET),
        where("BILL_NO", "==", selectedBill.BILL_NO)
      );
      const billDetSnapshot = await getDocs(billDetRef);

      const billDetails: BillDetail[] = billDetSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch product stock from PRODUCTS collection
      const productsRef = collection(db, "TenantsDb", tenantId, collections.PRODUCTS);
      const productsSnapshot = await getDocs(productsRef);
      const productStockMap = new Map<string, number>();
      productsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        productStockMap.set(data.PRODCODE?.toLowerCase() || "", Number(data.OPENING_Q) || 0);
      });

      const formattedProducts: Product[] = billDetails
        .map((item, index) => {
          const quantity = Number(item.QUANTITY) || 0;
          const returnedQuantity = Number(item.RETURNED_QUANTITY) || 0;
          const remainingQty = quantity - returnedQuantity;
          if (remainingQty <= 0) return null;

          const stockQty = productStockMap.get(item.PRODCODE?.toLowerCase() || "") || 0;
          const qtyToAdd = Math.min(remainingQty, stockQty);
          if (qtyToAdd <= 0) return null;

          const matchedProduct = state.products.find(
            (p) => p.PRODCODE?.toLowerCase() === item.PRODCODE?.toLowerCase()
          );

          const product: Product = {
            id: String(index + 1),
            name: item.PRODNAME || "Unknown",
            price: Number(item.RATE) || 0,
            QUANTITY: String(qtyToAdd),
            OPENING_Q: String(stockQty),
            image: matchedProduct?.image || null,
            UOM_SALE: item.UOM || "PCS",
            SGroupDesc: item.SGroupDesc || "",
            GroupDesc: item.GroupDesc || "Finish Goods",
            DESCRIPT: "",
            IGST: Number(item.IGSTPER) || 18,
            DISCOUNTAMT: 0,
            MRP_RATE: Number(item.RATE) || 0,
            PRODCODE: item.PRODCODE || "",
            category: "",
            FOOD_TYPE: 0,
          };

          return product;
        })
        .filter((product): product is Product => product !== null);

      if (formattedProducts.length === 0) {
        toast.warn("No products with remaining quantities or sufficient stock available for this bill.", {
          position: "top-center",
          autoClose: 2000,
        });
        setBillNoLoading(false);
        return;
      }

      let updatedProducts = [...state.products];
      let updatedAddedProducts = [...addedProducts];

      formattedProducts.forEach((newProduct) => {
        const existingProductIndex = updatedProducts.findIndex(
          (p) => p.PRODCODE?.toLowerCase() === newProduct.PRODCODE?.toLowerCase()
        );
        if (existingProductIndex !== -1) {
          const currentQty = Number(updatedProducts[existingProductIndex].QUANTITY) || 0;
          const newQty = Number(newProduct.QUANTITY) || 0;
          const stockQty = productStockMap.get(newProduct.PRODCODE?.toLowerCase() || "") || 0;
          const totalQty = Math.min(currentQty + newQty, stockQty);
          updatedProducts[existingProductIndex] = {
            ...updatedProducts[existingProductIndex],
            QUANTITY: String(totalQty),
          };
        } else {
          updatedProducts.push(newProduct);
        }

        const existingAddedProductIndex = updatedAddedProducts.findIndex(
          (p) => p.PRODCODE?.toLowerCase() === newProduct.PRODCODE?.toLowerCase()
        );
        if (existingAddedProductIndex !== -1) {
          const currentQty = Number(updatedAddedProducts[existingAddedProductIndex].QUANTITY) || 0;
          const newQty = Number(newProduct.QUANTITY) || 0;
          const stockQty = productStockMap.get(newProduct.PRODCODE?.toLowerCase() || "") || 0;
          const totalQty = Math.min(currentQty + newQty, stockQty);
          updatedAddedProducts[existingAddedProductIndex] = {
            ...updatedAddedProducts[existingAddedProductIndex],
            QUANTITY: String(totalQty),
          };
        } else {
          updatedAddedProducts.push(newProduct);
        }
      });

      updatedProducts = updatedProducts.filter((p) => Number(p.QUANTITY) > 0);
      updatedAddedProducts = updatedAddedProducts.filter((p) => Number(p.QUANTITY) > 0);

      dispatch({ type: "SET_PRODUCTS", payload: updatedProducts });
      setAddedProducts(updatedAddedProducts);
      sessionStorage.setItem("products", JSON.stringify(updatedProducts));
      sessionStorage.setItem("addedProducts", JSON.stringify(updatedAddedProducts));

      setBillData({
        BILL_NO: selectedBill.BILL_NO || "",
        CUSTNAME: selectedBill.CUSTNAME || "",
        MOBPHONE: selectedBill.MOBPHONE || "",
        RECEIPT_NO: billData.RECEIPT_NO,
      });

      await handleFetchPreviousBills(selectedBill.BILL_NO);

      setShowBillSuggestions(false);
      setActiveInput(null);
      setIsSubmitted(true);
      setIsEditing(false);
      toast.success("Bill products merged successfully!", {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (error) {
      console.error("Error processing bill suggestion:", error);
      // toast.error("Failed to load bill data", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
    } finally {
      setBillNoLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBillData((prev) => ({ ...prev, [name]: value }));

    if (name === "BILL_NO" && value.length >= 1) {
      const filtered = billSuggestions.filter((b) =>
        b.BILL_NO.toLowerCase().includes(value.toLowerCase())
      );
      setShowBillSuggestions(true);
      setActiveInput("BILL_NO");
    } else if (name === "BILL_NO") {
      setShowBillSuggestions(false);
      if (!billData.CUSTNAME) setActiveInput(null);
    }

    if (name === "CUSTNAME" && value.length >= 1) {
      const filtered = billSuggestions.filter((b) =>
        b.CUSTNAME?.toLowerCase().includes(value.toLowerCase())
      );
      setShowBillSuggestions(true);
      setActiveInput("CUSTNAME");
    } else if (name === "CUSTNAME") {
      setShowBillSuggestions(false);
      if (!billData.BILL_NO) setActiveInput(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (billNoError) {
      // toast.error("Cannot submit form due to receipt number error.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    if (!billData.RECEIPT_NO) {
      // toast.error("Invalid receipt number.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    setIsSubmitted(true);
    setIsEditing(false);
    dispatch({ type: "SET_BILL_DATA", payload: billData });
    await setUniqueReceiptNo();
  };

  const handleEdit = () => {
    setIsEditing(true);
    setIsSubmitted(false);
  };

  const handleReset = () => {
    setBillData({
      BILL_NO: "",
      CUSTNAME: "",
      MOBPHONE: "",
      RECEIPT_NO: "",
    });
    setIsEditing(false);
    setIsSubmitted(false);
    dispatch({ type: "SET_BILL_DATA", payload: undefined });
    dispatch({ type: "SET_PRODUCTS", payload: [] });
    setAddedProducts([]);
    sessionStorage.removeItem("products");
    sessionStorage.removeItem("addedProducts");
    sessionStorage.removeItem("draftBill");
    setPreviousBills([]);
    setShowBillSuggestions(false);
    setShowDrafts(false);
    setActiveInput(null);
    setUniqueReceiptNo();
  };

  const handleProceed = () => {
    if (billNoError) {
      // toast.error("Cannot proceed due to receipt number error.", {
      //   position: "top-center",
      //   autoClose: 2000,
      // });
      return;
    }

    sessionStorage.setItem("billData", JSON.stringify(billData));
    sessionStorage.setItem("purchaseBillNo", billData.BILL_NO);

    dispatch({ type: "SET_BILL_DATA", payload: billData });
    router.push("/purchase/return/payment");
  };

  const handleIncrement = (item: Product) => {
    const currentQuantity = Number(item.QUANTITY) || 0;
    const stockQty = Number(item.OPENING_Q) || 0;
    const newQuantity = currentQuantity + 1;

    if (newQuantity > stockQty) {
      toast.warn(`Cannot add more than available stock (${stockQty}) for ${item.name}.`, {
        position: "top-center",
        autoClose: 2000,
      });
      return;
    }

    const updatedProducts = products.map((p) =>
      p.id === item.id ? { ...p, QUANTITY: String(newQuantity) } : p
    );

    const existingAddedProductIndex = addedProducts.findIndex(
      (p) => p.PRODCODE === item.PRODCODE
    );
    if (existingAddedProductIndex !== -1) {
      const updatedAddedProducts = [...addedProducts];
      updatedAddedProducts[existingAddedProductIndex] = {
        ...updatedAddedProducts[existingAddedProductIndex],
        QUANTITY: String(
          Number(updatedAddedProducts[existingAddedProductIndex].QUANTITY || 0) + 1
        ),
      };

      dispatch({
        type: "UPDATE_PRODUCT",
        payload: { id: String(item.id), QUANTITY: String(newQuantity) },
      });
      dispatch({ type: "SET_PRODUCTS", payload: updatedProducts });
      dispatch({ type: "SET_ADDED_PRODUCTS", payload: updatedAddedProducts });

      sessionStorage.setItem("products", JSON.stringify(updatedProducts));
      sessionStorage.setItem("addedProducts", JSON.stringify(updatedAddedProducts));
      setAddedProducts(updatedAddedProducts);
    } else {
      toast.info("Product not added to bill yet", {
        position: "top-center",
        autoClose: 2000,
      });
    }
  };

  const handleDecrement = (item: Product) => {
    const currentQuantity = Number(item.QUANTITY) || 0;
    const newQuantity = currentQuantity > 1 ? currentQuantity - 1 : 0;

    let updatedProducts = [...products];
    let updatedAddedProducts = [...addedProducts];

    if (newQuantity === 0) {
      updatedProducts = updatedProducts.map((p) =>
        p.id === item.id ? { ...p, QUANTITY: "0" } : p
      );
      updatedAddedProducts = updatedAddedProducts.filter((p) => p.id !== item.id);

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
    sessionStorage.setItem("addedProducts", JSON.stringify(updatedAddedProducts));
    setAddedProducts(updatedAddedProducts);
  };

  const canProceed =
    billData.BILL_NO.trim() !== "" &&
    billData.CUSTNAME.trim() !== "" &&
    billData.RECEIPT_NO.trim() !== "" &&
    addedProducts.length > 0 &&
    !billNoError;

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
              <div
                onClick={() => {
                  setShowPreviousBills(!showPreviousBills);
                  if (!showPreviousBills && billData.BILL_NO) {
                    handleFetchPreviousBills(billData.BILL_NO);
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
            </div>
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
                      🛒 Previous Bills
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
                                      const quantity = Number(item.QUANTITY) || 0;
                                      const returnedQty = Number(item.RETURNED_QUANTITY) || 0;
                                      const remainingQty = quantity - returnedQty;
                                      const price = Number(item.RATE) || 0;
                                      const total = remainingQty * price;
                                      const isTopProduct = item.id === topItemId;

                                      return (
                                        <tr
                                          key={item.id}
                                          className={`border-b hover:bg-blue-50 cursor-pointer duration-100 ${
                                            isTopProduct ? "bg-yellow-100 font-semibold" : ""
                                          }`}
                                          onClick={() => console.log("Clicked item:", item)}
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
                                            {remainingQty}
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
                        No previous bills found.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="RECEIPT_NO"
              >
                Receipt No
              </label>
              <input
                type="text"
                id="RECEIPT_NO"
                name="RECEIPT_NO"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                value={billNoLoading ? "Loading..." : billNoError || billData.RECEIPT_NO}
                disabled={true}
                required
                autoComplete="off"
              />
              {billNoError && (
                <p className="text-red-500 text-xs mt-1">{billNoError}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="relative flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="BILL_NO"
              >
                Bill No
              </label>
              <input
                type="text"
                id="BILL_NO"
                name="BILL_NO"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={billData.BILL_NO}
                onChange={handleChange}
                disabled={isDisabled || billNoLoading}
                autoComplete="off"
                required
                onFocus={() => {
                  if (billData.BILL_NO.length >= 1 && billSuggestions.length > 0) {
                    setShowBillSuggestions(true);
                    setActiveInput("BILL_NO");
                  }
                }}
                onBlur={() =>
                  setTimeout(() => {
                    if (activeInput === "BILL_NO") {
                      setShowBillSuggestions(false);
                      if (!billData.CUSTNAME) setActiveInput(null);
                    }
                  }, 150)
                }
              />
              {showBillSuggestions &&
                billSuggestions.length > 0 &&
                activeInput === "BILL_NO" && (
                  <div className="w-full absolute top-full left-0 bg-white z-20 border-b border-gray-200 shadow rounded max-h-48 overflow-y-auto mt-2">
                    <table className="table-auto w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-2 py-1 text-left font-semibold">Bill No</th>
                          <th className="px-2 py-1 text-left font-semibold">Vendor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billSuggestions.map((bill) => (
                          <tr
                            key={bill.id}
                            className="hover:bg-blue-50 cursor-pointer"
                            onMouseDown={() => handleBillSuggestionClick(bill)}
                          >
                            <td className="px-2 py-1">{bill.BILL_NO || "Unknown"}</td>
                            <td className="px-2 py-1">{bill.CUSTNAME || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              {billNoLoading && (
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  <div className="loader w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="CUSTNAME"
              >
                Vendor Name
              </label>
              <input
                type="text"
                id="CUSTNAME"
                name="CUSTNAME"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={billData.CUSTNAME || ""}
                onChange={handleChange}
                disabled={isDisabled || billNoLoading}
                autoComplete="off"
                required
                onFocus={() => {
                  if (billData.CUSTNAME.length >= 1 && billSuggestions.length > 0) {
                    setShowBillSuggestions(true);
                    setActiveInput("CUSTNAME");
                  }
                }}
                onBlur={() =>
                  setTimeout(() => {
                    if (activeInput === "CUSTNAME") {
                      setShowBillSuggestions(false);
                      if (!billData.BILL_NO) setActiveInput(null);
                    }
                  }, 100)
                }
              />
              {showBillSuggestions &&
                billSuggestions.length > 0 &&
                activeInput === "CUSTNAME" && (
                  <div className="w-full top-full absolute left-0 bg-white z-20 border-b border-gray-200 shadow-lg rounded max-h-48 overflow-y-auto mt-2">
                    <table className="table-auto w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-2 py-1 text-left font-semibold">Bill No</th>
                          <th className="px-2 py-1 text-left font-semibold">Vendor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billSuggestions.map((bill) => (
                          <tr
                            key={bill.id}
                            className="hover:bg-blue-50 cursor-pointer"
                            onMouseDown={() => handleBillSuggestionClick(bill)}
                          >
                            <td className="px-2 py-2">{bill.BILL_NO || "Unknown"}</td>
                            <td className="px-2 py-2">{bill.CUSTNAME || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
            <div className="relative flex-1">
              <label
                className="mb-1 ml-1 font-medium text-gray-700 text-xs"
                htmlFor="MOBPHONE"
              >
                Mobile Number
              </label>
              <input
                type="text"
                id="MOBPHONE"
                name="MOBPHONE"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={billData.MOBPHONE || ""}
                onChange={handleChange}
                disabled={isDisabled || billNoLoading}
                autoComplete="off"
              />
            </div>
          </div>
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
                  disabled={billNoLoading || billNoError !== null}
                />
              </>
            )}
            {isSubmitted && !isEditing && (
              <button
                type="button"
                className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg cursor-pointer hover:bg-yellow-600"
                onClick={handleEdit}
                disabled={billNoLoading}
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
                        {currency} {(Number(item.QUANTITY) * item.price).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 flex justify-center gap-1">
                        <button
                          className="bg-green-500 px-2 text-black rounded-md text-base"
                          onClick={() => handleIncrement(item)}
                          title="Increment"
                        >
                          +
                        </button>
                        <button
                          className="bg-red-500 px-2 text-black rounded-md text-base"
                          onClick={() => handleDecrement(item)}
                          title="Decrement"
                        >
                          –
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 px-1 py-0.5 rounded"
                          onClick={() => {
                            setAddedProducts((prev) => prev.filter((p) => p.id !== item.id));
                            const updatedProducts = products.map((p) =>
                              p.id === item.id ? { ...p, QUANTITY: "0" } : p
                            );
                            dispatch({
                              type: "SET_PRODUCTS",
                              payload: updatedProducts,
                            });
                            sessionStorage.setItem("products", JSON.stringify(updatedProducts));
                            sessionStorage.setItem(
                              "addedProducts",
                              JSON.stringify(addedProducts.filter((p) => p.id !== item.id))
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
              <span className="font-semibold text-gray-800 text-xs">Total Qty:</span>
              <span className="text-gray-600 text-sm">
                {products.reduce((sum, item) => sum + Math.abs(Number(item.QUANTITY)), 0)}
              </span>
            </div>
            <div className="flex flex-row items-center gap-1 pr-4">
              <span className="font-semibold text-gray-800 text-xs">Total Amount:</span>
              <span className="font-semibold text-blue-700 text-sm">
                {currency}{" "}
                {products
                  .reduce(
                    (sum, item) => sum + Math.abs(Number(item.QUANTITY) * item.price || 0),
                    0
                  )
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 w-full shadow-md border-t border-gray-200">
          <div className="flex sm:flex-row flex-col gap-2">
            <button
              onClick={handleProceed}
              className={`w-full py-2 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
                canProceed
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
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

export default AddBill;