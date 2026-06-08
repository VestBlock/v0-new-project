import { inngest } from '@/lib/inngest/client';
import type {
  GrowthServiceRequestWorkflowInput,
  GrowthServiceRequestWorkflowResult,
} from '@/lib/inngest/serviceRequestWorkflow';
import { logEvent } from '@/lib/system/logEvent';

type QueueResult = GrowthServiceRequestWorkflowResult & {
  processingMode: 'inngest' | 'direct';
};

function shouldUseInngest() {
  return Boolean(
    process.env.INNGEST_EVENT_KEY ||
      process.env.INNGEST_DEV === '1'
  );
}

async function processGrowthServiceRequestDirect(
  input: GrowthServiceRequestWorkflowInput
): Promise<GrowthServiceRequestWorkflowResult> {
  const { processGrowthServiceRequest } = await import('@/lib/inngest/serviceRequestWorkflow');
  return processGrowthServiceRequest(input);
}

export async function queueGrowthServiceRequest(
  input: GrowthServiceRequestWorkflowInput
): Promise<QueueResult> {
  if (!shouldUseInngest()) {
    const result = await processGrowthServiceRequestDirect(input);
    return { ...result, processingMode: 'direct' };
  }

  try {
    await inngest.send({
      name: 'vestblock/growth-service.requested',
      data: input,
    });

    await logEvent({
      eventType: 'admin_action',
      entityType: 'growth_service_request',
      entityId: input.leadId,
      metadata: {
        action: 'growth_service_request_queued',
        sourcePath: input.sourcePath,
        packageKey: input.packageKey,
        leadType: input.leadType,
      },
    });

    return {
      automationTriggered: true,
      deliverableStatus: 'queued',
      processingMode: 'inngest',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await logEvent({
      eventType: 'admin_action',
      entityType: 'growth_service_request',
      entityId: input.leadId,
      metadata: {
        action: 'growth_service_request_queue_failed',
        sourcePath: input.sourcePath,
        packageKey: input.packageKey,
        leadType: input.leadType,
        error: message,
      },
    });

    const result = await processGrowthServiceRequestDirect(input);
    return { ...result, processingMode: 'direct' };
  }
}
