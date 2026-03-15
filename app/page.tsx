import { AITools } from '@/components/ai-tools';
import { CTAFooter } from '@/components/cta-footer';
import { HeroSection } from '@/components/hero-section';
import { HowItWorks } from '@/components/how-it-works';
import { PricingSection } from '@/components/pricing-section';
import { TestimonialsSection } from '@/components/testimonials-section';
import { PropertyCTASection } from '@/components/property-cta-section';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background circuit-bg">
      <main>
        <HeroSection />
        <HowItWorks />
        <AITools />
        <PricingSection />
        <TestimonialsSection />
        <PropertyCTASection />
        <CTAFooter />
      </main>
    </div>
  );
}
