import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  saveServiceDeliverable,
  type GeneratedServiceDeliverable,
} from '@/lib/services/aiServiceDeliverables';
import { getServicePackageDescriptor } from '@/lib/services/servicePackages';
import { logEvent } from '@/lib/system/logEvent';

const SIGNUP_GROWTH_PACKAGE_KEY = 'visibility_starter' as const;
const SIGNUP_GROWTH_SOURCE = 'account_signup_growth_system';
const SIGNUP_GROWTH_TITLE = 'VestBlock Growth System Starter';

type EnsureSignupGrowthSystemInput = {
  email: string;
  userId?: string | null;
  fullName?: string | null;
};

type EnsureSignupGrowthSystemResult = {
  ok: boolean;
  created: boolean;
  leadId?: string;
  error?: string;
};

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildSignupGrowthDeliverable(input: {
  name?: string | null;
  email: string;
}): GeneratedServiceDeliverable {
  const displayName = input.name?.trim() || 'your team';

  return {
    title: SIGNUP_GROWTH_TITLE,
    summary:
      'Your VestBlock starter workspace is ready. Use it to choose the right seller, buyer, lender, developer, contractor, operator, or capital-partner path, then add DealVault records and AI-powered visibility support when the relationship is ready.',
    sections: [
      {
        heading: 'Start with the right partner path',
        body:
          'VestBlock begins by clarifying who you are in the network and what you need next. Sellers can submit property details, buyers can share buy boxes, lenders can define criteria, and project partners can surface build, repair, or operator capacity.',
        bullets: [
          'Choose a seller, buyer, lender, funding, DealVault, or project-partner path.',
          'Keep criteria, notes, and next steps tied to the same email address.',
          'Use the dashboard as the home base for prepared recommendations and follow-up.',
        ],
      },
      {
        heading: 'Add DealVault when records matter',
        body:
          'As opportunities become more serious, DealVault can help organize proof, milestones, partner notes, and payout visibility so conversations are easier to review.',
        bullets: [
          'Document key deal activity before it gets scattered across messages.',
          'Keep partner expectations, proof, and review history easier to reference.',
          'Use records to support cleaner handoffs between sellers, buyers, lenders, and operators.',
        ],
      },
      {
        heading: 'Use the AEO/SEO Booster after the profile is clear',
        body:
          'VestBlock can support member visibility with AEO/SEO Booster campaigns around the seller, buyer, lender, operator, contractor, or developer profile once the offer and criteria are clear.',
        bullets: [
          'Clarify what your profile should be known for before creating campaign content.',
          'Build useful pages, answers, and proof assets around real services and partner criteria.',
          'Avoid vague marketing work by tying visibility to a real VestBlock relationship.',
        ],
      },
    ],
    recommendedActions: [
      'Open Get Started and choose the path that matches your role in the network.',
      'Submit the clearest criteria or opportunity details you have right now.',
      'Use My Services to track prepared recommendations and future VestBlock growth support.',
      'Ask VestBlock to review partnership, DealVault, or AEO/SEO Booster needs once your profile is clear.',
    ],
    followUpQuestions: [
      'Are you joining as a seller, buyer, lender, developer, contractor, operator, or capital partner?',
      'What criteria, geography, property type, funding lane, or project scope should VestBlock understand first?',
      'Do you need DealVault records, partner introductions, AEO/SEO Booster support, or a combination?',
    ],
    adminReviewFocus: [
      `Confirm the best first path for ${displayName}.`,
      `Check whether ${input.email} should be routed to seller intake, buyer criteria, lender criteria, funding, DealVault, or visibility support.`,
      'Look for partnership potential before recommending any paid campaign or service.',
    ],
    customerMessage:
      'Your starter Growth System is active. The fastest next move is to choose your role, submit the right details, and let VestBlock route the relationship before adding visibility or support services.',
  };
}

function renderMarkdown(deliverable: GeneratedServiceDeliverable) {
  const sections = deliverable.sections
    .map((section) => {
      const bullets = section.bullets?.length
        ? `\n${section.bullets.map((item) => `- ${item}`).join('\n')}`
        : '';
      return `## ${section.heading}\n\n${section.body}${bullets}`;
    })
    .join('\n\n');

  return `# ${deliverable.title}\n\n${deliverable.summary}\n\n${sections}\n\n## Recommended Actions\n\n${deliverable.recommendedActions
    .map((item) => `- ${item}`)
    .join('\n')}\n`;
}

async function upsertProfile(input: EnsureSignupGrowthSystemInput) {
  if (!input.userId) return;

  const admin = createAdminClient();
  const fullName = input.fullName?.trim();
  const payload = {
    id: input.userId,
    email: normalizedEmail(input.email),
    ...(fullName ? { full_name: fullName } : {}),
  };

  const { error } = await admin
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.warn('[signup-growth-system] profile upsert skipped:', error.message);
  }
}

async function findExistingGrowthLead(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('leads')
    .select('id')
    .eq('email', email)
    .eq('lead_type', 'visibility_expansion')
    .eq('source', SIGNUP_GROWTH_SOURCE)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0]?.id ? String(data[0].id) : null;
}

export async function ensureSignupGrowthSystem(
  input: EnsureSignupGrowthSystemInput
): Promise<EnsureSignupGrowthSystemResult> {
  const email = normalizedEmail(input.email);
  if (!email) {
    return { ok: false, created: false, error: 'Email is required.' };
  }

  try {
    await upsertProfile({ ...input, email });

    const existingLeadId = await findExistingGrowthLead(email);
    if (existingLeadId) {
      return { ok: true, created: false, leadId: existingLeadId };
    }

    const admin = createAdminClient();
    const pkg = getServicePackageDescriptor(SIGNUP_GROWTH_PACKAGE_KEY);
    const now = new Date().toISOString();
    const name = input.fullName?.trim() || email;
    const deliverable = buildSignupGrowthDeliverable({ name, email });
    const packageTitle = pkg?.title || SIGNUP_GROWTH_TITLE;
    const packageDeliverables = pkg?.deliverables || [
      'Starter partner path',
      'DealVault readiness notes',
      'AEO/SEO Booster next steps',
    ];

    const { data: lead, error } = await admin
      .from('leads')
      .insert({
        lead_type: 'visibility_expansion',
        status: 'new',
        source: SIGNUP_GROWTH_SOURCE,
        source_url: '/register',
        category: 'member_growth_system',
        name,
        email,
        phone: null,
        business_name: null,
        best_offer: SIGNUP_GROWTH_TITLE,
        pain_signal:
          'New member onboarding for real estate partner network, DealVault records, and AI-powered visibility support.',
        contact_info: {
          name,
          email,
          userId: input.userId || null,
        },
        form_data: {
          packageKey: SIGNUP_GROWTH_PACKAGE_KEY,
          packageTitle: SIGNUP_GROWTH_TITLE,
          packagePrice: 'Included with signup',
          packageDeliverables,
          serviceCategory: 'visibility_expansion',
          onboardingType: 'signup_growth_system',
          userId: input.userId || null,
          primaryGoal:
            'Choose the right VestBlock partner path and prepare for DealVault records or AEO/SEO Booster support.',
          templateTitle: 'Real estate partner starter workspace',
          templateIndustry: 'Real estate',
          templateFirstFocus: [
            'Choose seller, buyer, lender, operator, contractor, developer, or capital partner path.',
            'Clarify criteria, geography, project type, or partnership fit.',
            'Decide whether DealVault records or AEO/SEO Booster support should come next.',
          ],
        },
        market_segment: 'member_growth_system',
        outreach_angle:
          'Member onboarding, partner criteria, DealVault records, and AI-powered visibility',
        notes: `Signup Growth System starter provisioned for ${email}.`,
      })
      .select('id')
      .single();

    if (error || !lead?.id) {
      throw new Error(error?.message || 'Unable to create growth-system lead.');
    }

    const leadId = String(lead.id);
    const generatedAt = now;
    const saveResult = await saveServiceDeliverable({
      leadId,
      packageKey: SIGNUP_GROWTH_PACKAGE_KEY,
      status: 'sent_to_client',
      title: SIGNUP_GROWTH_TITLE,
      summary: deliverable.summary,
      previewText: deliverable.summary.slice(0, 280),
      deliverableJson: deliverable,
      deliverableMarkdown: renderMarkdown(deliverable),
      generatedAt,
      customerSentAt: generatedAt,
    });

    await logEvent({
      eventType: 'admin_action',
      actorUserId: input.userId || null,
      entityType: 'lead',
      entityId: leadId,
      metadata: {
        action: 'signup_growth_system_provisioned',
        email,
        packageKey: SIGNUP_GROWTH_PACKAGE_KEY,
        storageMode: saveResult.ok ? saveResult.storageMode : 'unknown',
      },
    });

    return { ok: true, created: true, leadId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[signup-growth-system] provisioning failed:', message);
    return { ok: false, created: false, error: message };
  }
}

export { SIGNUP_GROWTH_PACKAGE_KEY, SIGNUP_GROWTH_SOURCE, SIGNUP_GROWTH_TITLE };
