/* eslint-disable @typescript-eslint/no-explicit-any */
// types.ts
export interface Customer {
  id?: string;
  MOBPHONE: string;
  NAME: string;
  CUSTCODE: string;
  ADDRESS?: string;
  CITY?: string;
  COUNTRY?: string;
  MarriageAnniversary?: string;
  DOB?: string;
  paymentDate?: any;
  invoiceNumber?: string;
  GSTIn?: any;
  number?: string;
  name?: string;
  anniversary?: string;
  birthday?: string;
}

export interface Voucher {
  id: string;
  AMOUNT: number;
  CASH_BANK?: string;
  CASH_BANK_CODE?: string;
  CASH_BOOK?: string;
  CHEQUE_DT?: string;
  CHEQUE_ON?: string;
  CHEQUE_TRANS_ID?: string;
  DESCRIPT?: string;
  GLCODE?: string;
  INITIAL_NAME?: string;
  NARRATION?: string;
  PAYEE_R_CODE?: string;
  PAYEE_R_NAME?: string;
  TRNNO?: string;
  TRN_DATE?: string | { seconds: number; nanoseconds: number };
  TYPE?: string;
  createdAt?: { seconds: number; nanoseconds: number };
}

export interface CompanyData {
  CName: string;
  CAddress: string;
  CContactNo: string;
  CDist: string;
  CState: string;
  CPin: string;
  gstin: string;
  franchiseName: string;
}

export type PaymentType = "Cash" | "Card" | "UPI" | "Credit" | "Free";

export interface PaymentData {
  paymentType: PaymentType;
  paidAmount: number;
  cashAmount: string;
  cashNote: string;
  cardNumber: string;
  cardExpiry: string;
  cardCVC: string;
  cardHolder: string;
  saveCard: boolean;
  selectedUpiApp: string;
  creditAmount: string;
  creditReason: string;
  creditPlan: string;
  freeReason: string;
  adminPin: string;
  products: Product[];
  outstandingAmount: number;
  date: string;
  totalAmount: number;
  totalGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  customerData: Customer[];
  invoiceNumber: string;
  paymentDetails: {
    cashAmount: number;
    cardAmount: number;
    upiAmounts: any[];
    totalUpiAmount: number;
  };
  promoDiscount: number;
}

export interface Product {
  UOM_SALE: string;
  SGroupDesc: string;
  GroupDesc: string;
  DESCRIPT: string;
  IGST: number;
  DISCOUNTAMT: number;
  MRP_RATE: number | string;
  QUANTITY: number | string;
  PRODCODE: string;
  OPENING_Q: string;
  id: string;
  HSNCODE?: number;
  FOOD_TYPE: number;
  name: string;
  category: string;
  price: number;
  image?: string | null;
  AVAILABLE?: boolean;
  DISCPER?: number;
}

export interface BillData {
  BILL_NO: string;
  CUSTNAME: string;
  MOBPHONE: string;
  RECEIPT_NO: string;
}