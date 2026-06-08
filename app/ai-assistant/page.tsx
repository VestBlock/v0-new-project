"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  Rocket,
  Send,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { WebsitePreviewShowcase } from "@/components/site-preview-showcase";
import { AiReceptionistProofChat } from "@/components/ai-receptionist-proof-chat";
import type { SitePreviewResult } from "@/lib/services/sitePreview";
import {
  automationPackageKeys,
  automationPackages,
  getAutomationPackage,
  type AutomationPackageKey,
} from "@/lib/services/automationPackages";
import {
  getSmallBusinessTemplate,
  smallBusinessTemplateKeys,
  type SmallBusinessTemplateKey,
} from "@/lib/services/smallBusinessTemplates";

const initialForm = {
  packageKey: automationPackageKeys[0] as AutomationPackageKey,
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  websiteUrl: "",
  industry: "",
  currentSystem: "",
  monthlyLeadVolume: "",
  notes: "",
};

const iconByPackage = {
  ai_receptionist_launch: Bot,
  appointment_booking_system: CalendarClock,
  website_upgrade_sprint: Globe,
} satisfies Record<AutomationPackageKey, typeof Bot>;

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const requestedPackage = searchParams.get("package");
  const initialPackageKey = automationPackageKeys.includes(requestedPackage as AutomationPackageKey)
    ? (requestedPackage as AutomationPackageKey)
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
  const [previewError, setPreviewError] = useState("");
  const [websitePreview, setWebsitePreview] = useState<SitePreviewResult | null>(null);

  const selectedPackage = useMemo(
    () => getAutomationPackage(formData.packageKey) ?? automationPackages[0],
    [formData.packageKey]
  );
  const selectedTemplate = useMemo(
    () => (selectedTemplateKey ? getSmallBusinessTemplate(selectedTemplateKey) ?? null : null),
    [selectedTemplateKey]
  );
  const previewBusinessName = formData.businessName || selectedTemplate?.title || "Your business";
  const previewIndustry = formData.industry || selectedTemplate?.industry || "your industry";
  const previewSystem = formData.currentSystem || "your current website and lead flow";
  const setupPreview = useMemo(() => {
    if (selectedTemplate?.aiAssistant.firstFocus.length) {
      return selectedTemplate.aiAssistant.firstFocus;
    }

    if (selectedPackage.key === "website_upgrade_sprint") {
      return [
        `Audit ${previewBusinessName} for mobile clarity, CTA friction, and weak conversion paths.`,
        `Turn ${previewSystem} into a cleaner visitor-to-lead journey.`,
        "Outline homepage, service-page, and booking-flow improvements.",
      ];
    }

    if (selectedPackage.key === "appointment_booking_system") {
      return [
        `Train the AI receptionist for ${previewIndustry} questions and qualification needs.`,
        "Route qualified visitors into calendar or booking logic instead of dead-end chat.",
        "Add clearer missed-lead notifications and follow-up steps.",
      ];
    }

    return [
      `Train a front-desk assistant for ${previewBusinessName}.`,
      `Use ${previewSystem} as the starting point for lead-flow improvements.`,
      "Outline a cleaner lead capture and FAQ flow.",
    ];
  }, [previewBusinessName, previewIndustry, previewSystem, selectedPackage.key, selectedTemplate]);
  const deliverableStatusLabel =
    submissionState?.deliverableStatus === "sent_to_client"
      ? isAuthenticated
        ? "Ready in your account"
        : "Ready after account setup"
      : submissionState?.deliverableStatus === "ready_for_review"
        ? "Being reviewed"
        : submissionState?.deliverableStatus === "queued"
          ? "Queued for setup"
        : submissionState?.deliverableStatus === "generating"
          ? "In progress"
          : "Saved";

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
      packageKey: template.aiAssistant.recommendedPackage,
      industry: current.industry || template.industry,
      currentSystem: current.currentSystem || template.aiAssistant.currentSystem,
      monthlyLeadVolume: current.monthlyLeadVolume || template.aiAssistant.monthlyLeadVolume,
      notes: current.notes || template.aiAssistant.notes,
    }));
  };

  const generateWebsitePreview = async () => {
    if (!formData.websiteUrl.trim()) {
      setPreviewError("Add a website URL first.");
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/site-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: formData.websiteUrl,
          businessName: formData.businessName,
          industry: formData.industry,
          packageType: "ai_assistant",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to generate website preview.");
      }

      setWebsitePreview(data.preview);
      setFormData((current) => ({
        ...current,
        businessName: current.businessName || data.preview.siteName || current.businessName,
        industry: current.industry || data.preview.inferredIndustry || current.industry,
      }));
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Unable to generate website preview."
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const choosePackage = (packageKey: AutomationPackageKey) => {
    setFormData((current) => ({ ...current, packageKey }));
    document.getElementById("request-setup")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/ai-assistant-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: formData.email || user?.email || "",
          templateKey: selectedTemplateKey || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      toast({
        title: "Request submitted",
        description: `We received your ${selectedPackage.title.toLowerCase()} request and saved the next-step recommendations.`,
      });
      setSubmissionState({
        businessName: formData.businessName,
        packageTitle: selectedPackage.title,
        deliverableStatus: data.deliverableStatus || "requested",
      });
    } catch (error) {
      toast({
        title: "Submission failed",
        description:
          error instanceof Error
            ? error.message
            : "Please try again or contact VestBlock directly.",
        variant: "destructive",
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
              Lead capture and booking systems
            </Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
              AI receptionist, booking, and website improvements for service businesses.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              VestBlock helps businesses clean up the front end of the customer journey:
              better lead capture, better booking flow, and a stronger website experience before
              you spend more on ads or keep paying for a clunky bot that still drops intent.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <a href="#request-setup">
                  Request Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#ai-receptionist-demo">Try Demo</a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/pricing">Compare Pricing</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link href="/services/vestblock-ai-assistant" className="underline-offset-4 hover:underline">
                Read the AI Receptionist service guide
              </Link>
              {automationPackages.map((pkg) => (
                <Link
                  key={pkg.key}
                  href={`/services/${pkg.slug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {pkg.title} guide
                </Link>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground">Capture more leads</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stop relying on missed calls, weak forms, or generic contact pages.
                  </p>
                </CardContent>
              </Card>
              <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground">Book better conversations</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add qualification and booking logic instead of hoping people call back.
                  </p>
                </CardContent>
              </Card>
              <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground">Upgrade weak websites</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Improve mobile clarity, CTAs, and the move from visitor to lead.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-600" />
                Simple pricing for real setup work
              </CardTitle>
              <CardDescription>
                These offers are meant to be easier to start than a traditional agency build while
                still covering setup, launch work, and support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                AI receptionist tools in the market often start in the low hundreds per month, while
                small-business agency website projects can quickly reach the mid-thousands. VestBlock
                keeps the first step tighter and clearer while still giving the business practical tools it can actually use.
              </p>
              <p>
                Setup fees cover training, implementation, and launch cleanup. Monthly pricing covers
                the ongoing receptionist or booking support. Website upgrade work starts with a defined
                sprint scope so the project does not become vague or open-ended.
              </p>
              <p>
                No package guarantees revenue. The goal is stronger lead capture and follow-up.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="ai-receptionist-demo" className="px-4 py-16">
        <div className="container mx-auto max-w-7xl space-y-6">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div className="space-y-3">
              <Badge className="w-fit bg-cyan-600 text-white">
                Live proof example
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Test the receptionist flow before requesting setup.
              </h2>
            </div>
            <p className="text-muted-foreground">
              This demo is intentionally simple and public: it shows the core job buyers care about,
              answering questions, qualifying intent, and creating a handoff the business can act on.
              A client install connects the flow to their real booking, inbox, or lead pipeline.
            </p>
          </div>
          <AiReceptionistProofChat />
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="container mx-auto max-w-7xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Automation offers</h2>
            <p className="max-w-3xl text-muted-foreground">
              Start with the offer that matches the biggest gap in your current lead capture, then add more only when the business needs it.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {automationPackages.map((servicePackage) => {
              const Icon = iconByPackage[servicePackage.key];
              const isSelected = servicePackage.key === selectedPackage.key;

              return (
                <Card
                  key={servicePackage.key}
                  className={
                    isSelected ? "premium-card border-cyan-500 shadow-lg shadow-cyan-500/10" : "premium-card border-cyan-500/20"
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
                    <div>
                      <p className="text-sm font-medium">Includes</p>
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {servicePackage.deliverables.map((item) => (
                          <li key={item} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Typical timing</p>
                      <p className="mt-1">{servicePackage.turnaround}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => choosePackage(servicePackage.key)}>
                        Choose This Offer
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={`/services/${servicePackage.slug}`}>View Service</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="container mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-cyan-600" />
                When this makes sense
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>You are getting traffic but too many visitors leave without contacting you.</p>
              <p>You miss leads after hours or your team keeps answering the same questions.</p>
              <p>Your booking flow is weak, manual, or inconsistent across devices.</p>
            </CardContent>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-600" />
                What VestBlock handles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Website chat setup, booking prompts, and follow-up flow improvements.</p>
              <p>Qualification questions and booking logic when the package includes it.</p>
              <p>Website improvement direction around mobile clarity, calls to action, and conversion flow.</p>
            </CardContent>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-600" />
                Guardrail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>VestBlock provides setup, organization, and conversion support.</p>
              <p>Booked revenue, close rate, and lead quality still depend on the business and market.</p>
              <p>Only truthful, accurate, and documentable information should be used in customer responses.</p>
            </CardContent>
          </Card>
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
                See how the receptionist setup works
              </CardTitle>
              <CardDescription>
                Use these short assets to compare the setup, launch path, and growth flow before you request help.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Button asChild variant="outline" className="justify-between">
                <a href="/sales/vestblock-ai-receptionist-one-pager.pdf" target="_blank" rel="noreferrer">
                  AI Receptionist One-Pager
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <a href="/sales/vestblock-growth-flowchart.svg" target="_blank" rel="noreferrer">
                  Growth Flowchart
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

      <section id="request-setup" className="px-4 py-16">
        <div className="container mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>Request your setup</CardTitle>
              <CardDescription>
                Tell VestBlock about your business and current website so we can recommend the right next steps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Start from a small-business template</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pick the template that matches the business and we will preload a better setup direction.
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
                              ? "border-cyan-600 bg-cyan-600/10"
                              : "border-cyan-500/20 bg-background hover:border-cyan-500/40"
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
                      Status: {deliverableStatusLabel}. VestBlock will review your site, confirm the best-fit scope, and send the next recommendations before any build work starts.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button asChild size="sm">
                        <Link href={isAuthenticated ? "/dashboard/services" : "/register?redirect=/dashboard/services"}>
                          {isAuthenticated ? "View My Account" : "Create Account for Dashboard Access"}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/get-started">Choose Another Service</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="packageKey">Offer</Label>
                  <Select
                    value={formData.packageKey}
                    onValueChange={(value) => handleSelectChange("packageKey", value)}
                  >
                    <SelectTrigger id="packageKey">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {automationPackages.map((servicePackage) => (
                        <SelectItem key={servicePackage.key} value={servicePackage.key}>
                          {servicePackage.title} ({servicePackage.priceLabel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business name</Label>
                    <Input
                      id="businessName"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
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
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email || user?.email || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Add a phone number only if you want a call-back for setup questions.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website URL</Label>
                    <Input
                      id="websiteUrl"
                      name="websiteUrl"
                      placeholder="Optional if you need a new site or a rebuild"
                      value={formData.websiteUrl}
                      onChange={handleInputChange}
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
                        Paste a website to preview the bot style and a few likely website improvements.
                      </p>
                    </div>
                    {previewError ? (
                      <p className="text-sm text-destructive">{previewError}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      name="industry"
                      placeholder="HVAC, med spa, legal, salon, auto repair..."
                      value={formData.industry}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentSystem">Current lead or booking setup</Label>
                    <Input
                      id="currentSystem"
                      name="currentSystem"
                      placeholder="Phone only, contact form, Calendly, no booking tool..."
                      value={formData.currentSystem}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyLeadVolume">Approx. monthly lead volume</Label>
                    <Input
                      id="monthlyLeadVolume"
                      name="monthlyLeadVolume"
                      placeholder="Optional"
                      value={formData.monthlyLeadVolume}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">What needs the most help?</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    rows={5}
                    placeholder="Tell us where the current process breaks: missed calls, weak booking, slow follow-up, outdated pages, no clear CTA, mobile issues..."
                    value={formData.notes}
                    onChange={handleInputChange}
                  />
                </div>

                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Submit Setup Request
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <WebsitePreviewShowcase
              preview={websitePreview}
              isLoading={isPreviewLoading}
              mode="ai_assistant"
            />

            <Card className="premium-card border-cyan-500/20">
              <CardHeader>
                <CardTitle>{selectedPackage.title}</CardTitle>
                <CardDescription>{selectedPackage.priceLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>{selectedPackage.summary}</p>
                <div>
                  <p className="font-medium text-foreground">Best for</p>
                  <p className="mt-1">{selectedPackage.bestFor}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Included</p>
                  <ul className="mt-2 space-y-2">
                    {selectedPackage.deliverables.map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="premium-card border-cyan-500/20">
              <CardHeader>
                <CardTitle>Live launch preview</CardTitle>
                <CardDescription>
                  This updates as you fill out the form so you can see the direction before you submit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="grid gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium text-foreground">Business</p>
                    <p className="mt-1">{previewBusinessName}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium text-foreground">Industry</p>
                    <p className="mt-1">{previewIndustry}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium text-foreground">Current setup</p>
                    <p className="mt-1">{previewSystem}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
                  <p className="font-medium text-foreground">First setup queue</p>
                  <ul className="mt-3 space-y-2">
                    {setupPreview.map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {selectedTemplate ? (
                  <div className="rounded-xl border p-4">
                    <p className="font-medium text-foreground">Template ready for {selectedTemplate.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Recommended package:{" "}
                      {getAutomationPackage(selectedTemplate.aiAssistant.recommendedPackage)?.title ||
                        selectedTemplate.aiAssistant.recommendedPackage}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="premium-card">
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>1. We review your website and how visitors currently become leads.</p>
                <p>2. We prepare the first recommendations for setup and any website fixes that matter most.</p>
                <p>3. If you want to move forward, we confirm scope, timing, and the best package.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

function AIAssistantStaticFallback() {
  return (
    <main className="premium-page">
      <section className="px-4 pb-16 pt-24">
        <div className="container mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">
              Lead capture and booking systems
            </Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
              AI receptionist, booking, and website improvements for service businesses.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              VestBlock helps businesses capture more of the demand they already have with
              clearer intake, booking handoff, and website lead-flow improvements.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <a href="#request-setup">
                  Request Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">Compare Pricing</Link>
              </Button>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>What this fixes</CardTitle>
              <CardDescription>
                For teams losing inquiries to missed calls, weak forms, slow replies, or unclear booking steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>AI receptionist setup for common questions, lead capture, and handoff.</p>
              <p>Appointment booking logic when visitors are ready for a real conversation.</p>
              <p>Website upgrade direction around mobile clarity, CTAs, and form flow.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="request-setup" className="px-4 py-16">
        <div className="container mx-auto max-w-4xl">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>Request your setup</CardTitle>
              <CardDescription>
                Tell VestBlock what is breaking in the current lead flow and we will review the best-fit next step.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Button asChild>
                <Link href="/pricing">View Packages</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/services/vestblock-ai-assistant">Read Service Guide</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/get-started">Choose My Path</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

export default function AIAssistantPage() {
  return (
    <Suspense fallback={<AIAssistantStaticFallback />}>
      <AIAssistantContent />
    </Suspense>
  );
}
