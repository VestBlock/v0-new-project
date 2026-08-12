import { z } from 'zod';

export const chatMessageSchema = z.object({
  id: z.string().max(160).optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().trim().min(1).max(6000),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const chatRequestSchema = z.object({
  id: z.string().uuid().optional(),
  messages: z.array(chatMessageSchema).min(1).max(24),
  context: z.string().trim().max(4000).optional(),
  creditScore: z.number().min(300).max(850).nullable().optional(),
  financialGoal: z
    .object({
      title: z.string().trim().min(1).max(240),
      customDetails: z.string().trim().max(1200).optional(),
    })
    .nullable()
    .optional(),
  assistantType: z.string().trim().max(80).optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
