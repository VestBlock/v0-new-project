import { logEvent } from '@/lib/system/logEvent';

type AiAgentStepStatus = 'started' | 'completed' | 'failed' | 'queued';

type LogAiAgentStepInput = {
  agentKey: string;
  step: string;
  status: AiAgentStepStatus;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAiAgentStep(input: LogAiAgentStepInput) {
  return logEvent({
    eventType: 'admin_action',
    entityType: input.entityType ?? 'ai_agent',
    entityId: input.entityId ?? null,
    metadata: {
      action: 'ai_agent_step',
      agentKey: input.agentKey,
      step: input.step,
      status: input.status,
      ...(input.metadata || {}),
    },
  });
}
