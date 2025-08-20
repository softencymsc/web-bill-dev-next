"use client";
import React from 'react';
import DataForm from '@/components/Data_Form';

interface FormData {
  code: string;
  name: string;
  contactPerson: string;
  mobileNumber: string;
  agentCode: string;
  agentName: string;
  gstNumber: string;
  marriageAnniversaryDate: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  phoneCode: string;
  phoneNumber: string;
  bankName: string;
  accountNumber: string;
  branchName: string;
  ifscCode: string;
  openingBalance: string;
  creditLimit: string;
  acceptTerms: boolean;
}

export default function CustomerDataPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFormSubmit = (formData: FormData) => {
    console.log('Received form data in parent:', formData);
    // Add logic here to handle form data (e.g., save to Firebase, update state, etc.)
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <main className="max-w-4xl w-full rounded-md flex flex-col md:flex-row overflow-hidden">
        <DataForm page="Customer" />
      </main>
    </div>
  );
}