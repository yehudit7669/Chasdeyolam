import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DonorLayout from '../components/DonorLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { createNotification } from '../hooks/useNotifications';
import { isDayAllowed, formatBookableDays, effectiveBookableDays } from '../lib/stayType';
import heroHotelImg from '../assets/hero-hotel.jpg';
import { AvailabilityCheck, isExpired, isPayable, fmtRequestedDates } from '../lib/availabilityChecks';
import { HotelNameWithDetails, HOTEL_PACKAGE_COLUMNS, HotelPackage } from '../components/HotelPackageDetails';
import { GuestDetails, GuestDetailsFields, emptyGuestDetails, validateGuestDetails, guestColumns } from '../components/GuestDetailsFields';
import {
  MapPin, Hotel as HotelIcon, Moon, CheckCircle, Loader2, Star,
  ChevronRight, ChevronLeft, Clock, AlertTriangle, Calendar, Trash2,
} from 'lucide-react';

interface Hotel extends HotelPackage { id: string; name_he: string; city_he: string; level: string; bookable_days: number[] | null; bookable_nights: number | null; images?: { image_url: string; display_order: number }[]; }
interface Avail { hotel_id: string; kind: string; start_date: string; end_date: string | null; }
interface PlanInfo { name_he: string; bookable_days: number[] | null; hotel_level: string; }
interface Req {
  id: string; plan_id: string | null; status: string;
  selected_hotel_id: string | null; selected_date: string | null; selected_end_date: string | null;
  user_note: string | null; admin_note: string | null; plan_name_he: string | null; created_at: string;
  voucher_url: string | null;
  change_requested: boolean | null;
}
interface HotelInfo { name_he: string; address: string | null; map_url: string | null; arrival_instructions: string | null; }
const DEFAULT_EXPLAINER = 'איך מקבלים את החופשה? לאחר אישור ההזמנה נשלח אליכם שובר במייל, או שניצור קשר עם בעל המקום שיידע שאתם מגיעים. בכל מקרה תקבלו את כל הפרטים המדויקים יחד עם האישור.';

const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtRange = (a: string, b: string | null) =>
  `כניסה ${parseDate(a).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long' })}${b ? ` · יציאה ${parseDate(b).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long' })}` : ''}`;

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Req[]>([]);
  const [planByReq, setPlanByReq] = useState<Record<string, PlanInfo>>({});
  const [hotelsByReq, setHotelsByReq] = useState<Record<string, Hotel[]>>({});
  const [availByHotel, setAvailByHotel] = useState<Record<string, Avail[]>>({});
  const [hotelInfoById, setHotelInfoById] = useState<Record<string, HotelInfo>>({});
  const [explainer, setExplainer] = useState<string>(DEFAULT_EXPLAINER);

  // מצב בחירה לכל בקשה בנפרד
  const [selHotel, setSelHotel] = useState<Record<string, string | null>>({});
  const [selDate, setSelDate] = useState<Record<string, string | null>>({});
  const [noteBy, setNoteBy] = useState<Record<string, string>>({});
  const [guestBy, setGuestBy] = useState<Record<string, GuestDetails>>({});
  const [guestErrorBy, setGuestErrorBy] = useState<Record<string, string>>({});
  const [calBy, setCalBy] = useState<Record<string, Date>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [changeMode, setChangeMode] = useState<Record<string, boolean>>({});
  // בדיקות זמינות פתוחות (לפני תשלום במימוש מיידי)
  const [openChecks, setOpenChecks] = useState<(AvailabilityCheck & { hotel_name?: string })[]>([]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from('immediate_requests')
      .select('id, plan_id, status, selected_hotel_id, selected_date, selected_end_date, user_note, admin_note, plan_name_he, created_at, voucher_url, change_requested')
      .eq('user_id', user.id).eq('archived', false)
      .order('created_at', { ascending: false });

    const reqs = (rows ?? []) as Req[];
    setRequests(reqs);

    const { data: checks } = await supabase.from('availability_checks')
      .select('*, hotel:hotels!availability_checks_hotel_id_fkey(name_he)')
      .eq('user_id', user.id).in('status', ['pending', 'available', 'unavailable'])
      .order('created_at', { ascending: false });
    setOpenChecks(((checks ?? []) as (AvailabilityCheck & { hotel: { name_he: string } | null })[])
      .map((c) => ({ ...c, hotel_name: c.hotel?.name_he })));

    const planMap: Record<string, PlanInfo> = {};
    const hotelsMap: Record<string, Hotel[]> = {};
    const availMap: Record<string, Avail[]> = {};

    // אצוות במקום שאילתה-פר-הזמנה (N+1): אוספים מזהים ושולפים הכל במכה אחת
    const activeReqs = reqs.filter(r => ['booking_open', 'awaiting_admin', 'confirmed'].includes(r.status) && r.plan_id);
    const planIds = Array.from(new Set(activeReqs.map(r => r.plan_id as string)));
    const selectedHotelIds = Array.from(new Set(reqs.map(r => r.selected_hotel_id).filter(Boolean))) as string[];

    // 3 שאילתות בלתי-תלויות במקביל
    const [plansRes, infoRes, setnRes] = await Promise.all([
      planIds.length
        ? supabase.from('plans').select('id, name_he, bookable_days, hotel_level').in('id', planIds)
        : Promise.resolve({ data: [] as any[] }),
      selectedHotelIds.length
        ? supabase.from('hotels').select('id, name_he, address, map_url, arrival_instructions').in('id', selectedHotelIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('admin_settings').select('redemption_explainer').eq('id', 1).maybeSingle(),
    ]);

    const planById: Record<string, PlanInfo & { id: string }> = {};
    for (const p of plansRes.data ?? []) planById[p.id] = p;
    for (const r of activeReqs) if (r.plan_id && planById[r.plan_id]) planMap[r.id] = planById[r.plan_id];

    const infoMap: Record<string, HotelInfo> = {};
    for (const h of infoRes.data ?? []) infoMap[h.id] = { name_he: h.name_he, address: h.address, map_url: h.map_url, arrival_instructions: h.arrival_instructions };
    if (Object.keys(infoMap).length) setHotelInfoById(infoMap);

    if (setnRes.data?.redemption_explainer) setExplainer(setnRes.data.redemption_explainer);

    // מלונות לכל הרמות הנדרשות בשאילתה אחת, ואז זמינות בשאילתה אחת
    const levels = Array.from(new Set(Object.values(planMap).map(p => p.hotel_level)));
    if (levels.length) {
      const { data: hotelsData } = await supabase
        .from('hotels')
        .select(`id, name_he, city_he, level, bookable_days, ${HOTEL_PACKAGE_COLUMNS}, images:hotel_images(image_url, display_order)`)
        .eq('active', true).in('level', levels).order('name_he');
      const byLevel: Record<string, Hotel[]> = {};
      for (const h of (hotelsData ?? []) as Hotel[]) (byLevel[h.level] ??= []).push(h);
      for (const r of activeReqs) {
        const plan = planMap[r.id];
        if (plan) hotelsMap[r.id] = byLevel[plan.hotel_level] ?? [];
      }
      const allHotelIds = (hotelsData ?? []).map((h: Hotel) => h.id);
      if (allHotelIds.length) {
        const { data: av } = await supabase.from('hotel_availability').select('*').in('hotel_id', allHotelIds);
        for (const a of (av ?? []) as Avail[]) (availMap[a.hotel_id] ??= []).push(a);
      }
    }

    setPlanByReq(planMap);
    setHotelsByReq(hotelsMap);
    setAvailByHotel(availMap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    loadAll();
    supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false).then(() => {});
  }, [user]);

  // חישוב התאריכים המותרים ממורש (memoized) — רץ פעם אחת אחרי טעינה, לא בכל רינדור/הקשה
  const datesByReqHotel = useMemo(() => {
    const result: Record<string, string[]> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const [reqId, hs] of Object.entries(hotelsByReq)) {
      const planDays = planByReq[reqId]?.bookable_days ?? [];
      for (const hotel of hs) {
        const windows = availByHotel[hotel.id] ?? [];
        const effDays = effectiveBookableDays(hotel.bookable_days, planDays);
        const ok = (d: Date) => d >= today && isDayAllowed(d, effDays);
        const set = new Set<string>();
        for (const w of windows) {
          if (w.kind === 'date') { const d = parseDate(w.start_date); if (ok(d)) set.add(toKey(d)); }
          else {
            const s = parseDate(w.start_date); const e = w.end_date ? parseDate(w.end_date) : s;
            let count = 0;
            for (let d = new Date(s); d <= e && count < 400; d.setDate(d.getDate() + 1), count++) if (ok(d)) set.add(toKey(d));
          }
        }
        result[`${reqId}|${hotel.id}`] = Array.from(set).sort();
      }
    }
    return result;
  }, [hotelsByReq, planByReq, availByHotel]);

  const allowedDates = (reqId: string, hotelId: string): string[] => datesByReqHotel[`${reqId}|${hotelId}`] ?? [];

  const pickHotel = (reqId: string, hotelId: string) => {
    const isOpen = selHotel[reqId] === hotelId;
    setSelHotel((p) => ({ ...p, [reqId]: isOpen ? null : hotelId }));
    setSelDate((p) => ({ ...p, [reqId]: null }));
    if (!isOpen) {
      const ds = allowedDates(reqId, hotelId);
      if (ds.length) { const d = parseDate(ds[0]); setCalBy((p) => ({ ...p, [reqId]: new Date(d.getFullYear(), d.getMonth(), 1) })); }
    }
  };

  const submit = async (req: Req) => {
    const hotelId = selHotel[req.id]; const dateKey = selDate[req.id];
    if (!hotelId || !dateKey || !user) return;
    const guest = guestBy[req.id] ?? emptyGuestDetails();
    const guestError = validateGuestDetails(guest, user.email);
    setGuestErrorBy((p) => ({ ...p, [req.id]: guestError ?? '' }));
    if (guestError) return;
    setSubmittingId(req.id);
    const hotel = (hotelsByReq[req.id] ?? []).find(h => h.id === hotelId);
    const nights = hotel?.bookable_nights ?? 1;
    const ci = parseDate(dateKey);
    const co = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate() + nights);
    const { data: updated, error } = await supabase.from('immediate_requests').update({
      selected_hotel_id: hotelId, selected_date: dateKey, selected_end_date: toKey(co),
      user_note: noteBy[req.id] || null, status: 'awaiting_admin', updated_at: new Date().toISOString(),
      ...guestColumns(guest, user.email),
    }).eq('id', req.id).select('id');
    if (error) { setSubmittingId(null); alert('שגיאה: ' + error.message); return; }
    if (!updated || updated.length === 0) { setSubmittingId(null); alert('לא ניתן היה לשמור (בעיית הרשאה). פנה לתמיכה.'); return; }

    await createNotification({
      for_admin: true, type: 'immediate_selection', title: 'מימוש מיידי — המשתמש בחר מקום ותאריך',
      body: `נבחר: ${hotel?.name_he ?? ''} · כניסה ${ci.toLocaleDateString('he-IL')} → יציאה ${co.toLocaleDateString('he-IL')} (${nights} ${nights === 1 ? 'לילה' : 'לילות'}). יש לבדוק זמינות מול בעל המקום.`,
      link: '/admin/immediate-requests',
      email: { toAdmin: true },
    });
    setSubmittingId(null);
    setLoading(true); await loadAll();
  };

  // בקשת שינוי תאריך/מקום — נשמר כ-pending, האישור הקיים נשאר תקף עד הכרעת המנהל
  const submitChange = async (req: Req) => {
    const hotelId = selHotel[req.id]; const dateKey = selDate[req.id];
    if (!hotelId || !dateKey || !user) return;
    setSubmittingId(req.id);
    const hotel = (hotelsByReq[req.id] ?? []).find(h => h.id === hotelId);
    const nights = hotel?.bookable_nights ?? 1;
    const ci = parseDate(dateKey);
    const co = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate() + nights);
    const { data: updated, error } = await supabase.from('immediate_requests').update({
      pending_hotel_id: hotelId, pending_date: dateKey, pending_end_date: toKey(co),
      pending_note: noteBy[req.id] || null, change_requested: true, updated_at: new Date().toISOString(),
    }).eq('id', req.id).select('id');
    if (error) { setSubmittingId(null); alert('שגיאה: ' + error.message); return; }
    if (!updated || updated.length === 0) { setSubmittingId(null); alert('לא ניתן היה לשמור (בעיית הרשאה).'); return; }
    await createNotification({
      for_admin: true, type: 'immediate_change', title: 'מימוש מיידי — בקשת שינוי תאריך/מקום',
      body: `${req.plan_name_he || 'משתמש'} מבקש לשנות ל: ${hotel?.name_he ?? ''} · כניסה ${ci.toLocaleDateString('he-IL')} → יציאה ${co.toLocaleDateString('he-IL')}. יש לאשר/לדחות.`,
      link: '/admin/immediate-requests',
      email: { toAdmin: true },
    });
    setChangeMode((p) => ({ ...p, [req.id]: false }));
    setSubmittingId(null);
    setLoading(true); await loadAll();
  };

  const removeOrder = async (reqId: string) => {
    if (!confirm('להסיר את ההזמנה מהרשימה? הפעולה תסיר אותה גם אצלך וגם אצל המנהל.')) return;
    await supabase.from('immediate_requests').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', reqId);
    setRequests((p) => p.filter((r) => r.id !== reqId));
  };

  const renderCalendar = (req: Req, hotelId: string, mode: 'book' | 'change' = 'book') => {
    const dates = allowedDates(req.id, hotelId);
    const allowedSet = new Set(dates);
    const selH = (hotelsByReq[req.id] ?? []).find((h) => h.id === hotelId);
    const nights = selH?.bookable_nights ?? 1;
    const cal = calBy[req.id] ?? new Date();
    const year = cal.getFullYear(); const month = cal.getMonth();
    const firstOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(firstOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    const monthName = cal.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    const dk = selDate[req.id];
    const checkInD = dk ? parseDate(dk) : null;
    const checkOutD = checkInD ? new Date(checkInD.getFullYear(), checkInD.getMonth(), checkInD.getDate() + nights) : null;
    const setMonth = (d: Date) => setCalBy((p) => ({ ...p, [req.id]: d }));

    return (
      <div className="px-4 pb-5 pt-4 border-t border-[#E5E1D8]/50">
        <p className="text-xs text-[#33332D]/55 mb-3 flex items-center gap-1.5">
          <Moon size={12} className="text-[#626D58]" /> שהייה של {nights} {nights === 1 ? 'לילה' : 'לילות'} · בחרו תאריך כניסה
        </p>
        {dates.length === 0 ? (
          <div className="text-center text-[#33332D]/40 text-sm py-4">אין תאריכים זמינים למקום זה כרגע.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-[#E5E1D8]/60 p-4 max-w-sm">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setMonth(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-[#F7F5F0] text-[#33332D]/50"><ChevronRight size={18} /></button>
                <span className="text-sm font-bold text-[#0A192F]">{monthName}</span>
                <button onClick={() => setMonth(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-[#F7F5F0] text-[#33332D]/50"><ChevronLeft size={18} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d) => <div key={d} className="text-center text-[10px] font-bold text-[#33332D]/35 py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const cd = new Date(year, month, day); const key = toKey(cd);
                  const avail = allowedSet.has(key);
                  const isCheckin = dk === key;
                  const isCheckout = checkOutD != null && cd.getTime() === checkOutD.getTime();
                  const inStay = checkInD != null && checkOutD != null && cd > checkInD && cd < checkOutD;
                  return (
                    <button key={i} disabled={!avail} onClick={() => setSelDate((p) => ({ ...p, [req.id]: key }))}
                      className={`aspect-square rounded-lg text-sm font-semibold transition-all ${
                        isCheckin ? 'bg-[#0A192F] text-white shadow-md'
                        : isCheckout ? 'bg-[#0A192F]/70 text-white'
                        : inStay ? 'bg-[#626D58]/30 text-[#0A192F]'
                        : avail ? 'bg-[#626D58]/12 text-[#626D58] hover:bg-[#626D58]/25 ring-1 ring-[#626D58]/20'
                        : 'text-[#33332D]/20 cursor-not-allowed'}`}>{day}</button>
                  );
                })}
              </div>
            </div>

            <div>
              {checkInD && checkOutD ? (
                <>
                  <div className="rounded-xl bg-[#0A192F]/4 border border-[#0A192F]/10 px-4 py-3 mb-3 text-sm text-[#0A192F] font-semibold">
                    <Star size={13} className="inline text-[#626D58] ms-1" fill="currentColor" />
                    {checkInD.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })} → {checkOutD.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })} · {nights} {nights === 1 ? 'לילה' : 'לילות'}
                  </div>
                  {mode === 'book' && (
                    <div className="mb-3">
                      <GuestDetailsFields value={guestBy[req.id] ?? emptyGuestDetails()}
                        onChange={(v) => setGuestBy((p) => ({ ...p, [req.id]: v }))} accountEmail={user?.email} />
                      {guestErrorBy[req.id] && <p className="text-xs text-red-600 mt-2">{guestErrorBy[req.id]}</p>}
                    </div>
                  )}
                  <textarea value={noteBy[req.id] ?? ''} onChange={(e) => setNoteBy((p) => ({ ...p, [req.id]: e.target.value }))} rows={3} placeholder="הערה (אופציונלי): בקשות מיוחדות, מספר אורחים..."
                    className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] resize-none mb-3" />
                  <button onClick={() => mode === 'change' ? submitChange(req) : submit(req)} disabled={submittingId === req.id}
                    className="w-full py-3.5 rounded-xl bg-[#0A192F] text-white font-bold text-sm hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {submittingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} {mode === 'change' ? 'שלח בקשת שינוי לאישור' : 'שלח בקשת הזמנה לאישור'}
                  </button>
                  <p className="text-xs text-[#33332D]/40 text-center mt-2">{mode === 'change' ? 'ההזמנה הקיימת נשארת בתוקף עד שנאשר את השינוי.' : 'נבדוק זמינות מול המקום ונחזור אליך עם אישור סופי.'}</p>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-[#33332D]/40 text-center p-4">בחרו תאריך כניסה ביומן</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHotelPicker = (req: Req, mode: 'book' | 'change') => {
    const hotels = hotelsByReq[req.id] ?? [];
    if (hotels.length === 0) return <div className="bg-[#F7F5F0] rounded-2xl p-8 text-center text-[#33332D]/40 text-sm">אין כרגע מלונות זמינים בתוכנית זו.</div>;
    return (
      <div className="space-y-3">
        {hotels.map((h) => {
          const cover = (h.images ?? []).sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
          const count = allowedDates(req.id, h.id).length;
          const active = selHotel[req.id] === h.id;
          return (
            <div key={h.id} className={`rounded-2xl overflow-hidden border-2 transition-all ${active ? 'border-[#626D58] shadow-md' : 'border-[#E5E1D8]/60 hover:border-[#626D58]/40'}`}>
              <button onClick={() => pickHotel(req.id, h.id)} className="w-full text-right flex items-center gap-4 p-3">
                <div className="w-24 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex items-center justify-center shrink-0">
                  {cover ? <img src={cover} alt={h.name_he} className="w-full h-full object-cover" loading="lazy" /> : <HotelIcon className="text-[#33332D]/15" size={28} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-[#33332D]/40 mb-0.5"><MapPin size={11} className="text-[#626D58]" />{h.city_he}</div>
                  <h3 className="font-bold text-[#0A192F] text-base mb-0.5">{h.name_he}</h3>
                  <span className={`text-[11px] font-semibold ${count > 0 ? 'text-[#626D58]' : 'text-[#33332D]/30'}`}>{count > 0 ? `${count} תאריכים זמינים` : 'אין תאריכים זמינים כרגע'}</span>
                </div>
                <ChevronLeft size={20} className={`text-[#33332D]/30 shrink-0 transition-transform ${active ? '-rotate-90' : ''}`} />
              </button>
              <HotelNameWithDetails hotel={h} className="px-4 pb-3 -mt-1"><span className="sr-only">{h.name_he}</span></HotelNameWithDetails>
              {active && renderCalendar(req, h.id, mode)}
            </div>
          );
        })}
      </div>
    );
  };

  // כפתור/אזור בקשת שינוי להזמנה שכבר נשלחה/אושרה
  const changeSection = (req: Req) => {
    const on = changeMode[req.id];
    return (
      <div className="mt-4">
        {!on ? (
          <button onClick={() => { setChangeMode((p) => ({ ...p, [req.id]: true })); setSelHotel((p) => ({ ...p, [req.id]: null })); setSelDate((p) => ({ ...p, [req.id]: null })); }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#626D58] hover:text-[#626D58]/80">
            <Calendar size={14} /> בקשת שינוי תאריך / מקום
          </button>
        ) : (
          <div className="bg-[#F9F8F4] rounded-2xl border border-[#626D58]/25 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[#0A192F]">בחירת תאריך/מקום חדש</p>
              <button onClick={() => setChangeMode((p) => ({ ...p, [req.id]: false }))} className="text-xs text-[#33332D]/45 hover:text-[#33332D]">ביטול</button>
            </div>
            {renderHotelPicker(req, 'change')}
          </div>
        )}
      </div>
    );
  };

  const renderRequest = (req: Req) => {
    const s = req.status;
    if (s === 'pending_review') {
      return (
        <div key={req.id} className="flex items-start gap-4 p-6 rounded-2xl border border-[#D4B483]/40" style={{ backgroundColor: 'rgba(212,180,131,0.08)' }}>
          <div className="w-11 h-11 rounded-xl bg-[#D4B483]/15 flex items-center justify-center flex-shrink-0"><Clock className="text-[#B08D57]" size={22} /></div>
          <div>
            <p className="font-bold text-[#0A192F] text-lg mb-1">אנחנו בודקים שהכל תקין ✓</p>
            <p className="text-sm text-[#33332D]/60 font-light leading-relaxed">קיבלנו את התשלום{req.plan_name_he ? ` בתוכנית "${req.plan_name_he}"` : ''}. מיד נפתח לך את אפשרות בחירת המקום והתאריך.</p>
          </div>
        </div>
      );
    }
    if (s === 'booking_open') {
      const plan = planByReq[req.id];
      return (
        <div key={req.id} className="bg-white rounded-2xl border border-[#626D58]/30 p-5" style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.08)' }}>
          <div className="mb-4">
            <h2 className="text-xl font-black text-[#0A192F]">בחירת נופש 🎉</h2>
            <p className="text-[#33332D]/50 text-sm mt-1 font-light">
              תוכנית <b className="text-[#0A192F]">{plan?.name_he || req.plan_name_he}</b> · ימי כניסה: <b className="text-[#626D58]">{formatBookableDays(plan?.bookable_days)}</b> · בחרו מקום ולחצו לבחירת תאריך
            </p>
          </div>
          {renderHotelPicker(req, 'book')}
        </div>
      );
    }
    if (s === 'awaiting_admin') {
      return (
        <div key={req.id} className="flex items-start gap-4 p-6 rounded-2xl border border-[#D4B483]/40" style={{ backgroundColor: 'rgba(212,180,131,0.08)' }}>
          <div className="w-11 h-11 rounded-xl bg-[#D4B483]/15 flex items-center justify-center flex-shrink-0"><Clock className="text-[#B08D57]" size={22} /></div>
          <div className="flex-1">
            <p className="font-bold text-[#0A192F] text-lg mb-1">בחירתך התקבלה — ממתינים לאישור</p>
            <p className="text-sm text-[#33332D]/60 font-light leading-relaxed mb-3">אנחנו בודקים את הזמינות מול המקום שבחרת ונחזור אליך עם אישור סופי בהקדם.</p>
            <div className="rounded-xl bg-white border border-[#E5E1D8]/60 px-4 py-3 text-sm inline-block">
              <div className="flex items-center gap-2 text-[#0A192F] font-semibold mb-0.5"><MapPin size={13} className="text-[#626D58]" />{req.selected_hotel_id ? hotelInfoById[req.selected_hotel_id]?.name_he : ''}</div>
              {req.selected_date && <div className="flex items-center gap-2 text-[#33332D]/70"><Calendar size={13} className="text-[#626D58]" />{fmtRange(req.selected_date, req.selected_end_date)}</div>}
            </div>
            <div className="mt-3 text-xs text-[#33332D]/55 leading-relaxed bg-white/60 rounded-xl px-4 py-3 border border-[#E5E1D8]/50 whitespace-pre-line">{explainer}</div>
            {req.change_requested
              ? <div className="mt-3 text-xs font-semibold text-[#626D58] bg-[#626D58]/8 rounded-xl px-3 py-2 inline-block">בקשת השינוי שלך נשלחה — ממתינה לאישור</div>
              : changeSection(req)}
          </div>
        </div>
      );
    }
    if (s === 'confirmed') {
      const info = req.selected_hotel_id ? hotelInfoById[req.selected_hotel_id] : undefined;
      return (
        <div key={req.id} className="flex items-start gap-4 p-6 rounded-2xl border border-[#626D58]/40" style={{ backgroundColor: 'rgba(98,109,88,0.07)' }}>
          <div className="w-11 h-11 rounded-xl bg-[#626D58]/15 flex items-center justify-center flex-shrink-0"><CheckCircle className="text-[#626D58]" size={22} /></div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-[#0A192F] text-lg mb-1">ההזמנה אושרה! 🎉</p>
              <button onClick={() => removeOrder(req.id)} title="הסר הזמנה" className="p-2 rounded-lg text-[#33332D]/30 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"><Trash2 size={16} /></button>
            </div>
            <p className="text-sm text-[#33332D]/60 font-light leading-relaxed mb-3">{req.admin_note || 'הפרטים המלאים נשלחו אליך למייל. חופשה נעימה!'}</p>
            <div className="rounded-xl bg-white border border-[#E5E1D8]/60 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-[#0A192F] font-semibold mb-0.5"><MapPin size={13} className="text-[#626D58]" />{info?.name_he}</div>
              {req.selected_date && <div className="flex items-center gap-2 text-[#33332D]/70 mb-1"><Calendar size={13} className="text-[#626D58]" />{fmtRange(req.selected_date, req.selected_end_date)}</div>}
              {info?.address && <div className="text-xs text-[#33332D]/60 mb-1">📍 {info.address}</div>}
              {info?.map_url && <a href={info.map_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#626D58] font-semibold hover:underline inline-flex items-center gap-1 mb-1"><MapPin size={11} /> פתח במפה</a>}
              {info?.arrival_instructions && <div className="text-xs text-[#33332D]/60 mt-1 whitespace-pre-line border-t border-[#E5E1D8]/50 pt-2">{info.arrival_instructions}</div>}
            </div>
            {req.voucher_url && (
              <a href={req.voucher_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0A192F]/90">
                <Star size={14} fill="currentColor" /> הורד שובר / מסמך
              </a>
            )}
            <div className="mt-3 text-xs text-[#33332D]/55 leading-relaxed bg-white/60 rounded-xl px-4 py-3 border border-[#E5E1D8]/50 whitespace-pre-line">{explainer}</div>
            {req.change_requested
              ? <div className="mt-3 text-xs font-semibold text-[#626D58] bg-[#626D58]/8 rounded-xl px-3 py-2 inline-block">בקשת השינוי שלך נשלחה — ההזמנה הנוכחית בתוקף עד שנאשר</div>
              : changeSection(req)}
          </div>
        </div>
      );
    }
    if (s === 'rejected') {
      return (
        <div key={req.id} className="flex items-start gap-4 p-6 rounded-2xl border border-red-300" style={{ backgroundColor: 'rgba(239,68,68,0.06)' }}>
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0"><AlertTriangle className="text-red-600" size={22} /></div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-red-800 text-lg mb-1">יש בעיה עם ההזמנה שלך</p>
              <button onClick={() => removeOrder(req.id)} title="הסר" className="p-2 rounded-lg text-[#33332D]/30 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"><Trash2 size={16} /></button>
            </div>
            <p className="text-sm text-red-700/80 font-light leading-relaxed">{req.admin_note || 'נא ליצור איתנו קשר דרך עמוד התמיכה כדי להשלים את התהליך.'}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const hero = (
    <div className="relative rounded-[2rem] overflow-hidden mb-8 h-44 md:h-52">
      <img src={heroHotelImg} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-l from-[#0A192F]/75 via-[#0A192F]/30 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center px-8">
        <h1 className="text-3xl md:text-4xl font-black text-white mb-1">ההזמנות שלי</h1>
        <p className="text-white/70 text-sm font-light">מעקב אחר תהליך החופשה שלך</p>
      </div>
    </div>
  );

  if (loading) return <DonorLayout>{hero}<div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div></DonorLayout>;

  return (
    <DonorLayout>
      <div dir="rtl">
        {hero}
        {openChecks.length > 0 && (
          <div className="space-y-3 mb-6">
            {openChecks.map((c) => {
              const payable = isPayable(c);
              const label = c.status === 'pending' ? 'בודקים זמינות — עוד לא חויבת'
                : payable ? 'יש מקום! אפשר להמשיך לתשלום'
                : isExpired(c) ? 'אישור הזמינות פג — אפשר לבקש שוב' : 'התאריכים לא פנויים — אפשר לבחור אחרים';
              return (
                <button key={c.id} onClick={() => navigate(`/availability-check?plan=${c.plan_id}`)}
                  className={`w-full text-right flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md ${
                    payable ? 'border-[#626D58]/40 bg-[#626D58]/5' : c.status === 'pending' ? 'border-[#D4B483]/40 bg-[#D4B483]/5' : 'border-amber-300 bg-amber-50/50'
                  }`}>
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                    {payable ? <CheckCircle className="text-[#626D58]" size={20} /> : c.status === 'pending' ? <Clock className="text-[#B08D57]" size={20} /> : <AlertTriangle className="text-amber-600" size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0A192F]">{label}</p>
                    <p className="text-xs text-[#33332D]/55 truncate">{c.plan_name_he} · {c.hotel_name} · {fmtRequestedDates(c)}</p>
                  </div>
                  <ChevronLeft size={18} className="text-[#33332D]/30 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
        {requests.length === 0 && openChecks.length === 0 ? (
          <div className="text-center py-16">
            <HotelIcon className="text-[#33332D]/15 mx-auto mb-3" size={40} />
            <p className="text-[#33332D]/50 mb-6">אין לך כרגע הזמנות פעילות.</p>
            <button onClick={() => navigate('/plans')} className="px-6 py-3 bg-[#0A192F] text-white rounded-xl font-semibold text-sm">לבחירת תוכנית</button>
          </div>
        ) : (
          <div className="space-y-5">
            {requests.length > 1 && <p className="text-sm text-[#33332D]/50">יש לך {requests.length} הזמנות פעילות</p>}
            {requests.map(renderRequest)}
          </div>
        )}
      </div>
    </DonorLayout>
  );
}
