import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../hooks/useNotifications';
import {
  Zap, Clock, CheckCircle, XCircle, Loader2, Calendar, MapPin,
  MessageSquare, X, Send, Sparkles, AlertTriangle, Trash2, Mail, Phone,
  ArrowLeftCircle, ListChecks, BadgeCheck,
} from 'lucide-react';

interface ImmediateRequest {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: string;
  selected_hotel_id: string | null;
  selected_date: string | null;
  selected_end_date: string | null;
  change_requested: boolean | null;
  pending_hotel_id: string | null;
  pending_date: string | null;
  pending_end_date: string | null;
  pending_note: string | null;
  user_note: string | null;
  admin_note: string | null;
  plan_name_he: string | null;
  user_full_name: string | null;
  created_at: string;
  redemption_type: string | null;
  subscription_id: string | null;
  guest_names: string | null;
  guest_address: string | null;
  guest_email: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending_review: { label: 'ממתין לבדיקה', color: 'bg-amber-100 text-amber-700', icon: Clock },
  booking_open:   { label: 'נפתח להזמנה — ממתין לבחירת המשתמש', color: 'bg-blue-100 text-blue-700', icon: Sparkles },
  awaiting_admin: { label: 'המשתמש בחר — ממתין להכרעתך', color: 'bg-purple-100 text-purple-700', icon: Calendar },
  confirmed:      { label: 'אושר — ההזמנה בוצעה', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected:       { label: 'נדחה', color: 'bg-red-100 text-red-700', icon: XCircle },
};

// מה הצעד הבא שלך בכל שלב — כדי שלא צריך לזכור את התהליך בעל-פה
const NEXT_STEP: Record<string, string> = {
  pending_review: 'בדוק בנדרים פלוס שהתשלום עבר, ואז לחץ "פתח תוכנית להזמנה".',
  booking_open:   'הלקוח צריך לבחור מלון ותאריך באזור האישי. אם הוא מתעכב — כדאי להתקשר ולעזור לו.',
  awaiting_admin: 'בדוק זמינות מול המלון, הזמן, ולחץ "אשר הזמנה" (אפשר לצרף שובר).',
  confirmed:      'ההזמנה אושרה ללקוח. סמן בצ\'קליסט את מה שנשאר עד שהכל סגור.',
};

// צ'קליסט פנימי — נשמר ב-booking_admin_tracking, הלקוח לא רואה אותו
const CHECKLIST: { key: string; label: string }[] = [
  { key: 'payment_verified', label: 'תשלום אומת בנדרים' },
  { key: 'customer_contacted', label: 'דיברתי עם הלקוח' },
  { key: 'hotel_booked', label: 'הוזמן במלון' },
  { key: 'hotel_paid', label: 'שולם למלון' },
  { key: 'voucher_sent', label: 'שובר נשלח ללקוח' },
];

interface Tracking {
  checklist: Record<string, boolean>;
  internal_note: string | null;
}

type Tab = 'action' | 'waiting' | 'inProgress' | 'done';

export const AdminImmediateRequestsPage = () => {
  const [requests, setRequests] = useState<ImmediateRequest[]>([]);
  const [hotels, setHotels] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null; phone: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<ImmediateRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionModal, setActionModal] = useState<{ req: ImmediateRequest; type: 'confirm' | 'decline' } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionFile, setActionFile] = useState<File | null>(null);
  const [tab, setTab] = useState<Tab>('action');
  const [tracking, setTracking] = useState<Record<string, Tracking>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [reqRes, hotelsRes] = await Promise.all([
      supabase.from('immediate_requests').select('*').eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('hotels').select('id, name_he'),
    ]);
    const reqs = (reqRes.data ?? []) as ImmediateRequest[];
    setRequests(reqs);
    const map: Record<string, string> = {};
    for (const h of hotelsRes.data ?? []) map[h.id] = h.name_he;
    setHotels(map);

    // פרטי המשתמשים (שם + מייל + טלפון) כדי לדעת בדיוק מי מגיעה לו הזכות
    const userIds = Array.from(new Set(reqs.map((r) => r.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds);
      const pmap: Record<string, { full_name: string | null; email: string | null; phone: string | null }> = {};
      for (const p of profs ?? []) pmap[p.id] = { full_name: p.full_name, email: p.email, phone: p.phone };
      setProfiles(pmap);
    }

    if (reqs.length) {
      const { data: tr } = await supabase.from('booking_admin_tracking')
        .select('request_id, checklist, internal_note').in('request_id', reqs.map((r) => r.id));
      const tmap: Record<string, Tracking> = {};
      for (const t of tr ?? []) tmap[t.request_id] = { checklist: t.checklist ?? {}, internal_note: t.internal_note };
      setTracking(tmap);
    }
    setLoading(false);
  };

  const saveTracking = async (reqId: string, patch: Partial<Tracking>) => {
    const current = tracking[reqId] ?? { checklist: {}, internal_note: null };
    const next = { ...current, ...patch };
    setTracking((prev) => ({ ...prev, [reqId]: next }));
    const { error } = await supabase.from('booking_admin_tracking').upsert({
      request_id: reqId, checklist: next.checklist, internal_note: next.internal_note,
    });
    if (error) {
      setTracking((prev) => ({ ...prev, [reqId]: current }));
      showToast('שגיאה בשמירה: ' + error.message);
    }
  };

  const toggleCheck = (reqId: string, key: string) => {
    const checklist = { ...(tracking[reqId]?.checklist ?? {}) };
    checklist[key] = !checklist[key];
    saveTracking(reqId, { checklist });
  };

  const saveNote = (reqId: string) => {
    const draft = noteDrafts[reqId];
    if (draft === undefined || draft === (tracking[reqId]?.internal_note ?? '')) return;
    saveTracking(reqId, { internal_note: draft.trim() || null });
    showToast('ההערה נשמרה');
  };

  // הלקוח סגר איתך מחוץ למערכת (טלפון וכו') — מסמנים שההזמנה הושלמה, בלי לשלוח לו הודעה
  const markCompleted = async (req: ImmediateRequest) => {
    if (!confirm(`לסמן שההזמנה של ${profiles[req.user_id]?.full_name || req.user_full_name || 'הלקוח'} נבחרה והסתיימה?
היא תעבור ל"הושלם", וכל הצ'קליסט יסומן.`)) return;
    setBusyId(req.id);
    const { error } = await supabase.from('immediate_requests')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', req.id);
    if (error) { setBusyId(null); showToast('שגיאה: ' + error.message); return; }
    await saveTracking(req.id, { checklist: Object.fromEntries(CHECKLIST.map((c) => [c.key, true])) });
    await load();
    setBusyId(null);
    showToast('✓ סומן כהושלם');
  };

  const isChecklistDone = (reqId: string) => CHECKLIST.every((c) => tracking[reqId]?.checklist?.[c.key]);

  const openForBooking = async (req: ImmediateRequest) => {
    setBusyId(req.id);
    await supabase.from('immediate_requests').update({ status: 'booking_open', updated_at: new Date().toISOString() }).eq('id', req.id);
    await createNotification({
      recipient_id: req.user_id,
      type: 'booking_open',
      title: 'נפתחה לך האפשרות להזמין! 🎉',
      body: 'בדקנו שהכל תקין. אפשר עכשיו לבחור מקום ותאריך לחופשה באזור האישי.',
      link: '/donor/my-orders',
      email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
    });
    await load();
    setBusyId(null);
    showToast('✓ נפתח להזמנה והמשתמש קיבל התראה');
  };

  const doReject = async () => {
    if (!rejectModal) return;
    const req = rejectModal;
    setBusyId(req.id);
    await supabase.from('immediate_requests').update({ status: 'rejected', admin_note: rejectNote || null, updated_at: new Date().toISOString() }).eq('id', req.id);
    await createNotification({
      recipient_id: req.user_id,
      type: 'immediate_rejected',
      title: 'יש בעיה עם המימוש המיידי',
      body: rejectNote || 'נא ליצור איתנו קשר דרך עמוד התמיכה.',
      link: '/support',
      email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
    });
    await load();
    setBusyId(null);
    setRejectModal(null);
    setRejectNote('');
    showToast('הבקשה נדחתה והמשתמש עודכן');
  };

  const doAction = async () => {
    if (!actionModal) return;
    const { req, type } = actionModal;
    setBusyId(req.id);
    if (type === 'confirm') {
      // העלאת קובץ שובר (אם צורף) לבאקט הקיים
      let voucherUrl: string | null = null;
      if (actionFile) {
        const path = `vouchers/${req.id}-${Date.now()}-${actionFile.name.replace(/[^\w.\-]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('vacations').upload(path, actionFile, { upsert: true });
        if (upErr) { alert('שגיאה בהעלאת הקובץ: ' + upErr.message); setBusyId(null); return; }
        voucherUrl = supabase.storage.from('vacations').getPublicUrl(path).data.publicUrl;
      }
      await supabase.from('immediate_requests').update({ status: 'confirmed', admin_note: actionNote || null, voucher_url: voucherUrl, updated_at: new Date().toISOString() }).eq('id', req.id);
      await createNotification({
        recipient_id: req.user_id,
        type: 'immediate_confirmed',
        title: 'ההזמנה בוצעה בהצלחה! 🎉',
        body: actionNote || 'הפרטים המלאים נשלחו אליך למייל. חופשה נעימה!',
        link: '/donor/my-orders',
        email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
      });
    } else {
      // תאריך תפוס / תקלה — חוזר לבחירה
      await supabase.from('immediate_requests').update({
        status: 'booking_open', admin_note: actionNote || null,
        selected_hotel_id: null, selected_date: null, updated_at: new Date().toISOString(),
      }).eq('id', req.id);
      await createNotification({
        recipient_id: req.user_id,
        type: 'immediate_slot_taken',
        title: 'התאריך שבחרת אינו זמין',
        body: actionNote || 'התאריך/המקום שבחרת נתפס. אפשר להיכנס ולבחור מקום או תאריך אחר.',
        link: '/donor/my-orders',
        email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
      });
    }
    await load();
    setBusyId(null);
    setActionModal(null);
    setActionNote('');
    setActionFile(null);
    showToast(type === 'confirm' ? '✓ ההזמנה אושרה והמשתמש עודכן' : 'המשתמש עודכן לבחור מחדש');
  };

  const approveChange = async (req: ImmediateRequest) => {
    setBusyId(req.id);
    await supabase.from('immediate_requests').update({
      selected_hotel_id: req.pending_hotel_id, selected_date: req.pending_date, selected_end_date: req.pending_end_date,
      user_note: req.pending_note, change_requested: false,
      pending_hotel_id: null, pending_date: null, pending_end_date: null, pending_note: null,
      status: 'confirmed', updated_at: new Date().toISOString(),
    }).eq('id', req.id);
    await createNotification({
      recipient_id: req.user_id, type: 'immediate_change_approved',
      title: 'בקשת השינוי אושרה! 🎉', body: 'התאריך/המקום החדש אושר. הפרטים המעודכנים בדף "ההזמנות שלי".', link: '/donor/my-orders',
      email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
    });
    await load(); setBusyId(null);
    showToast('✓ השינוי אושר והמשתמש עודכן');
  };

  const rejectChange = async (req: ImmediateRequest) => {
    setBusyId(req.id);
    await supabase.from('immediate_requests').update({
      change_requested: false, pending_hotel_id: null, pending_date: null, pending_end_date: null, pending_note: null,
      updated_at: new Date().toISOString(),
    }).eq('id', req.id);
    await createNotification({
      recipient_id: req.user_id, type: 'immediate_change_rejected',
      title: 'בקשת השינוי לא אושרה', body: 'לא ניתן היה לאשר את השינוי. ההזמנה הקיימת נשארת בתוקף. ניתן לפנות אלינו לפרטים.', link: '/donor/my-orders',
      email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
    });
    await load(); setBusyId(null);
    showToast('בקשת השינוי נדחתה; ההזמנה הקיימת נשארה');
  };

  const archiveRequest = async (req: ImmediateRequest) => {
    const waiting = ['pending_review', 'booking_open', 'awaiting_admin'].includes(req.status) || req.change_requested;
    const msg = waiting
      ? `⚠️ שים לב: ${req.user_full_name || 'הלקוח'} ממתין/ה לתשובה במימוש מיידי!\nמחיקה תסיר את הבקשה לגמרי גם אצל הלקוח, ללא אפשרות שחזור.\n\nלמחוק בכל זאת?`
      : 'להסיר את ההזמנה מהרשימה? היא תיעלם גם אצל המשתמש.';
    if (!confirm(msg)) return;
    await supabase.from('immediate_requests').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', req.id);
    await load();
    showToast('ההזמנה הוסרה');
  };

  // הטאבים לפי "מי צריך לפעול עכשיו": אתה · הלקוח · סגירת קצוות אחרי אישור · סגור
  const tabOf = (r: ImmediateRequest): Tab => {
    if (r.change_requested) return 'action';
    if (['pending_review', 'awaiting_admin'].includes(r.status)) return 'action';
    if (r.status === 'booking_open') return 'waiting';
    if (r.status === 'confirmed' && !isChecklistDone(r.id)) return 'inProgress';
    return 'done';
  };
  const counts: Record<Tab, number> = { action: 0, waiting: 0, inProgress: 0, done: 0 };
  for (const r of requests) counts[tabOf(r)]++;
  const visibleRequests = requests.filter(r => tabOf(r) === tab);
  const TABS: { key: Tab; label: string; empty: string }[] = [
    { key: 'action', label: 'דורש טיפול שלך', empty: 'אין כרגע בקשות שמחכות לך' },
    { key: 'waiting', label: 'ממתין לבחירת הלקוח', empty: 'אין לקוחות שמחכים לבחור מלון' },
    { key: 'inProgress', label: 'אושר — בסגירה', empty: 'אין הזמנות מאושרות שנשאר בהן משהו לסגור' },
    { key: 'done', label: 'הושלם / נדחה', empty: 'אין עדיין הזמנות סגורות' },
  ];

  return (
    <AdminLayout>
      <div dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#D4B483]/15 flex items-center justify-center">
            <Zap className="text-[#B08D57]" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0A192F]">לוח הזמנות</h1>
            <p className="text-sm text-[#33332D]/50">כל לקוח שמגיע לו מלון — מהבדיקה ועד שהשובר אצלו</p>
          </div>
        </div>

        {/* טאבים */}
        <div className="flex gap-2 mb-6 border-b border-[#E5E1D8] overflow-x-auto overflow-y-hidden">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 whitespace-nowrap ${tab === key ? 'border-[#0A192F] text-[#0A192F]' : 'border-transparent text-[#33332D]/45 hover:text-[#33332D]'}`}>
              {label}
              {counts[key] > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  key === 'action' ? 'bg-red-500 text-white' : tab === key ? 'bg-[#0A192F] text-white' : 'bg-[#E5E1D8] text-[#33332D]/60'
                }`}>{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
        ) : visibleRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-12 text-center">
            <Zap className="text-[#33332D]/15 mx-auto mb-3" size={36} />
            <p className="text-[#33332D]/40">{TABS.find((t) => t.key === tab)?.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRequests.map((req) => {
              const meta = STATUS_META[req.status] ?? STATUS_META.pending_review;
              const Icon = meta.icon;
              const busy = busyId === req.id;
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-5" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.06)' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.color}`}>
                          <Icon size={12} /> {meta.label}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${req.redemption_type === 'regular' ? 'bg-slate-100 text-slate-600' : 'bg-[#D4B483]/15 text-[#B08D57]'}`}>
                          {req.redemption_type === 'regular' ? 'מסלול רגיל' : 'מימוש מיידי'}
                        </span>
                        <span className="text-[11px] text-[#33332D]/35">
                          {new Date(req.created_at).toLocaleDateString('he-IL')} · {new Date(req.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0A192F]">{profiles[req.user_id]?.full_name || req.user_full_name || 'משתמש'}</h3>
                      <div className="mt-1 space-y-0.5 text-sm">
                        {profiles[req.user_id]?.email && (
                          <a href={`mailto:${profiles[req.user_id]?.email}`} className="flex items-center gap-1.5 text-[#0A192F] hover:underline font-medium">
                            <Mail size={13} className="text-[#626D58]" />{profiles[req.user_id]?.email}
                          </a>
                        )}
                        {profiles[req.user_id]?.phone && (
                          <a href={`tel:${profiles[req.user_id]?.phone}`} className="flex items-center gap-1.5 text-[#33332D]/60 hover:underline">
                            <Phone size={13} className="text-[#626D58]" />{profiles[req.user_id]?.phone}
                          </a>
                        )}
                        <p className="text-[#33332D]/55">תוכנית: {req.plan_name_he || '—'}</p>
                      </div>

                      {/* בחירת המשתמש (בשלבים מתקדמים) */}
                      {(req.selected_hotel_id || req.selected_date) && (
                        <div className="mt-3 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8]/60 px-4 py-3 space-y-1">
                          {req.selected_hotel_id && (
                            <div className="flex items-center gap-2 text-sm text-[#0A192F]">
                              <MapPin size={13} className="text-[#626D58]" />
                              <span className="font-semibold">{hotels[req.selected_hotel_id] || req.selected_hotel_id}</span>
                            </div>
                          )}
                          {req.selected_date && (
                            <div className="flex items-center gap-2 text-sm text-[#33332D]/70">
                              <Calendar size={13} className="text-[#626D58]" />
                              <span>
                                כניסה {new Date(req.selected_date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                                {req.selected_end_date && <> · יציאה {new Date(req.selected_end_date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long' })}</>}
                              </span>
                            </div>
                          )}
                          {req.user_note && (
                            <div className="flex items-start gap-2 text-sm text-[#33332D]/60">
                              <MessageSquare size={13} className="text-[#626D58] mt-0.5" />
                              <span>{req.user_note}</span>
                            </div>
                          )}
                          {req.guest_names && (
                            <div className="pt-1.5 mt-1 border-t border-[#E5E1D8]/60 text-sm text-[#33332D]/70 space-y-0.5">
                              <div><b className="font-semibold">אורחים:</b> {req.guest_names}</div>
                              {req.guest_address && <div><b className="font-semibold">כתובת:</b> {req.guest_address}</div>}
                              {req.guest_email && <div><b className="font-semibold">מייל להזמנה:</b> <span dir="ltr">{req.guest_email}</span></div>}
                            </div>
                          )}
                        </div>
                      )}

                      {req.status === 'rejected' && req.admin_note && (
                        <p className="mt-2 text-xs text-red-600">סיבת דחייה: {req.admin_note}</p>
                      )}

                      {NEXT_STEP[req.status] && !req.change_requested && !(req.status === 'confirmed' && isChecklistDone(req.id)) && (
                        <p className="mt-3 flex items-start gap-1.5 text-sm text-[#0B3C5D] bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
                          <ArrowLeftCircle size={15} className="mt-0.5 shrink-0" />
                          <span><b>הצעד הבא:</b> {NEXT_STEP[req.status]}</span>
                        </p>
                      )}

                      {/* צ'קליסט פנימי — רק המנהל רואה */}
                      {req.status !== 'rejected' && (
                        <div className="mt-3 rounded-xl border border-dashed border-[#E5E1D8] px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-[#33332D]/60 flex items-center gap-1.5">
                              <ListChecks size={13} /> מעקב פנימי (הלקוח לא רואה)
                            </span>
                            <span className="text-[11px] font-semibold text-[#626D58]">
                              {CHECKLIST.filter((c) => tracking[req.id]?.checklist?.[c.key]).length}/{CHECKLIST.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {CHECKLIST.map((c) => (
                              <label key={c.key} className="inline-flex items-center gap-1.5 text-sm text-[#33332D]/80 cursor-pointer select-none">
                                <input type="checkbox" className="accent-[#626D58] w-4 h-4"
                                  checked={!!tracking[req.id]?.checklist?.[c.key]}
                                  onChange={() => toggleCheck(req.id, c.key)} />
                                {c.label}
                              </label>
                            ))}
                          </div>
                          <textarea
                            rows={1}
                            value={noteDrafts[req.id] ?? tracking[req.id]?.internal_note ?? ''}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))}
                            onBlur={() => saveNote(req.id)}
                            placeholder="הערה פנימית (לדוגמה: דיברתי עם המלון, מחכה לאישור עד יום ג׳)"
                            className="mt-2 w-full border border-[#E5E1D8] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#0A192F] resize-y"
                          />
                        </div>
                      )}

                      {/* בקשת שינוי */}
                      {req.change_requested && (
                        <div className="mt-3 rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 mb-2"><Calendar size={13} /> בקשת שינוי מהמשתמש</div>
                          <div className="text-sm text-[#0A192F] space-y-1">
                            {req.pending_hotel_id && <div className="flex items-center gap-2"><MapPin size={13} className="text-purple-500" /><span className="font-semibold">{hotels[req.pending_hotel_id] || req.pending_hotel_id}</span></div>}
                            {req.pending_date && (
                              <div className="flex items-center gap-2 text-[#33332D]/70">
                                <Calendar size={13} className="text-purple-500" />
                                <span>כניסה {new Date(req.pending_date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                                {req.pending_end_date && <> · יציאה {new Date(req.pending_end_date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long' })}</>}</span>
                              </div>
                            )}
                            {req.pending_note && <div className="flex items-start gap-2 text-[#33332D]/60"><MessageSquare size={13} className="text-purple-500 mt-0.5" /><span>{req.pending_note}</span></div>}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => approveChange(req)} disabled={busy}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-all disabled:opacity-50">
                              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} אשר שינוי
                            </button>
                            <button onClick={() => rejectChange(req)} disabled={busy}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E1D8] text-[#33332D]/60 text-sm font-semibold hover:bg-[#F7F5F0] transition-all disabled:opacity-50">
                              <XCircle size={14} /> דחה שינוי
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* פעולות */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {req.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => openForBooking(req)}
                            disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            פתח תוכנית להזמנה
                          </button>
                          <button
                            onClick={() => { setRejectModal(req); setRejectNote(''); }}
                            disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all disabled:opacity-50"
                          >
                            <XCircle size={15} /> דחה
                          </button>
                        </>
                      )}
                      {req.status === 'booking_open' && (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold px-3 py-2">
                            <Clock size={13} /> ממתין שהמשתמש יבחר
                          </span>
                          <button onClick={() => markCompleted(req)} disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#626D58]/40 text-[#626D58] text-sm font-semibold hover:bg-[#626D58]/5 transition-all disabled:opacity-50">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />} נבחר והסתיים
                          </button>
                        </>
                      )}
                      {req.status === 'awaiting_admin' && (
                        <>
                          <button
                            onClick={() => { setActionModal({ req, type: 'confirm' }); setActionNote(''); }}
                            disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all disabled:opacity-50"
                          >
                            <CheckCircle size={15} /> אשר הזמנה
                          </button>
                          <button
                            onClick={() => { setActionModal({ req, type: 'decline' }); setActionNote(''); }}
                            disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-all disabled:opacity-50"
                          >
                            <AlertTriangle size={15} /> תאריך תפוס / בחר אחר
                          </button>
                        </>
                      )}
                      {(req.status === 'confirmed' || req.status === 'rejected') && (
                        <button
                          onClick={() => archiveRequest(req)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E5E1D8] text-[#33332D]/50 text-sm font-semibold hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={14} /> הסר הזמנה
                        </button>
                      )}
                      {['pending_review', 'booking_open', 'awaiting_admin'].includes(req.status) && (
                        <button
                          onClick={() => archiveRequest(req)}
                          title="מחק בקשה"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[#33332D]/35 text-xs font-semibold hover:text-red-600 hover:bg-red-50 transition-all"
                        >
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

      {/* מודל דחייה */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" dir="rtl" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-[#0A192F]">דחיית בקשה</h2>
              <button onClick={() => setRejectModal(null)} className="p-2 rounded-xl hover:bg-[#F7F5F0] text-[#33332D]/50"><X size={18} /></button>
            </div>
            <p className="text-sm text-[#33332D]/55 mb-4">המשתמש <b>{rejectModal.user_full_name}</b> יקבל התראה. אפשר להוסיף סיבה (יוצג למשתמש):</p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={3}
              placeholder="לדוגמה: התשלום לא אושר בנדרים פלוס. נא ליצור קשר."
              className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-3 rounded-xl border border-[#E5E1D8] text-[#33332D]/60 font-semibold text-sm hover:bg-[#F7F5F0]">ביטול</button>
              <button onClick={doReject} disabled={busyId === rejectModal.id}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {busyId === rejectModal.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                שלח דחייה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל אישור / דחיית תאריך */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" dir="rtl" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-[#0A192F]">
                {actionModal.type === 'confirm' ? 'אישור ההזמנה' : 'התאריך אינו זמין'}
              </h2>
              <button onClick={() => setActionModal(null)} className="p-2 rounded-xl hover:bg-[#F7F5F0] text-[#33332D]/50"><X size={18} /></button>
            </div>
            <p className="text-sm text-[#33332D]/55 mb-4">
              {actionModal.type === 'confirm'
                ? <>המשתמש <b>{actionModal.req.user_full_name}</b> יקבל אישור. אפשר להוסיף פרטים (יוצג למשתמש + יישלח במייל):</>
                : <>המשתמש <b>{actionModal.req.user_full_name}</b> יחזור לבחור מקום/תאריך אחר. אפשר להוסיף הסבר:</>}
            </p>
            <textarea
              value={actionNote}
              onChange={e => setActionNote(e.target.value)}
              rows={3}
              placeholder={actionModal.type === 'confirm' ? 'לדוגמה: ההזמנה אושרה למלון X בתאריך Y. קוד שובר: ...' : 'לדוגמה: התאריך נתפס. ניתן לבחור תאריך אחר או מקום אחר.'}
              className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] resize-none mb-4"
            />
            {actionModal.type === 'confirm' && (
              <div className="mb-4">
                <label className="block text-xs text-[#33332D]/55 mb-1.5">צירוף קובץ / שובר (אופציונלי)</label>
                <input type="file" onChange={(e) => setActionFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-[#33332D]/70 file:me-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#0A192F] file:text-white file:text-sm file:font-semibold hover:file:bg-[#0A192F]/90 file:cursor-pointer" />
                {actionFile && <p className="text-xs text-[#626D58] mt-1">צורף: {actionFile.name}</p>}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setActionModal(null)} className="flex-1 py-3 rounded-xl border border-[#E5E1D8] text-[#33332D]/60 font-semibold text-sm hover:bg-[#F7F5F0]">ביטול</button>
              <button onClick={doAction} disabled={busyId === actionModal.req.id}
                className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${actionModal.type === 'confirm' ? 'bg-[#626D58] hover:bg-[#626D58]/90' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {busyId === actionModal.req.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {actionModal.type === 'confirm' ? 'אשר ושלח' : 'שלח למשתמש'}
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
