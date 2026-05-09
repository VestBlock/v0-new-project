import { inngest } from '@/lib/inngest/client';
import {
  processGrowthServiceRequest,
  type GrowthServiceRequestWorkflowInput,
} from '@/lib/inngest/serviceRequestWorkflow';

export const processGrowthServiceRequestFunction = inngest.createFunction(
  {
    id: 'process-growth-service-request',
    triggers: { event: 'vestblock/growth-service.requested' },
  },
  async ({ event, step }) => {
    const payload = event.data as GrowthServiceRequestWorkflowInput;

    return step.run('process-growth-service-request', async () =>
      processGrowthServiceRequest(payload)
    );
  }
);
