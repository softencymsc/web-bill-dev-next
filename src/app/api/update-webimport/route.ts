/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: "hisabs16_android_project",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { billNos } = body;

    if (!Array.isArray(billNos) || billNos.length === 0) {
      return NextResponse.json({ error: "billNos must be a non-empty array" }, { status: 400 });
    }

    const connection = await mysql.createConnection(mysqlConfig);

    // Use parameterized query to prevent SQL injection
    const placeholders = billNos.map(() => '?').join(',');
    const query = `UPDATE BILLIN SET WEBIMPORT = 1 WHERE BILL_NO IN (${placeholders})`;
    await connection.execute(query, billNos);

    await connection.end();

    return NextResponse.json({
      message: `Updated WEBIMPORT for ${billNos.length} bills`,
      count: billNos.length,
    });
  } catch (error) {
    console.error("Error updating WEBIMPORT:", error);
    return NextResponse.json(
      { error: "Failed to update WEBIMPORT", details: (error as any).message },
      { status: 500 }
    );
  }
}