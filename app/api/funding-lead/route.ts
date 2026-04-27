export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';
import { createAdminClient } from '@/lib/supabase/admin';

const fundingLeadSchema = z.object({
  name: z.string().trim().min(2).max(140),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  business_type: z.string().trim().min(2).max(140),
  funding_amount: z.string().trim().min(1).max(80),
  credit_score: z.string().trim().min(2).max(20),
  message: z.string().trim().max(1600).optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const parsed = fundingLeadSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Check the funding form and try again.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const supabase = createAdminClient();
  const summary = `Business funding lead for ${data.business_type}; requested ${data.funding_amount}; credit score ${data.credit_score}.`;

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      lead_type: 'business_funding',
      status: 'new',
      name: data.name,
      email: data.email,
      phone: data.phone,
      contact_info: {
        name: data.name,
        email: data.email,
        phone: data.phone,
      },
      form_data: data,
      notes: data.message || summary,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[funding-lead] insert failed:', error);
    return NextResponse.json(
      { error: 'Unable to submit funding lead.' },
      { status: 500 }
    );
  }

  await runNewLeadAutomation({
    leadId: lead.id,
    leadType: 'business_funding',
    name: data.name,
    email: data.email,
    phone: data.phone,
    sourcePath: '/funding',
    summary,
    metadata: {
      businessType: data.business_type,
      fundingAmount: data.funding_amount,
      creditScore: data.credit_score,
    },
  });

  return NextResponse.json({ success: true, leadId: lead.id });
}
