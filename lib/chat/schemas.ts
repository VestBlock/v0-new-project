import { z } from 'zod';

export const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const chatRequestSchema = z.object({
  id: z.string().uuid().optional(),
  messages: z.array(chatMessageSchema).min(1),
  context: z.string().optional(),
  creditScore: z.number().nullable().optional(),
  financialGoal: z
    .object({
      title: z.string(),
      customDetails: z.string().optional(),
    })
    .nullable()
    .optional(),
  assistantType: z.string().optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
