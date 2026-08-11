import type { ReactNode } from 'react';

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#090a08] text-[#f3efe6]">
      <header className="border-b border-white/10">
        <div className="vb-container py-14 sm:py-20">
          <p className="vb-eyebrow">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">{title}</h1>
          <p className="mt-5 text-sm text-[#8f9189]">Implementation updated {updated}. Counsel review required before final legal sign-off.</p>
        </div>
      </header>
      <article className="vb-container legal-copy py-12 sm:py-16">{children}</article>
    </div>
  );
}
