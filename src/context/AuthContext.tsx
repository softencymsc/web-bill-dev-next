/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"
import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth, db } from "../../firebase";
import { collections } from "../config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

export const AuthContext = createContext<any>({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("tenant");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object" && parsed.tenant_id) return parsed;
          if (typeof parsed === "string") return { tenant_id: parsed };
        } catch {
          return { tenant_id: stored };
        }
      }
      return { tenant_id: "P2324" };
    }
    return { tenant_id: "P2324" };
  });

  const [company, setCompany] = useState(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("company") || "null") || null;
    }
    return null;
  });

  const [authRole, setAuthRole] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("authRole") || null;
    }
    return null;
  });

  const [token, setToken] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("token") || null;
    }
    return null;
  });

  const router = useRouter();

  const clearState = () => {
    localStorage.removeItem("tenant");
    localStorage.removeItem("company");
    sessionStorage.removeItem("authRole");
    sessionStorage.removeItem("token");
    setCompany(null);
    setTenant({ tenant_id: "P2324" });
    setAuthRole(null);
    setToken(null);
  };

  const getUserRefByEmail = async (email: string, tenantArg?: any) => {
    const usedTenant = tenantArg || tenant;
    if (!usedTenant?.tenant_id) {
      console.error("Tenant not initialized for getUserRefByEmail");
      return null;
    }
    const userRef = collection(db, `tenants/${usedTenant.tenant_id}/${collections.USERS}`);
    const q = query(userRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      setAuthRole(JSON.stringify(userData));
      return userData;
    }
    return null;
  };

  const getUserTenantIdByEmail = async (email: string) => {
    const userRef = doc(db, collections.TENANTS, email);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const tenantData = { tenant_id: docSnap.id, ...docSnap.data() };
      setTenant(tenantData);
      localStorage.setItem("tenant", JSON.stringify(tenantData));
      return tenantData;
    }
    await logout();
    return null;
  };

  const getCompanyDetailsByTenantId = async (tenantId: string) => {
    const tenantDocumentRef = doc(db, collections.TENANTSDB, tenantId);
    try {
      const tenantDocumentSnapshot = await getDoc(tenantDocumentRef);
      if (tenantDocumentSnapshot.exists()) {
        const companyData = tenantDocumentSnapshot.data();
        setCompany(companyData);
        localStorage.setItem("company", JSON.stringify(companyData));
        return companyData;
      }
      localStorage.removeItem("company");
      setCompany(null);
      return null;
    } catch (error) {
      console.error("Error getting company details:", error);
      localStorage.removeItem("company");
      setCompany(null);
      throw error;
    }
  };

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    try {
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      setUser(userCredential.user);
      setToken(idToken);
      sessionStorage.setItem("token", idToken);

      // 2. Get tenant information
      const tenantData = await getUserTenantIdByEmail(email);
      if (!tenantData) {
        throw new Error("No tenant found for user email");
      }

      // 3. Get company details
      await getCompanyDetailsByTenantId(tenantData.tenant_id);

      // 4. Get user role
      const userData = await getUserRefByEmail(email, tenantData);
      if (userData) {
        setAuthRole(JSON.stringify(userData));
      }

      return true;
    } catch (error: any) {
      console.error("Sign-in error:", error);
      await logout();
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      clearState();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          const tenantData = await getUserTenantIdByEmail(currentUser.email!);
          if (tenantData) {
            setUser(currentUser);
            setToken(idToken);
            sessionStorage.setItem("token", idToken);
            await getCompanyDetailsByTenantId(tenantData.tenant_id);
            const userData = await getUserRefByEmail(currentUser.email!, tenantData);
            if (userData) {
              setAuthRole(JSON.stringify(userData));
            }
          } else {
            await logout();
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
          await logout();
        }
      } else {
        await logout();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("token");
      const tenant = localStorage.getItem("tenant");
      const company = localStorage.getItem("company");
      const isLoginPage = window.location.pathname === "/login";
      if (!token || !tenant || !company) {
        if (!isLoginPage) {
          router.push("/login");
        }
      } else if (isLoginPage && token && tenant && company) {
        router.push("/");
      }
    }
  }, [router]);

  const myCollection = (cname: string) => {
    const tenantId = tenant?.tenant_id || null;
    if (!tenantId || !cname) {
      console.error("Cannot create collection reference", { tenantId, cname });
      return null;
    }
    try {
      const tenantsCollection = collection(db, collections.TENANTSDB);
      const tenantDocRef = doc(tenantsCollection, tenantId);
      const ref = collection(tenantDocRef, cname);
      return ref;
    } catch (error) {
      console.error("Error creating collection reference:", error);
      return null;
    }
  };

  const value = {
    user,
    token,
    authRole,
    tenant,
    myCollection,
    company,
    signIn,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}