export type StrategyLeadMembershipShape = {
  strategy_key?: string | null
  created_at?: string | null
}

/**
 * PostgREST embeds a relationship as an object when the foreign key is unique
 * and as an array when it is one-to-many. Keep queue selection compatible with
 * both schema shapes so a relationship-cardinality change cannot stop dispatch.
 */
export function normalizeStrategyLeadMemberships(
  value:
    | StrategyLeadMembershipShape
    | StrategyLeadMembershipShape[]
    | null
    | undefined
): StrategyLeadMembershipShape[] {
  if (Array.isArray(value)) return [...value]
  return value && typeof value === 'object' ? [value] : []
}
