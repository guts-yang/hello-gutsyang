'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderGit2, Briefcase, Award, User, LogOut, ExternalLink, Settings, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const groups = [
  {
    title: '内容',
    items: [
      { href: '/admin', label: '总览', icon: LayoutDashboard, exact: true },
      { href: '/admin/profile', label: 'Profile', icon: User },
      { href: '/admin/projects', label: 'Projects', icon: FolderGit2 },
      { href: '/admin/experiences', label: 'Experiences', icon: Briefcase },
      { href: '/admin/honors', label: 'Honors', icon: Award },
    ],
  },
  {
    title: '账号',
    items: [
      { href: '/admin/settings', label: '设置', icon: Settings },
      { href: '/admin/audit', label: '审计', icon: ScrollText },
    ],
  },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function signOut() {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/admin/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="glass-strong sticky top-6 flex h-fit flex-col gap-3 rounded-3xl p-4 md:max-h-[calc(100vh-3rem)]">
      <div className="px-2 pb-3">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CMS</p>
        <p className="display-headline text-xl text-gradient">Admin</p>
        <p className="mt-1 truncate text-xs text-muted-foreground" title={email}>
          {email}
        </p>
      </div>
      <nav className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : 'text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 pt-3">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          预览站点
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground hover:bg-white/40 hover:text-foreground disabled:opacity-50 dark:hover:bg-white/10"
        >
          <LogOut className="h-3.5 w-3.5" />
          {loggingOut ? '退出中…' : '退出登录'}
        </button>
      </div>
    </aside>
  );
}
