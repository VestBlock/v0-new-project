import 'server-only'

import { sendEmail } from '@/lib/email/sendEmail'
import type { NextMoveRoadmap } from '@/lib/next-move/types'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io'
  try { return new URL(value).origin } catch { return 'https://vestblock.io' }
}

export async function sendNextMoveRoadmapEmail(input: {
  firstName: string
  email: string
  roadmap: NextMoveRoadmap
  lifecycleToken: string
}) {
  const steps = input.roadmap.steps.map((step) => `
    <div style="padding:18px 0;border-top:1px solid #2b3228">
      <p style="margin:0 0 5px;color:#d7f80b;font-size:12px;font-weight:700;text-transform:uppercase">${escapeHtml(step.window)}</p>
      <h2 style="margin:0 0 8px;color:#f1f3ed;font-size:19px">${escapeHtml(step.title)}</h2>
      <ul style="margin:0;padding-left:20px">${step.actions.map((action) => `<li style="margin:6px 0">${escapeHtml(action)}</li>`).join('')}</ul>
    </div>
  `).join('')
  const resources = input.roadmap.resources.map((resource) => `
    <li style="margin:10px 0"><a href="${siteUrl()}${resource.href}" style="color:#d7f80b;font-weight:700">${escapeHtml(resource.title)}</a> — ${escapeHtml(resource.access)}. ${escapeHtml(resource.limitation)}</li>
  `).join('')
  const lifecycleUrl = `${siteUrl()}/next-move/manage?token=${encodeURIComponent(input.lifecycleToken)}`

  return sendEmail({
    to: input.email,
    userEmail: input.email,
    eventType: 'user_next_move_roadmap',
    providerPreference: 'resend',
    subject: `Your VestBlock ${input.roadmap.primaryPath} roadmap`,
    html: `
      <div style="margin:0;background:#070a08;color:#dce2d9;font-family:Arial,sans-serif">
        <div style="max-width:660px;margin:0 auto;padding:32px 24px">
          <p style="margin:0 0 18px;color:#d7f80b;font-weight:800">VestBlock</p>
          <h1 style="margin:0 0 12px;color:#f1f3ed;font-size:28px;line-height:1.12">${escapeHtml(input.roadmap.title)}</h1>
          <p style="font-size:16px;line-height:1.6">${escapeHtml(input.roadmap.summary)}</p>
          <p style="padding:12px 14px;border-left:3px solid #d7f80b;background:#111610"><strong>Primary path:</strong> ${escapeHtml(input.roadmap.primaryPath)} · <strong>Readiness:</strong> ${escapeHtml(input.roadmap.readiness)}</p>
          ${steps}
          <h2 style="margin:28px 0 8px;color:#f1f3ed;font-size:20px">Verified VestBlock routes</h2>
          <ul style="padding-left:20px">${resources}</ul>
          <p style="margin-top:28px;font-size:13px;line-height:1.55;color:#aab3a8">This roadmap is educational. VestBlock helps organize preparation, comparisons, and review requests; third parties control approvals, terms, awards, matches, rankings, and closings.</p>
          <p style="font-size:13px"><a href="${lifecycleUrl}" style="color:#d7f80b">Export or delete this questionnaire record</a></p>
        </div>
      </div>
    `,
  })
}
