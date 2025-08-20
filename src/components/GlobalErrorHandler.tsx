"use client";
import { useEffect } from "react";

export default function GlobalErrorHandler() {
  useEffect(() => {
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason && event.reason.code === "permission-denied") {
        window.location.href = "/login";
      }
      event.preventDefault();
    });
  }, []);
  return null;
}