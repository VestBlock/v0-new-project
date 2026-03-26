export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Server-side Supabase client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Lazy-initialize Resend to avoid build-time errors
let resend: Resend | null = null;
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Twilio SMS function
async function sendSMS(to: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio credentials not configured, skipping SMS');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: message,
        }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log('SMS sent successfully:', result.sid);
      return true;
    } else {
      console.error('SMS send failed:', result);
      return false;
    }
  } catch (error) {
    console.error('SMS error:', error);
    return false;
  }
}

interface LeadFormData {
  propertyAddress: string;
  city: string;
  state: string;
  name: string;
  phone: string;
  propertyCondition?: string;
  timelineToSell?: string;
  mortgageBalance?: string;
  reasonForSelling?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: LeadFormData = await request.json();

    // Validate required fields
    if (!data.propertyAddress || !data.city || !data.state || !data.name || !data.phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Store in Supabase (legacy table)
    const { data: insertedLead, error: dbError } = await supabaseAdmin
      .from('real_estate_leads')
      .insert({
        property_address: data.propertyAddress,
        city: data.city,
        state: data.state,
        name: data.name,
        phone: data.phone,
        property_condition: data.propertyCondition || null,
        timeline_to_sell: data.timelineToSell || null,
        mortgage_balance: data.mortgageBalance || null,
        reason_for_selling: data.reasonForSelling || null,
        status: 'new',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save lead data' },
        { status: 500 }
      );
    }

    console.log('Lead saved to database:', insertedLead.id);

    // 2. Also store in unified leads table
    const { error: leadsError } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: 'sell_house',
        status: 'new',
        name: data.name,
        phone: data.phone,
        contact_info: {
          name: data.name,
          phone: data.phone
        },
        form_data: {
          propertyAddress: data.propertyAddress,
          city: data.city,
          state: data.state,
          propertyCondition: data.propertyCondition,
          timelineToSell: data.timelineToSell,
          mortgageBalance: data.mortgageBalance,
          reasonForSelling: data.reasonForSelling,
          legacyId: insertedLead.id
        }
      });

    if (leadsError) {
      console.error('Unified leads table error:', leadsError);
      // Don't fail - legacy table insert succeeded
    }

    // 2. Send Email Notification
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #00BFFF; border-bottom: 2px solid #00BFFF; padding-bottom: 10px;">
          New House Seller Lead
        </h1>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Property Information</h2>
          <p><strong>Address:</strong> ${data.propertyAddress}</p>
          <p><strong>City:</strong> ${data.city}</p>
          <p><strong>State:</strong> ${data.state}</p>
          ${data.propertyCondition ? `<p><strong>Condition:</strong> ${data.propertyCondition}</p>` : ''}
          ${data.mortgageBalance ? `<p><strong>Est. Mortgage Balance:</strong> ${data.mortgageBalance}</p>` : ''}
        </div>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Seller Information</h2>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          ${data.timelineToSell ? `<p><strong>Timeline to Sell:</strong> ${data.timelineToSell}</p>` : ''}
          ${data.reasonForSelling ? `<p><strong>Reason for Selling:</strong> ${data.reasonForSelling}</p>` : ''}
        </div>

        <div style="background-color: #00BFFF; color: white; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-weight: bold;">Lead ID: ${insertedLead.id}</p>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Submitted: ${new Date().toLocaleString()}</p>
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 20px; text-align: center;">
          This lead was submitted through vestblock.io/sell
        </p>
      </div>
    `;

    try {
      const resendClient = getResend();
      if (resendClient) {
        const { error: emailError } = await resendClient.emails.send({
          from: process.env.RESEND_EMAIL || 'noreply@vestblock.io',
          to: 'contact@vestblock.io',
          subject: `New House Seller Lead - ${data.propertyAddress}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error('Email send error:', emailError);
        } else {
          console.log('Email notification sent successfully');
        }
      } else {
        console.warn('Resend API key not configured, skipping email');
      }
    } catch (emailErr) {
      console.error('Email error:', emailErr);
      // Don't fail the request if email fails
    }

    // 3. Send SMS Notification
    const smsMessage = `New lead: ${data.name} - ${data.propertyAddress}, ${data.city}, ${data.state} - Timeline: ${data.timelineToSell || 'Not specified'}`;

    try {
      await sendSMS('+14146876923', smsMessage);
    } catch (smsErr) {
      console.error('SMS error:', smsErr);
      // Don't fail the request if SMS fails
    }

    return NextResponse.json({
      success: true,
      leadId: insertedLead.id,
      message: 'Lead submitted successfully',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
