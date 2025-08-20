/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageData, billNumber } = body;

    if (!imageData || !billNumber) {
      return NextResponse.json(
        { error: "Missing required fields", message: "imageData and billNumber are required." },
        { status: 400 }
      );
    }

    // Initialize Firebase Storage
    const storage = getStorage();
    const storageRef = ref(storage, `bills/bill_${billNumber}_${Date.now()}.jpg`);

    // Upload image to Firebase Storage
    await uploadString(storageRef, imageData, "data_url");
    const imageUrl = await getDownloadURL(storageRef);

    console.log("Firebase Storage upload success:", imageUrl);

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: any) {
    console.error("Firebase Storage upload error:", {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Upload failed", message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}