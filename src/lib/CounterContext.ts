/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { createContext, useReducer, useEffect } from "react";
import { initialState } from "./reducer";
import React from "react";
import { Reducer } from "react";
import { Customer, Product, PaymentData } from "@/types/page";
import { db } from "../../firebase";
import { doc, getDocs, collection } from "firebase/firestore";
import { toast } from "react-toastify";

export type PaymentType = "Cash" | "Card" | "UPI" | "Credit" | "Free";

interface BillData {
  BILL_NO: string;
  CUSTNAME: string;
  MOBPHONE: string;
  RECEIPT_NO: string;
}

interface State {
  totalBillAmount: number;
  oaNo?: string | any;
  currentTenant: string;
  cardDetails: object;
  confirmedPayments: object;
  outstandingAmount: number;
  totalPayments: number;
  freeBill: boolean;
  paymentData: PaymentData | undefined;
  count: number;
  products: Product[];
  customerData: Customer | undefined;
  invoiceNumber: string | undefined;
  tenantId: string;
  billNo?: string | any;
  addedProducts: Product[];
  userId?: string | undefined;
  currency: string;
  billData?: BillData | undefined;
}

interface SetProductsAction {
  type: "SET_PRODUCTS";
  payload: Product[];
}

interface SetCustomerAction {
  type: "SET_CUSTOMER";
  payload: Customer | undefined;
}

interface UpdateProductAction {
  type: "UPDATE_PRODUCT";
  payload: { id: string; QUANTITY: string };
}

interface RemoveProductAction {
  type: "REMOVE_PRODUCT";
  payload: string;
}

interface ProcessPaymentAction {
  type: "PROCESS_PAYMENT";
  payload: PaymentData;
}

interface SetBillNoAction {
  type: "SET_BILL_NO";
  payload: string;
}

interface SetAddedProductsAction {
  type: "SET_ADDED_PRODUCTS";
  payload: Product[];
}

interface SetOANoAction {
  type: "SET_OA_NO";
  payload: string;
}

interface ResetStateAction {
  type: "RESET_STATE";
  payload: {
    products: Product[];
    addedProducts: Product[];
    customerData: Customer | undefined;
    tenantId: string;
    oaNo: string | undefined;
    currency: string;
  };
}

interface UpdateBothAction {
  type: "UPDATE_BOTH";
  payload: { products: Product[]; addedProducts: Product[] };
}

interface RemoveBothAction {
  type: "REMOVE_BOTH";
  payload: string;
}

interface SetCurrencyAction {
  type: "SET_CURRENCY";
  payload: string;
}

interface SetBillDataAction {
  type: "SET_BILL_DATA";
  payload: BillData | undefined;
}

type Action =
  | SetProductsAction
  | SetCustomerAction
  | UpdateProductAction
  | RemoveProductAction
  | ProcessPaymentAction
  | SetBillNoAction
  | SetAddedProductsAction
  | SetOANoAction
  | ResetStateAction
  | UpdateBothAction
  | RemoveBothAction
  | SetCurrencyAction
  | SetBillDataAction;

export const CounterContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
}>({
  state: initialState,
  dispatch: () => {},
});

export const CounterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const fetchCurrency = async () => {
      if (!state.tenantId) return;

      try {
        const settingsCollection = collection(db, `TenantsDb/${state.tenantId}/SETTINGS`);
        const settingsSnapshot = await getDocs(settingsCollection);
        const currencyDoc = settingsSnapshot.docs.find((d) => d.id === "currency");

        const currency = currencyDoc?.data()?.code || "₹";
        dispatch({ type: "SET_CURRENCY", payload: currency });
      } catch (err) {
        console.error("Error fetching currency:", err);
        // toast.error(`Error fetching currency: ${err}`);
        dispatch({ type: "SET_CURRENCY", payload: "₹" });
      }
    };

    fetchCurrency();
  }, [state.tenantId]);

  return React.createElement(
    CounterContext.Provider,
    { value: { state, dispatch } },
    children
  );
};

const reducer: Reducer<State, Action> = (state: State, action: Action): State => {
  switch (action.type) {
    case "SET_PRODUCTS":
      return { ...state, products: action.payload };
    case "SET_CUSTOMER":
      return { ...state, customerData: action.payload };
    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload.id ? { ...p, QUANTITY: action.payload.QUANTITY } : p
        ),
      };
    case "REMOVE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload ? { ...p, QUANTITY: "0" } : p
        ),
        addedProducts: state.addedProducts.filter((p) => p.id !== action.payload),
      };
    case "PROCESS_PAYMENT":
      return { ...state, paymentData: action.payload };
    case "SET_BILL_NO":
      return { ...state, billNo: action.payload };
    case "SET_ADDED_PRODUCTS":
      return { ...state, addedProducts: action.payload };
    case "SET_OA_NO":
      return { ...state, oaNo: action.payload };
    case "RESET_STATE":
      return {
        ...state,
        products: action.payload.products,
        addedProducts: action.payload.addedProducts,
        customerData: action.payload.customerData,
        tenantId: action.payload.tenantId,
        oaNo: action.payload.oaNo,
        currency: action.payload.currency,
        billNo: undefined,
        paymentData: undefined,
        totalBillAmount: 0,
        outstandingAmount: 0,
        totalPayments: 0,
        freeBill: false,
        billData: undefined,
      };
    case "UPDATE_BOTH":
      return {
        ...state,
        products: action.payload.products,
        addedProducts: action.payload.addedProducts,
      };
    case "REMOVE_BOTH":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload ? { ...p, QUANTITY: "0" } : p
        ),
        addedProducts: state.addedProducts.filter((p) => p.id !== action.payload),
      };
    case "SET_CURRENCY":
      return { ...state, currency: action.payload };
    case "SET_BILL_DATA":
      return { ...state, billData: action.payload };
    default:
      return state;
  }
};