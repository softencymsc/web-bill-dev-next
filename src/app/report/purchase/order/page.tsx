"use client";

import React, { useState } from 'react';
import ReportFrom from '@/components/ReportFrom';
import ReportTable from '@/components/ReportTable';
import type { Customer, Product } from '@/types/page';

type AllowedReportType = "Payee" | "Customer" | "Vendor" | "Product" | "Group";

type ReportParams = {
  reportType: AllowedReportType;
  payee: string;
  product: string;
  group: string; // ✅ added
  startDate: string;
  endDate: string;
  paymentMode: string;
  payees: Customer[];
  products: Product[];
   showMobile: boolean; // New field
    showAddress: boolean;
};

const PurchaseOrderRep = () => {
  const [reportParams, setReportParams] = useState<ReportParams | null>(null);

  const handleSetApply = (params: ReportParams | { reportType: string }) => {
    if (["Payee", "Customer", "Vendor", "Product", "Group"].includes(params.reportType)) {
      setReportParams(params as ReportParams);
    } else {
      setReportParams(null);
    }
  };

  return (
    <div>
      <ReportFrom page="Purchase Order" setApply={handleSetApply} />
      {reportParams && <ReportTable model="Purchase Order" apply={reportParams} />}
    </div>
  );
};

export default PurchaseOrderRep;
