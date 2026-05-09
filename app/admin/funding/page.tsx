import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FundingAdminDashboard, type FundingAdminRecord } from '@/components/funding-admin-dashboard';
import { checkAdminAccess } from '@/lib/auth/admin';
import { Button } from '@/components/ui/button';
import type {
  FundingPayment,
  FundingProduct,
  FundingProfile,
  FundingRecommendation,
  FundingSequenceItem,
  FundingSequenceItemWithProduct,
} from '@/lib/funding/types';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  label: string
) {
  const { data, error } = await query;
  if (error) {
    console.warn(`[admin-funding] ${label} unavailable:`, error.message || error);
    return [] as T[];
  }

  return data ?? [];
}

export default async function AdminFundingPage() {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    redirect('/dashboard');
  }

  const supabase = createAdminClient();

  const [profiles, recommendations, users] =
    await Promise.all([
      safeRows<FundingProfile>(
        supabase
          .from('funding_profiles')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(250),
        'funding_profiles'
      ),
      safeRows<FundingRecommendation>(
        supabase
          .from('funding_recommendations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        'funding_recommendations'
      ),
      safeRows<{ id: string; user_id?: string | null; email?: string | null; full_name?: string | null }>(
        supabase
          .from('user_profiles')
          .select('id,user_id,email,full_name')
          .order('updated_at', { ascending: false })
          .limit(500),
        'user_profiles'
      ),
    ]);

  const latestRecommendationByUser = new Map<string, FundingRecommendation>();
  recommendations.forEach((recommendation) => {
    if (!recommendation.user_id) return;
    if (!latestRecommendationByUser.has(recommendation.user_id)) {
      latestRecommendationByUser.set(recommendation.user_id, {
        ...recommendation,
        warnings: Array.isArray(recommendation.warnings) ? recommendation.warnings : [],
      });
    }
  });

  const userById = new Map(users.map((entry) => [entry.user_id || entry.id, entry]));

  const recommendationIds = Array.from(latestRecommendationByUser.values())
    .map((recommendation) => recommendation.id)
    .filter((value): value is string => Boolean(value));

  const [sequenceRows, paymentRows] = recommendationIds.length
    ? await Promise.all([
        safeRows<FundingSequenceItem>(
          supabase
            .from('funding_sequence_items')
            .select('*')
            .in('recommendation_id', recommendationIds)
            .order('sequence_order', { ascending: true }),
          'funding_sequence_items'
        ),
        safeRows<FundingPayment>(
          supabase
            .from('funding_payments')
            .select('*')
            .in('recommendation_id', recommendationIds)
            .order('updated_at', { ascending: false }),
          'funding_payments'
        ),
      ])
    : [[], []];

  const productIds = sequenceRows
    .map((row) => row.product_id)
    .filter((value): value is string => Boolean(value));

  const productRows = productIds.length
    ? await safeRows<FundingProduct>(
        supabase.from('funding_products').select('*').in('id', productIds),
        'funding_products'
      )
    : [];

  const productById = new Map(
    productRows.map((product) => [product.id, product])
  );

  const sequenceByRecommendation = new Map<string, FundingSequenceItemWithProduct[]>();
  sequenceRows.forEach((item) => {
    if (!item.recommendation_id) return;
    const group = sequenceByRecommendation.get(item.recommendation_id) || [];
    group.push({
      ...item,
      product: item.product_id ? productById.get(item.product_id) || null : null,
    });
    sequenceByRecommendation.set(item.recommendation_id, group);
  });

  const paymentByRecommendation = new Map<string, FundingPayment>();
  paymentRows.forEach((payment) => {
    if (!payment.recommendation_id) return;
    if (!paymentByRecommendation.has(payment.recommendation_id)) {
      paymentByRecommendation.set(payment.recommendation_id, payment);
    }
  });

  const records: FundingAdminRecord[] = [];

  for (const profile of profiles) {
    if (!profile.user_id) continue;

    const recommendation = latestRecommendationByUser.get(profile.user_id) || null;
    const sequenceItems = recommendation?.id
      ? sequenceByRecommendation.get(recommendation.id) || []
      : [];
    const payment = recommendation?.id
      ? paymentByRecommendation.get(recommendation.id) || null
      : null;

    const totalApproved = sequenceItems.reduce(
      (sum, item) => sum + Number(item.approved_limit || 0),
      0
    );
    const latestStatus =
      sequenceItems.find((item) =>
        ['pending', 'applied', 'opened', 'approved', 'denied'].includes(item.status)
      )?.status ||
      payment?.status ||
      'not_started';

    const userProfile = userById.get(profile.user_id);

    records.push({
      userEmail: userProfile?.email || null,
      userName: userProfile?.full_name || null,
      profile,
      recommendation,
      sequenceItems,
      payment: payment as FundingPayment | null,
      totalApproved,
      latestStatus,
      createdAt:
        recommendation?.created_at ||
        profile.updated_at ||
        profile.created_at ||
        null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-6 md:px-8">
        <div>
          <p className="text-sm text-slate-400">Admin workspace</p>
          <h1 className="text-2xl font-semibold text-white">Funding operations</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin-panel">Open Admin Overview</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/leads">Open Lead Management</Link>
          </Button>
        </div>
      </div>

      <FundingAdminDashboard records={records} />
    </div>
  );
}
