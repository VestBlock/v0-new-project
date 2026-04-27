export type FundingReadinessPillar = {
  id: string;
  title: string;
  summary: string;
  checks: string[];
};

export const fundingReadinessPillars: FundingReadinessPillar[] = [
  {
    id: 'entity',
    title: 'Business entity and identity',
    summary:
      'Create a consistent business profile lenders and grant reviewers can verify.',
    checks: [
      'Entity formed or status confirmed with the state.',
      'EIN issued and business name matches IRS/state records.',
      'Business address, phone, email, website, and listings are consistent.',
    ],
  },
  {
    id: 'banking',
    title: 'Banking and bookkeeping',
    summary:
      'Separate business activity from personal activity and make cash flow easy to review.',
    checks: [
      'Business bank account opened in the legal business name.',
      'Revenue, deposits, expenses, and owner draws are organized.',
      'Recent bank statements can explain average balances and cash flow.',
    ],
  },
  {
    id: 'licenses',
    title: 'Licenses, compliance, and documents',
    summary:
      'Gather the records that reduce avoidable delays in funding or grant applications.',
    checks: [
      'Local licenses, permits, registrations, or certificates are identified.',
      'Operating agreement, articles, ownership details, and tax records are stored.',
      'Insurance, lease, contracts, or invoices are available when relevant.',
    ],
  },
  {
    id: 'credit',
    title: 'Credit and funding readiness',
    summary:
      'Review owner credit, business credit, and lender-fit before submitting applications.',
    checks: [
      'Personal credit issues are reviewed before applying for owner-backed products.',
      'Business credit profile is checked for identity consistency and tradelines.',
      'Funding product matches business stage, revenue, use of funds, and repayment ability.',
    ],
  },
  {
    id: 'grants',
    title: 'Grant profile and use of funds',
    summary:
      'Prepare a clear business story before chasing grant opportunities.',
    checks: [
      'Business summary explains who you serve, what you sell, and why the funds matter.',
      'Ownership attributes, location, industry, and community impact are documented.',
      'Use-of-funds statement is specific, realistic, and tied to eligibility.',
    ],
  },
];

export const spanishFundingReadinessPillars: FundingReadinessPillar[] = [
  {
    id: 'entidad',
    title: 'Entidad e identidad del negocio',
    summary:
      'Organiza el perfil legal del negocio para que bancos, prestamistas y programas puedan verificarlo.',
    checks: [
      'Entidad registrada o estructura de negocio confirmada.',
      'EIN obtenido y nombre del negocio consistente en documentos oficiales.',
      'Direccion, telefono, correo, sitio web y listados del negocio coinciden.',
    ],
  },
  {
    id: 'banco',
    title: 'Cuenta bancaria y flujo de dinero',
    summary:
      'Separa las finanzas del negocio y muestra ingresos de forma clara.',
    checks: [
      'Cuenta bancaria comercial abierta a nombre del negocio.',
      'Depositos, gastos, facturas y retiros del dueno organizados.',
      'Estados bancarios recientes listos para revisar ingresos y balances.',
    ],
  },
  {
    id: 'documentos',
    title: 'Documentos y cumplimiento',
    summary:
      'Prepara los documentos que suelen pedir para financiamiento y subvenciones.',
    checks: [
      'Licencias, permisos o registros locales identificados.',
      'Articulos, acuerdo operativo, datos de propietarios e impuestos guardados.',
      'Seguro, contrato de renta, facturas o contratos disponibles si aplican.',
    ],
  },
  {
    id: 'credito',
    title: 'Credito y preparacion para financiamiento',
    summary:
      'Revisa credito personal, credito comercial y el tipo de financiamiento adecuado.',
    checks: [
      'Credito personal revisado antes de productos que usan garantia personal.',
      'Perfil de credito comercial revisado para consistencia y cuentas reportadas.',
      'Uso de fondos y capacidad de pago claros antes de aplicar.',
    ],
  },
];

export const businessSetupServiceSteps = [
  'Form or organize the business entity and identity profile.',
  'Set up banking, bookkeeping categories, and document storage.',
  'Build a lender/grant document checklist for the owner.',
  'Map business credit, grant, and funding next steps by readiness stage.',
];

export const bankBreezySpanishFundingUrl =
  'https://Bankbreezy.com/es/Vestblock';
