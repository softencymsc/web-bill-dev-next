/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useContext, useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../../../../../firebase";
import { CounterContext } from "@/lib/CounterContext";
import DropdownCustom from "@/components/DropDownCustom";
import { format } from "date-fns";
import { collections } from "../../../../../config";
import { useRouter, useSearchParams } from "next/navigation";
import { Customer, Product } from "@/types/page";
import {encryptUrl} from "@/services/encryption";

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
  CIMAGEURL: string[];
  CUSTOMER_NAME: string;
  CUSTOMER_CODE: string;
  MOBILE_NUMBER: string;
  ANNIVERSARY?: string;
  DOB?: string;
}

const UpdateOrderForm: React.FC = () => {
  const { state } = useContext(CounterContext);
  const tenantId = state.tenantId || "P2324";
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("id") || "";
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
    CIMAGEURL: [],
    CUSTOMER_NAME: state.customerData?.name || "",
    CUSTOMER_CODE: state.customerData?.CUSTCODE || "",
    MOBILE_NUMBER: state.customerData?.MOBPHONE || "",
    ANNIVERSARY: state.customerData?.anniversary || "",
    DOB: state.customerData?.birthday || "",
  });
  const [billNo, setBillNo] = useState<string>("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isCustomerSubmitted, setIsCustomerSubmitted] = useState(
    !!state.customerData
  );

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

  // Fetch order data
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        // toast.error("Order ID is missing");
        setIsLoading(false);
        return;
      }

      try {
        const orderRef = doc(db, "TenantsDb", tenantId, collections.SPLORDER, orderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
          const data = orderSnap.data();
          setBillNo(data.BILL_NO || "");
          setActiveTab(data.CAKETYPE || "Catalog");
          setFormData({
            CAKETYPE: data.CAKETYPE || "Catalog",
            CATEGORY: data.CATEGORY || "",
            CFLAVOR: data.CFLAVOR || "",
            CMESSAGE: data.CMESSAGE || "",
            CREMARKS: data.CREMARKS || "",
            CUSTOMIZETYPE: data.CUSTOMIZETYPE || "",
            DLVDATE: data.DLVDATE
              ? format(data.DLVDATE.toDate(), "yyyy-MM-dd'T'HH:mm")
              : "",
            PCS: data.PCS || "1",
            PRODCODE: data.PRODCODE || "",
            RATE: data.RATE || "",
            AMOUNT: data.AMOUNT || 0,
            SGroupDes: data.SGroupDesc || "",
            WEIGHT: data.WEIGHT || "",
            PHOTOFILES: [],
            CIMAGEURL: data.CIMAGEURL || [],
            CUSTOMER_NAME: data.CUSTNAME || "",
            CUSTOMER_CODE: data.CUSTCODE || "",
            MOBILE_NUMBER: data.MOBPHONE || "",
            ANNIVERSARY: state.customerData?.anniversary || "",
            DOB: state.customerData?.birthday || "",
          });
        } else {
          // toast.error("Order not found");
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        // toast.error("Failed to load order");
      } finally {
        setIsLoading(false);
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
          (doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              PRODCODE: data.PRODCODE || "",
              DESCRIPT: data.DESCRIPT || "",
              SGroupDesc: data.SGroupDesc || "",
              RATE: data.RATE || 0,
              AVAILABLE: data.AVAILABLE || false,
              UOM_SALE: data.UOM_SALE || "",
              GroupDesc: data.GroupDesc || "",
              IGST: data.IGST || 0,
              DISCOUNTAMT: data.DISCOUNTAMT || 0,
              CGST: data.CGST || 0,
              SGST: data.SGST || 0,
              CATEGORY: data.CATEGORY || "",
              BARCODE: data.BARCODE || "",
              IMAGEURL: data.IMAGEURL || "",
              MRP_RATE: data.MRP_RATE || 0,
              QUANTITY: data.QUANTITY || 0,
              OPENING_Q: data.OPENING_Q || 0,
              FOOD_TYPE: data.FOOD_TYPE || "",
              TAX_CODE: data.TAX_CODE || "",
              HSN_CODE: data.HSN_CODE || "",
              name: data.DESCRIPT || "",
              category: data.CATEGORY || "",
              price: data.RATE || 0,
            };
          }
        );
        setAvailableProducts(results);
      } catch (error) {
        console.error("Error fetching products:", error);
        // toast.error("Failed to load products");
      }
    };

    fetchOrder();
    fetchAvailableProducts();
  }, [orderId, tenantId, state.customerData]);

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
      // Removed the image requirement for Photo category
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

  // Handle input changes
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
          ? selectedProduct.price.toString()
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

  // Remove image
  const handleRemoveImage = async (imageUrl: string) => {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
      setFormData((prev) => ({
        ...prev,
        CIMAGEURL: prev.CIMAGEURL.filter((url) => url !== imageUrl),
      }));
      toast.success("Image removed successfully");
    } catch (error) {
      console.error("Error removing image:", error);
      // toast.error("Failed to remove image");
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      // toast.error("Please fill all required fields");
      return;
    }
    if (!orderId) {
      // toast.error("Order ID is missing");
      return;
    }

    setIsSubmitting(true);
    try {
      const imageUrls = [...formData.CIMAGEURL];
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
        BILL_NO: billNo, // Preserve existing BILL_NO
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

      const orderRef = doc(db, "TenantsDb", tenantId, collections.SPLORDER, orderId);
      await updateDoc(orderRef, orderData);

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
        date: orderData.BILL_DATE.toDate().toISOString(),
      };

      toast.success("Order updated successfully!");
      const encodedOrderData = encryptUrl(JSON.stringify(paymentDataForUrl));
      router.push(`/purchase/special/order/payment?data=${encodedOrderData}`);
    } catch (err) {
      console.error("Error updating order:", err);
      // toast.error("Failed to update order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

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
            Update Special Order
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
                        className="w-full p-3 rounded bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
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
                        className="w-full p-3 rounded bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
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
                        className="w-full p-3 rounded bg-gray-100 border border-gray-300 text-gray-700 text-sm font-light cursor-not-allowed outline-none"
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
                        className="w-full p-3 rounded bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
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
                          Upload Photo
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
                            {formData.PHOTOFILES.length} new file(s) selected
                          </p>
                        )}
                        {formData.CIMAGEURL.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-semibold">Existing Images:</p>
                            {formData.CIMAGEURL.map((url, index) => (
                              <div key={index} className="flex items-center justify-between mt-1">
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                  Image {index + 1}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(url)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
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
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-lg"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 uppercase mb-1">
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
                        className="w-full p-3 rounded bg-gray-100 border border-gray-300 text-gray-700 text-sm font-light cursor-not-allowed outline-none"
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
                        className="w-full p-3 rounded bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
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
                        className="w-full p-3 rounded bg-white text-sm font-normal border border-gray-300 outline-blue-700 transition-all"
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
                onClick={() => router.push("/purchase/special/order")}
              >
                Cancel
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
                {isSubmitting ? "Updating..." : "Update Order"}
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
          <div className="p-8 space-y-4">
            <div>
              <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                Customer Code *
              </label>
              <input
                type="text"
                name="CUSTOMER_CODE"
                value={formData.CUSTOMER_CODE}
                disabled
                className="w-full p-3 rounded bg-gray-100 text-gray-700 text-sm font-normal cursor-not-allowed border border-gray-300"
              />
              {errors.CUSTOMER_CODE && (
                <p className="text-red-500 text-xs mt-1">{errors.CUSTOMER_CODE}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold uppercase text-gray-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                name="MOBILE_NUMBER"
                value={formData.MOBILE_NUMBER}
                disabled
                className="w-full p-3 rounded bg-gray-100 text-gray-700 text-sm font-normal cursor-not-allowed border border-gray-300"
              />
              {errors.MOBILE_NUMBER && (
                <p className="text-red-500 text-xs mt-1">{errors.MOBILE_NUMBER}</p>
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
                disabled
                className="w-full p-3 rounded bg-gray-100 text-gray-700 text-sm font-normal cursor-not-allowed border border-gray-300"
              />
              {errors.CUSTOMER_NAME && (
                <p className="text-red-500 text-xs mt-1">{errors.CUSTOMER_NAME}</p>
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
                disabled
                className="w-full p-3 rounded bg-gray-100 text-gray-700 text-sm font-normal cursor-not-allowed border border-gray-300"
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
                disabled
                className="w-full p-3 rounded bg-gray-100 text-gray-700 text-sm font-normal cursor-not-allowed border border-gray-300"
              />
            </div>
          </div>
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


const ViewPageOut = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UpdateOrderForm />
    </Suspense>
  );
};

export default ViewPageOut;
