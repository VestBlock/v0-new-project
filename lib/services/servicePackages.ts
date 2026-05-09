import {
  automationPackages,
  type AutomationPackageKey,
} from '@/lib/services/automationPackages';
import {
  financialSkillsetPackages,
  type FinancialSkillsetPackageKey,
} from '@/lib/services/financialSkillsets';
import {
  visibilityExpansionPackages,
  type VisibilityExpansionPackageKey,
} from '@/lib/services/visibilityExpansionPackages';

export type ServicePackageKey =
  | FinancialSkillsetPackageKey
  | AutomationPackageKey
  | VisibilityExpansionPackageKey;

export type ServicePackageKind =
  | 'financial_growth'
  | 'growth_automation'
  | 'visibility_expansion';

export type ServicePackageDescriptor = {
  key: ServicePackageKey;
  title: string;
  priceLabel: string;
  summary: string;
  bestFor: string;
  deliverables: string[];
  complianceNote: string;
  kind: ServicePackageKind;
};

export const servicePackageDescriptors: ServicePackageDescriptor[] = [
  ...financialSkillsetPackages.map((pkg) => ({
    key: pkg.key,
    title: pkg.title,
    priceLabel: pkg.price,
    summary: pkg.summary,
    bestFor: pkg.bestFor,
    deliverables: pkg.deliverables,
    complianceNote: pkg.complianceNote,
    kind: 'financial_growth' as const,
  })),
  ...automationPackages.map((pkg) => ({
    key: pkg.key,
    title: pkg.title,
    priceLabel: pkg.priceLabel,
    summary: pkg.summary,
    bestFor: pkg.bestFor,
    deliverables: pkg.deliverables,
    complianceNote: pkg.complianceNote,
    kind: 'growth_automation' as const,
  })),
  ...visibilityExpansionPackages.map((pkg) => ({
    key: pkg.key,
    title: pkg.title,
    priceLabel: pkg.priceLabel,
    summary: pkg.summary,
    bestFor: pkg.bestFor,
    deliverables: pkg.deliverables,
    complianceNote: pkg.complianceNote,
    kind: 'visibility_expansion' as const,
  })),
];

export function getServicePackageDescriptor(
  key: string
): ServicePackageDescriptor | undefined {
  return servicePackageDescriptors.find((pkg) => pkg.key === key);
}

export function isServicePackageKey(key: string): key is ServicePackageKey {
  return servicePackageDescriptors.some((pkg) => pkg.key === key);
}
