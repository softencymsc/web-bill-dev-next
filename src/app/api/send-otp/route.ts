import { NextResponse } from "next/server";
import twilio from "twilio";
import NodeCache from "node-cache";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Create a cache instance with 5-minute TTL
const cache = new NodeCache({ stdTTL: 300 });

export async function POST(request: Request) {
  try {
    const { tenantId, phoneNumber, otp } = await request.json();

    if (!tenantId || !phoneNumber || !otp) {
      return NextResponse.json(
        { error: "Tenant ID, phone number, and OTP are required" },
        { status: 400 }
      );
    }

    // Clean and format phone number
    let formattedNumber = phoneNumber.replace(/[^0-9+]/g, '').trim();
    if (!formattedNumber.startsWith('+91')) {
      formattedNumber = `+91${formattedNumber.replace(/^\D+/, '')}`;
    }

    // Validate Indian phone number
    if (!/^\+91\d{10}$/.test(formattedNumber)) {
      return NextResponse.json(
        { error: "Invalid Indian phone number. Must be 10 digits (e.g., +919876543210)" },
        { status: 400 }
      );
    }

    // Store OTP in node-cache with a 5-minute expiration
    const cacheKey = `${tenantId}:${formattedNumber}`;
    cache.set(cacheKey, otp);

    // Send OTP using Twilio phone number
    await client.messages.create({
      body: `Your OTP for phone number verification is ${otp}. Valid for 5 minutes. - Taste N Bite`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber,
    });

    return NextResponse.json({ message: "OTP sent successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error sending OTP:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Unknown error";
    return NextResponse.json(
      { error: `Failed to send OTP: ${errorMessage}` },
      { status: 500 }
    );
  }
}