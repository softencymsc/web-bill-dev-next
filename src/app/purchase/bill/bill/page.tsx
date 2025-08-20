/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useContext, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../../firebase"; // Adjust the path to your Firebase config
import { CounterContext } from "@/lib/CounterContext";
import Loader from "@/components/Loader";

// Context type
interface CounterContextType {
  state: {
    tenantId: string;
  };
}

// Interface for BILLIN data
interface BillIn {
  ADDRESS: string;
  BASIC: string;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CARD_AMOUNT: number;
  CASH_AMOUNT: number;
  CGSTAMT?: string | number;
  CITY: string;
  COUNTRY: string;
  CREDIT_AMOUNT: number;
  CUSTCODE: string;
  CUSTNAME: string;
  GST_AMOUNT: number;
  IS_CREDIT: boolean;
  IS_FREE: boolean;
  MOBPHONE: string;
  NET_AMOUNT: string;
  OUTSTANDING_AMOUNT: string;
  PAY_MODE: string;
  PROMO_CODE: string;
  PROMO_DISCOUNT: number;
  SGST_AMOUNT?: string | number;
  TERMTOTAL: number;
  TOTAL_UPI_AMOUNT: number;
  UPI_AMOUNT: number;
  UPI_DETAILS: Array<{ amount: number; method: string }>;
}

// Interface for BLLINDET data
interface BllInDet {
  AMOUNT: string;
  BILL_DATE: { toDate: () => Date };
  BILL_NO: string;
  CGSTAMT: string;
  CUSTNAME: string;
  GSTAMT: string;
  GroupDesc: string;
  IGSTAMT: string;
  IGSTPER: number;
  PRODCODE: string;
  PRODNAME: string;
  PRODTOTAL: string;
  QUANTITY: number;
  RATE: number;
  SGSTAMT: string;
  SGroupDesc: string;
  TOTALAMT: string;
  UOM: string;
}

// Interface for paymentData
interface PaymentData {
  invoiceNumber: string;
  date: string;
  customerData: {
    name: string;
    MOBPHONE: string;
  };
  products: Array<{
    id: string;
    name: string;
    QUANTITY: number;
    price: number;
  }>;
  totalAmount: number;
  totalGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
}

const InvoiceLayout: React.FC<{ paymentData: PaymentData }> = ({ paymentData }) => {
  // Format date to DD-MM-YYYY
  const formattedDate = new Date(paymentData.date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Calculate total amount in words
  const numberToWords = (num: number): string => {
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = [
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    if (num === 0) return "Zero";
    
    const convertLessThanThousand = (n: number): string => {
      if (n < 10) return units[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
      return `${units[Math.floor(n / 100)]} Hundred ${convertLessThanThousand(n % 100)}`.trim();
    };

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let result = "₹ ";
    if (rupees > 0) {
      result += convertLessThanThousand(rupees) + " Rupees";
    }
    if (paise > 0) {
      result += (rupees > 0 ? " and " : "") + convertLessThanThousand(paise) + " Paise";
    }
    return result + " Only";
  };

  const totalAmountInWords = numberToWords(paymentData.totalAmount);
  const totalGstAmountInWords = numberToWords(paymentData.totalGstAmount);

  return (
    <div style={{ 
      maxWidth: 360, 
      margin: "20px auto", 
      padding: 20, 
      fontFamily: "'Courier New', Courier, monospace", 
      fontSize: 12, 
      lineHeight: 1.3, 
      border: "1px solid #ccc",
      backgroundColor: "#fff",
      boxShadow: "0 0 5px rgba(0,0,0,0.1)",
      borderRadius: 4,
      color: "#000"
    }}>
      <div style={{ textAlign: "center", marginBottom: 10, fontWeight: "bold" }}>
        <div>Taste &#39;N&rsquo; Bite</div>
        <div>The Sunshine Confectionery</div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 10, fontSize: 10 }}>
        <div>Nabghara (Ranihat- Amta Road Junction), Mob. 8910546391</div>
        <div>FASSAI License - 12824008000521/GST IN - 19DKAPK2676D1Z6</div>
      </div>

      <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "4px 0", textAlign: "center", fontWeight: "bold", marginBottom: 6 }}>
        TAX INVOICE
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div>Bill No. : {paymentData.invoiceNumber}</div>
        <div>Date : {formattedDate}</div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div>Name : {paymentData.customerData.name}</div>
        <div>Mobile No : {paymentData.customerData.MOBPHONE}</div>
      </div>

      <table style={{ 
        width: "100%", 
        fontSize: 11, 
        borderCollapse: "collapse", 
        marginBottom: 8, 
        backgroundColor: "#f5f5f5" 
      }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px dotted #000", paddingBottom: 4, textAlign: "left" }}>S.No.</th>
            <th style={{ borderBottom: "1px dotted #000", paddingBottom: 4, textAlign: "left" }}>Item Name</th>
            <th style={{ borderBottom: "1px dotted #000", paddingBottom: 4, textAlign: "center" }}>Qty.</th>
            <th style={{ borderBottom: "1px dotted #000", paddingBottom: 4, textAlign: "left" }}>Uom</th>
            <th style={{ borderBottom: "1px dotted #000", paddingBottom: 4, textAlign: "right" }}>Rate</th>
            <th style={{ borderBottom: "1px dotted #000", paddingBottom: 4, textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {paymentData.products.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td>{product.name}</td>
              <td style={{ textAlign: "center" }}>{product.QUANTITY}</td>
              <td>PKTS</td>
              <td style={{ textAlign: "right" }}>{product.price.toFixed(2)}</td>
              <td style={{ textAlign: "right" }}>{(product.QUANTITY * product.price).toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{ paddingTop: 6, textAlign: "right", fontWeight: "bold" }}>Total</td>
            <td style={{ paddingTop: 6, textAlign: "right", fontWeight: "bold" }}>{paymentData.totalAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontStyle: "italic", marginBottom: 6 }}>
        Tax Amount in Word: {totalAmountInWords}
      </div>

      <table style={{ 
        width: "100%", 
        fontSize: 10, 
        borderCollapse: "collapse", 
        border: "1px dotted #000", 
        backgroundColor: "#f5f5f5" 
      }}>
        <thead>
          <tr>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>HSN/SAC</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>Qty</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>T Value</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }} colSpan={2}>Central Tax</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }} colSpan={2}>State Tax</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>Total Tax Amount</th>
          </tr>
          <tr>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}></th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}></th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}></th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>Rate%</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>Amount</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>Rate%</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}>Amount</th>
            <th style={{ border: "1px dotted #000", padding: "2px 4px" }}></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px dotted #000", padding: "2px 4px" }}>19059030</td>
            <td style={{ border: "1px dotted #000", padding: "2px 4px", textAlign: "center" }}>
              {paymentData.products.reduce((sum, p) => sum + p.QUANTITY, 0)}
            </td>
            <td style={{ border: "1px dotted #000", padding: "2px 4px", textAlign: "right" }}>
              {(paymentData.totalAmount - paymentData.totalGstAmount).toFixed(2)}
            </td>
            <td style={{ border: "1px dotted #000", padding: "2px 4px", textAlign: "right" }}>2.5</td>
            <td style={{ border: "1px dotted #000", padding: "2px 4px", textAlign: "right" }}>
              {paymentData.cgstAmount.toFixed(2)}
            </td>
            <td style={{ border: "1px dotted #000", padding: "2px 4px", textAlign: "right" }}>2.5</td>
            <td style={{ border: "1px dotted #000", padding: "2px 4px", textAlign: "right" }}>
              {paymentData.sgstAmount.toFixed(2)}
            </td>
            <td style={{ border: "1px dotted #000", padding: "2px 4px", textAlign: "right" }}>
              {paymentData.totalGstAmount.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ textAlign: "center", fontWeight: "bold", border: "1px dotted #000", padding: "2px 4px" }}>Total</td>
            <td style={{ textAlign: "right", fontWeight: "bold", border: "1px dotted #000", padding: "2px 4px" }}>
              {(paymentData.totalAmount - paymentData.totalGstAmount).toFixed(2)}
            </td>
            <td></td>
            <td style={{ textAlign: "right", fontWeight: "bold", border: "1px dotted #000", padding: "2px 4px" }}>
              {paymentData.cgstAmount.toFixed(2)}
            </td>
            <td></td>
            <td style={{ textAlign: "right", fontWeight: "bold", border: "1px dotted #000", padding: "2px 4px" }}>
              {paymentData.sgstAmount.toFixed(2)}
            </td>
            <td style={{ textAlign: "right", fontWeight: "bold", border: "1px dotted #000", padding: "2px 4px" }}>
              {paymentData.totalGstAmount.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontStyle: "italic", marginTop: 6, marginBottom: 6 }}>
        Tax Amount in Word: {totalGstAmountInWords}
      </div>

      <div style={{ textAlign: "center", marginTop: 10, fontWeight: "bold" }}>
        Thank you for your purchase!
      </div>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        Visit again - www.tastenbite.com
      </div>
      <div style={{ textAlign: "center", marginTop: 4, fontStyle: "italic" }}>
        Computer-generated bill
      </div>
    </div>
  );
};

const PageContent: React.FC = () => {
  const { state } = useContext(CounterContext) as CounterContextType;
  const searchParams = useSearchParams();
  const id = searchParams?.get("id") ?? "";
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  useEffect(() => {
    const fetchBillInData = async () => {
      try {
        // Fetch BILLIN data
        const billInQuery = query(
          collection(db, "TenantsDb", state.tenantId, "BILLIN"),
          where("BILL_NO", "==", id)
        );
        const billInSnapshot = await getDocs(billInQuery);

        if (billInSnapshot.empty) {
          console.error("No purchase bill found for BILL_NO:", id);
          return;
        }

        const billInData = billInSnapshot.docs[0].data() as BillIn;

        // Fetch BLLINDET data
        const bllInDetQuery = query(
          collection(db, "TenantsDb", state.tenantId, "BLLINDET"),
          where("BILL_NO", "==", id)
        );
        const bllInDetSnapshot = await getDocs(bllInDetQuery);

        // Map BLLINDET to products and aggregate CGSTAMT and SGSTAMT
        const products = bllInDetSnapshot.docs.map((doc) => {
          const data = doc.data() as BllInDet;
          return {
            id: data.PRODCODE,
            name: data.PRODNAME,
            QUANTITY: data.QUANTITY,
            price: data.RATE,
          };
        });

        // Aggregate CGSTAMT and SGSTAMT from BLLINDET
        const totalCgst = bllInDetSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data() as BllInDet;
          return sum + (parseFloat(data.CGSTAMT) || 0);
        }, 0);

        const totalSgst = bllInDetSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data() as BllInDet;
          return sum + (parseFloat(data.SGSTAMT) || 0);
        }, 0);

        // Map data to paymentData
        const mappedPaymentData: PaymentData = {
          invoiceNumber: billInData.BILL_NO,
          date: billInData.BILL_DATE.toDate().toISOString(),
          customerData: {
            name: billInData.CUSTNAME,
            MOBPHONE: billInData.MOBPHONE,
          },
          products,
          totalAmount: parseFloat(billInData.NET_AMOUNT) || 0,
          totalGstAmount: billInData.GST_AMOUNT,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
        };

        setPaymentData(mappedPaymentData);
      } catch (error) {
        console.error("Error fetching purchase bill data:", error);
      }
    };

    if (id && state.tenantId) {
      fetchBillInData();
    }
  }, [id, state.tenantId]);

  if (!paymentData) {
    return <div className="flex items-center justify-center h-screen w-screen">Loading...</div>;
  }

  return (
    <main className="flex max-w-full overflow-hidden h-full flex-col md:flex-row">
      <section className="md:w-[100%] md:h-full w-full h-2/3">
        <InvoiceLayout paymentData={paymentData} />
      </section>
    </main>
  );
};

const Page: React.FC = () => {
  return (
    <Suspense fallback={<div><Loader /></div>}>
      <PageContent />
    </Suspense>
  );
};

export default Page;