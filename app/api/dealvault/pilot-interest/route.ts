import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pilotInterestSchema = z.object({
  name: z.string().trim().min(2).max(140),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  companyName: z.string().trim().max(160).optional().or(z.literal('')),
  role: z.string().trim().max(80).optional().or(z.literal('')),
  useCase: z.string().trim().max(120).optional().or(z.literal('')),
  pilotWindow: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(1600).optional().or(z.literal('')),
  sourcePath: z.string().trim().max(160).optional().or(z.literal('')),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = pilotInterestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Check the demo request and try again.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const sourcePath = data.sourcePath || '/dealvault';
    const supabaseAdmin = createAdminClient();
    const summary = `DealVault demo request for ${data.companyName || data.name}; role: ${data.role || 'unknown'}; use case: ${data.useCase || 'general demo'}.`;

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: 'real_estate',
        status: 'new',
        source: 'dealvault_demo_request',
        source_url: sourcePath,
        category: 'real_estate',
        name: data.name,
        email: data.email,
        phone: data.phone,
        business_name: data.companyName || null,
        best_offer: 'DealVault Private Demo',
        pain_signal: summary,
        contact_info: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          companyName: data.companyName || null,
        },
        form_data: {
          ...data,
          serviceCategory: 'dealvault_demo',
        },
        market_segment: 'dealvault_demo',
        outreach_angle: 'Proof records, payout tracking, and transparent event history',
        notes: data.notes || summary,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[dealvault-pilot-interest] insert failed:', error);
      return NextResponse.json({ error: 'Unable to submit demo request.' }, { status: 500 });
    }

    void runNewLeadAutomation({
      leadId: lead.id,
      leadType: 'real_estate',
      name: data.name,
      email: data.email,
      phone: data.phone,
      sourcePath,
      summary,
      metadata: {
        companyName: data.companyName || null,
        role: data.role || null,
        useCase: data.useCase || null,
        demoWindow: data.pilotWindow || null,
        serviceCategory: 'dealvault_demo',
      },
    }).catch((automationError) => {
      console.error('[dealvault-pilot-interest] automation failed:', automationError);
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error('[dealvault-pilot-interest] unexpected error:', error);
    return NextResponse.json({ error: 'Unable to submit demo request.' }, { status: 500 });
  }
}
