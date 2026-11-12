import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Terminal, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

// שגיאות ואזהרות שנשלחות מתוכנת המחשב "שולחני" (Edge Function: shulchani-logs)
interface LogRow {
  id: number;
  logged_at: string;
  received_at: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack: string | null;
  install: string;
  version: string | null;
  computer: string | null;
  platform: string | null;
}

const LIMIT = 1000;

const LEVEL_UI: Record<LogRow['level'], { label: string; cls: string }> = {
  error: { label: 'שגיאה', cls: 'bg-red-50 text-red-700 border-red-200' },
  warn: { label: 'אזהרה', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  info: { label: 'מידע', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const AdminShulchaniLogsPage = () => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState('all');
  const [computer, setComputer] = useState('all');
  const [open, setOpen] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('shulchani_logs')
      .select('id, logged_at, received_at, level, message, stack, install, version, computer, platform')
      .order('logged_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIMIT);
    if (err) setError(err.message);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const computers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.computer || '—'))).sort((a, b) => a.localeCompare(b, 'he')),
    [rows],
  );
  const visible = rows.filter((r) =>
    (level === 'all' || r.level === level) && (computer === 'all' || (r.computer || '—') === computer));

  const toggle = (id: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectCls = 'px-3 py-2 border border-[#E5E1D8] rounded-xl text-sm bg-white focus:outline-none focus:border-[#0A192F]';

  return (
    <AdminLayout>
      <div dir="rtl">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center">
              <Terminal className="text-[#626D58]" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0A192F]">לוגים שולחני</h1>
              <p className="text-sm text-[#33332D]/50">שגיאות ואזהרות שנשלחות מתוכנת המחשב "שולחני" (בלי נתונים כספיים ובלי שמות)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls} aria-label="סינון לפי רמה">
              <option value="all">כל הרמות</option>
              <option value="error">שגיאות</option>
              <option value="warn">אזהרות</option>
              <option value="info">מידע</option>
            </select>
            <select value={computer} onChange={(e) => setComputer(e.target.value)} className={selectCls} aria-label="סינון לפי מחשב">
              <option value="all">כל המחשבים</option>
              {computers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E5E1D8] rounded-xl text-sm bg-white hover:bg-[#F7F5F0] disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> רענון
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">שגיאה בטעינה: {error}</p>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-12 text-center text-[#33332D]/40">
            {rows.length === 0 ? 'עדיין לא התקבלו לוגים מהתוכנה' : 'אין רשומות שמתאימות לסינון'}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-[#F7F5F0] text-xs text-[#33332D]/60">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">תאריך</th>
                  <th className="px-4 py-3 text-right font-semibold">רמה</th>
                  <th className="px-4 py-3 text-right font-semibold">הודעה</th>
                  <th className="px-4 py-3 text-right font-semibold">מחשב</th>
                  <th className="px-4 py-3 text-right font-semibold">גרסה</th>
                  <th className="px-4 py-3 text-right font-semibold">install</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1D8]/60 align-top">
                {visible.map((r) => {
                  const ui = LEVEL_UI[r.level] ?? LEVEL_UI.info;
                  const isOpen = open.has(r.id);
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-[#33332D]/75" title={`התקבל באתר: ${fmt(r.received_at)}`}>{fmt(r.logged_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${ui.cls}`}>{ui.label}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[480px]">
                        <div dir="auto" className="whitespace-pre-wrap break-words text-[#0A192F]">{r.message}</div>
                        {r.stack && (
                          <>
                            <button onClick={() => toggle(r.id)}
                              className="mt-1 flex items-center gap-1 text-xs text-[#626D58] hover:underline">
                              {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {isOpen ? 'הסתר stack' : 'הצג stack'}
                            </button>
                            {isOpen && (
                              <pre dir="ltr" className="mt-2 p-3 bg-[#F7F5F0] rounded-lg text-[11px] leading-relaxed text-left whitespace-pre-wrap break-all max-h-80 overflow-auto">{r.stack}</pre>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#33332D]/75">
                        <div dir="auto">{r.computer || '—'}</div>
                        {r.platform && <div className="text-[11px] text-[#33332D]/40" dir="ltr">{r.platform}</div>}
                      </td>
                      <td className="px-4 py-3 text-[#33332D]/75" dir="ltr">{r.version || '—'}</td>
                      <td className="px-4 py-3 text-[11px] text-[#33332D]/50 font-mono" dir="ltr" title={r.install}>{r.install.slice(0, 8)}…</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[#33332D]/45 mt-3">
          מוצגות {visible.length} רשומות מתוך {rows.length} האחרונות (עד {LIMIT}). החדשות למעלה.
        </p>
      </div>
    </AdminLayout>
  );
};
