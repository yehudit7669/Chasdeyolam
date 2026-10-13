import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { CostMode, bookingCost, planTotal, shekel } from '../../lib/bookingCosts';

interface Row {
  id: string;
  name: string;
  plan: string;
  hotel: string;
  date: string | null;
  status: string;
  revenue: number | null;
  cost: number | null;
  costMode: CostMode;
}

const STATUS_HE: Record<string, string> = { awaiting_admin: 'ממתין לאישורך', confirmed: 'אושר' };

// "YYYY-MM" של תאריך הכניסה — לסינון לפי חודש
const monthKey = (d: string | null) => (d ? d.slice(0, 7) : 'none');
const monthLabel = (k: string) => {
  if (k === 'none') return 'בלי תאריך';
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
};

export const AdminProfitPage = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('all');

  useEffect(() => {
    (async () => {
      // הזמנות שכבר יש בהן מלון — מה שעולה לנו כסף
      const { data: reqs } = await supabase.from('immediate_requests')
        .select('id, user_id, user_full_name, plan_id, plan_name_he, selected_hotel_id, selected_date, status')
        .eq('archived', false).in('status', ['awaiting_admin', 'confirmed']).not('selected_hotel_id', 'is', null)
        .order('selected_date', { ascending: false });
      const list = reqs ?? [];
      const hotelIds = Array.from(new Set(list.map((r) => r.selected_hotel_id))) as string[];
      const planIds = Array.from(new Set(list.map((r) => r.plan_id).filter(Boolean))) as string[];
      const userIds = Array.from(new Set(list.map((r) => r.user_id)));
      const [hotelsRes, costsRes, plansRes, trackRes, profRes] = await Promise.all([
        hotelIds.length ? supabase.from('hotels').select('id, name_he').in('id', hotelIds) : Promise.resolve({ data: [] }),
        hotelIds.length ? supabase.from('hotel_costs').select('hotel_id, default_cost').in('hotel_id', hotelIds) : Promise.resolve({ data: [] }),
        planIds.length ? supabase.from('plans').select('id, monthly_amount, required_successful_payments').in('id', planIds) : Promise.resolve({ data: [] }),
        list.length ? supabase.from('booking_admin_tracking').select('request_id, cost_mode, custom_cost').in('request_id', list.map((r) => r.id)) : Promise.resolve({ data: [] }),
        userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
      ]);
      const hotelName = Object.fromEntries(((hotelsRes.data ?? []) as { id: string; name_he: string }[]).map((h) => [h.id, h.name_he]));
      const hotelCost = Object.fromEntries(((costsRes.data ?? []) as { hotel_id: string; default_cost: number | null }[])
        .map((c) => [c.hotel_id, c.default_cost != null ? Number(c.default_cost) : null]));
      const total = Object.fromEntries(((plansRes.data ?? []) as { id: string; monthly_amount: number; required_successful_payments: number }[])
        .map((p) => [p.id, planTotal(p)]));
      const track = Object.fromEntries(((trackRes.data ?? []) as { request_id: string; cost_mode: CostMode; custom_cost: number | null }[])
        .map((t) => [t.request_id, { cost_mode: t.cost_mode, custom_cost: t.custom_cost != null ? Number(t.custom_cost) : null }]));
      const names = Object.fromEntries(((profRes.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));

      setRows(list.map((r) => ({
        id: r.id,
        name: names[r.user_id] || r.user_full_name || '—',
        plan: r.plan_name_he || '—',
        hotel: hotelName[r.selected_hotel_id as string] ?? '—',
        date: r.selected_date,
        status: r.status,
        revenue: r.plan_id ? total[r.plan_id] ?? null : null,
        cost: bookingCost(track[r.id], hotelCost[r.selected_hotel_id as string]),
        costMode: track[r.id]?.cost_mode ?? 'default',
      })));
      setLoading(false);
    })();
  }, []);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => monthKey(r.date)))).sort().reverse(), [rows]);
  const visible = month === 'all' ? rows : rows.filter((r) => monthKey(r.date) === month);
  const known = visible.filter((r) => r.cost != null && r.revenue != null);
  const sum = (f: (r: Row) => number) => known.reduce((a, r) => a + f(r), 0);
  const totals = { revenue: sum((r) => r.revenue!), cost: sum((r) => r.cost!), profit: sum((r) => r.revenue! - r.cost!) };
  const missing = visible.length - known.length;

  return (
    <AdminLayout>
      <div dir="rtl">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center">
              <TrendingUp className="text-[#626D58]" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0A192F]">רווחיות הזמנות</h1>
              <p className="text-sm text-[#33332D]/50">כמה הלקוח שילם (סכום התוכנית) פחות כמה עלה לנו המלון</p>
            </div>
          </div>
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-[#E5E1D8] rounded-xl text-sm bg-white focus:outline-none focus:border-[#0A192F]">
            <option value="all">כל החודשים</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'הזמנות', value: String(visible.length) },
            { label: 'הלקוחות שילמו', value: shekel(totals.revenue) },
            { label: 'עלה לנו', value: shekel(totals.cost) },
            { label: 'רווח', value: shekel(totals.profit), strong: true },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-4">
              <div className="text-xs text-[#33332D]/50">{k.label}</div>
              <div className={`text-xl font-black mt-1 ${k.strong ? (totals.profit < 0 ? 'text-red-600' : 'text-[#626D58]') : 'text-[#0A192F]'}`}>{k.value}</div>
            </div>
          ))}
        </div>

        {missing > 0 && (
          <p className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
            <AlertTriangle size={15} />
            ל-{missing} {missing === 1 ? 'הזמנה' : 'הזמנות'} אין עדיין עלות (לא הוגדר מחיר רגיל למלון ולא הוזן מחיר אחר) — הן לא נכללות בסיכום.
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-12 text-center text-[#33332D]/40">
            אין עדיין הזמנות עם מלון
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-[#F7F5F0] text-xs text-[#33332D]/60">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">לקוח</th>
                  <th className="px-4 py-3 text-right font-semibold">תוכנית</th>
                  <th className="px-4 py-3 text-right font-semibold">מלון</th>
                  <th className="px-4 py-3 text-right font-semibold">כניסה</th>
                  <th className="px-4 py-3 text-right font-semibold">שילם</th>
                  <th className="px-4 py-3 text-right font-semibold">עלה לנו</th>
                  <th className="px-4 py-3 text-right font-semibold">רווח</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1D8]/60">
                {visible.map((r) => {
                  const profit = r.cost != null && r.revenue != null ? r.revenue - r.cost : null;
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#0A192F]">{r.name}</div>
                        <div className="text-[11px] text-[#33332D]/45">{STATUS_HE[r.status] ?? r.status}</div>
                      </td>
                      <td className="px-4 py-3 text-[#33332D]/75">{r.plan}</td>
                      <td className="px-4 py-3 text-[#33332D]/75">{r.hotel}</td>
                      <td className="px-4 py-3 text-[#33332D]/75 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString('he-IL') : '—'}</td>
                      <td className="px-4 py-3 font-semibold">{shekel(r.revenue)}</td>
                      <td className="px-4 py-3">
                        {r.cost != null ? shekel(r.cost) : <span className="text-amber-600 text-xs">לא הוגדר</span>}
                        <div className="text-[11px] text-[#33332D]/40">{r.costMode === 'custom' ? 'מחיר אחר' : 'מחיר רגיל'}</div>
                      </td>
                      <td className={`px-4 py-3 font-bold ${profit != null && profit < 0 ? 'text-red-600' : 'text-[#626D58]'}`}>{shekel(profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[#33332D]/45 mt-3">העלות לכל הזמנה נקבעת בלוח ההזמנות, בכרטיס של ההזמנה. המחיר הרגיל של כל מלון — בניהול האתר ← מלונות.</p>
      </div>
    </AdminLayout>
  );
};
