import type {
  FundingPayment,
  FundingProduct,
  FundingProfile,
  FundingProgressSummary,
  FundingRecommendation,
  FundingSequenceItem,
  FundingSequenceItemWithProduct,
} from '@/lib/funding/types';

type SupabaseLike = {
  from: (table: string) => any;
};

function normalizeArray<T>(rows: T[] | null | undefined) {
  return Array.isArray(rows) ? rows : [];
}

export async function getLatestFundingProfile(
  supabase: SupabaseLike,
  userId: string
): Promise<FundingProfile | null> {
  const { data } = await supabase
    .from('funding_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as FundingProfile | null) ?? null;
}

export async function getLatestFundingRecommendation(
  supabase: SupabaseLike,
  userId: string
): Promise<FundingRecommendation | null> {
  const { data } = await supabase
    .from('funding_recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    ...(data as FundingRecommendation),
    warnings: Array.isArray((data as FundingRecommendation).warnings)
      ? ((data as FundingRecommendation).warnings as string[])
      : [],
  };
}

export async function getFundingProducts(
  supabase: SupabaseLike
): Promise<FundingProduct[]> {
  const { data } = await supabase
    .from('funding_products')
    .select('*')
    .eq('active', true)
    .order('recommended_fico', { ascending: true, nullsFirst: true })
    .order('estimated_limit_max', { ascending: false, nullsFirst: false });

  return normalizeArray<FundingProduct>(data as FundingProduct[] | null);
}

export async function getFundingSequenceWithProducts(
  supabase: SupabaseLike,
  recommendationId: string
): Promise<FundingSequenceItemWithProduct[]> {
  const { data } = await supabase
    .from('funding_sequence_items')
    .select('*')
    .eq('recommendation_id', recommendationId)
    .order('sequence_order', { ascending: true });

  const items = normalizeArray<FundingSequenceItem>(data as FundingSequenceItem[] | null);
  const productIds = items
    .map((item) => item.product_id)
    .filter((value): value is string => Boolean(value));

  let productsById = new Map<string, FundingProduct>();

  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('funding_products')
      .select('*')
      .in('id', productIds);

    productsById = new Map(
      normalizeArray<FundingProduct>(products as FundingProduct[] | null).map((product) => [
        product.id,
        product,
      ])
    );
  }

  return items.map((item) => ({
    ...item,
    product: item.product_id ? productsById.get(item.product_id) || null : null,
  }));
}

export async function getLatestFundingPayment(
  supabase: SupabaseLike,
  userId: string,
  recommendationId?: string | null
): Promise<FundingPayment | null> {
  let query = supabase
    .from('funding_payments')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (recommendationId) {
    query = query.eq('recommendation_id', recommendationId);
  }

  const { data } = await query.maybeSingle();
  return (data as FundingPayment | null) ?? null;
}

export async function getFundingProgressSummary(
  supabase: SupabaseLike,
  userId: string,
  recommendationId?: string | null
): Promise<FundingProgressSummary> {
  let recommendation = recommendationId
    ? null
    : await getLatestFundingRecommendation(supabase, userId);

  if (!recommendationId && !recommendation) {
    return {
      totalSequenceCount: 0,
      openedCount: 0,
      appliedCount: 0,
      approvedCount: 0,
      deniedCount: 0,
      pendingCount: 0,
      skippedCount: 0,
      totalApprovedLimit: 0,
      nextRecommendedItem: null,
      paymentStatus: null,
    };
  }

  if (recommendationId && !recommendation) {
    const { data } = await supabase
      .from('funding_recommendations')
      .select('*')
      .eq('id', recommendationId)
      .eq('user_id', userId)
      .maybeSingle();
    recommendation = (data as FundingRecommendation | null) ?? null;
  }

  if (!recommendation?.id) {
    return {
      totalSequenceCount: 0,
      openedCount: 0,
      appliedCount: 0,
      approvedCount: 0,
      deniedCount: 0,
      pendingCount: 0,
      skippedCount: 0,
      totalApprovedLimit: 0,
      nextRecommendedItem: null,
      paymentStatus: null,
    };
  }

  const [sequenceItems, payment] = await Promise.all([
    getFundingSequenceWithProducts(supabase, recommendation.id),
    getLatestFundingPayment(supabase, userId, recommendation.id),
  ]);

  const approvedItems = sequenceItems.filter((item) => item.status === 'approved');
  const nextRecommendedItem =
    sequenceItems.find((item) =>
      ['not_started', 'opened', 'applied', 'pending'].includes(item.status)
    ) || null;

  return {
    totalSequenceCount: sequenceItems.length,
    openedCount: sequenceItems.filter((item) => item.status === 'opened').length,
    appliedCount: sequenceItems.filter((item) => item.status === 'applied').length,
    approvedCount: approvedItems.length,
    deniedCount: sequenceItems.filter((item) => item.status === 'denied').length,
    pendingCount: sequenceItems.filter((item) => item.status === 'pending').length,
    skippedCount: sequenceItems.filter((item) => item.status === 'skipped').length,
    totalApprovedLimit: approvedItems.reduce(
      (sum, item) => sum + Number(item.approved_limit || 0),
      0
    ),
    nextRecommendedItem,
    paymentStatus: payment?.status || null,
  };
}
