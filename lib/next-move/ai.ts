import 'server-only'

import { createHash } from 'node:crypto'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { getOpenAIClient } from '@/lib/openai-server'
import type { NextMoveAnswers, NextMoveRoadmap } from '@/lib/next-move/types'

const refinementSchema = z.object({
  summary: z.string().min(80).max(650),
  priorityNotes: z.array(z.string().min(20).max(220)).min(3).max(4),
  cautions: z.array(z.string().min(20).max(220)).min(1).max(3),
})

export type NextMoveAiRefinement = z.infer<typeof refinementSchema>

export async function generateNextMoveAiRefinement(
  answers: NextMoveAnswers,
  roadmap: NextMoveRoadmap
): Promise<NextMoveAiRefinement | null> {
  const openai = getOpenAIClient()
  if (!openai) return null

  const safetyIdentifier = createHash('sha256').update(answers.email.trim().toLowerCase()).digest('hex').slice(0, 48)
  const response = await openai.responses.parse({
    model: process.env.NEXT_MOVE_OPENAI_MODEL || 'gpt-5.6-luna',
    reasoning: { effort: 'low' },
    max_output_tokens: 900,
    store: false,
    safety_identifier: safetyIdentifier,
    text: { format: zodTextFormat(refinementSchema, 'next_move_refinement') },
    input: [
      {
        role: 'system',
        content: [
          'You refine a VestBlock educational roadmap using only the supplied answers and verified resource plan.',
          'Do not add products, URLs, financial figures, promises, approvals, score gains, legal conclusions, tax advice, investment recommendations, or claims of eligibility.',
          'Keep the deterministic path and resources unchanged. Write concise, specific, professional financial-literacy language.',
          'Issuer, lender, grant, partner, market, and transaction decisions belong to those third parties.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          focus: answers.focus,
          timeline: answers.timeline,
          position: answers.position,
          creditRange: answers.creditRange,
          weeklyTime: answers.weeklyTime,
          mainObstacle: answers.mainObstacle,
          goalDetails: answers.goalDetails || '',
          verifiedRoadmap: roadmap,
        }),
      },
    ],
  }, { timeout: 12_000 })

  return response.output_parsed ? refinementSchema.parse(response.output_parsed) : null
}
