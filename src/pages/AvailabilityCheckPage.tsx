import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, CalendarSearch, ChevronLeft, CheckCircle, Clock, AlertTriangle,
  Loader2, MapPin, Hotel as HotelIcon, Calendar, Phone, Shuffle, CreditCard,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { HotelNameWithDetails, HOTEL_PACKAGE_COLUMNS, HotelPackage } from '../components/HotelPackageDetails';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { createNotification } from '../hooks/useNotifications';
import {
  AvailabilityCheck, AVAILABILITY_VALID_HOURS, isExpired, isPayable, fmtRequestedDates, fmtDay, fmtExpiry,
} from '../lib/availabilityChecks';

interface PlanLite { id: string; name_he: string; hotel_level: string; }
interface HotelLite extends HotelPackage { id: string; name_he: string; city_he: string; }

type View = 'choose' | 'form' | 'status';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function AvailabilityCheckPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  // planId מגיע מדף בחירת המסלול (state) או מקישור בהתראה/מייל (?plan=)
  const planId = (location.state as { planId?: string } | null)?.planId ?? params.get('plan');

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanLite | null>(null);
  const [hotels, setHotels] = useState<HotelLite[]>([]);
  const [check, setCheck] = useState<AvailabilityCheck | null>(null);
  const [view, setView] = useState<View>('choose');
  const [profileName, setProfileName] = useState('');

  // טופס
  const [hotelId, setHotelId] = useState('');
  const [altHotelId, setAltHotelId] = useState('');
  const [dateMode, setDateMode] = useState<'exact' | 'flexible'>('exact');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hotelName = (id: string | null) => hotels.find((h) => h.id === id)?.name_he ?? '';

  useEffect(() => {
    if (!planId) { navigate('/plans', { replace: true }); return; }
    if (!user) return;
    (async () => {
      const [planRes, profRes, checkRes] = await Promise.all([
        supabase.from('plans').select('id, name_he, hotel_level').eq('id', planId).maybeSingle(),
        supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
        supabase.from('availability_checks').select('*')
          .eq('user_id', user.id).eq('plan_id', planId).in('status', ['pending', 'available', 'unavailable'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!planRes.data) { navigate('/plans', { replace: true }); return; }
      const p = planRes.data as PlanLite;
      setPlan(p);
      setProfileName(profRes.data?.full_name ?? '');
      setPhone(profRes.data?.phone ?? '');

      // רק מלונות של התוכנית שנבחרה (לפי רמת המלון של התוכנית — כמו בבחירת הנופש)
      const { data: hs } = await supabase.from('hotels').select(`id, name_he, city_he, ${HOTEL_PACKAGE_COLUMNS}`)
        .eq('active', true).eq('level', p.hotel_level).order('name_he');
      setHotels((hs ?? []) as HotelLite[]);

      const c = checkRes.data as AvailabilityCheck | null;
      if (c) { setCheck(c); setView('status'); }
      setLoading(false);
    })();
  }, [planId, user]);

  const goToPayment = (availabilityCheckId?: string) => {
    navigate('/payment', { state: { planId, redemptionType: 'immediate', availabilityCheckId } });
  };

  // פתיחת הטופס — בבקשה חוזרת ממלאים מראש את הבחירה הקודמת
  const openForm = (prefill?: AvailabilityCheck | null) => {
    if (prefill) {
      setHotelId(prefill.hotel_id);
      setAltHotelId(prefill.alt_hotel_id ?? '');
      setDateMode(prefill.date_mode);
      setDateFrom(prefill.date_from >= todayKey() ? prefill.date_from : '');
      setDateTo(prefill.date_to >= todayKey() ? prefill.date_to : '');
      setNote(prefill.user_note ?? '');
    }
    setFormError('');
    setView('form');
  };

  const submit = async () => {
    if (!user || !plan) return;
    setFormError('');
    if (!hotelId) return setFormError('נא לבחור מלון / צימר');
    if (!dateFrom || !dateTo) return setFormError('נא לבחור תאריכים');
    if (dateFrom < todayKey()) return setFormError('התאריך כבר עבר');
    if (dateTo < dateFrom) return setFormError('תאריך הסיום לפני תאריך ההתחלה');
    if (phone.replace(/\D/g, '').length < 9) return setFormError('נא להזין מספר טלפון כדי שנוכל לחזור אליך');

    setSubmitting(true);
    const row = {
      user_id: user.id,
      plan_id: plan.id,
      plan_name_he: plan.name_he,
      user_full_name: profileName || null,
      user_email: user.email ?? null,
      user_phone: phone.trim(),
      hotel_id: hotelId,
      alt_hotel_id: altHotelId || null,
      date_mode: dateMode,
      date_from: dateFrom,
      date_to: dateTo,
      user_note: note.trim() || null,
    };
    const { data, error } = await supabase.from('availability_checks').insert(row).select('*').single();
    if (error || !data) {
      setSubmitting(false);
      setFormError('שגיאה בשליחה: ' + (error?.message ?? 'נסו שוב'));
      return;
    }

    // הבקשה הקודמת (לא זמין / פג תוקף) כבר לא רלוונטית
    if (check && check.id !== data.id) {
      await supabase.from('availability_checks').update({ status: 'cancelled' }).eq('id', check.id);
    }

    const created = data as AvailabilityCheck;
    await createNotification({
      for_admin: true,
      type: 'availability_check',
      title: `בדיקת זמינות לפני תשלום — ${plan.name_he}`,
      body: [
        `${profileName || 'לקוח'} · ${phone.trim()} · ${user.email ?? ''}`,
        `מלון: ${hotelName(hotelId)}${altHotelId ? ` (אפשרות ב׳: ${hotelName(altHotelId)})` : ''}`,
        `תאריכים: ${fmtRequestedDates(created)}`,
        note.trim() ? `הערה: ${note.trim()}` : '',
        'הלקוח עוד לא שילם — מחכה לתשובה שלך.',
      ].filter(Boolean).join('\n'),
      link: '/admin/availability-checks',
      email: { toAdmin: true },
    });

    setCheck(created);
    setView('status');
    setSubmitting(false);
  };

  const cancelCheck = async () => {
    if (!check || !confirm('לבטל את בקשת הבדיקה?')) return;
    await supabase.from('availability_checks').update({ status: 'cancelled' }).eq('id', check.id);
    setCheck(null);
    setView('choose');
  };

  // ---------- תצוגות ----------

  const chooseView = (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border border-[#E5E1D8]/60 rounded-[2rem] p-8 flex flex-col" style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}>
        <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center mb-5">
          <Shuffle size={20} className="text-[#626D58]" />
        </div>
        <h2 className="text-2xl font-bold text-[#0A192F] mb-2">לא משנה לי</h2>
        <p className="text-sm text-[#33332D]/55 font-light leading-relaxed mb-8 flex-1">
          אני גמיש/ה במקום ובתאריך. ממשיכים לתשלום, ואחרי האישור בוחרים נופש מתוך המקומות והתאריכים הפנויים.
        </p>
        <button onClick={() => goToPayment()}
          className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[#0A192F] text-white hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2">
          <span>המשך לתשלום</span><ChevronLeft size={18} />
        </button>
      </div>

      <div className="bg-[#0A192F] text-white rounded-[2rem] p-8 flex flex-col" style={{ boxShadow: '0 24px 60px rgba(10,25,47,0.2)' }}>
        <div className="w-10 h-10 rounded-xl bg-[#D4B483]/20 flex items-center justify-center mb-5">
          <CalendarSearch size={20} className="text-[#D4B483]" />
        </div>
        <h2 className="text-2xl font-bold mb-2">חשוב לי מקום ותאריך</h2>
        <p className="text-sm text-white/60 font-light leading-relaxed mb-8 flex-1">
          בוחרים מלון ותאריכים, ואנחנו בודקים שהם פנויים <b className="text-white">לפני</b> שאתם משלמים. משלמים רק אחרי שאישרנו.
        </p>
        <button onClick={() => openForm()}
          className="w-full py-3.5 rounded-xl font-semibold text-sm text-[#0A192F] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' }}>
          <span>בחירת מקום ותאריך</span><ChevronLeft size={18} />
        </button>
      </div>
    </div>
  );

  const hotelOption = (h: HotelLite, selected: boolean, onClick: () => void, disabled = false) => (
    <div key={h.id}>
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full text-right flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
        selected ? 'border-[#626D58] bg-[#626D58]/5' : disabled ? 'border-[#E5E1D8]/40 opacity-40 cursor-not-allowed' : 'border-[#E5E1D8]/60 hover:border-[#626D58]/40'
      }`}>
      <HotelIcon size={18} className={selected ? 'text-[#626D58]' : 'text-[#33332D]/30'} />
      <div className="min-w-0">
        <div className="font-bold text-[#0A192F] text-sm">{h.name_he}</div>
        <div className="text-xs text-[#33332D]/45 flex items-center gap-1"><MapPin size={10} />{h.city_he}</div>
      </div>
    </button>
    {!disabled && <HotelNameWithDetails hotel={h} className="px-1 pt-1"><span className="sr-only">{h.name_he}</span></HotelNameWithDetails>}
    </div>
  );

  const inputCls = 'w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F]';

  const formView = (
    <div className="bg-white border border-[#E5E1D8]/60 rounded-[2rem] p-6 md:p-8 space-y-7" style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}>
      <section>
        <h3 className="font-bold text-[#0A192F] mb-1">1. איפה תרצו לנפוש?</h3>
        <p className="text-xs text-[#33332D]/50 mb-3">המקומות שבתוכנית "{plan?.name_he}"</p>
        {hotels.length === 0 ? (
          <p className="text-sm text-[#33332D]/45 bg-[#F7F5F0] rounded-xl p-4">אין כרגע מקומות זמינים בתוכנית זו. אפשר לבחור "לא משנה לי" או ליצור איתנו קשר.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {hotels.map((h) => hotelOption(h, hotelId === h.id, () => { setHotelId(h.id); if (altHotelId === h.id) setAltHotelId(''); }))}
          </div>
        )}
      </section>

      {hotels.length > 1 && hotelId && (
        <section>
          <h3 className="font-bold text-[#0A192F] mb-1">אפשרות ב׳ <span className="font-normal text-[#33332D]/45 text-sm">(לא חובה)</span></h3>
          <p className="text-xs text-[#33332D]/50 mb-3">אם הראשון תפוס — נבדוק גם את זה</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {hotels.map((h) => hotelOption(h, altHotelId === h.id, () => setAltHotelId(altHotelId === h.id ? '' : h.id), h.id === hotelId))}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-bold text-[#0A192F] mb-3">2. מתי?</h3>
        <div className="inline-flex rounded-xl bg-[#F7F5F0] p-1 mb-4">
          {([['exact', 'תאריכים מדויקים'], ['flexible', 'טווח גמיש']] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setDateMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${dateMode === m ? 'bg-white text-[#0A192F] shadow-sm' : 'text-[#33332D]/50'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-[#33332D]/55 mb-1">{dateMode === 'exact' ? 'כניסה' : 'החל מ-'}</span>
            <input type="date" min={todayKey()} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-xs text-[#33332D]/55 mb-1">{dateMode === 'exact' ? 'יציאה' : 'עד'}</span>
            <input type="date" min={dateFrom || todayKey()} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </label>
        </div>
        {dateMode === 'flexible' && (
          <p className="text-xs text-[#33332D]/50 mt-2">נחפש תאריך פנוי מתישהו בתוך הטווח הזה ונעדכן אתכם מה מצאנו.</p>
        )}
      </section>

      <section>
        <h3 className="font-bold text-[#0A192F] mb-3">3. איך לחזור אליכם?</h3>
        <label className="block mb-3">
          <span className="block text-xs text-[#33332D]/55 mb-1">טלפון</span>
          <div className="relative">
            <Phone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#33332D]/30" />
            <input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} pr-9 text-right`} placeholder="050-0000000" />
          </div>
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="הערה (לא חובה): מספר אורחים, בקשות מיוחדות..." className={`${inputCls} resize-none`} />
      </section>

      {formError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{formError}</p>
      )}

      <div>
        <button onClick={submit} disabled={submitting || hotels.length === 0}
          className="w-full py-3.5 rounded-xl bg-[#0A192F] text-white font-bold text-sm hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <CalendarSearch size={16} />}
          שלחו לבדיקת זמינות
        </button>
        <p className="text-xs text-[#33332D]/45 text-center mt-2">לא תחויבו עכשיו. נבדוק שהמקום פנוי ונחזור אליכם במייל ובאזור האישי.</p>
      </div>
    </div>
  );

  const requestSummary = (c: AvailabilityCheck) => (
    <div className="rounded-xl bg-white border border-[#E5E1D8]/60 px-4 py-3 text-sm space-y-1">
      <div className="flex items-center gap-2 text-[#0A192F] font-semibold">
        <MapPin size={13} className="text-[#626D58]" />{hotelName(c.hotel_id)}
        {c.alt_hotel_id && <span className="font-normal text-[#33332D]/50">· אפשרות ב׳: {hotelName(c.alt_hotel_id)}</span>}
      </div>
      <div className="flex items-center gap-2 text-[#33332D]/70"><Calendar size={13} className="text-[#626D58]" />{fmtRequestedDates(c)}</div>
    </div>
  );

  const statusView = (c: AvailabilityCheck) => {
    if (c.status === 'pending') {
      return (
        <div className="p-6 rounded-2xl border border-[#D4B483]/40" style={{ backgroundColor: 'rgba(212,180,131,0.08)' }}>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#D4B483]/15 flex items-center justify-center shrink-0"><Clock className="text-[#B08D57]" size={22} /></div>
            <div className="flex-1">
              <p className="font-bold text-[#0A192F] text-lg mb-1">אנחנו בודקים שהתאריכים פנויים</p>
              <p className="text-sm text-[#33332D]/60 font-light leading-relaxed mb-3">
                עוד לא חויבתם. ברגע שנבדוק מול המקום נעדכן אתכם במייל ובאזור האישי, ואם הכל פנוי — תוכלו להמשיך לתשלום.
              </p>
              {requestSummary(c)}
              <button onClick={cancelCheck} className="mt-4 text-xs text-[#33332D]/45 hover:text-red-600">ביטול הבקשה</button>
            </div>
          </div>
        </div>
      );
    }
    if (isPayable(c)) {
      return (
        <div className="p-6 rounded-2xl border border-[#626D58]/40" style={{ backgroundColor: 'rgba(98,109,88,0.07)' }}>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#626D58]/15 flex items-center justify-center shrink-0"><CheckCircle className="text-[#626D58]" size={22} /></div>
            <div className="flex-1">
              <p className="font-bold text-[#0A192F] text-lg mb-1">יש מקום! 🎉</p>
              <p className="text-sm text-[#33332D]/60 font-light leading-relaxed mb-3">בדקנו והמקום פנוי. אפשר להמשיך לתשלום.</p>
              <div className="rounded-xl bg-white border border-[#E5E1D8]/60 px-4 py-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-[#0A192F] font-semibold"><MapPin size={13} className="text-[#626D58]" />{hotelName(c.approved_hotel_id)}</div>
                {c.approved_date && (
                  <div className="flex items-center gap-2 text-[#33332D]/70"><Calendar size={13} className="text-[#626D58]" />
                    {fmtDay(c.approved_date, true)}{c.approved_end_date ? ` עד ${fmtDay(c.approved_end_date, true)}` : ''}
                  </div>
                )}
              </div>
              {c.admin_note && <p className="text-sm text-[#33332D]/70 mt-3 whitespace-pre-line">{c.admin_note}</p>}
              {c.expires_at && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3 inline-block">
                  ⏳ האישור שמור עבורכם עד {fmtExpiry(c.expires_at)}
                </p>
              )}
              <button onClick={() => goToPayment(c.id)}
                className="mt-4 w-full py-3.5 rounded-xl bg-[#0A192F] text-white font-bold text-sm hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2">
                <CreditCard size={16} /> המשך לתשלום
              </button>
            </div>
          </div>
        </div>
      );
    }
    // לא זמין, או שהאישור פג
    const expired = isExpired(c);
    return (
      <div className="p-6 rounded-2xl border border-amber-300" style={{ backgroundColor: 'rgba(245,158,11,0.06)' }}>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle className="text-amber-600" size={22} /></div>
          <div className="flex-1">
            <p className="font-bold text-[#0A192F] text-lg mb-1">{expired ? 'האישור פג תוקף' : 'התאריכים האלה לא פנויים'}</p>
            <p className="text-sm text-[#33332D]/65 font-light leading-relaxed mb-3 whitespace-pre-line">
              {expired
                ? `אישור הזמינות שמור ${AVAILABILITY_VALID_HOURS} שעות בלבד. אפשר לשלוח בקשה חוזרת ונבדוק שוב.`
                : (c.admin_note || 'לצערנו המקום תפוס בתאריכים שבחרתם. אפשר לבחור תאריך או מקום אחר ונבדוק שוב.')}
            </p>
            {requestSummary(c)}
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => openForm(c)}
                className="px-5 py-2.5 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0A192F]/90">
                {expired ? 'בקשת בדיקה חוזרת' : 'בחירת תאריך / מקום אחר'}
              </button>
              <button onClick={() => goToPayment()}
                className="px-5 py-2.5 rounded-xl border border-[#E5E1D8] text-[#33332D]/60 text-sm font-semibold hover:bg-white">
                לא משנה לי — המשך לתשלום
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="py-16 px-4" dir="rtl">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => (view === 'form' ? setView(check ? 'status' : 'choose') : navigate('/redemption-choice', { state: { planId } }))}
            className="inline-flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors">
            <ArrowRight size={16} /><span>חזרה</span>
          </button>

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-black text-[#0A192F] tracking-tight mb-3">
              {view === 'form' ? 'בדיקת זמינות לפני תשלום' : 'יש לכם העדפה למקום ותאריך?'}
            </h1>
            {plan && <p className="text-[#33332D]/55 font-light text-lg">מימוש מיידי · תוכנית <b className="text-[#0A192F]">{plan.name_he}</b></p>}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
          ) : view === 'form' ? formView : view === 'status' && check ? statusView(check) : chooseView}
        </div>
      </div>
    </Layout>
  );
}
