'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Globe2,
  MessageSquareMore,
  Rocket,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SitePreviewResult } from '@/lib/services/sitePreview';

type WebsitePreviewShowcaseProps = {
  preview: SitePreviewResult | null;
  isLoading?: boolean;
  mode: 'ai_assistant' | 'visibility_expansion';
};

type DemoTurn = {
  label: string;
  visitorMessage: string;
  botReply: string;
};

function signalTone(isPositive: boolean) {
  return isPositive
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-500/20 bg-amber-500/10 text-amber-100';
}

function friendlyOfferLabel(preview: SitePreviewResult) {
  return preview.inferredOffer === 'your main service'
    ? 'your main service'
    : preview.inferredOffer.toLowerCase();
}

function buildDemoTurns(preview: SitePreviewResult, mode: WebsitePreviewShowcaseProps['mode']): DemoTurn[] {
  const offer = friendlyOfferLabel(preview);
  const siteName = preview.siteName;
  const qualification = preview.botPreview.qualificationSteps;
  const locationStep =
    qualification.find((step) => /city|service area|location/i.test(step)) ||
    'capture the service area and timing';
  const bookingReply =
    mode === 'ai_assistant'
      ? `Absolutely. I can help with that. To get ${siteName} the right booking request, tell me what you need help with and when you would like to come in.`
      : `Absolutely. I can point you in the right direction. Tell me what service you want help with and which city or service area you are in.`;

  return [
    {
      label: 'Get pricing',
      visitorMessage: `I want pricing for ${offer}.`,
      botReply: `I can help with that. First, tell me what you need help with and where you are located so I can point you to the right next step. The goal is to ${locationStep.toLowerCase()}.`,
    },
    {
      label: mode === 'ai_assistant' ? 'Book an appointment' : 'See the next page',
      visitorMessage:
        mode === 'ai_assistant'
          ? `I want to book ${offer}.`
          : `I want to learn more before I contact ${siteName}.`,
      botReply: bookingReply,
    },
    {
      label: 'Ask a question',
      visitorMessage: `I have a question before I reach out.`,
      botReply: `No problem. Ask the question here and the bot should either answer it directly or guide you toward a quote, booking, or human follow-up without dropping the conversation.`,
    },
  ];
}

function buildWeekOnePlan(preview: SitePreviewResult, mode: WebsitePreviewShowcaseProps['mode']) {
  const firstWeakSignal =
    preview.websiteReport.weakSignals[0] || 'Tighten the main call to action and contact path';
  const bookingFocus = preview.websiteReport.hasOnlineBooking
    ? 'Refine the booking flow so high-intent visitors reach the right next step faster.'
    : 'Add a clearer booking or quote path so visitors are not forced into a dead end.';
  const pageFocus =
    mode === 'ai_assistant'
      ? `Launch the receptionist opener, FAQ path, and lead-routing flow around ${friendlyOfferLabel(preview)}.`
      : `Build the first page around ${preview.growthPreview.samplePageTitle} and support it with stronger proof.`;

  return [
    `Day 1: ${firstWeakSignal}.`,
    `Day 3: ${bookingFocus}`,
    `Day 7: ${pageFocus}`,
  ];
}

export function WebsitePreviewShowcase({
  preview,
  isLoading = false,
  mode,
}: WebsitePreviewShowcaseProps) {
  const demoTurns = useMemo(() => (preview ? buildDemoTurns(preview, mode) : []), [mode, preview]);
  const weekOnePlan = useMemo(() => (preview ? buildWeekOnePlan(preview, mode) : []), [mode, preview]);
  const [activeDemoIndex, setActiveDemoIndex] = useState(0);

  useEffect(() => {
    setActiveDemoIndex(0);
  }, [preview?.normalizedUrl, preview?.siteName, mode]);

  if (!preview && !isLoading) {
    return (
      <Card className="border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-cyan-600" />
            Website preview
          </CardTitle>
          <CardDescription>
            Paste your website to unlock a live demo of what VestBlock would likely improve first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs defaultValue="bot" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bot">Bot Demo</TabsTrigger>
              <TabsTrigger value="growth">Growth Demo</TabsTrigger>
              <TabsTrigger value="signals">Site Signals</TabsTrigger>
            </TabsList>

            <TabsContent value="bot">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="font-medium text-foreground">
                  {mode === 'ai_assistant'
                    ? 'See a sample receptionist opener and click through a visitor conversation'
                    : 'See how a lead-capture bot could greet visitors and guide them forward'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We will show a likely greeting, the first questions to ask, and a clickable demo of how the bot should move people toward a quote, booking, or follow-up.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="growth">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="font-medium text-foreground">See a sample page we would likely build</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We will show a sample page title, headline, and content direction based on your current website and market focus.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="signals">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="font-medium text-foreground">See what stands out on the current site</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We will call out clear calls to action, booking flow, contact path, trust signals, and a few visible quick wins.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-cyan-600" />
            Reading your website
          </CardTitle>
          <CardDescription>
            Pulling visible site signals and building a lightweight preview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!preview) return null;

  const activeTurn = demoTurns[activeDemoIndex] || demoTurns[0];

  return (
    <Card className="border-cyan-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-cyan-600" />
          Website preview
        </CardTitle>
        <CardDescription>
          Based on public website content and visible site signals. Final recommendations may change after full review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-sm font-medium text-foreground">Detected brand</p>
            <p className="mt-1 text-sm text-muted-foreground">{preview.siteName}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm font-medium text-foreground">Business type</p>
            <p className="mt-1 text-sm text-muted-foreground">{preview.inferredIndustry}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm font-medium text-foreground">Site speed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {preview.websiteReport.estimatedSpeed === 'unknown'
                ? 'Unknown'
                : preview.websiteReport.estimatedSpeed}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={signalTone(preview.websiteReport.hasClearCta)}
          >
            {preview.websiteReport.hasClearCta ? 'Clear CTA found' : 'CTA needs work'}
          </Badge>
          <Badge
            variant="outline"
            className={signalTone(preview.websiteReport.hasTrustSignals)}
          >
            {preview.websiteReport.hasTrustSignals ? 'Trust signals found' : 'Trust signals weak'}
          </Badge>
          <Badge
            variant="outline"
            className={signalTone(preview.websiteReport.hasContactSignals)}
          >
            {preview.websiteReport.hasContactSignals ? 'Contact path found' : 'Contact path weak'}
          </Badge>
          <Badge
            variant="outline"
            className={signalTone(preview.websiteReport.hasOnlineBooking)}
          >
            {preview.websiteReport.hasOnlineBooking ? 'Booking path found' : 'Booking path missing'}
          </Badge>
        </div>

        <Tabs defaultValue="bot" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bot">Bot Demo</TabsTrigger>
            <TabsTrigger value="growth">Growth Demo</TabsTrigger>
            <TabsTrigger value="signals">Site Signals</TabsTrigger>
          </TabsList>

          <TabsContent value="bot">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {mode === 'ai_assistant' ? 'Sample receptionist opener' : 'Sample lead-capture opener'}
                    </p>
                    <p className="text-xs text-muted-foreground">{preview.siteName}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-background px-4 py-3 text-sm text-foreground shadow-sm">
                    {preview.botPreview.greeting}
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    {preview.botPreview.openingPrompt}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {demoTurns.map((turn, index) => (
                      <button
                        key={turn.label}
                        type="button"
                        onClick={() => setActiveDemoIndex(index)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          index === activeDemoIndex
                            ? 'border-cyan-600 bg-cyan-600 text-white'
                            : 'border-cyan-500/20 bg-background text-muted-foreground hover:border-cyan-500/40 hover:text-foreground'
                        }`}
                      >
                        {turn.label}
                      </button>
                    ))}
                  </div>
                  {activeTurn ? (
                    <>
                      <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-cyan-600 px-4 py-3 text-sm text-white shadow-sm">
                        {activeTurn.visitorMessage}
                      </div>
                      <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-background px-4 py-3 text-sm text-foreground shadow-sm">
                        {activeTurn.botReply}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <MessageSquareMore className="h-4 w-4 text-cyan-600" />
                  Suggested visitor prompts
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {preview.botPreview.suggestedQuestions.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-2 font-medium text-foreground">
                  <Rocket className="h-4 w-4 text-cyan-600" />
                  What the bot should help with
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {preview.botPreview.qualificationSteps.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <Rocket className="h-4 w-4 text-cyan-600" />
                    Week 1 rollout preview
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {weekOnePlan.map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="growth">
            <div className="grid gap-4 lg:grid-cols-[1fr_.95fr]">
              <div className="rounded-2xl border p-4">
                <p className="font-medium text-foreground">Sample page we would likely build</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {preview.growthPreview.samplePageTitle}
                </p>
                <p className="mt-2 font-mono text-xs text-cyan-600">
                  {preview.growthPreview.sampleSlug}
                </p>
                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-700/80">
                    Sample headline
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {preview.growthPreview.sampleHeadline}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-cyan-600" />
                  What this page should cover
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {preview.growthPreview.sampleSections.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-2 font-medium text-foreground">
                  <Zap className="h-4 w-4 text-cyan-600" />
                  Quick wins from the current site
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {preview.growthPreview.quickWins.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signals">
            <div className="grid gap-4 lg:grid-cols-[1fr_.95fr]">
              <div className="rounded-2xl border p-4">
                <p className="font-medium text-foreground">Visible page details</p>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">Page title</p>
                    <p className="mt-1">{preview.pageTitle || 'Not detected'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Meta description</p>
                    <p className="mt-1">{preview.metaDescription || 'Not detected'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Hero heading</p>
                    <p className="mt-1">{preview.heroHeading || 'Not detected'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <CircleAlert className="h-4 w-4 text-cyan-600" />
                  Visible improvement opportunities
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {preview.websiteReport.weakSignals.length ? (
                    preview.websiteReport.weakSignals.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">
                      No obvious issues were detected from the public page content alone.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
