/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useState, useEffect, useContext } from 'react';
import { collection, getDocs, addDoc, Timestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Toaster, toast } from 'react-hot-toast';
import { CounterContext } from "@/lib/CounterContext";
import { getPrefixForModel } from '@/services';
import { collections } from "../config";
import { useRouter } from 'next/navigation';

interface AgentDataFormProps {
  page: string;
  onSubmit?: (formData: AgentFormData) => void;
  onReset?: () => void;
  onCancel?: () => void;
  initialData?: AgentFormData;
}

interface AgentFormData {
  agentCode: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phoneNumber: string;
  commissionPercentage: string;
  status: 'active' | 'dormant';
}

const AgentDataForm: React.FC<AgentDataFormProps> = ({ page, onSubmit, onReset, onCancel, initialData }) => {
  const [formData, setFormData] = useState<AgentFormData>(
    initialData || {
      agentCode: '',
      name: '',
      address: '',
      city: '',
      state: '',
      pinCode: '',
      phoneNumber: '',
      commissionPercentage: '',
      status: 'active',
    }
  );
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { state } = useContext(CounterContext);
  const { tenantId } = state;
  const router = useRouter();

  const generateUniqueAgentCode = async (): Promise<string> => {
    if (!tenantId) {
      throw new Error("Tenant ID is missing");
    }
    try {
      const agentRef = collection(db, "TenantsDb", tenantId, collections.AGENTS);
      const defaultPrefix = "AGT";

      let prefix: string;
      try {
        prefix = await getPrefixForModel(tenantId, "Agent");
      } catch (error) {
        console.warn(`Prefix not found for Agent, using default: ${defaultPrefix}`, error);
        prefix = defaultPrefix;

        try {
          const docnumRef = doc(db, "TenantsDb", tenantId, "DOCNUM", "Agent");
          await setDoc(docnumRef, { prefix }, { merge: true });
          console.log(`Default prefix ${prefix} saved to DOCNUM for Agent`);
        } catch (setError) {
          console.error(`Failed to save default prefix to DOCNUM:`, setError);
        }
      }

      const querySnapshot = await getDocs(agentRef);
      let maxCodeNumber = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const agentCode = data.AGENTCODE;
        if (typeof agentCode === "string" && agentCode.startsWith(prefix)) {
          const codeNumberStr = agentCode.replace(prefix, "");
          const codeNumber = parseInt(codeNumberStr, 10);
          if (!isNaN(codeNumber) && codeNumber > maxCodeNumber) {
            maxCodeNumber = codeNumber;
          }
        }
      });

      const nextCodeNumber = maxCodeNumber + 1;
      const formattedCodeNumber = nextCodeNumber.toString().padStart(3, "0");

      return `${prefix}${formattedCodeNumber}`;
    } catch (error) {
      console.error("Error generating agent code:", error);
      throw new Error("Failed to generate agent code");
    }
  };

  useEffect(() => {
    const setUniqueCode = async () => {
      setIsLoadingCode(true);
      setCodeError(null);
      try {
        if (!tenantId) {
          throw new Error("Tenant ID is missing");
        }
        const newCode = await generateUniqueAgentCode();
        setFormData((prev) => ({ ...prev, agentCode: newCode }));
      } catch (error) {
        console.error('Error generating agent code:', error);
        setCodeError('Failed to generate agent code. Please try again.');
        // toast.error('Failed to generate agent code. Please try again.');
      } finally {
        setIsLoadingCode(false);
      }
    };
    if (tenantId && !initialData?.agentCode) {
      setUniqueCode();
    } else if (!tenantId) {
      setIsLoadingCode(false);
      setCodeError('Tenant ID is missing.');
      // toast.error('Tenant ID is missing.');
    } else {
      setIsLoadingCode(false);
    }
  }, [tenantId, initialData?.agentCode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'radio' ? value : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (codeError) {
      // toast.error('Cannot submit form due to code generation error.');
      return;
    }
    if (!formData.agentCode) {
      // toast.error('Invalid agent code.');
      return;
    }
    if (!tenantId) {
      // toast.error('Tenant ID is missing.');
      return;
    }
    if (!formData.name) {
      // toast.error('Agent Name is required.');
      return;
    }
    if (!formData.phoneNumber || !/^\d{10}$/.test(formData.phoneNumber)) {
      // toast.error('Phone Number must be a valid 10-digit number.');
      return;
    }
    if (formData.commissionPercentage && (isNaN(Number(formData.commissionPercentage)) || Number(formData.commissionPercentage) < 0 || Number(formData.commissionPercentage) > 100)) {
      // toast.error('Commission Percentage must be a number between 0 and 100.');
      return;
    }

    setIsSubmitting(true);
    try {
      const agentsRef = collection(db, 'TenantsDb', tenantId, collections.AGENTS);
      const agentData = {
        AGENTCODE: formData.agentCode,
        NAME: formData.name,
        ADDRESS: formData.address || '',
        CITY: formData.city || '',
        STATE: formData.state || '',
        PINCODE: formData.pinCode || '',
        PHONENUMBER: formData.phoneNumber,
        COMMISSIONPERCENTAGE: formData.commissionPercentage || '0',
        STATUS: formData.status,
        createdAt: Timestamp.fromDate(new Date()),
      };
      await addDoc(agentsRef, agentData);
      toast.success('Agent data saved successfully!');
      if (onSubmit) {
        onSubmit(formData);
      }
      setFormData({
        agentCode: '',
        name: '',
        address: '',
        city: '',
        state: '',
        pinCode: '',
        phoneNumber: '',
        commissionPercentage: '',
        status: 'active',
      });
      setIsLoadingCode(true);
      setCodeError(null);
      try {
        const newCode = await generateUniqueAgentCode();
        setFormData((prev) => ({ ...prev, agentCode: newCode }));
      } catch (error) {
        console.error('Error generating new agent code after submission:', error);
        setCodeError('Failed to generate new agent code. Please try again.');
        // toast.error('Failed to generate new agent code. Please try again.');
      } finally {
        setIsLoadingCode(false);
      }
    } catch (error) {
      console.error('Error saving agent data:', error);
      // toast.error('Failed to save agent data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
    setFormData({
      agentCode: formData.agentCode,
      name: '',
      address: '',
      city: '',
      state: '',
      pinCode: '',
      phoneNumber: '',
      commissionPercentage: '',
      status: 'active',
    });
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    router.push('/master/agent');
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
      <main className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden p-6 md:p-8">
        <form className="w-full" onSubmit={handleSubmit}>
          <h2 className="text-[#2c5aa0] text-2xl font-semibold mb-6">{page}</h2>
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
                    value={isLoadingCode ? 'Loading...' : formData.agentCode}
                    disabled
                  />
                  {codeError && <p className="text-red-500 text-xs mt-1">{codeError}</p>}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.name}
                    onChange={handleChange}
                    required
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    required
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.commissionPercentage}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.address}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.city}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.state}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.pinCode}
                    onChange={handleChange}
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
                  />
                  Dormant
                </label>
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
                disabled={isSubmitting || isLoadingCode || !!codeError}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default AgentDataForm;