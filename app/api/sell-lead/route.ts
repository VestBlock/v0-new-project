export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';

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

    const supabaseAdmin = createAdminClient();

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

    // 2. Also store in unified leads table
    const { data: unifiedLead, error: leadsError } = await supabaseAdmin
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
      })
      .select('id')
      .single();

    if (leadsError) {
      console.error('Unified leads table error:', leadsError);
      // Don't fail - legacy table insert succeeded
    } else {
      await runNewLeadAutomation({
        leadId: unifiedLead.id,
        leadType: 'sell_house',
        name: data.name,
        phone: data.phone,
        sourcePath: '/sell',
        summary: `${data.propertyAddress}, ${data.city}, ${data.state}; timeline ${data.timelineToSell || 'not specified'}.`,
        metadata: {
          legacyId: insertedLead.id,
          city: data.city,
          state: data.state,
          propertyCondition: data.propertyCondition,
          timelineToSell: data.timelineToSell,
        },
      });
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
