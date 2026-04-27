'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  Bot,
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  Home,
  Landmark,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getFeaturedServiceDirectoryItems } from '@/lib/services/serviceDirectory';

const iconByService: Record<string, typeof CreditCard> = {
  credit_analysis: CreditCard,
  business_funding: Briefcase,
  business_setup: BadgeCheck,
  financial_growth_services: BadgeDollarSign,
  grants: FileText,
  spanish_funding: Landmark,
  real_estate_funding: Building2,
  sell_property: Home,
  ai_assistant: Bot,
};

const stageLabel = {
  free_check: 'Free first step',
  paid_plan: 'Paid plan',
  lead_followup: 'Lead follow-up',
  member_tool: 'Member tool',
};

export function ServiceCards() {
  const services = getFeaturedServiceDirectoryItems(6);

  return (
    <section className="px-4 py-20">
      <div className="container mx-auto">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Choose The Right VestBlock Service
          </h2>
          <p className="text-xl text-muted-foreground">
            Start with the path that matches your goal: credit repair, business
            funding, business setup, grants, Spanish funding, or real estate.
          </p>
        </div>

        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service, index) => {
            const Icon = iconByService[service.key] ?? Landmark;
            const isPrimary =
              service.key === 'business_funding' || service.key === 'credit_analysis';

            return (
              <motion.div
                key={service.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                viewport={{ once: true }}
              >
                <Card
                  className={`flex h-full flex-col border-2 bg-card/80 backdrop-blur transition-colors hover:border-cyan-500/50 ${
                    isPrimary ? 'border-cyan-500/30' : 'border-transparent'
                  }`}
                >
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-md ${
                          isPrimary ? 'bg-cyan-500/20 text-cyan-600' : 'bg-muted'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline">{stageLabel[service.serviceStage]}</Badge>
                    </div>
                    <CardTitle className="text-xl">{service.shortTitle}</CardTitle>
                    <CardDescription className="text-base">
                      {service.summary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium">Best for</p>
                        <p className="text-muted-foreground">{service.bestFor}</p>
                      </div>
                      <div>
                        <p className="font-medium">Pricing path</p>
                        <p className="text-muted-foreground">{service.priceNote}</p>
                      </div>
                    </div>
                    <Button
                      className={
                        isPrimary ? 'mt-auto bg-cyan-500 hover:bg-cyan-600' : 'mt-auto'
                      }
                      variant={isPrimary ? 'default' : 'outline'}
                      asChild
                    >
                      <Link href={service.route}>
                        {service.primaryCta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost">
            <Link href="/services">
              Compare all VestBlock services
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
