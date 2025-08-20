/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useState, useEffect, useCallback, Suspense, useContext } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../../firebase';
import { Toaster, toast } from 'react-hot-toast';
import { CounterContext } from '@/lib/CounterContext';

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

function ProductFormInner() {
  const page = "Product Update";
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
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const { state } = useContext(CounterContext);
  const [isFieldsEnabled, setIsFieldsEnabled] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [isEditDisabled, setIsEditDisabled] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams?.get('id');

  const fetchProductCodes = async (): Promise<string[]> => {
    try {
      const productsRef = collection(db, 'TenantsDb', state.tenantId, 'Products');
      const querySnapshot = await getDocs(productsRef);
      const codes: string[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.PRODCODE && doc.id !== docId) {
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
  }, [docId, state.tenantId]);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!id) {
        // toast.error('No product ID provided in URL.');
        return;
      }
      try {
        const productsRef = collection(db, 'TenantsDb', state.tenantId, 'Products');
        const q = query(productsRef, where('PRODCODE', '==', id));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          // toast.error('No product found with the provided ID.');
          return;
        }

        const productDoc = querySnapshot.docs[0];
        const productData = productDoc.data();
        setDocId(productDoc.id);
        setFormData({
          code: productData.PRODCODE?.toUpperCase() || '',
          description: productData.DESCRIPT || '',
          service: productData.SERVICE ? 'Yes' : 'No',
          uomPurchase: productData.UOM_PURCH || '',
          uomSale: productData.UOM_SALE || '',
          uomStock: productData.UOM_STK || '',
          hsnCode: productData.HSNCODE || '',
          groupDescription: productData.GroupDesc || '',
          subgroupDescription: productData.SGroupDesc || '',
          gstRate: String(productData.IGST || ''),
          rate: String(productData.RATE || ''),
          buyRate: String(productData.BUY_RATE || ''),
          mrpRate: String(productData.MRP_RATE || ''),
          discountPerUnit: String(productData.DISCPER || ''),
          openingQuantity: String(productData.OPENING_Q || ''),
          openingValue: String(productData.OPENING_V || ''),
          foodType: String(productData.FOOD_TYPE || '1'),
          available: productData.AVAILABLE ?? true,
          productImage: null,
        });
        setCurrentImageUrl(productData.PRODIMG || null);
        if (productData.createdBy === 'company') {
          setIsEditDisabled(true);
        }
      } catch (error) {
        console.error('Error fetching product data:', error);
        // toast.error('Failed to fetch product data.');
      }
    };

    fetchProductData();
  }, [id, state.tenantId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.code) {
        validateProductCode(formData.code);
      }
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

  const handleToggleFields = () => {
    setIsFieldsEnabled((prev) => !prev);
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!formData.code) {
      // toast.error('Product code is required.');
      return;
    }
    if (codeStatus === 'This Product Code is Already in Use !!' || codeStatus === 'Error validating product code') {
      // toast.error('Cannot submit form due to invalid product code.');
      return;
    }
    if (!docId) {
      // toast.error('No valid document ID found for updating.');
      return;
    }

    try {
      let imageUrl = formData.productImage
        ? await (async () => {
            const storageRef = ref(storage, `products/${formData.code.toUpperCase()}_${formData.productImage!.name}`);
            await uploadBytes(storageRef, formData.productImage!);
            return await getDownloadURL(storageRef);
          })()
        : currentImageUrl;

      const updateData = {
        PRODCODE: formData.code.toUpperCase() || '',
        DESCRIPT: formData.description || '',
        SERVICE: formData.service === 'Yes',
        UOM_PURCH: formData.uomPurchase || '',
        UOM_SALE: formData.uomSale || '',
        UOM_STK: formData.uomStock || '',
        HSNCODE: formData.hsnCode || '',
        GroupDesc: formData.groupDescription || '',
        SGroupDesc: formData.subgroupDescription || '',
        IGST: parseFloat(formData.gstRate) || 0,
        RATE: parseFloat(formData.rate) || 0,
        BUY_RATE: parseFloat(formData.buyRate) || 0,
        MRP_RATE: parseFloat(formData.mrpRate) || 0,
        DISCPER: parseFloat(formData.discountPerUnit) || 0,
        OPENING_Q: parseFloat(formData.openingQuantity) || 0,
        OPENING_V: parseFloat(formData.openingValue) || 0,
        FOOD_TYPE: parseInt(formData.foodType) || 1,
        AVAILABLE: formData.available,
        PRODIMG: imageUrl || '',
      };

      const updatePromise = setDoc(
        doc(db, 'TenantsDb', state.tenantId, 'Products', docId),
        updateData,
        { merge: true }
      );

      await toast.promise(updatePromise, {
        loading: 'Updating product...',
        success: 'Product updated successfully!',
        error: (error) => `Failed to update product: ${error.message}`,
      });

      setIsFieldsEnabled(false);
      router.push('/master/product');
    } catch (error) {
      console.error('Error updating product:', error);
      // toast.error('Failed to update product.');
    }
  };

  const handleCancel = () => {
    router.push('/master/product');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
     
      <main className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-[#2c5aa0] text-xl font-semibold">{page}</h2>
          <div className="flex gap-4">
            {isFieldsEnabled ? (
              <>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                  disabled={isLoadingCode || (codeStatus !== 'Available' && codeStatus !== null)}
                >
                  Update
                </button>
                <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow"
            >
              Cancel
            </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleToggleFields}
                className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                disabled={isEditDisabled}
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <form className="w-full">
          <div className="grid gap-6">
            {/* Row 1: Product Code, Description, Service */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="code" className="text-gray-600 text-sm font-medium mb-1 block">
                  Product Code
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  placeholder="Product Code"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.code}
                  onChange={handleChange}
                  disabled
                  required
                />
                {/* {codeStatus && (
                  <p className={`text-xs mt-1 ${codeStatus === 'Available' ? 'text-green-500' : 'text-red-500'}`}>
                    {codeStatus}
                  </p>
                )} */}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.service}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.uomPurchase}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.uomSale}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.uomStock}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.rate}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.buyRate}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.mrpRate}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.hsnCode}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.gstRate}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.discountPerUnit}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.openingQuantity}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.foodType}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.groupDescription}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  value={formData.subgroupDescription}
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
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
                  className="h-5 w-5 text-[#2c5aa0] focus:ring-[#2c5aa0] border-gray-300 rounded disabled:bg-gray-50"
                  checked={formData.available}
                  onChange={handleCheckboxChange}
                  disabled={!isFieldsEnabled}
                />
              </div>
            </div>
            {/* Row 7: Product Image */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="productImage" className="text-gray-600 text-sm font-medium mb-1 block">
                  Product Image
                </label>
                {currentImageUrl && !isFieldsEnabled && (
                  <div className="mb-4">
                    <img
                      src={currentImageUrl}
                      alt="Current Product"
                      className="max-w-xs h-auto rounded-md shadow-md"
                    />
                  </div>
                )}
                <input
                  type="file"
                  id="productImage"
                  name="productImage"
                  accept="image/*"
                  className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                  onChange={handleChange}
                  disabled={!isFieldsEnabled}
                />
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

const Page = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <ProductFormInner />
  </Suspense>
);

export default Page;