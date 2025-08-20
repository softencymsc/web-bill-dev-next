/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useEffect, useState } from 'react';
import { User, Edit2, Save } from 'lucide-react';
import { useAuth } from "../../context/AuthContext";
import {getCompanyDetailsByTenantId, updateCompanyDetails} from "../../services/index"
import toast from 'react-hot-toast';
const FranchiseInfoForm = () => {
  const { tenant, company} = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<any>([]);
  const [formData, setFormData] = useState({
    franchiseName: company?.cname || 'TEST FRANCHISE',
    address: company?.CAddress || 'N/A',
    address1: 'Franchise Address line 2',
    contactPerson: '9836899318',
    city: 'Franchise City',
    contactNumber: 'Franchise Contact Number',
    country: 'Franchise Country Name',
    district: 'Franchise Address District',
    email: tenant?.email || 'Franchise Email',
    gstin: '',
  });



useEffect(() => {
  getCompanyDetailsByTenantId(tenant?.tenant_id)
    .then((res) => {
      setValue(res); // directly store the result
      console.log(res)
    })
    .catch((error) => {
      console.error("Error fetching company details:", error);
    });
}, []);
  useEffect(() => {
  if (value && Object.keys(value).length > 0) {
    setFormData({
      franchiseName: value?.cname || '',
      address: value?.CAddress || '',
      address1: value?.address1 || '',
      contactPerson: value?.contactPerson || '',
      city: value?.city || '',
      contactNumber: value?.contactNumber || '',
      country: value?.country || '',
      district: value?.district || '',
      email: value?.email || '',
      gstin: value?.gstin || '',
    });
  }
}, [value]);
const handleUpdate = async (formData: any) => {
  try {
    await updateCompanyDetails(tenant?.tenant_id, formData);
    toast.success("Company details updated successfully");
    setIsEditing(false);
  } catch (error) {
    console.error("Error updating company details:", error);
    // toast.error("Failed to update company details. Please try again.");
  }
};


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

 const toggleEdit = () => {
  if (isEditing) {
    // Save data when exiting edit mode
    handleUpdate(formData);
  } else {
    // Just enter edit mode
    setIsEditing(true);
  }
};


  return (
    <div className="max-w-4xl mx-auto mt-8 p-4 sm:p-6 md:p-10 bg-white rounded-2xl shadow-xl border border-gray-100 transition-all duration-300 hover:shadow-2xl">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-3 bg-indigo-100 rounded-full border border-indigo-200">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Franchise Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">{tenant.role ? `Role: ${tenant.role}` : 'View and update your franchise details'}</p>
          </div>
        </div>
        <button
          onClick={toggleEdit}
          className="group flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          {isEditing ? (
            <>
              <Save className="w-4 h-4 group-hover:scale-105 transition-transform" /> Save
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 group-hover:scale-105 transition-transform" /> Edit
            </>
          )}
        </button>
      </div>

      {/* Form Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        {Object.entries(formData).map(([key, value]) => (
          <div key={key} className="group">
            <label className="block text-sm font-medium text-gray-700 capitalize mb-2">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <div className="relative">
              <input
                type={key === 'email' ? 'email' : key === 'contactNumber' ? 'tel' : 'text'}
                name={key}
                value={value}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200 text-gray-900 placeholder-gray-400 text-sm ${
                  isEditing
                    ? 'bg-white border-gray-200 hover:border-indigo-300'
                    : 'bg-gray-50 border-gray-100 cursor-not-allowed'
                }`}
                placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').trim()}`}
              />
              {isEditing && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Edit2 className="w-4 h-4 text-indigo-400" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FranchiseInfoForm;