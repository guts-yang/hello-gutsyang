import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Github, ExternalLink } from 'lucide-react';
import { DetailShell } from '@/components/detail-shell';
import { BackLink } from '@/components/back-link';
import { Badge } from '@/components/ui/badge';
import { pickLocale } from '@/lib/profile';
import { getProjects, getProjectBySlug } from '@/lib/content';
import { formatDate } from '@/lib/utils';
import { locales, type Locale } from '@/i18n';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const projects = await getProjects();
  return locales.flatMap((locale) =>
    projects.map((p) => ({ locale, slug: p.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return {};
  const locale = rawLocale as Locale;
  return {
    title: pickLocale(project.title, locale),
    description: pickLocale(project.tagline, locale),
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const locale = rawLocale as Locale;
  const t = await getTranslations({ locale, namespace: 'sections.projects' });

  return (
    <div>
      <div className="mx-auto w-full max-w-4xl px-4 pb-2 pt-2 sm:px-6 lg:px-10">
        <BackLink />
      </div>
      <DetailShell layoutId={`project-${project.slug}`}>
        <div className="space-y-3">
          <Badge tone={project.kind === 'academic' ? 'accent' : 'default'}>
            {project.kind === 'academic' ? t('academic') : t('engineering')}
          </Badge>
          <h1 className="display-headline text-4xl text-gradient sm:text-5xl">
            {pickLocale(project.title, locale)}
          </h1>
          <p className="text-lg text-muted-foreground">{pickLocale(project.tagline, locale)}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(project.startedAt, locale)}
            {project.endedAt ? ` — ${formatDate(project.endedAt, locale)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <Badge key={tag} tone="muted">
              {tag}
            </Badge>
          ))}
        </div>

        {project.repo || project.link ? (
          <div className="flex flex-wrap gap-3">
            {project.repo && (
              <a
                href={project.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur-md transition-all hover:-translate-y-0.5"
              >
                <Github className="h-4 w-4" />
                Source
              </a>
            )}
            {project.link && (
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur-md transition-all hover:-translate-y-0.5"
              >
                <ExternalLink className="h-4 w-4" />
                Live
              </a>
            )}
          </div>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {locale === 'zh' ? '概述' : 'Overview'}
          </h2>
          <p className="text-base leading-relaxed text-foreground/90">
            {pickLocale(project.summary, locale)}
          </p>
        </section>

        {project.highlights.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              {locale === 'zh' ? '核心亮点' : 'Key results'}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {project.highlights.map((h, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 text-sm"
                >
                  {pickLocale(h, locale)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </DetailShell>
    </div>
  );
}
