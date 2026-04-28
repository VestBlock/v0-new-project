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
  'admin_activity',
  'leads',
  'admin_tasks',
  'content_assets',
  'funding_strategy_requests',
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
    adminActivity,
    leads,
    tasks,
    contentAssets,
    fundingStrategyRequests,
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
          .select('id,lead_type,status,name,email,phone,notes,created_at,updated_at')
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
    ]);

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
      href: '/admin-panel',
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
      failedEmailEvents: emailEvents.filter((event) => event.status === 'failed'),
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
      ],
      lifecycleEmails: {
        total: lifecycleEmailEvents.length,
        sent: lifecycleEmailEvents.filter((event) => event.status === 'sent').length,
        skipped: lifecycleEmailEvents.filter((event) => event.status === 'skipped').length,
        failed: lifecycleEmailEvents.filter((event) => event.status === 'failed').length,
      },
      recentAutomationActivity: automationActivity,
    },
    recentActivity,
  });
}
