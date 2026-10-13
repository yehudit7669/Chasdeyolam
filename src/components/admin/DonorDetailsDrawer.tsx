import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Mail, Phone, Loader2, CreditCard, Hotel, Calendar, CheckCircle2, Award, ListChecks, CalendarSearch,
} from 'lucide-react';
import {
  JourneyRequest, JourneySub, REWARD_LABEL, isDonorFinished, rewardStage, requestForSub, CHECKLIST_KEYS,
} from '../../lib/donorJourney';

interface SubRow extends JourneySub {
  successful_payments_count: number;
  next_payment_date: string | null;
  keva_id: string | null;
  subscription_source: string | null;
  started_at: string;
  plans: { name_he: string; required_successful_payments: number; monthly_amount: number } | null;
}
interface RequestRow extends JourneyRequest {
  selected_hotel_id: string | null;
  selected_date: string | null;
  selected_end_date: string | null;
  plan_name_he: string | null;
  admin_note: string | null;
}
interface Callback { transaction_id: string | null; amount: string | null; transaction_type: string | null; tashloumim: string | null; received_at: string; keva_id: string | null; error_message: string | null; }
interface PaymentRow { subscription_id: string; amount: number; paid_at: string | null; status: string; }
interface CheckRow { id: string; status: string; plan_name_he: string | null; date_from: string; date_to: string; created_at: string; }

const STATUS_HE: Record<string, string> = { active: 'פעיל', frozen: 'מוקפא', canceled: 'בוטל', completed: 'הושלם' };
const CHECK_STATUS_HE: Record<string, string> = { pending: 'ממתין לבדיקה', available: 'אושר זמין — ממתין לתשלום', unavailable: 'לא זמין', used: 'שילם', cancelled: 'בוטל' };
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('he-IL') : '—');

export const DonorDetailsDrawer = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string; phone: string | null; created_at: string; terms_accepted: boolean | null } | null>(null);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [checklists, setChecklists] = useState<Record<string, Record<string, boolean>>>({});
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [hotels, setHotels] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase.from('profiles')
        .select('full_name, email, phone, created_at, terms_accepted').eq('id', userId).maybeSingle();
      setProfile(prof);

      const [subRes, reqRes, cbRes, chkRes, hotelRes] = await Promise.all([
        supabase.from('subscriptions')
          .select('id, user_id, plan_id, status, is_eligible, successful_payments_count, next_payment_date, keva_id, subscription_source, started_at, plans!subscriptions_plan_id_fkey(name_he, required_successful_payments, monthly_amount)')
          .eq('user_id', userId).order('started_at', { ascending: false }),
        supabase.from('immediate_requests')
          .select('id, user_id, plan_id, subscription_id, status, redemption_type, created_at, selected_hotel_id, selected_date, selected_end_date, plan_name_he, admin_note')
          .eq('user_id', userId).eq('archived', false).order('created_at', { ascending: false }),
        // מה שנדרים פלוס דיווח שהתקבל — לפי המשתמש, ולפי המייל (תשלומים שנעשו מחוץ לאתר)
        prof?.email
          ? supabase.from('nedarim_donation_callbacks')
              .select('transaction_id, amount, transaction_type, tashloumim, received_at, keva_id, error_message')
              .or(`user_id.eq.${userId},mail.ilike.${prof.email}`).order('received_at', { ascending: false })
          : supabase.from('nedarim_donation_callbacks')
              .select('transaction_id, amount, transaction_type, tashloumim, received_at, keva_id, error_message')
              .eq('user_id', userId).order('received_at', { ascending: false }),
        supabase.from('availability_checks').select('id, status, plan_name_he, date_from, date_to, created_at')
          .eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('hotels').select('id, name_he'),
      ]);

      const subRows = (subRes.data ?? []) as unknown as SubRow[];
      const reqRows = (reqRes.data ?? []) as RequestRow[];
      setSubs(subRows);
      setRequests(reqRows);
      setCallbacks((cbRes.data ?? []) as Callback[]);
      setChecks((chkRes.data ?? []) as CheckRow[]);
      const hmap: Record<string, string> = {};
      for (const h of hotelRes.data ?? []) hmap[h.id] = h.name_he;
      setHotels(hmap);

      const [payRes, trRes] = await Promise.all([
        subRows.length
          ? supabase.from('payments').select('subscription_id, amount, paid_at, status').in('subscription_id', subRows.map((s) => s.id))
          : Promise.resolve({ data: [] }),
        reqRows.length
          ? supabase.from('booking_admin_tracking').select('request_id, checklist').in('request_id', reqRows.map((r) => r.id))
          : Promise.resolve({ data: [] }),
      ]);
      setPayments((payRes.data ?? []) as PaymentRow[]);
      const cl: Record<string, Record<string, boolean>> = {};
      for (const t of (trRes.data ?? []) as { request_id: string; checklist: Record<string, boolean> }[]) cl[t.request_id] = t.checklist ?? {};
      setChecklists(cl);
      setLoading(false);
    })();
  }, [userId]);

  const finished = isDonorFinished(subs, requests, checklists);
  const totalPaid = callbacks.filter((c) => c.transaction_id && !c.error_message)
    .reduce((sum, c) => sum + (parseFloat(c.amount ?? '0') || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-start" dir="rtl" onClick={onClose}>
      <div className="bg-gray-50 w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* כותרת */}
        <div className="sticky top-0 z-10 bg-[#0B3C5D] text-white px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{profile?.full_name || profile?.email || '...'}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/75 mt-1">
              {profile?.email && <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:text-white"><Mail size={13} />{profile.email}</a>}
              {profile?.phone && <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:text-white"><Phone size={13} />{profile.phone}</a>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#0B3C5D]" size={28} /></div>
        ) : (
          <div className="p-6 space-y-6">
            {/* סיכום */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 border border-gray-200">
                <div className="text-xs text-gray-500">מצב כללי</div>
                <div className={`text-sm font-bold mt-0.5 ${finished ? 'text-green-700' : 'text-gray-900'}`}>
                  {finished ? '🏁 הסתיים בהצלחה' : subs.some((s) => ['active', 'frozen'].includes(s.status)) ? 'תוכנית פתוחה' : 'אין תוכנית פעילה'}
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200">
                <div className="text-xs text-gray-500">סה״כ שהתקבל מנדרים</div>
                <div className="text-sm font-bold mt-0.5 text-gray-900">₪{totalPaid.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200">
                <div className="text-xs text-gray-500">נרשם</div>
                <div className="text-sm font-bold mt-0.5 text-gray-900">{fmt(profile?.created_at ?? null)}</div>
                <div className="text-[11px] text-gray-400">{profile?.terms_accepted ? 'אישר תנאי שימוש' : 'טרם אישר תנאים'}</div>
              </div>
            </div>

            {/* תוכניות */}
            <section>
              <h3 className="text-sm font-bold text-[#0B3C5D] mb-2 flex items-center gap-1.5"><Award size={15} /> תוכניות ({subs.length})</h3>
              {subs.length === 0 && <p className="text-sm text-gray-400">אין מנויים.</p>}
              <div className="space-y-3">
                {subs.map((s) => {
                  const required = s.plans?.required_successful_payments ?? 0;
                  const req = requestForSub(s, requests) as RequestRow | undefined;
                  const stage = rewardStage(s, requests, checklists);
                  const isImmediate = req?.redemption_type === 'immediate';
                  const pct = isImmediate ? 100 : required ? Math.min(100, Math.round((s.successful_payments_count / required) * 100)) : 0;
                  const subPayments = payments.filter((p) => p.subscription_id === s.id);
                  const cl = req ? checklists[req.id] ?? {} : {};
                  return (
                    <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-bold text-gray-900">{s.plans?.name_he ?? '—'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {isImmediate ? 'מימוש מיידי (שולם מראש)' : 'מסלול רגיל'} · {STATUS_HE[s.status] ?? s.status} · התחיל {fmt(s.started_at)}
                            {s.plans?.monthly_amount ? ` · ₪${s.plans.monthly_amount} לחודש` : ''}
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${REWARD_LABEL[stage].cls}`}>{REWARD_LABEL[stage].label}</span>
                      </div>

                      {/* איפה הוא עומד */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{isImmediate ? 'שולם במלואו' : `${s.successful_payments_count} מתוך ${required} תשלומים`}</span>
                          {!isImmediate && s.next_payment_date && ['active', 'frozen'].includes(s.status) && <span>תשלום הבא: {fmt(s.next_payment_date)}</span>}
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-[#626D58]" style={{ width: `${pct}%` }} /></div>
                      </div>

                      {/* התמורה */}
                      {req && (
                        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm space-y-1">
                          {req.selected_hotel_id ? (
                            <div className="flex items-center gap-1.5 text-gray-800"><Hotel size={13} className="text-[#626D58]" />
                              {hotels[req.selected_hotel_id] ?? '—'}
                              {req.selected_date && <span className="text-gray-500 flex items-center gap-1"><Calendar size={12} />{fmt(req.selected_date)}{req.selected_end_date ? `–${fmt(req.selected_end_date)}` : ''}</span>}
                            </div>
                          ) : <div className="text-gray-500 text-xs">עוד לא נבחר מלון</div>}
                          {req.status === 'confirmed' && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500"><ListChecks size={12} />
                              צ׳קליסט: {CHECKLIST_KEYS.filter((k) => cl[k]).length}/{CHECKLIST_KEYS.length}
                            </div>
                          )}
                          {req.admin_note && <div className="text-xs text-gray-500">הערה ללקוח: {req.admin_note}</div>}
                        </div>
                      )}

                      {subPayments.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          רשומות תשלום במערכת: {subPayments.length} · ₪{subPayments.reduce((a, p) => a + (p.amount || 0), 0).toLocaleString()}
                        </div>
                      )}
                      {s.keva_id && <div className="mt-1 text-[11px] text-gray-400 font-mono">הוראת קבע {s.keva_id}</div>}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* מה התקבל מנדרים */}
            <section>
              <h3 className="text-sm font-bold text-[#0B3C5D] mb-2 flex items-center gap-1.5"><CreditCard size={15} /> מה התקבל מנדרים פלוס ({callbacks.length})</h3>
              {callbacks.length === 0 ? <p className="text-sm text-gray-400">לא התקבל אף דיווח תשלום מנדרים.</p> : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr><th className="px-3 py-2 text-right font-medium">תאריך</th><th className="px-3 py-2 text-right font-medium">סכום</th><th className="px-3 py-2 text-right font-medium">סוג</th><th className="px-3 py-2 text-right font-medium">מצב</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {callbacks.map((c, i) => (
                        <tr key={c.transaction_id ?? i}>
                          <td className="px-3 py-2 text-gray-700">{new Date(c.received_at).toLocaleDateString('he-IL')}</td>
                          <td className="px-3 py-2 font-semibold">₪{Number(c.amount ?? 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {c.keva_id ? 'הוראת קבע' : c.transaction_type || 'עסקה'}
                            {c.tashloumim && Number(c.tashloumim) > 1 ? ` · ${c.tashloumim} תשלומים` : ''}
                          </td>
                          <td className="px-3 py-2">
                            {c.error_message
                              ? <span className="text-xs text-red-600" title={c.error_message}>התקבל — לא שויך</span>
                              : <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 size={12} />התקבל</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {checks.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-[#0B3C5D] mb-2 flex items-center gap-1.5"><CalendarSearch size={15} /> בדיקות זמינות לפני תשלום</h3>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
                  {checks.map((c) => (
                    <div key={c.id} className="px-3 py-2 flex justify-between gap-3">
                      <span>{c.plan_name_he} · {fmt(c.date_from)}–{fmt(c.date_to)}</span>
                      <span className="text-xs text-gray-500">{CHECK_STATUS_HE[c.status] ?? c.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
