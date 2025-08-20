/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import twilio, { Twilio } from 'twilio';
import { StatusCodes } from 'http-status-codes';
import type { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message';

interface ApiResponse {
  success?: boolean;
  messageSid?: string;
  status?: string;
  message?: string;
  error?: string;
  code?: string;
}

interface WhatsAppRequestBody {
  tenantId: string;
  phoneNumber: string;
  customerName: string;
  invoiceNumber: string;
  totalAmount: string;
  date: string;
  items: string;
  contactEmail: string;
  cgst: string;
  sgst: string;
  totalTax: string;
}

// Environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
const fromWhatsAppNumber = process.env.TWILIO_PHONE_NUMBER ?? 'whatsapp:+14155238886';
const templateSid = process.env.TWILIO_TEMPLATE_SID ?? 'HXc6101bbc0b70d1ea3fd36714231d010c';

/**
 * Retry Twilio message sending on timeout
 */
async function sendWhatsAppWithRetry(
  client: Twilio,
  options: MessageListInstanceCreateOptions,
  retries = 2
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.messages.create(options);
    } catch (error: any) {
      const isTimeout =
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout') ||
        error.message?.includes('exceeded');

      if (isTimeout && attempt < retries) {
        console.warn(`Retrying Twilio send... attempt ${attempt + 1}`);
        await new Promise((r) => setTimeout(r, 1000)); // wait 1 second before retry
        continue;
      }

      throw error;
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WhatsAppRequestBody;
    const {
      tenantId, phoneNumber, customerName, invoiceNumber,
      totalAmount, date, items, contactEmail, cgst, sgst, totalTax
    } = body;

    // Check for missing fields
    const missingFields = Object.entries({
      tenantId, phoneNumber, customerName, invoiceNumber,
      totalAmount, date, items, contactEmail, cgst, sgst, totalTax
    }).filter(([_, value]) => !value).map(([key]) => key);

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: `Missing: ${missingFields.join(', ')}`
      }, { status: StatusCodes.BAD_REQUEST });
    }

    // Normalize phone number
    let normalizedPhoneNumber = phoneNumber;
    if (/^\d{10}$/.test(phoneNumber)) {
      normalizedPhoneNumber = `+91${phoneNumber}`;
    }
    if (!/^\+91\d{10}$/.test(normalizedPhoneNumber)) {
      return NextResponse.json({
        error: 'Invalid phone number',
        message: 'Phone number must be +91XXXXXXXXXX or 10 digits'
      }, { status: StatusCodes.BAD_REQUEST });
    }

    if (!accountSid || !authToken) {
      return NextResponse.json({
        error: 'Twilio configuration error',
        message: 'Twilio credentials are missing'
      }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
    }

    // Initialize Twilio client with increased timeout
    const client: Twilio = twilio(accountSid, authToken, {
      timeout: 20000, // 20 seconds
    });

    const messageOptions: MessageListInstanceCreateOptions = {
      from: fromWhatsAppNumber,
      to: `whatsapp:${normalizedPhoneNumber}`,
      contentSid: templateSid,
      contentVariables: JSON.stringify({
        '1': customerName,
        '2': invoiceNumber,
        '3': totalAmount,
        '4': date,
        '5': items,
        '7': contactEmail,
        '8': cgst,
        '9': sgst,
        '10': totalTax,
      }),
    };

    const sentMessage = await sendWhatsAppWithRetry(client, messageOptions);

    return NextResponse.json({
      success: true,
      messageSid: sentMessage?.sid,
      status: sentMessage?.status
    }, { status: StatusCodes.OK });

  } catch (error: any) {
    console.error('WhatsApp send error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    return NextResponse.json({
      error: 'Failed to send WhatsApp message',
      message: error.message || 'Internal server error',
      code: error.code || 'UNKNOWN'
    }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
