'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import dynamic from 'next/dynamic';
import { History, MessageSquarePlus, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';
import {
  deleteChatSession,
  getChatMessages,
  listChatSessions,
  type ChatHistoryMessage,
  type ChatSessionSummary,
} from '@/lib/chat-api';
import type { ChatMessage } from './chat-room';

const MOBILE_QUERY = '(max-width: 767px)';
const ChatRoom = dynamic(() => import('./chat-room').then((mod) => mod.ChatRoom), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading AI…</div>
  ),
});

/**
 * Globally available "Ask AI" plugin: triggered from the site header.
 * - Desktop (md+): opaque dropdown panel with a session sidebar + chat surface
 * - Mobile (<md): full-width bottom sheet; a "History" button reveals a
 *   secondary sheet that hosts the same sidebar so users can switch / start
 *   / delete sessions without a desktop layout.
 */
export function AiPlugin() {
  const t = useTranslations('ai');
  const locale = useLocale() as Locale;
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  React.useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile]);

  const Trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={t('trigger')}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border border-white/60 dark:border-white/10 bg-gradient-to-br from-[hsl(var(--primary)/0.14)] via-white/70 to-[hsl(var(--accent)/0.16)] px-3 text-xs font-semibold text-foreground backdrop-blur-sm transition-transform transition-colors hover:-translate-y-0.5 hover:from-[hsl(var(--primary)/0.22)] hover:to-[hsl(var(--accent)/0.24)] dark:via-slate-950/70',
        open && 'from-[hsl(var(--primary)/0.28)] to-[hsl(var(--accent)/0.3)]',
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
      <span className="hidden sm:inline">{t('trigger')}</span>
    </button>
  );

  // ChatStation owns the session list / active session state. Both desktop
  // and mobile shells render it; differences are layout-only.
  return isMobile ? (
    <MobileShell open={open} setOpen={setOpen} trigger={Trigger} locale={locale} />
  ) : (
    <DesktopShell open={open} setOpen={setOpen} trigger={Trigger} locale={locale} />
  );
}

// ---- Desktop shell ----

function DesktopShell({
  open,
  setOpen,
  trigger,
  locale,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  trigger: React.ReactNode;
  locale: Locale;
}) {
  const t = useTranslations('ai');
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const id = window.setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('mousedown', handler);
    };
  }, [open, setOpen]);

  return (
    <div ref={wrapRef} className="relative">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-modal="false"
            aria-label={t('panelTitle')}
            className="absolute right-0 top-full z-50 mt-3 grid w-[760px] max-w-[calc(100vw-2rem)] grid-cols-[220px_1fr] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
            style={{ height: 'min(600px, calc(100vh - 7.5rem))' }}
          >
            <ChatStation
              locale={locale}
              variant="desktop"
              onClose={() => setOpen(false)}
              isOpen={open}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Mobile shell ----

function MobileShell({
  open,
  setOpen,
  trigger,
  locale,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  trigger: React.ReactNode;
  locale: Locale;
}) {
  const t = useTranslations('ai');
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          aria-label={t('panelTitle')}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-3xl border-t border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <Dialog.Title className="sr-only">{t('panelTitle')}</Dialog.Title>
          <ChatStation
            locale={locale}
            variant="mobile"
            onClose={() => setOpen(false)}
            isOpen={open}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---- Shared chat station: sidebar + chat surface ----

function ChatStation({
  locale,
  variant,
  onClose,
  isOpen,
}: {
  locale: Locale;
  variant: 'desktop' | 'mobile';
  onClose: () => void;
  isOpen: boolean;
}) {
  const t = useTranslations('ai');
  const [sessions, setSessions] = React.useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [initialMessages, setInitialMessages] = React.useState<ChatMessage[]>([]);
  // `chatKey` forces React to remount ChatRoom on session change so its
  // internal state (input, draft, refs) starts fresh without us having to
  // expose imperative resets.
  const [chatKey, setChatKey] = React.useState(0);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const refreshSessions = React.useCallback(async () => {
    try {
      const rows = await listChatSessions();
      setSessions(rows);
    } catch {
      // List failures are non-fatal: the chat still works without a sidebar.
    }
  }, []);

  // First open: load the session list. We don't auto-select any session so
  // visitors land on a clean "new chat" surface; they pick from history if
  // they want to resume.
  React.useEffect(() => {
    if (!isOpen) return;
    refreshSessions();
  }, [isOpen, refreshSessions]);

  const handleSelectSession = React.useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setInitialMessages([]);
    setChatKey((k) => k + 1);
    setHistoryOpen(false);
    try {
      const rows = await getChatMessages(sessionId);
      const replayed: ChatMessage[] = rows.map((m: ChatHistoryMessage) => ({
        role: m.role,
        content: m.content,
      }));
      setInitialMessages(replayed);
      setChatKey((k) => k + 1);
    } catch {
      setInitialMessages([]);
    }
  }, []);

  const handleNewChat = React.useCallback(() => {
    setActiveSessionId(null);
    setInitialMessages([]);
    setChatKey((k) => k + 1);
    setHistoryOpen(false);
  }, []);

  const handleDeleteSession = React.useCallback(
    async (sessionId: string) => {
      if (!window.confirm(t('confirmDelete'))) return;
      const snapshot = sessions;
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
      try {
        await deleteChatSession(sessionId);
      } catch {
        // Restore on failure so the UI does not lie about the state.
        setSessions(snapshot);
      }
    },
    [activeSessionId, handleNewChat, sessions, t],
  );

  // When the chat handler resolves a session id (either creating a new row or
  // confirming the existing one) we refresh the sidebar list so its title and
  // ordering stay in sync. If it was a brand-new session, also bind the room
  // to its id so subsequent messages append to the same row.
  const handleSessionResolved = React.useCallback(
    async (resolvedId: string) => {
      if (activeSessionId !== resolvedId) {
        setActiveSessionId(resolvedId);
      }
      await refreshSessions();
    },
    [activeSessionId, refreshSessions],
  );

  const sidebar = (
    <SessionSidebar
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelect={handleSelectSession}
      onNew={handleNewChat}
      onDelete={handleDeleteSession}
      emptyLabel={t('empty')}
      newLabel={t('newChat')}
      deleteLabel={t('delete')}
      untitledLabel={t('untitled')}
    />
  );

  if (variant === 'desktop') {
    return (
      <>
        <aside className="flex h-full flex-col border-r border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900/60">
          {sidebar}
        </aside>
        <section className="flex h-full min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">{t('panelTitle')}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t('panelHint')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 px-4 py-3">
            <ChatRoom
              key={chatKey}
              locale={locale}
              variant="bare"
              className="h-full"
              sessionId={activeSessionId}
              initialMessages={initialMessages}
              onSessionResolved={handleSessionResolved}
            />
          </div>
        </section>
      </>
    );
  }

  // mobile: header has History + Close; chat fills the rest; History reveals
  // an inline overlay with the same sidebar.
  return (
    <>
      <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-foreground/15" />
      <header className="mt-3 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">{t('panelTitle')}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t('panelHint')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label={t('history')}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <ChatRoom
          key={chatKey}
          locale={locale}
          variant="bare"
          className="h-full"
          sessionId={activeSessionId}
          initialMessages={initialMessages}
          onSessionResolved={handleSessionResolved}
        />
      </div>
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-slate-950"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <p className="text-sm font-semibold">{t('history')}</p>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label={t('close')}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden">{sidebar}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---- Sidebar (shared by desktop & mobile) ----

function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  emptyLabel,
  newLabel,
  deleteLabel,
  untitledLabel,
}: {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  emptyLabel: string;
  newLabel: string;
  deleteLabel: string;
  untitledLabel: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <Plus className="h-3.5 w-3.5" />
          {newLabel}
        </button>
      </div>
      <ul className="scrollbar-none min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 && (
          <li className="grid place-items-center px-4 pt-6 text-center text-xs text-muted-foreground">
            <MessageSquarePlus className="mb-2 h-5 w-5 opacity-60" />
            {emptyLabel}
          </li>
        )}
        {sessions.map((s) => {
          const active = s.id === activeSessionId;
          const title = s.title?.trim() || untitledLabel;
          return (
            <li key={s.id}>
              <div
                className={cn(
                  'group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors',
                  active
                    ? 'bg-[hsl(var(--primary)/0.12)] text-foreground'
                    : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex-1 truncate text-left text-xs"
                  title={title}
                >
                  {title}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  aria-label={deleteLabel}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
