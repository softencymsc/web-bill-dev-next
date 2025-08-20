/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Image from "next/image";

const integrations = [
  { name: "Zomato", logo: "/Zomato.png" },
  { name: "Swiggy", logo: "/Swiggy_logo.png" },
  { name: "Thrive", logo: "/Thribe.webp" },
  { name: "DotPay", logo: "/Dotpay.jfif" },
  { name: "Upsale", logo: "/Upsale.webp" },
  { name: "Peppo", logo: "/peppo_india_logo.jfif" },
  { name: "EngageEdge", logo: "/Engage.png" },
];

export default function OnlineIntegration() {
  const [selected, setSelected] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    vendorCode: "",
    contact: "",
    email: "",
    numOrders: "",
    changeMenu: "",
    approxPerDay: "",
    chargeGST: "",
    packingCharge: "",
  });

  const handleSelect = (name: string) => {
    setSelected(name);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    setShowForm(true);
  };

  const handleSubmit = () => {
    console.log("Submitted", formData);
    setShowForm(false);
  };

  return (
    <div className="flex flex-col items-center p-6 max-w-screen mx-auto bg-gradient-to-b from-blue-50 to-white min-h-screen">
      <h1 className="text-4xl font-extrabold text-blue-800 mb-3 tracking-tight">
        Online Integration
      </h1>
      <p className="text-center text-blue-600 mb-8 max-w-2xl text-lg font-medium">
        Seamlessly manage third-party and end-customer orders from a unified dashboard with our powerful integrations.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {integrations.map((item) => (
          <Button
            key={item.name}
            onClick={() => handleSelect(item.name)}
            className={`relative flex flex-col items-center justify-between w-36 h-48 rounded-xl px-4 py-4 font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              selected === item.name
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-white text-blue-800 border border-blue-200 hover:bg-blue-100"
            }`}
          >
            <Image
              src={item.logo}
              alt={`${item.name} logo`}
              width={64}
              height={64}
              className="object-contain rounded-md mt-4"
            />
            <span className="text-base font-semibold mt-2 mb-4">{item.name}</span>
          </Button>
        ))}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md bg-white rounded-2xl shadow-2xl border border-blue-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-800">
              Confirm Integration
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-700 mb-6 text-base">
            Are you sure you want to start <strong>{selected}</strong> integration?
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              className="text-blue-600 hover:bg-blue-100 transition-colors"
            >
              No
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Integration Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg bg-white rounded-2xl shadow-2xl border border-blue-200 overflow-y-auto max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-800">
              {selected} Integration Details
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <Input
              placeholder="Vendor Code"
              value={formData.vendorCode}
              onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })}
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            />
            <Input
              placeholder="Contact Number"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            />
            <Input
              placeholder="Email ID"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            />
            <Input
              placeholder="Number of Orders"
              value={formData.numOrders}
              onChange={(e) => setFormData({ ...formData, numOrders: e.target.value })}
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            />
            <div className="space-y-2">
              <Label className="text-blue-700 font-semibold">
                Do you change your menu on {selected}?
              </Label>
              <RadioGroup
                onValueChange={(val) => setFormData({ ...formData, changeMenu: val })}
                defaultValue={formData.changeMenu}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="yes" className="text-blue-600" />
                  <Label htmlFor="yes" className="text-blue-700">Yes</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="no" className="text-blue-600" />
                  <Label htmlFor="no" className="text-blue-700">No</Label>
                </div>
              </RadioGroup>
            </div>
            <Input
              placeholder="Approx. Orders Per Day"
              value={formData.approxPerDay}
              onChange={(e) => setFormData({ ...formData, approxPerDay: e.target.value })}
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
            />
            <div className="space-y-2">
              <Label className="text-blue-700 font-semibold">
                Do you charge GST on your {selected} menu?
              </Label>
              <RadioGroup
                onValueChange={(val) => setFormData({ ...formData, chargeGST: val })}
                defaultValue={formData.chargeGST}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="gst-yes" className="text-blue-600" />
                  <Label htmlFor="gst-yes" className="text-blue-700">Yes</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="gst-no" className="text-blue-600" />
                  <Label htmlFor="gst-no" className="text-blue-700">No</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-blue-700 font-semibold">
                Do you have a packing charge?
              </Label>
              <RadioGroup
                onValueChange={(val) => setFormData({ ...formData, packingCharge: val })}
                defaultValue={formData.packingCharge}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="packing-yes" className="text-blue-600" />
                  <Label htmlFor="packing-yes" className="text-blue-700">Yes</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="packing-no" className="text-blue-600" />
                  <Label htmlFor="packing-no" className="text-blue-700">No</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowForm(false)}
              className="bg-gray-200 text-blue-800 hover:bg-gray-300 transition-colors"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}