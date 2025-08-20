/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { collection, getDocs, addDoc, Timestamp, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Toaster, toast } from 'react-hot-toast';
import { CounterContext } from "@/lib/CounterContext";
import { getPrefixForModel } from '@/services';
import { collections } from "../config";
import { useRouter } from 'next/navigation';
import debounce from 'lodash/debounce';

interface DataFormProps {
  page: string;
  onSubmit?: (formData: FormData) => void;
}

interface FormData {
  code: string;
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

const DataForm: React.FC<DataFormProps> = ({ page, onSubmit }) => {
  const [formData, setFormData] = useState<FormData>({
    code: '',
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
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const { state, dispatch } = useContext(CounterContext);
  const { products, customerData, tenantId } = state;
  const router = useRouter();

  const generateUniqueCustomerCode = async (): Promise<string> => {
    try {
      const custRef = collection(db, "TenantsDb", tenantId, collections.CUSTOMERS);
      const modelType = page === "Vendor" ? "Vendor" : (page === "Purchase Order" || page === "Purchase Bill" ? "Vendor" : "Customer");
      const custVend = modelType === "Customer" ? "C" : "V";
      const defaultPrefix = modelType === "Customer" ? "CUS" : "VEN";

      let prefix: string;
      try {
        prefix = await getPrefixForModel(tenantId, modelType);
      } catch (error) {
        console.warn(`Prefix not found for ${modelType}, using default: ${defaultPrefix}`, error);
        prefix = defaultPrefix;

        try {
          const docnumRef = doc(db, "TenantsDb", tenantId, "DOCNUM", modelType);
          await setDoc(docnumRef, { prefix }, { merge: true });
          console.log(`Default prefix ${prefix} saved to DOCNUM for ${modelType}`);
        } catch (setError) {
          console.error(`Failed to save default prefix to DOCNUM:`, setError);
        }
      }

      const querySnapshot = await getDocs(custRef);
      let maxCodeNumber = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const custCode = data.CUSTCODE;
        const docCustVend = data.CUST_VEND;

        if (
          typeof custCode === "string" &&
          custCode.startsWith(prefix) &&
          docCustVend === custVend
        ) {
          const codeNumberStr = custCode.replace(prefix, "");
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
      console.error("Error generating customer code:", error);
      throw new Error("Failed to generate customer code");
    }
  };

  const fetchAgents = async () => {
    if (!tenantId) return;
    try {
      const agentsRef = collection(db, "TenantsDb", tenantId, "AGENTS");
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
  }, [tenantId]);

  useEffect(() => {
    const setUniqueCode = async () => {
      setIsLoadingCode(true);
      setCodeError(null);
      try {
        const newCode = await generateUniqueCustomerCode();
        setFormData((prev) => ({ ...prev, code: newCode }));
      } catch (error) {
        console.error('Error generating customer code:', error);
        setCodeError('Failed to generate customer code. Please try again.');
        // toast.error('Failed to generate customer code. Please try again.');
      } finally {
        setIsLoadingCode(false);
      }
    };
    if (state.tenantId) {
      setUniqueCode();
    } else {
      setIsLoadingCode(false);
      setCodeError('Tenant ID is missing.');
      // toast.error('Tenant ID is missing.');
    }
  }, [state.tenantId, page]);

  const debouncedSearchAgents = useCallback(
    debounce(async (searchTerm: string) => {
      if (!searchTerm) {
        setFilteredAgents(agents);
        setShowAgentDropdown(true);
        return;
      }

      const agentsRef = collection(db, "TenantsDb", tenantId, "AGENTS");
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
    [agents, tenantId]
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
      const agentsRef = collection(db, "TenantsDb", tenantId, "AGENTS");
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (codeError) {
      // toast.error('Cannot submit form due to code generation error.');
      return;
    }
    if (!formData.code) {
      // toast.error('Invalid customer code.');
      return;
    }
    if (!state.tenantId) {
      // toast.error('Tenant ID is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const customersRef = collection(db, 'TenantsDb', state.tenantId, 'Customers');
      const customerData = {
        ADDRESS: formData.address || '',
        AGENTCODE: formData.agentCode || '',
        AGENTNAME: formData.agentName || '',
        AccountNo: formData.accountNumber || '0',
        BBranch: formData.branchName || '',
        BankName: formData.bankName || '',
        CITY: formData.city || '',
        CLimite: formData.creditLimit || '0',
        COUNTRY: formData.country || '',
        CPERSON: formData.contactPerson || '',
        CUSTCODE: formData.code,
        CUST_VEND: page.toLowerCase() === 'customer' ? 'C' : 'V',
        GSTIn: formData.gstNumber || '',
        IFSC: formData.ifscCode || '',
        MOBPHONE: formData.mobileNumber || '0',
        NAME: formData.name || '',
        Opening: formData.openingBalance || '0',
        PINCODE: formData.pinCode || '0',
        STATE: formData.state || '',
        MarriageAnniversary: formData.marriageAnniversaryDate
          ? Timestamp.fromDate(new Date(formData.marriageAnniversaryDate))
          : null,
        DOB: formData.dateOfBirth
          ? Timestamp.fromDate(new Date(formData.dateOfBirth))
          : null,
        createdAt: Timestamp.fromDate(new Date()),
      };
      await addDoc(customersRef, customerData);
      toast.success('Customer data saved successfully!');
      if (onSubmit) {
        onSubmit(formData);
      }
      setFormData({
        code: '',
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
      setIsLoadingCode(true);
      setCodeError(null);
      try {
        const newCode = await generateUniqueCustomerCode();
        setFormData((prev) => ({ ...prev, code: newCode }));
      } catch (error) {
        console.error('Error generating new customer code after submission:', error);
        setCodeError('Failed to generate new customer code. Please try again.');
        // toast.error('Failed to generate new customer code. Please try again.');
      } finally {
        setIsLoadingCode(false);
      }
    } catch (error) {
      console.error('Error saving customer data:', error);
      // toast.error('Failed to save customer data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      code: formData.code,
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
    setShowAgentDropdown(false);
  };

  const handleCancel = () => {
    const destination = page === 'Customer' ? '/master/customer' : '/master/vendor';
    router.push(destination);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
      <main className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden p-6 md:p-8">
        <form className="w-full" onSubmit={handleSubmit}>
          <h2 className="text-[#2c5aa0] text-2xl font-semibold mb-6">{page}</h2>
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
                    value={isLoadingCode ? 'Loading...' : (codeError || formData.code)}
                    disabled
                  />
                  {codeError && <p className="text-red-500 text-xs mt-1">{codeError}</p>}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.name}
                    onChange={handleChange}
                    required
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.contactPerson}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="marriageAnniversaryDate" className="text-gray-600 text-sm font-medium mb-1 block">
                    Anniversary Date
                  </label>
                  <input
                    type="date"
                    id="marriageAnniversaryDate"
                    name="marriageAnniversaryDate"
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.marriageAnniversaryDate}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.agentCode}
                    onChange={handleAgentChange}
                    onFocus={() => setShowAgentDropdown(true)}
                    autoComplete="off"
                  />
                  {showAgentDropdown && (
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.agentName}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.agentPhoneNumber}
                    onChange={handleChange}
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
                <div>
                  <label htmlFor="country" className="text-gray-600 text-sm font-medium mb-1 block">
                    Country
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    placeholder="Country"
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.country}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.gstNumber}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.bankName}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.accountNumber}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.branchName}
                    onChange={handleChange}
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
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.ifscCode}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="openingBalance" className="text-gray-600 text-sm font-medium mb-1 block">
                    Opening Balance
                  </label>
                  <input
                    type="text"
                    id="openingBalance"
                    name="openingBalance"
                    placeholder="Opening Balance"
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.openingBalance}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="creditLimit" className="text-gray-600 text-sm font-medium mb-1 block">
                    Credit Limit
                  </label>
                  <input
                    type="text"
                    id="creditLimit"
                    name="creditLimit"
                    placeholder="Credit Limit"
                    className="w-full border-b border-gray-300 text-gray-600 text-sm py-2 focus:outline-none focus:border-[#2c5aa0]"
                    value={formData.creditLimit}
                    onChange={handleChange}
                  />
                </div>
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

export default DataForm;