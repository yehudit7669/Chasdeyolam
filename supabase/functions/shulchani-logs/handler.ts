// קבלת לוגים מתוכנת המחשב "שולחני".
// הקובץ הזה בלי תלות ב-Deno או ב-Supabase, כדי שאפשר יהיה לבדוק אותו מקומית.
//
// חוזה מול התוכנה (אסור לשנות — כבר נמצא בתוכנה שנבנתה):
//   POST, כותרת X-Shulchani-Key, גוף JSON:
//   { install: uuid, version, computer, platform, entries: [{ at, level, message, stack? }] }  (עד 50 רשומות)
//   הצלחה: 200 וגוף בדיוק {"ok":true}. כל תשובה אחרת = התוכנה שומרת את הרשומות בתור ומנסה שוב.

export interface LogRow {
  logged_at: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack: string | null;
  install: string;
  version: string | null;
  computer: string | null;
  platform: string | null;
}

export interface HandlerDeps {
  key: string;
  insert: (rows: LogRow[]) => Promise<void>;
  // כמה רשומות התקבלו מההתקנה הזו מאז sinceIso
  countRecent: (install: string, sinceIso: string) => Promise<number>;
  now?: () => number;
}

export const MAX_BODY_BYTES = 512 * 1024;
export const MAX_ENTRIES = 50;
const MAX_MESSAGE = 2000;
const MAX_STACK = 4000;
const MAX_META = 200;
// הגבלת קצב לכל install: עד 1000 רשומות ב-10 דקות (התור בתוכנה מוגבל ל-500), ועד 30 בקשות בדקה לכל מופע של הפונקציה
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ENTRIES_PER_WINDOW = 1000;
const MAX_REQUESTS_PER_MINUTE = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEVELS = new Set(['error', 'warn', 'info']);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const str = (v: unknown, max: number): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

export function createHandler(deps: HandlerDeps) {
  const now = deps.now ?? Date.now;
  const recentRequests = new Map<string, number[]>();

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

    const provided = req.headers.get('x-shulchani-key') ?? '';
    if (!deps.key || !safeEqual(provided, deps.key)) return json(401, { error: 'unauthorized' });

    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) return json(413, { error: 'payload too large' });
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) return json(413, { error: 'payload too large' });

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(new TextDecoder().decode(buf));
    } catch {
      return json(400, { error: 'invalid json' });
    }
    if (!body || typeof body !== 'object') return json(400, { error: 'invalid body' });

    const install = typeof body.install === 'string' ? body.install.trim() : '';
    if (!UUID_RE.test(install)) return json(400, { error: 'invalid install' });
    if (!Array.isArray(body.entries)) return json(400, { error: 'entries must be an array' });

    const entries = body.entries.slice(0, MAX_ENTRIES);
    if (entries.length === 0) return json(200, { ok: true });

    // הגבלת קצב זולה בזיכרון (לכל מופע)
    const t = now();
    const times = (recentRequests.get(install) ?? []).filter((x) => t - x < 60_000);
    if (times.length >= MAX_REQUESTS_PER_MINUTE) return json(429, { error: 'too many requests' });
    times.push(t);
    recentRequests.set(install, times);
    if (recentRequests.size > 5000) recentRequests.clear();

    // הגבלת קצב לפי מה שכבר נשמר
    const recent = await deps.countRecent(install, new Date(t - WINDOW_MS).toISOString());
    if (recent + entries.length > MAX_ENTRIES_PER_WINDOW) return json(429, { error: 'too many entries' });

    const version = str(body.version, MAX_META);
    const computer = str(body.computer, MAX_META);
    const platform = str(body.platform, MAX_META);

    const rows: LogRow[] = [];
    for (const e of entries) {
      if (!e || typeof e !== 'object') continue;
      const entry = e as Record<string, unknown>;
      const message = str(entry.message, MAX_MESSAGE);
      if (!message) continue;
      const level = typeof entry.level === 'string' && LEVELS.has(entry.level) ? entry.level : 'info';
      const at = typeof entry.at === 'string' ? Date.parse(entry.at) : NaN;
      rows.push({
        logged_at: new Date(Number.isFinite(at) ? at : t).toISOString(),
        level: level as LogRow['level'],
        message,
        stack: str(entry.stack, MAX_STACK),
        install,
        version,
        computer,
        platform,
      });
    }

    if (rows.length) await deps.insert(rows);
    return json(200, { ok: true });
  };
}
