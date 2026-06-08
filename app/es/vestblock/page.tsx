import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe2,
  CircleCheckBig,
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
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Financiamiento Para Negocios En Espanol | VestBlock',
  description:
    'VestBlock ayuda a duenos de negocio que hablan espanol a preparar documentos, credito comercial y pasos de financiamiento comercial.',
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
      'Prepara tu negocio para financiamiento comercial y credito de negocio con una ruta clara y segura.',
    url: absoluteUrl('/es/vestblock'),
    type: 'website',
    locale: 'es_US',
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock en español',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Financiamiento Para Negocios En Espanol | VestBlock',
    description:
      'Prepara tu negocio para financiamiento comercial y credito de negocio con una ruta clara y segura.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'VestBlock garantiza financiamiento o aprobacion?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'No. VestBlock ayuda a organizar documentos, credito, perfil del negocio y proximos pasos, pero no garantiza aprobaciones, limites ni terminos.',
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
  .filter(
    (topic) =>
      topic.language === 'es' &&
      topic.offerPath === '/es/vestblock' &&
      !topic.slug.includes('subvenciones') &&
      !topic.slug.includes('grants') &&
      !topic.slug.includes('negocios-nuevos')
  )
  .sort((a, b) => {
    const intentRank = {
      'lead-capture': 0,
      comparison: 1,
      education: 2,
      'tool-support': 3,
    } as const;

    return intentRank[a.intent] - intentRank[b.intent];
  });

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
              Necesita capital para su negocio? Primero revise si esta listo para aplicar.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              VestBlock ayuda a duenos de negocio que hablan espanol a ordenar
              documentos, cuenta bancaria comercial, credito, ingresos y uso de
              fondos antes de perder tiempo con solicitudes que no encajan.
              Cuando la base esta lista, puedes continuar a una opcion de
              financiamiento en espanol con una ruta mas clara.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a
                  href={bankBreezySpanishFundingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-google-ads-conversion="spanish_funding_cta"
                  data-google-ads-conversion-value="1"
                >
                  Ver opciones de financiamiento
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="#pasos">
                  Ver como funciona
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
                Esta pagina esta hecha para duenos que quieren saber si estan
                listos y que necesitan arreglar primero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                'Revise EIN, identidad y documentos del negocio.',
                'Confirme cuenta bancaria, ingresos y estados recientes.',
                'Revise credito personal y credito comercial antes de aplicar.',
                'Cuando este listo, pase a la opcion de financiamiento en espanol.',
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

      <section id="pasos" className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-7 max-w-2xl">
          <h2 className="text-2xl font-semibold">
            Como funciona esta ruta
          </h2>
          <p className="mt-2 text-muted-foreground">
            La idea no es aplicar a ciegas. Primero se aclara la base del
            negocio, luego se revisan los faltantes y despues se compara la
            siguiente opcion.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: '1. Revise su preparacion',
              body: 'Revise EIN, documentos, cuenta bancaria, ingresos y el motivo real para usar fondos.',
            },
            {
              title: '2. Arregle lo que falta',
              body: 'Si faltan papeles, historial comercial o claridad en el uso de fondos, resuelvalo antes de aplicar.',
            },
            {
              title: '3. Compare opciones en espanol',
              body: 'Cuando la base este mas fuerte, avance a la ruta de financiamiento en espanol con mejor contexto.',
            },
          ].map((step) => (
            <Card key={step.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CircleCheckBig className="h-5 w-5 text-cyan-500" />
                  {step.title}
                </CardTitle>
                <CardDescription>{step.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-7 max-w-2xl">
          <h2 className="text-2xl font-semibold">
            Preparacion para financiamiento comercial
          </h2>
          <p className="mt-2 text-muted-foreground">
            Estos son los puntos que un dueno de negocio debe organizar antes de
            buscar credito comercial, lineas de credito o financiamiento para crecer.
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
              de financiamiento comercial, credito de negocio y documentos.
            </p>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preguntas urgentes</CardTitle>
                <CardDescription>
                  Para duenos que necesitan capital pronto y quieren una ruta mas clara.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Dinero para mi negocio sin perder tiempo.</p>
                <p>Mi negocio califica para financiamiento.</p>
                <p>Que necesito para sacar capital para mi negocio.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Base del negocio</CardTitle>
                <CardDescription>
                  Para ordenar EIN, cuenta bancaria, papeles y credito comercial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Como sacar EIN para mi negocio.</p>
                <p>Cuenta bancaria y papeles para pedir financiamiento.</p>
                <p>Como empezar credito comercial para mi negocio.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Opciones de financiamiento</CardTitle>
                <CardDescription>
                  Para comparar prestamos, lineas de credito y preparacion antes de aplicar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Financiamiento para negocios en espanol.</p>
                <p>Linea de credito para negocio.</p>
                <p>Abrir negocio y prepararlo para financiamiento.</p>
              </CardContent>
            </Card>
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
                    <Link href={`/learn/${guide.slug}`}>Leer guia</Link>
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
                <CardTitle className="text-lg">Documentos</CardTitle>
                <CardDescription>
                  Organiza la informacion que normalmente se revisa antes de una
                  conversacion de financiamiento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/learn/documentos-para-solicitar-financiamiento">
                    Ver documentos
                  </Link>
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
                    data-google-ads-conversion="bank_breezy_click"
                    data-google-ads-conversion-value="1"
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
            terminos. Esta ruta es educativa y de preparacion; cada banco o socio
            revisa sus propios requisitos.
          </p>
        </div>
      </section>
    </main>
  );
}
