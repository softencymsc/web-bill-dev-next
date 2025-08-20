/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import twilio from "twilio";
import otpCache from "@/lib/otpCache";

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Utility to validate and format Indian phone number
const formatPhoneNumber = (phoneNumber: string): string | null => {
  const cleaned = phoneNumber.replace(/[^0-9]/g, "").trim();
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }
  return null;
};

export async function POST(request: Request) {
  try {
    // Parse request body
    const { tenantId, phoneNumber, otp } = await request.json();
    console.log("Received OTP request:", { tenantId, phoneNumber, otp });   

    // Validate request body
    if (!tenantId || !phoneNumber || !otp) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Tenant ID, phone number, and OTP are required",
        },
        { status: 400 }
      );
    }

    // Format and validate phone number
    const formattedNumber = formatPhoneNumber(phoneNumber);
    if (!formattedNumber || !/^\+91\d{10}$/.test(formattedNumber)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Invalid Indian phone number. Use 10 digits or +91XXXXXXXXXX format.",
        },
        { status: 400 }
      );
    }

    // Check cache to prevent OTP spamming
    const cacheKey = `${tenantId}:${formattedNumber}`;
    if (otpCache.get(cacheKey)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Please wait 5 minutes before requesting a new OTP",
        },
        { status: 429 }
      );
    }

    // Store OTP in cache (use OTP from request)
    const cacheData = { otp, phoneNumber: formattedNumber };
    const cacheSuccess = otpCache.set(cacheKey, cacheData, 60); // 1 min TTL
    if (!cacheSuccess) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Failed to process OTP request" },
        { status: 500 }
      );
    }
    console.log("Stored OTP in cache:", { cacheKey, otp });

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your OTP for verification is ${otp}. Valid for 1 minute.  Taste N Bite`,
      from: process.env.TWILIO_NUMBER,
      to: formattedNumber,
    });

    return NextResponse.json<ApiResponse>(
      { success: true, message: "OTP sent successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in send-otp API:", {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: `Failed to send OTP: ${error.message || "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}