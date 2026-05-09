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
        title: 'Credit report debug',
        description: 'Inspect upload payloads, extracted fields, and report-specific debugging data.',
        href: '/credit-report-debug',
        category: 'credit',
      },
      {
        title: 'Credit report diagnostic',
        description: 'Review document analysis and connection behavior for problematic reports.',
        href: '/credit-report-diagnostic',
        category: 'credit',
      },
      {
        title: 'Debug analyzer',
        description: 'Deep dive into the report analyzer flow and internal debug output.',
        href: '/debug-analyzer',
        category: 'credit',
      },
      {
        title: 'Analysis QA',
        description: 'Exercise the analysis workflow and inspect logs across the processing path.',
        href: '/test-analysis-debug',
        category: 'credit',
      },
    ],
  },
  {
    id: 'documents',
    title: 'Upload and document tests',
    description:
      'Use these when file parsing, document payloads, or extraction behavior need focused QA outside the normal customer dashboard.',
    links: [
      {
        title: 'Document analysis test',
        description: 'Test document analysis behavior against controlled sample flows.',
        href: '/test-document-analysis',
        category: 'documents',
      },
      {
        title: 'Upload test',
        description: 'Check the standard FormData upload path and payload handling.',
        href: '/test-upload',
        category: 'documents',
      },
      {
        title: 'Simple upload test',
        description: 'Run a reduced upload flow to isolate parsing or request issues.',
        href: '/test-upload-simple',
        category: 'documents',
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
      {
        title: 'OpenAI simple test',
        description: 'Verify the simplified model call path for connectivity troubleshooting.',
        href: '/test-openai-simple',
        category: 'system',
      },
      {
        title: 'Streaming test',
        description: 'Confirm streaming responses and environment wiring during QA.',
        href: '/test-streaming',
        category: 'system',
      },
    ],
  },
];
