import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../hooks/useNotifications';
import {
  AvailabilityCheck, AVAILABILITY_VALID_HOURS, isExpired, fmtRequestedDates, fmtDay, fmtExpiry,
} from '../../lib/availabilityChecks';
import {
  CalendarSearch, CheckCircle, XCircle, Loader2, Mail, Phone, MapPin, Calendar,
  MessageSquare, X, Send, RotateCcw, Clock, BadgeCheck, Trash2,
} from 'lucide-react';

type Tab = 'pending' | 'waitingPayment' | 'closed' | 'history';

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'pending', label: 'ממתין לבדיקה שלך', empty: 'אין בקשות שמחכות לבדיקה' },
  { key: 'waitingPayment', label: 'זמין — ממתין לתשלום', empty: 'אין לקוחות שאושרו ועוד לא שילמו' },
  { key: 'closed', label: 'לא זמין / פג תוקף', empty: 'אין' },
  { key: 'history', label: 'שילמו / בוטלו', empty: 'אין עדיין היסטוריה' },
];

const tabOf = (c: AvailabilityCheck): Tab => {
  if (c.status === 'pending') return 'pending';
  if (c.status === 'available') return isExpired(c) ? 'closed' : 'waitingPayment';
  if (c.status === 'unavailable') return 'closed';
  return 'history';
};

const expiresAtFromNow = () => new Date(Date.now() + AVAILABILITY_VALID_HOURS * 3600 * 1000).toISOString();

interface AnswerModal {
  check: AvailabilityCheck;
  type: 'available' | 'unavailable';
}

export const AdminAvailabilityChecksPage = () => {
  const [checks, setChecks] = useState<AvailabilityCheck[]>([]);
  const [hotels, setHotels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modal, setModal] = useState<AnswerModal | null>(null);
  const [mHotel, setMHotel] = useState('');
  const [mFrom, setMFrom] = useState('');
  const [mTo, setMTo] = useState('');
  const [mNote, setMNote] = useState('');
  const [mError, setMError] = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    const [cRes, hRes] = await Promise.all([
      supabase.from('availability_checks').select('*').order('created_at', { ascending: false }),
      supabase.from('hotels').select('id, name_he'),
    ]);
    setChecks((cRes.data ?? []) as AvailabilityCheck[]);
    const map: Record<string, string> = {};
    for (const h of hRes.data ?? []) map[h.id] = h.name_he;
    setHotels(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openModal = (check: AvailabilityCheck, type: AnswerModal['type']) => {
    setModal({ check, type });
    setMHotel(check.hotel_id);
    // תאריכים מדויקים — ממלאים מראש; טווח גמיש — המנהל רושם מה מצא
    setMFrom(check.date_mode === 'exact' ? check.date_from : '');
    setMTo(check.date_mode === 'exact' ? check.date_to : '');
    setMNote('');
    setMError('');
  };

  const notifyUser = async (c: AvailabilityCheck, title: string, body: string) => {
    await createNotification({
      recipient_id: c.user_id,
      type: 'availability_check_answer',
      title,
      body,
      link: `/availability-check?plan=${c.plan_id}`,
      email: { to: c.user_email, donorName: c.user_full_name },
    });
  };

  const submitAnswer = async () => {
    if (!modal) return;
    const { check: c, type } = modal;
    setMError('');

    if (type === 'available') {
      if (!mFrom || !mTo) return setMError('נא לרשום את התאריכים שפנויים');
      if (mTo < mFrom) return setMError('תאריך היציאה לפני תאריך הכניסה');
      setBusyId(c.id);
      const expires_at = expiresAtFromNow();
      const { error } = await supabase.from('availability_checks').update({
        status: 'available', approved_hotel_id: mHotel, approved_date: mFrom, approved_end_date: mTo,
        admin_note: mNote.trim() || null, responded_at: new Date().toISOString(), expires_at,
      }).eq('id', c.id);
      if (error) { setBusyId(null); return setMError('שגיאה: ' + error.message); }
      await notifyUser(c, 'יש מקום! אפשר להמשיך לתשלום 🎉',
        `בדקנו — ${hotels[mHotel] ?? ''} פנוי ב-${fmtDay(mFrom)} עד ${fmtDay(mTo)}. ` +
        `המקום שמור עבורך עד ${fmtExpiry(expires_at)}. כדי להבטיח אותו יש להשלים את התשלום עד אז.` +
        (mNote.trim() ? `\n${mNote.trim()}` : ''));
      showToast('✓ סומן זמין — הלקוח קיבל הודעה ומייל');
    } else {
      setBusyId(c.id);
      const { error } = await supabase.from('availability_checks').update({
        status: 'unavailable', admin_note: mNote.trim() || null, responded_at: new Date().toISOString(),
      }).eq('id', c.id);
      if (error) { setBusyId(null); return setMError('שגיאה: ' + error.message); }
      await notifyUser(c, 'התאריכים שבחרת לא פנויים',
        (mNote.trim() || 'לצערנו המקום תפוס בתאריכים שבחרת.') + '\nאפשר להיכנס ולבחור תאריך או מקום אחר — ונבדוק שוב.');
      showToast('הלקוח עודכן שהמקום לא פנוי');
    }
    setModal(null);
    setBusyId(null);
    await load();
  };

  // אישור שפג — מחדשים ל-48 שעות נוספות (אחרי שבדקת שוב שזה עדיין פנוי)
  const renew = async (c: AvailabilityCheck) => {
    if (!confirm(`לחדש את האישור ל-${AVAILABILITY_VALID_HOURS} שעות נוספות? מומלץ לוודא קודם שהמקום עדיין פנוי.`)) return;
    setBusyId(c.id);
    const expires_at = expiresAtFromNow();
    await supabase.from('availability_checks').update({ expires_at, responded_at: new Date().toISOString() }).eq('id', c.id);
    await notifyUser(c, 'האישור חודש — אפשר לשלם',
      `המקום ב-${hotels[c.approved_hotel_id ?? ''] ?? ''} שמור עבורך שוב עד ${fmtExpiry(expires_at)}.`);
    setBusyId(null);
    showToast('✓ האישור חודש והלקוח עודכן');
    await load();
  };

  // התשלום עבר אבל לא נקלט אוטומטית (לא חזר לאתר / נדרים לא דיווח) — המנהל מאשר ידנית.
  // יוצרים את ההזמנה בלוח ההזמנות עם המקום והתאריכים שאושרו, בדיוק כמו בתשלום רגיל.
  const markPaid = async (c: AvailabilityCheck) => {
    if (!confirm(`לסמן ש-${c.user_full_name || 'הלקוח'} שילם?
ההזמנה תעבור ללוח ההזמנות עם ${hotels[c.approved_hotel_id ?? c.hotel_id] ?? 'המקום'} והתאריכים שאישרת.`)) return;
    setBusyId(c.id);
    const approved = {
      selected_hotel_id: c.approved_hotel_id ?? c.hotel_id,
      selected_date: c.approved_date,
      selected_end_date: c.approved_end_date,
      user_note: c.user_note,
      guest_names: c.guest_names,
      guest_address: c.guest_address,
      guest_email: c.guest_email,
    };
    let requestId = c.used_request_id;
    if (!requestId) {
      // אם הלקוח שילם בלי שהבדיקה קושרה — כבר נוצרה לו הזמנה באותה תוכנית. מקשרים אליה
      // ומעדכנים בה את המקום והתאריכים שאושרו, במקום ליצור הזמנה כפולה.
      const { data: existing } = await supabase.from('immediate_requests').select('id, status')
        .eq('user_id', c.user_id).eq('plan_id', c.plan_id).eq('archived', false)
        .in('status', ['pending_review', 'booking_open', 'awaiting_admin'])
        .gte('created_at', c.created_at).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('immediate_requests')
          .update({ ...approved, status: 'awaiting_admin', updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) { setBusyId(null); showToast('שגיאה בעדכון ההזמנה: ' + error.message); return; }
        requestId = existing.id;
      }
    }
    if (!requestId) {
      const { data: req, error } = await supabase.from('immediate_requests').insert({
        user_id: c.user_id,
        plan_id: c.plan_id,
        status: 'awaiting_admin',
        plan_name_he: c.plan_name_he,
        user_full_name: c.user_full_name,
        ...approved,
      }).select('id').single();
      if (error) { setBusyId(null); showToast('שגיאה ביצירת ההזמנה: ' + error.message); return; }
      requestId = req.id;
    }
    const { error } = await supabase.from('availability_checks').update({ status: 'used', used_request_id: requestId }).eq('id', c.id);
    setBusyId(null);
    if (error) { showToast('שגיאה: ' + error.message); return; }
    showToast('✓ סומן כשולם — ההזמנה עברה ללוח ההזמנות');
    await load();
  };

  const removeCheck = async (c: AvailabilityCheck) => {
    if (!confirm(`למחוק את הבקשה של ${c.user_full_name || 'הלקוח'}? היא תיעלם גם אצל הלקוח. אין אפשרות לשחזר.`)) return;
    setBusyId(c.id);
    const { error } = await supabase.from('availability_checks').delete().eq('id', c.id);
    setBusyId(null);
    if (error) { showToast('שגיאה במחיקה: ' + error.message); return; }
    showToast('הבקשה נמחקה');
    await load();
  };

  const counts: Record<Tab, number> = { pending: 0, waitingPayment: 0, closed: 0, history: 0 };
  for (const c of checks) counts[tabOf(c)]++;
  const visible = checks.filter((c) => tabOf(c) === tab);

  const statusBadge = (c: AvailabilityCheck) => {
    if (c.status === 'pending') return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">ממתין לבדיקה</span>;
    if (c.status === 'available' && isExpired(c)) return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">פג תוקף — לא שילם</span>;
    if (c.status === 'available') return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">זמין — ממתין לתשלום</span>;
    if (c.status === 'unavailable') return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">לא זמין</span>;
    if (c.status === 'used') return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">שילם — עבר ללוח ההזמנות</span>;
    return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">בוטל ע״י הלקוח</span>;
  };

  return (
    <AdminLayout>
      <div dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#D4B483]/15 flex items-center justify-center">
            <CalendarSearch className="text-[#B08D57]" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0A192F]">בדיקות זמינות לפני תשלום</h1>
            <p className="text-sm text-[#33332D]/50">לקוחות מימוש מיידי שחשוב להם מקום ותאריך — עוד לא שילמו</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-[#E5E1D8] overflow-x-auto overflow-y-hidden">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 whitespace-nowrap ${tab === key ? 'border-[#0A192F] text-[#0A192F]' : 'border-transparent text-[#33332D]/45 hover:text-[#33332D]'}`}>
              {label}
              {counts[key] > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  key === 'pending' ? 'bg-red-500 text-white' : tab === key ? 'bg-[#0A192F] text-white' : 'bg-[#E5E1D8] text-[#33332D]/60'
                }`}>{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-12 text-center">
            <CalendarSearch className="text-[#33332D]/15 mx-auto mb-3" size={36} />
            <p className="text-[#33332D]/40">{TABS.find((t) => t.key === tab)?.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((c) => {
              const busy = busyId === c.id;
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-5" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.06)' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {statusBadge(c)}
                        <span className="text-[11px] text-[#33332D]/35">
                          נשלח {new Date(c.created_at).toLocaleDateString('he-IL')} · {new Date(c.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0A192F]">{c.user_full_name || 'לקוח'}</h3>
                      <div className="mt-1 space-y-0.5 text-sm">
                        {c.user_phone && (
                          <a href={`tel:${c.user_phone}`} className="flex items-center gap-1.5 text-[#0A192F] hover:underline font-semibold">
                            <Phone size={13} className="text-[#626D58]" />{c.user_phone}
                          </a>
                        )}
                        {c.user_email && (
                          <a href={`mailto:${c.user_email}`} className="flex items-center gap-1.5 text-[#33332D]/60 hover:underline">
                            <Mail size={13} className="text-[#626D58]" />{c.user_email}
                          </a>
                        )}
                        <p className="text-[#33332D]/55">תוכנית: {c.plan_name_he || '—'}</p>
                      </div>

                      <div className="mt-3 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8]/60 px-4 py-3 space-y-1 text-sm">
                        <div className="text-[11px] font-bold text-[#33332D]/45 mb-1">מה הלקוח ביקש</div>
                        <div className="flex items-center gap-2 text-[#0A192F]">
                          <MapPin size={13} className="text-[#626D58]" />
                          <span className="font-semibold">{hotels[c.hotel_id] ?? '—'}</span>
                          {c.alt_hotel_id && <span className="text-[#33332D]/55">· אפשרות ב׳: {hotels[c.alt_hotel_id]}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[#33332D]/70"><Calendar size={13} className="text-[#626D58]" />{fmtRequestedDates(c)}</div>
                        {c.user_note && <div className="flex items-start gap-2 text-[#33332D]/60"><MessageSquare size={13} className="text-[#626D58] mt-0.5" />{c.user_note}</div>}
                        {c.guest_names && (
                          <div className="pt-1 mt-1 border-t border-[#E5E1D8]/60 text-[#33332D]/70 space-y-0.5">
                            <div><b className="font-semibold">אורחים:</b> {c.guest_names}</div>
                            {c.guest_address && <div><b className="font-semibold">כתובת:</b> {c.guest_address}</div>}
                            {c.guest_email && <div><b className="font-semibold">מייל להזמנה:</b> <span dir="ltr">{c.guest_email}</span></div>}
                          </div>
                        )}
                      </div>

                      {c.status !== 'pending' && c.responded_at && (
                        <div className="mt-2 text-sm text-[#33332D]/65 space-y-0.5">
                          {c.approved_hotel_id && c.approved_date && (
                            <div className="flex items-center gap-2"><CheckCircle size={13} className="text-green-600" />
                              אישרת: {hotels[c.approved_hotel_id]} · {fmtDay(c.approved_date)}{c.approved_end_date ? ` עד ${fmtDay(c.approved_end_date)}` : ''}
                            </div>
                          )}
                          {c.status === 'available' && c.expires_at && (
                            <div className="flex items-center gap-2 text-xs"><Clock size={12} />
                              {isExpired(c) ? 'פג ב-' : 'בתוקף עד '}{fmtExpiry(c.expires_at)}
                            </div>
                          )}
                          {c.admin_note && <div className="text-xs">הודעה ללקוח: {c.admin_note}</div>}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {c.status === 'pending' && (
                        <>
                          <button onClick={() => openModal(c, 'available')} disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all disabled:opacity-50">
                            <CheckCircle size={15} /> זמין
                          </button>
                          <button onClick={() => openModal(c, 'unavailable')} disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all disabled:opacity-50">
                            <XCircle size={15} /> לא זמין
                          </button>
                        </>
                      )}
                      {c.status === 'available' && (
                        <button onClick={() => markPaid(c)} disabled={busy}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all disabled:opacity-50">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />} סמן כשולם
                        </button>
                      )}
                      {c.status === 'available' && isExpired(c) && (
                        <button onClick={() => renew(c)} disabled={busy}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E5E1D8] text-[#33332D]/70 text-sm font-semibold hover:bg-[#F7F5F0] transition-all disabled:opacity-50">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} חדש ל-{AVAILABILITY_VALID_HOURS} שעות
                        </button>
                      )}
                      {c.status !== 'used' && (
                        <button onClick={() => removeCheck(c)} disabled={busy}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[#33332D]/40 text-xs font-semibold hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50">
                          <Trash2 size={13} /> מחק
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" dir="rtl" onClick={() => setModal(null)}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-[#0A192F]">{modal.type === 'available' ? 'סימון כזמין' : 'סימון כלא זמין'}</h2>
              <button onClick={() => setModal(null)} className="p-2 rounded-xl hover:bg-[#F7F5F0] text-[#33332D]/50"><X size={18} /></button>
            </div>

            {modal.type === 'available' ? (
              <>
                <p className="text-sm text-[#33332D]/55 mb-4">
                  {modal.check.user_full_name} יקבל הודעה ומייל שאפשר לשלם. המקום נשמר לו ל-{AVAILABILITY_VALID_HOURS} שעות.
                </p>
                <label className="block text-xs text-[#33332D]/55 mb-1.5">איזה מקום פנוי?</label>
                <div className="space-y-2 mb-4">
                  {[modal.check.hotel_id, modal.check.alt_hotel_id].filter(Boolean).map((hid) => (
                    <label key={hid} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer text-sm ${mHotel === hid ? 'border-[#626D58] bg-[#626D58]/5' : 'border-[#E5E1D8]'}`}>
                      <input type="radio" className="accent-[#626D58]" checked={mHotel === hid} onChange={() => setMHotel(hid as string)} />
                      <span className="font-semibold text-[#0A192F]">{hotels[hid as string]}</span>
                      {hid === modal.check.alt_hotel_id && <span className="text-xs text-[#33332D]/45">(אפשרות ב׳)</span>}
                    </label>
                  ))}
                </div>
                <label className="block text-xs text-[#33332D]/55 mb-1.5">
                  {modal.check.date_mode === 'flexible' ? `הלקוח גמיש (${fmtRequestedDates(modal.check)}) — איזה תאריכים מצאת?` : 'התאריכים שפנויים'}
                </label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <input type="date" value={mFrom} onChange={(e) => setMFrom(e.target.value)} className="border border-[#E5E1D8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0A192F]" />
                  <input type="date" value={mTo} min={mFrom} onChange={(e) => setMTo(e.target.value)} className="border border-[#E5E1D8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0A192F]" />
                </div>
              </>
            ) : (
              <p className="text-sm text-[#33332D]/55 mb-4">
                {modal.check.user_full_name} יקבל הודעה ומייל, ויוכל לבחור תאריך או מקום אחר. כדאי לכתוב מה כן פנוי:
              </p>
            )}

            <textarea value={mNote} onChange={(e) => setMNote(e.target.value)} rows={3}
              placeholder={modal.type === 'available' ? 'הודעה ללקוח (לא חובה)' : 'לדוגמה: התאריך תפוס, אבל יש מקום שבוע אחרי — 20–22 בנובמבר'}
              className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] resize-none mb-3" />

            {mError && <p className="text-sm text-red-600 mb-3">{mError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-xl border border-[#E5E1D8] text-[#33332D]/60 font-semibold text-sm hover:bg-[#F7F5F0]">ביטול</button>
              <button onClick={submitAnswer} disabled={busyId === modal.check.id}
                className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${modal.type === 'available' ? 'bg-[#626D58] hover:bg-[#626D58]/90' : 'bg-red-500 hover:bg-red-600'}`}>
                {busyId === modal.check.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                שלח ללקוח
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0A192F] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50">{toast}</div>
      )}
    </AdminLayout>
  );
};
