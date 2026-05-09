export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSmallBusinessTemplate,
  smallBusinessTemplateKeys,
} from '@/lib/services/smallBusinessTemplates';
import {
  getVisibilityExpansionPackage,
  visibilityExpansionPackageKeys,
} from '@/lib/services/visibilityExpansionPackages';
import { queueGrowthServiceRequest } from '@/lib/inngest/events';
import { captureServerEvent } from '@/lib/analytics/server';
import { analyticsEvents } from '@/lib/analytics/events';

const visibilityExpansionRequestSchema = z.object({
  packageKey: z.enum(visibilityExpansionPackageKeys),
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(140),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  websiteUrl: z.string().trim().max(240).optional().or(z.literal('')),
  primaryOffer: z.string().trim().min(2).max(180),
  cityFocus: z.string().trim().max(180).optional().or(z.literal('')),
  monthlyRevenueGoal: z.string().trim().max(120).optional().or(z.literal('')),
  biggestGap: z.string().trim().min(3).max(220),
  notes: z.string().trim().max(1600).optional().or(z.literal('')),
  templateKey: z.enum(smallBusinessTemplateKeys).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = visibilityExpansionRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Check the request details and try again.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const servicePackage = getVisibilityExpansionPackage(data.packageKey);
    const selectedTemplate = data.templateKey
      ? getSmallBusinessTemplate(data.templateKey)
      : null;

    if (!servicePackage) {
      return NextResponse.json(
        { error: 'Unknown visibility package.' },
        { status: 400 }
      );
    }

    const summary = `${servicePackage.title} request for ${data.businessName}; offer: ${data.primaryOffer}; gap: ${data.biggestGap}.`;
    const supabaseAdmin = createAdminClient();

    const { data: lead, error: leadsError } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: 'visibility_expansion',
        status: 'new',
        source: 'visibility_expansion_request',
        source_url: '/visibility-expansion',
        category: 'small_business',
        name: data.contactName,
        business_name: data.businessName,
        email: data.email,
        phone: data.phone,
        website: data.websiteUrl || null,
        best_offer: servicePackage.title,
        pain_signal: data.biggestGap,
        contact_info: {
          name: data.contactName,
          email: data.email,
          phone: data.phone,
          businessName: data.businessName,
        },
        form_data: {
          ...data,
          templateTitle: selectedTemplate?.title || null,
          templateIndustry: selectedTemplate?.industry || null,
          templateFirstFocus: selectedTemplate?.visibility.firstFocus || [],
          packageTitle: servicePackage.title,
          packagePrice: servicePackage.priceLabel,
          packageDeliverables: servicePackage.deliverables,
          billingModel: servicePackage.billingModel,
          turnaround: servicePackage.turnaround,
          serviceCategory: 'visibility_expansion',
        },
        market_segment: 'visibility_expansion',
        outreach_angle: 'Search, AI-answer, and PR visibility service',
        notes: data.notes || summary,
      })
      .select('id')
      .single();

    if (leadsError || !lead?.id) {
      console.error('Visibility expansion lead insert failed:', leadsError);
      return NextResponse.json(
        { error: 'Unable to save the request right now. Please try again shortly.' },
        { status: 500 }
      );
    }

    const workflowResult = await queueGrowthServiceRequest({
      leadId: lead.id,
      leadType: 'visibility_expansion',
      sourcePath: '/visibility-expansion',
      summary,
      packageKey: data.packageKey,
      leadName: data.contactName,
      leadEmail: data.email,
      phone: data.phone,
      businessName: data.businessName,
      primaryGoal: `${data.primaryOffer} search visibility growth`,
      monthlyRevenueRange: data.monthlyRevenueGoal || null,
      timeline: data.cityFocus || null,
      notes: data.notes || data.biggestGap,
      automationMetadata: {
        packageKey: data.packageKey,
        packageTitle: servicePackage.title,
        packagePrice: servicePackage.priceLabel,
        templateKey: data.templateKey || null,
        templateTitle: selectedTemplate?.title || null,
        businessName: data.businessName,
        websiteUrl: data.websiteUrl || null,
        primaryOffer: data.primaryOffer,
        cityFocus: data.cityFocus || null,
        monthlyRevenueGoal: data.monthlyRevenueGoal || null,
      },
      deliverableFormData: {
        ...data,
        templateTitle: selectedTemplate?.title || null,
        templateIndustry: selectedTemplate?.industry || null,
        templateFirstFocus: selectedTemplate?.visibility.firstFocus || [],
        packageTitle: servicePackage.title,
        packagePrice: servicePackage.priceLabel,
        packageDeliverables: servicePackage.deliverables,
        billingModel: servicePackage.billingModel,
        turnaround: servicePackage.turnaround,
      },
    });

    void captureServerEvent({
      distinctId: data.email,
      event: analyticsEvents.growthServiceRequestSubmitted,
      properties: {
        leadId: lead.id,
        serviceArea: 'search_visibility',
        packageKey: data.packageKey,
        packageTitle: servicePackage.title,
        templateKey: data.templateKey || null,
        cityFocus: data.cityFocus || null,
        primaryOffer: data.primaryOffer,
        sourcePath: '/visibility-expansion',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Request submitted successfully',
      automationTriggered: workflowResult.automationTriggered,
      deliverableStatus: workflowResult.deliverableStatus,
      processingMode: workflowResult.processingMode,
    });
  } catch (error: any) {
    console.error('Visibility expansion request error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
