export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  DEAL_PIPELINE_STAGES,
  DealPipelineTransitionError,
  createSupabaseDealPipelineTransitionRepository,
  transitionDealPipelineItem,
} from '@/lib/deals/pipelineTransitions'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { logEvent } from '@/lib/system/logEvent'

const transitionSchema = z.object({
  stage: z.enum(DEAL_PIPELINE_STAGES),
  note: z.string().trim().min(1).max(2_000),
  nextAction: z.string().trim().max(500).nullable().optional(),
  nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response
  if (!user?.id) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const parsed = transitionSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid deal pipeline transition.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json(
      { error: 'Deal pipeline item id is required.' },
      { status: 400 }
    )
  }

  try {
    const result = await transitionDealPipelineItem(
      createSupabaseDealPipelineTransitionRepository(admin),
      {
        itemId: id,
        toStage: parsed.data.stage,
        note: parsed.data.note,
        actorUserId: user.id,
        nextAction: parsed.data.nextAction,
        nextActionAt: parsed.data.nextActionAt,
      }
    )

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user.id,
      entityType: 'deal_pipeline_item',
      entityId: result.item.id,
      metadata: {
        action: 'deal_pipeline_stage_changed',
        fromStage: result.transition.from_stage,
        toStage: result.transition.to_stage,
        note: result.transition.note,
      },
    })

    return NextResponse.json({
      success: true,
      deal: result.item,
      transition: result.transition,
    })
  } catch (error) {
    if (error instanceof DealPipelineTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not update the deal pipeline stage.',
      },
      { status: 500 }
    )
  }
}
