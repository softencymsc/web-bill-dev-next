"use client";
import React from 'react';
import LedgerForm from '@/components/Ledger_Form';

export default function CustomerDataPage() {

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <main className="max-w-4xl w-full rounded-md flex flex-col md:flex-row overflow-hidden">
        <LedgerForm page="Ledger" />
      </main>
    </div>
  );
}