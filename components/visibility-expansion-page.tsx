'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe2,
  Loader2,
  MapPinned,
  Megaphone,
  Search,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { WebsitePreviewShowcase } from '@/components/site-preview-showcase';
import type { SitePreviewResult } from '@/lib/services/sitePreview';
import {
  getSmallBusinessTemplate,
  smallBusinessTemplateKeys,
  type SmallBusinessTemplateKey,
} from '@/lib/services/smallBusinessTemplates';
import {
  getVisibilityExpansionPackage,
  visibilityExpansionPackageKeys,
  visibilityExpansionPackages,
  type VisibilityExpansionPackageKey,
} from '@/lib/services/visibilityExpansionPackages';

const initialForm = {
  packageKey: visibilityExpansionPackageKeys[0] as VisibilityExpansionPackageKey,
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  websiteUrl: '',
  primaryOffer: '',
  cityFocus: '',
  monthlyRevenueGoal: '',
  biggestGap: '',
  notes: '',
};

const iconByPackage = {
  visibility_starter: Search,
  city_expansion_engine: MapPinned,
  authority_pr_engine: Megaphone,
} satisfies Record<VisibilityExpansionPackageKey, typeof Search>;

export function VisibilityExpansionPage() {
  const searchParams = useSearchParams();
  const requestedPackage = searchParams.get('package');
  const initialPackageKey = visibilityExpansionPackageKeys.includes(
    requestedPackage as VisibilityExpansionPackageKey
  )
    ? (requestedPackage as VisibilityExpansionPackageKey)
    : initialForm.packageKey;
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [formData, setFormData] = useState(() => ({
    ...initialForm,
    packageKey: initialPackageKey,
  }));
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<SmallBusinessTemplateKey | null>(null);
  const [submissionState, setSubmissionState] = useState<{
    businessName: string;
    packageTitle: string;
    deliverableStatus: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [websitePreview, setWebsitePreview] = useState<SitePreviewResult | null>(null);

  const selectedPackage =
    getVisibilityExpansionPackage(formData.packageKey) ?? visibilityExpansionPackages[0];
  const selectedTemplate = useMemo(
    () => (selectedTemplateKey ? getSmallBusinessTemplate(selectedTemplateKey) ?? null : null),
    [selectedTemplateKey]
  );
  const previewBusinessName = formData.businessName || selectedTemplate?.title || 'Your business';
  const previewOffer =
    formData.primaryOffer || selectedTemplate?.visibility.primaryOffer || 'your primary service offer';
  const previewMarket = formData.cityFocus || 'your core market';
  const deliverableStatusLabel =
    submissionState?.deliverableStatus === 'sent_to_client'
      ? isAuthenticated
        ? 'Ready in your account'
        : 'Ready after account setup'
      : submissionState?.deliverableStatus === 'ready_for_review'
        ? 'Being reviewed'
        : submissionState?.deliverableStatus === 'queued'
          ? 'Queued for setup'
        : submissionState?.deliverableStatus === 'generating'
          ? 'In progress'
          : 'Saved';
  const previewQueue = useMemo(() => {
    if (selectedTemplate?.visibility.firstFocus.length) {
      return selectedTemplate.visibility.firstFocus;
    }

    if (selectedPackage.key === 'city_expansion_engine') {
      return [
        `Map the city and service combinations around ${previewMarket}.`,
        `Plan the first city pages that support ${previewOffer}.`,
        'Set a simple monthly review for new service areas.',
      ];
    }

    if (selectedPackage.key === 'authority_pr_engine') {
      return [
        `Choose the strongest trust angles around ${previewOffer}.`,
        'Build a shortlist of local media, podcasts, and partner mentions.',
        'Turn proof points into stronger credibility pages and outreach topics.',
      ];
    }

    return [
      `Review how ${previewBusinessName} currently shows up for ${previewOffer}.`,
      'List the customer questions the site needs to answer more clearly.',
      `Choose the next pages and content updates for ${previewMarket}.`,
    ];
  }, [previewBusinessName, previewMarket, previewOffer, selectedPackage.key, selectedTemplate]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const applyTemplate = (templateKey: SmallBusinessTemplateKey) => {
    const template = getSmallBusinessTemplate(templateKey);
    if (!template) return;

    setSelectedTemplateKey(templateKey);
    setFormData((current) => ({
      ...current,
      packageKey: template.visibility.recommendedPackage,
      primaryOffer: current.primaryOffer || template.visibility.primaryOffer,
      monthlyRevenueGoal:
        current.monthlyRevenueGoal || template.visibility.monthlyRevenueGoal,
      biggestGap: current.biggestGap || template.visibility.biggestGap,
      notes: current.notes || template.visibility.notes,
    }));
  };

  const generateWebsitePreview = async () => {
    if (!formData.websiteUrl.trim()) {
      setPreviewError('Add a website URL first.');
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError('');

    try {
      const response = await fetch('/api/site-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: formData.websiteUrl,
          businessName: formData.businessName,
          primaryOffer: formData.primaryOffer,
          cityFocus: formData.cityFocus,
          packageType: 'visibility_expansion',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate website preview.');
      }

      setWebsitePreview(data.preview);
      setFormData((current) => ({
        ...current,
        businessName: current.businessName || data.preview.siteName || current.businessName,
        primaryOffer:
          current.primaryOffer || data.preview.inferredOffer || current.primaryOffer,
      }));
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : 'Unable to generate website preview.'
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const choosePackage = (packageKey: VisibilityExpansionPackageKey) => {
    setFormData((current) => ({ ...current, packageKey }));
    document.getElementById('request-visibility-review')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/visibility-expansion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: formData.email || user?.email || '',
          templateKey: selectedTemplateKey || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit request.');
      }

      toast({
        title: 'Request submitted',
        description: `We received your ${selectedPackage.title.toLowerCase()} request and saved the next-step plan.`,
      });
      setSubmissionState({
        businessName: formData.businessName,
        packageTitle: selectedPackage.title,
        deliverableStatus: data.deliverableStatus || 'requested',
      });
    } catch (error) {
      toast({
        title: 'Submission failed',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again or contact VestBlock directly.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="premium-page">
      <section className="px-4 pb-16 pt-24">
        <div className="container mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">
              Search visibility and authority
            </Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
              Show up in more places when people search for what you sell.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              VestBlock helps service businesses improve local search coverage, city pages,
              credibility proof, and the content people need before they contact you.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <a href="#request-visibility-review">
                  Request Visibility Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">Compare Pricing</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link
                href="/services/visibility-expansion-saas"
                className="underline-offset-4 hover:underline"
              >
                Read the Search Visibility service guide
              </Link>
              {visibilityExpansionPackages.map((pkg) => (
                <Link
                  key={pkg.key}
                  href={`/services/${pkg.slug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {pkg.title} guide
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link href="/visibility-expansion/proof-hub" className="underline-offset-4 hover:underline">
                Proof Hub
              </Link>
              <Link href="/visibility-expansion/case-study" className="underline-offset-4 hover:underline">
                Case Study
              </Link>
              <Link href="/learn/search-visibility-for-small-business" className="underline-offset-4 hover:underline">
                Learn how it works
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground">Show up in more customer searches</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Build clearer service pages and answers that help customers find you.
                  </p>
                </CardContent>
              </Card>
              <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground">Expand by city</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Turn multi-city growth into clear monthly work instead of guesswork.
                  </p>
                </CardContent>
              </Card>
              <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground">Layer in authority</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Build stronger trust with proof, mentions, and credibility pages.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-600" />
                A clearer alternative to a vague marketing retainer
              </CardTitle>
              <CardDescription>
                These packages are easier to explain and easier to buy than open-ended monthly marketing work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The customer gets a clearer plan for where the site needs to improve first,
                which pages matter most, and how to support growth by city or service.
              </p>
              <p>
                Every request starts with a sample plan so the next step is clearer before any larger scope is discussed.
              </p>
              <p>
                No package is framed as guaranteed rankings or revenue. The value is a clearer,
                more consistent way to improve how your business is found and trusted.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="container mx-auto max-w-7xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Visibility offers</h2>
            <p className="max-w-3xl text-muted-foreground">
              Start with the package that matches the current gap, then move into
              broader city or authority work when the business has the capacity to support it.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {visibilityExpansionPackages.map((servicePackage) => {
              const Icon = iconByPackage[servicePackage.key];
              const isSelected = servicePackage.key === selectedPackage.key;

              return (
                <Card
                  key={servicePackage.key}
                  className={
                    isSelected ? 'premium-card border-cyan-500 shadow-lg shadow-cyan-500/10' : 'premium-card border-cyan-500/20'
                  }
                >
                  <CardHeader>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline">{servicePackage.priceLabel}</Badge>
                    </div>
                    <CardTitle>{servicePackage.title}</CardTitle>
                    <CardDescription>{servicePackage.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Best for</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {servicePackage.bestFor}
                      </p>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {servicePackage.deliverables.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3 text-sm text-muted-foreground">
                      {servicePackage.turnaround}
                    </div>
                    <Button
                      className="w-full"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => choosePackage(servicePackage.key)}
                    >
                      {isSelected ? 'Selected' : 'Choose this package'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="container mx-auto max-w-7xl">
          <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-cyan-500/30 text-cyan-200">
                Buyer guide
              </Badge>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FileText className="h-5 w-5 text-cyan-500" />
                See what the first visibility sprint looks like
              </CardTitle>
              <CardDescription>
                Download the short one-pager and 7-day launch plan before you request a review.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Button asChild variant="outline" className="justify-between">
                <a href="/sales/vestblock-search-visibility-one-pager.pdf" target="_blank" rel="noreferrer">
                  Search Visibility One-Pager
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <a href="/sales/vestblock-before-after-growth-example.pdf" target="_blank" rel="noreferrer">
                  Before and After Example
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <a href="/sales/vestblock-7-day-growth-launch-plan.pdf" target="_blank" rel="noreferrer">
                  7-Day Launch Plan
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="request-visibility-review" className="px-4 py-16">
        <div className="container mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.92fr_1.08fr]">
          <div className="space-y-6">
            <Card className="premium-card border-cyan-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-cyan-600" />
                  Live plan preview
                </CardTitle>
                <CardDescription>
                  This preview updates as you fill out the form so you can see the direction before you submit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                    <p className="text-sm font-medium text-foreground">Business</p>
                    <p className="mt-1 text-sm text-muted-foreground">{previewBusinessName}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                    <p className="text-sm font-medium text-foreground">Selected plan</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedPackage.title}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                    <p className="text-sm font-medium text-foreground">Offer focus</p>
                    <p className="mt-1 text-sm text-muted-foreground">{previewOffer}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                    <p className="text-sm font-medium text-foreground">Market focus</p>
                    <p className="mt-1 text-sm text-muted-foreground">{previewMarket}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
                  <p className="font-medium text-foreground">First recommendations</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {previewQueue.map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <WebsitePreviewShowcase
              preview={websitePreview}
              isLoading={isPreviewLoading}
              mode="visibility_expansion"
            />

            <Card className="premium-card border-cyan-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-600" />
                  What you will receive
                </CardTitle>
                <CardDescription>
                  These are the first things you can expect after you submit your request.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                  <p className="font-medium text-foreground">Visibility summary</p>
                  <p className="mt-1">
                    A plain-language summary of the biggest visibility gaps and what needs to be fixed first.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                  <p className="font-medium text-foreground">Priority page ideas</p>
                  <p className="mt-1">
                    Suggested service pages, city pages, and trust-building improvements to work on next.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                  <p className="font-medium text-foreground">Follow-up questions</p>
                  <p className="mt-1">
                    Any missing details we need before recommending the best next move.
                  </p>
                </div>
              </CardContent>
            </Card>
            {selectedTemplate ? (
              <Card className="premium-card border-cyan-500/20">
                <CardHeader>
                  <CardTitle>Template ready for {selectedTemplate.title}</CardTitle>
                  <CardDescription>
                    Recommended package: {getVisibilityExpansionPackage(selectedTemplate.visibility.recommendedPackage)?.title}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {selectedTemplate.visibility.firstFocus.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Request a search visibility plan</CardTitle>
              <CardDescription>
                Tell VestBlock what you sell, where you want to grow, and what is currently underperforming.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Start from a small-business template</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                    Pick the closest business type and we will preload a more useful visibility plan.
                      </p>
                    </div>
                    {selectedTemplate ? (
                      <Badge variant="outline">Using {selectedTemplate.title} template</Badge>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {smallBusinessTemplateKeys.map((templateKey) => {
                      const template = getSmallBusinessTemplate(templateKey);
                      if (!template) return null;
                      const isActive = selectedTemplateKey === template.key;

                      return (
                        <button
                          key={template.key}
                          type="button"
                          onClick={() => applyTemplate(template.key)}
                          className={`rounded-xl border p-4 text-left transition ${
                            isActive
                              ? 'border-cyan-600 bg-cyan-600/10'
                              : 'border-cyan-500/20 bg-background hover:border-cyan-500/40'
                          }`}
                        >
                          <p className="font-medium text-foreground">{template.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{template.summary}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {submissionState ? (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {submissionState.packageTitle} request saved for {submissionState.businessName}
                    </p>
                    <p className="mt-1">
                      Status: {deliverableStatusLabel}. VestBlock will review the visibility gaps, confirm the best-fit package, and send the next recommendations before any monthly work starts.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button asChild size="sm">
                        <Link href={isAuthenticated ? '/dashboard/services' : '/register?redirect=/dashboard/services'}>
                          {isAuthenticated ? 'View My Account' : 'Create Account for Dashboard Access'}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/get-started">Choose Another Service</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  Takes about 2 minutes. VestBlock uses this to build a first-pass plan and confirm the best-fit package before any ongoing work is discussed.
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="packageKey">Package</Label>
                    <Select
                      value={formData.packageKey}
                      onValueChange={(value) => handleSelectChange('packageKey', value)}
                    >
                      <SelectTrigger id="packageKey">
                        <SelectValue placeholder="Choose a package" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibilityExpansionPackages.map((servicePackage) => (
                          <SelectItem key={servicePackage.key} value={servicePackage.key}>
                            {servicePackage.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business name</Label>
                    <Input
                      id="businessName"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      placeholder="Acme Home Services"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact name</Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleInputChange}
                      placeholder="Jordan Smith"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email || user?.email || ''}
                      onChange={handleInputChange}
                      placeholder="jordan@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="(555) 555-5555"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used only if we need to confirm details about the business or service area.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website</Label>
                    <Input
                      id="websiteUrl"
                      name="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={handleInputChange}
                      placeholder="https://example.com"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateWebsitePreview}
                        disabled={isPreviewLoading || !formData.websiteUrl.trim()}
                      >
                        {isPreviewLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Preview
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Preview My Site
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        See a sample page idea and a few quick wins from the current site.
                      </p>
                    </div>
                    {previewError ? (
                      <p className="text-sm text-destructive">{previewError}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primaryOffer">Primary offer</Label>
                    <Input
                      id="primaryOffer"
                      name="primaryOffer"
                      value={formData.primaryOffer}
                      onChange={handleInputChange}
                      placeholder="Kitchen remodeling for homeowners"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cityFocus">City or service area focus</Label>
                    <Input
                      id="cityFocus"
                      name="cityFocus"
                      value={formData.cityFocus}
                      onChange={handleInputChange}
                      placeholder="Dallas, Fort Worth, Plano"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="monthlyRevenueGoal">Monthly revenue or growth goal</Label>
                    <Input
                      id="monthlyRevenueGoal"
                      name="monthlyRevenueGoal"
                      value={formData.monthlyRevenueGoal}
                      onChange={handleInputChange}
                      placeholder="Add 15 booked estimates per month"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="biggestGap">Biggest visibility gap right now</Label>
                    <Input
                      id="biggestGap"
                      name="biggestGap"
                      value={formData.biggestGap}
                      onChange={handleInputChange}
                      placeholder="We barely show up outside our main city and AI answer tools rarely mention us."
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Share competitors, current marketing tools, or any pages that matter most."
                      rows={5}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-muted-foreground">
                  {selectedPackage.complianceNote}
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  We will email the plan and next steps to the address above. No guarantees, no spam.
                </p>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting request...
                    </>
                  ) : (
                    <>
                      Get My Visibility Plan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
