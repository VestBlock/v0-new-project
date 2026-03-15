'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap, Crown } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export function PricingSection() {
  const router = useRouter();

  return (
    <section className="py-24 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-4 text-cyan-500 border-cyan-500"
          >
            <Star className="h-3 w-3 mr-1" />
            Limited Time Offer
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            Unlock AI Tools for Credit and Funding Readiness
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            VestBlock Pro gives you access to AI-powered dispute tools, financial insights, and strategies designed to help you improve your credit profile and prepare for funding opportunities.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="relative overflow-hidden border-2 border-gradient-to-r from-cyan-500 to-blue-500 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
            <CardHeader className="text-center pb-8 pt-8">
              <div className="flex items-center justify-center mb-4">
                <Crown className="h-8 w-8 text-yellow-500 mr-2" />
                <Badge
                  variant="secondary"
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-1"
                >
                  LIFETIME ACCESS
                </Badge>
              </div>
              <CardTitle className="text-3xl md:text-4xl font-bold mb-2">
                VestBlock Pro
              </CardTitle>
              <CardDescription className="text-lg">
                Everything you need to repair your credit and build wealth
              </CardDescription>
              <div className="mt-6">
                <div className="flex items-center justify-center">
                  <span className="text-5xl md:text-6xl font-bold gradient-text">
                    $75
                  </span>
                  <div className="ml-3 text-left">
                    <div className="text-sm text-muted-foreground line-through">
                      $297
                    </div>
                    <div className="text-sm font-medium text-green-600">
                      One-time payment
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  No monthly fees • No hidden costs
                </p>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-8">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="font-semibold mb-4 flex items-center">
                    <Zap className="h-5 w-5 text-cyan-500 mr-2" />
                    AI Credit Repair Tools
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        AI-powered credit report analysis
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Automated dispute letter generation
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Personalized credit improvement roadmap
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Real-time credit monitoring alerts
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 flex items-center">
                    <Zap className="h-5 w-5 text-cyan-500 mr-2" />
                    Wealth Building Features
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Business credit building strategies
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        50+ side hustle opportunities
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        Funding and investment guidance
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        24/7 AI financial advisor chat
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="text-center">
                <Button
                  asChild
                  size="lg"
                  className="cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-12 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => router.push('/login')}
                >
                  <a>Get Instant Access Now</a>
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Secure payment via PayPal • Instant access after payment •
                  30-day money-back guarantee
                </p>
              </div>

              <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="text-sm font-medium">What's Included:</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-center">
                  <div>✓ Credit Analysis</div>
                  <div>✓ Dispute Letters</div>
                  <div>✓ AI Chat Support</div>
                  <div>✓ Business Credit</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Join thousands of users who have improved their credit scores by an
            average of 127 points
          </p>
        </div>
      </div>
    </section>
  );
}
