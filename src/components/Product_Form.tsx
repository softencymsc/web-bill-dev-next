/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useCallback , useContext } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation'; // Import useRouter from next/navigation
import { CounterContext } from '@/lib/CounterContext';

interface ProductFormProps {
  page: string;
  onSubmit?: (formData: FormData) => void;
}

interface FormData {
  code: string;
  description: string;
  service: string;
  uomPurchase: string;
  uomSale: string;
  uomStock: string;
  hsnCode: string;
  groupDescription: string;
  subgroupDescription: string;
  gstRate: string;
  rate: string;
  buyRate: string;
  mrpRate: string;
  discountPerUnit: string;
  openingQuantity: string;
  openingValue: string;
  foodType: string;
  available: boolean;
  productImage: File | null;
}

const ProductForm: React.FC<ProductFormProps> = ({ page, onSubmit }) => {
  const { state, dispatch } = useContext(CounterContext);
  const {tenantId} = state; // Access tenantId from context
  const [formData, setFormData] = useState<FormData>({
    code: '',
    description: '',
    service: 'No',
    uomPurchase: '',
    uomSale: '',
    uomStock: '',
    hsnCode: '',
    groupDescription: '',
    subgroupDescription: '',
    gstRate: '',
    rate: '',
    buyRate: '',
    mrpRate: '',
    discountPerUnit: '',
    openingQuantity: '',
    openingValue: '',
    foodType: '1',
    available: true,
    productImage: null,
  });
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter(); // Initialize useRouter hook

  const fetchProductCodes = async (): Promise<string[]> => {
    try {
      const productsRef = collection(db, 'TenantsDb', tenantId, 'Products');
      const querySnapshot = await getDocs(productsRef);
      const codes: string[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.PRODCODE) {
          codes.push(String(data.PRODCODE).toUpperCase());
        }
      });
      return codes;
    } catch (error) {
      console.error('Error fetching product codes:', error);
      throw new Error('Failed to fetch product codes');
    }
  };

  const validateProductCode = useCallback(async (code: string) => {
    if (!code) {
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
      // toast.error('Error validating product code');
    } finally {
      setIsLoadingCode(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      validateProductCode(formData.code);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.code, validateProductCode]);

  useEffect(() => {
    const quantity = parseFloat(formData.openingQuantity) || 0;
    const mrpRate = parseFloat(formData.mrpRate) || 0;
    const openingValue = (quantity * mrpRate).toFixed(2);
    setFormData((prev) => ({ ...prev, openingValue }));
  }, [formData.openingQuantity, formData.mrpRate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'productImage') {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      setFormData((prev) => ({ ...prev, productImage: file }));
    } else if (name === 'code') {
      setFormData((prev) => ({
        ...prev,
        [name]: value.toUpperCase(),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      available: e.target.checked,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (codeStatus === 'This Product Code is Already in Use !!' || codeStatus === 'Product code is required' || codeStatus === 'Error validating product code') {
      // toast.error('Cannot submit form due to invalid product code.');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = '';
      if (formData.productImage) {
        const storageRef = ref(storage, `products/${formData.code.toUpperCase()}_${formData.productImage.name}`);
        await uploadBytes(storageRef, formData.productImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      const productsRef = collection(db, 'TenantsDb', tenantId, 'Products');
      const productData = {
        AVAILABLE: formData.available,
        BUY_RATE: parseFloat(formData.buyRate) || 0,
        DESCRIPT: formData.description || '',
        DISCPER: parseFloat(formData.discountPerUnit) || 0,
        GroupDesc: formData.groupDescription || '',
        HSNCODE: formData.hsnCode || '',
        IGST: parseFloat(formData.gstRate) || 0,
        MRP_RATE: parseFloat(formData.mrpRate) || 0,
        OPENING_Q: parseFloat(formData.openingQuantity) || 0,
        OPENING_V: parseFloat(formData.openingValue) || 0,
        PRODCODE: formData.code.toUpperCase() || '',
        PRODIMG: imageUrl,
        RATE: parseFloat(formData.rate) || 0,
        RECOMMENDED: false,
        SERVICE: formData.service || 'No',
        SGroupDesc: formData.subgroupDescription || '',
        UOM_PURCH: formData.uomPurchase || '',
        UOM_SALE: formData.uomSale || '',
        UOM_STK: formData.uomStock || '',
        FOOD_TYPE: parseInt(formData.foodType) || 1,
        createdBy: '',
        refId: '',
      };
      await addDoc(productsRef, productData);
      toast.success('Product data saved successfully!');
      if (onSubmit) {
        onSubmit(formData);
      }
      setFormData({
        code: '',
        description: '',
        service: 'No',
        uomPurchase: '',
        uomSale: '',
        uomStock: '',
        hsnCode: '',
        groupDescription: '',
        subgroupDescription: '',
        gstRate: '',
        rate: '',
        buyRate: '',
        mrpRate: '',
        discountPerUnit: '',
        openingQuantity: '',
        openingValue: '',
        foodType: '1',
        available: true,
        productImage: null,
      });
      setCodeStatus(null);
    } catch (error) {
      console.error('Error saving product data:', error);
      // toast.error('Failed to save product data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      code: '',
      description: '',
      service: 'No',
      uomPurchase: '',
      uomSale: '',
      uomStock: '',
      hsnCode: '',
      groupDescription: '',
      subgroupDescription: '',
      gstRate: '',
      rate: '',
      buyRate: '',
      mrpRate: '',
      discountPerUnit: '',
      openingQuantity: '',
      openingValue: '',
      foodType: '1',
      available: true,
      productImage: null,
    });
    setCodeStatus(null);
  };

  const handleCancel = () => {
    router.push('/master/product');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
     
      <main className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden p-6 md:p-8">
        <form className="w-full" onSubmit={handleSubmit}>
          <h2 className="text-[#2c5aa0] text-xl font-semibold mb-6">{page}</h2>
          <div className="grid gap-6">
            {/* Row 1: Product Code, Description, Service */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="code" className="text-gray-600 text-sm font-medium mb-1 block">
                  {page} Code
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  placeholder={`${page} Code`}
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.code}
                  onChange={handleChange}
                  required
                />
                {codeStatus && (
                  <p className={`text-xs mt-1 ${codeStatus === 'Available' ? 'text-green-500' : 'text-red-500'}`}>
                    {codeStatus}
                  </p>
                )}
                {isLoadingCode && <p className="text-gray-500 text-xs mt-1">Validating code...</p>}
              </div>
              <div>
                <label htmlFor="description" className="text-gray-600 text-sm font-medium mb-1 block">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  name="description"
                  placeholder="Description"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.description}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="service" className="text-gray-600 text-sm font-medium mb-1 block">
                  Service
                </label>
                <select
                  id="service"
                  name="service"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.service}
                  onChange={handleChange}
                  required
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
            {/* Row 2: UOM Purchase, UOM Sale, UOM Stock */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="uomPurchase" className="text-gray-600 text-sm font-medium mb-1 block">
                  UOM Purchase
                </label>
                <input
                  type="text"
                  id="uomPurchase"
                  name="uomPurchase"
                  placeholder="UOM Purchase"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.uomPurchase}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="uomSale" className="text-gray-600 text-sm font-medium mb-1 block">
                  UOM Sale
                </label>
                <input
                  type="text"
                  id="uomSale"
                  name="uomSale"
                  placeholder="UOM Sale"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.uomSale}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="uomStock" className="text-gray-600 text-sm font-medium mb-1 block">
                  UOM Stock
                </label>
                <input
                  type="text"
                  id="uomStock"
                  name="uomStock"
                  placeholder="UOM Stock"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.uomStock}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Row 3: Rate, Buy Rate, MRP Rate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="rate" className="text-gray-600 text-sm font-medium mb-1 block">
                  Rate
                </label>
                <input
                  type="number"
                  id="rate"
                  name="rate"
                  placeholder="Rate"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.rate}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="buyRate" className="text-gray-600 text-sm font-medium mb-1 block">
                  Buy Rate
                </label>
                <input
                  type="number"
                  id="buyRate"
                  name="buyRate"
                  placeholder="Buy Rate"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.buyRate}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="mrpRate" className="text-gray-600 text-sm font-medium mb-1 block">
                  MRP Rate
                </label>
                <input
                  type="number"
                  id="mrpRate"
                  name="mrpRate"
                  placeholder="MRP Rate"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.mrpRate}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Row 4: HSN Code, GST Rate, Discount Per Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="hsnCode" className="text-gray-600 text-sm font-medium mb-1 block">
                  HSN Code
                </label>
                <input
                  type="text"
                  id="hsnCode"
                  name="hsnCode"
                  placeholder="HSN Code"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.hsnCode}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="gstRate" className="text-gray-600 text-sm font-medium mb-1 block">
                  GST Rate (%)
                </label>
                <input
                  type="number"
                  id="gstRate"
                  name="gstRate"
                  placeholder="GST Rate (%)"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.gstRate}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="discountPerUnit" className="text-gray-600 text-sm font-medium mb-1 block">
                  Discount Per Unit (%)
                </label>
                <input
                  type="number"
                  id="discountPerUnit"
                  name="discountPerUnit"
                  placeholder="Discount Per Unit (%)"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.discountPerUnit}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Row 5: Opening Quantity, Opening Value, Food Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="openingQuantity" className="text-gray-600 text-sm font-medium mb-1 block">
                  Opening Quantity
                </label>
                <input
                  type="number"
                  id="openingQuantity"
                  name="openingQuantity"
                  placeholder="Opening Quantity"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.openingQuantity}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="openingValue" className="text-gray-600 text-sm font-medium mb-1 block">
                  Opening Value
                </label>
                <input
                  type="number"
                  id="openingValue"
                  name="openingValue"
                  placeholder="Opening Value"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.openingValue}
                  disabled
                />
              </div>
              <div>
                <label htmlFor="foodType" className="text-gray-600 text-sm font-medium mb-1 block">
                  Food Type
                </label>
                <select
                  id="foodType"
                  name="foodType"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.foodType}
                  onChange={handleChange}
                >
                  <option value="1">VEG</option>
                  <option value="2">NON-VEG</option>
                  <option value="3">PASTRY</option>
                  <option value="4">OTHER</option>
                </select>
              </div>
            </div>
            {/* Row 6: Group Description, Subgroup Description, Available */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="groupDescription" className="text-gray-600 text-sm font-medium mb-1 block">
                  Group Description
                </label>
                <input
                  type="text"
                  id="groupDescription"
                  name="groupDescription"
                  placeholder="Group Description"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.groupDescription}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="subgroupDescription" className="text-gray-600 text-sm font-medium mb-1 block">
                  Subgroup Description
                </label>
                <input
                  type="text"
                  id="subgroupDescription"
                  name="subgroupDescription"
                  placeholder="Subgroup Description"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  value={formData.subgroupDescription}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="available" className="text-gray-600 text-sm font-medium mb-1 block">
                  Available
                </label>
                <input
                  type="checkbox"
                  id="available"
                  name="available"
                  className="h-5 w-5 text-[#2c5aa0] focus:ring-[#2c5aa0] border-gray-300 rounded"
                  checked={formData.available}
                  onChange={handleCheckboxChange}
                />
              </div>
            </div>
            {/* Row 7: Product Image */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="productImage" className="text-gray-600 text-sm font-medium mb-1 block">
                  Product Image
                </label>
                <input
                  type="file"
                  id="productImage"
                  name="productImage"
                  accept="image/*"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                  onChange={handleChange}
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
                disabled={isLoadingCode || codeStatus !== 'Available' || isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default ProductForm;

