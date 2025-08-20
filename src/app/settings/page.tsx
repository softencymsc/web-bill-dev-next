/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useState, useEffect, ChangeEvent, useContext } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { updateModelPrefix } from "@/services";
import { CounterContext } from "@/lib/CounterContext";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import { currencies } from "@/utils/pages";
import { collection, getDocs, addDoc, updateDoc, doc, setDoc } from "firebase/firestore";

// Allowed document types
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

// Available calendar types
const calendarTypes = [
  "Gregorian",
  "Bikram Sambat"
];

interface PromoCode {
  id: string;
  code: string;
  percentage: number;
}

const SettingsPage = () => {
  const [formData, setFormData] = useState({
    documentType: "Sale Bill",
    prefix: "",
  });
  const [promoForm, setPromoForm] = useState({
    code: "",
    percentage: "",
  });
  const [adminPin, setAdminPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [ownerNumber, setOwnerNumber] = useState("");
  const [newOwnerNumber, setNewOwnerNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [numberError, setNumberError] = useState("");
  const { state } = useContext(CounterContext);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("₹"); 
  const [selectedCalendar, setSelectedCalendar] = useState<string>("Gregorian");

  function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePromoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPromoForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePinChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "adminPin") {
      setAdminPin(value);
    } else if (name === "confirmPin") {
      setConfirmPin(value);
    }
  };

  const handleOwnerNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^0-9+]/g, "");
    if (value.startsWith("+91")) {
      setNewOwnerNumber(value);
    } else {
      setNewOwnerNumber(`+91${value.replace(/^\D+/, "")}`);
    }
    if (value === "+91" || value.length < 13) {
      setNumberError("Please enter a 10-digit number after +91");
    } else if (!/^\+91\d{10}$/.test(value)) {
      setNumberError("Invalid Indian phone number. Must be 10 digits (e.g., +919876543210)");
    } else {
      setNumberError("");
    }
  };

  const handleOtpChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setOtp(value);
  };

  const handleCurrencyChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(e.target.value);
  };

  const handleCalendarChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCalendar(e.target.value);
  };

  const handleUpdatePrefix = async () => {
    try {
      if (!state?.tenantId || !formData.prefix.trim()) {
        // toast.error("Missing Tenant ID or Prefix");
        return;
      }

      await updateModelPrefix(state.tenantId, formData.documentType, formData.prefix.trim());
      toast.success("Prefix updated successfully!");
      console.log(`Updated ${formData.documentType} prefix to ${formData.prefix}`);
    } catch (err) {
      // toast.error(`Error updating prefix: ${err}`);
    }
  };

  const fetchPromoCodes = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      const promoCollection = collection(db, `TenantsDb/${state.tenantId}/PROMOCODES`);
      const promoSnapshot = await getDocs(promoCollection);
      const promoList = promoSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PromoCode[];
      setPromoCodes(promoList);
    } catch (err) {
      // toast.error(`Error fetching promo codes: ${err}`);
    }
  };

  const handleAddOrUpdatePromo = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      if (!promoForm.code.trim() || !promoForm.percentage) {
        // toast.error("Promo code and percentage are required");
        return;
      }
      const percentage = parseFloat(promoForm.percentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        // toast.error("Percentage must be a number between 0 and 100");
        return;
      }

      const promoCollection = collection(db, `TenantsDb/${state.tenantId}/PROMOCODES`);
      if (editingPromoId) {
        const promoDoc = doc(db, `TenantsDb/${state.tenantId}/PROMOCODES`, editingPromoId);
        await updateDoc(promoDoc, {
          code: promoForm.code.trim().toUpperCase(),
          percentage,
        });
        toast.success("Promo code updated successfully!");
        setEditingPromoId(null);
      } else {
        await addDoc(promoCollection, {
          code: promoForm.code.trim().toUpperCase(),
          percentage,
        });
        toast.success("Promo code added successfully!");
      }
      setPromoForm({ code: "", percentage: "" });
      await fetchPromoCodes();
    } catch (err) {
      // toast.error(`Error saving promo code: ${err}`);
    }
  };

  const handleEditPromo = (promo: PromoCode) => {
    setPromoForm({
      code: promo.code,
      percentage: promo.percentage.toString(),
    });
    setEditingPromoId(promo.id);
  };

  const fetchNegativeStockSetting = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/negativeStock`);
      const docSnap = await getDocs(collection(db, `TenantsDb/${state.tenantId}/SETTINGS`));
      const settings = docSnap.docs.find((d) => d.id === "negativeStock");
      if (settings) {
        setAllowNegativeStock(settings.data().allowNegativeStock || false);
      }
    } catch (err) {
      // toast.error(`Error fetching negative stock setting: ${err}`);
    }
  };

  const handleToggleNegativeStock = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/negativeStock`);
      await setDoc(settingsDoc, {
        allowNegativeStock: !allowNegativeStock,
      }, { merge: true });
      setAllowNegativeStock(!allowNegativeStock);
      toast.success(`Negative stock ${!allowNegativeStock ? "enabled" : "disabled"} successfully!`);
    } catch (err) {
      // toast.error(`Error updating negative stock setting: ${err}`);
    }
  };

  const fetchAdminPin = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/adminPin`);
      const docSnap = await getDocs(collection(db, `TenantsDb/${state.tenantId}/SETTINGS`));
      const settings = docSnap.docs.find((d) => d.id === "adminPin");
      if (settings && settings.data().pin) {
        setAdminPin(settings.data().pin);
        setConfirmPin(settings.data().pin);
      }
    } catch (err) {
      // toast.error(`Error fetching admin PIN: ${err}`);
    }
  };

  const handleUpdateAdminPin = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      if (!adminPin.trim() || !confirmPin.trim()) {
        // toast.error("Both PIN and confirmation are required");
        return;
      }
      if (adminPin !== confirmPin) {
        // toast.error("PINs do not match");
        return;
      }
      if (!/^\d{4}$/.test(adminPin)) {
        // toast.error("PIN must be exactly 4 digits");
        return;
      }

      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/adminPin`);
      await setDoc(settingsDoc, { pin: adminPin }, { merge: true });
      toast.success("Admin PIN updated successfully!");
      setAdminPin("");
      setConfirmPin("");
      await fetchAdminPin();
    } catch (err) {
      // toast.error(`Error updating admin PIN: ${err}`);
    }
  };

  const fetchOwnerNumber = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/ownerNumber`);
      const docSnap = await getDocs(collection(db, `TenantsDb/${state.tenantId}/SETTINGS`));
      const settings = docSnap.docs.find((d) => d.id === "ownerNumber");
      if (settings && settings.data().number) {
        setOwnerNumber(settings.data().number);
      }
    } catch (err) {
      // toast.error(`Error fetching owner number: ${err}`);
    }
  };

  const handleSendOtp = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      if (!newOwnerNumber.trim()) {
        // toast.error("New phone number is required");
        setNumberError("New phone number is required");
        return;
      }
      let formattedNumber = newOwnerNumber.trim();
      if (!formattedNumber.startsWith("+91")) {
        formattedNumber = `+91${formattedNumber.replace(/^\D+/, "")}`;
      }
      if (!/^\+91\d{10}$/.test(formattedNumber)) {
        // toast.error("Please enter a valid 10-digit Indian phone number (e.g., +919876543210)");
        setNumberError("Invalid Indian phone number. Must be 10 digits (e.g., +919876543210)");
        return;
      }

      const otp = generateOtp();
      setGeneratedOtp(otp);

      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: state.tenantId,
          phoneNumber: ownerNumber || formattedNumber,
          otp,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("OTP sent successfully!");
        setOtpSent(true);
        setNumberError("");
      } else {
        // toast.error(data.error || "Failed to send OTP");
        setNumberError(data.error || "Failed to send OTP");
      }
    } catch (err) {
      // toast.error(`Error sending OTP: ${err}`);
      setNumberError(`Error sending OTP: ${err}`);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      if (!otp.trim()) {
        // toast.error("OTP is required");
        return;
      }
      if (!/^\d{6}$/.test(otp)) {
        // toast.error("OTP must be a 6-digit number");
        return;
      }
      let formattedNumber = newOwnerNumber.trim();
      if (!formattedNumber.startsWith("+91")) {
        formattedNumber = `+91${formattedNumber.replace(/^\D+/, "")}`;
      }
      if (!/^\+91\d{10}$/.test(formattedNumber)) {
        // toast.error("Invalid Indian phone number. Must be 10 digits (e.g., +919876543210)");
        setNumberError("Invalid Indian phone number. Must be 10 digits (e.g., +919876543210)");
        return;
      }

      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: state.tenantId,
          phoneNumber: formattedNumber,
          otp,
          generatedOtp,
          newPhoneNumber: formattedNumber,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const ownerNumberDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/ownerNumber`);
        await setDoc(ownerNumberDoc, { number: formattedNumber }, { merge: true });

        toast.success("Phone number updated successfully!");
        setOwnerNumber(formattedNumber);
        setNewOwnerNumber("");
        setOtp("");
        setOtpSent(false);
        setNumberError("");
        await fetchOwnerNumber();
      } else {
        // toast.error(data.error || "Invalid OTP");
      }
    } catch (err) {
      // toast.error(`Error verifying OTP: ${err}`);
    }
  };

  const fetchCurrency = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/currency`);
      const docSnap = await getDocs(collection(db, `TenantsDb/${state.tenantId}/SETTINGS`));
      const settings = docSnap.docs.find((d) => d.id === "currency");
      if (settings && settings.data().code) {
        setSelectedCurrency(settings.data().code);
      }
    } catch (err) {
      // toast.error(`Error fetching currency: ${err}`);
    }
  };

  const handleUpdateCurrency = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      if (!selectedCurrency) {
        // toast.error("Please select a currency");
        return;
      }
      if (!currencies.some((c) => c.code === selectedCurrency)) {
        // toast.error("Invalid currency selected");
        return;
      }

      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/currency`);
      await setDoc(settingsDoc, { code: selectedCurrency }, { merge: true });
      toast.success("Currency updated successfully!");
      await fetchCurrency();
    } catch (err) {
      // toast.error(`Error updating currency: ${err}`);
    }
  };

  const fetchCalendarType = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/calendar`);
      const docSnap = await getDocs(collection(db, `TenantsDb/${state.tenantId}/SETTINGS`));
      const settings = docSnap.docs.find((d) => d.id === "calendar");
      if (settings && settings.data().calendarType) {
        setSelectedCalendar(settings.data().calendarType);
      }
    } catch (err) {
      // toast.error(`Error fetching calendar type: ${err}`);
    }
  };

  const handleUpdateCalendar = async () => {
    try {
      if (!state?.tenantId) {
        // toast.error("Tenant ID is missing");
        return;
      }
      if (!selectedCalendar) {
        // toast.error("Please select a calendar type");
        return;
      }
      if (!calendarTypes.includes(selectedCalendar)) {
        // toast.error("Invalid calendar type selected");
        return;
      }

      const settingsDoc = doc(db, `TenantsDb/${state.tenantId}/SETTINGS/Calendar`);
      await setDoc(settingsDoc, { calendartype: selectedCalendar }, { merge: true });
      toast.success("Calendar type updated successfully!");
      await fetchCalendarType();
    } catch (err) {
      // toast.error(`Error updating calendar type: ${err}`);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
    fetchNegativeStockSetting();
    fetchAdminPin();
    fetchOwnerNumber();
    fetchCurrency();
    fetchCalendarType();
  }, [state?.tenantId]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>
      <Tabs defaultValue="doc-numbering" className="w-full">
        <TabsList className="bg-white shadow-sm rounded-lg p-1 mb-6">
          <TabsTrigger
            value="doc-numbering"
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
          >
            Document Numbering
          </TabsTrigger>
          <TabsTrigger
            value="promo-codes"
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
          >
            Promo Codes
          </TabsTrigger>
          <TabsTrigger
            value="stock-settings"
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
          >
            Stock Settings
          </TabsTrigger>
          <TabsTrigger
            value="admin-pin"
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
          >
            Admin PIN
          </TabsTrigger>
          <TabsTrigger
            value="owner-number"
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
          >
            Owner Number
          </TabsTrigger>
          <TabsTrigger
            value="currency"
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
          >
            Currency
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
          >
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="doc-numbering" className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid gap-6 max-w-2xl">
            <h2 className="text-xl font-semibold text-gray-800">Document Numbering</h2>
            <div className="grid gap-2">
              <Label htmlFor="documentType" className="text-sm font-medium text-gray-700">
                Select Document Type
              </Label>
              <select
                name="documentType"
                value={formData.documentType}
                onChange={handleChange}
                className={cn(
                  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                )}
              >
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prefix" className="text-sm font-medium text-gray-700">
                Edit Prefix
              </Label>
              <Input
                name="prefix"
                value={formData.prefix.toUpperCase()}
                onChange={handleChange}
                placeholder="e.g. SPE"
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleUpdatePrefix}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
            >
              Update Prefix
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="promo-codes" className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid gap-6 max-w-2xl">
            <h2 className="text-xl font-semibold text-gray-800">Promo Codes</h2>
            <div className="grid gap-2">
              <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                Promo Code
              </Label>
              <Input
                name="code"
                value={promoForm.code.toUpperCase()}
                onChange={handlePromoChange}
                placeholder="e.g. DISCOUNT10"
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="percentage" className="text-sm font-medium text-gray-700">
                Discount Percentage
              </Label>
              <Input
                name="percentage"
                type="number"
                value={promoForm.percentage}
                onChange={handlePromoChange}
                placeholder="e.g. 10"
                min="0"
                max="100"
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleAddOrUpdatePromo}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
            >
              {editingPromoId ? "Update Promo Code" : "Add Promo Code"}
            </Button>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Existing Promo Codes</h3>
              {promoCodes.length === 0 ? (
                <p className="text-gray-500">No promo codes found.</p>
              ) : (
                <ul className="space-y-2">
                  {promoCodes.map((promo) => (
                    <li
                      key={promo.id}
                      className="flex justify-between items-center p-3 border rounded-md bg-gray-50"
                    >
                      <span className="text-gray-700">
                        {promo.code} - {promo.percentage}% off
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPromo(promo)}
                        className="border-blue-500 text-blue-500 hover:bg-blue-50"
                      >
                        Edit
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock-settings" className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid gap-6 max-w-2xl">
            <h2 className="text-xl font-semibold text-gray-800">Stock Settings</h2>
            <div className="flex items-center space-x-4">
              <Label htmlFor="negativeStockToggle" className="text-sm font-medium text-gray-700">
                Allow Negative Stock
              </Label>
              <Switch
                id="negativeStockToggle"
                checked={allowNegativeStock}
                onCheckedChange={handleToggleNegativeStock}
              />
            </div>
            <p className="text-sm text-gray-500">
              {allowNegativeStock
                ? "Negative stock is enabled. Inventory can go below zero."
                : "Negative stock is disabled. Inventory cannot go below zero."}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="admin-pin" className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid gap-6 max-w-2xl">
            <h2 className="text-xl font-semibold text-gray-800">Admin PIN</h2>
            <div className="grid gap-2">
              <Label htmlFor="adminPin" className="text-sm font-medium text-gray-700">
                Admin PIN (4 digits)
              </Label>
              <Input
                name="adminPin"
                type="password"
                value={adminPin}
                onChange={handlePinChange}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPin" className="text-sm font-medium text-gray-700">
                Confirm PIN
              </Label>
              <Input
                name="confirmPin"
                type="password"
                value={confirmPin}
                onChange={handlePinChange}
                placeholder="Confirm 4-digit PIN"
                maxLength={4}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleUpdateAdminPin}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
            >
              Update Admin PIN
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="owner-number" className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid gap-6 max-w-2xl">
            <h2 className="text-xl font-semibold text-gray-800">Owner Number</h2>
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-gray-700">
                Current Owner Number
              </Label>
              <p className="text-gray-700">{ownerNumber || "Not set"}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newOwnerNumber" className="text-sm font-medium text-gray-700">
                New Owner Number
              </Label>
              <Input
                name="newOwnerNumber"
                value={newOwnerNumber}
                onChange={handleOwnerNumberChange}
                placeholder="+919876543210"
                maxLength={13}
                className={cn(
                  "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  numberError && "border-red-500"
                )}
                disabled={otpSent}
              />
              {numberError && (
                <p className="text-sm text-red-500">{numberError}</p>
              )}
            </div>
            {otpSent && (
              <div className="grid gap-2">
                <Label htmlFor="otp" className="text-sm font-medium text-gray-700">
                  Enter OTP
                </Label>
                <Input
                  name="otp"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <Button
              onClick={otpSent ? handleVerifyOtp : handleSendOtp}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
              disabled={!!numberError && !otpSent}
            >
              {otpSent ? "Verify OTP" : "Send OTP"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="currency" className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid gap-6 max-w-2xl">
            <h2 className="text-xl font-semibold text-gray-800">Currency Settings</h2>
            <div className="grid gap-2">
              <Label htmlFor="currency" className="text-sm font-medium text-gray-700">
                Select Currency
              </Label>
              <select
                name="currency"
                value={selectedCurrency}
                onChange={handleCurrencyChange}
                className={cn(
                  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                )}
              >
                {currencies.map((currency) => (
                  <option key={currency.name} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleUpdateCurrency}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
            >
              Update Currency
            </Button>
            <p className="text-sm text-gray-500">
              Current currency: {selectedCurrency || "Not set"}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid gap-6 max-w-2xl">
            <h2 className="text-xl font-semibold text-gray-800">Calendar Settings</h2>
            <div className="grid gap-2">
              <Label htmlFor="calendar" className="text-sm font-medium text-gray-700">
                Select Calendar Type
              </Label>
              <select
                name="calendar"
                value={selectedCalendar}
                onChange={handleCalendarChange}
                className={cn(
                  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                )}
              >
                {calendarTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleUpdateCalendar}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
            >
              Update Calendar
            </Button>
            {/* <p className="text-sm text-gray-500">
              Current calendar: {selectedCalendar || "Not set"}
            </p> */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;