export const analyticsEvents = {
  authSignInSucceeded: 'auth_sign_in_succeeded',
  authSignOutCompleted: 'auth_sign_out_completed',
  authSignUpCompleted: 'auth_sign_up_completed',
  workspaceActivityLoaded: 'workspace_activity_loaded',
  roadmapGenerated: 'roadmap_generated',
  serviceDashboardLoaded: 'service_dashboard_loaded',
  adminLeadsLoaded: 'admin_leads_loaded',
  chatMessageSubmitted: 'chat_message_submitted',
  creditReportUploaded: 'credit_report_uploaded',
  fundingLeadSubmitted: 'funding_lead_submitted',
  growthServiceRequestSubmitted: 'growth_service_request_submitted',
  partnerReferralClicked: 'partner_referral_clicked',
  paymentCaptureCompleted: 'payment_capture_completed',
  paymentCaptureFailed: 'payment_capture_failed',
} as const;

export type AnalyticsEventName =
  (typeof analyticsEvents)[keyof typeof analyticsEvents];
