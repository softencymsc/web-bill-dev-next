/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { collection, CollectionReference, DocumentData, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "../../../../../firebase";
import { Toaster, toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Loader from '@/components/Loader';
import { CounterContext } from "@/lib/CounterContext";

// Define the desired category order
const categoryOrder = [
  "GATEAUX",
  "PASTRY",
  "NON-VEG SAVORIES",
  "BREAD",
  "COOKIES & KHARI",
  "SWEETS",
  "CHOCOLATES",
  "DRY CAKE",
  "INDIAN SNAKES",
  "VEG SAVORIES",
];

// Interface for products
interface Product {
  id: string;
  name: string;
  code: string;
  group: string;
  openingQ: string;
  mrpRate: string;
}

interface FormData {
  code: string;
  openingQuantity: string;
  addOpeningQuantity: string;
  totalOpeningQuantity: string;
}

export default function ProductOpeningForm() {
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [formData, setFormData] = useState<FormData>({
    code: '',
    openingQuantity: '',
    addOpeningQuantity: '',
    totalOpeningQuantity: '0',
  });
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { state } = useContext(CounterContext);
  const router = useRouter();

  useEffect(() => {
    const fetchProductGroupsAndProducts = async () => {
      setLoading(true);
      try {
        if (!state.tenantId) {
          toast.error("Tenant ID is missing. Cannot fetch product groups.", {
            position: "top-center",
            duration: 3000,
          });
          setGroups([]);
          setProducts([]);
          setLoading(false);
          return;
        }

        const productRef = collection(db, "TenantsDb", state.tenantId, "Products") as CollectionReference<DocumentData>;
        const q = query(productRef, where("AVAILABLE", "==", true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.warn("No products found in the database.");
          toast.error("No products found in the database.", { position: "top-center", duration: 3000 });
          setGroups([]);
          setProducts([]);
          return;
        }

        // Extract unique groups and products
        const groupSet = new Set<string>();
        const productList: Product[] = [];
        snapshot.docs.forEach((doc) => {
          const d = doc.data();
          if (d.AVAILABLE === true) {
            if (!d.PRODCODE || typeof d.PRODCODE !== 'string' || d.PRODCODE.trim() === '') {
              console.warn(`Product ${d.DESCRIPT || doc.id} has invalid PRODCODE: ${d.PRODCODE}`);
              return;
            }
            if (d.SGroupDesc) {
              groupSet.add(d.SGroupDesc);
            }
            productList.push({
              id: doc.id,
              name: d.DESCRIPT || "Unknown",
              code: d.PRODCODE,
              group: d.SGroupDesc || "Other",
              openingQ: String(d.OPENING_Q || "0"),
              mrpRate: String(d.MRP_RATE || "0"),
            });
          }
        });

        if (productList.length === 0) {
          toast.error("No products with valid PRODCODE found.", { position: "top-center", duration: 3000 });
        }

        // Sort groups
        const uniqueGroups = Array.from(groupSet);
        const sortedGroups = [
          ...categoryOrder.filter((cat) => uniqueGroups.includes(cat)),
          ...uniqueGroups
            .filter((cat) => !categoryOrder.includes(cat) && cat !== "Other")
            .sort(),
          ...(uniqueGroups.includes("Other") ? ["Other"] : []),
        ];

        console.log("Fetched groups:", sortedGroups);
        console.log("Fetched products:", productList.map(p => ({ id: p.id, name: p.name, code: p.code, openingQ: p.openingQ })));

        setGroups(sortedGroups);
        setProducts(productList);
        if (sortedGroups.length > 0) {
          setSelectedGroup(sortedGroups[0]);
        }
      } catch (error: unknown) {
        console.error("Error fetching product groups and products:", error);
        toast.error(
          `Failed to load product groups and products: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          {
            position: "top-center",
            duration: 3000,
          }
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProductGroupsAndProducts();
  }, [state.tenantId]);

  const fetchProductCodes = async (): Promise<string[]> => {
    try {
      const productOpeningsRef = collection(db, 'TenantsDb', state.tenantId, 'ProductOpenings');
      const querySnapshot = await getDocs(productOpeningsRef);
      const codes: string[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.PRODCODE && typeof data.PRODCODE === 'string' && data.PRODCODE.trim() !== '') {
          codes.push(data.PRODCODE.toUpperCase());
        }
      });
      return codes;
    } catch (error) {
      console.error('Error fetching product opening codes:', error);
      throw new Error('Failed to fetch product opening codes');
    }
  };

  const validateProductCode = useCallback(async (code: string) => {
    if (!code || code.trim() === '') {
      setCodeStatus('Product code is required');
      return;
    }
    setIsLoadingCode(true);
    try {
      const existingCodes = await fetchProductCodes();
      const upperCaseCode = code.toUpperCase();
      if (existingCodes.includes(upperCaseCode)) {
        setCodeStatus('This Product Code is Already in Use !!');
      } else {
        setCodeStatus('Available');
      }
    } catch (error) {
      setCodeStatus('Error validating product code');
      toast.error('Error validating product code', { position: "top-center", duration: 3000 });
    } finally {
      setIsLoadingCode(false);
    }
  }, [state.tenantId]);

  useEffect(() => {
    if (formData.code) {
      const timer = setTimeout(() => {
        console.log("Validating product code:", formData.code);
        validateProductCode(formData.code);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCodeStatus(null);
    }
  }, [formData.code, validateProductCode]);

  useEffect(() => {
    const currentQuantity = parseFloat(formData.openingQuantity) || 0;
    const addQuantity = parseFloat(formData.addOpeningQuantity) || 0;
    const totalOpeningQuantity = (currentQuantity + addQuantity).toString();
    console.log("Updating totalOpeningQuantity:", {
      currentQuantity,
      addQuantity,
      totalOpeningQuantity,
    });
    setFormData((prev) => ({ ...prev, totalOpeningQuantity }));
  }, [formData.openingQuantity, formData.addOpeningQuantity]);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroup(e.target.value);
    setSelectedProduct("");
    setFormData({
      code: '',
      openingQuantity: '',
      addOpeningQuantity: '',
      totalOpeningQuantity: '0',
    });
    setCodeStatus(null);
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value;
    setSelectedProduct(selectedCode);
    const productData = products.find((product) => product.code === selectedCode);
    console.log("Selected product:", { code: selectedCode, productData });
    if (productData && productData.code && productData.code !== '') {
      setFormData({
        code: productData.code,
        openingQuantity: productData.openingQ,
        addOpeningQuantity: '',
        totalOpeningQuantity: productData.openingQ,
      });
    } else {
      setFormData({
        code: '',
        openingQuantity: '',
        addOpeningQuantity: '',
        totalOpeningQuantity: '0',
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'addOpeningQuantity' && value !== '' && !/^-?\d*\.?\d*$/.test(value)) {
      toast.error("Add Opening Quantity must be a valid number.", { position: "top-center", duration: 3000 });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (codeStatus === 'This Product Code is Already in Use !!' || codeStatus === 'Product code is required' || codeStatus === 'Error validating product code') {
      toast.error('Cannot submit form due to invalid product code.', { position: "top-center", duration: 3000 });
      return;
    }
    if (!formData.code || formData.code.trim() === '') {
      toast.error('Invalid product code selected.', { position: "top-center", duration: 3000 });
      return;
    }
    if (formData.addOpeningQuantity === '' || isNaN(parseFloat(formData.addOpeningQuantity))) {
      toast.error('Add Opening Quantity is required and must be a valid number.', { position: "top-center", duration: 3000 });
      return;
    }

    setIsSubmitting(true);
    try {
      const productData = products.find((product) => product.code === formData.code);
      if (!productData) {
        toast.error('Selected product not found.', { position: "top-center", duration: 3000 });
        return;
      }
      const productRef = doc(db, 'TenantsDb', state.tenantId, 'Products', productData.id);
      const openingData = {
        OPENING_Q: parseFloat(formData.totalOpeningQuantity) || 0,
      };
      console.log("Updating product data:", { PRODCODE: formData.code, ...openingData });
      await updateDoc(productRef, openingData);
      toast.success('Product opening quantity updated successfully!', { position: "top-center", duration: 3000 });
      setFormData({
        code: '',
        openingQuantity: '',
        addOpeningQuantity: '',
        totalOpeningQuantity: '0',
      });
      setSelectedGroup(groups.length > 0 ? groups[0] : '');
      setSelectedProduct('');
      setCodeStatus(null);
      router.push('/master/productopening');
    } catch (error) {
      console.error('Error updating product opening quantity:', error);
      toast.error('Failed to update product opening quantity.', { position: "top-center", duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      code: '',
      openingQuantity: '',
      addOpeningQuantity: '',
      totalOpeningQuantity: '0',
    });
    setSelectedGroup(groups.length > 0 ? groups[0] : '');
    setSelectedProduct('');
    setCodeStatus(null);
  };

  const handleCancel = () => {
    router.push('/master/productopening');
  };

  // Filter products based on selected group
  const filteredProducts = products.filter((product) => product.group === selectedGroup && product.code && product.code !== '');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Toaster />
      <main className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden p-6 md:p-8">
        <form className="w-full" onSubmit={handleSubmit}>
          <h2 className="text-[#2c5aa0] text-xl font-semibold mb-6">Create Product Opening</h2>
          <div className="grid gap-6">
            {/* Row 1: Group, Product, Code */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="group" className="text-gray-600 text-sm font-medium mb-1 block">
                  Product Group
                </label>
                <select
                  id="group"
                  value={selectedGroup}
                  onChange={handleGroupChange}
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  disabled={loading}
                >
                  {groups.length === 0 ? (
                    <option value="" disabled>
                      No groups available
                    </option>
                  ) : (
                    groups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="product" className="text-gray-600 text-sm font-medium mb-1 block">
                  Product
                </label>
                <select
                  id="product"
                  value={selectedProduct}
                  onChange={handleProductChange}
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  disabled={!selectedGroup || filteredProducts.length === 0 || loading}
                >
                  <option value="" disabled>
                    None
                  </option>
                  {filteredProducts.map((product) => (
                    <option key={product.id} value={product.code}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="code" className="text-gray-600 text-sm font-medium mb-1 block">
                  Product Code
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  placeholder="Select a product"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 bg-gray-50"
                  value={formData.code || ''}
                  readOnly
                />
                {/* {codeStatus && (
                  <p className={`text-xs mt-1 ${codeStatus === 'Available' ? 'text-green-500' : 'text-red-500'}`}>
                    {codeStatus}
                  </p>
                )}
                {isLoadingCode && <p className="text-gray-500 text-xs mt-1">Validating code...</p>} */}
              </div>
            </div>
            {/* Row 2: Current Opening Quantity, Add Opening Quantity, Total Opening Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="openingQuantity" className="text-gray-600 text-sm font-medium mb-1 block">
                  Current Opening Quantity
                </label>
                <input
                  type="text"
                  id="openingQuantity"
                  name="openingQuantity"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 bg-gray-50"
                  value={formData.openingQuantity}
                  readOnly
                />
              </div>
              <div>
                <label htmlFor="addOpeningQuantity" className="text-gray-600 text-sm font-medium mb-1 block">
                  Add Opening Quantity
                </label>
                <input
                  type="number"
                  id="addOpeningQuantity"
                  name="addOpeningQuantity"
                  placeholder="Add Opening Quantity"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.addOpeningQuantity}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="totalOpeningQuantity" className="text-gray-600 text-sm font-medium mb-1 block">
                  Total Opening Quantity
                </label>
                <input
                  type="text"
                  id="totalOpeningQuantity"
                  name="totalOpeningQuantity"
                  placeholder="Total Opening Quantity"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 bg-gray-50"
                  value={formData.totalOpeningQuantity}
                  readOnly
                />
              </div>
            </div>
            {/* Buttons */}
            <div className="flex justify-end gap-4 mt-8">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-red-500 text-white text-sm font-semibold rounded-full shadow-md hover:bg-red-600 hover:shadow-lg transition-shadow"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 bg-gray-300 text-gray-600 text-sm font-semibold rounded-full shadow-md hover:bg-gray-400 hover:shadow-lg transition-shadow disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                disabled={isLoadingCode || codeStatus !== 'Available' || isSubmitting || !formData.code || formData.code.trim() === '' || formData.addOpeningQuantity === '' || isNaN(parseFloat(formData.addOpeningQuantity))}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}