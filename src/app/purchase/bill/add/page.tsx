/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
/* eslint-disable react-hooks/rules-of-hooks */
import AddCustomer from "@/components/AddCustomer";
import AddProduct from "@/components/AddProduct";
import React, { useContext } from "react";
import { CounterContext } from "@/lib/CounterContext";

const page = () => {
  const { state } = useContext(CounterContext);
  const id=null;
  return (
    <main className="flex max-w-full overflow-hidden h-full flex-col md:flex-row">
      <section className="md:w-[70%] md:h-full w-full h-2/3">
        <AddProduct page={"purchaseBill"} tenantId={state.tenantId} id="" />
      </section>
      <section className="lg:w-[30%] w-full h-full">
        <AddCustomer page={"Purchase Bill"} id="" />
      </section>
    </main>
  );
};

export default page;