/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useContext, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CounterContext } from '@/lib/CounterContext';
import { db } from '../../../../firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';

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

// Security rights with descriptive labels
const securityRightsOptions = [
  { key: 'Dashboard', label: 'Access the main dashboard for system overview' },
  { key: 'Customer', label: 'Manage customer information and interactions' },
  { key: 'Vendor', label: 'Handle vendor details and communications' },
  { key: 'Product', label: 'Administer product catalog and inventory' },
  { key: 'Ledger', label: 'View and manage financial ledgers' },
  { key: 'SaleOrder', label: 'Create and process sales orders' },
  { key: 'SaleBill', label: 'Generate and manage sales bills' },
  { key: 'PurchaseOrder', label: 'Create and track purchase orders' },
  { key: 'PurchaseBill', label: 'Manage purchase bills and payments' },
  { key: 'Voucher', label: 'Handle financial vouchers and transactions' },
  { key: 'SaleOrderReport', label: 'Access reports for sales orders' },
  { key: 'SaleBillReport', label: 'View detailed sales bill reports' },
  { key: 'PurchaseOrderReport', label: 'Access reports for purchase orders' },
  { key: 'PurchaseBillReport', label: 'View detailed purchase bill reports' },
  { key: 'VoucherReport', label: 'Access financial voucher reports' },
  { key: 'OnlineIntegration', label: 'Manage online integration settings' },
  { key: 'StaffCreateEdit', label: 'Create and edit staff accounts' },
  { key: 'ProfileEdit', label: 'Edit personal profile information' },
];

// Component 1: Staff Details Form
const StaffDetails: React.FC<{
  staffData: StaffData;
  setStaffData: React.Dispatch<React.SetStateAction<StaffData>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  userRole: string;
}> = ({ staffData, setStaffData, setCurrentStep, userRole }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStaffData((prev) => ({ ...prev, [name]: value }));
    toast.dismiss();
  };

  const handleSubmit = (e: React.FormEvent) => {
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
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Edit Staff Details</h2>
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
              placeholder="Leave blank to keep unchanged"
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
              placeholder="Leave blank to keep unchanged"
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
  const availableSecurityRights = userRole.toLowerCase() === 'admin'
    ? securityRightsOptions
    : securityRightsOptions.filter((option) => userSecurityRights.includes(option.key));

  const handleCheckboxChange = (right: string) => {
    if (right === 'Dashboard') return; // Prevent changing Dashboard
    setStaffData((prev) => {
      const updatedRights = prev.securityRights.includes(right)
        ? prev.securityRights.filter((r) => r !== right)
        : [...prev.securityRights, right];
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
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Edit Security Rights</h2>
      {staffData.role === 'Admin' ? (
        <p className="text-gray-600 mb-4 text-sm sm:text-base">
          All security rights are automatically granted for the Admin role.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableSecurityRights.map((option) => (
            <label key={option.key} className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={staffData.securityRights.includes(option.key)}
                onChange={() => handleCheckboxChange(option.key)}
                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={option.key === 'Dashboard'}
              />
              <span className="text-sm sm:text-base text-gray-700">{option.label}</span>
            </label>
          ))}
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.dismiss();
    if (staffData.password && staffData.password !== staffData.confirmPassword) {
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        // Prepare staff data for update
        const staffDataToSave = {
          staffId: staffData.staffId,
          role: staffData.role,
          email: staffData.email,
          name: staffData.name,
          tenantId: staffData.tenantId,
          companyName: staffData.companyName,
          securityRights: staffData.securityRights,
          updatedAt: new Date().toISOString(),
          ...(staffData.password && { password: staffData.password }), // Only update password if provided
        };

        // Update staff data in TenantsDb/${tenantId}/STAFF
        const staffRef = doc(db, `TenantsDb/${tenantId}/STAFF`, staffData.staffId);
        await updateDoc(staffRef, staffDataToSave);
        console.log('Staff data updated in TenantsDb/STAFF:', staffDataToSave);

        // Update staff data in TenantsStaff
        const tenantsStaffQuery = collection(db, 'TenantsStaff');
        const tenantsStaffSnapshot = await getDocs(tenantsStaffQuery);
        const staffDoc = tenantsStaffSnapshot.docs.find(
          (doc) => doc.data().staffId === staffData.staffId && doc.data().tenantId === tenantId
        );
        if (staffDoc) {
          await updateDoc(doc(db, 'TenantsStaff', staffDoc.id), staffDataToSave);
          console.log('Staff data updated in TenantsStaff:', staffDataToSave);
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
          companyName: staffData.companyName,
          securityRights: ['Dashboard'],
          termsAccepted: false,
        });
        setOtp('');
        setOtpSent(false);
        setGeneratedOtp('');
        setCurrentStep(1);
        toast.success('Staff account updated successfully', { position: 'top-center' });
      } else {
        // toast.error(response.data.error || 'Invalid OTP. Please try again.', {
        //   position: 'top-center',
        // });
      }
    } catch (error) {
      console.error('Error verifying OTP or updating Firestore:', error);
      const axiosError = error as any;
      const errorMessage =
        axiosError.response?.data?.error || 'Error verifying OTP or updating data. Please try again.';
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
        Confirm Staff Account Updates
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
              placeholder="Leave blank to keep unchanged"
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
              placeholder="Leave blank to keep unchanged"
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
            <p><strong>Staff ID:</strong> {staffData.staffId}</p>
            <p><strong>Role:</strong> {staffData.role}</p>
            <p><strong>Name:</strong> {staffData.name}</p>
            <p><strong>Email:</strong> {staffData.email}</p>
            <p><strong>Tenant ID:</strong> {staffData.tenantId}</p>
            <p><strong>Company Name:</strong> {staffData.companyName}</p>
            <p>
              <strong>Security Rights:</strong>{' '}
              {staffData.securityRights.length > 0
                ? staffData.securityRights
                    .map(
                      (right) =>
                        securityRightsOptions.find((option) => option.key === right)?.label || right
                    )
                    .join(', ')
                : 'None'}
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

// Main Edit Staff Page Component
const EditStaffPage: React.FC = () => {
  const context = useContext(CounterContext);
  const tenantId = context?.state.tenantId || '';
  const searchParams = useSearchParams();
  const staffId = searchParams?.get('id') || '';
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
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch tenant role, security rights, and staff data
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

    // Fetch security rights for non-admin users
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

    // Fetch staff data based on staffId
    const fetchStaffData = async () => {
      if (!staffId || !tenantId) {
        // toast.error('Invalid staff ID or tenant ID', { position: 'top-center' });
        setLoading(false);
        return;
      }
      try {
        const staffRef = doc(db, `TenantsDb/${tenantId}/STAFF`, staffId);
        const staffSnap = await getDoc(staffRef);
        if (staffSnap.exists()) {
          const data = staffSnap.data();
          setStaffData({
            staffId: data.staffId || staffId,
            role: data.role || 'Staff',
            email: data.email || '',
            password: '',
            confirmPassword: '',
            name: data.name || '',
            tenantId: data.tenantId || tenantId,
            companyName: data.companyName || companyName,
            securityRights: data.securityRights || ['Dashboard'],
            termsAccepted: false,
          });
        } else {
          // toast.error('Staff member not found', { position: 'top-center' });
        }
      } catch (error) {
        console.error('Error fetching staff data:', error);
        // toast.error('Failed to fetch staff data', { position: 'top-center' });
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityRights();
    fetchStaffData();
  }, [tenantId, context?.state.userId, staffId]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-sm sm:text-base">Loading staff data...</p>
      </div>
    );
  }

  if (!staffId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-sm sm:text-base">Error: Staff ID is missing</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-gray-100 flex items-center justify-center p-4 sm:p-6">
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
          Edit Staff Account
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

const PageWithSuspense = () => (
  <Suspense fallback={<div>Loading staff view...</div>}>
    <EditStaffPage />
  </Suspense>
);

export default PageWithSuspense;