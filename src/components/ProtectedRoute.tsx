"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Loader from "./Loader";
import Navbar from "./Navbar";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = sessionStorage.getItem("token");
      const tenant = localStorage.getItem("tenant");
      const company = localStorage.getItem("company");
      const isLoginPage = window.location.pathname === "/login";
      
      if ((!token || !tenant || !company) && !isLoginPage) {
        router.push("/login");
        setIsAuthenticated(false);
      } else if (isLoginPage) {
        // If on login page, allow rendering the login page
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();
  }, [router]);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Loader />
      </div>
    );
  }

  // Check if we're on the login page
  const isLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";
  
  // Render children if authenticated OR if on login page
  const shouldRenderContent = isAuthenticated || isLoginPage;
  
  if (!shouldRenderContent) {
    return null;
  }

  return (
    <>
      {/* Only show Navbar if NOT on login page */}
      {!isLoginPage && <Navbar />}
      {children}
    </>
  );
}