import { z } from 'zod';

/** Optional URL: empty string becomes null. */
export const optionalUrl = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.union([z.literal(''), z.string().url()]))
  .transform((v) => (v === '' ? null : v));

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}
