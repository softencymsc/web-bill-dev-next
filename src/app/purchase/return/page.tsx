/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
/* eslint-disable react-hooks/rules-of-hooks */
import AddCustomer from "@/components/AddCustomer";
import AddProduct from "@/components/AddProduct";
import React, { useContext } from "react";
import { CounterContext } from "@/lib/CounterContext";
import PurchaseRetunCus from "@/components/PurchaseReturnCus";

const page = () => {
  const { state } = useContext(CounterContext);
  const id=null;
  return (
    <main className="flex max-w-full overflow-hidden h-full flex-col md:flex-row">
      <section className="md:w-[70%] md:h-full w-full h-2/3">
        <AddProduct page={"purchaseReturn"} tenantId={state.tenantId} id="" />
      </section>
      <section className="lg:w-[30%] w-full h-full">
        <PurchaseRetunCus page={"Purchase Bill"} id="" />
      </section>
    </main>
  );
};

export default page;