/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import { useAuth } from "@/context/AuthContext";
import { formatDateTimestamp } from "./utils";

export const collections = {
  DOCNUMBERING: "DocNumbering",
  SPLORDLIVE: "SplLive",
  TENANTS: "Tenants",
  TENANTSDB: "TenantsDb",
  FRANCHISE: "Franchise",
  CUSTOMERS: "Customers",
  AGENTS: "AGENTS",
  PRODUCTS: "Products",
  USERS: "Users",
  BILL: "BILL",
  BILLDET: "BILLDET",
  BILLTERM: "BILLTERM",
  ORDER: "ORDER",
  ORDERDET: "ORDERDET",
  ORDERTERM: "ORDERTERM",
  PORDER: "PORDER",
  PORDERDET: "PORDERDET",
  PORDERTERM: "PORDERTERM",
  BILLIN: "BILLIN",
  BLLINDET: "BLLINDET",
  BLINTERM: "BLINTERM",
  DBNOTE: "DBNOTE",
  PRETDET: "PRETDET",
  PRETTERM: "PRETTERM",
  CRNOTE: "CRNOTE",
  SRETDET: "SRETDET",
  SRETTERM: "SRETTERM",
  SPLORDER: "SPLORDER",
  CART: "CART",
  TRNS1: "TRNS1",
  DRAFT: "DRAFT",
  GL_MAST : "GL_Mast",
};
export const tableFields = {
  CUSTOMERS: [
    {
      heading: "Code",
      item: "CUSTCODE",
    },
    {
      heading: "Name",
      item: "NAME",
    },
    {
      heading: "Contact",
      item: "MOBPHONE",
    },
    {
      heading: "Gst Number",
      item: "GSTIn",
    },
  ],
  PRODUCTS: [
    {
      heading: "Code",
      item: "PRODCODE",
    },
    {
      heading: "Description",
      item: "DESCRIPT",
    },
    {
      heading: "Group",
      item: "SGroupDesc",
    },
    {
      heading: "UOM",
      item: "UOM_SALE",
    },
    {
      heading: "MRP",
      item: "MRP_RATE",
    },
     {
      heading: "Qty",
      item: "OPENING_Q",
    }
  ],
  PURCHASEORDER: [
    {
      heading: "Purchase Order No",
      item: "BILL_NO",
      isVisible: true,
    },
    {
      heading: "Customer Name",
      item: "CUSTNAME",
      isVisible: true,
    },
    {
      heading: "Slot",
      item: "slot",
      isVisible: true,
    },
  ],
  BILLINS: [
    {
      heading: "Purchase Bill No",
      item: "BILL_NO",
      isVisible: true,
    },
    {
      heading: "Vendor Name",
      item: "CUSTNAME",
      isVisible: true,
    },
    {
      heading: "Contact",
      item: "MOBPHONE",
      isVisible: true,
    },
  ],
  SALEBILL: [
    {
      heading: "Bill No",
      item: "BILL_NO",
      isVisible: true,
    },
    {
      heading: "Customer Name",
      item: "CUSTNAME",
      isVisible: true,
    },
    {
      heading: "Contact",
      item: "MOBPHONE",
      isVisible: true,
    },
    {
      heading: "Pay Mode",
      item: "PAY_MODE",
      isVisible: true,
    },
  ],
  ORDERS: [
    {
      heading: "Order No",
      item: "OA_NO",
      isVisible: true,
    },
    {
      heading: "Customer Name",
      item: "CUSTNAME",
      isVisible: true,
    },
    {
      heading: "Contact",
      item: "MOBPHONE",
      isVisible: true,
    },
    {
      heading: "Advance",
      item: "ADV_AMT",
      isVisible: true,
    },
  ],
  PURCHASE_RETURN: [
    {
      heading: "Return Bill No",
      item: "RBILL_NO",
      isVisible: true,
    },
    {
      heading: "Return Type",
      item: "SretType",
      isVisible: true,
    },
    {
      heading: "Purchase Bill No",
      item: "BILL_NO",
      isVisible: true,
    },
    {
      heading: "Vendor Name",
      item: "CUSTNAME",
      isVisible: true,
    },
  ],
  DBNOTE: [
    {
      heading: "Dbnote No",
      item: "RBILL_NO",
      isVisible: true,
    },
    {
      heading: "Ret Note",
      item: "SretType",
      isVisible: true,
    },
    {
      heading: "Type",
      item: "TYPE",
      isVisible: true,
    },
    {
      heading: "Bill No",
      item: "BILL_NO",
      isVisible: true,
    },
    {
      heading: "Customer Name",
      item: "CUSTNAME",
      isVisible: true,
    },
    {
      heading: "Contact",
      item: "MOBPHONE",
      isVisible: true,
    },
    {
      heading: "Amount",
      item: "NET_AMT",
      isVisible: true,
    },
  ],
   DOCNUM: [
    {
      heading: "ID",
      item: "id",
      isVisible: true,
    },
    {
      heading: "Company",
      item: "CName",
      isVisible: true,
    },
    {
      heading: "ConPerson",
      item: "CCPerson",
      isVisible: true,
    },
    {
      heading: "Contact No",
      item: "CContactNo",
      isVisible: true,
    },
    {
      heading: "City",
      item: "CCity",
      isVisible: true,
    },
  ],
  SPLORDERS: [
    {
      heading: "SplOrder No",
      item: "BILL_NO",
      isVisible: true,
    },
    {
      heading: "Customer",
      item: "CUSTNAME",
      isVisible: true,
    },
    {
      heading: "Contact",
      item: "MOBPHONE",
      isVisible: true,
    },
  ],
  SLOT: {
    "9PM": "Next First Delivery",
    "4PM": "Next Day 3rd Delivery",
    "5PM": "Next Day 2nd Delivery"
  },
  // SPLSLOT: {
  //   "8PM": "Spl Order",
  //   "6PM": "6PM",
  //   "4PM": "6PM"
  // }
};

export const ViewFormat = {
  PRODUCT: [
    { name: "PRODCODE", label: "Product Code", type: "text" },
    { name: "DESCRIPT", label: "Description", type: "text" },
    {
      name: "SERVICE",
      label: "Is a Service",
      type: "dropdown",
      options: ["Yes", "No"],
    },
    { name: "UOM_PURCH", label: "Purchasing UOM", type: "text" },
    { name: "UOM_STK", label: "Stock UOM", type: "text" },
    { name: "UOM_SALE", label: "Sales UOM", type: "text" },
    { name: "HSNCODE", label: "HSN Code", type: "number" },
    { name: "IGST", label: "GST Rate", type: "number" },
    { name: "RATE", label: "Rate", type: "number" },
    { name: "BUY_RATE", label: "Buy Rate", type: "number" },
    { name: "MRP_RATE", label: "MRP Rate", type: "number" },
    { name: "DISCPER", label: "Discount Percentage", type: "number" },
    { name: "GroupDesc", label: "Group Description", type: "text" },
    { name: "SGroupDesc", label: "Subgroup Description", type: "text" },
    { name: "OPENING_Q", label: "Opening Quantity", type: "text" },
    { name: "OPENING_V", label: "Opening Value", type: "text" },
  ],
  CUSTOMERS: [
    { name: "PRODCODE", label: "Product Code", type: "text" },
    { name: "DESCRIPT", label: "Description", type: "text" },
    {
      name: "SERVICE",
      label: "Is a Service",
      type: "dropdown",
      options: ["Yes", "No"],
    },
    { name: "UOM_PURCH", label: "Purchasing UOM", type: "text" },
    { name: "UOM_STK", label: "Stock UOM", type: "text" },
    { name: "UOM_SALE", label: "Sales UOM", type: "text" },
    { name: "HSNCODE", label: "HSN Code", type: "number" },
    { name: "IGST", label: "GST Rate", type: "number" },
    { name: "RATE", label: "Rate", type: "number" },
    { name: "BUY_RATE", label: "Buy Rate", type: "number" },
    { name: "MRP_RATE", label: "MRP Rate", type: "number" },
    { name: "DISCPER", label: "Discount Percentage", type: "number" },
    { name: "GroupDesc", label: "Group Description", type: "text" },
    { name: "SGroupDesc", label: "Subgroup Description", type: "text" },
    { name: "OPENING_Q", label: "Opening Quantity", type: "text" },
    { name: "OPENING_V", label: "Opening Value", type: "text" },
  ],
};

export const Permissions = {
  UserRights: [
    "SALE",
    "PURCHASE",
    "REPORT",
    "DASHBOARD",
    "SECURITY",
    "DELETE",
    "EDIT",
  ],
};

export const documentTypes = [
  { value: "", label: "Select Document Type", dbName: "" },
  { value: "SaleOrder", label: "Sale Order", dbName: collections.ORDER },
  { value: "SaleInvoice", label: "Sale Invoice", dbName: collections.BILL },
  {
    value: "PurchaseOrder",
    label: "Purchase Order",
    dbName: collections.PORDER,
  },
  {
    value: "PurchaseSplOrder",
    label: "Purchase Special Order",
    dbName: collections.SPLORDER,
  },
  {
    value: "PurchaseInvoice",
    label: "Purchase Invoice",
    dbName: collections.BILLIN,
  },
];
export const slotMapping = {
  "Spl Order": "8PM",
  "6PM": "6PM",
  "5PM": "5PM",
  "3PM": "3PM",
};