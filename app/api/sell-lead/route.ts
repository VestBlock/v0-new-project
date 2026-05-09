export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';
import { persistPropertyBuyerMatches } from '@/lib/buyers/service';

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
  email?: string;
  phone: string;
  propertyType?: string;
  bedrooms?: string;
  bathrooms?: string;
  propertyCondition?: string;
  timelineToSell?: string;
  estimatedValue?: string;
  askingPrice?: string;
  mortgageBalance?: string;
  liensOrTaxes?: string;
  occupancyStatus?: string;
  bestTimeToCall?: string;
  notes?: string;
  reasonForSelling?: string;
}

function buildPropertyAddress(address?: string | null, city?: string | null, state?: string | null) {
  const parts = [address, city, state]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  if (!parts.length) return null;
  return parts.join(', ').replace(/\s+,/g, ',').replace(/,\s*,/g, ', ');
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
    const normalizedPropertyAddress = buildPropertyAddress(
      data.propertyAddress,
      data.city,
      data.state
    );

    // Keep the older seller table best-effort only so the main workflow
    // does not fail when the legacy table is absent in a newer environment.
    let legacyLeadId: string | null = null;
    const { data: insertedLead, error: dbError } = await supabaseAdmin
      .from('real_estate_leads')
      .insert({
        property_address: normalizedPropertyAddress,
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
      console.warn('Legacy real_estate_leads insert skipped:', dbError);
    } else {
      legacyLeadId = insertedLead.id;
    }

    // Store the real lead in the unified leads table first.
    const { data: unifiedLead, error: leadsError } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: 'sell_house',
        status: 'new',
        source: 'sell_house_form',
        source_url: '/sell',
        category: 'seller_lead',
        name: data.name,
        property_address: normalizedPropertyAddress,
        city: data.city,
        state: data.state,
        phone: data.phone,
        best_offer: 'Real Estate Seller Lead',
        pain_signal:
          data.reasonForSelling ||
          `Property condition ${data.propertyCondition || 'unknown'}; timeline ${data.timelineToSell || 'unknown'}.`,
        contact_info: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          bestTimeToCall: data.bestTimeToCall
        },
        form_data: {
          propertyAddress: normalizedPropertyAddress,
          streetAddress: data.propertyAddress,
          city: data.city,
          state: data.state,
          propertyType: data.propertyType,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          propertyCondition: data.propertyCondition,
          timelineToSell: data.timelineToSell,
          estimatedValue: data.estimatedValue,
          askingPrice: data.askingPrice,
          mortgageBalance: data.mortgageBalance,
          liensOrTaxes: data.liensOrTaxes,
          occupancyStatus: data.occupancyStatus,
          bestTimeToCall: data.bestTimeToCall,
          notes: data.notes,
          reasonForSelling: data.reasonForSelling,
          legacyId: legacyLeadId
        },
        market_segment: 'seller_lead',
        outreach_angle: 'Seller exit help and distressed-property options',
        email: data.email || null,
        notes:
          data.notes ||
          `${normalizedPropertyAddress || 'Unknown property'}; timeline ${data.timelineToSell || 'not specified'}.`,
      })
      .select('id')
      .single();

    if (leadsError || !unifiedLead?.id) {
      console.error('Unified leads table error:', leadsError);
      return NextResponse.json(
        { error: 'Failed to save seller lead.' },
        { status: 500 }
      );
    }

    const estimateNumber = (value?: string | null) => {
      if (!value) return null;
      const cleaned = String(value).replace(/[^0-9.]/g, '');
      const parsed = Number.parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const timelineMap: Record<string, number> = {
      asap: 7,
      immediately: 7,
      'within 30 days': 30,
      '30 days': 30,
      '30-60 days': 45,
      '60-90 days': 75,
      '90+ days': 120,
    };

    const normalizedTimeline = String(data.timelineToSell || '').trim().toLowerCase();
    const distressLevel =
      data.propertyCondition?.toLowerCase().includes('poor') || data.propertyCondition?.toLowerCase().includes('distress')
        ? 8
        : data.propertyCondition?.toLowerCase().includes('fair')
          ? 6
          : 4;

    const summary = `${normalizedPropertyAddress || 'Unknown property'}; timeline ${data.timelineToSell || 'not specified'}; value ${data.estimatedValue || 'unknown'}; mortgage ${data.mortgageBalance || 'unknown'}.`;

    const smsMessage = `New seller lead: ${data.name} - ${normalizedPropertyAddress || 'Unknown property'} - ${data.timelineToSell || 'Timeline not specified'} - Value: ${data.estimatedValue || 'unknown'}`;

    void Promise.allSettled([
      runNewLeadAutomation({
        leadId: unifiedLead.id,
        leadType: 'sell_house',
        name: data.name,
        email: data.email,
        phone: data.phone,
        propertyAddress: normalizedPropertyAddress,
        city: data.city,
        state: data.state,
        sourcePath: '/sell',
        summary,
        metadata: {
          legacyId: legacyLeadId,
          city: data.city,
          state: data.state,
          propertyType: data.propertyType,
          propertyCondition: data.propertyCondition,
          timelineToSell: data.timelineToSell,
          occupancyStatus: data.occupancyStatus,
          estimatedValue: data.estimatedValue,
          mortgageBalance: data.mortgageBalance,
        },
        }),
      persistPropertyBuyerMatches({
        leadId: unifiedLead.id,
        serviceType: 'sell_house',
        propertyAddress: normalizedPropertyAddress,
        city: data.city,
        state: data.state,
        assetType: data.propertyType || null,
        occupancy: data.occupancyStatus || null,
        distressLevel,
        rehabLevel: distressLevel,
        askingPrice: estimateNumber(data.askingPrice),
        estimatedValue: estimateNumber(data.estimatedValue),
        landlordSignal:
          data.occupancyStatus?.toLowerCase().includes('tenant') ||
          data.occupancyStatus?.toLowerCase().includes('rental') ||
          false,
        sellerMotivation: data.reasonForSelling || data.notes || null,
        timelineDays: timelineMap[normalizedTimeline] ?? null,
        creativeFinanceOpen:
          /subject to|seller finance|creative/i.test(data.reasonForSelling || '') ||
          /subject to|seller finance|creative/i.test(data.notes || ''),
        languagePreference:
          /spanish|espanol/i.test(data.notes || '') || /spanish|espanol/i.test(data.reasonForSelling || '')
            ? 'es'
            : 'en',
        marketTag: `${data.city}, ${data.state}`,
      }),
      sendSMS('+14146876923', smsMessage),
    ]).then((results) => {
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length > 0) {
        console.error('Seller lead follow-up tasks failed:', rejected);
      }
    });

    return NextResponse.json({
      success: true,
      leadId: unifiedLead.id,
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
