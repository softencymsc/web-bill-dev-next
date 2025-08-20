// app/sale/bill/view/page.tsx
"use client";

import AddCustomer from "@/components/AddCustomer";
import AddProduct from "@/components/AddProduct";
import React, { useState, useContext, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CounterContext } from "@/lib/CounterContext";

interface CounterContextType {
  state: {
    tenantId: string;
  };
}

const PageContent = () => {
  const { state } = useContext(CounterContext) as CounterContextType;
  const searchParams = useSearchParams();
  const [page] = useState("Sale Bill");
  const id = searchParams?.get("id") ?? "";

  return (
    <main className="flex max-w-full overflow-hidden h-full flex-col md:flex-row">
      <section className="md:w-[75%] md:h-full w-full h-2/3">
        <AddProduct tenantId={state.tenantId} page={page} id={id} />
      </section>
      <section className="lg:w-[25%] w-full h-full">
        <AddCustomer page={page} id={id} />
      </section>
    </main>
  );
};

const Page = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <PageContent />
  </Suspense>
);

export default Page;
