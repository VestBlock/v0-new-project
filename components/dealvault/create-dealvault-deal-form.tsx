"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { calculateSplitAmount, calculateTotalBps } from "@/lib/dealvault/dealCalculations";
import { dealVaultTemplates, getDealVaultTemplate, type DealVaultTemplateField } from "@/lib/dealvault/dealTemplates";
import type { DealVaultDealType } from "@/lib/dealvault/types";

type DealFormValues = {
  title: string;
  externalRef: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  sellerName: string;
  buyerName: string;
  leadOwner: string;
  dispoPartner: string;
  buyerFinder: string;
  contractorName: string;
  investorName: string;
  titleCompany: string;
  closingDate: string;
  contractPrice: string;
  buyerPrice: string;
  assignmentFee: string;
  earnestMoney: string;
  purchasePrice: string;
  downPayment: string;
  principalBalance: string;
  interestRate: string;
  monthlyPayment: string;
  termMonths: string;
  balloonDate: string;
  firstPaymentDate: string;
  optionFee: string;
  monthlyRent: string;
  rentCredit: string;
  optionExpiration: string;
  referralSource: string;
  expectedFee: string;
  referralPercentage: string;
  totalProjectBudget: string;
  scopeSummary: string;
};

type SplitDraft = {
  participantName: string;
  participantEmail: string;
  participantRole: string;
  participantWallet: string;
  bps: string;
};

type MilestoneDraft = {
  title: string;
  description: string;
  amount: string;
  dueDate: string;
};

const initialValues: DealFormValues = {
  title: "",
  externalRef: "",
  propertyAddress: "",
  propertyCity: "",
  propertyState: "",
  propertyZip: "",
  sellerName: "",
  buyerName: "",
  leadOwner: "",
  dispoPartner: "",
  buyerFinder: "",
  contractorName: "",
  investorName: "",
  titleCompany: "",
  closingDate: "",
  contractPrice: "",
  buyerPrice: "",
  assignmentFee: "",
  earnestMoney: "",
  purchasePrice: "",
  downPayment: "",
  principalBalance: "",
  interestRate: "",
  monthlyPayment: "",
  termMonths: "",
  balloonDate: "",
  firstPaymentDate: "",
  optionFee: "",
  monthlyRent: "",
  rentCredit: "",
  optionExpiration: "",
  referralSource: "",
  expectedFee: "",
  referralPercentage: "",
  totalProjectBudget: "",
  scopeSummary: "",
};

const emptySplit = (): SplitDraft => ({
  participantName: "",
  participantEmail: "",
  participantRole: "",
  participantWallet: "",
  bps: "",
});

const emptyMilestone = (): MilestoneDraft => ({
  title: "",
  description: "",
  amount: "",
  dueDate: "",
});

const fieldConfig: Record<
  Exclude<DealVaultTemplateField, "upload_agreement" | "deal_status">,
  {
    key: keyof DealFormValues;
    label: string;
    type?: "text" | "number" | "date";
    step?: string;
    placeholder?: string;
    help?: string;
  }
> = {
  property_address: {
    key: "propertyAddress",
    label: "Property address",
    placeholder: "123 Main St",
  },
  property_city: {
    key: "propertyCity",
    label: "City",
    placeholder: "Dallas",
  },
  property_state: {
    key: "propertyState",
    label: "State",
    placeholder: "TX",
  },
  property_zip: {
    key: "propertyZip",
    label: "ZIP code",
    placeholder: "75001",
  },
  seller_name: { key: "sellerName", label: "Seller name" },
  buyer_name: { key: "buyerName", label: "Buyer name" },
  lead_owner: { key: "leadOwner", label: "Lead owner" },
  dispo_partner: { key: "dispoPartner", label: "Dispo partner" },
  buyer_finder: { key: "buyerFinder", label: "Buyer finder" },
  contractor_name: { key: "contractorName", label: "Contractor name" },
  investor_name: { key: "investorName", label: "Investor or client name" },
  title_company: { key: "titleCompany", label: "Title company" },
  closing_date: { key: "closingDate", label: "Closing date", type: "date" },
  contract_price: { key: "contractPrice", label: "Contract price", type: "number", step: "0.01" },
  buyer_price: { key: "buyerPrice", label: "Buyer price", type: "number", step: "0.01" },
  assignment_fee: { key: "assignmentFee", label: "Assignment fee", type: "number", step: "0.01" },
  earnest_money: { key: "earnestMoney", label: "Earnest money", type: "number", step: "0.01" },
  purchase_price: { key: "purchasePrice", label: "Purchase price", type: "number", step: "0.01" },
  down_payment: { key: "downPayment", label: "Down payment", type: "number", step: "0.01" },
  principal_balance: {
    key: "principalBalance",
    label: "Principal balance",
    type: "number",
    step: "0.01",
  },
  interest_rate: { key: "interestRate", label: "Interest rate", type: "number", step: "0.01" },
  monthly_payment: { key: "monthlyPayment", label: "Monthly payment", type: "number", step: "0.01" },
  term_months: { key: "termMonths", label: "Term (months)", type: "number", step: "1" },
  balloon_date: { key: "balloonDate", label: "Balloon date", type: "date" },
  first_payment_date: { key: "firstPaymentDate", label: "First payment date", type: "date" },
  option_fee: { key: "optionFee", label: "Option fee", type: "number", step: "0.01" },
  monthly_rent: { key: "monthlyRent", label: "Monthly rent", type: "number", step: "0.01" },
  rent_credit: { key: "rentCredit", label: "Rent credit", type: "number", step: "0.01" },
  option_expiration: { key: "optionExpiration", label: "Option expiration", type: "date" },
  referral_source: { key: "referralSource", label: "Referral source" },
  expected_fee: { key: "expectedFee", label: "Expected fee", type: "number", step: "0.01" },
  referral_percentage: {
    key: "referralPercentage",
    label: "Referral percentage",
    type: "number",
    step: "0.01",
  },
  total_project_budget: {
    key: "totalProjectBudget",
    label: "Total project budget",
    type: "number",
    step: "0.01",
  },
  scope_summary: {
    key: "scopeSummary",
    label: "Scope summary",
    help: "Summarize the rehab scope, deliverables, or special deal notes.",
  },
};

function parseNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function CreateDealVaultDealForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [dealType, setDealType] = useState<DealVaultDealType>(
    (dealVaultTemplates[0]?.id as DealVaultDealType | undefined) ?? "wholesale_assignment"
  );
  const [values, setValues] = useState<DealFormValues>(initialValues);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(() => getDealVaultTemplate(dealType), [dealType]);
  const totalBps = useMemo(
    () => calculateTotalBps(splits.map((split) => ({ bps: Number(split.bps) || 0 }))),
    [splits]
  );
  const payoutBaseAmount = useMemo(() => {
    return (
      parseNumber(values.expectedFee) ??
      parseNumber(values.assignmentFee) ??
      parseNumber(values.buyerPrice) ??
      parseNumber(values.totalProjectBudget) ??
      0
    );
  }, [values.assignmentFee, values.buyerPrice, values.expectedFee, values.totalProjectBudget]);

  function updateValue<K extends keyof DealFormValues>(key: K, value: DealFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function fieldIsRequired(field: DealVaultTemplateField) {
    return template?.requiredFields.includes(field) ?? false;
  }

  function renderField(field: DealVaultTemplateField) {
    if (field === "upload_agreement") {
      return (
        <div key={field} className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Agreement upload is handled in the next step through proof records. Create the deal first,
          then attach the signed agreement from the deal detail page.
        </div>
      );
    }

    if (field === "deal_status") {
      return (
        <div key={field} className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          New deals start in <strong>draft</strong>. You can move them to active, under contract,
          locked, or closed from the detail page after creation.
        </div>
      );
    }

    if (field === "property_address") {
      return (
        <div key={field} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="property-address">
              Property address {fieldIsRequired("property_address") ? "*" : null}
            </Label>
            <Input
              id="property-address"
              value={values.propertyAddress}
              onChange={(event) => updateValue("propertyAddress", event.target.value)}
              placeholder={fieldConfig.property_address.placeholder}
              required={fieldIsRequired("property_address")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-city">City</Label>
            <Input
              id="property-city"
              value={values.propertyCity}
              onChange={(event) => updateValue("propertyCity", event.target.value)}
              placeholder={fieldConfig.property_city.placeholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-state">State</Label>
            <Input
              id="property-state"
              value={values.propertyState}
              onChange={(event) => updateValue("propertyState", event.target.value)}
              placeholder={fieldConfig.property_state.placeholder}
            />
          </div>
          <div className="space-y-2 md:max-w-xs">
            <Label htmlFor="property-zip">ZIP code</Label>
            <Input
              id="property-zip"
              value={values.propertyZip}
              onChange={(event) => updateValue("propertyZip", event.target.value)}
              placeholder={fieldConfig.property_zip.placeholder}
            />
          </div>
        </div>
      );
    }

    const config = fieldConfig[field];
    const value = values[config.key];
    const isLongText = field === "scope_summary";
    const inputId = `field-${field}`;

    return (
      <div key={field} className="space-y-2">
        <Label htmlFor={inputId}>
          {config.label} {fieldIsRequired(field) ? "*" : null}
        </Label>
        {isLongText ? (
          <Textarea
            id={inputId}
            value={value}
            onChange={(event) => updateValue(config.key, event.target.value)}
            required={fieldIsRequired(field)}
          />
        ) : (
          <Input
            id={inputId}
            type={config.type || "text"}
            step={config.step}
            value={value}
            onChange={(event) => updateValue(config.key, event.target.value)}
            placeholder={config.placeholder}
            required={fieldIsRequired(field)}
          />
        )}
        {config.help ? <p className="text-xs text-muted-foreground">{config.help}</p> : null}
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!template) {
        throw new Error("Choose a valid deal template.");
      }

      if (template.supportsPayoutSplits && totalBps > 10000) {
        throw new Error("Payout splits cannot exceed 10000 bps (100%).");
      }

      const cleanSplits = splits
        .filter((split) => split.participantName.trim() && split.bps.trim())
        .map((split) => {
          const bps = Number(split.bps);
          const amount = payoutBaseAmount ? calculateSplitAmount(payoutBaseAmount, bps) : undefined;
          return {
            participantName: split.participantName.trim(),
            participantEmail: split.participantEmail.trim() || undefined,
            participantRole: split.participantRole.trim() || undefined,
            participantWallet: split.participantWallet.trim() || undefined,
            bps,
            amountOwed: amount,
          };
        });

      const cleanMilestones = milestones
        .filter((milestone) => milestone.title.trim())
        .map((milestone) => ({
          title: milestone.title.trim(),
          description: milestone.description.trim() || undefined,
          amount: parseNumber(milestone.amount),
          dueDate: milestone.dueDate || undefined,
        }));

      const response = await fetch("/api/dealvault/create-deal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealType,
          title: values.title.trim(),
          externalRef: values.externalRef.trim() || undefined,
          propertyAddress: values.propertyAddress.trim() || undefined,
          propertyCity: values.propertyCity.trim() || undefined,
          propertyState: values.propertyState.trim() || undefined,
          propertyZip: values.propertyZip.trim() || undefined,
          sellerName: values.sellerName.trim() || undefined,
          buyerName: values.buyerName.trim() || undefined,
          leadOwner: values.leadOwner.trim() || undefined,
          dispoPartner: values.dispoPartner.trim() || undefined,
          buyerFinder: values.buyerFinder.trim() || undefined,
          contractorName: values.contractorName.trim() || undefined,
          investorName: values.investorName.trim() || undefined,
          titleCompany: values.titleCompany.trim() || undefined,
          closingDate: values.closingDate || undefined,
          contractPrice: parseNumber(values.contractPrice),
          buyerPrice: parseNumber(values.buyerPrice),
          assignmentFee: parseNumber(values.assignmentFee),
          earnestMoney: parseNumber(values.earnestMoney),
          purchasePrice: parseNumber(values.purchasePrice),
          downPayment: parseNumber(values.downPayment),
          principalBalance: parseNumber(values.principalBalance),
          interestRate: parseNumber(values.interestRate),
          monthlyPayment: parseNumber(values.monthlyPayment),
          termMonths: parseInteger(values.termMonths),
          balloonDate: values.balloonDate || undefined,
          firstPaymentDate: values.firstPaymentDate || undefined,
          optionFee: parseNumber(values.optionFee),
          monthlyRent: parseNumber(values.monthlyRent),
          rentCredit: parseNumber(values.rentCredit),
          optionExpiration: values.optionExpiration || undefined,
          referralSource: values.referralSource.trim() || undefined,
          expectedFee: parseNumber(values.expectedFee),
          referralPercentage: parseNumber(values.referralPercentage),
          totalProjectBudget: parseNumber(values.totalProjectBudget),
          scopeSummary: values.scopeSummary.trim() || undefined,
          splits: cleanSplits,
          milestones: cleanMilestones,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to create DealVault deal.");
      }

      toast({
        title: "Deal created",
        description:
          json.warnings?.[0] ||
          (json.mode === "anchoring_attempted"
            ? "Deal saved and blockchain anchoring was requested."
            : "Deal saved in DealVault."),
      });

      router.push(`/dashboard/dealvault/${json.deal.id}`);
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unknown error";
      setError(message);
      toast({
        title: "Deal creation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create DealVault deal</CardTitle>
        <CardDescription>
          This flow now captures template-specific terms, optional payout splits, and milestone
          drafts so a new deal can exercise the real DealVault storage and chain wiring.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deal-type">Deal template</Label>
              <select
                id="deal-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dealType}
                onChange={(event) => setDealType(event.target.value as DealVaultDealType)}
              >
                {dealVaultTemplates.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-ref">External reference</Label>
              <Input
                id="external-ref"
                value={values.externalRef}
                onChange={(event) => updateValue("externalRef", event.target.value)}
                placeholder="Optional CRM, closing, or team reference"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-title">Deal title *</Label>
            <Input
              id="deal-title"
              value={values.title}
              onChange={(event) => updateValue("title", event.target.value)}
              placeholder="123 Main St Wholesale Assignment"
              required
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="font-medium">{template?.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{template?.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {template?.fields.map((field) => renderField(field))}
          </div>

          {template?.supportsPayoutSplits ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">Payout splits</h3>
                <p className="text-sm text-muted-foreground">
                  Add optional referral or JV participants. Total basis points must stay at or below
                  10000.
                </p>
                <p className="text-xs text-muted-foreground">
                  Current total: {totalBps} bps {totalBps > 10000 ? "(over limit)" : null}
                </p>
              </div>

              {splits.map((split, index) => {
                const splitBps = Number(split.bps) || 0;
                const preview = payoutBaseAmount && splitBps ? calculateSplitAmount(payoutBaseAmount, splitBps) : null;
                const participantNameId = `split-${index}-participant-name`;
                const participantEmailId = `split-${index}-participant-email`;
                const participantRoleId = `split-${index}-participant-role`;
                const participantWalletId = `split-${index}-participant-wallet`;
                const participantBpsId = `split-${index}-participant-bps`;
                return (
                  <div key={`split-${index}`} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={participantNameId}>Participant name</Label>
                      <Input
                        id={participantNameId}
                        value={split.participantName}
                        onChange={(event) =>
                          setSplits((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, participantName: event.target.value } : item
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={participantEmailId}>Participant email</Label>
                      <Input
                        id={participantEmailId}
                        type="email"
                        value={split.participantEmail}
                        onChange={(event) =>
                          setSplits((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, participantEmail: event.target.value } : item
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={participantRoleId}>Role</Label>
                      <Input
                        id={participantRoleId}
                        value={split.participantRole}
                        onChange={(event) =>
                          setSplits((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, participantRole: event.target.value } : item
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={participantWalletId}>Wallet address</Label>
                      <Input
                        id={participantWalletId}
                        value={split.participantWallet}
                        onChange={(event) =>
                          setSplits((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, participantWallet: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Optional 0x... address for chain split sync"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={participantBpsId}>Basis points</Label>
                      <Input
                        id={participantBpsId}
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={split.bps}
                        onChange={(event) =>
                          setSplits((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, bps: event.target.value } : item
                            )
                          )
                        }
                      />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        Preview amount: {preview !== null ? `$${preview.toFixed(2)}` : "Add fee and bps"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSplits((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={() => setSplits((current) => [...current, emptySplit()])}
              >
                Add payout split
              </Button>
            </div>
          ) : null}

          {template?.supportsMilestones ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">Milestone drafts</h3>
                <p className="text-sm text-muted-foreground">
                  Seed the rehab milestones now so the deal can create its project and initial
                  milestone records in one pass.
                </p>
              </div>

              {milestones.map((milestone, index) => (
                <div key={`milestone-${index}`} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                  {(() => {
                    const milestoneTitleId = `milestone-${index}-title`;
                    const milestoneDescriptionId = `milestone-${index}-description`;
                    const milestoneAmountId = `milestone-${index}-amount`;
                    const milestoneDueDateId = `milestone-${index}-due-date`;

                    return (
                      <>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={milestoneTitleId}>Milestone title</Label>
                    <Input
                      id={milestoneTitleId}
                      value={milestone.title}
                      onChange={(event) =>
                        setMilestones((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={milestoneDescriptionId}>Description</Label>
                    <Textarea
                      id={milestoneDescriptionId}
                      value={milestone.description}
                      onChange={(event) =>
                        setMilestones((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={milestoneAmountId}>Amount</Label>
                    <Input
                      id={milestoneAmountId}
                      type="number"
                      min="0"
                      step="0.01"
                      value={milestone.amount}
                      onChange={(event) =>
                        setMilestones((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, amount: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={milestoneDueDateId}>Due date</Label>
                    <Input
                      id={milestoneDueDateId}
                      type="date"
                      value={milestone.dueDate}
                      onChange={(event) =>
                        setMilestones((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, dueDate: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setMilestones((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      Remove milestone
                    </Button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => setMilestones((current) => [...current, emptyMilestone()])}
              >
                Add milestone
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create deal"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Deal creation stores the record in VestBlock first, then requests blockchain anchoring
              when contracts are configured.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
