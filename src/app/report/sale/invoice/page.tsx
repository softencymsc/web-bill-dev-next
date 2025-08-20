"use client";

import React, { useState } from 'react';
import ReportForm from '@/components/ReportFrom'; // Double-check spelling if needed
import ReportTable from '@/components/ReportTable';
import { Customer, Product } from '@/types/page';

const SaleInvoicePage = () => {
  type ReportParams = {
    reportType: 'Payee' | 'Customer' | 'Vendor' | 'Product' | 'Group';
    payee: string;
    product: string;
    group: string;
    startDate: string;
    endDate: string;
    paymentMode: string;
    payees: Customer[];
    products: Product[];
     showMobile: boolean; // New field
    showAddress: boolean;
  };

  const [reportParams, setReportParams] = useState<ReportParams | null>(null);

  const handleSetApply = (params: ReportParams) => {
    if (['Payee', 'Customer', 'Vendor', 'Product', 'Group'].includes(params.reportType)) {
      setReportParams(params);
    } else {
      setReportParams(null);
    }
  };

  return (
    <div>
      <ReportForm page="Sale Bill" setApply={handleSetApply} />
      {reportParams && <ReportTable model="Sale Bill" apply={reportParams} />}
    </div>
  );
};

export default SaleInvoicePage;
