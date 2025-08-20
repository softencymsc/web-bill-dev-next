/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, FormEvent, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CounterContext } from '@/lib/CounterContext';
import { db } from '../../../../firebase';
import { doc, getDoc, collection, addDoc, getDocs } from 'firebase/firestore';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

// Interface for staff data
interface StaffData {
  staffId: string;
  role: string;
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  tenantId: string;
  companyName: string;
  securityRights: string[];
  termsAccepted: boolean;
}

// Interface for API responses
interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Security rights with descriptive labels, including add, modify, and delete
const securityRightsOptions = [
  { key: 'Dashboard', label: 'Access the main dashboard for system overview' },
  { key: 'Customer', label: 'View customer information and interactions' },
  { key: 'Customer_Add', label: 'Add new customers' },
  { key: 'Customer_Modify', label: 'Modify existing customer information' },
  { key: 'Customer_Delete', label: 'Delete customers' },
  { key: 'Vendor', label: 'View vendor details and communications' },
  { key: 'Vendor_Add', label: 'Add new vendors' },
  { key: 'Vendor_Modify', label: 'Modify existing vendor information' },
  { key: 'Vendor_Delete', label: 'Delete vendors' },
  { key: 'Product', label: 'View product catalog and inventory' },
  { key: 'Product_Add', label: 'Add new products' },
  { key: 'Product_Modify', label: 'Modify existing product information' },
  { key: 'Product_Delete', label: 'Delete products' },
  { key: 'Ledger', label: 'View financial ledgers' },
  { key: 'Ledger_Add', label: 'Add new ledger entries' },
  { key: 'Ledger_Modify', label: 'Modify existing ledger entries' },
  { key: 'Ledger_Delete', label: 'Delete ledger entries' },
  { key: 'SaleOrder', label: 'View sales orders' },
  { key: 'SaleOrder_Add', label: 'Create new sales orders' },
  { key: 'SaleOrder_Modify', label: 'Modify existing sales orders' },
  { key: 'SaleOrder_Delete', label: 'Delete sales orders' },
  { key: 'SaleBill', label: 'View sales bills' },
  { key: 'SaleBill_Add', label: 'Generate new sales bills' },
  { key: 'SaleBill_Modify', label: 'Modify existing sales bills' },
  { key: 'SaleBill_Delete', label: 'Delete sales bills' },
  { key: 'PurchaseOrder', label: 'View purchase orders' },
  { key: 'PurchaseOrder_Add', label: 'Create new purchase orders' },
  { key: 'PurchaseOrder_Modify', label: 'Modify existing purchase orders' },
  { key: 'PurchaseOrder_Delete', label: 'Delete purchase orders' },
  { key: 'PurchaseBill', label: 'View purchase bills' },
  { key: 'PurchaseBill_Add', label: 'Add new purchase bills' },
  { key: 'PurchaseBill_Modify', label: 'Modify existing purchase bills' },
  { key: 'PurchaseBill_Delete', label: 'Delete purchase bills' },
  { key: 'SpecialOrder', label: 'View special orders' },
  { key: 'SpecialOrder_Add', label: 'Create new special orders' },
  { key: 'SpecialOrder_Modify', label: 'Modify existing special orders' },
  { key: 'SpecialOrder_Delete', label: 'Delete special orders' },
  { key: 'Staff', label: 'View staff accounts' },
  { key: 'Staff_Add', label: 'Create new staff accounts' },
  { key: 'Staff_Modify', label: 'Modify existing staff accounts' },
  { key: 'Staff_Delete', label: 'Delete staff accounts' },
  { key: 'Voucher', label: 'View financial vouchers' },
  { key: 'Voucher_Add', label: 'Create new financial vouchers' },
  { key: 'Voucher_Modify', label: 'Modify existing financial vouchers' },
  { key: 'Voucher_Delete', label: 'Delete financial vouchers' },
  { key: 'SaleOrderReport', label: 'Access reports for sales orders' },
  { key: 'SaleBillReport', label: 'View detailed sales bill reports' },
  { key: 'PurchaseOrderReport', label: 'Access reports for purchase orders' },
  { key: 'PurchaseBillReport', label: 'View detailed purchase bill reports' },
  { key: 'VoucherReport', label: 'Access financial voucher reports' },
  { key: 'OnlineIntegration', label: 'Manage online integration settings' },
  { key: 'StaffCreateEdit', label: 'Create and edit staff accounts' },
  { key: 'ProfileEdit', label: 'Edit personal profile information' },
];

// Function to generate a unique staff ID
const generateUniqueStaffId = async (tenantId: string): Promise<string> => {
  const staffRef = collection(db, `TenantsDb/${tenantId}/STAFF`);
  const staffSnapshot = await getDocs(staffRef);
  const existingIds = staffSnapshot.docs
    .map((doc) => doc.data().staffId)
    .filter((id): id is string => !!id);
  let newId: string;
  do {
    newId = `STAFF-${Math.floor(10000 + Math.random() * 90000)}`; // Generate a 5-digit random ID
  } while (existingIds.includes(newId));
  return newId;
};

// Component 1: Staff Details Form
const StaffDetails: React.FC<{
  staffData: StaffData;
  setStaffData: React.Dispatch<React.SetStateAction<StaffData>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  userRole: string;
}> = ({ staffData, setStaffData, setCurrentStep, userRole }) => {
  const context = useContext(CounterContext);
  const tenantId = context?.state.tenantId || '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStaffData((prev) => ({ ...prev, [name]: value }));
    toast.dismiss();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (staffData.password !== staffData.confirmPassword) {
      // toast.error('Passwords do not match');
      return;
    }
    // Automatically set all security rights for Admin
    if (staffData.role === 'Admin') {
      setStaffData((prev) => ({
        ...prev,
        securityRights: securityRightsOptions.map((option) => option.key),
      }));
    }
    setCurrentStep(2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-lg shadow-xl p-6 sm:p-8 max-w-2xl mx-auto"
    >
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Enter Staff Details</h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              name="role"
              value={staffData.role}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              disabled={userRole.toLowerCase() !== 'admin'}
            >
              {userRole.toLowerCase() === 'admin' ? (
                <>
                  <option value="Admin">Admin</option>
                  <option value="Staff">Staff</option>
                </>
              ) : (
                <option value="Staff">Staff</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              name="name"
              value={staffData.name}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              name="email"
              value={staffData.email}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tenant ID</label>
            <input
              type="text"
              name="tenantId"
              value={staffData.tenantId}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100 py-3 text-sm sm:text-base cursor-not-allowed"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              name="password"
              value={staffData.password}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={staffData.confirmPassword}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={staffData.companyName}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100 py-3 text-sm sm:text-base cursor-not-allowed"
              disabled
            />
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="submit"
          className="mt-6 w-full py-3 px-4 bg-indigo-600 text-white rounded-md shadow-md hover:bg-indigo-700 transition duration-300 text-sm sm:text-base min-h-[48px]"
        >
          Proceed to Security Rights
        </motion.button>
      </form>
    </motion.div>
  );
};

// Component 2: Security Rights
const SecurityRights: React.FC<{
  staffData: StaffData;
  setStaffData: React.Dispatch<React.SetStateAction<StaffData>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  userRole: string;
  userSecurityRights: string[];
}> = ({ staffData, setStaffData, setCurrentStep, userRole, userSecurityRights }) => {
  // Filter available security rights based on user role
  const availableSecurityRights = userRole.toLowerCase() === 'admin'
    ? securityRightsOptions
    : securityRightsOptions.filter((option) => userSecurityRights.includes(option.key));

  // Define modules for grouping
  const modules = [
    'Dashboard',
    'Customer',
    'Vendor',
    'Product',
    'Ledger',
    'SaleOrder',
    'SaleBill',
    'PurchaseOrder',
    'PurchaseBill',
    'SpecialOrder',
    'Staff',
    'Voucher',
    'SaleOrderReport',
    'SaleBillReport',
    'PurchaseOrderReport',
    'PurchaseBillReport',
    'VoucherReport',
    'OnlineIntegration',
    'StaffCreateEdit',
    'ProfileEdit',
  ];

  const handleCheckboxChange = (right: string) => {
    if (right === 'Dashboard') return; // Prevent changing Dashboard
    setStaffData((prev) => {
      let updatedRights = prev.securityRights.includes(right)
        ? prev.securityRights.filter((r) => r !== right)
        : [...prev.securityRights, right];

      // Ensure main module is included if sub-permission is selected
      const module = right.split('_')[0];
      if (
        right.includes('_') &&
        !updatedRights.includes(module) &&
        securityRightsOptions.some((opt) => opt.key === module)
      ) {
        updatedRights = [...updatedRights, module];
      }

      // If main module permission is deselected, remove its sub-permissions
      if (!right.includes('_') && prev.securityRights.includes(right)) {
        updatedRights = updatedRights.filter((r) => !r.startsWith(`${right}_`));
      }

      return { ...prev, securityRights: updatedRights };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-lg shadow-xl p-6 sm:p-8 max-w-2xl mx-auto max-h-[70vh] overflow-y-auto"
    >
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Assign Security Rights</h2>
      {staffData.role === 'Admin' ? (
        <p className="text-gray-600 mb-4 text-sm sm:text-base">
          All security rights are automatically granted for the Admin role.
        </p>
      ) : (
        <div className="space-y-6">
          {modules.map((module) => {
            // Get all permissions related to this module
            const moduleRights = availableSecurityRights.filter(
              (option) => option.key === module || option.key.startsWith(`${module}_`)
            );
            if (moduleRights.length === 0) return null; // Skip if no rights available

            return (
              <div key={module} className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {securityRightsOptions.find((option) => option.key === module)?.label || module}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {moduleRights.map((option) => (
                    <label
                      key={option.key}
                      className={`flex items-center space-x-3 ${option.key.includes('_') ? 'pl-6' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={staffData.securityRights.includes(option.key)}
                        onChange={() => handleCheckboxChange(option.key)}
                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        disabled={option.key === 'Dashboard'}
                      />
                      <span className={`text-sm sm:text-base ${option.key.includes('_') ? 'text-gray-600' : 'text-gray-700'}`}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between mt-6 gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCurrentStep(1)}
          className="py-3 px-4 bg-gray-300 text-gray-800 rounded-md shadow-md hover:bg-gray-400 transition duration-300 text-sm sm:text-base min-h-[48px]"
        >
          Back to Details
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCurrentStep(3)}
          className="py-3 px-4 bg-indigo-600 text-white rounded-md shadow-md hover:bg-indigo-700 transition duration-300 text-sm sm:text-base min-h-[48px]"
        >
          Proceed to Confirmation
        </motion.button>
      </div>
    </motion.div>
  );
};

// Component 3: Confirmation
const Confirmation: React.FC<{
  staffData: StaffData;
  setStaffData: React.Dispatch<React.SetStateAction<StaffData>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}> = ({ staffData, setStaffData, setCurrentStep }) => {
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const context = useContext(CounterContext);
  const tenantId = context?.state.tenantId || '';

  // Define modules for grouping in summary
  const modules = [
    'Dashboard',
    'Customer',
    'Vendor',
    'Product',
    'Ledger',
    'SaleOrder',
    'SaleBill',
    'PurchaseOrder',
    'PurchaseBill',
    'SpecialOrder',
    'Staff',
    'Voucher',
    'SaleOrderReport',
    'SaleBillReport',
    'PurchaseOrderReport',
    'PurchaseBillReport',
    'VoucherReport',
    'OnlineIntegration',
    'StaffCreateEdit',
    'ProfileEdit',
  ];

  // Fetch admin phone number from Firestore
  useEffect(() => {
    const fetchPhoneNumber = async () => {
      if (!tenantId) {
        // toast.error('Tenant ID is missing');
        return;
      }
      try {
        const settingsRef = doc(db, `TenantsDb/${tenantId}/SETTINGS`, 'ownerNumber');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          console.log('Fetched phone number:', data.number);
          setPhoneNumber(data.number || '');
        } else {
          // toast.error('Admin phone number not found');
        }
      } catch (error) {
        console.error('Error fetching phone number:', error);
        // toast.error('Failed to fetch admin phone number');
      }
    };
    fetchPhoneNumber();
  }, [tenantId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStaffData((prev) => ({ ...prev, [name]: value }));
    toast.dismiss();
  };

  const handleTermsChange = () => {
    setStaffData((prev) => ({ ...prev, termsAccepted: !prev.termsAccepted }));
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(e.target.value);
    toast.dismiss();
  };

  const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  };

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    toast.dismiss();
    if (staffData.password !== staffData.confirmPassword) {
      // toast.error('Passwords do not match');
      return;
    }
    if (!phoneNumber) {
      // toast.error('Admin phone number is missing');
      return;
    }
    if (!tenantId) {
      // toast.error('Tenant ID is missing');
      return;
    }
    try {
      const otp = generateOtp();
      setGeneratedOtp(otp);
      const response = await axios.post<ApiResponse>('/api/sendotp', {
        tenantId,
        phoneNumber,
        otp,
      });
      if (response.data.success) {
        setOtpSent(true);
        toast.success('OTP sent successfully', { position: 'top-center' });
      } else {
        // toast.error(response.data.error || 'Failed to send OTP', { position: 'top-center' });
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      const axiosError = error as any;
      const errorMessage =
        axiosError.response?.data?.error || 'Error sending OTP. Please try again.';
      // toast.error(errorMessage, { position: 'top-center' });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    toast.dismiss();
    if (!otp) {
      // toast.error('Please enter the OTP', { position: 'top-center' });
      return;
    }
    if (!tenantId) {
      // toast.error('Tenant ID is missing', { position: 'top-center' });
      return;
    }
    try {
      const response = await axios.post<ApiResponse>('/api/verifyotp', {
        tenantId,
        phoneNumber,
        otp,
        generatedOtp,
      });
      if (response.data.success) {
        // Generate unique staff ID
        const staffId = await generateUniqueStaffId(tenantId);

        // Prepare staff data
        const staffDataToSave = {
          staffId,
          role: staffData.role,
          email: staffData.email,
          name: staffData.name,
          tenantId: staffData.tenantId,
          companyName: staffData.companyName,
          securityRights: staffData.securityRights,
          createdAt: new Date().toISOString(),
        };

        // Save staff data to TenantsDb/${tenantId}/STAFF
        const staffRef = collection(db, `TenantsDb/${tenantId}/STAFF`);
        await addDoc(staffRef, staffDataToSave);
        console.log('Staff data saved to TenantsDb/STAFF:', { ...staffData, staffId });

        // Save staff data to TenantsStaff
        const tenantsStaffRef = collection(db, 'TenantsStaff');
        await addDoc(tenantsStaffRef, staffDataToSave);
        console.log('Staff data saved to TenantsStaff:', { ...staffData, staffId });

        // Refetch companyName from localStorage for reset
        let companyName = '';
        if (typeof window !== 'undefined') {
          const companyData = localStorage.getItem('company');
          if (companyData) {
            try {
              const parsedData = JSON.parse(companyData);
              companyName = parsedData.CName || '';
            } catch (error) {
              console.error('Error parsing company data from localStorage:', error);
            }
          }
        }

        // Reset form
        setStaffData({
          staffId: '',
          role: 'Staff',
          email: '',
          password: '',
          confirmPassword: '',
          name: '',
          tenantId: tenantId || '',
          companyName,
          securityRights: ['Dashboard'],
          termsAccepted: false,
        });
        setOtp('');
        setOtpSent(false);
        setGeneratedOtp('');
        setCurrentStep(1);
        toast.success('Staff account created successfully', { position: 'top-center' });
      } else {
        // toast.error(response.data.error || 'Invalid OTP. Please try again.', {
        //   position: 'top-center',
        // });
      }
    } catch (error) {
      console.error('Error verifying OTP or saving to Firestore:', error);
      const axiosError = error as any;
      const errorMessage =
        axiosError.response?.data?.error || 'Error verifying OTP or saving data. Please try again.';
      // toast.error(errorMessage, { position: 'top-center' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
      className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-2xl mx-auto"
    >
      <motion.h2
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-xl sm:text-2xl font-bold text-gray-800 mb-6"
      >
        Confirm Staff Account Details
      </motion.h2>
      {isEditing ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 mb-6"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              name="role"
              value={staffData.role}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
            >
              <option value="Admin">Admin</option>
              <option value="Staff">Staff</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              name="name"
              value={staffData.name}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              name="email"
              value={staffData.email}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tenant ID</label>
            <input
              type="text"
              name="tenantId"
              value={staffData.tenantId}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100 py-3 text-sm sm:text-base cursor-not-allowed"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              name="password"
              value={staffData.password}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={staffData.confirmPassword}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={staffData.companyName}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100 py-3 text-sm sm:text-base cursor-not-allowed"
              disabled
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-r from-indigo-50 to-gray-50 p-4 sm:p-6 rounded-lg mb-6 shadow-inner"
        >
          <h3 className="text-lg sm:text-xl font-medium text-gray-800 mb-4">Staff Details Summary</h3>
          <div className="space-y-2 text-sm sm:text-base">
            <p><strong>Staff ID:</strong> {staffData.staffId || 'Not assigned yet'}</p>
            <p><strong>Role:</strong> {staffData.role}</p>
            <p><strong>Name:</strong> {staffData.name}</p>
            <p><strong>Email:</strong> {staffData.email}</p>
            <p><strong>Tenant ID:</strong> {staffData.tenantId}</p>
            <p><strong>Company Name:</strong> {staffData.companyName}</p>
            <p>
              <strong>Security Rights:</strong>
              {staffData.securityRights.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {modules
                    .map((module) => {
                      const moduleRights = staffData.securityRights.filter(
                        (right) => right === module || right.startsWith(`${module}_`)
                      );
                      if (moduleRights.length === 0) return null;
                      return (
                        <li key={module}>
                          <strong>
                            {securityRightsOptions.find((option) => option.key === module)?.label || module}:
                          </strong>
                          <ul className="list-circle pl-5">
                            {moduleRights.map((right) => (
                              <li key={right} className="text-sm text-gray-600">
                                {securityRightsOptions.find((option) => option.key === right)?.label || right}
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    })
                    .filter((item) => item !== null)}
                </ul>
              ) : (
                'None'
              )}
            </p>
          </div>
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <label className="flex items-center space-x-3 mb-4">
          <input
            type="checkbox"
            checked={staffData.termsAccepted}
            onChange={handleTermsChange}
            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <span className="text-sm sm:text-base text-gray-700">
            I agree to all terms and conditions of the platform
          </span>
        </label>
        {otpSent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <p className="text-green-500 text-sm sm:text-base mb-2">
              An OTP has been sent to the admin’s phone number.
            </p>
            <label className="block text-sm font-medium text-gray-700">Enter OTP</label>
            <input
              type="text"
              value={otp}
              onChange={handleOtpChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3 text-sm sm:text-base"
              placeholder="Enter OTP"
            />
          </motion.div>
        )}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentStep(2)}
            className="py-3 px-4 bg-gray-300 text-gray-800 rounded-md shadow-md hover:bg-gray-400 transition duration-300 text-sm sm:text-base min-h-[48px]"
          >
            Back to Security Rights
          </motion.button>
          <div className="flex flex-col sm:flex-row gap-4">
            {!isEditing && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditing(true)}
                  className="py-3 px-4 bg-indigo-600 text-white rounded-md shadow-md hover:bg-indigo-700 transition duration-300 text-sm sm:text-base min-h-[48px]"
                >
                  Edit Staff Details
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentStep(2)}
                  className="py-3 px-4 bg-indigo-600 text-white rounded-md shadow-md hover:bg-indigo-700 transition duration-300 text-sm sm:text-base min-h-[48px]"
                >
                  Edit Security Rights
                </motion.button>
              </>
            )}
            {isEditing ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(false)}
                className="py-3 px-4 bg-indigo-600 text-white rounded-md shadow-md hover:bg-indigo-700 transition duration-300 text-sm sm:text-base min-h-[48px]"
              >
                Save Changes
              </motion.button>
            ) : otpSent ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmit}
                disabled={!staffData.termsAccepted}
                className={`py-3 px-4 rounded-md text-white shadow-md transition duration-300 text-sm sm:text-base min-h-[48px] ${
                  staffData.termsAccepted
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Submit with OTP
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSendOtp}
                disabled={!staffData.termsAccepted || !phoneNumber}
                className={`py-3 px-4 rounded-md text-white shadow-md transition duration-300 text-sm sm:text-base min-h-[48px] ${
                  staffData.termsAccepted && phoneNumber
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Send OTP
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main Staff Page Component
const StaffPage: React.FC = () => {
  const context = useContext(CounterContext);
  const tenantId = context?.state.tenantId || '';
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [staffData, setStaffData] = useState<StaffData>({
    staffId: '',
    role: 'Staff',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    tenantId: '',
    companyName: '',
    securityRights: ['Dashboard'],
    termsAccepted: false,
  });
  const [userRole, setUserRole] = useState<string>('');
  const [userSecurityRights, setUserSecurityRights] = useState<string[]>([]);

  // Fetch tenant role and security rights from localStorage and Firestore
  useEffect(() => {
    let companyName = '';
    let role = '';

    // Fetch from localStorage
    if (typeof window !== 'undefined') {
      const companyData = localStorage.getItem('company');
      if (companyData) {
        try {
          const parsedData = JSON.parse(companyData);
          companyName = parsedData.CName || '';
          role = parsedData.role || '';
          setUserRole(role.toLowerCase());
        } catch (error) {
          console.error('Error parsing company data from localStorage:', error);
          // toast.error('Failed to load company data', { position: 'top-center' });
        }
      }
    }

    // If not admin, fetch security rights from Firestore
    const fetchSecurityRights = async () => {
      if (role.toLowerCase() !== 'admin' && tenantId && context?.state.userId) {
        try {
          const staffRef = doc(db, `TenantsDb/${tenantId}/STAFF`, context.state.userId);
          const staffSnap = await getDoc(staffRef);
          if (staffSnap.exists()) {
            const data = staffSnap.data();
            setUserSecurityRights(data.securityRights || []);
          } else {
            // toast.error('Staff data not found', { position: 'top-center' });
          }
        } catch (error) {
          console.error('Error fetching security rights:', error);
          // toast.error('Failed to fetch security rights', { position: 'top-center' });
        }
      } else {
        // Admin has all rights
        setUserSecurityRights(securityRightsOptions.map((option) => option.key));
      }
    };

    fetchSecurityRights();

    setStaffData((prev) => ({
      ...prev,
      tenantId,
      companyName,
    }));
  }, [tenantId, context?.state.userId]);

  if (!context) {
    useEffect(() => {
      // toast.error('CounterContext is not available', { position: 'top-center' });
    }, []);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-sm sm:text-base">Error: CounterContext is not available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-gray-100 flex items-center justify-center p-4 sm:p-6 overflow-x-hidden">
      <div className="w-full max-w-3xl">
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#fff',
              color: '#1F2937',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '14px',
              maxWidth: '90vw',
            },
            error: {
              style: {
                borderColor: '#EF4444',
              },
            },
            success: {
              style: {
                borderColor: '#10B981',
              },
            },
          }}
        />
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center text-indigo-800 mb-6 sm:mb-8"
        >
          Create New Staff Account
        </motion.h1>
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <StaffDetails
              key="staff-details"
              staffData={staffData}
              setStaffData={setStaffData}
              setCurrentStep={setCurrentStep}
              userRole={userRole}
            />
          )}
          {currentStep === 2 && (
            <SecurityRights
              key="security-rights"
              staffData={staffData}
              setStaffData={setStaffData}
              setCurrentStep={setCurrentStep}
              userRole={userRole}
              userSecurityRights={userSecurityRights}
            />
          )}
          {currentStep === 3 && (
            <Confirmation
              key="confirmation"
              staffData={staffData}
              setStaffData={setStaffData}
              setCurrentStep={setCurrentStep}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StaffPage;