export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  financialSkillsetPackageKeys,
  getFinancialSkillsetPackage,
} from '@/lib/services/financialSkillsets';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';
import { createAdminClient } from '@/lib/supabase/admin';

const serviceInterestSchema = z.object({
  packageKey: z.enum(financialSkillsetPackageKeys),
  name: z.string().trim().min(2).max(140),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  businessName: z.string().trim().max(160).optional().or(z.literal('')),
  monthlyRevenueRange: z.string().trim().max(80).optional().or(z.literal('')),
  creditScoreRange: z.string().trim().max(80).optional().or(z.literal('')),
  timeline: z.string().trim().max(120).optional().or(z.literal('')),
  primaryGoal: z.string().trim().min(3).max(220),
  notes: z.string().trim().max(1600).optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const parsed = serviceInterestSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Check the service request and try again.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const servicePackage = getFinancialSkillsetPackage(data.packageKey);

  if (!servicePackage) {
    return NextResponse.json(
      { error: 'Unknown financial service package.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const summary = `${servicePackage.title} request for ${data.businessName || data.name}; goal: ${data.primaryGoal}; package price: ${servicePackage.price}.`;

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
        businessName: data.businessName || null,
      },
      form_data: {
        ...data,
        serviceCategory: 'financial_growth_services',
        packageTitle: servicePackage.title,
        packagePrice: servicePackage.price,
        packageDeliverables: servicePackage.deliverables,
        complianceNote: servicePackage.complianceNote,
      },
      notes: data.notes || summary,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[service-interest] insert failed:', error);
    return NextResponse.json(
      { error: 'Unable to submit service request.' },
      { status: 500 }
    );
  }

  await runNewLeadAutomation({
    leadId: lead.id,
    leadType: 'business_funding',
    name: data.name,
    email: data.email,
    phone: data.phone,
    sourcePath: '/services/financial-growth',
    summary,
    metadata: {
      serviceCategory: 'financial_growth_services',
      packageKey: data.packageKey,
      packageTitle: servicePackage.title,
      packagePrice: servicePackage.price,
      businessName: data.businessName || null,
      primaryGoal: data.primaryGoal,
      timeline: data.timeline || null,
    },
  });

  return NextResponse.json({ success: true, leadId: lead.id });
}
