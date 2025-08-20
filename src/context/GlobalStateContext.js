import { query } from "firebase/database";
import { collection, onSnapshot } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useReducer } from "react";
import { db } from "../firebase";
import { collections } from "../config";
import { useAuth } from "./AuthContext";

const GlobalStateContext = createContext();
const initialState = {
  customers: [],
  vendors: [],
  products: [],
  bill: [],
  billDet: [],
  billTerm: [],
  retRef: [],
  addedProducts: [],
  customerDetails: [],
  sidebarOpen: false,
  modify: false,
  sync: false,
  splOrd: [],
  orderSlot: "",
};

const globalStateReducer = (state, action) => {
  switch (action.type) {
    case "SET_CUSTOMERS":
      return { ...state, customers: action.payload };
    case "SET_VENDORS":
      return { ...state, vendors: action.payload };
    case "SET_PRODUCTS":
      return { ...state, products: action.payload };
    case "SET_Bill":
      return { ...state, bill: action.payload };
    case "SET_BillDET":
      return { ...state, billDet: action.payload };
    case "SET_BillTERM":
      return { ...state, billTerm: action.payload };
    case "SET_RETREF":
      return { ...state, retRef: action.payload };
    case "SET_SPLORD":
      return { ...state, splOrd: action.payload };
    case "SET_ORDERSLOT":
      return { ...state, orderSlot: action.payload };
    case "SYNC":
      return { ...state, sync: action.payload };
    case "SAVE_PRODUCTS":
      return { ...state, addedProducts: action.payload };
    case "SAVE_CUSTOMER":
      return { ...state, customerDetails: action.payload };
    case "REMOVE_CUSTOMER":
      return { ...state, customerDetails: [] };
    case "REMOVE_PRODUCTS":
      return { ...state, addedProducts: [] };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case "TOGGLE_MODIFY":
      return { ...state, modify: !state.modify };
    case "IS_DRAFT_MODIFY":
      return { ...state, modify: true };
    case "RESET_MODIFY":
      return { ...state, modify: false };
    default:
      return state;
  }
};

export const GlobalStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(globalStateReducer, initialState);

  return (
    <GlobalStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error("useGlobalState must be used within a GlobalStateProvider");
  }
  return context;
};