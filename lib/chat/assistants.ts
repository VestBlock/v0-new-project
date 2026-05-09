export type ChatAssistantType =
  | 'vestbot'
  | 'funding_coach'
  | 'credit_coach'
  | 'growth_operator'
  | 'ai_receptionist'
  | 'user_hub';

export type ChatAssistantDefinition = {
  key: ChatAssistantType;
  label: string;
  summary: string;
  badge: string;
  systemPrompt: string;
};

export const chatAssistants: Record<ChatAssistantType, ChatAssistantDefinition> = {
  vestbot: {
    key: 'vestbot',
    label: 'VestBot',
    badge: 'General',
    summary: 'Broad VestBlock help across funding, credit, growth, and next steps.',
    systemPrompt:
      "You are VestBot, VestBlock's general AI assistant for credit, funding readiness, business growth, AI receptionist planning, and practical next-step guidance.",
  },
  funding_coach: {
    key: 'funding_coach',
    label: 'Funding Coach',
    badge: 'Funding',
    summary: 'Helps users prioritize funding readiness, lender fit, and application sequencing.',
    systemPrompt:
      'You are VestBlock Funding Coach. Focus on funding-readiness, financing order, lender fit, application prep, and realistic next steps without making guarantees.',
  },
  credit_coach: {
    key: 'credit_coach',
    label: 'Credit Coach',
    badge: 'Credit',
    summary: 'Focuses on credit cleanup, dispute sequencing, and score-building guidance.',
    systemPrompt:
      'You are VestBlock Credit Coach. Focus on credit-report cleanup, dispute sequencing, utilization, payment-history repair, and realistic score-building steps.',
  },
  growth_operator: {
    key: 'growth_operator',
    label: 'Growth Operator',
    badge: 'Growth',
    summary: 'Focuses on visibility, SEO/AEO, authority growth, and website improvement.',
    systemPrompt:
      'You are VestBlock Growth Operator. Focus on website upgrades, SEO/AEO visibility, authority signals, demand capture, and practical growth prioritization.',
  },
  ai_receptionist: {
    key: 'ai_receptionist',
    label: 'AI Receptionist',
    badge: 'Receptionist',
    summary: 'Focuses on lead capture, booking, missed-call handling, and bot setup.',
    systemPrompt:
      'You are VestBlock AI Receptionist Advisor. Focus on lead capture, appointment flow, phone coverage, callback handling, booking automation, and implementation priorities.',
  },
  user_hub: {
    key: 'user_hub',
    label: 'Roadmap Coach',
    badge: 'Roadmap',
    summary: 'Helps users act on saved roadmaps, profile context, and account tasks.',
    systemPrompt:
      'You are VestBlock Roadmap Coach. Focus on helping the user act on their saved roadmap, account tasks, uploaded documents, and concrete next moves inside VestBlock.',
  },
};

export const chatAssistantList = Object.values(chatAssistants);

export function getChatAssistant(
  assistantType?: string | null
): ChatAssistantDefinition {
  if (!assistantType) return chatAssistants.vestbot;
  return chatAssistants[assistantType as ChatAssistantType] || chatAssistants.vestbot;
}
