"use client"
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useContext, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "react-toastify";
import Print from "@/components/Print";
import { db } from "../../firebase";
import { decryptUrl } from "@/services/encryption";
import { CounterContext } from "@/lib/CounterContext";
import NewLoader from "./ui/NewLoader";

// Define collections for Firestore
const collections = {
  BILL: "BILL",
  BILLDET: "BILLDET",
  BILLIN: "BILLIN",
  BLLINDET: "BLLINDET",
  ORDER: "ORDER",
  ORDERDET: "ORDERDET",
  PORDER: "PORDER",
  PORDERDET: "PORDERDET",
};

// Interface for paymentData (matching Print component)
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
    uom: string;
    cgstAmount: number;
    sgstAmount: number;
    cgstRate: number;
    sgstRate: number;
    hsncode: string;
  }>;
  totalAmount: number;
  totalGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  advanceAmount?: number;
  balance?: number; // Added balance to the interface
}

// Interface for company data (matching Print component)
interface CompanyData {
  CName: string;
  CAddress: string;
  CContactNo: string;
  CDist: string;
  CState: string;
  CPin: string;
  gstin: string;
  franchiseName: string;
}

const BillPage: React.FC = () => {
  const searchParams = useSearchParams();
  const { state } = useContext(CounterContext);
  const router = useRouter();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTenant] = useState<string>(state.tenantId ?? "");

  // Fetch company details from localStorage
  useEffect(() => {
    try {
      const companyData = localStorage.getItem("company");
      if (!companyData) {
        console.warn("No company data found in localStorage");
        toast.warn("Company data not found in localStorage. Using default values.", {
          position: "bottom-right",
        });
        setCompanyDetails({
          CName: "",
          CAddress: "",
          CContactNo: "",
          CDist: "",
          CState: "",
          CPin: "",
          gstin: "",
          franchiseName: "",
        });
        return;
      }
      const parsedCompany = JSON.parse(companyData);
      setCompanyDetails({
        CName: parsedCompany.CName ?? "",
        CAddress: parsedCompany.CAddress ?? "",
        CContactNo: parsedCompany.CContactNo ?? parsedCompany.contactNumber ?? "",
        CDist: parsedCompany.CDist ?? parsedCompany.district ?? "",
        CState: parsedCompany.CState ?? "",
        CPin: parsedCompany.CPin ?? "",
        gstin: parsedCompany.gstin ?? "",
        franchiseName: parsedCompany.franchiseName ?? "",
      });
    } catch (error) {
      console.error("Error parsing company data from localStorage:", error);
      // toast.error("Failed to load company details. Using default values.", {
      //   position: "bottom-right",
      // });
      setCompanyDetails({
        CName: "",
        CAddress: "",
        CContactNo: "",
        CDist: "",
        CState: "",
        CPin: "",
        gstin: "",
        franchiseName: "",
      });
    }
  }, []);

  // Fetch payment data
  useEffect(() => {
    const fetchPaymentData = async () => {
      const rawEncrypted = searchParams?.get("data");
      if (!rawEncrypted) {
        console.warn("No encrypted data found in URL parameters");
        setLoading(false);
        // toast.error("No payment data found in URL. Please check the link.", {
        //   position: "bottom-right",
        // });
        setTimeout(() => router.push("/sale/bill/add"), 2000);
        return;
      }

      if (!currentTenant) {
        console.error("Tenant ID is undefined");
        setLoading(false);
        // toast.error("Tenant ID is missing. Please check CounterContext configuration.", {
        //   position: "bottom-right",
        // });
        setTimeout(() => router.push("/sale/bill/add"), 2000);
        return;
      }

      try {
        const decrypted = decryptUrl(rawEncrypted);

        let parsedData: { number: string; model: string };
        try {
          parsedData = JSON.parse(decrypted);
        } catch (parseError) {
          throw new Error(`JSON parsing failed: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`);
        }

        const { number, model } = parsedData;
        if (!number || !model) {
          throw new Error("Invalid data: number or model missing");
        }

        let mainCollection: string;
        let detailCollection: string;
        let numberField: string;

        switch (model) {
          case "sale_bill":
            mainCollection = collections.BILL;
            detailCollection = collections.BILLDET;
            numberField = "BILL_NO";
            break;
          case "purchaseBill":
            mainCollection = collections.BILLIN;
            detailCollection = collections.BLLINDET;
            numberField = "BILL_NO";
            break;
          case "order":
            mainCollection = collections.ORDER;
            detailCollection = collections.ORDERDET;
            numberField = "OA_NO";
            break;
          case "purchaseOrder":
            mainCollection = collections.PORDER;
            detailCollection = collections.PORDERDET;
            numberField = "BILL_NO";
            break;
          default:
            throw new Error(`Invalid model type: ${model}`);
        }

        // Fetch main document
        const mainQuery = query(
          collection(db, `TenantsDb/${currentTenant}/${mainCollection}`),
          where(numberField, "==", number)
        );
        const mainSnapshot = await getDocs(mainQuery);

        if (mainSnapshot.empty) {
          throw new Error(`No ${model} found with ${numberField}: ${number}. Verify the bill exists in Firestore at TenantsDb/${currentTenant}/${mainCollection}.`);
        }

        const mainDoc = mainSnapshot.docs[0].data();

        // Fetch detail documents
        const detailQuery = query(
          collection(db, `TenantsDb/${currentTenant}/${detailCollection}`),
          where(numberField, "==", number)
        );
        const detailSnapshot = await getDocs(detailQuery);
        const products = detailSnapshot.docs.map((doc) => doc.data());

        if (products.length === 0) {
          console.warn(`No products found for ${numberField}: ${number} in ${detailCollection}`);
          toast.warn("No product details found for this bill. Displaying basic bill information.", {
            position: "bottom-right",
          });
        }

        // Construct paymentData with proper typing
        const constructedPaymentData: PaymentData = {
          invoiceNumber: mainDoc.BILL_NO ?? mainDoc.OA_NO ?? number,
          date: mainDoc.BILL_DATE?.toDate?.()?.toISOString?.() ?? mainDoc.OA_DATE?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
          customerData: {
            name: mainDoc.CUSTNAME ?? mainDoc.PARTYNAME ?? "Guest",
            MOBPHONE: mainDoc.MOBPHONE ?? mainDoc.MOBILE ?? "N/A",
          },
          products: products.length > 0 ? products.map((p, index) => {
            // Calculate taxable amount (excluding GST)
            const taxableAmount = Number(p.AMOUNT);
            const cgstRate = Number((p.GSTAMT * 100) / (p.AMOUNT - p.GSTAMT)) / 2;
            const sgstRate = Number((p.GSTAMT * 100) / (p.AMOUNT - p.GSTAMT)) / 2;
            const cgstAmount = Number(p.CGSTAMT) || 0;
            const sgstAmount = Number(p.SGSTAMT) || 0;

            return {
              id: `${index}-${p.PRODNAME ?? p.DESCRIPT ?? "Unknown"}`,
              name: p.PRODNAME ?? p.DESCRIPT ?? "Unknown",
              QUANTITY: Number(p.QUANTITY ?? 0),
              price: Number(p.RATE ?? p.UNIT_PRICE ?? 0),
              uom: p.UOM ?? p.UNIT ?? "Unit",
              cgstAmount,
              sgstAmount,
              cgstRate,
              sgstRate,
              hsncode: p.HSNCODE ?? p.HSN_CODE ?? "0000",
            };
          }) : [{
            id: "0-placeholder",
            name: "No Product Details",
            QUANTITY: 0,
            price: 0,
            uom: "Unit",
            cgstAmount: 0,
            sgstAmount: 0,
            cgstRate: 0,
            sgstRate: 0,
            hsncode: "0000",
          }],
          // Handle BASIC and NET_AMOUNT comparison
          totalAmount: Number(mainDoc.BASIC ?? mainDoc.NET_AMOUNT ?? mainDoc.NET_AMT ?? 0),
          totalGstAmount: Number(mainDoc.GST_AMOUNT ?? mainDoc.TOTAL_GST ?? 0),
          cgstAmount: Number(mainDoc.CGST_AMOUNT ?? mainDoc.CGST_AMT ?? 0),
          sgstAmount: Number(mainDoc.SGST_AMOUNT ?? mainDoc.SGST_AMT ?? 0),
          advanceAmount: (model === "sale_bill" || model === "purchaseBill") 
            ? (Number(mainDoc.BASIC) === Number(mainDoc.NET_AMOUNT) 
                ? Number(mainDoc.BASIC) - Number(mainDoc.NET_AMOUNT) 
                : 0) 
            : Number(mainDoc.ADV_AMOUNT ?? 0),
          balance: (model === "sale_bill" || model === "purchaseBill") 
            ? Number(mainDoc.NET_AMOUNT ?? 0) 
            : undefined,
        };
        console.log("Payment Data:", constructedPaymentData);
        setPaymentData(constructedPaymentData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching payment data:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          rawEncrypted,
          tenantId: currentTenant,
          firestorePath: `TenantsDb/${currentTenant}/${collections.BILL}`,
        });
        setLoading(false);
        // toast.error(`Failed to fetch payment details: ${error instanceof Error ? error.message : "Unknown error"}`, {
        //   position: "bottom-right",
        // });
        setTimeout(() => router.push("/sale/bill/add"), 2000);
      }
    };

    fetchPaymentData();
  }, [searchParams, router, currentTenant]);

  if (loading) {
    return <NewLoader />;
  }

  if (!paymentData || !companyDetails) {
    console.warn("Missing paymentData or companyDetails", { paymentData, companyDetails });
    return <div>Error: Unable to load bill details. Please verify the bill exists in Firestore.</div>;
  }

  return <Print paymentData={paymentData} companyData={companyDetails} />;
};

export default BillPage;