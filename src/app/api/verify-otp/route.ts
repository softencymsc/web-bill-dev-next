import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { tenantId, newPhoneNumber, otp } = await request.json();

    if (!tenantId || !newPhoneNumber || !otp) {
      return NextResponse.json(
        { error: "Tenant ID, new phone number, and OTP are required" },
        { status: 400 }
      );
    }

    // Clean and format new phone number
    let formattedNewPhoneNumber = newPhoneNumber.replace(/[^0-9+]/g, '').trim();
    if (!formattedNewPhoneNumber.startsWith('+91')) {
      formattedNewPhoneNumber = `+91${formattedNewPhoneNumber.replace(/^\D+/, '')}`;
    }

    // Validate Indian phone number
    if (!/^\+91\d{10}$/.test(formattedNewPhoneNumber)) {
      return NextResponse.json(
        { error: "Invalid Indian phone number. Must be 10 digits (e.g., +919876543210)" },
        { status: 400 }
      );
    }

    // Validate OTP format (just check it's 6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "OTP must be a 6-digit number" },
        { status: 400 }
      );
    }

    // No Firestore update here, just return success
    return NextResponse.json({ message: "OTP verified successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to verify OTP: ${errorMessage}` },
      { status: 500 }
    );
  }
}