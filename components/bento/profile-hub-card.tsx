'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Github, Mail, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/glass-card';
import { Badge } from '@/components/ui/badge';
import { pickLocale } from '@/lib/profile';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';
import type { ProfileBundle } from '@/lib/content';

const iconFor = {
  github: Github,
  email: Mail,
  wechat: MessageCircle,
  linkedin: Github,
  twitter: Github,
} as const;

export function ProfileHubCard({
  profile,
  locale,
  className,
}: {
  profile: ProfileBundle;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations();
  const [wechatOpen, setWechatOpen] = React.useState(false);
  const displayName = locale === 'zh' ? profile.nameZh : profile.nameEn;
  const initials = profile.handle.slice(0, 2).toUpperCase();

  return (
    <GlassCard density="comfy" className={cn('group', className)}>
      <div className="flex h-full flex-col justify-between gap-6 lg:gap-10">
        {/* Top row: badge + greeting + name (huge) on the left, avatar on the right */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="space-y-3 lg:space-y-4">
            <Badge tone="accent" className="uppercase tracking-[0.2em]">
              {locale === 'zh' ? '可被招聘' : 'Open to roles'}
            </Badge>
            <p className="text-sm text-muted-foreground">{t('hero.greeting')}</p>
            <h1
              className="display-headline text-foreground"
              style={{ fontSize: 'clamp(3rem, 8.5vw, 8rem)', lineHeight: 0.95 }}
            >
              <span className="text-gradient">{displayName}</span>
            </h1>
            <p className="text-base font-medium text-foreground/85 sm:text-lg lg:text-xl">
              {pickLocale(profile.role, locale)}
            </p>
          </div>

          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative hidden h-28 w-28 shrink-0 sm:block lg:h-36 lg:w-36"
          >
            <div className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_0deg,hsl(var(--aurora-1)),hsl(var(--aurora-2)),hsl(var(--aurora-3)),hsl(var(--aurora-4)),hsl(var(--aurora-1)))] blur-md opacity-80 animate-aurora-drift" />
            <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md text-3xl font-bold text-gradient lg:text-5xl">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </motion.div>
        </div>

        {/* Bottom: two-column layout — narrative on the left, socials on the right */}
        <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-[2fr_1fr] lg:gap-10">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {locale === 'zh' ? '关于' : 'About'}
            </p>
            <p className="text-pretty text-base leading-relaxed text-foreground/90 sm:text-lg lg:text-xl">
              {pickLocale(profile.slogan, locale)}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {pickLocale(profile.bio, locale)}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end lg:text-right">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {locale === 'zh' ? '联系' : 'Reach out'}
            </p>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {profile.socials.map((s) => {
                const Icon = iconFor[s.type];
                const isWechat = s.type === 'wechat';
                const onClick = isWechat
                  ? (e: React.MouseEvent) => {
                      e.preventDefault();
                      setWechatOpen((v) => !v);
                    }
                  : undefined;
                return (
                  <a
                    key={s.type}
                    href={s.href}
                    onClick={onClick}
                    target={isWechat ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="group/social inline-flex items-center gap-2 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/60 dark:hover:bg-white/10"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t(`social.${s.type}` as 'social.github' | 'social.email' | 'social.wechat')}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {wechatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong absolute right-6 bottom-6 z-10 flex flex-col items-center gap-2 rounded-2xl p-4"
          >
            <div className="grid h-32 w-32 place-items-center rounded-xl bg-white text-xs text-zinc-500">
              QR
            </div>
            <p className="text-xs text-muted-foreground">{t('social.wechatTip')}</p>
          </motion.div>
        )}
      </div>
    </GlassCard>
  );
}
