/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState } from 'react';
import ReportFrom from '@/components/ReportFrom';
import VoucherReportTable from '@/components/VoucherReportTable';
import type { Customer, Product } from '@/types/page'; // Adjust the import path as needed

// Define ReportParams to match ReportForm's setApply parameter type
type ReportParams = {
  reportType: "Payee" | "Customer" | "Vendor" | "Product" | "Group";
  payee: string;
  product: string;
  group: string;
  startDate: string;
  endDate: string;
  paymentMode: string;
  payees: Customer[];
  products: Product[];
  showMobile: boolean;
  showAddress: boolean;
};

// Define VoucherReportTableProps to match VoucherReportTable's expected apply prop
type VoucherReportTableProps = {
  reportType: "Payee" | "TransactionType";
  payee: string;
  startDate: string;
  endDate: string;
  paymentMode: string;
  payees: Customer[];
};

const VoucherInvoice = () => {
  const [reportParams, setReportParams] = useState<ReportParams | null>(null);

  // Transform ReportParams to VoucherReportTableProps
  const transformParams = (params: ReportParams): VoucherReportTableProps | null => {
    // Only allow "Payee" or map "Customer"/"Vendor" to "Payee" if appropriate
    if (params.reportType === "Payee" || params.reportType === "Customer" || params.reportType === "Vendor") {
      return {
        reportType: "Payee", // Map Customer/Vendor to Payee for VoucherReportTable
        payee: params.payee,
        startDate: params.startDate,
        endDate: params.endDate,
        paymentMode: params.paymentMode,
        payees: params.payees,
      };
    }
    // TransactionType could be supported if VoucherReportTable allows it
    // For now, return null for unsupported types (Product, Group)
    console.warn(`Unsupported reportType for VoucherReportTable: ${params.reportType}`);
    return null;
  };

  return (
    <div>
      <ReportFrom
        page="Voucher"
        setApply={(params: {
          reportType: "Payee" | "Customer" | "Vendor" | "Product" | "Group";
          payee: string;
          product: string;
          group: string;
          startDate: string;
          endDate: string;
          paymentMode: string;
          payees: Customer[];
          products: Product[];
          showMobile: boolean;
          showAddress: boolean;
        }) => {
          setReportParams(params);
        }}
      />
      {reportParams && (
        // Only render VoucherReportTable if transformed params are valid
        (() => {
          const transformedParams = transformParams(reportParams);
          return transformedParams ? <VoucherReportTable apply={transformedParams} /> : null;
        })()
      )}
    </div>
  );
};

export default VoucherInvoice;