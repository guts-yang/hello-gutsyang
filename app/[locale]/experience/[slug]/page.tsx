import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Briefcase } from 'lucide-react';
import { DetailShell } from '@/components/detail-shell';
import { BackLink } from '@/components/back-link';
import { pickLocale } from '@/lib/profile';
import { getExperiences, getExperienceBySlug } from '@/lib/content';
import { formatDate } from '@/lib/utils';
import { locales, type Locale } from '@/i18n';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const experiences = await getExperiences();
  return locales.flatMap((locale) =>
    experiences.map((e) => ({ locale, slug: e.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const exp = await getExperienceBySlug(params.slug);
  if (!exp) return {};
  const locale = params.locale as Locale;
  return {
    title: pickLocale(exp.org, locale),
    description: pickLocale(exp.summary, locale),
  };
}

export default async function ExperienceDetailPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(params.locale);
  const exp = await getExperienceBySlug(params.slug);
  if (!exp) notFound();

  const locale = params.locale as Locale;

  return (
    <div>
      <div className="mx-auto w-full max-w-4xl px-4 pb-2 pt-2 sm:px-6 lg:px-10">
        <BackLink />
      </div>
      <DetailShell layoutId={`experience-${exp.slug}`}>
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            {formatDate(exp.startedAt, locale)} —{' '}
            {exp.endedAt ? formatDate(exp.endedAt, locale) : locale === 'zh' ? '至今' : 'Present'}
          </div>
          <h1 className="display-headline text-4xl text-gradient sm:text-5xl">
            {pickLocale(exp.org, locale)}
          </h1>
          <p className="text-lg text-muted-foreground">{pickLocale(exp.role, locale)}</p>
        </div>

        <p className="text-base leading-relaxed text-foreground/90">{pickLocale(exp.summary, locale)}</p>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {locale === 'zh' ? '量化成果' : 'Quantified outcomes'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {exp.metrics.map((m, i) => (
              <li
                key={i}
                className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 text-sm"
              >
                {pickLocale(m, locale)}
              </li>
            ))}
          </ul>
        </section>
      </DetailShell>
    </div>
  );
}
