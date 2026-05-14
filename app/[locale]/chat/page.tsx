import { setRequestLocale } from 'next-intl/server';
import { ChatRoom } from '@/components/chat/chat-room';
import { BackLink } from '@/components/back-link';
import type { Locale } from '@/i18n';

export default function ChatPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <BackLink />
      <div className="mt-4">
        <ChatRoom locale={params.locale as Locale} />
      </div>
    </div>
  );
}
