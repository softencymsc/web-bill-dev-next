"use client";
import React from 'react';
import JournalForm from '@/components/ui/journalfrom';

export default function JournalDataPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <main className="max-w-6xl w-full rounded-md flex flex-col md:flex-row overflow-hidden">
        <JournalForm page="Journal" />
      </main>
    </div>
  );
}