// Browser-side client for the AI chat history endpoints. Always hits the
// Next.js /api proxy (never the Go API directly) so the HttpOnly chat-owner
// cookie minted by the backend rides every request without JS ever touching
// it. All helpers throw on non-2xx so callers can use plain try/catch.

export type ChatSessionSummary = {
  id: string;
  title: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function listChatSessions(signal?: AbortSignal): Promise<ChatSessionSummary[]> {
  const response = await fetch('/api/ai/sessions', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    throw new Error(await readError(response, '会话列表加载失败'));
  }
  return (await response.json()) as ChatSessionSummary[];
}

export async function getChatMessages(
  sessionId: string,
  signal?: AbortSignal,
): Promise<ChatHistoryMessage[]> {
  const response = await fetch(`/api/ai/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('会话不存在或已被清除');
    }
    throw new Error(await readError(response, '消息加载失败'));
  }
  return (await response.json()) as ChatHistoryMessage[];
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/ai/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(await readError(response, '删除失败'));
  }
}
