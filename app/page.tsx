import { HeroSection } from '@/components/hero-section';
import { ServiceCards } from '@/components/service-cards';
import { HowItWorks } from '@/components/how-it-works';
import { MetricsSection } from '@/components/metrics-section';
import { BusinessTypesGrid } from '@/components/business-types-grid';
import { CreditToolsSection } from '@/components/credit-tools-section';
import { PropertyCTASection } from '@/components/property-cta-section';
import { CTAFooter } from '@/components/cta-footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background circuit-bg">
      <main>
        <HeroSection />
        <ServiceCards />
        <HowItWorks />
        <MetricsSection />
        <BusinessTypesGrid />
        <CreditToolsSection />
        <PropertyCTASection />
        <CTAFooter />
      </main>
    </div>
  );
}
