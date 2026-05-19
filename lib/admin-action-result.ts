export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function actionError(message: string, fieldErrors?: Record<string, string>): AdminActionResult {
  return { ok: false, message, fieldErrors };
}

export function actionSuccess(message?: string): AdminActionResult {
  return { ok: true, message };
}
