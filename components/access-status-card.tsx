import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AccessProfile } from '@/lib/auth/access';
import { Crown, ShieldCheck, Sparkles } from 'lucide-react';

export function AccessStatusCard({
  access,
  title = 'Your access',
  description = 'Current product access and upgrade state inside VestBlock.',
}: {
  access: AccessProfile;
  title?: string;
  description?: string;
}) {
  const label =
    access.accessTier === 'admin'
      ? 'Admin access'
      : access.accessTier === 'paid'
        ? 'Paid access'
        : access.accessTier === 'free'
          ? 'Free access'
          : 'Guest';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {access.accessTier === 'admin' ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : access.accessTier === 'paid' ? (
            <Crown className="h-5 w-5 text-amber-500" />
          ) : (
            <Sparkles className="h-5 w-5 text-cyan-500" />
          )}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 text-sm">
        <Badge
          variant="outline"
          className={
            access.accessTier === 'admin'
              ? 'border-emerald-200 text-emerald-700'
              : access.accessTier === 'paid'
                ? 'border-amber-200 text-amber-700'
                : 'border-slate-200 text-slate-700'
          }
        >
          {label}
        </Badge>
        {access.subscriptionProduct ? (
          <span className="text-muted-foreground">
            Product: <strong className="text-foreground">{access.subscriptionProduct}</strong>
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
