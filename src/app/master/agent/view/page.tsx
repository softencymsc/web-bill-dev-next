/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, Suspense, useContext } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { CounterContext } from "@/lib/CounterContext";
import Loader from '@/components/Loader';

function AgentFormInner() {
  const page = "Agent";
  const searchParams = useSearchParams();
  const id = searchParams?.get('id'); // e.g., "AGT001"
  const { state } = useContext(CounterContext);
  const router = useRouter();

  const [formData, setFormData] = useState({
    agentCode: '',
    name: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    phoneNumber: '',
    commissionPercentage: '',
    status: 'active' as 'active' | 'dormant',
  });

  const [originalFormData, setOriginalFormData] = useState(formData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);

  const isValidIdFormat = (id: string | null): boolean => {
    if (!id) return false;
    return /^AGT\d+$/.test(id);
  };

  useEffect(() => {
    if (!id || !isValidIdFormat(id)) {
      setCodeError('Invalid agent ID format. Expected format: AGT followed by digits (e.g., AGT001)');
      setIsLoadingCode(false);
      return;
    }

    const fetchAgentData = async () => {
      setIsLoadingCode(true);
      setCodeError('');
      try {
        const agentsRef = collection(db, 'TenantsDb', state.tenantId, "AGENTS");
        const q = query(agentsRef, where('AGENTCODE', '==', id));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setCodeError('No agent found with this ID');
          // toast.error('No agent found with this ID');
          return;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        const fetchedData = {
          agentCode: data.AGENTCODE || '',
          name: data.NAME || '',
          address: data.ADDRESS || '',
          city: data.CITY || '',
          state: data.STATE || '',
          pinCode: data.PINCODE || '',
          phoneNumber: data.PHONENUMBER || '',
          commissionPercentage: data.COMMISSIONPERCENTAGE || '',
          status: data.STATUS || 'active',
        };

        setFormData(fetchedData);
        setOriginalFormData(fetchedData);
        setDocId(doc.id);
      } catch (error) {
        console.error('Error fetching agent data:', error);
        setCodeError('Failed to fetch agent data');
        // toast.error('Failed to fetch agent data');
      } finally {
        setIsLoadingCode(false);
      }
    };

    fetchAgentData();
  }, [id, state.tenantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'radio' ? value : value,
    }));
  };

  const handleReset = () => {
    setFormData(originalFormData);
    setIsEditing(false);
  };

  const handleEditToggle = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    router.push('/master/agent');
  };

  const handleUpdate = async () => {
    if (!id || !isValidIdFormat(id)) {
      // toast.error('Invalid agent ID');
      return;
    }

    if (!formData.name || !formData.phoneNumber) {
      // toast.error('Name and Phone Number are required');
      return;
    }

    if (!/^\d{10}$/.test(formData.phoneNumber)) {
      // toast.error('Phone Number must be 10 digits');
      return;
    }

    if (!docId) {
      // toast.error('No agent document found to update');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        AGENTCODE: formData.agentCode,
        NAME: formData.name,
        ADDRESS: formData.address,
        CITY: formData.city,
        STATE: formData.state,
        PINCODE: formData.pinCode,
        PHONENUMBER: formData.phoneNumber,
        COMMISSIONPERCENTAGE: formData.commissionPercentage,
        STATUS: formData.status,
      };

      const docRef = doc(db, 'TenantsDb', state.tenantId, "AGENTS", docId);
      await updateDoc(docRef, updateData);

      toast.success('Agent data updated successfully');
      setOriginalFormData(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating agent data:', error);
      // toast.error('Failed to update agent data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
      <main className="w-full max-w-5xl bg-white rounded-lg overflow-hidden p-6 md:p-8 mx-auto">
        <form className="w-full" onSubmit={(e) => e.preventDefault()}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[#2c5aa0] text-2xl font-semibold">{page}</h2>
            <div className="flex justify-end gap-4">
              {isEditing ? (
                <>
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
                    type="button"
                    onClick={handleUpdate}
                    className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                    disabled={isLoadingCode || !!codeError || isSubmitting}
                  >
                    {isSubmitting ? 'Updating...' : 'Update'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleEditToggle}
                  className="px-6 py-2 bg-[#2c5aa0] text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-shadow disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                  disabled={isLoadingCode || !!codeError}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
          {isLoadingCode && <div className="text-center"><Loader /></div>}
          {codeError && <div className="text-red-500 text-center mb-4">{codeError}</div>}
          {!isLoadingCode && !codeError && (
            <div className="grid gap-6">
              {/* Agent Details */}
              <div>
                <h3 className="text-[#2c5aa0] text-lg font-semibold mb-4">Agent Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="agentCode" className="text-gray-600 text-sm font-medium mb-1 block">
                      Agent Code
                    </label>
                    <input
                      type="text"
                      id="agentCode"
                      name="agentCode"
                      placeholder="Agent Code"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={id || 'No ID'}
                      disabled
                    />
                  </div>
                  <div>
                    <label htmlFor="name" className="text-gray-600 text-sm font-medium mb-1 block">
                      Agent Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="Agent Name"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="phoneNumber" className="text-gray-600 text-sm font-medium mb-1 block">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="phoneNumber"
                      name="phoneNumber"
                      placeholder="Phone Number"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      required
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="commissionPercentage" className="text-gray-600 text-sm font-medium mb-1 block">
                      Commission Percentage
                    </label>
                    <input
                      type="number"
                      id="commissionPercentage"
                      name="commissionPercentage"
                      placeholder="Commission Percentage"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.commissionPercentage}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div>
                <h3 className="text-[#2c5aa0] text-lg font-semibold mb-4">Address Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="address" className="text-gray-600 text-sm font-medium mb-1 block">
                      Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      placeholder="Address"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.address}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="text-gray-600 text-sm font-medium mb-1 block">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      placeholder="City"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="text-gray-600 text-sm font-medium mb-1 block">
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      placeholder="State"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.state}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="pinCode" className="text-gray-600 text-sm font-medium mb-1 block">
                      Pin Code
                    </label>
                    <input
                      type="text"
                      id="pinCode"
                      name="pinCode"
                      placeholder="Pin Code"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.pinCode}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-[#2c5aa0] text-lg font-semibold mb-4">Status</h3>
                <div className="flex gap-6">
                  <label className="flex items-center text-gray-600 text-sm font-medium">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === 'active'}
                      onChange={handleChange}
                      className="mr-2"
                      disabled={!isEditing}
                    />
                    Active
                  </label>
                  <label className="flex items-center text-gray-600 text-sm font-medium">
                    <input
                      type="radio"
                      name="status"
                      value="dormant"
                      checked={formData.status === 'dormant'}
                      onChange={handleChange}
                      className="mr-2"
                      disabled={!isEditing}
                    />
                    Dormant
                  </label>
                </div>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}

const Page = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <AgentFormInner />
  </Suspense>
);

export default Page;