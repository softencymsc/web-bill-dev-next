"use client";
import React from 'react';
import Form from '@/components/Data_Form';
export default function CustomerDataPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <main className="max-w-4xl w-full rounded-md flex flex-col md:flex-row overflow-hidden">
        <Form page={"Vendor"}/>
      </main>
    </div>
  );
}