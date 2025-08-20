"use client";
import Navbar from "./Navbar";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  return (
    <>
      {!isLoginPage && <Navbar />}
      {children}
    </>
  );
} 