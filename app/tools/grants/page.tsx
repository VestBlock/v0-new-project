'use client';

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
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase/client';
import { CircleX, Download, ExternalLink, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

type GrantProfileRow = {};

type Answers = {
  state: string;
  business_status: string;
  industry: string;
  revenue_range: string;
  founder_attributes: string[];
  has_ein: boolean;
  business_name?: string;
  user_id?: string;
};

type GrantCard = {
  name: string;
  description: string;
  typical_award?: string;
  why_fit?: string;
  link: string;
};

type RunResponse = {
  cards: GrantCard[];
  letterHtml: string;
  pdfUrl?: string;
  runId?: string;
};

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
];
const INDUSTRIES = [
  'retail',
  'food',
  'services',
  'health',
  'beauty',
  'jewelry',
  'manufacturing',
  'technology',
  'creative',
  'other',
];
const REVENUE_RANGES = [
  '<50k',
  '50k-100k',
  '100k-250k',
  '250k-500k',
  '>500k',
] as const;
const FOUNDER_FLAGS = [
  { key: 'women', label: 'Woman-owned' },
  { key: 'minority', label: 'Minority-owned' },
  { key: 'veteran', label: 'Veteran-owned' },
  { key: 'disability', label: 'Disability-owned' },
];

type FieldErrors = Partial<Record<keyof Answers, string>>;

function validate(a: Answers): FieldErrors {
  const e: FieldErrors = {};
  if (!a.state) e.state = 'Please select your state';
  if (!a.business_status) e.business_status = 'Select business status';
  if (!a.industry) e.industry = 'Select an industry';
  if (!a.revenue_range) e.revenue_range = 'Select your revenue';
  if (!a.business_name) e.business_name = 'Enter your business name';
  return e;
}

export default function GrantsPage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    userProfile,
  } = useAuth();
  const supabase = getSupabaseClient();
  const { toast } = useToast();
  const [errors, setErrors] = React.useState<FieldErrors>({});

  const [loading, setLoading] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [autoSave, setAutoSave] = React.useState(true);
  const [profileLoaded, setProfileLoaded] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);

  const [answers, setAnswers] = React.useState<Answers>({
    state: 'GA',
    business_status: 'sole_prop',
    industry: 'retail',
    revenue_range: '<50k',
    founder_attributes: [],
    has_ein: false,
    business_name: '',
  });

  const [result, setResult] = React.useState<RunResponse | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/login?redirect=/tools/grants');
  }, [authLoading, isAuthenticated, router]);

  React.useEffect(() => {
    if (!user || profileLoaded) return;
    (async () => {
      const { data } = await supabase
        .from('user_grant_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setAnswers((a) => ({
          ...a,
          state: data.state ?? a.state,
          business_status: data.business_status ?? a.business_status,
          industry: data.industry ?? a.industry,
          revenue_range: data.revenue_range ?? a.revenue_range,
          founder_attributes: (data.founder_attributes as string[]) ?? [],
          has_ein: !!data.has_ein,
          business_name: data.business_name ?? '',
        }));
      }
      setProfileLoaded(true);
    })();
  }, [supabase, user, profileLoaded]);

  const onChangeField = <K extends keyof Answers>(key: K, val: Answers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: val }));

  async function upsertProfile(next: Answers) {
    if (!user) return;
    setSavingProfile(true);
    const payload: Partial<GrantProfileRow> = {
      user_id: user.id,
      state: next.state,
      business_status: next.business_status,
      industry: next.industry,
      revenue_range: next.revenue_range,
      founder_attributes: next.founder_attributes,
      has_ein: next.has_ein,
      business_name: next.business_name || null,
      updated_at: new Date().toISOString() as any,
    };
    const { error } = await supabase
      .from('user_grant_profile')
      .upsert(payload, { onConflict: 'user_id' });
    setSavingProfile(false);
    if (error) {
      toast({
        title: 'Could not save profile',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Saved',
        description: 'Your preferences are saved for next time.',
      });
    }
  }

  async function runGrants() {
    if (!user) return;
    const e = validate(answers);
    setErrors(e);
    if (Object.keys(e).length) {
      // toast({ title: 'Missing information', description: 'Please complete the highlighted fields.' , variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      setResult(null);
      const body: Answers = { ...answers, user_id: user.id };
      if (autoSave) await upsertProfile(body);
      const resp = await fetch('/api/grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e?.error || 'Failed to generate results');
      }
      const data: RunResponse = await resp.json();
      setResult(data);
      toast({
        title: 'Done',
        description: 'We found grants and drafted your letter.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
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

  if (authLoading || !isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 md:pt-28 px-4 pb-16">
        {/* container is constrained to screen breakpoints; centered for large screens */}
        <div className="container max-w-screen-2xl 2xl:max-w-[1400px] mx-auto">
          {/* 12-column responsive grid: form spans 8 cols on lg+, results 4 cols */}
          <div className=" 2xl:gap-10">
            {/* LEFT: FORM */}
            <Card className="2xl:col-span-8">
              <CardHeader>
                <CardTitle>Grants & Free Money</CardTitle>
                <CardDescription>
                  Answer a few questions to get tailored grants and a
                  ready-to-use application letter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 md:space-y-7">
                {/* Field grid: 1 col on mobile, 2 cols on md+, 3 cols on xl+ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {/* State */}
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={answers.state}
                      onValueChange={(v) => onChangeField('state', v)}
                    >
                      <SelectTrigger id="state" className="w-full">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.state && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.state}
                      </p>
                    )}
                  </div>

                  {/* Business status */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Business status</Label>
                    <Select
                      value={answers.business_status}
                      onValueChange={(v) => onChangeField('business_status', v)}
                    >
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">
                          Planning to start
                        </SelectItem>
                        <SelectItem value="sole_prop">
                          Sole proprietorship
                        </SelectItem>
                        <SelectItem value="llc">LLC</SelectItem>
                        <SelectItem value="corp">C-Corp / S-Corp</SelectItem>
                        <SelectItem value="nonprofit">Nonprofit</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.business_status && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.business_status}
                      </p>
                    )}
                  </div>

                  {/* Industry */}
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select
                      value={answers.industry}
                      onValueChange={(v) => onChangeField('industry', v)}
                    >
                      <SelectTrigger id="industry" className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.industry && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.industry}
                      </p>
                    )}
                  </div>

                  {/* Revenue */}
                  <div className="space-y-2">
                    <Label htmlFor="rev">Annual revenue</Label>
                    <Select
                      value={answers.revenue_range}
                      onValueChange={(v) => onChangeField('revenue_range', v)}
                    >
                      <SelectTrigger id="rev" className="w-full">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {REVENUE_RANGES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.revenue_range && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.revenue_range}
                      </p>
                    )}
                  </div>

                  {/* EIN */}
                  <div className="space-y-2">
                    <Label>EIN</Label>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="ein"
                        checked={answers.has_ein}
                        onCheckedChange={(v) =>
                          onChangeField('has_ein', Boolean(v))
                        }
                      />
                      <Label htmlFor="ein">I have an EIN</Label>
                      {errors.has_ein && (
                        <p className="text-xs text-destructive mt-1">
                          {errors.has_ein}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Founder attributes */}
                  <div className="space-y-2">
                    <Label>Founder attributes</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FOUNDER_FLAGS.map((f) => (
                        <label key={f.key} className="flex items-center gap-3">
                          <Checkbox
                            checked={answers.founder_attributes.includes(f.key)}
                            onCheckedChange={(v) => {
                              const checked = Boolean(v);
                              setAnswers((prev) => ({
                                ...prev,
                                founder_attributes: checked
                                  ? [...prev.founder_attributes, f.key]
                                  : prev.founder_attributes.filter(
                                      (x) => x !== f.key
                                    ),
                              }));
                            }}
                          />
                          <span>{f.label}</span>
                        </label>
                      ))}
                    </div>
                    {errors.founder_attributes && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.founder_attributes}
                      </p>
                    )}
                  </div>

                  {/* Business name (full width on all) */}
                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label htmlFor="biz">Business name </Label>
                    <Input
                      id="biz"
                      value={answers.business_name || ''}
                      onChange={(e) =>
                        onChangeField('business_name', e.target.value)
                      }
                      placeholder="Example LLC"
                    />
                    {errors.business_name && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.business_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Save toggle */}
                {/* <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border p-3"> */}
                <div className="flex items-center gap-2 ">
                  <Checkbox
                    id="autosave"
                    checked={autoSave}
                    onCheckedChange={(v) => setAutoSave(Boolean(v))}
                  />
                  <Label htmlFor="autosave">
                    Save my answers for next time
                  </Label>
                </div>
                {/* <Button
                    variant="outline"
                    size="sm"
                    onClick={() => upsertProfile(answers)}
                    disabled={savingProfile}
                    className="w-full sm:w-auto"
                  >
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Save now
                  </Button> */}
                {/* </div> */}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={runGrants}
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Get Grants & Letter
                  </Button>
                </div>

                {/* Safety callout */}
                {/* <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm">
                  <ShieldAlert className="h-4 w-4 mt-0.5" />
                  <p>
                    Beware of “free government grant” scams: legitimate grants
                    don’t charge fees and won’t cold-call. We only show vetted
                    programs.
                  </p>
                </div> */}
              </CardContent>
            </Card>

            {/* RIGHT: RESULTS (sticky on large screens) */}
            <div className=" mt-10 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recommended Grants</CardTitle>
                  <CardDescription>
                    3–5 programs matched to your profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!result && !loading && (
                    <div className="text-muted-foreground">
                      Run a search to see matches here.
                    </div>
                  )}
                  {loading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finding matches…
                    </div>
                  )}
                  {result?.cards?.length ? (
                    <div className="space-y-3">
                      {result.cards.map((c, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="font-medium">{c.name}</div>
                            <Button asChild size="sm" variant="outline">
                              <a href={c.link} target="_blank" rel="noreferrer">
                                Apply / Learn More{' '}
                                <ExternalLink className="h-3.5 w-3.5 ml-1" />
                              </a>
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {c.description}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {c.typical_award ? (
                              <Badge variant="outline">{c.typical_award}</Badge>
                            ) : null}
                            {c.why_fit ? (
                              <span className="text-xs text-muted-foreground">
                                {c.why_fit}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>Application Letter</CardTitle>
                    <CardDescription>
                      Preview or download with new wording.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewOpen(true)}
                      disabled={!result?.letterHtml}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4 mr-2" /> Preview
                    </Button> */}
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={!result?.letterHtml && !result?.pdfUrl}
                      title="Download PDF"
                    >
                      <a
                        href={result?.pdfUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="h-4 w-4 mr-2" /> Download
                      </a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!result?.letterHtml ? (
                    <div className="text-muted-foreground">
                      Letter will appear here after you run.
                    </div>
                  ) : (
                    <div
                      className="prose prose-sm md:prose lg:prose-lg max-w-none border rounded-md p-4 bg-white dark:bg-background text-white"
                      dangerouslySetInnerHTML={{
                        __html: result.letterHtml.slice(0, 1200) + '…',
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* PREVIEW MODAL — full-bleed on mobile, centered on desktop */}
      {previewOpen && result?.letterHtml ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-0 sm:p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-background w-full h-full sm:h-auto sm:max-w-3xl rounded-none sm:rounded-lg shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">
                Letter Preview
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewOpen(false)}
              >
                <CircleX className="w-5 h-5 text-white" />
              </Button>
            </div>
            <div className="h-[calc(100vh-8rem)] sm:h-[70vh] overflow-auto border rounded-md p-4 text-white ">
              <div
                className="prose prose-sm md:prose lg:prose-lg prose-neutral max-w-none text-white"
                dangerouslySetInnerHTML={{ __html: result.letterHtml }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
