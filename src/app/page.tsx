/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CounterContext } from "@/lib/CounterContext";
import Dashboard from "@/components/Dashboard";
import Loader from "@/components/Loader";
import { db } from "../../firebase"; // Adjust path to your Firebase config
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { toast } from "react-hot-toast";

// Allowed document types and their default prefixes
const documentTypes = [
  "Sale Bill",
  "Sale Order",
  "Purchase Bill",
  "Purchase Order",
  "Voucher",
  "Special Order",
  "Customer",
  "Vendor",
];

const defaultPrefixes: { [key: string]: string } = {
  "Sale Bill": "SB",
  "Sale Order": "SO",
  "Purchase Bill": "PB",
  "Purchase Order": "PO",
  "Voucher": "VO",
  "Special Order": "SPO",
  "Customer": "CUS",
  "Vendor": "VEN",
};

// Default settings values
const defaultAdminPin = "0000";
const defaultCurrency = "₹";
const defaultNegativeStock = false;
const defaultOwnerNumber = "";

const DashboardWrapper = () => {
  const { state, dispatch } = useContext(CounterContext); // Include dispatch from CounterContext
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isSettingsInitialized, setIsSettingsInitialized] = useState(false);

  useEffect(() => {
    const initializeSettings = async (tenantId: string) => {
      try {
        const settingsCollection = collection(db, `TenantsDb/${tenantId}/SETTINGS`);
        const settingsSnapshot = await getDocs(settingsCollection);

        // Create a map of existing settings
        const settingsMap = new Map<string, any>();
        settingsSnapshot.docs.forEach((doc) => {
          settingsMap.set(doc.id, doc.data());
        });

        // Initialize Document Numbering Prefixes
        for (const docType of documentTypes) {
          const prefixDocId = `prefix_${docType.replace(/\s+/g, "_")}`;
          if (!settingsMap.has(prefixDocId)) {
            const defaultPrefix = defaultPrefixes[docType];
            const prefixDoc = doc(db, `TenantsDb/${tenantId}/SETTINGS/${prefixDocId}`);
            await setDoc(prefixDoc, { PREFIX: defaultPrefix }, { merge: true });
            console.log(`Initialized ${docType} prefix to ${defaultPrefix}`);
          }
        }

        // Initialize Negative Stock
        if (!settingsMap.has("negativeStock")) {
          const settingsDoc = doc(db, `TenantsDb/${tenantId}/SETTINGS/negativeStock`);
          await setDoc(settingsDoc, { allowNegativeStock: defaultNegativeStock }, { merge: true });
          console.log(`Initialized negative stock to ${defaultNegativeStock}`);
        }

        // Initialize Admin PIN
        if (!settingsMap.has("adminPin")) {
          const settingsDoc = doc(db, `TenantsDb/${tenantId}/SETTINGS/adminPin`);
          await setDoc(settingsDoc, { pin: defaultAdminPin }, { merge: true });
          console.log(`Initialized admin PIN to ${defaultAdminPin}`);
        }

        // Initialize Owner Number
        if (!settingsMap.has("ownerNumber")) {
          const settingsDoc = doc(db, `TenantsDb/${tenantId}/SETTINGS/ownerNumber`);
          await setDoc(settingsDoc, { number: defaultOwnerNumber }, { merge: true });
          console.log(`Initialized owner number to ${defaultOwnerNumber}`);
        }

        // Initialize Currency and dispatch to CounterContext
        let currency = defaultCurrency;
        if (!settingsMap.has("currency")) {
          const settingsDoc = doc(db, `TenantsDb/${tenantId}/SETTINGS/currency`);
          await setDoc(settingsDoc, { code: defaultCurrency }, { merge: true });
          console.log(`Initialized currency to ${defaultCurrency}`);
        } else {
          currency = settingsMap.get("currency").code || defaultCurrency;
        }

        // Save currency to localStorage
        try {
          localStorage.setItem("tenant_currency", currency);
          console.log(`Saved currency ${currency} to localStorage`);
        } catch (err) {
          console.error("Error saving currency to localStorage:", err);
        }

        // Dispatch currency to CounterContext
        dispatch({ type: "SET_CURRENCY", payload: currency });

        setIsSettingsInitialized(true);
      } catch (err) {
        console.error("Error initializing settings:", err);

        // Fallback to localStorage currency or default
        let fallbackCurrency = defaultCurrency;
        try {
          const storedCurrency = localStorage.getItem("tenant_currency");
          if (storedCurrency) {
            fallbackCurrency = storedCurrency;
            console.log(`Using fallback currency from localStorage: ${fallbackCurrency}`);
          }
        } catch (err) {
          console.error("Error reading currency from localStorage:", err);
        }

        dispatch({ type: "SET_CURRENCY", payload: fallbackCurrency }); // Fallback to default or stored currency
        setIsSettingsInitialized(true); // Proceed to avoid infinite loading
      }
    };

    const checkAuthentication = async () => {
      // Try to get tenant_id from localStorage user object
      const userString = localStorage.getItem("tenant");
      let tenantIdFromStorage = null;

      if (userString) {
        try {
          const user = JSON.parse(userString);
          tenantIdFromStorage = user?.tenant_id || null;
        } catch (err) {
          console.error("Error parsing localStorage user:", err);
        }
      }

      const hasTenantId = !!(state.tenantId || tenantIdFromStorage);

      if (!hasTenantId) {
        setIsAuthenticated(false);
        router.push("/login");
      } else {
        const tenantId = state.tenantId || tenantIdFromStorage;

        // Set fallback currency from localStorage if available
        try {
          const storedCurrency = localStorage.getItem("tenant_currency");
          if (storedCurrency && !state.currency) {
            dispatch({ type: "SET_CURRENCY", payload: storedCurrency });
            console.log(`Set initial currency from localStorage: ${storedCurrency}`);
          }
        } catch (err) {
          console.error("Error reading currency from localStorage:", err);
        }

        // Initialize settings
        await initializeSettings(tenantId);
        setIsAuthenticated(true);
      }
    };

    checkAuthentication();
  }, [state.tenantId, state.currency, router, dispatch]); // Add state.currency to dependencies

  if (isAuthenticated === null || !isSettingsInitialized) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Loader />
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : null;
};

export default DashboardWrapper;