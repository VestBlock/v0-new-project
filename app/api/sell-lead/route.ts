export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';
import { persistPropertyBuyerMatches } from '@/lib/buyers/service';
import { buildRoughPropertyEstimate, parseCurrencyAmount } from '@/lib/property/roughEstimate';
import { guardPublicMutation } from '@/lib/security/public-mutation';

const sellerText = (max: number) => z.string().trim().max(max).optional().default('');

const sellLeadSchema = z.object({
  propertyAddress: z.string().trim().min(3).max(260),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(140),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
  phone: z.string().trim().min(7).max(40),
  propertyType: sellerText(120),
  bedrooms: sellerText(20),
  bathrooms: sellerText(20),
  propertyCondition: sellerText(120),
  timelineToSell: sellerText(120),
  estimatedValue: sellerText(80),
  askingPrice: sellerText(80),
  mortgageBalance: sellerText(80),
  liensOrTaxes: sellerText(80),
  occupancyStatus: sellerText(120),
  bestTimeToCall: sellerText(120),
  preferredSalePath: z.enum(['fast_cash', 'creative_structure', 'novation', 'not_sure']).optional().default('not_sure'),
  notes: sellerText(1600),
  reasonForSelling: sellerText(1000),
  attribution: z.record(z.string(), z.string().trim().max(500)).optional().default({}),
});

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
  const guard = guardPublicMutation(request, { scope: 'sell-lead', maxRequests: 5 });
  if (guard) return guard;

  try {
    const parsed = sellLeadSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Check the seller review form and try again.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

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
          attribution: data.attribution || {},
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

    // Vercel may stop work after the response is returned. Keep lead routing in
    // the request lifecycle so a successful response means the automation ran.
    const followUpResults = await Promise.allSettled(followUpTasks);
    const failedFollowUps = followUpResults.flatMap((result, index) => {
      if (result.status === 'fulfilled') return [];
      return [{
        task: index === 0 ? 'lead_automation' : 'buyer_matching',
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }];
    });

    if (failedFollowUps.length > 0) {
      console.error('Seller lead follow-up tasks failed:', failedFollowUps);
    }

    return NextResponse.json({
      success: true,
      message: 'Lead submitted successfully',
      roughEstimate,
      automation: {
        status: failedFollowUps.length === 0 ? 'completed' : 'queued_for_review',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
