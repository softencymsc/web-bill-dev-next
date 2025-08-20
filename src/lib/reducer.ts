/* eslint-disable @typescript-eslint/no-explicit-any */
import { Customer, Product, PaymentData } from '@/types/page';

// Define the shape of the tenant object stored in localStorage
interface Tenant {
  tenant_id: string;
  role: string;
  PHONE: number;
  email: string;
}

// Function to get tenantId from localStorage with fallback
const getTenantIdFromLocalStorage = (): string => {
  // Check if running in a browser environment
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const tenantData = localStorage.getItem("tenant");
      if (tenantData) {
        const tenant: Tenant = JSON.parse(tenantData);
        if (tenant.tenant_id && typeof tenant.tenant_id === "string") {
          return tenant.tenant_id;
        }
      }
    } catch (error) {
      console.error("Error parsing tenant from localStorage:", error);
    }
  }
  // Fallback to default tenantId if not found, invalid, or running server-side
  return "P2324";
};

// Initialize state with tenantId from localStorage
export const initialState: State = {
  tenantId: getTenantIdFromLocalStorage(), // Dynamically set tenantId
  totalBillAmount: 0,
  oaNo: "",
  currentTenant: "",
  cardDetails: {},
  confirmedPayments: {},
  outstandingAmount: 0,
  totalPayments: 0,
  freeBill: false,
  paymentData: undefined,
  addedProducts: [],
  count: 0,
  products: [],
  customerData: undefined,
  invoiceNumber: undefined,
  billNo: undefined,
    currency: "₹", // Default currency
  userId: undefined, // Initialize userId as undefined
};
// Update initialState in ./reducer.ts

export type PaymentType = "Cash" | "Card" | "UPI" | "Credit" | "Free";

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
  currency: string, // Default currency
  addedProducts: Product[];
  userId?: string | undefined; // Added userId to the state
}

interface SetProductsAction {
  type: 'SET_PRODUCTS';
  payload: Product[];
}

interface SetCustomerAction {
  type: 'SET_CUSTOMER';
  payload: Customer | undefined;
}

interface UpdateProductAction {
  type: 'UPDATE_PRODUCT';
  payload: { id: string; QUANTITY: string };
}

interface RemoveProductAction {
  type: 'REMOVE_PRODUCT';
  payload: string; // id
}

interface ProcessPaymentAction {
  type: 'PROCESS_PAYMENT';
  payload: PaymentData;
}

interface SetBillNoAction {
  type: 'SET_BILL_NO';
  payload: string;
}

interface SetAddedProductsAction {
  type: 'SET_ADDED_PRODUCTS';
  payload: Product[];
}

interface SetOANoAction {
  type: 'SET_OA_NO';
  payload: string;
}

interface ResetStateAction {
  type: 'RESET_STATE';
  payload: {
    products: Product[];
    addedProducts: Product[];
    customerData: Customer | undefined;
    tenantId: string;
    oaNo: string | undefined;
  };
}

export type Action =
  | SetProductsAction
  | SetCustomerAction
  | UpdateProductAction
  | RemoveProductAction
  | ProcessPaymentAction
  | SetBillNoAction
  | SetAddedProductsAction
  | SetOANoAction
  | ResetStateAction;

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'SET_CUSTOMER':
      return { ...state, customerData: action.payload };
    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload.id
            ? { ...p, QUANTITY: action.payload.QUANTITY }
            : p
        ),
      };
    case 'REMOVE_PRODUCT':
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload ? { ...p, QUANTITY: "0" } : p
        ),
        addedProducts: state.addedProducts.filter((p) => p.id !== action.payload),
      };
    case 'PROCESS_PAYMENT':
      return { ...state, paymentData: action.payload };
    case 'SET_BILL_NO':
      return { ...state, billNo: action.payload };
    case 'SET_ADDED_PRODUCTS':
      return { ...state, addedProducts: action.payload };
    case 'SET_OA_NO':
      return { ...state, oaNo: action.payload };
    case 'RESET_STATE':
      return {
        ...state,
        products: action.payload.products,
        addedProducts: action.payload.addedProducts,
        customerData: action.payload.customerData,
        tenantId: action.payload.tenantId,
        oaNo: action.payload.oaNo,
        billNo: undefined,
        paymentData: undefined,
        totalBillAmount: 0,
        outstandingAmount: 0,
        totalPayments: 0,
        freeBill: false,
      };
    default:
      return state;
  }
};