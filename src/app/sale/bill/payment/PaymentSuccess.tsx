/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CounterContext } from "@/lib/CounterContext";
import { useContext } from "react";

export default function PaymentSuccess() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "failure">("loading");
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, dispatch } = useContext(CounterContext);

  useEffect(() => {
    const processPayment = async () => {
      try {
        setTimeout(() => {
          setStatus("success");
          audioRef.current?.play();
        }, 1500);

        setTimeout(() => {
          router.replace("/sale/bill/add");
        }, 3000);
      } catch (error) {
        setStatus("failure");
        setTimeout(() => {
          router.replace("/sale/bill/add");
        }, 3000);
      }
    };

    processPayment();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      {status === "loading" && (
        <div className="flex flex-col items-center">
          <div className="loader mb-6"></div>
          <span className="text-lg font-semibold text-gray-700">Processing Payment...</span>
        </div>
      )}
      {status === "success" && (
        <div className="flex flex-col items-center">
          <svg className="w-24 h-24 text-green-500 animate-bounce" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="white" />
            <path d="M7 13l3 3 7-7" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-2xl font-bold text-green-600 mt-4">Payment Successful!</span>
        </div>
      )}
      {status === "failure" && (
        <div className="flex flex-col items-center">
          <svg className="w-24 h-24 text-red-500 animate-bounce" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="white" />
            <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-2xl font-bold text-red-600 mt-4">Payment Failed!</span>
        </div>
      )}
      <audio ref={audioRef} src="/Payment.mp3" preload="auto" />
      <style jsx>{`
        .loader {
          border: 6px solid #e5e7eb;
          border-top: 6px solid #22c55e;
          border-radius: 50%;
          width: 64px;
          height: 64px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg);}
          100% { transform: rotate(360deg);}
        }
      `}</style>
    </div>
  );
}