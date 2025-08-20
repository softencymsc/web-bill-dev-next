// app/sale/order/view/page.tsx
"use client";

import React, { useContext, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AddCustomer from "@/components/AddCustomer";
import AddProduct from "@/components/AddProduct";
import { CounterContext } from "@/lib/CounterContext";
import UpdateCustomer from "@/components/UpdateCustomer";

// Context type
interface CounterContextType {
  state: {
    tenantId: string;
  };
}

const PageContent: React.FC = () => {
  const { state } = useContext(CounterContext) as CounterContextType;
  const searchParams = useSearchParams();
  const id = searchParams?.get("id") ?? "";

  return (
    <main className="flex max-w-full overflow-hidden h-full flex-col md:flex-row">
      <section className="md:w-[75%] md:h-full w-full h-2/3">
        <AddProduct page="Sale Order" tenantId={state.tenantId} id={id} />
      </section>
      <section className="lg:w-[25%] w-full h-full">
        <UpdateCustomer page="Sale Order" id={id} />
      </section>
    </main>
  );
};

const Page: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  );
};

export default Page;
