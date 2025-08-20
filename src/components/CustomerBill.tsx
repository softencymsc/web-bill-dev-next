/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "react-toastify";
import Print from "@/components/Print";
import { db } from "../../firebase";
import { CounterContext } from "@/lib/CounterContext";
import { decryptUrl } from "@/services/encryption";
import NewLoader from "./ui/NewLoader";

// Define collections for Firestore
const collections = {
  BILL: { main: "BILL", detail: "BILLDET", numberField: "BILL_NO" },
  BILLIN: { main: "BILLIN", detail: "BLLINDET", numberField: "BILL_NO" },
  ORDER: { main: "ORDER", detail: "ORDERDET", numberField: "OA_NO" },
  PORDER: { main: "PORDER", detail: "PORDERDET", numberField: "BILL_NO" },
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
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTenant] = useState<string>(state.tenantId);

  // Fetch company details from localStorage
  useEffect(() => {
    console.log("Fetching company details from localStorage");
    try {
      const companyData = localStorage.getItem("company");
      if (!companyData) {
        console.warn("No company data found in localStorage");
        toast.warn("Company data not found in localStorage. Using default values.", {
          position: "bottom-right",
        });
        setCompanyDetails({
          CName: "TEST FRANCHISE",
          CAddress: "Halishar",
          CContactNo: "6289675776",
          CDist: "N/A",
          CState: "West Bengal",
          CPin: "743145",
          gstin: "123456789000",
          franchiseName: "N/A",
        });
        return;
      }
      const parsedCompany = JSON.parse(companyData);
      console.log("Parsed company data:", parsedCompany);
      setCompanyDetails({
        CName: parsedCompany.CName || "TEST FRANCHISE",
        CAddress: parsedCompany.CAddress || "Halishar",
        CContactNo: parsedCompany.CContactNo || parsedCompany.contactNumber || "6289675776",
        CDist: parsedCompany.CDist || parsedCompany.district || "N/A",
        CState: parsedCompany.CState || "West Bengal",
        CPin: parsedCompany.CPin || "743145",
        gstin: parsedCompany.gstin || "123456789000",
        franchiseName: parsedCompany.franchiseName || "N/A",
      });
    } catch (error) {
      console.error("Error parsing company data from localStorage:", error);
      // toast.error("Failed to load company details. Using default values.", {
      //   position: "bottom-right",
      // });
      setCompanyDetails({
        CName: "TEST FRANCHISE",
        CAddress: "Halishar",
        CContactNo: "6289675776",
        CDist: "N/A",
        CState: "West Bengal",
        CPin: "743145",
        gstin: "123456789000",
        franchiseName: "N/A",
      });
    }
  }, []);

  // Fetch payment data
  useEffect(() => {
    const fetchPaymentData = async () => {
      const encryptedBillNumber = searchParams?.get("data");
      console.log("Encrypted Bill Number:", encryptedBillNumber);
      if (!encryptedBillNumber) {
        console.warn("No bill number provided in URL parameters");
        // toast.error("No bill number provided. Please check the link.", {
        //   position: "bottom-right",
        // });
        setLoading(false);
        return;
      }

      if (!currentTenant) {
        console.error("Tenant ID is undefined");
        // toast.error("Tenant ID is missing. Please check CounterContext configuration.", {
        //   position: "bottom-right",
        // });
        setLoading(false);
        return;
      }
      console.log("Current Tenant ID:", currentTenant);

      let billNumber: string;
      try {
        billNumber = decryptUrl(encryptedBillNumber);
        console.log("Decrypted Bill Number:", billNumber);
        if (!billNumber) {
          throw new Error("Decrypted bill number is empty");
        }
      } catch (error) {
        console.error("Decryption error:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          encryptedBillNumber,
        });
        // toast.error(
        //   `Failed to decrypt bill number: ${error instanceof Error ? error.message : "Unknown error"}`,
        //   {
        //     position: "bottom-right",
        //   }
        // );
        setLoading(false);
        return;
      }

      try {
        let mainDoc: any = null;
        let products: any[] = [];
        let matchedCollection: { main: string; detail: string; numberField: string } | null = null;

        // Search through each collection sequentially
        for (const [key, { main, detail, numberField }] of Object.entries(collections)) {
          console.log(`Searching in collection: TenantsDb/${currentTenant}/${main} for ${numberField} = ${billNumber}`);
          const mainQuery = query(
            collection(db, `TenantsDb/${currentTenant}/${main}`),
            where(numberField, "==", billNumber)
          );
          const mainSnapshot = await getDocs(mainQuery);
          console.log(`Documents found in ${main}:`, mainSnapshot.docs.length);

          if (!mainSnapshot.empty) {
            mainDoc = mainSnapshot.docs[0].data();
            console.log(`Main document found in ${main}:`, mainDoc);
            matchedCollection = { main, detail, numberField };
            // Fetch detail documents
            console.log(`Fetching details from: TenantsDb/${currentTenant}/${detail} for ${numberField} = ${billNumber}`);
            const detailQuery = query(
              collection(db, `TenantsDb/${currentTenant}/${detail}`),
              where(numberField, "==", billNumber)
            );
            const detailSnapshot = await getDocs(detailQuery);
            products = detailSnapshot.docs.map((doc) => doc.data());
            console.log(`Detail documents found in ${detail}:`, products);
            break; // Stop searching once a match is found
          }
        }

        if (!mainDoc || !matchedCollection) {
          throw new Error(`No bill found with number: ${billNumber}. Searched all collections.`);
        }

        if (products.length === 0) {
          console.warn(`No products found for bill number: ${billNumber} in ${matchedCollection.detail}`);
          toast.warn("No product details found for this bill. Displaying basic bill information.", {
            position: "bottom-right",
          });
        }

        // Construct paymentData with proper typing
        const constructedPaymentData: PaymentData = {
          invoiceNumber: mainDoc.BILL_NO || mainDoc.OA_NO || billNumber,
          date: mainDoc.BILL_DATE?.toDate?.()?.toISOString?.() || mainDoc.OA_DATE?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          customerData: {
            name: mainDoc.CUSTNAME || "Guest",
            MOBPHONE: mainDoc.MOBPHONE || "N/A",
          },
          products: products.length > 0
            ? products.map((p, index) => ({
                id: `${index}-${p.PRODNAME || p.DESCRIPT || "Unknown"}`,
                name: p.PRODNAME || p.DESCRIPT || "Unknown",
                QUANTITY: Number(p.QUANTITY) || 0,
                price: Number(p.RATE) || 0,
                uom: p.UOM || p.UOM_SALE || "Unit",
                cgstAmount: Number(p.CGSTAMT) || Number(p.CGST_AMOUNT) || 0,
                sgstAmount: Number(p.SGSTAMT) || Number(p.SGST_AMOUNT) || 0,
                cgstRate: Number(p.CGSTPER) || Number(p.CGST_RATE) || 0,
                sgstRate: Number(p.SGSTPER) || Number(p.SGST_RATE) || 0,
                hsncode: p.HSNCODE || "0000",
              }))
            : [
                {
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
                },
              ],
          totalAmount: Number(mainDoc.NET_AMOUNT) || 0,
          totalGstAmount: Number(mainDoc.GST_AMOUNT) || 0,
          cgstAmount: Number(mainDoc.CGST_AMOUNT) || 0,
          sgstAmount: Number(mainDoc.SGST_AMOUNT) || 0,
        };

        console.log("Constructed Payment Data:", constructedPaymentData);
        setPaymentData(constructedPaymentData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching payment data:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          billNumber,
          tenantId: currentTenant,
        });
        // toast.error(
        //   `Failed to fetch bill details: ${error instanceof Error ? error.message : "Unknown error"}`,
        //   {
        //     position: "bottom-right",
        //   }
        // );
        setLoading(false);
      }
    };

    fetchPaymentData();
  }, [searchParams, currentTenant]);

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