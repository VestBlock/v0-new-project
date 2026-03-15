'use client';

import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

// shadcn/ui
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, Eye, ListChecks, Loader2, RefreshCw } from 'lucide-react';

/* ---------------- Types to match the API ---------------- */

type RoadmapSteps = {
  prerequisites: CatalogItem[];
  vendors: CatalogItem[];
  monitoring: CatalogItem[];
  cards: CatalogItem[];
  lenders: CatalogItem[];
};

type CatalogItem = {
  id: string;
  name: string;
  notes?: string;
  link: string;
};

type RunResponse = {
  roadmap: { steps: RoadmapSteps };
  html: string;
  pdfUrl?: string;
  runId: string;
};

type RoadmapRow = { pdf_path: any };

/* ---------------- Helpers ---------------- */

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const SCORE_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'poor', label: 'Poor (<580)' },
  { value: 'fair', label: 'Fair (580–669)' },
  { value: 'good', label: 'Good (670–739)' },
  { value: 'excellent', label: 'Excellent (740+)' },
] as const;

type Answers = {
  has_ein: boolean;
  has_bank: boolean;
  credit_score_range: (typeof SCORE_OPTIONS)[number]['value'];
  monthly_revenue: number | '';
};

const DEFAULT_ANSWERS: Answers = {
  has_ein: false,
  has_bank: false,
  credit_score_range: 'unknown',
  monthly_revenue: '',
};

/* ---------------- Page ---------------- */

export default function BusinessCreditPage() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    userProfile,
  } = useAuth();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const { toast } = useToast();

  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(true);

  // current run
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);

  // history
  const [history, setHistory] = useState<RoadmapRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  /* -------- Auth gate & initial load -------- */

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/tools/business-credit');
      return;
    }

    // load history
    (async () => {
      if (!user) return;

      try {
        const saved = await fetchSavedAnswers(supabase, user.id);
        if (saved) {
          setAnswers({ ...DEFAULT_ANSWERS, ...saved });
        }
      } catch (e) {
        console.warn('Prefill answers failed', e);
      }

      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('business_roadmaps')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error) setHistory(data || []);
      setLoadingHistory(false);
    })();
  }, [authLoading, isAuthenticated, router, supabase, user]);

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user && user.email === adminEmail) {
      setIsAdmin(true);
    }
  }, [user]);

  const isProMember = userProfile?.is_subscribed || isAdmin;

  if (!isProMember) {
    router.push('/credit-upload');
    // redirect('/dashboard');
  }

  async function fetchSavedAnswers(supabase: any, userId: string) {
    const { data } = await supabase
      .from('user_tool_answers')
      .select('answers')
      .eq('user_id', userId)
      .eq('tool', 'biz_credit')
      .maybeSingle();
    return (data?.answers as Partial<Answers>) ?? null;
  }

  async function upsertSavedAnswers(
    supabase: any,
    userId: string,
    answers: Answers
  ) {
    const { error } = await supabase.from('user_tool_answers').upsert(
      [{ user_id: userId, tool: 'biz_credit', answers }],
      { onConflict: 'user_id,tool' } // use the PK for conflict resolution
    );
    if (error) throw error;
  }

  /* -------- Validation -------- */

  const validationError = useMemo(() => {
    if (
      answers.monthly_revenue === '' ||
      Number.isNaN(Number(answers.monthly_revenue))
    ) {
      return 'Monthly revenue is required.';
    }
    if (Number(answers.monthly_revenue) < 0)
      return 'Revenue cannot be negative.';
    if (!answers.credit_score_range) return 'Select your credit score range.';
    return null;
  }, [answers]);

  /* -------- Actions -------- */

  const handleRun = async () => {
    if (!user) return;
    if (validationError) {
      toast({
        title: 'Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    setResult(null);

    const payload = {
      user_id: user.id,
      has_ein: !!answers.has_ein,
      has_bank: !!answers.has_bank,
      credit_score_range: answers.credit_score_range,
      monthly_revenue: Number(answers.monthly_revenue || 0),
    };

    try {
      // persist preferences locally if checked
      if (savingPrefs) {
        await upsertSavedAnswers(supabase, user.id, answers);
      }

      const res = await fetch('/api/biz-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: RunResponse = await res.json();
      setResult(data);

      // refresh history
      const { data: rows } = await supabase
        .from('business_roadmaps')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setHistory(rows || []);

      toast({
        title: 'Roadmap ready',
        description: 'Preview or download your plan.',
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Generation failed',
        description: e?.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const signPdf = async (pdf_path?: string | null) => {
    if (!pdf_path) return null;
    // create a fresh signed URL in the client (RLS policy allows SELECT on your user folder)
    const { data, error } = await supabase.storage
      .from('biz-roadmaps')
      .createSignedUrl(pdf_path, 60 * 10); // 10 minutes
    if (error) {
      toast({
        title: 'Could not sign PDF',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
    return data?.signedUrl || null;
  };

  const handleDownloadCurrent = async () => {
    if (result?.pdfUrl) {
      window.open(result.pdfUrl, '_blank');
      return;
    }
    // If no immediate url, try refetching the latest row and sign
    const latest = history[0];
    if (latest?.pdf_path) {
      const url = await signPdf(latest.pdf_path);
      if (url) window.open(url, '_blank');
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      //   setIsRunning(true);
      setRegenId(id);

      setResult(null);
      const res = await fetch(`/api/biz-credit/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('🚀 ~ handleRegenerate ~ data:', data);
      toast({
        title: 'Updated',
        description: 'Roadmap regenerated with new wording.',
      });
      setResult(data);

      // refresh history
      const { data: rows } = await supabase
        .from('business_roadmaps')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      setHistory(rows || []);

      // show preview if it was the latest
      //   if (data?.html)
      //     setResult((prev) => ({ ...(prev || ({} as any)), html: data.html }));
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Regenerate failed',
        description: e?.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setRegenId(null);

      //   setIsRunning(false);
    }
  };

  /* -------- UI -------- */

  const StepsList = ({
    title,
    items,
  }: {
    title: string;
    items: CatalogItem[];
  }) => (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No suggestions yet.</p>
        )}

        {items.map((it) => (
          <div
            key={it.id}
            className="
            grid grid-cols-[1fr_auto] gap-3 items-start
            rounded-md border p-3 bg-card
          "
          >
            {/* LEFT: text block that can wrap */}
            <div className="min-w-0">
              <div className="font-medium leading-5 break-words">{it.name}</div>

              {it.notes && (
                <div className="text-sm text-muted-foreground mt-1 break-words">
                  {it.notes}
                </div>
              )}

              {it.link && (
                <a
                  href={it.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline text-primary mt-1 inline-block max-w-full break-all"
                  title={it.link}
                >
                  {it.link}
                </a>
              )}
            </div>

            {/* RIGHT: badge that never wraps or overflows */}
            <div className="shrink-0 self-start">
              <Badge variant="outline" className="whitespace-nowrap">
                Recommended
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-6xl mx-auto px-4 pb-24 pt-24 md:pt-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text">
            Business Credit Builder
          </h1>
          <p className="text-muted-foreground">
            Answer a few questions and get a 4-step roadmap to build business
            credit and funding.
          </p>
        </div>
        <div className="container mx-auto px-4 py-8 space-y-6">
          {/* Layout: stacked on mobile, two columns on xl+ */}
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* LEFT: Form (spans 2 on xl) */}
            <aside className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Tell us where you are today.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="ein"
                      checked={!!answers.has_ein}
                      onCheckedChange={(v) =>
                        setAnswers((s) => ({ ...s, has_ein: Boolean(v) }))
                      }
                    />
                    <Label htmlFor="ein">I have an EIN</Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="bank"
                      checked={!!answers.has_bank}
                      onCheckedChange={(v) =>
                        setAnswers((s) => ({ ...s, has_bank: Boolean(v) }))
                      }
                    />
                    <Label htmlFor="bank">I have a business bank account</Label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Credit score</Label>
                      <Select
                        value={answers.credit_score_range}
                        onValueChange={(v) =>
                          setAnswers((s) => ({
                            ...s,
                            credit_score_range:
                              v as Answers['credit_score_range'],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {SCORE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly revenue (USD)</Label>
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="e.g. 2000"
                        value={answers.monthly_revenue}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d]/g, '');
                          setAnswers((s) => ({
                            ...s,
                            monthly_revenue: v === '' ? '' : Number(v),
                          }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="save"
                        checked={savingPrefs}
                        onCheckedChange={(v) => setSavingPrefs(Boolean(v))}
                      />
                      <Label htmlFor="save">
                        Save my answers for next time
                      </Label>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {answers.monthly_revenue !== '' && (
                        <>≈ {currency(Number(answers.monthly_revenue))}/mo</>
                      )}
                    </div>
                  </div>

                  {validationError && (
                    <div className="text-sm text-destructive">
                      {validationError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleRun}
                      disabled={!!validationError || isRunning}
                      className="bg-cyan-500 hover:bg-cyan-600 text-primary-foreground"
                    >
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ListChecks className="h-4 w-4 mr-2" />
                      )}
                      Build My Roadmap
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* History */}
              <Card>
                <CardHeader>
                  <CardTitle>Previous Roadmaps</CardTitle>
                  <CardDescription>
                    Re-open, download, or regenerate with new wording.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingHistory && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  )}
                  {!loadingHistory && history.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Nothing here yet.
                    </div>
                  )}
                  {history.map((row: any) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 border rounded-lg p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {format(new Date(row.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          v{row.version}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setResult({
                              runId: row.id,
                              html: row.html || '',
                              roadmap: { steps: row.steps as any },
                              pdfUrl: undefined,
                            })
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const url = await signPdf(row.pdf_path);
                            if (url) window.open(url, '_blank');
                          }}
                          disabled={!row.pdf_path}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerate(row.id)}
                          disabled={regenId === row.id}
                        >
                          {regenId === row.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>

            {/* RIGHT: Results (spans 3 on xl) */}
            <section className="space-y-6 ">
              <Card className="flex-wrap">
                <CardHeader>
                  <CardTitle>4-Step Roadmap</CardTitle>
                  <CardDescription>
                    Vendors, monitoring, cards, and lenders tailored to you.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <StepsList
                      title="Step 1 · Starter vendors"
                      items={result?.roadmap.steps.vendors || []}
                    />
                    <StepsList
                      title="Step 2 · Credit monitoring"
                      items={result?.roadmap.steps.monitoring || []}
                    />
                  </div>
                  <div className="space-y-4">
                    <StepsList
                      title="Step 3 · Starter cards"
                      items={result?.roadmap.steps.cards || []}
                    />
                    <StepsList
                      title="Step 4 · Lenders & resources"
                      items={result?.roadmap.steps.lenders || []}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Roadmap Preview</CardTitle>
                    <CardDescription>
                      Preview or download the PDF.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setResult((r) => (r ? { ...r } : r))}
                      disabled={!result}
                    >
                      <Eye className="h-4 w-4 mr-2" /> Preview
                    </Button>
                    <Button onClick={handleDownloadCurrent} disabled={!result}>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!result?.html && (
                    <div className="text-sm text-muted-foreground">
                      Run a roadmap to see the preview here.
                    </div>
                  )}
                  {result?.html && (
                    <div className="border rounded-lg overflow-hidden">
                      {/* Isolated rendering to avoid global CSS conflicts */}
                      {/* <iframe
                        className="w-full h-[60vh] "
                        style={{ backgroundColor: '#0b1220' }}
                        // safe-by-default sandbox; allow links to open new tabs if you want:
                        sandbox="allow-popups allow-top-navigation-by-user-activation"
                        srcDoc={
                          result?.html ||
                          '<!doctype html><html><body style="background:transparent;color:#94a3b8;padding:24px">Run the tool to see your roadmap.</body></html>'
                        }
                      /> */}
                      <div
                        className="p-5"
                        dangerouslySetInnerHTML={{
                          __html: `<!doctype html><html><head><meta charset="utf-8"/>
<style>
:root{--bg:#0b1220;--text:#e5e7eb;--muted:#94a3b8;--card:#0f172a}
  body{font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:0;padding:28px}
  h1{font-size:20px;margin:0 0 12px}
  h2{font-size:18px;margin:18px 0 8px}
  ul{margin:0 0 12px 18px}
  li{margin:4px 0}
  .muted{color:#555}
  .chip{display:inline-block;padding:2px 8px;border:1px solid #ddd;border-radius:999px;font-size:12px;margin-left:6px;color:#555}
</style></head><body> ${result.html}</body></html>`,
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
