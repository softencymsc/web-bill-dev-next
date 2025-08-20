import otpCache from "@/lib/otpCache";

export async function POST(request: Request) {
  try {
    const { tenantId, phoneNumber, otp , generatedOtp } = await request.json();

    // Validate request body
    if (!tenantId || !phoneNumber || !otp || !generatedOtp) {
      return new Response(
        JSON.stringify({ error: "Tenant ID, phone number, and OTP are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clean and format phone number to match send-otp format
    let formattedNumber = phoneNumber.replace(/[^0-9]/g, "").trim();
    if (formattedNumber.length === 10) {
      formattedNumber = `+91${formattedNumber}`;
    } else if (formattedNumber.length === 12 && formattedNumber.startsWith("91")) {
      formattedNumber = `+${formattedNumber}`;
    }
    console.log("formattedNumber:",tenantId, formattedNumber);
    if (!/^\+91\d{10}$/.test(formattedNumber)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!otp) {
      return new Response(
        JSON.stringify({ error: "No OTP found for this phone number" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify OTP
    if (generatedOtp === otp) {// Clear OTP after successful verification
      return new Response(
        JSON.stringify({ success: true, message: "OTP verified successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid OTP" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}