/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: "hisabs16_android_project",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    const connection = await mysql.createConnection(mysqlConfig);

    const [rows] = await connection.execute(`
      SELECT 
        BILL_NO,
        BILL_DATE,
        CUSTCODE AS CUST_CODE,
        CUSTNAME,
        NET_AMT AS NET_AMOUNT,
        BAL_AMT AS OUTSTANDING_AMOUNT,
        BASIC,
        DISCOUNT AS OWNER_DISCOUNT_AMOUNT,
        TERMTOTAL,
        CASHADDR1, CASHADDR2, CASHADDR3,
        BADDRESS1, BADDRESS2, BADDRESS3,
        SADDRESS1, SADDRESS2, SADDRESS3,
        CASHCITY, BCITY, SCITY,
        CASHCNTRY, BCOUNTRY, SCOUNTRY,
        CASHMOBILE, BMOBPHONE, SMOBPHONE
      FROM BILLIN
      WHERE CUSTCODE = ? 
    `, [tenantId]) as [any[], any];

    await connection.end();

    const formattedRows = rows.map((row: any) => {
      const addressParts = [
        row.CASHADDR1,
        row.CASHADDR2,
        row.CASHADDR3,
        row.BADDRESS1,
        row.BADDRESS2,
        row.BADDRESS3,
        row.SADDRESS1,
        row.SADDRESS2,
        row.SADDRESS3,
      ].filter(Boolean);

      // Ensure BILL_DATE is a valid ISO string
      let billDate: string;
      try {
        billDate = row.BILL_DATE
          ? new Date(row.BILL_DATE).toISOString()
          : new Date().toISOString();
      } catch (error) {
        console.warn(`Invalid BILL_DATE for BILL_NO ${row.BILL_NO}:`, row.BILL_DATE);
        billDate = new Date().toISOString();
      }

      return {
        ADDRESS: addressParts.join(", ") || "",
        BASIC: row.BASIC?.toString() || "0.00",
        BILL_DATE: billDate,
        BILL_NO: row.BILL_NO || "",
        CARD_AMOUNT: 0,
        CASH_AMOUNT: Number(row.NET_AMOUNT) || 0,
        CGST_AMOUNT: 0,
        CITY: row.CASHCITY || row.BCITY || row.SCITY || "",
        COUNTRY: row.CASHCNTRY || row.BCOUNTRY || row.SCOUNTRY || "",
        CREDIT_AMOUNT: 0,
        CUSTNAME: row.CUSTNAME || "",
        CUST_CODE: row.CUST_CODE || "",
        FREE_AMOUNT: 0,
        GST_AMOUNT: 0,
        IS_CREDIT: "NO",
        IS_FREE: "NO",
        IS_OWNER_DISCOUNT: "NO",
        MOBPHONE: row.CASHMOBILE || row.BMOBPHONE || row.SMOBPHONE || "",
        NET_AMOUNT: row.NET_AMOUNT?.toString() || "0.00",
        OUTSTANDING_AMOUNT: row.OUTSTANDING_AMOUNT?.toString() || "0.00",
        OWNER_DISCOUNT_AMOUNT: Number(row.OWNER_DISCOUNT_AMOUNT) || 0,
        PAY_MODE: "CASH",
        PROMO_CODE: "",
        PROMO_DISCOUNT: 0,
        SGST_AMOUNT: 0,
        TERMTOTAL: Number(row.TERMTOTAL) || 0,
        UPI_AMOUNT: 0,
        UPI_DETAILS: "",
        WEBIMPORT: 1,
      };
    });

    return NextResponse.json({
      message: "Fetched unsynced bills from MySQL",
      count: formattedRows.length,
      data: formattedRows,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills", details: (error as any).message },
      { status: 500 }
    );
  }
}