import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';
import {
  generateAndStoreServiceDeliverable,
  type ServiceDeliverableStatus,
} from '@/lib/services/aiServiceDeliverables';
import type { ServicePackageKey } from '@/lib/services/servicePackages';
import { logAiAgentStep } from '@/lib/ai/agentLogger';

export type GrowthServiceLeadType =
  | 'ai_assistant'
  | 'website_upgrade'
  | 'visibility_expansion'
  | 'business_funding';

export type GrowthServiceRequestWorkflowInput = {
  leadId: string;
  leadType: GrowthServiceLeadType;
  sourcePath: string;
  summary: string;
  packageKey: ServicePackageKey;
  leadName: string;
  leadEmail: string;
  phone: string;
  businessName?: string | null;
  primaryGoal?: string | null;
  monthlyRevenueRange?: string | null;
  creditScoreRange?: string | null;
  timeline?: string | null;
  notes?: string | null;
  automationMetadata: Record<string, unknown>;
  deliverableFormData: Record<string, unknown>;
};

export type GrowthServiceRequestWorkflowResult = {
  automationTriggered: boolean;
  deliverableStatus: ServiceDeliverableStatus | 'failed' | 'queued';
};

export async function processGrowthServiceRequest(
  input: GrowthServiceRequestWorkflowInput
): Promise<GrowthServiceRequestWorkflowResult> {
  await logAiAgentStep({
    agentKey: 'growth_service_request',
    step: 'process-request',
    status: 'started',
    entityType: 'lead',
    entityId: input.leadId,
    metadata: {
      leadType: input.leadType,
      packageKey: input.packageKey,
      sourcePath: input.sourcePath,
    },
  });

  const [automationResult, deliverableResult] = await Promise.allSettled([
    runNewLeadAutomation({
      leadId: input.leadId,
      leadType: input.leadType,
      name: input.leadName,
      email: input.leadEmail,
      phone: input.phone,
      sourcePath: input.sourcePath,
      summary: input.summary,
      metadata: input.automationMetadata,
    }),
    generateAndStoreServiceDeliverable({
      leadId: input.leadId,
      packageKey: input.packageKey,
      leadName: input.leadName,
      leadEmail: input.leadEmail,
      businessName: input.businessName || null,
      primaryGoal: input.primaryGoal || null,
      monthlyRevenueRange: input.monthlyRevenueRange || null,
      creditScoreRange: input.creditScoreRange || null,
      timeline: input.timeline || null,
      notes: input.notes || null,
      formData: input.deliverableFormData,
    }),
  ]);

  const result = {
    automationTriggered: automationResult.status === 'fulfilled',
    deliverableStatus:
      deliverableResult.status === 'fulfilled'
        ? deliverableResult.value.status
        : 'failed',
  };

  await logAiAgentStep({
    agentKey: 'growth_service_request',
    step: 'process-request',
    status:
      automationResult.status === 'fulfilled' &&
      deliverableResult.status === 'fulfilled'
        ? 'completed'
        : 'failed',
    entityType: 'lead',
    entityId: input.leadId,
    metadata: {
      leadType: input.leadType,
      packageKey: input.packageKey,
      sourcePath: input.sourcePath,
      automationTriggered: result.automationTriggered,
      deliverableStatus: result.deliverableStatus,
      automationError:
        automationResult.status === 'rejected'
          ? automationResult.reason instanceof Error
            ? automationResult.reason.message
            : String(automationResult.reason)
          : null,
      deliverableError:
        deliverableResult.status === 'rejected'
          ? deliverableResult.reason instanceof Error
            ? deliverableResult.reason.message
            : String(deliverableResult.reason)
          : null,
    },
  });

  return result;
}
