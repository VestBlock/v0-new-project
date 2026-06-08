import type { FaqItem } from '@/lib/seo/faqContent';

/**
 * Visible, answer-ready FAQ block. The content here is the human-readable
 * counterpart to the FAQPage JSON-LD (faqPageJsonLd) — both render from the
 * same FaqItem[] source so structured data always matches on-page content.
 *
 * Server component (no client JS): uses native <details>/<summary> for an
 * accessible, no-JavaScript expand/collapse that AI crawlers read fully.
 */
export function FaqSection({
  items,
  title = 'Frequently asked questions',
  eyebrow = 'Answers',
  className = '',
}: {
  items: FaqItem[];
  title?: string;
  eyebrow?: string;
  className?: string;
}) {
  if (!items?.length) return null;

  return (
    <section className={`px-4 py-16 ${className}`} aria-labelledby="faq-heading">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">{eyebrow}</p>
          <h2 id="faq-heading" className="mt-3 text-3xl font-semibold text-white md:text-4xl">
            {title}
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl transition-colors duration-200 hover:border-cyan-300/30 open:border-cyan-300/30"
              {...(index === 0 ? { open: true } : {})}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-medium text-white [&::-webkit-details-marker]:hidden">
                {item.question}
                <span className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-cyan-200 transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
