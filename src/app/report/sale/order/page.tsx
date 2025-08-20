"use client";

import React, { useState } from 'react';
import ReportForm from '@/components/ReportFrom'; // Adjusted import to match your file name
import ReportTable from '@/components/ReportTable'; // Adjusted import to match your file name
import { Customer, Product } from '@/types/page';

const SaleOrderPage = () => {
  type ReportParams = {
    reportType: 'Payee' | 'Customer' | 'Vendor' | 'Product' | 'Group';
    payee: string;
    product: string;
    group: string; // Added group field
    startDate: string;
    endDate: string;
    paymentMode: string;
    payees: Customer[];
    products: Product[];
     showMobile: boolean; // New field
    showAddress: boolean;
  };

  const [reportParams, setReportParams] = useState<ReportParams | null>(null);

  const handleSetApply = (params: {
    reportType: 'Payee' | 'Customer' | 'Vendor' | 'Product' | 'Group';
    payee: string;
    product: string;
    group: string; // Added group field
    startDate: string;
    endDate: string;
    paymentMode: string;
    payees: Customer[];
    products: Product[];
  }) => {
    if (['Payee', 'Customer', 'Vendor', 'Product', 'Group'].includes(params.reportType)) {
      setReportParams(params as ReportParams);
    } else {
      setReportParams(null);
    }
  };

  return (
    <div>
      <ReportForm page="Sale Order" setApply={handleSetApply} />
      {reportParams && <ReportTable model="Sale Order" apply={reportParams} />}
    </div>
  );
};

export default SaleOrderPage;