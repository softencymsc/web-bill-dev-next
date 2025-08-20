/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { ReactNode } from "react";
import ScreenSaverWrapper from "@/components/ScreenSaverWrapper";
import "./globals.css";
import { CounterProvider } from "../lib/CounterContext";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "@/components/ProtectedRoute";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "TNB POS",
  description: "A point-of-sale system for your cake shop",
  icons: {
    icon: "/tnb4.png",
  },
};

// ✅ Correct way to disable zoom on mobile using Next.js App Router:
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: "no",
};

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CounterProvider>
        <ToastContainer />
        <Toaster />
        <GlobalErrorHandler />
        {/* <ScreenSaverWrapper /> */}
        <AppShell>{children}</AppShell>
      </CounterProvider>
    </AuthProvider>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/tnb4.png" type="image/png" />
      </head>
      <body className="relative">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
