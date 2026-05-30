// Browser-side helper for the admin "AI 一键生成英文" button. Calls the Next
// proxy at /api/admin/ai/translate, which forwards session cookies + CSRF to
// the Go API. Returns the same key set the caller sent, with each value
// replaced by the English translation (or "[EN] {zh}" in demo mode).

export type TranslateItems = Record<string, string>;

export async function translateAdminFields(items: TranslateItems): Promise<TranslateItems> {
  // Strip values that are empty/whitespace so we don't waste tokens. The
  // server still returns those keys with empty values, but explicit pruning
  // gives a clearer audit trail and a slightly smaller request body.
  const filtered: TranslateItems = {};
  for (const [k, v] of Object.entries(items)) {
    if (v && v.trim()) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) {
    // Nothing to translate -- return a key-shaped echo with empty strings so
    // callers can still iterate with confidence.
    const out: TranslateItems = {};
    for (const k of Object.keys(items)) out[k] = '';
    return out;
  }

  const response = await fetch('/api/admin/ai/translate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: filtered }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await readError(response, '翻译失败');
    throw new Error(message);
  }

  const data = (await response.json()) as { items?: TranslateItems };
  const translated = data.items ?? {};
  // Preserve every original key so the UI can map back deterministically
  // (the server already does this; this is a belt-and-suspenders guard).
  const out: TranslateItems = {};
  for (const k of Object.keys(items)) {
    out[k] = translated[k] ?? '';
  }
  return out;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}
