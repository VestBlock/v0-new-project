import type { ReactNode } from 'react';
import Link from 'next/link';

export function LegalPageShell({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#090d0f] text-[#f1f3ed]">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-20 sm:px-8 lg:pt-28">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7f80b] transition-colors hover:text-white"
        >
          VestBlock LLC
        </Link>
        <header className="mt-8 max-w-3xl border-b border-white/10 pb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-white/55">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/68 sm:text-lg">{summary}</p>
          <p className="mt-5 text-sm text-white/45">Effective and last updated September 14, 2026</p>
        </header>
        <article className="mt-12 space-y-12 text-[0.98rem] leading-8 text-white/72 [&_a]:text-[#d7f80b] [&_a]:underline-offset-4 [&_a:hover]:underline [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-white [&_li]:pl-1 [&_p+p]:mt-4 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
          {children}
        </article>
      </div>
    </div>
  );
}
