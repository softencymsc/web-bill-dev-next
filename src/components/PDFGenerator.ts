import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PaymentData {
  paymentType: string; // e.g. "Cash", "Card"
  products: any[]; // Ideally typed later with your Product interface
  invoiceNumber: string;
  date: string;

  customerData: {
    NAME?: string;
    MOBPHONE?: string;
    ADDRESS?: string;
    CITY?: string;
    COUNTRY?: string;
    CUSTCODE?: string;
  };

  totalAmount: number;
  totalGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;

  confirmedPayments: {
    cash: number;
    card: number;
    upi: { method: string; amount: number; description: string }[];
    free: number;
    credit: number;
    ownerDiscount: number;
  };

  finalOutstandingAmount: number;

  model: 'sale_bill' | 'purchaseBill'| "sale order" | "purchaseOrder"; // restrict to allowed types

  paymentDetails: {
    cashAmount: number;
    cardAmount: number;
    upiAmounts: { [method: string]: string }; // e.g. { "PhonePe": "XXXX", ... }
    totalUpiAmount: number;
    freeAmount: number;
    creditAmount: number;
    ownerDiscountAmount: number;
  };

  promoCode: string | null;
  promoDiscount: number;
  ownerDiscount: {
    type: 'percentage' | 'amount';
    value: number;
    discount: number;
  } | null;
}


export const generatePDFAndSendWhatsApp = async (
  paymentData: PaymentData,
  customerName: string,
  whatsappNumber: string
) => {
  try {
    // Company details
    const companyName = 'Taste n Bite';
    const companyEmail = 'contact@tastenbite.com';

    // Date formatting function
    const formatDate = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Number to words function
    const numberToWords = (num: number): string => {
      if (num === 0) return 'Zero Rupees Only';
      const belowTwenty = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
        'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
      ];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const thousands = ['', 'Thousand', 'Million', 'Billion'];

      const helper = (n: number): string => {
        if (n === 0) return '';
        else if (n < 20) return belowTwenty[n] + ' ';
        else if (n < 100) return tens[Math.floor(n / 10)] + ' ' + helper(n % 10);
        else return belowTwenty[Math.floor(n / 100)] + ' Hundred ' + helper(n % 100);
      };

      let word = '';
      let i = 0;
      while (num > 0) {
        if (num % 1000 !== 0) {
          word = helper(num % 1000) + thousands[i] + ' ' + word;
        }
        num = Math.floor(num / 1000);
        i++;
      }
      return word.trim() + ' Rupees Only';
    };

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 20;

    // Header: Company Branding
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(227, 53, 53); // Warm pinkish-red for cake shop vibe
    doc.text(companyName, margin, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100); // Soft gray
    doc.text(companyEmail, margin, y);
    y += 10;

    // Decorative Line
    doc.setDrawColor(227, 53, 53);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Invoice Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(paymentData.model === 'sale_bill' ? 'Sales Invoice' : 'Purchase Invoice', margin, y);
    y += 10;

    // Invoice and Customer Details (Two-Column Layout)
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    // Left: Invoice Details
    doc.text(`Invoice No: ${paymentData.invoiceNumber}`, margin, y);
    doc.text(`Date: ${formatDate(new Date(paymentData.date))}`, margin, y + 7);
    // Right: Customer Details
    const customerDetails = [
      `Customer: ${customerName || 'Valued Customer'}`,
      paymentData.customerData?.ADDRESS && `Address: ${paymentData.customerData.ADDRESS}`,
      paymentData.customerData?.CITY && `City: ${paymentData.customerData.CITY}`,
    ].filter(Boolean);
    customerDetails.forEach((line, index) => {
      doc.text(String(line), pageWidth - margin - 80, y + index * 7);
    });
    y += 25;

    // Items Table
    autoTable(doc, {
      startY: y,
      head: [['Item', 'Qty', 'Rate', 'Discount', 'GST', 'Amount']],
      body: paymentData.products.map((item) => {
        const quantity = Math.abs(Number(item.QUANTITY)) || 0;
        const rate = Number(item.price) || 0;
        const discount = Number(item.DISCOUNTAMT) || 0;
        const baseAmt = rate * quantity - discount;
        const igstRate = Number(item.IGST) || 0;
        const gstAmt = Number(((baseAmt * igstRate) / (100 + igstRate)).toFixed(2));
        return [
          item.DESCRIPT || item.name || 'Cake Item',
          quantity.toString(),
          rate.toFixed(2),
          discount.toFixed(2),
          gstAmt.toFixed(2),
          baseAmt.toFixed(2),
        ];
      }),
      theme: 'grid',
      headStyles: {
        fillColor: [227, 53, 53], // Warm pinkish-red
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [50, 50, 50],
        fillColor: [255, 245, 245], // Light pink background
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255], // White for alternate rows
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
    });

    // Update y position after table
    y = (doc as any).lastAutoTable.finalY + 10;

    // Totals Section
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', margin, y);
    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setDrawColor(227, 53, 53);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    const totals = [
      `Subtotal: INR ${paymentData.totalAmount.toFixed(2)}`,
      paymentData.promoDiscount > 0 && `Promo Discount (${paymentData.promoCode}): -INR ${paymentData.promoDiscount.toFixed(2)}`,
      paymentData.ownerDiscount && `Owner's Discount (${paymentData.ownerDiscount.type}): -INR ${paymentData.ownerDiscount.discount.toFixed(2)}`,
      `CGST: INR ${paymentData.cgstAmount.toFixed(2)}`,
      `SGST: INR ${paymentData.sgstAmount.toFixed(2)}`,
      `Total GST: INR ${paymentData.totalGstAmount.toFixed(2)}`,
    ].filter(Boolean);
    const netAmount = paymentData.totalAmount - (paymentData.promoDiscount || 0) - (paymentData.ownerDiscount?.discount || 0);
    totals.forEach((line) => {
      doc.text(String(line), pageWidth - margin - 60, y);
      y += 7;
    });
    doc.setFont('Helvetica', 'bold');
    doc.text(`Net Amount: INR ${netAmount.toFixed(2)}`, pageWidth - margin - 60, y);
    y += 7;
    doc.setFont('Helvetica', 'normal');
    doc.text(`Amount in Words: ${numberToWords(Math.round(netAmount))}`, margin, y);
    y += 10;

    // Payment Details Section
    doc.setFont('Helvetica', 'bold');
    doc.text('Payment Details', margin, y);
    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    const payments = [
      paymentData.confirmedPayments.cash > 0 && `Cash: INR ${paymentData.confirmedPayments.cash.toFixed(2)}`,
      paymentData.confirmedPayments.card > 0 && `Card: INR ${paymentData.confirmedPayments.card.toFixed(2)}`,
      ...paymentData.confirmedPayments.upi.map((upi) => `${upi.method}: INR ${upi.amount.toFixed(2)}`),
      paymentData.confirmedPayments.free > 0 && `Free: INR ${paymentData.confirmedPayments.free.toFixed(2)}`,
      paymentData.confirmedPayments.credit > 0 && `Credit: INR ${paymentData.confirmedPayments.credit.toFixed(2)}`,
      paymentData.confirmedPayments.ownerDiscount > 0 && `Owner Discount: INR ${paymentData.confirmedPayments.ownerDiscount.toFixed(2)}`,
      paymentData.finalOutstandingAmount > 0 && `Outstanding Amount: INR ${paymentData.finalOutstandingAmount.toFixed(2)}`,
    ].filter(Boolean);
    payments.forEach((line, index) => {
      if (String(line).includes('Outstanding Amount')) {
        doc.setTextColor(200, 0, 0);
        doc.text(String(line), margin, y);
        doc.setTextColor(50, 50, 50);
      } else {
        doc.text(String(line), margin, y);
      }
      y += 7;
    });

    // Footer
    y = pageHeight - 20;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for choosing Taste n Bite! We hope you enjoy your delicious treats!', margin, y);
    doc.text(`Contact: ${companyEmail}`, pageWidth - margin - 50, y);

    // Generate Blob from PDF
    const pdfBlob = doc.output('blob');
    console.log('PDF Blob:', pdfBlob, 'Size:', pdfBlob.size, 'Type:', pdfBlob.type);

    // Prepare FormData for POST request
    const formData = new FormData();
    formData.append('name', customerName || 'Valued Customer');
    const cleanedPhone = whatsappNumber.replace(/[^0-9]/g, '');
    const phoneNumber = cleanedPhone.length === 10 ? cleanedPhone : cleanedPhone;
    formData.append('number', phoneNumber);
    formData.append('file', pdfBlob, `${paymentData.invoiceNumber}.pdf`);

    // Send to backend API
    const res = await fetch(`http://147.79.67.233:8085/api/send-whatsapp`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'WhatsApp message failed');
    }

    const result = await res.json();
    return { pdfBlob, result };
  } catch (error) {
    console.error('Error generating or sending PDF:', error);
    throw error;
  }
};