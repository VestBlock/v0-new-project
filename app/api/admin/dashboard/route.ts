import { NextResponse } from 'next/server';
import { vestblockAeoTopics } from '@/lib/aeo/topics';
import { checkAdminAccess } from '@/lib/auth/admin';
import { vestblockMarketingServices } from '@/lib/content/marketingServices';
import { getPaypalEnvironment } from '@/lib/paypal/config';
import { getServiceSeoPageByServiceKey } from '@/lib/seo/serviceSeoPages';
import { vestBlockServiceDirectory } from '@/lib/services/serviceDirectory';
import { createAdminClient } from '@/lib/supabase/admin';

type DashboardDataSourceIssue = {
  source: string;
  message: string;
};

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: any }>,
  label: string,
  issues?: DashboardDataSourceIssue[]
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    const message = error.message || 'Unknown query error.';
    console.warn(`[admin-dashboard] ${label} unavailable:`, message);
    issues?.push({ source: label, message });
    return [];
  }
  return data ?? [];
}

function getDate(row: any) {
  return (
    row?.created_at || row?.uploaded_at || row?.updated_at || new Date(0).toISOString()
  );
}

function countBy<T extends Record<string, any>>(
  rows: T[],
  key: string,
  value: string
) {
  return rows.filter((row) => String(row[key] || '').toLowerCase() === value.toLowerCase()).length;
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hoursSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / (1000 * 60 * 60);
}

function daysSince(value?: string | null) {
  return hoursSince(value) / 24;
}

function isWithinDays(value: string | null | undefined, days: number) {
  return daysSince(value) <= days;
}

function isWithinHours(value: string | null | undefined, hours: number) {
  return hoursSince(value) <= hours;
}

const automationEventTypes = new Set([
  'credit_analysis_stalled',
  'signup_no_upload',
  'paid_customer_no_upload',
  'lead_followup_needed',
  'funding_strategy_submitted',
  'funding_strategy_paid',
  'funding_strategy_status_updated',
  'dispute_letters_ready',
  'dispute_letter_mail_reminder',
  'dispute_secondary_bureau_reminder',
  'dispute_bureau_response_due',
  'dispute_letter_status_updated',
  'email_sent',
  'email_failed',
  'checkout_started',
  'payment_completed',
  'payment_failed',
  'abandoned_checkout',
]);

const lifecycleEmailTypes = new Set([
  'user_upload_reminder',
  'user_paid_upload_reminder',
  'admin_lead_followup',
  'admin_abandoned_checkout',
  'user_dispute_letters_ready',
  'user_dispute_letter_mail_reminder',
  'user_dispute_secondary_bureau_reminder',
  'user_dispute_bureau_response_reminder',
  'admin_dispute_letter_followup',
]);

const dashboardDataSources = [
  'user_profiles',
  'credit_reports',
  'analysis_jobs',
  'dispute_letters',
  'payments',
  'email_events',
  'outreach_send_events',
  'admin_activity',
  'leads',
  'admin_tasks',
  'content_assets',
  'funding_strategy_requests',
  'funding_profiles',
  'funding_recommendations',
  'funding_sequence_items',
  'funding_payments',
  'lenders',
  'lender_outreach_messages',
  'buyers',
  'buyer_outreach_messages',
  'sam_watchlists',
  'sam_opportunities',
  'sam_exclusion_checks',
  'sam_alert_runs',
  'sam_award_intelligence',
  'sam_assistance_listings',
] as const;

const serviceContentKeys: Record<string, string> = {
  credit_analysis: 'ai_credit_analysis',
  business_funding: 'business_funding',
  credit_card_stacking: 'credit_card_stacking',
  business_setup: 'business_setup',
  financial_growth_services: 'financial_growth_services',
  grants: 'grants',
  spanish_funding: 'spanish_business_funding',
  real_estate_funding: 'real_estate_funding',
  sell_property: 'sell_property',
  ai_assistant: 'ai_assistant',
  visibility_expansion: 'visibility_expansion',
};

export async function GET() {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const supabase = createAdminClient();
  const dataSourceIssues: DashboardDataSourceIssue[] = [];

  const [
    users,
    reports,
    jobs,
    letters,
    payments,
    emailEvents,
    outreachSendEvents,
    adminActivity,
    leads,
    tasks,
    contentAssets,
    fundingStrategyRequests,
    fundingProfiles,
    fundingRecommendations,
    fundingSequenceItems,
    fundingPayments,
    lenders,
    lenderOutreachMessages,
    buyers,
    buyerOutreachMessages,
    _samWatchlists,
    _samOpportunities,
    _samExclusionChecks,
    _samAlertRuns,
    _samAwardIntelligence,
    _samAssistanceListings,
  ] =
    await Promise.all([
      safeRows<any>(
        supabase
          .from('user_profiles')
          .select('id,user_id,email,full_name,role,is_subscribed,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(250),
        'user_profiles',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('credit_reports')
          .select(
            'id,user_id,user_email,file_name,file_path,file_url,status,email_alert_sent,error_message,admin_notes,created_at,updated_at,uploaded_at,completed_at,analysis_json,dispute_letters_json,ai_analysis'
          )
          .order('created_at', { ascending: false })
          .limit(250),
        'credit_reports',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('analysis_jobs')
          .select(
            'id,user_id,status,original_file_name,file_path,error_message,created_at,updated_at,text_extraction_completed_at,ai_analysis_completed_at'
          )
          .order('created_at', { ascending: false })
          .limit(250),
        'analysis_jobs',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('dispute_letters')
          .select(
            'id,user_id,status,letter_type,creditor_name,account_name,pdf_url,pdf_path,created_at,updated_at'
          )
          .order('created_at', { ascending: false })
          .limit(250),
        'dispute_letters',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('payments')
          .select('id,user_id,amount,status,payment_method,paypal_transaction_id,product_type,metadata_json,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(100),
        'payments',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('email_events')
          .select('id,user_id,user_email,event_type,subject,status,provider_message_id,error_message,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        'email_events',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('outreach_send_events')
          .select('id,channel,status,created_at')
          .order('created_at', { ascending: false })
          .limit(5000),
        'outreach_send_events',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('admin_activity')
          .select('id,actor_user_id,action_type,entity_type,entity_id,metadata_json,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        'admin_activity',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('leads')
          .select(
            'id,lead_type,status,outreach_status,delivery_status,name,email,phone,notes,last_contacted_at,created_at,updated_at'
          )
          .order('created_at', { ascending: false })
          .limit(100),
        'leads',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('admin_tasks')
          .select(
            'id,title,description,task_type,status,priority,assigned_to,user_id,user_email,entity_type,entity_id,due_at,completed_at,metadata_json,created_by,created_at,updated_at'
          )
          .order('due_at', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(100),
        'admin_tasks',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('content_assets')
          .select(
            'id,title,slug,content_type,service_key,language,audience,prompt,status,platform,post_type,seo_title,meta_description,excerpt,body_markdown,social_caption,hashtags,cta_label,cta_url,publish_path,metadata_json,created_by,created_at,updated_at,published_at'
          )
          .order('created_at', { ascending: false })
          .limit(100),
        'content_assets',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('funding_strategy_requests')
          .select(
            'id,user_id,user_email,full_name,phone,business_name,business_stage,business_age_months,monthly_revenue,personal_credit_score,current_utilization,recent_inquiries,has_ein,has_business_bank,has_business_credit_card,requested_funding_amount,use_of_funds,readiness_score,readiness_tier,readiness_summary,strengths_json,risks_json,next_steps_json,consent_hard_inquiries,consent_no_guarantee,consent_terms_review,consent_success_fee,success_fee_rate,status,payment_status,paypal_order_id,payment_id,admin_notes,created_at,updated_at,paid_at'
          )
          .order('created_at', { ascending: false })
          .limit(100),
        'funding_strategy_requests',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('funding_profiles')
          .select(
            'id,user_id,mode,funding_goal_amount,fico_estimate,risk_level,readiness_score,created_at,updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(250),
        'funding_profiles',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('funding_recommendations')
          .select(
            'id,user_id,profile_id,mode,recommended_path,readiness_score,estimated_funding_min,estimated_funding_max,created_at,updated_at'
          )
          .order('created_at', { ascending: false })
          .limit(250),
        'funding_recommendations',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('funding_sequence_items')
          .select(
            'id,user_id,recommendation_id,status,approved_limit,created_at,updated_at,approved_at'
          )
          .order('updated_at', { ascending: false })
          .limit(500),
        'funding_sequence_items',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('funding_payments')
          .select(
            'id,user_id,recommendation_id,payment_plan,amount_paid,amount_due,status,created_at,updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(250),
        'funding_payments',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('lenders')
          .select(
            'id,name,category,lender_type,relationship_stage,outreach_status,next_follow_up_at,last_contacted_at,created_at,updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(250),
        'lenders',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('lender_outreach_messages')
          .select('id,lender_id,channel,status,sent_at,approved_at,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(500),
        'lender_outreach_messages',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('buyers')
          .select(
            'id,name,category,buyer_type,relationship_stage,outreach_status,next_follow_up_at,last_contacted_at,created_at,updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(250),
        'buyers',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase
          .from('buyer_outreach_messages')
          .select('id,buyer_id,channel,status,sent_at,approved_at,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(500),
        'buyer_outreach_messages',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase.from('sam_watchlists').select('id,label,status,watch_type,created_at').limit(50),
        'sam_watchlists',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase.from('sam_opportunities').select('id,title,status,response_deadline,agency_name,naics_code,created_at').limit(50),
        'sam_opportunities',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase.from('sam_exclusion_checks').select('id,subject_label,active_exclusion,match_status,checked_at').limit(50),
        'sam_exclusion_checks',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase.from('sam_alert_runs').select('id,run_type,status,started_at,completed_at').limit(50),
        'sam_alert_runs',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase.from('sam_award_intelligence').select('id,awardee_name,award_date,agency_name,naics_code').limit(50),
        'sam_award_intelligence',
        dataSourceIssues
      ),
      safeRows<any>(
        supabase.from('sam_assistance_listings').select('id,title,published_date,agency_name,status').limit(50),
        'sam_assistance_listings',
        dataSourceIssues
      ),
    ]);

  if (!process.env.SAM_GOV_API_KEY) {
    dataSourceIssues.push({
      source: 'sam_opportunities',
      message: 'Add SAM_GOV_API_KEY to enable government contracting ingestion and intelligence routes.',
    });
  } else if (!['1', 'true', 'yes', 'on'].includes((process.env.LEADS_ENABLE_SAM || '').toLowerCase())) {
    dataSourceIssues.push({
      source: 'sam_watchlists',
      message: 'Set LEADS_ENABLE_SAM=true to activate SAM.gov automation routes.',
    });
  }

  const reportCountByUser = new Map<string, number>();
  reports.forEach((report) =>
    reportCountByUser.set(report.user_id, (reportCountByUser.get(report.user_id) || 0) + 1)
  );

  const analysisCountByUser = new Map<string, number>();
  jobs.forEach((job) =>
    analysisCountByUser.set(job.user_id, (analysisCountByUser.get(job.user_id) || 0) + 1)
  );

  const usersById = new Map<string, any>();
  users.forEach((user) => {
    usersById.set(user.user_id || user.id, user);
  });

  const creditReports = reports.map((report) => {
    const profile = usersById.get(report.user_id);
    return {
      id: report.id,
      userId: report.user_id,
      userEmail: report.user_email || profile?.email || null,
      userName: profile?.full_name || null,
      fileName: report.file_name || report.original_file_name || 'Credit report',
      filePath: report.file_path || report.file_url || null,
      uploadedAt: report.uploaded_at || report.created_at,
      updatedAt: report.updated_at,
      completedAt: report.completed_at,
      status:
        report.status ||
        (report.ai_analysis || report.analysis_json ? 'completed' : 'uploaded'),
      disputeLettersGenerated:
        Boolean(report.dispute_letters_json) ||
        letters.some((letter) => letter.user_id === report.user_id),
      emailAlertSent:
        Boolean(report.email_alert_sent) ||
        emailEvents.some(
          (event) =>
            event.user_id === report.user_id &&
            String(event.event_type).includes('credit_report')
        ),
      errorMessage: report.error_message,
      adminNotes: report.admin_notes,
      analysisUrl: `/admin-panel/reports/${report.id}`,
    };
  });

  const userManagement = users.map((user) => {
    const userId = user.user_id || user.id;
    return {
      id: userId,
      profileId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role || 'user',
      createdAt: user.created_at,
      subscriptionStatus: user.is_subscribed ? 'paid' : 'free',
      uploads: reportCountByUser.get(userId) || 0,
      analyses: analysisCountByUser.get(userId) || 0,
      lastActivity:
        [
          user.updated_at,
          ...reports.filter((report) => report.user_id === userId).map(getDate),
          ...jobs.filter((job) => job.user_id === userId).map(getDate),
        ]
          .filter(Boolean)
          .sort()
          .at(-1) || user.created_at,
    };
  });

  const completedAnalyses =
    jobs.filter((job) => ['completed', 'COMPLETED'].includes(String(job.status))).length +
    creditReports.filter((report) => report.status === 'completed').length;
  const pendingAnalyses =
    jobs.filter((job) =>
      [
        'pending_ai_analysis',
        'pending_review',
        'uploaded',
        'extracting_text',
        'analyzing',
        'PENDING',
        'PROCESSING',
      ].includes(String(job.status))
    ).length +
    creditReports.filter((report) =>
      ['uploaded', 'extracting_text', 'text_extracted', 'analyzing', 'needs_review'].includes(
        String(report.status)
      )
    ).length;

  const recentActivity = [
    ...creditReports.slice(0, 20).map((report) => ({
      id: `report-${report.id}`,
      type: 'credit_report_uploaded',
      label: `Credit report uploaded${report.userEmail ? ` by ${report.userEmail}` : ''}`,
      createdAt: report.uploadedAt,
      href: report.analysisUrl,
    })),
    ...jobs.slice(0, 20).map((job) => ({
      id: `job-${job.id}`,
      type: 'analysis_job',
      label: `Analysis job ${job.status}`,
      createdAt: job.updated_at || job.created_at,
      href: `/analysis/results/${job.id}`,
    })),
    ...emailEvents.slice(0, 20).map((event) => ({
      id: `email-${event.id}`,
      type: event.status === 'failed' ? 'email_failed' : 'email_sent',
      label: `${event.subject} (${event.status})`,
      createdAt: event.created_at,
    })),
    ...payments.slice(0, 20).map((payment) => ({
      id: `payment-${payment.id}`,
      type: 'payment',
      label: `Payment ${payment.status} ${payment.amount ? `$${payment.amount}` : ''}`,
      createdAt: payment.created_at,
    })),
    ...fundingStrategyRequests.slice(0, 20).map((request) => ({
      id: `funding-strategy-${request.id}`,
      type: 'funding_strategy_request',
      label: `Funding strategy ${request.status}: ${
        request.business_name || request.user_email || request.id
      }`,
      createdAt: request.updated_at || request.created_at,
      href: '/admin-panel?tab=funding-strategy',
    })),
    ...adminActivity.slice(0, 20).map((activity) => ({
      id: `activity-${activity.id}`,
      type: activity.action_type,
      label: `${activity.action_type} ${activity.entity_type || ''}`.trim(),
      createdAt: activity.created_at,
      href:
        activity.entity_type === 'credit_report' && activity.entity_id
          ? `/admin-panel/reports/${activity.entity_id}`
          : activity.entity_type === 'user' && activity.entity_id
            ? `/admin-panel/users/${activity.entity_id}`
            : undefined,
    })),
    ...tasks.slice(0, 20).map((task) => ({
      id: `task-${task.id}`,
      type: `admin_task_${task.status}`,
      label: `Task: ${task.title}`,
      createdAt: task.updated_at || task.created_at,
      href:
        task.entity_type === 'credit_report' && task.entity_id
          ? `/admin-panel/reports/${task.entity_id}`
          : task.entity_type === 'lead'
            ? '/admin/leads'
          : task.user_id
            ? `/admin-panel/users/${task.user_id}`
            : undefined,
    })),
    ...contentAssets.slice(0, 20).map((asset) => ({
      id: `content-${asset.id}`,
      type:
        asset.status === 'published'
          ? 'content_published'
          : 'content_generated',
      label: `${asset.content_type} ${asset.status}: ${asset.title}`,
      createdAt: asset.updated_at || asset.created_at,
      href:
        asset.content_type === 'seo_page' && asset.status === 'published'
          ? asset.publish_path
          : undefined,
    })),
    ...fundingRecommendations.slice(0, 20).map((recommendation) => ({
      id: `funding-assistant-${recommendation.id}`,
      type: 'funding_assistant_recommendation',
      label: `Funding assistant ${recommendation.recommended_path}: ${
        usersById.get(recommendation.user_id)?.email || recommendation.user_id || recommendation.id
      }`,
      createdAt: recommendation.updated_at || recommendation.created_at,
      href: '/admin/funding',
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 30);

  const automationActivity = adminActivity
    .filter((activity) => automationEventTypes.has(String(activity.action_type)))
    .map((activity) => ({
      id: activity.id,
      type: activity.action_type,
      entityType: activity.entity_type,
      entityId: activity.entity_id,
      metadata: activity.metadata_json,
      createdAt: activity.created_at,
      href:
        activity.entity_type === 'credit_report' && activity.entity_id
          ? `/admin-panel/reports/${activity.entity_id}`
          : activity.entity_type === 'user' && activity.entity_id
            ? `/admin-panel/users/${activity.entity_id}`
            : undefined,
    }))
    .slice(0, 40);

  const lifecycleEmailEvents = emailEvents.filter((event) =>
    lifecycleEmailTypes.has(String(event.event_type))
  );
  const fundingAssistantApprovedItems = fundingSequenceItems.filter(
    (item) => item.status === 'approved'
  );
  const fundingAssistantAmountApproved = fundingAssistantApprovedItems.reduce(
    (sum, item) => sum + Number(item.approved_limit || 0),
    0
  );
  const contentByStatus = {
    draft: contentAssets.filter((asset) => asset.status === 'draft').length,
    ready: contentAssets.filter((asset) => asset.status === 'ready').length,
    published: contentAssets.filter((asset) => asset.status === 'published').length,
    archived: contentAssets.filter((asset) => asset.status === 'archived').length,
  };
  const paypalClientConfigured = Boolean(process.env.PAYPAL_CLIENT_ID);
  const paypalSecretConfigured = Boolean(process.env.PAYPAL_CLIENT_SECRET);
  const paypalWebhookConfigured = Boolean(process.env.PAYPAL_WEBHOOK_ID);
  const paypalEnvironment = getPaypalEnvironment();
  const paypalReady =
    paypalClientConfigured && paypalSecretConfigured && paypalWebhookConfigured;
  const dataSourceHealth = dashboardDataSources.map((source) => {
    const issue = dataSourceIssues.find((item) => item.source === source);
    return {
      source,
      status: issue ? 'unavailable' : 'available',
      message: issue?.message || null,
    };
  });
  const publishedSeoAssets = contentAssets.filter(
    (asset) => asset.content_type === 'seo_page' && asset.status === 'published'
  );
  const aeoServiceCoverage = vestBlockServiceDirectory.map((service) => {
    const contentServiceKey = serviceContentKeys[service.key] || service.key;
    const serviceAssets = contentAssets.filter(
      (asset) => asset.service_key === contentServiceKey
    );
    const publishedSeoPages = serviceAssets.filter(
      (asset) => asset.content_type === 'seo_page' && asset.status === 'published'
    ).length;
    const draftAssets = serviceAssets.filter((asset) =>
      ['draft', 'ready'].includes(String(asset.status))
    ).length;
    const socialPosts = serviceAssets.filter(
      (asset) => asset.content_type === 'social_post'
    ).length;
    const staticSeoPage = getServiceSeoPageByServiceKey(service.key);
    const hasMarketingBrief = vestblockMarketingServices.some(
      (marketingService) => marketingService.key === contentServiceKey
    );

    return {
      serviceKey: service.key,
      contentServiceKey,
      title: service.title,
      route: service.route.split('#')[0],
      intent: service.intent,
      priority: service.priority,
      stage: service.serviceStage,
      hasMarketingBrief,
      staticSeoRoute: staticSeoPage ? `/services/${staticSeoPage.slug}` : null,
      publishedSeoPages: publishedSeoPages + (staticSeoPage ? 1 : 0),
      draftAssets,
      socialPosts,
      recommendedNextContent:
        publishedSeoPages > 0 || staticSeoPage
          ? 'Create supporting comparison, FAQ, or social content.'
          : 'Generate and publish one high-quality service SEO page.',
    };
  });
  const topicClusters = vestblockAeoTopics.reduce<Record<string, number>>(
    (clusters, topic) => {
      clusters[topic.cluster] = (clusters[topic.cluster] || 0) + 1;
      return clusters;
    },
    {}
  );
  const openTaskStatuses = new Set(['open', 'in_progress', 'waiting']);
  const staleReports = creditReports
    .filter(
      (report) =>
        ['uploaded', 'extracting_text', 'text_extracted', 'analyzing', 'needs_review'].includes(
          String(report.status)
        ) && hoursSince(report.updatedAt || report.uploadedAt) >= 24
    )
    .slice(0, 8)
    .map((report) => ({
      id: report.id,
      label: report.fileName,
      detail: `${report.userEmail || 'Unknown user'} · ${report.status}`,
      ageHours: Math.round(hoursSince(report.updatedAt || report.uploadedAt)),
      href: report.analysisUrl,
    }));
  const failedReports = creditReports
    .filter((report) => String(report.status) === 'failed')
    .slice(0, 8)
    .map((report) => ({
      id: report.id,
      label: report.fileName,
      detail: report.errorMessage || report.userEmail || 'Failed analysis',
      href: report.analysisUrl,
    }));
  const urgentTasks = tasks
    .filter(
      (task) =>
        openTaskStatuses.has(String(task.status)) &&
        ['urgent', 'high'].includes(String(task.priority))
    )
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      label: task.title,
      detail: `${task.priority} · ${task.status}${task.user_email ? ` · ${task.user_email}` : ''}`,
      href:
        task.entity_type === 'credit_report' && task.entity_id
          ? `/admin-panel/reports/${task.entity_id}`
          : task.entity_type === 'lead'
            ? '/admin/leads'
            : task.user_id
              ? `/admin-panel/users/${task.user_id}`
              : '/admin-panel?tab=tasks',
    }));
  const readyContent = contentAssets
    .filter((asset) => asset.status === 'ready')
    .slice(0, 8)
    .map((asset) => ({
      id: asset.id,
      label: asset.title,
      detail: `${asset.content_type} · ${asset.language?.toUpperCase() || 'EN'}`,
      href: '/admin-panel?tab=content',
    }));
  const leadFollowups = leads
    .filter(
      (lead) =>
        ['new', 'open', 'pending', 'contacted'].includes(
          String(lead.status || '').toLowerCase()
        ) && hoursSince(lead.updated_at || lead.created_at) >= 24
    )
    .slice(0, 8)
    .map((lead) => ({
      id: lead.id,
      label: lead.name || lead.email || 'Lead follow-up',
      detail: `${lead.lead_type || 'lead'} · ${lead.status || 'new'}`,
      ageHours: Math.round(hoursSince(lead.updated_at || lead.created_at)),
      href: `/admin/leads?search=${encodeURIComponent(lead.email || lead.name || '')}`,
    }));
  const fundingNeedsReview = fundingStrategyRequests
    .filter((request) =>
      ['submitted', 'paid', 'in_review', 'under_review', 'documents_needed'].includes(
        String(request.status || '').toLowerCase()
      )
    )
    .slice(0, 8)
    .map((request) => ({
      id: request.id,
      label: request.business_name || request.full_name || request.user_email || request.id,
      detail: `${request.status || 'submitted'} · ${request.readiness_tier || 'unscored'}`,
      href: `/admin/funding?search=${encodeURIComponent(
        request.user_email || request.business_name || request.full_name || ''
      )}`,
    }));
  const overdueTasks = tasks.filter(
    (task) =>
      openTaskStatuses.has(String(task.status)) &&
      task.due_at &&
      new Date(task.due_at).getTime() < Date.now()
  );
  const onboardingWatchlist = userManagement
    .filter((user) => user.uploads === 0)
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 8)
    .map((user) => ({
      id: user.id,
      label: user.fullName || user.email || 'New user',
      detail: `${user.subscriptionStatus} · signed up ${formatRelativeAdminTime(
        user.createdAt
      )}`,
      href: `/admin-panel/users/${user.id}`,
    }));
  const disputeMethodMix = Array.from(
    letters.reduce((map, letter) => {
      const key = String(letter.letter_type || 'General dispute').trim() || 'General dispute';
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map<string, number>()) as Map<string, number>
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([letterType, count]) => ({ letterType, count }));
  const taskLaneMap = tasks.reduce((map, task) => {
    const key = String(task.task_type || 'general').trim() || 'general';
    const current = map.get(key) || { taskType: key, total: 0, open: 0, urgent: 0 };
    current.total += 1;
    if (openTaskStatuses.has(String(task.status))) current.open += 1;
    if (['urgent', 'high'].includes(String(task.priority))) current.urgent += 1;
    map.set(key, current);
    return map;
  }, new Map<string, { taskType: string; total: number; open: number; urgent: number }>());
  const taskLanes = Array.from(
    taskLaneMap.values() as Iterable<{
      taskType: string;
      total: number;
      open: number;
      urgent: number;
    }>
  )
    .sort((a, b) => b.open - a.open || b.urgent - a.urgent || b.total - a.total)
    .slice(0, 8);
  const completedPayments = payments.filter((payment) =>
    ['completed', 'paid', 'succeeded'].includes(String(payment.status).toLowerCase())
  );
  const weeklyVelocity = {
    newUsers7d: userManagement.filter((user) => isWithinDays(user.createdAt, 7)).length,
    uploads7d: creditReports.filter((report) => isWithinDays(report.uploadedAt, 7)).length,
    analyses7d: [
      ...jobs.filter((job) =>
        ['completed', 'COMPLETED'].includes(String(job.status)) &&
        isWithinDays(job.updated_at || job.created_at, 7)
      ),
      ...creditReports.filter(
        (report) => report.status === 'completed' && isWithinDays(report.completedAt, 7)
      ),
    ].length,
    publishedSeo7d: contentAssets.filter(
      (asset) =>
        asset.content_type === 'seo_page' &&
        asset.status === 'published' &&
        isWithinDays(asset.published_at || asset.updated_at || asset.created_at, 7)
    ).length,
    paidCustomers7d: completedPayments.filter((payment) =>
      isWithinDays(payment.created_at || payment.updated_at, 7)
    ).length,
  };
  const failedEmailEvents = emailEvents.filter((event) => event.status === 'failed');
  const dataSourceOutages = dataSourceHealth.filter((source) => source.status === 'unavailable');

  const revenueSnapshot = {
    completedPaymentVolume: completedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    ),
    paidFundingRequests: fundingStrategyRequests.filter(
      (request) => request.payment_status === 'paid'
    ).length,
    approvedFundingAmount: fundingAssistantAmountApproved,
    openHighPriorityTasks: urgentTasks.length,
    overdueTasks: overdueTasks.length,
    noUploadUsers: userManagement.filter((user) => user.uploads === 0).length,
  };

  const paidFundingPayments = fundingPayments.filter((payment) =>
    ['paid', 'completed'].includes(String(payment.status || '').toLowerCase())
  );
  const trailing30CompletedPayments = completedPayments.filter((payment) =>
    isWithinDays(payment.created_at || payment.updated_at, 30)
  );
  const trailing30FundingPayments = paidFundingPayments.filter((payment) =>
    isWithinDays(payment.created_at || payment.updated_at, 30)
  );
  const trailing30Revenue =
    trailing30CompletedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) +
    trailing30FundingPayments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
  const monthlyRevenueTarget = 100000;
  const newLeads24h = leads.filter((lead) => isWithinHours(lead.created_at, 24)).length;
  const leadEmailSends24h = outreachSendEvents.filter(
    (event) =>
      String(event.status || '').toLowerCase() === 'sent' &&
      String(event.channel || '').toLowerCase() === 'email' &&
      isWithinHours(event.created_at, 24)
  ).length;
  const lenderOutreach24h = lenderOutreachMessages.filter(
    (message) =>
      String(message.status || '').toLowerCase() === 'sent' &&
      isWithinHours(message.sent_at || message.updated_at, 24)
  ).length;
  const buyerOutreach24h = buyerOutreachMessages.filter(
    (message) =>
      String(message.status || '').toLowerCase() === 'sent' &&
      isWithinHours(message.sent_at || message.updated_at, 24)
  ).length;
  const totalOutreach24h = leadEmailSends24h + lenderOutreach24h + buyerOutreach24h;
  const replySignals7d =
    leads.filter(
      (lead) =>
        ['replied', 'interested', 'qualified', 'closed_won'].includes(
          String(lead.status || '').toLowerCase()
        ) && isWithinDays(lead.updated_at || lead.created_at, 7)
    ).length +
    lenders.filter(
      (lender) =>
        ['responded', 'active_partner'].includes(
          String(lender.relationship_stage || '').toLowerCase()
        ) && isWithinDays(lender.last_contacted_at || lender.updated_at || lender.created_at, 7)
    ).length +
    buyers.filter(
      (buyer) =>
        ['responded', 'active_buyer'].includes(
          String(buyer.relationship_stage || '').toLowerCase()
        ) && isWithinDays(buyer.last_contacted_at || buyer.updated_at || buyer.created_at, 7)
    ).length;
  const bookedOrWon7d =
    leads.filter(
      (lead) =>
        (String(lead.status || '').toLowerCase() === 'closed_won' ||
          String(lead.delivery_status || '').toLowerCase() === 'booked') &&
        isWithinDays(lead.updated_at || lead.created_at, 7)
    ).length +
    fundingStrategyRequests.filter(
      (request) =>
        ['strategy_ready', 'closed'].includes(String(request.status || '').toLowerCase()) &&
        isWithinDays(request.updated_at || request.created_at, 7)
    ).length;
  const approvedPartnerMessagesReady =
    lenderOutreachMessages.filter(
      (message) => String(message.status || '').toLowerCase() === 'approved'
    ).length +
    buyerOutreachMessages.filter(
      (message) => String(message.status || '').toLowerCase() === 'approved'
    ).length;
  const activeLenderConversations = lenders.filter((lender) =>
    ['contacted', 'responded', 'reviewing', 'active_partner'].includes(
      String(lender.relationship_stage || '').toLowerCase()
    )
  ).length;
  const activeBuyerConversations = buyers.filter((buyer) =>
    ['contacted', 'responded', 'reviewing', 'active_buyer'].includes(
      String(buyer.relationship_stage || '').toLowerCase()
    )
  ).length;
  const overduePartnerFollowups =
    lenders.filter(
      (lender) =>
        lender.next_follow_up_at &&
        new Date(lender.next_follow_up_at).getTime() < Date.now() &&
        !['dormant', 'paused', 'not_a_fit'].includes(
          String(lender.relationship_stage || '').toLowerCase()
        )
    ).length +
    buyers.filter(
      (buyer) =>
        buyer.next_follow_up_at &&
        new Date(buyer.next_follow_up_at).getTime() < Date.now() &&
        !['dormant', 'paused', 'not_a_fit'].includes(
          String(buyer.relationship_stage || '').toLowerCase()
        )
    ).length;
  const hotFundingRequests = fundingStrategyRequests.filter(
    (request) =>
      ['submitted', 'paid', 'in_review', 'strategy_ready'].includes(
        String(request.status || '').toLowerCase()
      ) && Number(request.readiness_score || 0) >= 70
  ).length;
  const hardScoreboardTargets = {
    monthlyRevenue: monthlyRevenueTarget,
    newLeads24h: 10,
    totalOutreach24h: envInt('LEADS_TARGET_EMAILS_PER_DAY', 100),
    partnerOutreach24h: 6,
    replySignals7d: 7,
    bookedOrWon7d: 3,
  };
  const immediateRevenueAngle =
    hotFundingRequests > 0
      ? 'Push funding-readiness and paid strategy conversions first. High-readiness funding requests are the fastest path to near-term cash.'
      : approvedPartnerMessagesReady >= 5
        ? 'Send approved lender and buyer outreach now. Partner conversations are queued and waiting, so speed-to-send is the fastest unlock.'
        : newLeads24h < hardScoreboardTargets.newLeads24h
          ? 'Lead flow is too soft. Lean harder into demand generation, higher-intent SEO output, and direct outreach that produces immediate conversations.'
          : totalOutreach24h < hardScoreboardTargets.totalOutreach24h
            ? 'Cadence is too low. Increase same-day contact volume across leads, lenders, and buyers before adding more complexity.'
            : 'Follow-up and conversion are the lever. The machine is creating movement, so tighten objections, routing, and close paths.';
  const hardScoreboard = {
    monthlyRevenueTarget,
    trailing30Revenue,
    revenueGap: Math.max(0, monthlyRevenueTarget - trailing30Revenue),
    immediateRevenueAngle,
    dailyCadence: {
      newLeads24h: {
        actual: newLeads24h,
        target: hardScoreboardTargets.newLeads24h,
        status: newLeads24h >= hardScoreboardTargets.newLeads24h ? 'on_track' : 'behind',
      },
      totalOutreach24h: {
        actual: totalOutreach24h,
        target: hardScoreboardTargets.totalOutreach24h,
        status:
          totalOutreach24h >= hardScoreboardTargets.totalOutreach24h ? 'on_track' : 'behind',
      },
      partnerOutreach24h: {
        actual: lenderOutreach24h + buyerOutreach24h,
        target: hardScoreboardTargets.partnerOutreach24h,
        status:
          lenderOutreach24h + buyerOutreach24h >= hardScoreboardTargets.partnerOutreach24h
            ? 'on_track'
            : 'behind',
      },
      replySignals7d: {
        actual: replySignals7d,
        target: hardScoreboardTargets.replySignals7d,
        status:
          replySignals7d >= hardScoreboardTargets.replySignals7d ? 'on_track' : 'behind',
      },
      bookedOrWon7d: {
        actual: bookedOrWon7d,
        target: hardScoreboardTargets.bookedOrWon7d,
        status:
          bookedOrWon7d >= hardScoreboardTargets.bookedOrWon7d ? 'on_track' : 'behind',
      },
    },
    pipeline: {
      leadEmailSends24h,
      lenderOutreach24h,
      buyerOutreach24h,
      activeLenderConversations,
      activeBuyerConversations,
      approvedPartnerMessagesReady,
      overduePartnerFollowups,
      hotFundingRequests,
    },
  };

  return NextResponse.json({
    overview: {
      totalUsers: users.length,
      totalCreditReportsUploaded: creditReports.length,
      totalAnalysesCompleted: completedAnalyses,
      totalPendingAnalyses: pendingAnalyses,
      totalDisputeLettersGenerated: letters.length,
      totalPaidUsers: users.filter((user) => Boolean(user.is_subscribed)).length,
      totalCompletedPayments: countBy(payments, 'status', 'completed'),
      totalFundingLeads: leads.length,
      totalFundingStrategyRequests: fundingStrategyRequests.length,
      totalPaidFundingStrategyRequests: fundingStrategyRequests.filter(
        (request) => request.payment_status === 'paid'
      ).length,
      totalFundingAssistantProfiles: fundingProfiles.length,
      totalFundingAssistantRecommendations: fundingRecommendations.length,
      totalFundingAssistantApprovals: fundingAssistantApprovedItems.length,
      totalFundingAssistantPaidPlans: fundingPayments.filter((payment) =>
        ['paid', 'completed'].includes(String(payment.status))
      ).length,
      totalFundingAssistantAmountApproved: fundingAssistantAmountApproved,
      totalOpenTasks: tasks.filter((task) =>
        ['open', 'in_progress', 'waiting'].includes(String(task.status))
      ).length,
      totalContentAssets: contentAssets.length,
      totalPublishedContent: contentByStatus.published,
      totalAeoTopics: vestblockAeoTopics.length,
    },
    creditReports,
    users: userManagement,
    alerts: {
      emailEvents,
      failedEmailEvents,
      newReportAlerts: emailEvents.filter(
        (event) => event.event_type === 'admin_credit_report_uploaded'
      ),
      systemErrors: [
        ...emailEvents.filter((event) => event.status === 'failed'),
        ...creditReports.filter((report) => report.status === 'failed'),
        ...dataSourceIssues.map((issue) => ({
          id: `source-${issue.source}`,
          subject: `${issue.source} unavailable`,
          status: 'failed',
          event_type: 'data_source_unavailable',
          error_message: issue.message,
        })),
      ].slice(0, 30),
    },
    payments,
    leads,
    fundingStrategyRequests,
    tasks,
    content: {
      assets: contentAssets,
      summary: {
        total: contentAssets.length,
        byStatus: contentByStatus,
        seoPages: contentAssets.filter((asset) => asset.content_type === 'seo_page').length,
        socialPosts: contentAssets.filter((asset) => asset.content_type === 'social_post').length,
        campaigns: contentAssets.filter((asset) => asset.content_type === 'campaign').length,
      },
      generator: {
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o',
      },
    },
    aeo: {
      serviceCount: vestBlockServiceDirectory.length,
      aeoTopicCount: vestblockAeoTopics.length,
      topicClusters,
      publishedSeoPages: publishedSeoAssets.length,
      spanishContentAssets: contentAssets.filter((asset) => asset.language === 'es')
        .length,
      llmSurfaces: [
        '/llms.txt',
        '/sitemap.xml',
        '/robots.txt',
        '/services',
        '/learn',
        '/es/vestblock',
      ],
      serviceCoverage: aeoServiceCoverage,
      contentGaps: aeoServiceCoverage.filter(
        (service) => service.publishedSeoPages === 0
      ),
    },
    automation: {
      env: {
        cronSecretConfigured: Boolean(process.env.CRON_SECRET),
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        adminAlertEmailConfigured: Boolean(
          process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL
        ),
        fromEmailConfigured: Boolean(process.env.FROM_EMAIL || process.env.RESEND_EMAIL),
        outreachMailingAddressConfigured: Boolean(
          process.env.OUTREACH_MAILING_ADDRESS ||
            process.env.BUSINESS_MAILING_ADDRESS ||
            process.env.COMPANY_MAILING_ADDRESS ||
            process.env.PUBLIC_BUSINESS_ADDRESS
        ),
        siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL || process.env.WEB_HOST_URL),
      },
      payments: {
        paypalEnvironment,
        paypalClientConfigured,
        paypalSecretConfigured,
        paypalWebhookConfigured,
        paypalReady,
        recommendedAction: paypalReady
          ? paypalEnvironment === 'live'
            ? 'Live PayPal mode is configured. Confirm the PayPal webhook URL points to this deployment before taking real payments.'
            : 'Sandbox PayPal mode is configured. Use sandbox buyer accounts for checkout testing.'
          : 'Add PayPal client ID, client secret, and webhook ID in Vercel before relying on payment automation.',
      },
      dataSources: dataSourceHealth,
      crons: [
        {
          label: 'Credit repair stalled report monitor',
          path: '/api/cron/credit-repair-monitor',
          schedule: '0 14 * * *',
          purpose: 'Creates admin tasks for reports stuck in processing statuses.',
        },
        {
          label: 'Lifecycle reminder monitor',
          path: '/api/cron/lifecycle-monitor',
          schedule: '0 15 * * *',
          purpose:
            'Creates lifecycle tasks and sends upload reminders, paid onboarding reminders, and lead follow-up alerts.',
        },
        {
          label: 'Dispute letter reminder monitor',
          path: '/api/cron/dispute-letter-monitor',
          schedule: '0 16 * * *',
          purpose:
            'Sends dispute-letter mailing reminders, secondary bureau reminders, and bureau response-window follow-ups.',
        },
        {
          label: 'Daily content publisher',
          path: '/api/cron/content-publisher',
          schedule: '30 17 * * *',
          purpose:
            'Publishes a small daily batch of SEO pages, prioritizing existing drafts and then filling service gaps with AEO topic pages.',
        },
        {
          label: 'Growth scoreboard monitor',
          path: '/api/cron/growth-scoreboard-monitor',
          schedule: '0 */6 * * *',
          purpose:
            'Checks the hard scoreboard, identifies missed daily quotas, and creates red-flag admin tasks when growth or revenue cadence falls behind.',
        },
        {
          label: 'PR target discovery',
          path: '/api/cron/pr-engine-discovery',
          schedule: '15 18 * * *',
          purpose:
            'Seeds new PR targets across priority cities and business-owner categories such as minority, chamber, and small-business outlets.',
        },
        {
          label: 'PR city expansion',
          path: '/api/cron/pr-engine-city-expansion',
          schedule: '30 18 * * *',
          purpose:
            'Pushes the visibility engine into additional cities using market momentum and local category fit.',
        },
        {
          label: 'PR pitch generation',
          path: '/api/cron/pr-engine-pitch-generation',
          schedule: '45 18 * * *',
          purpose:
            'Generates fresh PR drafts automatically for the highest-fit queued targets.',
        },
        {
          label: 'PR follow-up monitor',
          path: '/api/cron/pr-engine-monitor',
          schedule: '0 18 * * *',
          purpose:
            'Enforces PR follow-up deadlines and creates admin tasks when strong opportunities are stalling.',
        },
        {
          label: 'PR weekly learning',
          path: '/api/cron/pr-engine-weekly-learning',
          schedule: '0 19 * * 0',
          purpose:
            'Summarizes which cities, categories, and pitch angles are actually getting traction so the queue can self-improve.',
        },
        {
          label: 'SAM opportunity ingest',
          path: '/api/cron/sam-opportunity-ingest',
          schedule: '10 11 * * *',
          purpose:
            'Pulls public contract opportunities from official SAM/GSA APIs and stores normalized opportunity plus document records.',
        },
        {
          label: 'SAM match scoring',
          path: '/api/cron/sam-match-scoring',
          schedule: '25 11 * * *',
          purpose:
            'Scores active SAM opportunities against watchlists and lead fit, creates admin tasks, and links high-fit opportunities into lead workflows.',
        },
        {
          label: 'SAM exclusion rechecks',
          path: '/api/cron/sam-exclusion-rechecks',
          schedule: '35 11 * * *',
          purpose:
            'Re-screens tracked entities and watchlists against public SAM exclusions to surface compliance risk quickly.',
        },
        {
          label: 'SAM award monitor',
          path: '/api/cron/sam-award-monitor',
          schedule: '50 11 * * *',
          purpose:
            'Captures award notices for tracked niches and competitors so operators can watch who is winning and where.',
        },
        {
          label: 'SAM assistance refresh',
          path: '/api/cron/sam-assistance-refresh',
          schedule: '55 11 * * *',
          purpose:
            'Refreshes federal assistance listing matches related to active government watchlists.',
        },
        {
          label: 'SAM alert delivery',
          path: '/api/cron/sam-alert-delivery',
          schedule: '10 18 * * *',
          purpose:
            'Sends the government intelligence digest with hot opportunities, exclusion hits, awards, and assistance matches.',
        },
      ],
      lifecycleEmails: {
        total: lifecycleEmailEvents.length,
        sent: lifecycleEmailEvents.filter((event) => event.status === 'sent').length,
        skipped: lifecycleEmailEvents.filter((event) => event.status === 'skipped').length,
        failed: lifecycleEmailEvents.filter((event) => event.status === 'failed').length,
      },
      recentAutomationActivity: automationActivity,
    },
    actionCenter: {
      counts: {
        staleReports: staleReports.length,
        failedReports: failedReports.length,
        urgentTasks: urgentTasks.length,
        failedEmails: failedEmailEvents.length,
        readyContent: readyContent.length,
        leadFollowups: leadFollowups.length,
        fundingNeedsReview: fundingNeedsReview.length,
        dataSourceOutages: dataSourceOutages.length,
      },
      staleReports,
      failedReports,
      urgentTasks,
      readyContent,
      leadFollowups,
      fundingNeedsReview,
      dataSourceOutages,
    },
    insights: {
      hardScoreboard,
      revenueSnapshot,
      onboardingWatchlist,
      disputeMethodMix,
      taskLanes,
      weeklyVelocity,
    },
    recentActivity,
  });
}

function formatRelativeAdminTime(value?: string | null) {
  if (!value) return 'recently';
  const hours = hoursSince(value);
  if (!Number.isFinite(hours)) return 'recently';
  if (hours < 1) return 'less than 1h ago';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}
