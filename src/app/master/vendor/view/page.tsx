/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, Suspense, useContext, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { CounterContext } from "@/lib/CounterContext";
import debounce from 'lodash/debounce';

interface FormData {
  name: string;
  contactPerson: string;
  mobileNumber: string;
  agentCode: string;
  agentName: string;
  agentPhoneNumber: string;
  gstNumber: string;
  marriageAnniversaryDate: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  phoneNumber: string;
  bankName: string;
  accountNumber: string;
  branchName: string;
  ifscCode: string;
  openingBalance: string;
  creditLimit: string;
  acceptTerms: boolean;
}

interface Agent {
  AGENTCODE: string;
  NAME: string;
  PHONENUMBER: string;
  ADDRESS: string;
  CITY: string;
  STATE: string;
  PINCODE: string;
  COMMISSIONPERCENTAGE: string;
  STATUS: string;
}

function VendorFormInner() {
  const page = "Vendor";
  const searchParams = useSearchParams();
  const id = searchParams?.get('id'); // e.g., "VEN001"
  const { state } = useContext(CounterContext);
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    contactPerson: '',
    mobileNumber: '',
    agentCode: '',
    agentName: '',
    agentPhoneNumber: '',
    gstNumber: '',
    marriageAnniversaryDate: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    country: '',
    phoneNumber: '',
    bankName: '',
    accountNumber: '',
    branchName: '',
    ifscCode: '',
    openingBalance: '',
    creditLimit: '',
    acceptTerms: false,
  });

  const [originalFormData, setOriginalFormData] = useState<FormData>(formData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  const isValidIdFormat = (id: string | null): boolean => {
    if (!id) return false;
    return /^VEN\d+$/.test(id);
  };

  const fetchAgents = async () => {
    if (!state.tenantId) return;
    try {
      const agentsRef = collection(db, "TenantsDb", state.tenantId, "AGENTS");
      const querySnapshot = await getDocs(agentsRef);
      const agentsData: Agent[] = [];
      querySnapshot.forEach((doc) => {
        agentsData.push(doc.data() as Agent);
      });
      setAgents(agentsData);
      setFilteredAgents(agentsData);
    } catch (error) {
      console.error("Error fetching agents:", error);
      // toast.error("Failed to fetch agents.");
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [state.tenantId]);

  useEffect(() => {
    if (!id || !isValidIdFormat(id)) {
      setCodeError('Invalid Vendor ID format. Expected format: VEN followed by digits (e.g., VEN001)');
      setIsLoadingCode(false);
      return;
    }

    const fetchVendorData = async () => {
      setIsLoadingCode(true);
      setCodeError('');
      try {
        const vendorsRef = collection(db, 'TenantsDb', state.tenantId, 'Customers');
        const q = query(vendorsRef, where('CUSTCODE', '==', id));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setCodeError('No vendor found with this ID');
          // toast.error('No vendor found with this ID');
          return;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        const fetchedData = {
          name: data.NAME || '',
          contactPerson: data.CPERSON || '',
          mobileNumber: data.MOBPHONE || '',
          agentCode: data.AGENTCODE || '',
          agentName: data.AGENTNAME || '',
          agentPhoneNumber: data.PHONE_NUMBER || '',
          gstNumber: data.GSTIn || '',
          marriageAnniversaryDate: data.MARRIAGE_ANNIVERSARY_DATE || '',
          dateOfBirth: data.DATE_OF_BIRTH || '',
          address: data.ADDRESS || '',
          city: data.CITY || '',
          state: data.STATE || '',
          pinCode: data.PINCODE || '',
          country: data.COUNTRY || '',
          phoneNumber: data.PHONE_NUMBER || '',
          bankName: data.BankName || '',
          accountNumber: data.AccountNo || '',
          branchName: data.BBranch || '',
          ifscCode: data.IFSC || '',
          openingBalance: data.Opening || '',
          creditLimit: data.CLimite || '',
          acceptTerms: data.ACCEPT_TERMS || false,
        };

        setFormData(fetchedData);
        setOriginalFormData(fetchedData);
        setDocId(doc.id);
      } catch (error) {
        console.error('Error fetching vendor data:', error);
        setCodeError('Failed to fetch vendor data');
        // toast.error('Failed to fetch vendor data');
      } finally {
        setIsLoadingCode(false);
      }
    };

    fetchVendorData();
  }, [id, state.tenantId]);

  const debouncedSearchAgents = useCallback(
    debounce(async (searchTerm: string) => {
      if (!searchTerm) {
        setFilteredAgents(agents);
        setShowAgentDropdown(true);
        return;
      }

      const agentsRef = collection(db, "TenantsDb", state.tenantId, "AGENTS");
      const q = query(
        agentsRef,
        where("AGENTCODE", ">=", searchTerm.toUpperCase()),
        where("AGENTCODE", "<=", searchTerm.toUpperCase() + '\uf8ff')
      );
      try {
        const querySnapshot = await getDocs(q);
        const matchedAgents: Agent[] = [];
        querySnapshot.forEach((doc) => {
          matchedAgents.push(doc.data() as Agent);
        });
        setFilteredAgents(matchedAgents);
        setShowAgentDropdown(true);
      } catch (error) {
        console.error("Error searching agents:", error);
        // toast.error("Failed to search agents.");
      }
    }, 300),
    [agents, state.tenantId]
  );

  const handleAgentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      agentCode: value,
      agentName: '',
      agentPhoneNumber: '',
    }));
    debouncedSearchAgents(value);
  };

  const selectAgent = (agent: Agent) => {
    setFormData((prev) => ({
      ...prev,
      agentCode: agent.AGENTCODE,
      agentName: agent.NAME,
      agentPhoneNumber: agent.PHONENUMBER,
    }));
    setShowAgentDropdown(false);
  };

  const saveNewAgent = async () => {
    if (!formData.agentCode || !formData.agentName || !formData.agentPhoneNumber) {
      // toast.error("Please provide agent code, name, and phone number.");
      return;
    }

    try {
      const agentsRef = collection(db, "TenantsDb", state.tenantId, "AGENTS");
      const newAgent = {
        AGENTCODE: formData.agentCode.toUpperCase(),
        NAME: formData.agentName,
        PHONENUMBER: formData.agentPhoneNumber,
        ADDRESS: "",
        CITY: "",
        STATE: "",
        PINCODE: "",
        COMMISSIONPERCENTAGE: "0",
        STATUS: "active",
        createdAt: Timestamp.fromDate(new Date()),
      };
      await addDoc(agentsRef, newAgent);
      toast.success("New agent saved successfully!");
      setAgents([...agents, newAgent]);
      setFilteredAgents([...agents, newAgent]);
      setShowAgentDropdown(false);
    } catch (error) {
      console.error("Error saving new agent:", error);
      // toast.error("Failed to save new agent.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const isCancel = () => {
    router.push('/master/vendor');
  };

  const handleReset = () => {
    setFormData(originalFormData);
    setIsEditing(false);
    setShowAgentDropdown(false);
  };

  const handleEditToggle = () => {
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!id || !isValidIdFormat(id)) {
      // toast.error('Invalid vendor ID');
      return;
    }

    if (!formData.name || !formData.mobileNumber) {
      // toast.error('Name and Mobile Number are required');
      return;
    }

    if (!/^\d{10}$/.test(formData.mobileNumber)) {
      // toast.error('Mobile Number must be 10 digits');
      return;
    }

    if (!docId) {
      // toast.error('No vendor document found to update');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        NAME: formData.name,
        CPERSON: formData.contactPerson,
        MOBPHONE: formData.mobileNumber,
        AGENTCODE: formData.agentCode,
        AGENTNAME: formData.agentName,
        PHONE_NUMBER: formData.agentPhoneNumber,
        GSTIn: formData.gstNumber,
        MARRIAGE_ANNIVERSARY_DATE: formData.marriageAnniversaryDate,
        DATE_OF_BIRTH: formData.dateOfBirth,
        ADDRESS: formData.address,
        CITY: formData.city,
        STATE: formData.state,
        PINCODE: formData.pinCode,
        COUNTRY: formData.country,
        BankName: formData.bankName,
        AccountNo: formData.accountNumber,
        BBranch: formData.branchName,
        IFSC: formData.ifscCode,
        Opening: formData.openingBalance,
        CLimite: formData.creditLimit,
        ACCEPT_TERMS: formData.acceptTerms,
      };

      const docRef = doc(db, 'TenantsDb', state.tenantId, 'Customers', docId);
      await updateDoc(docRef, updateData);

      toast.success('Vendor data updated successfully');
      setOriginalFormData(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating vendor data:', error);
      // toast.error('Failed to update vendor data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
      <main className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden p-6 md:p-8">
        <form className="w-full" onSubmit={(e) => e.preventDefault()}>
          <Toaster />
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[#2c5aa0] text-xl font-semibold">{page}</h2>
            <div className="flex justify-end gap-4">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={isCancel}
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
          {isLoadingCode && <div className="text-center">Loading vendor data...</div>}
          {codeError && <div className="text-red-500 text-center mb-4">{codeError}</div>}
          {!isLoadingCode && !codeError && (
            <div className="grid gap-6">
              {/* Personal Details */}
              <div>
                <h3 className="text-[#2c5aa0] text-lg font-semibold mb-4">Personal Details</h3>
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
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={id || 'No ID'}
                      disabled
                    />
                  </div>
                  <div>
                    <label htmlFor="name" className="text-gray-600 text-sm font-medium mb-1 block">
                      {page} Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder={`${page} Name`}
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="contactPerson" className="text-gray-600 text-sm font-medium mb-1 block">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      id="contactPerson"
                      name="contactPerson"
                      placeholder="Contact Person"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.contactPerson}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="mobileNumber" className="text-gray-600 text-sm font-medium mb-1 block">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="mobileNumber"
                      name="mobileNumber"
                      placeholder="Mobile Number"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      required
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="marriageAnniversaryDate" className="text-gray-600 text-sm font-medium mb-1 block">
                      Marriage Anniversary Date
                    </label>
                    <input
                      type="date"
                      id="marriageAnniversaryDate"
                      name="marriageAnniversaryDate"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.marriageAnniversaryDate}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="dateOfBirth" className="text-gray-600 text-sm font-medium mb-1 block">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      id="dateOfBirth"
                      name="dateOfBirth"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              {/* Agent Details */}
              <div>
                <h3 className="text-[#2c5aa0] text-lg font-semibold mb-4">Agent Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <label htmlFor="agentCode" className="text-gray-600 text-sm font-medium mb-1 block">
                      Agent Code
                    </label>
                    <input
                      type="text"
                      id="agentCode"
                      name="agentCode"
                      placeholder="Agent Code"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.agentCode}
                      onChange={handleAgentChange}
                      onFocus={() => isEditing && setShowAgentDropdown(true)}
                      disabled={!isEditing}
                      autoComplete="off"
                    />
                    {showAgentDropdown && isEditing && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredAgents.length > 0 ? (
                          filteredAgents.map((agent) => (
                            <div
                              key={agent.AGENTCODE}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => selectAgent(agent)}
                            >
                              <p className="text-sm font-medium">{agent.AGENTCODE}</p>
                              <p className="text-xs text-gray-600">{agent.NAME} - {agent.PHONENUMBER}</p>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-2">
                            <p className="text-sm text-gray-600">No agents found</p>
                            <button
                              type="button"
                              onClick={saveNewAgent}
                              className="mt-2 px-4 py-1 bg-[#2c5aa0] text-white text-sm rounded hover:bg-[#1e3a6b]"
                            >
                              Add New Agent
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="agentName" className="text-gray-600 text-sm font-medium mb-1 block">
                      Agent Name
                    </label>
                    <input
                      type="text"
                      id="agentName"
                      name="agentName"
                      placeholder="Agent Name"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.agentName}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="agentPhoneNumber" className="text-gray-600 text-sm font-medium mb-1 block">
                      Agent Phone Number
                    </label>
                    <input
                      type="text"
                      id="agentPhoneNumber"
                      name="agentPhoneNumber"
                      placeholder="Agent Phone Number"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.agentPhoneNumber}
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
                  <div>
                    <label htmlFor="country" className="text-gray-600 text-sm font-medium mb-1 block">
                      Country
                    </label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      placeholder="Country"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.country}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              {/* Tax Details */}
              <div>
                <h3 className="text-[#2c5aa0] text-lg font-semibold mb-4">Tax Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="gstNumber" className="text-gray-600 text-sm font-medium mb-1 block">
                      GST Number
                    </label>
                    <input
                      type="text"
                      id="gstNumber"
                      name="gstNumber"
                      placeholder="GST Number"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <h3 className="text-[#2c5aa0] text-lg font-semibold mb-4">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="bankName" className="text-gray-600 text-sm font-medium mb-1 block">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      id="bankName"
                      name="bankName"
                      placeholder="Bank Name"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.bankName}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="accountNumber" className="text-gray-600 text-sm font-medium mb-1 block">
                      Account Number
                    </label>
                    <input
                      type="text"
                      id="accountNumber"
                      name="accountNumber"
                      placeholder="Account Number"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="branchName" className="text-gray-600 text-sm font-medium mb-1 block">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      id="branchName"
                      name="branchName"
                      placeholder="Branch Name"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.branchName}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="ifscCode" className="text-gray-600 text-sm font-medium mb-1 block">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      id="ifscCode"
                      name="ifscCode"
                      placeholder="IFSC Code"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.ifscCode}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="openingBalance" className="text-gray-600 text-sm font-medium mb-1 block">
                      Opening Balance
                    </label>
                    <input
                      type="number"
                      id="openingBalance"
                      name="openingBalance"
                      placeholder="Opening Balance"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.openingBalance}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label htmlFor="creditLimit" className="text-gray-600 text-sm font-medium mb-1 block">
                      Credit Limit
                    </label>
                    <input
                      type="number"
                      id="creditLimit"
                      name="creditLimit"
                      placeholder="Credit Limit"
                      className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0] disabled:bg-gray-50"
                      value={formData.creditLimit}
                      onChange={handleChange}
                      disabled={!isEditing}
                    />
                  </div>
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
    <VendorFormInner />
  </Suspense>
);

export default Page;