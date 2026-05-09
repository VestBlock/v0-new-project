import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe2,
  ShieldCheck,
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
import {
  bankBreezySpanishFundingUrl,
  spanishFundingReadinessPillars,
} from '@/lib/business-readiness/fundingCompliance';
import { vestblockAeoTopics } from '@/lib/aeo/topics';

export const metadata: Metadata = {
  title: 'Financiamiento Para Negocios En Espanol | VestBlock',
  description:
    'VestBlock ayuda a duenos de negocio que hablan espanol a preparar documentos, credito comercial y pasos de financiamiento con Bank Breezy.',
  alternates: {
    canonical: '/es/vestblock',
    languages: {
      es: '/es/vestblock',
      en: '/business-setup',
    },
  },
  openGraph: {
    title: 'Financiamiento Para Negocios En Espanol | VestBlock',
    description:
      'Prepara tu negocio para financiamiento, credito comercial y subvenciones con una ruta clara y segura.',
    url: '/es/vestblock',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'VestBlock garantiza financiamiento o subvenciones?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'No. VestBlock ayuda a organizar documentos, credito, perfil del negocio y proximos pasos, pero no garantiza aprobaciones, terminos ni premios.',
      },
    },
    {
      '@type': 'Question',
      name: 'Que necesito antes de buscar financiamiento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Normalmente necesitas EIN, cuenta bancaria comercial, documentos del negocio, estados bancarios, informacion de ingresos y una razon clara para usar los fondos.',
      },
    },
    {
      '@type': 'Question',
      name: 'Bank Breezy tiene una pagina en espanol?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Si. Esta pagina conecta a duenos de negocio con la ruta en espanol de Bank Breezy para revisar opciones de financiamiento.',
      },
    },
  ],
};

const spanishFundingGuides = vestblockAeoTopics
  .filter((topic) => topic.language === 'es' && topic.offerPath === '/es/vestblock')
  .slice(0, 6);

export default function SpanishVestBlockPage() {
  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="border-b">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-24 md:grid-cols-[1.2fr_0.8fr] md:pt-28">
          <div>
            <Badge variant="outline" className="mb-4">
              VestBlock en espanol
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Financiamiento para duenos de negocio que hablan espanol.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              VestBlock te ayuda a preparar tu negocio antes de aplicar:
              documentos, cuenta bancaria comercial, credito, ingresos y uso de
              fondos. Cuando estes listo, puedes revisar opciones en espanol con
              Bank Breezy.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a
                  href={bankBreezySpanishFundingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Revisar opciones en Bank Breezy
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/business-setup">
                  Ver preparacion en ingles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-cyan-500" />
                Ruta clara antes de aplicar
              </CardTitle>
              <CardDescription>
                La preparacion correcta evita aplicaciones incompletas y ayuda a
                escoger opciones que tienen sentido para tu etapa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                'Organiza identidad, EIN y documentos del negocio.',
                'Prepara cuenta bancaria, ingresos y estados recientes.',
                'Revisa credito personal y credito comercial antes de aplicar.',
                'Conecta con la pagina en espanol de Bank Breezy cuando estes listo.',
              ].map((item) => (
                <div key={item} className="flex gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-7 max-w-2xl">
          <h2 className="text-2xl font-semibold">
            Preparacion para financiamiento y subvenciones
          </h2>
          <p className="mt-2 text-muted-foreground">
            Estos son los puntos que un dueno de negocio debe organizar antes de
            buscar credito comercial, financiamiento o programas de ayuda.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {spanishFundingReadinessPillars.map((pillar) => (
            <Card key={pillar.id}>
              <CardHeader>
                <CardTitle className="text-lg">{pillar.title}</CardTitle>
                <CardDescription>{pillar.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pillar.checks.map((check) => (
                  <div key={check} className="flex gap-3 text-sm">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{check}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold">
              Guias en espanol para fortalecer tu perfil
            </h2>
            <p className="mt-2 text-muted-foreground">
              Estas guias ayudan a crear una red de contenido en espanol alrededor
              de financiamiento, credito comercial, documentos y subvenciones.
            </p>
          </div>

          <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {spanishFundingGuides.map((guide) => (
              <Card key={guide.slug}>
                <CardHeader>
                  <CardTitle className="text-lg">{guide.title}</CardTitle>
                  <CardDescription>{guide.metaDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href={`/resources/${guide.slug}`}>Leer guia</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Credito comercial</CardTitle>
                <CardDescription>
                  Revisa perfil, EIN, cuentas, monitoreo y opciones para crear
                  historial comercial.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/tools/business-credit">Abrir herramienta</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Subvenciones</CardTitle>
                <CardDescription>
                  Busca oportunidades que coincidan con ubicacion, industria y
                  perfil del fundador.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/tools/grants">Ver herramienta</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bank Breezy</CardTitle>
                <CardDescription>
                  Continua hacia la pagina en espanol para revisar opciones de
                  financiamiento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <a
                    href={bankBreezySpanishFundingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ir a Bank Breezy
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
            VestBlock no garantiza aprobaciones, prestamos, lineas de credito ni
            subvenciones. La informacion es educativa y de preparacion; cada
            programa, banco o socio revisa sus propios requisitos.
          </p>
        </div>
      </section>
    </main>
  );
}
