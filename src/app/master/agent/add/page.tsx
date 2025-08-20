"use client";
import React, { useState } from 'react';
import AgentDataForm from '@/components/AgentDataForm';
import { useRouter } from 'next/navigation';

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

export default function AgentDataPage() {
  const [formData, setFormData] = useState<AgentFormData>({
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
  const router = useRouter();

  const handleFormSubmit = (data: AgentFormData) => {
    console.log('Received agent form data:', data);
    // Add logic here to save to AGENT collection in Firebase
    // Example: saveToFirebase('AGENT', data);
    router.push('/master/agent');
  };

  const handleReset = () => {
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
  };

  const handleCancel = () => {
    console.log('Form cancelled');
    router.push('/master/agent');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <main className="max-w-4xl w-full rounded-md flex flex-col md:flex-row overflow-hidden">
        <AgentDataForm 
          page="Agent" 
          onSubmit={handleFormSubmit} 
          onReset={handleReset} 
          onCancel={handleCancel}
          initialData={formData}
        />
      </main>
    </div>
  );
}