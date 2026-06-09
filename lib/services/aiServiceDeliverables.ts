import { createChatCompletion } from '@/lib/openai-service';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getServicePackageDescriptor,
  type ServicePackageKey,
} from '@/lib/services/servicePackages';
import {
  createAdminTask,
  adminTaskDueDates,
} from '@/lib/admin/tasks';
import { logEvent } from '@/lib/system/logEvent';

export type ServiceDeliverableStatus =
  | 'requested'
  | 'generating'
  | 'ready_for_review'
  | 'sent_to_client'
  | 'failed';

export type ServiceDeliverableSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type GeneratedServiceDeliverable = {
  title: string;
  summary: string;
  sections: ServiceDeliverableSection[];
  recommendedActions: string[];
  followUpQuestions: string[];
  adminReviewFocus: string[];
  customerMessage: string;
};

export type PersistedServiceDeliverable = {
  leadId: string;
  packageKey: ServicePackageKey;
  status: ServiceDeliverableStatus;
  title?: string | null;
  summary?: string | null;
  previewText?: string | null;
  deliverableJson?: GeneratedServiceDeliverable | Record<string, unknown>;
  deliverableMarkdown?: string | null;
  errorMessage?: string | null;
  generatedAt?: string | null;
  customerSentAt?: string | null;
  customerViewedAt?: string | null;
  customerResponseStatus?: string | null;
  customerUpgradedAt?: string | null;
  providerMessageId?: string | null;
  storageMode?: 'table' | 'lead_form_data';
};

type DeliverableLeadInput = {
  leadId: string;
  packageKey: ServicePackageKey;
  leadName?: string | null;
  leadEmail?: string | null;
  businessName?: string | null;
  primaryGoal?: string | null;
  monthlyRevenueRange?: string | null;
  creditScoreRange?: string | null;
  timeline?: string | null;
  notes?: string | null;
  formData?: Record<string, unknown>;
};

type PackagePlaybook = {
  primaryGoal: string;
  sections: string[];
  followUpFocus: string[];
};

const packagePlaybooks: Record<ServicePackageKey, PackagePlaybook> = {
  funding_readiness_snapshot: {
    primaryGoal: 'Assess funding preparation needs before applications begin.',
    sections: [
      'Current funding preparation snapshot',
      'What needs to be cleaned up first',
      'Document checklist',
      'Safest next funding path',
    ],
    followUpFocus: [
      'missing revenue or business identity details',
      'credit-utilization issues',
      'whether the $300 funding prep plan is justified',
    ],
  },
  business_credit_builder_sprint: {
    primaryGoal: 'Lay out a stronger business-credit foundation and vendor setup path.',
    sections: [
      'Foundation gaps',
      'Business profile and vendor setup steps',
      'Monitoring and milestone plan',
      'What should happen before larger funding conversations',
    ],
    followUpFocus: [
      'business identity and EIN details',
      'bank-account and vendor sequencing',
      'milestones before moving into funding',
    ],
  },
  grant_application_prep: {
    primaryGoal: 'Improve grant preparation, narrative, and documentation quality.',
    sections: [
      'Grant fit review',
      'Narrative and use-of-funds guidance',
      'Required document checklist',
      'Deadline and submission prep',
    ],
    followUpFocus: [
      'weak fit or unclear use of funds',
      'missing supporting documents',
      'whether the business setup path is needed first',
    ],
  },
  debt_utilization_plan: {
    primaryGoal: 'Create a safer utilization-reduction and paydown plan tied to funding preparation goals.',
    sections: [
      'Current utilization pressure',
      'Suggested paydown order',
      'Timing notes before funding or dispute moves',
      'Risk flags and next review point',
    ],
    followUpFocus: [
      'high-balance accounts',
      'timing before applications',
      'whether credit-analysis or dispute support is also needed',
    ],
  },
  cash_flow_document_review: {
    primaryGoal: 'Organize deposits, bank statements, and lender-facing business documents.',
    sections: [
      'Cash-flow story summary',
      'Document gaps',
      'Questions a lender or partner may ask',
      'Cleanup priorities before funding review',
    ],
    followUpFocus: [
      'revenue consistency',
      'missing statements or unclear deposits',
      'whether the funding prep plan should follow',
    ],
  },
  real_estate_deal_review: {
    primaryGoal: 'Prepare a real-estate deal summary and lender-ready document path.',
    sections: [
      'Deal summary',
      'Funding fit and likely friction points',
      'Document and timeline checklist',
      'Partner or lender routing notes',
    ],
    followUpFocus: [
      'deal structure and exit strategy',
      'missing documents or numbers',
      'which lender or partner conversation is most realistic',
    ],
  },
  ai_receptionist_launch: {
    primaryGoal: 'Deploy a branded AI receptionist that captures leads and handles repeat questions cleanly.',
    sections: [
      'Customer journey and lead-capture gaps',
      'AI receptionist script and FAQ coverage',
      'Routing and escalation rules',
      'Launch checklist and first-round tuning plan',
    ],
    followUpFocus: [
      'top inbound questions and objections',
      'handoff triggers to a human',
      'which channels should receive new lead alerts',
    ],
  },
  appointment_booking_system: {
    primaryGoal: 'Turn website conversations into qualified appointments with a clearer booking path.',
    sections: [
      'Booking friction points',
      'Qualification questions and scheduling logic',
      'Calendar handoff and no-show prevention notes',
      'Launch sequence and reporting plan',
    ],
    followUpFocus: [
      'which appointments should qualify automatically',
      'calendar ownership and availability rules',
      'how reminders and missed-lead alerts should work',
    ],
  },
  website_upgrade_sprint: {
    primaryGoal: 'Fix the conversion path before more money is spent on traffic.',
    sections: [
      'Homepage and CTA friction review',
      'Mobile and trust-signal priorities',
      'Lead capture and booking-path recommendations',
      'Sprint scope and rollout plan',
    ],
    followUpFocus: [
      'weak pages or missing trust elements',
      'which pages must be upgraded first',
      'whether booking flow or chat should be part of the sprint',
    ],
  },
  visibility_starter: {
    primaryGoal: 'Create a baseline AEO/SEO Booster plan that can improve month after month.',
    sections: [
      'Current visibility gap summary',
      'AEO/SEO priorities',
      'Content and page opportunity list',
      'First 30-day execution plan',
    ],
    followUpFocus: [
      'which services or locations should rank first',
      'existing site, listing, and citation gaps',
      'how to measure visibility progress without overpromising',
    ],
  },
  city_expansion_engine: {
    primaryGoal: 'Build a repeatable city growth plan across SEO, AEO, and local landing pages.',
    sections: [
      'City and service priorities',
      'Location-page opportunity queue',
      'Operational publishing rhythm',
      'Performance tracking and review loop',
    ],
    followUpFocus: [
      'best city order and service order',
      'existing local proof and page assets',
      'team capacity for ongoing publishing and review',
    ],
  },
  authority_pr_engine: {
    primaryGoal: 'Increase brand authority with PR, citations, and expert outreach that improves discoverability.',
    sections: [
      'Authority gap and positioning review',
      'PR angles and outreach targets',
      'Pitch and follow-up cadence',
      '90-day authority roadmap',
    ],
    followUpFocus: [
      'best stories or proof points to lead with',
      'which PR channels are highest value first',
      'how authority work should support AEO/SEO growth',
    ],
  },
};

function parseJsonResponse(content: string): GeneratedServiceDeliverable {
  const parsed = JSON.parse(content) as GeneratedServiceDeliverable;

  if (
    !parsed ||
    typeof parsed.title !== 'string' ||
    typeof parsed.summary !== 'string' ||
    !Array.isArray(parsed.sections) ||
    !Array.isArray(parsed.recommendedActions) ||
    !Array.isArray(parsed.followUpQuestions) ||
    !Array.isArray(parsed.adminReviewFocus) ||
    typeof parsed.customerMessage !== 'string'
  ) {
    throw new Error('Generated deliverable JSON was incomplete.');
  }

  return parsed;
}

function renderDeliverableMarkdown(
  pkgTitle: string,
  deliverable: GeneratedServiceDeliverable
) {
  const sections = deliverable.sections
    .map((section) => {
      const bullets = section.bullets?.length
        ? `\n${section.bullets.map((item) => `- ${item}`).join('\n')}`
        : '';
      return `## ${section.heading}\n\n${section.body}${bullets}`;
    })
    .join('\n\n');

  const actions = deliverable.recommendedActions.map((item) => `- ${item}`).join('\n');
  const questions = deliverable.followUpQuestions.map((item) => `- ${item}`).join('\n');
  const admin = deliverable.adminReviewFocus.map((item) => `- ${item}`).join('\n');

  return `# ${pkgTitle}\n\n## Summary\n\n${deliverable.summary}\n\n${sections}\n\n## Recommended Actions\n\n${actions}\n\n## Follow-Up Questions\n\n${questions}\n\n## Admin Review Focus\n\n${admin}\n\n## Customer Message\n\n${deliverable.customerMessage}\n`;
}

async function persistToLeadFormData(
  input: PersistedServiceDeliverable & { formData?: Record<string, unknown> }
) {
  const admin = createAdminClient();
  const { data: lead, error: lookupError } = await admin
    .from('leads')
    .select('form_data')
    .eq('id', input.leadId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }

  const formData =
    lead?.form_data && typeof lead.form_data === 'object' ? lead.form_data : {};

  const nextFormData = {
    ...formData,
    aiServiceDeliverable: {
      packageKey: input.packageKey,
      status: input.status,
      title: input.title ?? null,
      summary: input.summary ?? null,
      previewText: input.previewText ?? null,
      deliverableJson: input.deliverableJson ?? {},
      deliverableMarkdown: input.deliverableMarkdown ?? null,
      errorMessage: input.errorMessage ?? null,
      generatedAt: input.generatedAt ?? null,
      customerSentAt: input.customerSentAt ?? null,
      providerMessageId: input.providerMessageId ?? null,
    },
  };

  const { error: updateError } = await admin
    .from('leads')
    .update({
      form_data: nextFormData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.leadId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, storageMode: 'lead_form_data' as const };
}

export async function saveServiceDeliverable(input: PersistedServiceDeliverable) {
  const admin = createAdminClient();
  const payload = {
    lead_id: input.leadId,
    package_key: input.packageKey,
    status: input.status,
    title: input.title ?? null,
    summary: input.summary ?? null,
    preview_text: input.previewText ?? null,
    deliverable_json: input.deliverableJson ?? {},
    deliverable_markdown: input.deliverableMarkdown ?? null,
    error_message: input.errorMessage ?? null,
    generated_at: input.generatedAt ?? null,
    customer_sent_at: input.customerSentAt ?? null,
    provider_message_id: input.providerMessageId ?? null,
  };

  try {
    const { error } = await admin
      .from('service_deliverables')
      .upsert(payload, { onConflict: 'lead_id' });

    if (error) {
      const fallback = await persistToLeadFormData(input);
      if (!fallback.ok) {
        return { ok: false, error: error.message };
      }
      return { ok: true, storageMode: fallback.storageMode };
    }

    await persistToLeadFormData(input);
    return { ok: true, storageMode: 'table' as const };
  } catch (error) {
    const fallback = await persistToLeadFormData(input);
    if (!fallback.ok) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return { ok: true, storageMode: fallback.storageMode };
  }
}

export async function getServiceDeliverableForLead(leadId: string) {
  const admin = createAdminClient();

  try {
    const { data, error } = await admin
      .from('service_deliverables')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (!error && data) {
      return {
        ok: true,
        deliverable: {
          leadId: data.lead_id,
          packageKey: data.package_key,
          status: data.status,
          title: data.title,
          summary: data.summary,
          previewText: data.preview_text,
          deliverableJson: data.deliverable_json,
          deliverableMarkdown: data.deliverable_markdown,
          errorMessage: data.error_message,
          generatedAt: data.generated_at,
          customerSentAt: data.customer_sent_at,
          customerViewedAt: data.customer_viewed_at,
          customerResponseStatus: data.customer_response_status,
          customerUpgradedAt: data.customer_upgraded_at,
          providerMessageId: data.provider_message_id,
          storageMode: 'table' as const,
        },
      };
    }
  } catch {
    // Fallback below.
  }

  const { data: lead, error: leadError } = await admin
    .from('leads')
    .select('form_data')
    .eq('id', leadId)
    .maybeSingle();

  if (leadError) {
    return { ok: false, error: leadError.message };
  }

  const raw =
    lead?.form_data &&
    typeof lead.form_data === 'object' &&
    'aiServiceDeliverable' in lead.form_data
      ? (lead.form_data.aiServiceDeliverable as Record<string, unknown>)
      : null;

  if (!raw) {
    return { ok: true, deliverable: null };
  }

  return {
    ok: true,
    deliverable: {
      leadId,
      packageKey: String(raw.packageKey || ''),
      status: String(raw.status || 'requested') as ServiceDeliverableStatus,
      title: (raw.title as string | null) ?? null,
      summary: (raw.summary as string | null) ?? null,
      previewText: (raw.previewText as string | null) ?? null,
      deliverableJson: (raw.deliverableJson as Record<string, unknown>) ?? {},
      deliverableMarkdown: (raw.deliverableMarkdown as string | null) ?? null,
      errorMessage: (raw.errorMessage as string | null) ?? null,
      generatedAt: (raw.generatedAt as string | null) ?? null,
      customerSentAt: (raw.customerSentAt as string | null) ?? null,
      customerViewedAt: (raw.customerViewedAt as string | null) ?? null,
      customerResponseStatus: (raw.customerResponseStatus as string | null) ?? null,
      customerUpgradedAt: (raw.customerUpgradedAt as string | null) ?? null,
      providerMessageId: (raw.providerMessageId as string | null) ?? null,
      storageMode: 'lead_form_data' as const,
    },
  };
}

async function generateDeliverableContent(input: DeliverableLeadInput) {
  const pkg = getServicePackageDescriptor(input.packageKey);
  const packagePlaybook = packagePlaybooks[input.packageKey];

  if (!pkg || !packagePlaybook) {
    throw new Error('Unknown service package.');
  }

  const serializedFormData = input.formData
    ? JSON.stringify(input.formData, null, 2).slice(0, 4000)
    : 'Not provided';

  const prompt = `
You are VestBlock's paid-service fulfillment assistant.
Generate a compliance-safe, useful first-pass deliverable for a paid VestBlock service request.

Rules:
- Do not promise approvals, funding amounts, grant awards, score increases, rankings, traffic, citations, media pickups, financing, or outcomes.
- Use direct professional language.
- Keep everything truthful, documentable, and framed as education, organization, review, and next-step support.
- Include concrete strategy detail that a business owner or team could actually use.
- Return valid JSON only.

Package:
- title: ${pkg.title}
- summary: ${pkg.summary}
- category: ${pkg.kind}
- price_label: ${pkg.priceLabel}
- best_for: ${pkg.bestFor}
- primary_goal: ${packagePlaybook.primaryGoal}
- included_deliverables: ${pkg.deliverables.join('; ')}
- compliance_note: ${pkg.complianceNote}

Requested section focus:
${packagePlaybook.sections.map((item) => `- ${item}`).join('\n')}

Admin follow-up focus:
${packagePlaybook.followUpFocus.map((item) => `- ${item}`).join('\n')}

Client details:
- lead_name: ${input.leadName || 'Unknown'}
- business_name: ${input.businessName || 'Not provided'}
- primary_goal: ${input.primaryGoal || 'Not provided'}
- monthly_revenue_range: ${input.monthlyRevenueRange || 'Not provided'}
- credit_score_range: ${input.creditScoreRange || 'Not provided'}
- timeline: ${input.timeline || 'Not provided'}
- notes: ${input.notes || 'Not provided'}

Original intake payload:
${serializedFormData}

Return JSON with this exact shape:
{
  "title": "string",
  "summary": "string",
  "sections": [
    {
      "heading": "string",
      "body": "string",
      "bullets": ["string"]
    }
  ],
  "recommendedActions": ["string"],
  "followUpQuestions": ["string"],
  "adminReviewFocus": ["string"],
  "customerMessage": "string"
}
`;

  const response = await createChatCompletion(
    [
      {
        role: 'system',
        content:
          'You produce structured service deliverables for VestBlock. Be concrete, concise, and compliance-safe.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    false,
    {
      model: 'gpt-4o',
      temperature: 0.35,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      timeout: 45000,
    }
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty service deliverable.');
  }

  return parseJsonResponse(content);
}

export async function createServiceDeliverableTasks(input: {
  leadId: string;
  packageKey: ServicePackageKey;
  packageTitle: string;
  status: 'ready_for_review' | 'failed';
  leadEmail?: string | null;
  errorMessage?: string | null;
}) {
  if (input.status === 'ready_for_review') {
    return createAdminTask({
      title: `Review AI deliverable for ${input.packageTitle}`,
      description:
        'An AI-generated first-pass deliverable is ready. Review the output, tighten anything sensitive, and decide whether to send follow-up or convert the lead into the next paid step.',
      taskType: 'service_deliverable_review',
      priority: 'normal',
      userEmail: input.leadEmail,
      entityType: 'lead',
      entityId: input.leadId,
      dueAt: adminTaskDueDates.hours(4),
      metadata: {
        packageKey: input.packageKey,
        packageTitle: input.packageTitle,
        nextAction: 'Review deliverable and decide next customer follow-up.',
      },
    });
  }

  return createAdminTask({
    title: `Fix AI deliverable for ${input.packageTitle}`,
    description:
      'A paid service request did not complete AI generation. Review the request details, retry generation, and make sure the lead still gets a timely follow-up.',
    taskType: 'service_deliverable_failed',
    priority: 'high',
    userEmail: input.leadEmail,
    entityType: 'lead',
    entityId: input.leadId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      packageKey: input.packageKey,
      packageTitle: input.packageTitle,
      errorMessage: input.errorMessage,
      nextAction: 'Retry generation or fulfill manually.',
    },
  });
}

export async function generateAndStoreServiceDeliverable(input: DeliverableLeadInput) {
  const pkg = getServicePackageDescriptor(input.packageKey);

  if (!pkg) {
    throw new Error('Unknown service package.');
  }

  await saveServiceDeliverable({
    leadId: input.leadId,
    packageKey: input.packageKey,
    status: 'requested',
    title: pkg.title,
    summary: pkg.summary,
    previewText: 'Service request received. Deliverable is queued for generation.',
  });

  await saveServiceDeliverable({
    leadId: input.leadId,
    packageKey: input.packageKey,
    status: 'generating',
    title: pkg.title,
    summary: pkg.summary,
    previewText: 'Generating first-pass deliverable...',
  });

  try {
    const deliverable = await generateDeliverableContent(input);
    const deliverableMarkdown = renderDeliverableMarkdown(pkg.title, deliverable);
    const previewText = deliverable.summary.slice(0, 280);
    const generatedAt = new Date().toISOString();

    const persistResult = await saveServiceDeliverable({
      leadId: input.leadId,
      packageKey: input.packageKey,
      status: 'ready_for_review',
      title: deliverable.title,
      summary: deliverable.summary,
      previewText,
      deliverableJson: deliverable,
      deliverableMarkdown,
      generatedAt,
    });

    await logEvent({
      eventType: 'service_deliverable_generated',
      entityType: 'lead',
      entityId: input.leadId,
      metadata: {
        packageKey: input.packageKey,
        packageTitle: pkg.title,
        storageMode: persistResult.ok ? persistResult.storageMode : 'unknown',
      },
    });

    await createServiceDeliverableTasks({
      leadId: input.leadId,
      packageKey: input.packageKey,
      packageTitle: pkg.title,
      status: 'ready_for_review',
      leadEmail: input.leadEmail,
    });

    return {
      ok: true,
      status: 'ready_for_review' as const,
      deliverable,
      deliverableMarkdown,
      storageMode: persistResult.ok ? persistResult.storageMode : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await saveServiceDeliverable({
      leadId: input.leadId,
      packageKey: input.packageKey,
      status: 'failed',
      title: pkg.title,
      summary: pkg.summary,
      previewText: 'AI generation failed. Manual review or retry is needed.',
      errorMessage: message,
    });

    await logEvent({
      eventType: 'service_deliverable_failed',
      entityType: 'lead',
      entityId: input.leadId,
      metadata: {
        packageKey: input.packageKey,
        packageTitle: pkg.title,
        errorMessage: message,
      },
    });

    await createServiceDeliverableTasks({
      leadId: input.leadId,
      packageKey: input.packageKey,
      packageTitle: pkg.title,
      status: 'failed',
      leadEmail: input.leadEmail,
      errorMessage: message,
    });

    return { ok: false, status: 'failed' as const, error: message };
  }
}

export async function markServiceDeliverableSent(input: {
  leadId: string;
  packageKey: ServicePackageKey;
  title?: string | null;
  summary?: string | null;
  previewText?: string | null;
  deliverableJson?: GeneratedServiceDeliverable | Record<string, unknown>;
  deliverableMarkdown?: string | null;
  generatedAt?: string | null;
  providerMessageId?: string | null;
}) {
  const customerSentAt = new Date().toISOString();

  return saveServiceDeliverable({
    leadId: input.leadId,
    packageKey: input.packageKey,
    status: 'sent_to_client',
    title: input.title ?? null,
    summary: input.summary ?? null,
    previewText: input.previewText ?? null,
    deliverableJson: input.deliverableJson ?? {},
    deliverableMarkdown: input.deliverableMarkdown ?? null,
    generatedAt: input.generatedAt ?? customerSentAt,
    customerSentAt,
    providerMessageId: input.providerMessageId ?? null,
  });
}
