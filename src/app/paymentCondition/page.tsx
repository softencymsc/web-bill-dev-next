import { Suspense } from "react";
import PaymentCondition from "../../components/PaymentBill";

export default function PaymentConditionPage() {
  return (
    <Suspense fallback={<div>Loading payment details...</div>}>
      <PaymentCondition />
    </Suspense>
  );
}