/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { db } from '../../firebase';
import { CounterContext } from '@/lib/CounterContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Customer, Product } from '@/types/page';
import { CreditCardIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { FaCashRegister, FaCaretRight, FaCalendarDay, FaBox, FaUser } from 'react-icons/fa6';
import { toast } from 'react-toastify';

// Utility function for safe number conversion
const safeNumber = (value: any, fallback: number = 0): number => {
  if (value == null) return fallback;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? fallback : num;
};

// Define interfaces for data structures
interface Bill {
  id: string;
  BILL_NO?: string;
  OA_NO?: string;
  BILL_DATE?: string | { seconds: number; nanoseconds: number };
  OA_DATE?: string | { seconds: number; nanoseconds: number };
  CUSTNAME?: string;
  VENDOR_NAME?: string;
  CUST_CODE?: string;
  BASIC?: number | string;
  BASE_AMOUNT?: number | string;
  PROMO_DISCOUNT?: number | string;
  GST_AMOUNT?: number | string;
  GST_AMT?: number | string;
  NET_AMOUNT?: number | string;
  NET_AMT?: number | string;
  ADV_AMOUNT?: number | string;
  CASH_AMOUNT?: number | string;
  UPI_AMOUNT?: number | string;
  TOTAL_UPI_AMOUNT?: number | string;
  CREDIT_AMOUNT?: number | string;
}

interface BillDetail {
  id: string;
  BILL_NO?: string;
  OA_NO?: string;
  BILL_DATE?: string | { seconds: number; nanoseconds: number };
  OA_DATE?: string | { seconds: number; nanoseconds: number };
  CUSTNAME?: string;
  VENDOR_NAME?: string;
  PRODCODE?: string;
  PRODNAME?: string;
  SGroupDesc?: string;
  UOM?: string;
  RATE?: number | string;
  AMOUNT?: number | string;
  QUANTITY?: number;
  DISCOUNT_PERCENT?: number | string;
  DISCOUNT_AMT?: number | string;
  GST_RATE?: number | string;
  SGST?: number | string;
  CGST?: number | string;
  GSTAMT?: number | string;
  TOTALAMT?: number | string;
}

interface CounterContextType {
  state: {
    currency: string;
    tenantId: string;
  };
}

interface GeneralReportTableProps {
  model: 'Sale Bill' | 'Sale Order' | 'Purchase Order' | 'Purchase Bill';
  apply: {
    reportType: 'Payee' | 'Customer' | 'Vendor' | 'Product' | 'Group';
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
  } | null;
}

const GeneralReportTable: React.FC<GeneralReportTableProps> = ({ model, apply }) => {
  const [collections, setCollections] = useState<{ col1: string; col2?: string }>({ col1: '', col2: '' });
  const [billData, setBillData] = useState<Bill[]>([]);
  const [billDetailData, setBillDetailData] = useState<BillDetail[]>([]);
  const { state } = useContext(CounterContext) as CounterContextType;

  const reportType = apply?.reportType ?? 'Payee';
  const selectedPayee = apply?.payee ?? 'All';
  const selectedProduct = apply?.product ?? 'All';
  const selectedGroup = apply?.group ?? 'All';
  const showMobile = apply?.showMobile ?? false;
  const showAddress = apply?.showAddress ?? false;
  const isPurchaseModel = model === 'Purchase Order' || model === 'Purchase Bill';
  const isSummary = reportType === 'Customer' || reportType === 'Vendor';
  const currency = state.currency;

  useEffect(() => {
    if (apply && state.tenantId) {
      const startDate = apply.startDate;
      const endDate = apply.endDate;

      if (!startDate || !endDate) return;

      const fromDate = new Date(startDate);
      const toDate = new Date(endDate);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return;

      let col1 = '';
      let col2 = '';
      let col1DateField = '';
      let col2DateField = '';

      switch (model) {
        case 'Sale Bill':
          col1 = 'BILL';
          col2 = 'BILLDET';
          col1DateField = 'BILL_DATE';
          col2DateField = 'BILL_DATE';
          break;
        case 'Sale Order':
          col1 = 'ORDER';
          col2 = 'ORDERDET';
          col1DateField = 'OA_DATE';
          col2DateField = 'OA_DATE';
          break;
        case 'Purchase Order':
          col1 = 'PORDER';
          col2 = 'PORDERDET';
          col1DateField = 'BILL_DATE';
          col2DateField = 'BILL_DATE';
          break;
        case 'Purchase Bill':
          col1 = 'BILLIN';
          col2 = 'BLLINDET';
          col1DateField = 'BILL_DATE';
          col2DateField = 'BILL_DATE';
          break;
      }

      setCollections({ col1, col2 });
      fetchReportData(state.tenantId, fromDate, toDate, col1, col2, col1DateField, col2DateField, apply);
    }
  }, [apply, model, state.tenantId]);

  const fetchReportData = async (
    tenantId: string,
    fromDate: Date,
    toDate: Date,
    col1: string,
    col2: string,
    col1DateField: string,
    col2DateField: string,
    filters: GeneralReportTableProps['apply']
  ) => {
    if (!filters) return;
    try {
      const adjustedToDate = new Date(toDate);
      adjustedToDate.setHours(23, 59, 59, 999);

      let col1Ref = collection(db, `TenantsDb/${tenantId}/${col1}`);
      let col1Query = query(col1Ref, where(col1DateField, '>=', fromDate), where(col1DateField, '<=', adjustedToDate));

      if (filters.paymentMode !== 'All' && col1 !== 'PORDER') {
        col1Query = query(col1Query, where('PAY_MODE', '==', filters.paymentMode));
      }
      if (filters.payee !== 'All') {
        const filterField = isPurchaseModel ? 'VENDOR_NAME' : 'CUSTNAME';
        const payeeArray = filters.payee.split(',').map((p) => p.trim());
        if (payeeArray.length > 0 && payeeArray.length <= 10) {
          col1Query = query(col1Query, where(filterField, 'in', payeeArray));
        }
      }

      const col1Snap = await getDocs(col1Query);
      const col1Data: Bill[] = col1Snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      let col2Data: BillDetail[] = [];
      if (col2) {
        let col2Ref = collection(db, `TenantsDb/${tenantId}/${col2}`);
        let col2Query = query(col2Ref, where(col2DateField, '>=', fromDate), where(col2DateField, '<=', adjustedToDate));

        if (filters.payee !== 'All') {
          const filterField = isPurchaseModel ? 'VENDOR_NAME' : 'CUSTNAME';
          const payeeArray = filters.payee.split(',').map((p) => p.trim());
          if (payeeArray.length > 0 && payeeArray.length <= 10) {
            col2Query = query(col2Query, where(filterField, 'in', payeeArray));
          }
        }
        if (filters.product !== 'All' && filters.reportType === 'Product') {
          const productArray = filters.product.split(',').map((p) => p.trim());
          if (productArray.length > 0 && productArray.length <= 10) {
            col2Query = query(col2Query, where('PRODNAME', 'in', productArray));
          }
        }
        if (filters.group !== 'All') {
          const groupArray = filters.group.split(',').map((g) => g.trim());
          if (groupArray.length > 0 && groupArray.length <= 10) {
            col2Query = query(col2Query, where('SGroupDesc', 'in', groupArray));
          }
        }

        const col2Snap = await getDocs(col2Query);
        col2Data = col2Snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      setBillData(col1Data);
      setBillDetailData(col2Data);
    } catch (error) {
      console.error('Failed to fetch report data', error);
    }
  };

  // Calculate totals
  const totalBasic = billData.reduce(
    (sum, bill) =>
      sum + safeNumber(model === 'Sale Order' ? bill.BASE_AMOUNT : bill.BASIC),
    0
  );
  const totalGST = billData.reduce(
    (sum, bill) =>
      sum +
      safeNumber(
        model === 'Sale Order' ? bill.ADV_AMOUNT : bill.GST_AMOUNT ?? bill.GST_AMT
      ),
    0
  );
  const totalNet = billData.reduce(
    (sum, bill) => sum + safeNumber(bill.NET_AMOUNT ?? bill.NET_AMT),
    0
  );
  const totalQuantity = billDetailData.reduce(
    (sum, detail) => sum + safeNumber(detail.QUANTITY),
    0
  );
  const totalCash = billData.reduce(
    (sum, bill) => sum + safeNumber(bill.CASH_AMOUNT),
    0
  );
  const totalUPI = billData.reduce(
    (sum, bill) => sum + safeNumber(bill.UPI_AMOUNT ?? bill.TOTAL_UPI_AMOUNT),
    0
  );
  const totalCredit = billData.reduce(
    (sum, bill) => sum + safeNumber(bill.CREDIT_AMOUNT),
    0
  );

  // Moved formatDate above the insights calculations
  const formatDate = (date?: string | { seconds: number; nanoseconds: number }): string => {
    if (!date) return 'N/A';
    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return new Date(date.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // New Insights Calculations
  const topSaleDay = (() => {
    const salesByDay = billData.reduce((acc, bill) => {
      const date = formatDate(bill.BILL_DATE ?? bill.OA_DATE);
      const netAmount = safeNumber(bill.NET_AMOUNT ?? bill.NET_AMT);
      acc[date] = (acc[date] || 0) + netAmount;
      return acc;
    }, {} as { [key: string]: number });
    const topDay = Object.entries(salesByDay).reduce(
      (max, [date, amount]) => (amount > max.amount ? { date, amount } : max),
      { date: 'N/A', amount: 0 }
    );
    return topDay;
  })();

  const topSaleProduct = (() => {
    const salesByProduct = billDetailData.reduce((acc, detail) => {
      const product = detail.PRODNAME ?? 'Unknown';
      const totalAmt = safeNumber(detail.TOTALAMT);
      acc[product] = (acc[product] || 0) + totalAmt;
      return acc;
    }, {} as { [key: string]: number });
    const topProduct = Object.entries(salesByProduct).reduce(
      (max, [product, amount]) => (amount > max.amount ? { product, amount } : max),
      { product: 'N/A', amount: 0 }
    );
    return topProduct;
  })();

  const topSaleCustomer = (() => {
    const salesByCustomer = billData.reduce((acc, bill) => {
      const customer = bill.CUSTNAME ?? bill.VENDOR_NAME ?? 'Unknown';
      const netAmount = safeNumber(bill.NET_AMOUNT ?? bill.NET_AMT);
      acc[customer] = (acc[customer] || 0) + netAmount;
      return acc;
    }, {} as { [key: string]: number });
    const topCustomer = Object.entries(salesByCustomer).reduce(
      (max, [customer, amount]) => (amount > max.amount ? { customer, amount } : max),
      { customer: 'N/A', amount: 0 }
    );
    return topCustomer;
  })();

  const getHeaders = (): string[] => {
    const baseHeaders = isSummary
      ? [
          model === 'Sale Order' || model === 'Purchase Order' ? 'Order No' : 'Bill No',
          'Date',
          ...(selectedPayee === 'All' ? [isPurchaseModel ? 'Vendor Name' : 'Customer Name'] : []),
          ...(showMobile && selectedPayee === 'All' ? ['Mobile No'] : []),
          ...(showAddress && selectedPayee === 'All' ? ['Address'] : []),
          'Basic',
          'Discount Amount',
          'Taxable',
          'GST Amount',
          'Total Amount',
        ]
      : [
          model === 'Sale Order' || model === 'Purchase Order' ? 'Order No' : 'Bill No',
          'Date',
          ...(selectedPayee === 'All' ? ['Cust Code', isPurchaseModel ? 'Vendor Name' : 'Customer Name'] : []),
          ...(showMobile && selectedPayee === 'All' ? ['Mobile No'] : []),
          ...(showAddress && selectedPayee === 'All' ? ['Address'] : []),
          ...(selectedProduct === 'All' ? ['Product Code', 'Descript'] : []),
          'UOM',
          'Rate',
          'Basic',
          'Discount (%)',
          'Discount Amt',
          'GST Rate',
          'SGST',
          'CGST',
          'Total GST',
          'Total Amount',
        ];
    return baseHeaders;
  };

  const getRows = (data: Bill[] | BillDetail[], customer?: string, product?: string, group?: string): (string | number)[][] => {
    let rows: (string | number)[][] = [];

    if (isSummary) {
      rows = (data as Bill[])
        .filter((bill) => !customer || (bill.CUSTNAME ?? bill.VENDOR_NAME) === customer)
        .map((bill) => {
          const basic = safeNumber(model === 'Sale Order' ? bill.BASE_AMOUNT : bill.BASIC);
          const discount = safeNumber(bill.PROMO_DISCOUNT);
          const taxable = basic - discount;
          const gst = safeNumber(
            model === 'Sale Order' ? bill.ADV_AMOUNT : bill.GST_AMOUNT ?? bill.GST_AMT
          );
          const net = safeNumber(bill.NET_AMOUNT ?? bill.NET_AMT);
          const payee = apply?.payees.find(
            (c) => c.NAME === (bill.CUSTNAME ?? bill.VENDOR_NAME)
          );

          return [
            bill.BILL_NO ?? bill.OA_NO ?? 'N/A',
            formatDate(bill.BILL_DATE ?? bill.OA_DATE),
            ...(selectedPayee === 'All' ? [bill.CUSTNAME ?? bill.VENDOR_NAME ?? 'N/A'] : []),
            ...(showMobile && selectedPayee === 'All' ? [payee?.MOBPHONE ?? 'N/A'] : []),
            ...(showAddress && selectedPayee === 'All' ? [payee?.ADDRESS ?? 'N/A'] : []),
            basic.toFixed(2),
            discount.toFixed(2),
            taxable.toFixed(2),
            gst.toFixed(2),
            net.toFixed(2),
          ];
        });
    } else {
      rows = (data as BillDetail[])
        .filter((detail) => !customer || (detail.CUSTNAME ?? detail.VENDOR_NAME) === customer)
        .filter((detail) => !product || detail.PRODNAME === product)
        .filter((detail) => !group || detail.SGroupDesc === group)
        .map((detail) => {
          const bill = billData.find((b) => (b.BILL_NO ?? b.OA_NO) === (detail.BILL_NO ?? detail.OA_NO));
          if (!bill) return [];
          const amount = safeNumber(detail.AMOUNT);
          const discountAmt = safeNumber(detail.DISCOUNT_AMT);
          const gstAmt = safeNumber(detail.GSTAMT);
          const totalAmt = safeNumber(detail.TOTALAMT);
          const rate = safeNumber(detail.RATE);
          const discountPercent = safeNumber(detail.DISCOUNT_PERCENT);
          const gstRate = safeNumber(detail.GST_RATE);
          const sgst = safeNumber(detail.SGST ?? (gstAmt / 2));
          const cgst = safeNumber(detail.CGST ?? (gstAmt / 2));
          const payee = apply?.payees.find(
            (c) => c.NAME === (bill.CUSTNAME ?? bill.VENDOR_NAME)
          );

          return [
            detail.BILL_NO ?? detail.OA_NO ?? 'N/A',
            formatDate(detail.BILL_DATE ?? detail.OA_DATE),
            ...(selectedPayee === 'All' ? [bill.CUST_CODE ?? 'N/A', bill.CUSTNAME ?? bill.VENDOR_NAME ?? 'N/A'] : []),
            ...(showMobile && selectedPayee === 'All' ? [payee?.MOBPHONE ?? 'N/A'] : []),
            ...(showAddress && selectedPayee === 'All' ? [payee?.ADDRESS ?? 'N/A'] : []),
            ...(selectedProduct === 'All' ? [detail.PRODCODE ?? 'N/A', detail.PRODNAME ?? 'N/A'] : []),
            detail.UOM ?? 'N/A',
            rate.toFixed(2),
            amount.toFixed(2),
            discountPercent.toString(),
            discountAmt.toFixed(2),
            gstRate.toString(),
            sgst.toFixed(2),
            cgst.toFixed(2),
            gstAmt.toFixed(2),
            totalAmt.toFixed(2),
          ];
        })
        .filter((row) => row.length > 0);
    }

    // Calculate totals and append as the last row
    const headers = getHeaders();
    const totalRow: (string | number)[] = [];

    if (isSummary) {
      const filteredData = (data as Bill[]).filter(
        (bill) => !customer || (bill.CUSTNAME ?? bill.VENDOR_NAME) === customer
      );
      const basic = filteredData.reduce(
        (sum, bill) =>
          sum + safeNumber(model === 'Sale Order' ? bill.BASE_AMOUNT : bill.BASIC),
        0
      );
      const discount = filteredData.reduce(
        (sum, bill) => sum + safeNumber(bill.PROMO_DISCOUNT),
        0
      );
      const taxable = basic - discount;
      const gst = filteredData.reduce(
        (sum, bill) =>
          sum +
          safeNumber(
            model === 'Sale Order' ? bill.ADV_AMOUNT : bill.GST_AMOUNT ?? bill.GST_AMT
          ),
        0
      );
      const net = filteredData.reduce(
        (sum, bill) => sum + safeNumber(bill.NET_AMOUNT ?? bill.NET_AMT),
        0
      );

      headers.forEach((header) => {
        switch (header) {
          case 'Order No':
          case 'Bill No':
            totalRow.push('Total');
            break;
          case 'Date':
          case 'Customer Name':
          case 'Vendor Name':
          case 'Mobile No':
          case 'Address':
            totalRow.push('');
            break;
          case 'Basic':
            totalRow.push(basic.toFixed(2));
            break;
          case 'Discount Amount':
            totalRow.push(discount.toFixed(2));
            break;
          case 'Taxable':
            totalRow.push(taxable.toFixed(2));
            break;
          case 'GST Amount':
            totalRow.push(gst.toFixed(2));
            break;
          case 'Total Amount':
            totalRow.push(net.toFixed(2));
            break;
          default:
            totalRow.push('');
            break;
        }
      });
    } else {
      const filteredData = (data as BillDetail[])
        .filter((detail) => !customer || (detail.CUSTNAME ?? detail.VENDOR_NAME) === customer)
        .filter((detail) => !product || detail.PRODNAME === product)
        .filter((detail) => !group || detail.SGroupDesc === group);
      const quantity = filteredData.reduce(
        (sum, detail) => sum + safeNumber(detail.QUANTITY),
        0
      );
      const amount = filteredData.reduce(
        (sum, detail) => sum + safeNumber(detail.AMOUNT),
        0
      );
      const discountAmt = filteredData.reduce(
        (sum, detail) => sum + safeNumber(detail.DISCOUNT_AMT),
        0
      );
      const gstAmt = filteredData.reduce(
        (sum, detail) => sum + safeNumber(detail.GSTAMT),
        0
      );
      const totalAmt = filteredData.reduce(
        (sum, detail) => sum + safeNumber(detail.TOTALAMT),
        0
      );

      headers.forEach((header) => {
        switch (header) {
          case 'Order No':
          case 'Bill No':
            totalRow.push('Total');
            break;
          case 'Date':
          case 'Cust Code':
          case 'Customer Name':
          case 'Vendor Name':
          case 'Mobile No':
          case 'Address':
          case 'Product Code':
          case 'Descript':
          case 'UOM':
          case 'Rate':
          case 'Discount (%)':
          case 'GST Rate':
            totalRow.push('');
            break;
          case 'Quantity':
            totalRow.push(quantity);
            break;
          case 'Basic':
            totalRow.push(amount.toFixed(2));
            break;
          case 'Discount Amt':
            totalRow.push(discountAmt.toFixed(2));
            break;
          case 'SGST':
            totalRow.push((gstAmt / 2).toFixed(2));
            break;
          case 'CGST':
            totalRow.push((gstAmt / 2).toFixed(2));
            break;
          case 'Total GST':
            totalRow.push(gstAmt.toFixed(2));
            break;
          case 'Total Amount':
            totalRow.push(totalAmt.toFixed(2));
            break;
          default:
            totalRow.push('');
            break;
        }
      });
    }

    if (rows.length > 0) {
      rows.push(totalRow);
    }

    return rows;
  };

  const exportToPDF = () => {
    if (!apply) return;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`${model} Report`, 14, 18);
    doc.setFontSize(8);
    doc.text(`Date Range: ${apply.startDate ?? 'N/A'} to ${apply.endDate ?? 'N/A'}`, 14, 24);
    doc.text(
      `Filters: Report Type: ${reportType}, Payment Mode: ${apply.paymentMode ?? 'All'}, ${isPurchaseModel ? 'Vendor' : 'Customer'}: ${selectedPayee}, Product: ${selectedProduct}, Group: ${selectedGroup}, Mobile: ${apply.showMobile ? 'Yes' : 'No'}, Address: ${apply.showAddress ? 'Yes' : 'No'}`,
      14,
      30
    );

    let startY = 38;
    const renderTable = (headers: string[], rows: (string | number)[][], title?: string) => {
      if (title) {
        doc.setFontSize(10);
        doc.text(title, 14, startY);
        startY += 6;
      }

      const pageWidth = 190;
      const totalColumns = headers.length;
      const numericHeaders = ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'];
      const baseWidth = Math.min(15, pageWidth / totalColumns);

      const columnStyles = headers.reduce(
        (styles, header, index) => {
          const isNumeric = numericHeaders.includes(header);
          const isDescript = header === 'Descript';
          const isAddress = header === 'Address';
          styles[index] = {
            cellWidth: isAddress ? Math.min(baseWidth * 2.5, 40) : isDescript ? Math.min(baseWidth * 2, 30) : isNumeric ? Math.min(baseWidth * 1.1, 18) : Math.min(baseWidth * 0.8, 12),
            halign: isNumeric ? 'right' : 'left' as 'left' | 'right',
          };
          return styles;
        },
        {} as { [key: number]: { cellWidth: number; halign: 'left' | 'right' } }
      );

      const totalTableWidth = Object.values(columnStyles).reduce((sum, style) => sum + style.cellWidth, 0);
      if (totalTableWidth > pageWidth) {
        const scaleFactor = pageWidth / totalTableWidth;
        Object.keys(columnStyles).forEach((key) => {
          columnStyles[Number(key)].cellWidth *= scaleFactor;
        });
      }

      autoTable(doc, {
        startY,
        head: [headers],
        body: rows,
        theme: 'striped',
        headStyles: {
          fillColor: [31, 41, 55],
          textColor: 255,
          fontSize: 6,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
          minCellHeight: 4,
          overflow: 'ellipsize',
        },
        bodyStyles: {
          fontSize: 5,
          cellPadding: 1,
          halign: 'center',
          overflow: 'linebreak',
        },
        columnStyles: {
          ...columnStyles,
          [headers.indexOf('Descript')]: {
            overflow: 'linebreak',
            cellWidth: columnStyles[headers.indexOf('Descript')]?.cellWidth || 30,
          },
          [headers.indexOf('Address')]: {
            overflow: 'linebreak',
            cellWidth: columnStyles[headers.indexOf('Address')]?.cellWidth || 40,
          },
        },
        didParseCell: (data) => {
          if (data.row.index === rows.length - 1 && data.cell.text.includes('Total')) {
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.dataKey !== headers.indexOf('Descript') && data.column.dataKey !== headers.indexOf('Address') && data.cell.text.length > 0 && typeof data.cell.text[0] === 'string') {
            const maxLength = 15;
            data.cell.text = data.cell.text.map((text: string) =>
              text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text
            );
          }
        },
        didDrawPage: (data: any) => {
          startY = data.cursor.y + 8;
        },
      });
      startY = (doc as any).lastAutoTable.finalY + 8;
    };

    if (selectedGroup !== 'All' && apply.group) {
      const groupArray = selectedGroup.split(',').map((g) => g.trim());
      groupArray.forEach((group) => {
        const headers = getHeaders();
        const rows = getRows(isSummary ? billData : billDetailData, undefined, undefined, group);
        if (rows.length > 0) {
          renderTable(headers, rows, group);
        }
      });
    } else if (selectedPayee !== 'All' && apply.payees) {
      const payeeArray = selectedPayee.split(',').map((p) => p.trim());
      payeeArray.forEach((payee) => {
        const customer = apply.payees.find((c) => c.NAME === payee);
        const title = `${payee} (Code: ${customer?.CUSTCODE ?? 'N/A'})`;
        const headers = getHeaders();
        const rows = getRows(isSummary ? billData : billDetailData, payee);
        renderTable(headers, rows, title);
      });
    } else if (selectedProduct !== 'All' && reportType === 'Product' && apply.products) {
      const productArray = selectedProduct.split(',').map((p) => p.trim());
      productArray.forEach((product) => {
        const prod = apply.products.find((p) => p.DESCRIPT === product);
        const title = `${product} (Code: ${prod?.PRODCODE ?? 'N/A'})`;
        const headers = getHeaders();
        const rows = getRows(billDetailData, undefined, product);
        renderTable(headers, rows, title);
      });
    } else {
      const headers = getHeaders();
      const rows = getRows(isSummary ? billData : billDetailData);
      renderTable(headers, rows);
    }

    doc.save(`${model}_Report_${reportType}.pdf`);
  };

  const exportToExcel = () => {
    if (!apply) return;
    const wsData: (string | number)[][] = [];
    wsData.push([`${model} Report`]);
    wsData.push([`Date Range: ${apply.startDate ?? 'N/A'} to ${apply.endDate ?? 'N/A'}`]);
    wsData.push([
      `Filters: Report Type: ${reportType}, Payment Mode: ${apply.paymentMode ?? 'All'}, ${isPurchaseModel ? 'Vendor' : 'Customer'}: ${selectedPayee}, Product: ${selectedProduct}, Group: ${selectedGroup}, Mobile: ${apply.showMobile ? 'Yes' : 'No'}, Address: ${apply.showAddress ? 'Yes' : 'No'}`,
    ]);
    wsData.push([]);

    if (selectedGroup !== 'All' && apply.group) {
      const groupArray = selectedGroup.split(',').map((g) => g.trim());
      groupArray.forEach((group) => {
        const headers = getHeaders();
        const rows = getRows(isSummary ? billData : billDetailData, undefined, undefined, group);
        if (rows.length > 0) {
          wsData.push([group]);
          wsData.push(headers, ...rows, []);
        }
      });
    } else if (selectedPayee !== 'All' && apply.payees) {
      const payeeArray = selectedPayee.split(',').map((p) => p.trim());
      payeeArray.forEach((payee) => {
        const customer = apply.payees.find((c) => c.NAME.trim() === payee);
        wsData.push([`${payee} (Code: ${customer?.CUSTCODE ?? 'N/A'})`]);
        const headers = getHeaders();
        const rows = getRows(isSummary ? billData : billDetailData, payee);
        wsData.push(headers, ...rows, []);
      });
    } else if (selectedProduct !== 'All' && reportType === 'Product' && apply.products) {
      const productArray = selectedProduct.split(',').map((p) => p.trim());
      productArray.forEach((product) => {
        const prod = apply.products.find((p) => p.DESCRIPT.trim() === product);
        wsData.push([`${product} (Code: ${prod?.PRODCODE ?? 'N/A'})`]);
        const headers = getHeaders();
        const rows = getRows(billDetailData, undefined, product);
        wsData.push(headers, ...rows, []);
      });
    } else {
      const headers = getHeaders();
      const rows = getRows(isSummary ? billData : billDetailData);
      wsData.push(headers, ...rows);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${model} Report`);
    XLSX.writeFile(wb, `${model}_Report_${reportType}.xlsx`);
  };

  const showPaymentSummary = model !== 'Purchase Order';

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{model} Report</h2>
          <div className="space-x-3 flex gap-2">
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Export PDF</span>
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7v8m4 0v-8m4 8v-8M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
                />
              </svg>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {showPaymentSummary && (
          <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Insights Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-green-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <FaCashRegister className="w-6 h-6 text-green-600" />
                  <p className="text-sm font-medium text-gray-700">Cash Payments</p>
                </div>
                <p className="text-lg font-bold text-green-700 mt-2">
                  {currency} {totalCash.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-blue-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <CreditCardIcon className="w-6 h-6 text-blue-600" />
                  <p className="text-sm font-medium text-gray-700">UPI Payments</p>
                </div>
                <p className="text-lg font-bold text-blue-700 mt-2">
                  {currency} {totalUPI.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-red-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <CreditCardIcon className="w-6 h-6 text-red-600" />
                  <p className="text-sm font-medium text-gray-700">Credit Payments</p>
                </div>
                <p className="text-lg font-bold text-red-700 mt-2">
                  {currency} {totalCredit.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-purple-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <ShoppingCartIcon className="w-6 h-6 text-purple-600" />
                  <p className="text-sm font-medium text-gray-700">Total Quantity</p>
                </div>
                <p className="text-lg font-bold text-purple-700 mt-2">{totalQuantity}</p>
              </div>
              <div className="p-4 bg-yellow-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <FaCaretRight className="w-6 h-6 text-yellow-600" />
                  <p className="text-sm font-medium text-gray-700">Total GST</p>
                </div>
                <p className="text-lg font-bold text-yellow-700 mt-2">
                  {currency} {totalGST.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-indigo-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <FaCalendarDay className="w-6 h-6 text-indigo-600" />
                  <p className="text-sm font-medium text-gray-700">Top Sale Day</p>
                </div>
                <p className="text-base font-bold text-indigo-700 mt-2">
                  {topSaleDay.date}  <br/>({currency} {topSaleDay.amount.toFixed(2)})
                </p>
              </div>
              <div className="p-4 bg-teal-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <FaBox className="w-6 h-6 text-teal-600" />
                  <p className="text-sm font-medium text-gray-700">Top Product</p>
                </div>
                <p className="text-base font-bold text-teal-700 mt-2">
                  {topSaleProduct.product} <br/> ({currency} {topSaleProduct.amount.toFixed(2)})
                </p>
              </div>
              <div className="p-4 bg-orange-100 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center space-x-2">
                  <FaUser className="w-6 h-6 text-orange-600" />
                  <p className="text-sm font-medium text-gray-700">Top Customer</p>
                </div>
                <p className="text-base font-bold text-orange-700 mt-2">
                  {topSaleCustomer.customer} <br/> ({currency} {topSaleCustomer.amount.toFixed(2)})
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {selectedGroup !== 'All' && apply?.group ? (
            apply.group
              .split(',')
              .map((g) => g.trim())
              .map((group) => {
                const rows = getRows(isSummary ? billData : billDetailData, undefined, undefined, group);
                if (rows.length === 0) return null;
                return (
                  <div key={group} className="mb-6">
                    <h3 className="text-lg px-4 py-1 font-semibold text-gray-800 mb-2">{group}</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-blue-600 text-white">
                          <tr>
                            {getHeaders().map((header, index) => (
                              <th
                                key={index}
                                className="py-2 px-3 text-xs font-semibold text-left whitespace-nowrap"
                                style={{
                                  width: ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(header)
                                    ? '100px'
                                    : header === 'Address'
                                    ? '150px'
                                    : 'auto',
                                }}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {rows.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className={`hover:bg-gray-50 transition-colors duration-200 ${rowIndex === rows.length - 1 ? 'font-bold' : ''}`}
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className={`py-2 px-3 text-sm text-gray-800 whitespace-nowrap ${
                                    ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(getHeaders()[cellIndex])
                                      ? 'text-right'
                                      : ''
                                  }`}
                                  style={{ maxWidth: getHeaders()[cellIndex] === 'Address' ? '200px' : '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
          ) : selectedPayee !== 'All' && apply?.payees ? (
            apply.payees
              .filter((c) => selectedPayee.split(',').map((p) => p.trim()).includes(c.NAME))
              .map((customer) => {
                const rows = getRows(isSummary ? billData : billDetailData, customer.NAME);
                return (
                  <div key={customer.NAME} className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 px-4 py-1 mb-2">
                      {customer.NAME} (Code: {customer.CUSTCODE ?? 'N/A'})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-blue-600 text-white">
                          <tr>
                            {getHeaders().map((header, index) => (
                              <th
                                key={index}
                                className="py-2 px-3 text-xs font-semibold text-left whitespace-nowrap"
                                style={{
                                  width: ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(header)
                                    ? '100px'
                                    : header === 'Address'
                                    ? '150px'
                                    : 'auto',
                                }}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {rows.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className={`hover:bg-gray-50 transition-colors duration-200 ${rowIndex === rows.length - 1 ? 'font-bold' : ''}`}
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className={`py-2 px-3 text-sm text-gray-800 whitespace-nowrap ${
                                    ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(getHeaders()[cellIndex])
                                      ? 'text-right'
                                      : ''
                                  }`}
                                  style={{ maxWidth: getHeaders()[cellIndex] === 'Address' ? '200px' : '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
          ) : selectedProduct !== 'All' && reportType === 'Product' && apply?.products ? (
            apply.products
              .filter((p) => selectedProduct.split(',').map((p) => p.trim()).includes(p.DESCRIPT))
              .map((product) => {
                const rows = getRows(billDetailData, undefined, product.DESCRIPT);
                return (
                  <div key={product.DESCRIPT} className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 px-4 py-1 mb-2">
                      {product.DESCRIPT} (Code: {product.PRODCODE ?? 'N/A'})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-blue-600 text-white">
                          <tr>
                            {getHeaders().map((header, index) => (
                              <th
                                key={index}
                                className="py-2 px-3 text-xs font-semibold text-left whitespace-nowrap"
                                style={{
                                  width: ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(header)
                                    ? '100px'
                                    : header === 'Address'
                                    ? '150px'
                                    : 'auto',
                                }}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {rows.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className={`hover:bg-gray-50 transition-colors duration-200 ${rowIndex === rows.length - 1 ? 'font-bold' : ''}`}
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className={`py-2 px-3 text-sm text-gray-800 whitespace-nowrap ${
                                    ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(getHeaders()[cellIndex])
                                      ? 'text-right'
                                      : ''
                                  }`}
                                  style={{ maxWidth: getHeaders()[cellIndex] === 'Address' ? '200px' : '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    {getHeaders().map((header, index) => (
                      <th
                        key={index}
                        className="py-2 px-3 text-xs font-semibold text-left whitespace-nowrap"
                        style={{
                          width: ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(header)
                            ? '100px'
                            : header === 'Address'
                            ? '150px'
                            : 'auto',
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    const rows = getRows(isSummary ? billData : billDetailData);
                    return rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={`hover:bg-gray-50 transition-colors duration-200 ${rowIndex === rows.length - 1 ? 'font-bold' : ''}`}
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={`py-2 px-3 text-sm text-gray-800 whitespace-nowrap ${
                              ['Basic', 'Discount Amt', 'SGST', 'CGST', 'Total GST', 'Total Amount', 'Taxable', 'GST Amount', 'Discount Amount'].includes(getHeaders()[cellIndex])
                                ? 'text-right'
                                : ''
                            }`}
                            style={{ maxWidth: getHeaders()[cellIndex] === 'Address' ? '200px' : '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneralReportTable;