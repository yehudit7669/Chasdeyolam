import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Hourglass, Loader2, Mail, Phone, PauseCircle } from 'lucide-react';

interface Row {
  id: string;
  status: string;
  successful_payments_count: number;
  next_payment_date: string | null;
  profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
  plans: { name_he: string; required_successful_payments: number } | null;
}

const THRESHOLDS = [1, 2, 3, 5];

// תאריך זכאות משוער: התשלום הבא + חודש לכל תשלום נוסף שנשאר
const estimateEligibleDate = (next: string | null, remaining: number) => {
  if (!next) return null;
  const d = new Date(next);
  d.setMonth(d.getMonth() + remaining - 1);
  return d;
};

export const AdminApproachingEligibilityPage = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxRemaining, setMaxRemaining] = useState(3);

  useEffect(() => {
    (async () => {
      const [subsRes, reqRes] = await Promise.all([
        supabase.from('subscriptions')
          .select(`id, status, successful_payments_count, next_payment_date,
            profiles!subscriptions_user_id_fkey(full_name, email, phone),
            plans!subscriptions_plan_id_fkey(name_he, required_successful_payments)`)
          .in('status', ['active', 'frozen'])
          .eq('is_eligible', false),
        // מנוי שכבר יש לו בקשת הזמנה (מימוש מיידי) — כבר מטופל בלוח ההזמנות
        supabase.from('immediate_requests').select('subscription_id').not('subscription_id', 'is', null),
      ]);
      const handled = new Set((reqRes.data ?? []).map((r) => r.subscription_id));
      setRows(((subsRes.data ?? []) as unknown as Row[]).filter((r) => !handled.has(r.id) && r.plans));
      setLoading(false);
    })();
  }, []);

  const remainingOf = (r: Row) => Math.max(0, (r.plans?.required_successful_payments ?? 0) - r.successful_payments_count);
  const visible = rows
    .filter((r) => remainingOf(r) <= maxRemaining)
    .sort((a, b) => remainingOf(a) - remainingOf(b)
      || (a.next_payment_date ?? '9999').localeCompare(b.next_payment_date ?? '9999'));

  return (
    <AdminLayout>
      <div dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#D4B483]/15 flex items-center justify-center">
            <Hourglass className="text-[#B08D57]" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0A192F]">מתקרבים לזכאות</h1>
            <p className="text-sm text-[#33332D]/50">תורמי מסלול רגיל שעוד מעט יגיעו למלון — כדי להתכונן מראש</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-sm text-[#33332D]/60">נשארו עד</span>
          {THRESHOLDS.map((t) => (
            <button key={t} onClick={() => setMaxRemaining(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                maxRemaining === t ? 'bg-[#0A192F] text-white' : 'bg-white border border-[#E5E1D8] text-[#33332D]/60 hover:bg-[#F7F5F0]'
              }`}>
              {t} {t === 1 ? 'תשלום' : 'תשלומים'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-12 text-center">
            <Hourglass className="text-[#33332D]/15 mx-auto mb-3" size={36} />
            <p className="text-[#33332D]/40">אין תורמים שנשארו להם עד {maxRemaining} תשלומים</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F5F0] text-[#33332D]/60 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">תורם</th>
                  <th className="text-right font-semibold px-4 py-3">תוכנית</th>
                  <th className="text-right font-semibold px-4 py-3">התקדמות</th>
                  <th className="text-right font-semibold px-4 py-3">נשארו</th>
                  <th className="text-right font-semibold px-4 py-3">תשלום הבא</th>
                  <th className="text-right font-semibold px-4 py-3">זכאות משוערת</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const required = r.plans?.required_successful_payments ?? 0;
                  const remaining = remainingOf(r);
                  const pct = required ? Math.min(100, Math.round((r.successful_payments_count / required) * 100)) : 0;
                  const eta = estimateEligibleDate(r.next_payment_date, remaining);
                  return (
                    <tr key={r.id} className="border-t border-[#E5E1D8]/60 align-top">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#0A192F]">{r.profiles?.full_name || '—'}</div>
                        {r.profiles?.email && (
                          <a href={`mailto:${r.profiles.email}`} className="flex items-center gap-1 text-xs text-[#33332D]/55 hover:underline">
                            <Mail size={11} />{r.profiles.email}
                          </a>
                        )}
                        {r.profiles?.phone && (
                          <a href={`tel:${r.profiles.phone}`} className="flex items-center gap-1 text-xs text-[#33332D]/55 hover:underline">
                            <Phone size={11} />{r.profiles.phone}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#33332D]/80">
                        {r.plans?.name_he}
                        {r.status === 'frozen' && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-700">
                            <PauseCircle size={12} /> מוקפא
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="text-xs text-[#33332D]/60 mb-1">{r.successful_payments_count} / {required}</div>
                        <div className="h-1.5 rounded-full bg-[#E5E1D8] overflow-hidden">
                          <div className="h-full bg-[#626D58]" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-bold px-2 py-1 rounded-full ${
                          remaining <= 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {remaining === 0 ? 'הושלם — ממתין לעדכון' : remaining}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#33332D]/70 whitespace-nowrap">
                        {r.next_payment_date ? new Date(r.next_payment_date).toLocaleDateString('he-IL') : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#33332D]/70 whitespace-nowrap">
                        {eta ? eta.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
