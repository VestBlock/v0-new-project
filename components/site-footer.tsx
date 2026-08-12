import Link from 'next/link';

const legalLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/data-rights', label: 'Data rights' },
  { href: '/security', label: 'Security' },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#090a08] text-[#aaa9a2]">
      <div className="vb-container flex flex-col gap-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-[#f3efe6]">VestBlock</p>
          <p className="mt-1">Vestblock LLC · Find your next move.</p>
        </div>
        <nav aria-label="Legal and trust" className="flex flex-wrap gap-x-5 gap-y-3">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-[#b7ff3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b7ff3c]">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
