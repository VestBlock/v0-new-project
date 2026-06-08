export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';
import { persistPropertyBuyerMatches } from '@/lib/buyers/service';
import { buildRoughPropertyEstimate, parseCurrencyAmount } from '@/lib/property/roughEstimate';

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
  preferredSalePath?: string;
  notes?: string;
  reasonForSelling?: string;
}

const sellerSalePathLabels: Record<string, string> = {
  fast_cash: 'Fast cash buyer review',
  creative_structure: 'Creative structure review',
  novation: 'Novation / market-assisted sale review',
  not_sure: 'Needs best-path review',
};

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
    const preferredSalePathKey =
      typeof data.preferredSalePath === 'string' && data.preferredSalePath.trim()
        ? data.preferredSalePath.trim()
        : 'not_sure';
    const preferredSalePathLabel =
      sellerSalePathLabels[preferredSalePathKey] || sellerSalePathLabels.not_sure;
    const sellerContext = [data.reasonForSelling, preferredSalePathLabel, data.notes]
      .filter(Boolean)
      .join('; ');
    const roughEstimate = await buildRoughPropertyEstimate({
      address: normalizedPropertyAddress,
      city: data.city,
      state: data.state,
      propertyType: data.propertyType,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      sellerEstimatedValue: data.estimatedValue,
      askingPrice: data.askingPrice,
      mortgageBalance: data.mortgageBalance,
      liensOrTaxes: data.liensOrTaxes,
      propertyCondition: data.propertyCondition,
      timelineToSell: data.timelineToSell,
      occupancyStatus: data.occupancyStatus,
      preferredSalePath: preferredSalePathKey,
    });

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
          `Preferred path ${preferredSalePathLabel}; property condition ${data.propertyCondition || 'unknown'}; timeline ${data.timelineToSell || 'unknown'}.`,
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
          preferredSalePath: preferredSalePathKey,
          preferredSalePathLabel,
          notes: data.notes,
          reasonForSelling: data.reasonForSelling,
          roughEstimate,
          legacyId: legacyLeadId
        },
        market_segment: 'seller_lead',
        outreach_angle: `Seller exit review: ${preferredSalePathLabel}`,
        email: data.email || null,
        notes:
          data.notes
            ? `${data.notes} Preferred sale path: ${preferredSalePathLabel}.`
            : `${normalizedPropertyAddress || 'Unknown property'}; timeline ${data.timelineToSell || 'not specified'}; preferred sale path ${preferredSalePathLabel}.`,
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

    const summary = `${normalizedPropertyAddress || 'Unknown property'}; path ${preferredSalePathLabel}; timeline ${data.timelineToSell || 'not specified'}; rough value ${roughEstimate.estimateValue ? `$${roughEstimate.estimateValue.toLocaleString()}` : data.estimatedValue || 'unknown'} (${roughEstimate.confidenceLabel}); mortgage ${data.mortgageBalance || 'unknown'}. ${roughEstimate.buyerPacketSummary}`;

    const smsMessage = `New seller lead: ${data.name} - ${preferredSalePathLabel} - ${normalizedPropertyAddress || 'Unknown property'} - ${data.timelineToSell || 'Timeline not specified'} - Rough value: ${roughEstimate.estimateValue ? `$${roughEstimate.estimateValue.toLocaleString()}` : data.estimatedValue || 'unknown'}`;

    const alertPhone = process.env.SELLER_LEAD_ALERT_PHONE || process.env.ADMIN_ALERT_PHONE || null;
    const followUpTasks: Array<Promise<unknown>> = [
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
          preferredSalePath: preferredSalePathKey,
          preferredSalePathLabel,
          occupancyStatus: data.occupancyStatus,
          estimatedValue: data.estimatedValue,
          mortgageBalance: data.mortgageBalance,
          roughEstimate,
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
        askingPrice: parseCurrencyAmount(data.askingPrice),
        estimatedValue: roughEstimate.estimateValue || parseCurrencyAmount(data.estimatedValue),
        landlordSignal:
          data.occupancyStatus?.toLowerCase().includes('tenant') ||
          data.occupancyStatus?.toLowerCase().includes('rental') ||
          false,
        sellerMotivation: sellerContext || null,
        timelineDays: timelineMap[normalizedTimeline] ?? null,
        creativeFinanceOpen:
          preferredSalePathKey === 'creative_structure' ||
          /subject to|seller finance|creative/i.test(data.reasonForSelling || '') ||
          /subject to|seller finance|creative/i.test(data.notes || ''),
        languagePreference:
          /spanish|espanol/i.test(data.notes || '') || /spanish|espanol/i.test(data.reasonForSelling || '')
            ? 'es'
            : 'en',
        marketTag: `${data.city}, ${data.state}`,
      }),
    ];

    if (alertPhone) {
      followUpTasks.push(sendSMS(alertPhone, smsMessage));
    }

    void Promise.allSettled(followUpTasks).then((results) => {
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length > 0) {
        console.error('Seller lead follow-up tasks failed:', rejected);
      }
    });

    return NextResponse.json({
      success: true,
      leadId: unifiedLead.id,
      message: 'Lead submitted successfully',
      roughEstimate,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
