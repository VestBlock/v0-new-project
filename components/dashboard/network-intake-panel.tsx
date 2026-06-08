'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Building2,
  FileCheck2,
  Home,
  Landmark,
  Loader2,
  ShieldCheck,
  Users,
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

type BuyerProfile = {
  id: string;
  name?: string | null;
  category?: string | null;
  markets_served?: string[] | null;
  relationship_stage?: string | null;
  updated_at?: string | null;
};

type LenderProfile = {
  id: string;
  name?: string | null;
  category?: string | null;
  states_served?: string[] | null;
  relationship_stage?: string | null;
  updated_at?: string | null;
};

type SellerProperty = {
  id: string;
  property_address?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type NetworkIntake = {
  buyerProfiles: BuyerProfile[];
  lenderProfiles: LenderProfile[];
  sellerProperties: SellerProperty[];
  errors?: string[];
};

type IntakeAction = {
  title: string;
  description: string;
  href: string;
  label: string;
  icon: LucideIcon;
  status: string;
  detail: string;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function compactList(values?: string[] | null) {
  const clean = (values || []).filter(Boolean);
  if (!clean.length) return 'Details saved';
  return clean.slice(0, 3).join(', ');
}

export function NetworkIntakePanel() {
  const [snapshot, setSnapshot] = useState<NetworkIntake | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadIntake() {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch('/api/dashboard/network-intake');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load network intake.');
        }

        if (isMounted) {
          setSnapshot(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load network intake.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadIntake();

    return () => {
      isMounted = false;
    };
  }, []);

  const actions = useMemo<IntakeAction[]>(() => {
    const latestSeller = snapshot?.sellerProperties?.[0];
    const latestBuyer = snapshot?.buyerProfiles?.[0];
    const latestLender = snapshot?.lenderProfiles?.[0];
    const sellerDate = formatDate(latestSeller?.created_at);
    const buyerDate = formatDate(latestBuyer?.updated_at);
    const lenderDate = formatDate(latestLender?.updated_at);

    return [
      {
        title: 'Seller property',
        description:
          'List a property for review so VestBlock can understand the address, timeline, condition, price context, and best next path.',
        href: '/sell',
        label: latestSeller ? 'Submit another property' : 'List a property',
        icon: Home,
        status: latestSeller ? 'Property submitted' : 'Not started',
        detail: latestSeller
          ? `${latestSeller.property_address || 'Saved property'}${sellerDate ? ` - ${sellerDate}` : ''}`
          : 'Use this if you are selling or reviewing a property.',
      },
      {
        title: 'Buyer buy box',
        description:
          'Share markets, asset types, price range, close speed, proof status, preferred deals, and no-go criteria.',
        href: '/buyers',
        label: latestBuyer ? 'Update buy box' : 'Share buy box',
        icon: Users,
        status: latestBuyer ? 'Buy box saved' : 'Not started',
        detail: latestBuyer
          ? `${compactList(latestBuyer.markets_served)}${buyerDate ? ` - ${buyerDate}` : ''}`
          : 'Use this if you buy, flip, hold, or acquire real estate.',
      },
      {
        title: 'Lender criteria',
        description:
          'Share lending states, loan sizes, borrower fit, asset appetite, speed, requirements, and no-go items.',
        href: '/lenders',
        label: latestLender ? 'Update criteria' : 'Set lender criteria',
        icon: Landmark,
        status: latestLender ? 'Criteria saved' : 'Not started',
        detail: latestLender
          ? `${compactList(latestLender.states_served)}${lenderDate ? ` - ${lenderDate}` : ''}`
          : 'Use this if you want real estate deal flow routed to your lending box.',
      },
      {
        title: 'Funding review',
        description:
          'Submit a real estate, business, bridge, DSCR, or operator funding scenario before applying or requesting introductions.',
        href: '/real-estate-funding',
        label: 'Review funding fit',
        icon: Building2,
        status: 'Available now',
        detail: 'For borrowers, operators, investors, and property owners.',
      },
      {
        title: 'DealVault record',
        description:
          'Create a proof-backed deal record for documents, milestones, payout splits, and partner accountability.',
        href: '/dashboard/dealvault/new',
        label: 'Create deal record',
        icon: ShieldCheck,
        status: 'Available now',
        detail: 'For deals that need proof, milestones, and payout visibility.',
      },
    ];
  }, [snapshot]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge className="mb-2 bg-cyan-600 text-white">Deal intake</Badge>
          <h3 className="text-2xl font-semibold tracking-tight">
            Tell VestBlock what you need routed.
          </h3>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Sellers, buyers, lenders, operators, and DealVault teams can start from the right intake path. These details keep follow-up and partner routing cleaner.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full md:w-auto">
          <Link href="/get-started">
            View all paths
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
            Loading your saved intake paths...
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-500/30">
          <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
            <FileCheck2 className="mt-0.5 h-4 w-4 text-amber-500" />
            <div>
              <p className="font-medium text-foreground">Intake status is temporarily unavailable.</p>
              <p className="mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Card key={action.title} className="flex h-full flex-col border-cyan-500/20">
                <CardHeader className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {action.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-4">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-cyan-600">
                      {action.status}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
                  </div>
                  <Button asChild className="w-full">
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {snapshot?.errors?.length ? (
        <p className="text-xs text-muted-foreground">
          Some saved intake details could not be loaded, but the intake links above are still available.
        </p>
      ) : null}
    </section>
  );
}
