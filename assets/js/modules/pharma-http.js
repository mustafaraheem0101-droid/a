/**
 * عميل HTTP بسيط لاستدعاء api.php — ES Module.
 *
 * الاستخدام من صفحة تدعم type="module":
 *   import { pharmaFetchJson } from './assets/js/modules/pharma-http.js';
 *   const data = await pharmaFetchJson('api.php', { action: 'categories' });
 */

const DEFAULT_TIMEOUT_MS = 25000;

/**
 * @param {string} url
 * @param {Record<string, unknown>} [body]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ status: string, data: unknown, message?: string }>}
 */
export async function pharmaFetchJson(url, body = {}, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: opts.signal ?? controller.signal,
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('استجابة غير JSON من الخادم');
    }
    if (!res.ok && parsed && parsed.status === 'error') {
      const msg = parsed.message || res.statusText;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = parsed;
      throw err;
    }
    return parsed;
  } finally {
    clearTimeout(t);
  }
}

/**
 * GET مع query string (للإجراءات القصيرة فقط).
 * @param {string} baseUrl مثال: 'api.php'
 * @param {Record<string, string>} query
 */
export async function pharmaGetJson(baseUrl, query = {}) {
  const q = new URLSearchParams(query);
  const url = q.toString() ? `${baseUrl}?${q}` : baseUrl;
  const res = await fetch(url, { credentials: 'same-origin' });
  const text = await res.text();
  return JSON.parse(text);
}
