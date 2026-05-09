export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  automationPackageKeys,
  getAutomationPackage,
} from '@/lib/services/automationPackages';
import {
  getSmallBusinessTemplate,
  smallBusinessTemplateKeys,
} from '@/lib/services/smallBusinessTemplates';
import { queueGrowthServiceRequest } from '@/lib/inngest/events';
import { captureServerEvent } from '@/lib/analytics/server';
import { analyticsEvents } from '@/lib/analytics/events';

const aiAssistantRequestSchema = z.object({
  packageKey: z.enum(automationPackageKeys),
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(140),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  websiteUrl: z.string().trim().max(240).optional().or(z.literal('')),
  industry: z.string().trim().min(2).max(120),
  currentSystem: z.string().trim().max(240).optional().or(z.literal('')),
  monthlyLeadVolume: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(1600).optional().or(z.literal('')),
  templateKey: z.enum(smallBusinessTemplateKeys).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = aiAssistantRequestSchema.safeParse(await req.json());

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
    const servicePackage = getAutomationPackage(data.packageKey);
    const selectedTemplate = data.templateKey
      ? getSmallBusinessTemplate(data.templateKey)
      : null;

    if (!servicePackage) {
      return NextResponse.json(
        { error: 'Unknown setup package.' },
        { status: 400 }
      );
    }

    const summary = `${servicePackage.title} request for ${data.businessName}; industry: ${data.industry}; website: ${data.websiteUrl || 'not provided'}.`;

    const supabaseAdmin = createAdminClient();
    const { data: lead, error: leadsError } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: servicePackage.leadType,
        status: 'new',
        source: 'website_service_request',
        source_url: '/ai-assistant',
        category: servicePackage.leadCategory,
        name: data.contactName,
        business_name: data.businessName,
        email: data.email,
        phone: data.phone,
        website: data.websiteUrl || null,
        best_offer: servicePackage.bestOffer,
        pain_signal:
          data.notes ||
          (servicePackage.key === 'website_upgrade_sprint'
            ? 'Weak website conversion path'
            : 'Lead capture or booking friction'),
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
          templateFirstFocus: selectedTemplate?.aiAssistant.firstFocus || [],
          packageTitle: servicePackage.title,
          packagePrice: servicePackage.priceLabel,
          packageDeliverables: servicePackage.deliverables,
          billingModel: servicePackage.billingModel,
          turnaround: servicePackage.turnaround,
          serviceCategory: 'growth_automation',
        },
        notes: data.notes || summary,
      })
      .select('id')
      .single();

    if (leadsError || !lead?.id) {
      console.error('AI assistant lead insert failed:', leadsError);
      return NextResponse.json(
        { error: 'Unable to save the request right now. Please try again shortly.' },
        { status: 500 }
      );
    }

    const workflowResult = await queueGrowthServiceRequest({
      leadId: lead.id,
      leadType: servicePackage.leadType,
      sourcePath: '/ai-assistant',
      summary,
      packageKey: data.packageKey,
      leadName: data.contactName,
      leadEmail: data.email,
      phone: data.phone,
      businessName: data.businessName,
      primaryGoal:
        data.notes ||
        `${servicePackage.title} rollout for ${data.industry} lead capture and booking support.`,
      timeline: data.monthlyLeadVolume || null,
      notes: data.notes || null,
      automationMetadata: {
        packageKey: data.packageKey,
        packageTitle: servicePackage.title,
        packagePrice: servicePackage.priceLabel,
        bestOffer: servicePackage.bestOffer,
        templateKey: data.templateKey || null,
        templateTitle: selectedTemplate?.title || null,
        businessName: data.businessName,
        websiteUrl: data.websiteUrl || null,
        industry: data.industry,
        currentSystem: data.currentSystem || null,
        monthlyLeadVolume: data.monthlyLeadVolume || null,
      },
      deliverableFormData: {
        ...data,
        templateTitle: selectedTemplate?.title || null,
        templateIndustry: selectedTemplate?.industry || null,
        templateFirstFocus: selectedTemplate?.aiAssistant.firstFocus || [],
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
        serviceArea: 'ai_receptionist',
        packageKey: data.packageKey,
        packageTitle: servicePackage.title,
        templateKey: data.templateKey || null,
        industry: data.industry,
        sourcePath: '/ai-assistant',
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
    console.error('AI Assistant request error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
