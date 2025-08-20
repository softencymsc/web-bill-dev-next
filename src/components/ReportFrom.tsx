/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useContext, useRef } from 'react';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { CounterContext } from '@/lib/CounterContext';
import { Customer, Product } from '@/types/page';

interface ReportFormProps {
  page: string;
  setApply: (params: {
    reportType: 'Payee' | 'Customer' | 'Vendor' | 'Product' | 'Group';
    payee: string;
    product: string;
    group: string;
    startDate: string;
    endDate: string;
    paymentMode: string;
    payees: Customer[];
    products: Product[];
    showMobile: boolean;
    showAddress: boolean;
  }) => void;
}

const ReportForm: React.FC<ReportFormProps> = ({ page, setApply }) => {
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(today.getMonth() - 1);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  };

  const isValidDate = (dateString: string) => {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
  };

  const [startDate, setStartDate] = useState(formatDate(oneMonthAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [payees, setPayees] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [payeeError, setPayeeError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const { state } = useContext(CounterContext);

  const isPurchaseModel = page === 'Purchase Order' || page === 'Purchase Bill';
  const isVoucherModel = page === 'Voucher';

  // Fetch all data and populate inputs on mount
  useEffect(() => {
    if (!state?.tenantId) {
      setPayeeError('No tenant ID provided');
      if (!isVoucherModel) {
        setProductError('No tenant ID provided');
        setGroupError('No tenant ID provided');
      }
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch entities
        const customerRef = collection(db, `TenantsDb/${state.tenantId}/Customers`);
        let customerQuery;
        if (isVoucherModel) {
          customerQuery = query(customerRef);
        } else if (isPurchaseModel) {
          customerQuery = query(customerRef, where('CUST_VEND', '==', 'V'));
        } else {
          customerQuery = query(customerRef, where('CUST_VEND', '==', 'C'));
        }

        const customerSnap = await getDocs(customerQuery);
        const customerData = customerSnap.docs
          .map((doc) => ({
            id: doc.id,
            NAME: doc.data().NAME || 'Unknown',
            CUSTNAME: doc.data().NAME || 'Unknown',
            MOBPHONE: doc.data().MOBPHONE || '',
            CUSTCODE: doc.data().CUSTCODE || '',
            ADDRESS: doc.data().ADDRESS || '',
            ...doc.data(),
          } as Customer))
          .filter((customer) => typeof customer.NAME === 'string' && customer.NAME.trim() !== '')
          .sort((a, b) => (a.NAME || '').localeCompare(b.NAME || ''));

        setPayees(customerData);
        setPayeeError(null);
        console.log('Fetched payees:', customerData);

        // Fetch products if not voucher model
        let productData: Product[] = [];
        let uniqueGroups: string[] = [];
        if (!isVoucherModel) {
          const productRef = collection(db, `TenantsDb/${state.tenantId}/Products`);
          const productQuery = query(productRef, where('AVAILABLE', '==', true));
          const productSnap = await getDocs(productQuery);
          productData = productSnap.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.DESCRIPT || data.PRODNAME || 'Unknown Product',
                PRODNAME: data.DESCRIPT || data.PRODNAME || 'Unknown Product',
                DESCRIPT: data.DESCRIPT || data.PRODNAME || 'Unknown Product',
                available: data.AVAILABLE ?? true,
                UOM_SALE: data.UOM_SALE || '',
                SGroupDesc: data.SGroupDesc || '',
                GroupDesc: data.GroupDesc || '',
                IGST: data.IGST || 0,
                DISCOUNTAMT: data.DISCOUNTAMT || 0,
                MRP_RATE: data.MRP_RATE || 0,
                QUANTITY: data.QUANTITY || 0,
                PRODCODE: data.PRODCODE || '',
                OPENING_Q: data.OPENING_Q || '',
                FOOD_TYPE: data.FOOD_TYPE || 0,
                category: data.category || '',
                price: data.price || 0,
                image: data.image || null,
              } as Product;
            })
            .filter((product) => typeof product.name === 'string' && product.name.trim() !== '')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

          uniqueGroups = Array.from(new Set(productData.map((p) => p.SGroupDesc).filter((g) => g))).sort();
          setGroups(uniqueGroups);
          setProducts(productData);
          setFilteredProducts(productData);
          setProductError(null);
          setGroupError(null);
          console.log('Fetched products:', productData, 'Groups:', uniqueGroups);
        }

        // Fetch saved inputs
        const inputsCollection = collection(db, `TenantsDb/${state.tenantId}/USERINPUTS`);
        const inputSnap = await getDocs(inputsCollection);
        const inputs: { [key: string]: any } = {};

        inputSnap.forEach((doc) => {
          inputs[doc.id] = doc.data().value;
        });
        console.log('Loaded saved inputs:', inputs);

        // Apply saved inputs to state
        if (inputs.startDate && isValidDate(inputs.startDate)) {
          setStartDate(inputs.startDate);
        }
        if (inputs.endDate && isValidDate(inputs.endDate)) {
          setEndDate(inputs.endDate);
        }

        if (Array.isArray(inputs.selectedCustomers)) {
          const validCustomers = inputs.selectedCustomers.filter((name: string) =>
            customerData.some((p) => p.NAME === name)
          );
          setSelectedCustomers(validCustomers);
          console.log('Applied selectedCustomers:', validCustomers);
        }

        if (Array.isArray(inputs.selectedProducts)) {
          const validProducts = inputs.selectedProducts.filter((name: string) =>
            productData.some((p) => p.name === name)
          );
          setSelectedProducts(validProducts);
          console.log('Applied selectedProducts:', validProducts);
        }

        if (Array.isArray(inputs.selectedGroups)) {
          const validGroups = inputs.selectedGroups.filter((group: string) => uniqueGroups.includes(group));
          setSelectedGroups(validGroups);
          console.log('Applied selectedGroups:', validGroups);
        }

        setShowMobile(inputs.showMobile === true);
        setShowAddress(inputs.showAddress === true);
        console.log('Applied showMobile:', inputs.showMobile === true, 'showAddress:', inputs.showAddress === true);

        // Update filtered products based on saved groups
        if (inputs.selectedGroups && inputs.selectedGroups.length > 0 && inputs.selectedGroups.length < uniqueGroups.length) {
          const filtered = productData.filter((product) => inputs.selectedGroups.includes(product.SGroupDesc));
          setFilteredProducts(filtered);
          console.log('Filtered products based on saved groups:', filtered);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setPayeeError('Failed to load payees. Please try again.');
        if (!isVoucherModel) {
          setProductError('Failed to load products. Please try again.');
          setGroupError('Failed to load groups. Please try again.');
        }
      }
    };

    fetchData();
  }, []); // Empty dependency array to run once on mount

  // Update filtered products when selectedGroups changes
  useEffect(() => {
    if (selectedGroups.length === 0 || selectedGroups.length === groups.length) {
      setFilteredProducts(products);
      setSelectedProducts((prev) => prev.filter((name) => products.some((p) => p.name === name)));
    } else {
      const filtered = products.filter((product) => selectedGroups.includes(product.SGroupDesc));
      setFilteredProducts(filtered);
      setSelectedProducts((prev) => prev.filter((name) => filtered.some((p) => p.name === name)));
    }
    console.log('Filtered products:', filteredProducts, 'Selected products:', selectedProducts);
  }, [selectedGroups, products]);

  // Save user inputs to USERINPUTS collection
  const saveUserInputs = async (tenantId: string) => {
    try {
      const inputsCollection = collection(db, `TenantsDb/${tenantId}/USERINPUTS`);
      const inputDocs = [
        { id: 'startDate', value: startDate },
        { id: 'endDate', value: endDate },
        { id: 'selectedCustomers', value: selectedCustomers },
        { id: 'selectedProducts', value: selectedProducts },
        { id: 'selectedGroups', value: selectedGroups },
        { id: 'showMobile', value: showMobile },
        { id: 'showAddress', value: showAddress },
      ];

      for (const input of inputDocs) {
        await setDoc(doc(inputsCollection, input.id), {
          value: input.value,
          timestamp: new Date().toISOString(),
        }, { merge: true });
      }

      console.log('User inputs saved successfully:', inputDocs);
    } catch (error) {
      console.error('Error saving user inputs:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(event.target as Node)) {
        setIsCustomerOpen(false);
      }
      if (productRef.current && !productRef.current.contains(event.target as Node)) {
        setIsProductOpen(false);
      }
      if (groupRef.current && !groupRef.current.contains(event.target as Node)) {
        setIsGroupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAllCustomers = () => {
    if (selectedCustomers.length === payees.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(payees.map((customer) => customer.NAME));
    }
  };

  const handleSelectAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((product) => product.name));
    }
  };

  const handleSelectAllGroups = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(groups);
    }
  };

  const handleCustomerChange = (name: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleProductChange = (name: string) => {
    setSelectedProducts((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    );
  };

  const handleGroupChange = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setter(checked);
    if (state?.tenantId) {
      setDoc(doc(db, `TenantsDb/${state.tenantId}/USERINPUTS`, setter === setShowMobile ? 'showMobile' : 'showAddress'), {
        value: checked,
        timestamp: new Date().toISOString(),
      }, { merge: true }).catch((error) => console.error('Error saving checkbox state:', error));
    }
  };

  const handleGenerate = (reportType: 'Customer' | 'Vendor' | 'Product') => {
    if (!startDate || !endDate || !isValidDate(startDate) || !isValidDate(endDate)) {
      return;
    }

    if (state?.tenantId) {
      saveUserInputs(state.tenantId);
    }

    const formData = {
      reportType,
      payee: selectedCustomers.length === payees.length || selectedCustomers.length === 0 ? 'All' : selectedCustomers.join(','),
      product: selectedProducts.length === filteredProducts.length || selectedProducts.length === 0 ? 'All' : selectedProducts.join(','),
      group: selectedGroups.length === groups.length || selectedGroups.length === 0 ? 'All' : selectedGroups.join(','),
      startDate,
      endDate,
      paymentMode: 'All',
      payees,
      products: filteredProducts,
      showMobile,
      showAddress,
    };

    setApply(formData);
  };

  const getCustomerDisplayText = () => {
    if (selectedCustomers.length === 0) return `Select ${isPurchaseModel ? 'Vendors' : 'Customers'}`;
    if (selectedCustomers.length === payees.length) return 'All Selected';
    return `${selectedCustomers.length} Selected`;
  };

  const getProductDisplayText = () => {
    if (selectedProducts.length === 0) return 'Select Products';
    if (selectedProducts.length === filteredProducts.length) return 'All Products Selected';
    return `${selectedProducts.length} Products Selected`;
  };

  const getGroupDisplayText = () => {
    if (selectedGroups.length === 0) return 'Select Groups';
    if (selectedGroups.length === groups.length) return 'All Groups Selected';
    return `${selectedGroups.length} Groups Selected`;
  };

  return (
    <div className="p-8 bg-gray-50 min-h-fit">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-xl p-8">
        <h2 className="text-3xl font-semibold text-gray-900 mb-8">{page} Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 bg-gray-50"
            />
          </div>
          <div ref={customerRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">{isPurchaseModel ? 'Vendors' : 'Customers'}</label>
            <div
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
              onClick={() => setIsCustomerOpen(!isCustomerOpen)}
            >
              {getCustomerDisplayText()}
            </div>
            {isCustomerOpen && (
              <div className="absolute z-20 mt-2 w-full max-w-md border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-white shadow-2xl transition-all duration-200">
                <div className="mb-3">
                  <button
                    onClick={handleSelectAllCustomers}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors duration-200"
                  >
                    {selectedCustomers.length === payees.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                {payeeError ? (
                  <p className="text-sm text-red-600">{payeeError}</p>
                ) : payees.length === 0 ? (
                  <p className="text-sm text-gray-500">No {isPurchaseModel ? 'vendors' : 'customers'} available</p>
                ) : (
                  payees.map((customer) => (
                    <label key={customer.id} className="flex items-center space-x-3 text-sm text-gray-700 py-2 hover:bg-gray-50 px-3 rounded-md transition-colors duration-200">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(customer.NAME)}
                        onChange={() => handleCustomerChange(customer.NAME)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span>{customer.NAME} ({customer.MOBPHONE || 'N/A'})</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
          {!isVoucherModel && (
            <>
              <div ref={productRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Products</label>
                <div
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
                  onClick={() => setIsProductOpen(!isProductOpen)}
                >
                  {getProductDisplayText()}
                </div>
                {isProductOpen && (
                  <div className="absolute z-20 mt-2 w-full max-w-md border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-white shadow-2xl transition-all duration-200">
                    <div className="mb-3">
                      <button
                        onClick={handleSelectAllProducts}
                        className="w-full text-left px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors duration-200"
                      >
                        {selectedProducts.length === filteredProducts.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    {productError ? (
                      <p className="text-sm text-red-600">{productError}</p>
                    ) : filteredProducts.length === 0 ? (
                      <p className="text-sm text-gray-500">No products available</p>
                    ) : (
                      filteredProducts.map((product) => (
                        <label key={product.id} className="flex items-center space-x-3 text-sm text-gray-700 py-2 hover:bg-gray-50 px-3 rounded-md transition-colors duration-200">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.name)}
                            onChange={() => handleProductChange(product.name)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span>{product.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div ref={groupRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Groups</label>
                <div
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
                  onClick={() => setIsGroupOpen(!isGroupOpen)}
                >
                  {getGroupDisplayText()}
                </div>
                {isGroupOpen && (
                  <div className="absolute z-20 mt-2 w-full max-w-md border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-white shadow-2xl transition-all duration-200">
                    <div className="mb-3">
                      <button
                        onClick={handleSelectAllGroups}
                        className="w-full text-left px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors duration-200"
                      >
                        {selectedGroups.length === groups.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    {groupError ? (
                      <p className="text-sm text-red-600">{groupError}</p>
                    ) : groups.length === 0 ? (
                      <p className="text-sm text-gray-500">No groups available</p>
                    ) : (
                      groups.map((group) => (
                        <label key={group} className="flex items-center space-x-3 text-sm text-gray-700 py-2 hover:bg-gray-50 px-3 rounded-md transition-colors duration-200">
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group)}
                            onChange={() => handleGroupChange(group)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span>{group}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="mt-8 flex items-center space-x-6">
          <label className="flex items-center space-x-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showMobile}
              onChange={handleCheckboxChange(setShowMobile)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span>Show Mobile Number</span>
          </label>
          <label className="flex items-center space-x-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showAddress}
              onChange={handleCheckboxChange(setShowAddress)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span>Show Address</span>
          </label>
        </div>
        <div className="mt-8 flex space-x-4">
          <button
            onClick={() => handleGenerate(isPurchaseModel ? 'Vendor' : 'Customer')}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Generate Summary
          </button>
          {!isVoucherModel && (
            <button
              onClick={() => handleGenerate('Product')}
              className="flex-1 px-6 py-3 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Generate Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportForm;