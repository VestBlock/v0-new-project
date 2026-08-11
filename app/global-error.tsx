'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#090a08] text-[#f3efe6]">
        <main className="flex min-h-screen items-center justify-center px-5 py-20">
          <div className="w-full max-w-xl border border-white/10 bg-[#0d100d] p-8 sm:p-12">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#b7ff3c]">VestBlock</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">That page hit an unexpected problem.</h1>
            <p className="mt-4 leading-7 text-[#aaa9a2]">The error has been recorded when monitoring is configured. You can try the page again without resubmitting a payment.</p>
            <button
              type="button"
              onClick={reset}
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-[#b7ff3c] px-5 text-sm font-semibold text-[#11130f]"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
