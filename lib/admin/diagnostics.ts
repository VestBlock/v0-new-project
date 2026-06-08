export type AdminDiagnosticLink = {
  title: string;
  description: string;
  href: string;
  category: 'auth' | 'credit' | 'documents' | 'system';
};

export const adminDiagnosticSections: Array<{
  id: AdminDiagnosticLink['category'];
  title: string;
  description: string;
  links: AdminDiagnosticLink[];
}> = [
  {
    id: 'auth',
    title: 'Auth and access',
    description:
      'Use these when login redirects, Supabase sessions, admin detection, or access rules are behaving unexpectedly.',
    links: [
      {
        title: 'Auth debug',
        description: 'Inspect session state, user data, and browser auth behavior.',
        href: '/auth-debug',
        category: 'auth',
      },
      {
        title: 'Admin API test',
        description: 'Run the internal OpenAI connectivity check from a protected admin route.',
        href: '/admin/test',
        category: 'auth',
      },
    ],
  },
  {
    id: 'credit',
    title: 'Credit workflow QA',
    description:
      'Operator-facing tools for checking upload, analysis, OCR, roadmap, and results behavior without touching the main customer funnel.',
    links: [
      {
        title: 'Credit report diagnostic',
        description: 'Review document analysis and connection behavior for problematic reports.',
        href: '/credit-report-diagnostic',
        category: 'credit',
      },
    ],
  },
  {
    id: 'system',
    title: 'System and environment',
    description:
      'Internal environment checks for database setup, streaming behavior, and service connectivity. These stay operator-only and should never be public-facing.',
    links: [
      {
        title: 'Database diagnostic',
        description: 'Check table availability, access, and connection health.',
        href: '/database-diagnostic',
        category: 'system',
      },
      {
        title: 'Setup database',
        description: 'Run the protected database setup helper for internal repair work.',
        href: '/setup-database',
        category: 'system',
      },
    ],
  },
];
