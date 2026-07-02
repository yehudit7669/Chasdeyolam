import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  Hotel,
  AlertTriangle,
  Settings,
  Clock,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import DonorLayout from '../components/DonorLayout';
import { VacationsTeaser } from '../components/VacationsTeaser';
import heroHotelImg from '../assets/hero-hotel.jpg';

interface Subscription {
  id: string;
  status: string;
  successful_payments_count: number;
  is_eligible: boolean;
  started_at: string;
  next_payment_date: string | null;
  plans: {
    name_he: string;
    monthly_amount: number;
    required_successful_payments: number;
    hotel_level: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  paid_at: string;
  created_at: string;
}

export default function DonorDashboardPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t, language } = useTranslation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [immediateReq, setImmediateReq] = useState<{ id: string; status: string; admin_note: string | null; plan_name_he: string | null; selected_hotel_id: string | null; selected_date: string | null; selected_end_date: string | null } | null>(null);
  const [immediateCount, setImmediateCount] = useState(0);
  const [confirmedHotelName, setConfirmedHotelName] = useState<string>('');

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    const loadData = async () => {
      try {
        // שתי שאילתות בלתי-תלויות — במקביל (חוסך סבב רשת בדף הנצפה ביותר)
        const [{ data: immData }, { data: subData }] = await Promise.all([
          supabase
            .from('immediate_requests')
            .select('id, status, admin_note, plan_name_he, selected_hotel_id, selected_date, selected_end_date')
            .eq('user_id', user.id)
            .eq('archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('subscriptions')
            .select(`
              *,
              plans (
                name_he,
                monthly_amount,
                required_successful_payments,
                hotel_level
              )
            `)
            .eq('user_id', user.id)
            .in('status', ['active', 'frozen'])
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (immData && immData.length) {
          setImmediateCount(immData.length);
          // עדיפות תצוגה: אישור סופי > booking_open > הראשון
          const prio = immData.find((r: any) => r.status === 'confirmed')
            || immData.find((r: any) => r.status === 'booking_open') || immData[0];
          setImmediateReq(prio as any);
          if (prio.status === 'confirmed' && prio.selected_hotel_id) {
            const { data: h } = await supabase.from('hotels').select('name_he').eq('id', prio.selected_hotel_id).maybeSingle();
            if (h) setConfirmedHotelName(h.name_he);
          }
        }

        if (subData) {
          setSubscription(subData as any);

          const { data: paymentsData } = await supabase
            .from('payments')
            .select('*')
            .eq('subscription_id', subData.id)
            .order('created_at', { ascending: false });

          if (paymentsData) setPayments(paymentsData);
        }
      } catch (err) {
        console.error('[Dashboard] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <DonorLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#33332D]/50 text-sm">{ t.dashboard.loading}</p>
          </div>
        </div>
      </DonorLayout>
    );
  }

  // כרטיסייה קומפקטית בדף הבית — מובילה ל"ההזמנות שלי" (כל הפירוט שם)
  const immediateCard = (() => {
    if (!immediateReq) return null;
    const s = immediateReq.status;

    // אישור סופי — באנר חגיגי עם רקע החדר
    if (s === 'confirmed') {
      const d = immediateReq.selected_date;
      const e = immediateReq.selected_end_date;
      const fmt = (x: string) => new Date(x).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
      return (
        <div className="relative rounded-[2rem] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(10,25,47,0.2)' }}>
          <img src={heroHotelImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0A192F]/90 via-[#0A192F]/70 to-[#0A192F]/45" />
          <div className="relative p-8 text-white">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-3xl font-black mb-2">מזל טוב! החופשה שלך אושרה</h2>
            <p className="text-white/70 font-light mb-5">{immediateReq.admin_note || 'מחכים לכם ימים נפלאים. הפרטים המלאים נשלחו אליכם.'}</p>
            <div className="inline-flex flex-col gap-1.5 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 mb-6 border border-white/15">
              {confirmedHotelName && <div className="flex items-center gap-2 font-bold"><MapPin size={15} className="text-[#D4B483]" />{confirmedHotelName}</div>}
              {d && <div className="flex items-center gap-2 text-white/80 text-sm"><Calendar size={14} className="text-[#D4B483]" />{fmt(d)}{e ? ` — ${fmt(e)}` : ''}</div>}
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate('/donor/my-orders')} className="px-6 py-3 rounded-xl bg-white text-[#0A192F] font-bold text-sm hover:bg-white/90 transition-all">פרטי החופשה המלאים</button>
              <button onClick={() => navigate('/plans')} className="px-6 py-3 rounded-xl font-bold text-sm text-[#0A192F] hover:-translate-y-0.5 transition-all" style={{ background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' }}>המשך לתרומה הבאה →</button>
            </div>
          </div>
        </div>
      );
    }
    const META: Record<string, { title: string; cta: string; icon: any; accent: string; bg: string }> = {
      pending_review: { title: 'מימוש מיידי — בודקים שהכל תקין', cta: 'צפה בסטטוס', icon: Clock, accent: 'text-[#B08D57]', bg: 'rgba(212,180,131,0.08)' },
      booking_open:   { title: 'נפתחה לך האפשרות להזמין! 🎉', cta: 'בחר מקום ותאריך', icon: Sparkles, accent: 'text-[#626D58]', bg: 'rgba(98,109,88,0.07)' },
      awaiting_admin: { title: 'בחירתך התקבלה — ממתינים לאישור', cta: 'צפה בהזמנה', icon: Clock, accent: 'text-[#B08D57]', bg: 'rgba(212,180,131,0.08)' },
      confirmed:      { title: 'ההזמנה אושרה! 🎉', cta: 'צפה בפרטים', icon: CheckCircle, accent: 'text-[#626D58]', bg: 'rgba(98,109,88,0.07)' },
      rejected:       { title: 'יש בעיה עם המימוש המיידי', cta: 'לפרטים', icon: AlertTriangle, accent: 'text-red-600', bg: 'rgba(239,68,68,0.06)' },
    };
    const m = META[s]; if (!m) return null;
    const Icon = m.icon;
    return (
      <button onClick={() => navigate('/donor/my-orders')}
        className="w-full text-right flex items-center gap-4 p-5 rounded-2xl border border-[#E5E1D8] hover:shadow-md transition-all" style={{ backgroundColor: m.bg }}>
        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0"><Icon className={m.accent} size={22} /></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#0A192F]">{m.title}</p>
          <p className="text-sm text-[#33332D]/55 font-light">
            {immediateCount > 1 ? `יש לך ${immediateCount} הזמנות פעילות — ` : 'יש לך תהליך פעיל — '}לחץ לצפייה בהזמנות שלי
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A192F] text-white text-sm font-bold shrink-0">
          <Sparkles size={14} /> {m.cta}
        </span>
      </button>
    );
  })();

  if (!subscription) {
    return (
      <DonorLayout>
        {immediateCard && <div className="mb-6">{immediateCard}</div>}
        {/* מסך "אין מנוי" מוצג רק כשאין גם מימוש מיידי פעיל */}
        {!immediateReq ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-[1.5rem] bg-[#0A192F]/5 flex items-center justify-center mb-6">
              <Heart className="text-[#33332D]/20" size={36} />
            </div>
            <h2 className="text-2xl font-black text-[#0A192F] mb-3">{t.dashboard.noSubscriptionTitle}</h2>
            <p className="text-[#33332D]/50 mb-8 max-w-xs font-light">{t.dashboard.noSubscriptionDesc}</p>
            <p className="text-[10px] text-[#33332D]/20 font-mono mb-4">uid:{user?.id}</p>
            <button
              onClick={() => navigate('/plans')}
              className="px-8 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md"
            >
              {t.dashboard.choosePlan}
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <h1 className="text-2xl font-black text-[#0A192F] mb-1">שלום, {profile?.full_name || 'ידיד'}</h1>
            <p className="text-[#33332D]/50 text-sm font-light">המעקב אחר ההזמנה שלך מופיע למעלה. כל הפרטים בדף "ההזמנות שלי".</p>
          </div>
        )}
        <VacationsTeaser limit={3} />
      </DonorLayout>
    );
  }

  const progress = Math.min(
    (subscription.successful_payments_count / subscription.plans.required_successful_payments) * 100,
    100
  );
  const remainingPayments = subscription.plans.required_successful_payments - subscription.successful_payments_count;
  const totalPaid = subscription.successful_payments_count * subscription.plans.monthly_amount;

  const isFrozen = subscription.status === 'frozen';

  return (
    <DonorLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-black text-[#0A192F]">
            שלום, {profile?.full_name || 'ידיד'}
          </h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">{t.dashboard.welcomeSubtitle}</p>
        </div>

        {/* כרטיסיית מימוש מיידי */}
        {immediateCard}

        {/* Frozen subscription banner */}
        {isFrozen && (
          <div
            className="flex items-start gap-4 p-5 rounded-2xl border-2 border-orange-300"
            style={{ backgroundColor: 'rgba(251, 146, 60, 0.08)' }}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-orange-600" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-orange-800 text-base mb-1">{t.dashboard.frozenTitle}</p>
              <p className="text-sm text-orange-700/80 font-light leading-relaxed">
                {t.dashboard.frozenDesc}
              </p>
              <button
                onClick={() => navigate('/donor/manage-subscription')}
                className="flex items-center gap-1.5 mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800 transition-colors"
              >
                <Settings size={14} />
                {t.dashboard.manageSubscription}
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Featured dark card */}
          <div
            className="relative rounded-[2rem] p-7 overflow-hidden"
            style={{
              background: isFrozen
                ? 'linear-gradient(135deg, #92400e 0%, #b45309 100%)'
                : 'linear-gradient(135deg, #0A192F 0%, #2D3E40 100%)',
              boxShadow: '0 20px 60px rgba(10,25,47,0.15)',
            }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#D4B483]/10 blur-2xl pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#D4B483]/60 mb-4">{t.dashboard.myPlan}</div>
            <div className="text-xl font-bold text-white mb-1">{subscription.plans.name_he}</div>
            {isFrozen && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-200/20 border border-orange-300/30 mt-2 mb-2">
                <AlertTriangle size={12} className="text-orange-300" />
                <span className="text-xs font-bold text-orange-200">{t.dashboard.suspended}</span>
              </div>
            )}
            <div className="text-[#D4B483] font-black text-2xl mt-1">
              ₪{subscription.plans.monthly_amount.toLocaleString()}
              <span className="text-sm font-normal text-white/40 mr-1">{t.dashboard.perMonth}</span>
            </div>
          </div>

          {/* Payments card */}
          <div
            className="rounded-[2rem] p-7 bg-white border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center">
                <CheckCircle className="text-[#626D58]" size={20} />
              </div>
              <span className="text-sm font-semibold text-[#33332D]/60">{t.dashboard.paymentsLabel}</span>
            </div>
            <div className="text-4xl font-black text-[#0A192F] mb-1">
              {subscription.successful_payments_count}
            </div>
            <div className="text-xs text-[#33332D]/40">
              {t.dashboard.outOf} {subscription.plans.required_successful_payments} {t.dashboard.required}
            </div>
          </div>

          {/* Total card */}
          <div
            className="rounded-[2rem] p-7 bg-white border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#D4B483]/10 flex items-center justify-center">
                <TrendingUp className="text-[#B08D57]" size={20} />
              </div>
              <span className="text-sm font-semibold text-[#33332D]/60">{t.dashboard.totalDonations}</span>
            </div>
            <div className="text-4xl font-black text-[#0A192F] mb-1">
              ₪{totalPaid.toLocaleString()}
            </div>
            <div className="text-xs text-[#33332D]/40">{t.dashboard.cumulativeImpact}</div>
          </div>
        </div>

        {/* Progress */}
        <div
          className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <h3 className="text-lg font-black text-[#0A192F] mb-6">{t.dashboard.progressTitle}</h3>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-[#33332D]/50 font-medium">
                {subscription.successful_payments_count} {t.dashboard.outOf} {subscription.plans.required_successful_payments} {t.dashboard.payments}
              </span>
              <span className="font-bold text-[#0A192F]">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-3 bg-[#F7F5F0] rounded-full overflow-hidden border border-[#E5E1D8]/50">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #626D58 0%, #D4B483 100%)',
                }}
              />
            </div>
          </div>

          {subscription.is_eligible ? (
            <div
              className="flex items-start gap-4 p-5 rounded-2xl border border-[#626D58]/30"
              style={{ backgroundColor: 'rgba(98,109,88,0.06)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="text-[#626D58]" size={20} />
              </div>
              <div>
                <p className="font-bold text-[#0A192F] mb-1">{t.dashboard.eligibleTitle}</p>
                <p className="text-sm text-[#33332D]/50 font-light">
                  {t.dashboard.eligibleDesc}
                </p>
                <button
                  onClick={() => navigate('/donor/hotels')}
                  className="flex items-center gap-2 text-sm font-semibold text-[#626D58] hover:text-[#626D58]/80 transition-colors mt-3"
                >
                  <Hotel size={16} />
                  <span>{t.dashboard.viewHotels}</span>
                </button>
              </div>
            </div>
          ) : subscription.successful_payments_count === 0 ? (
            <div
              className="flex items-start gap-4 p-5 rounded-2xl border border-[#0A192F]/10"
              style={{ backgroundColor: 'rgba(10,25,47,0.03)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0A192F]/8 flex items-center justify-center flex-shrink-0">
                <Calendar className="text-[#0A192F]/60" size={20} />
              </div>
              <div>
                <p className="font-bold text-[#0A192F] mb-1">{t.dashboard.pendingFirstPaymentTitle}</p>
                <p className="text-sm text-[#33332D]/50 font-light">
                  {t.dashboard.pendingFirstPaymentDesc}
                </p>
                {subscription.next_payment_date && (
                  <p className="text-sm font-semibold text-[#0A192F]/70 mt-2">
                    {t.dashboard.expectedChargeDate}{' '}
                    {new Date(subscription.next_payment_date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex items-start gap-4 p-5 rounded-2xl border border-[#D4B483]/30"
              style={{ backgroundColor: 'rgba(212,180,131,0.06)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#D4B483]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="text-[#B08D57]" size={20} />
              </div>
              <div>
                <p className="font-bold text-[#0A192F] mb-1">
                  {t.dashboard.remainingPaymentsTitle.replace('{n}', String(remainingPayments))}
                </p>
                <p className="text-sm text-[#33332D]/50 font-light">
                  {t.dashboard.remainingPaymentsDesc}
                </p>
                {subscription.next_payment_date && (
                  <p className="text-sm font-semibold text-[#0A192F]/70 mt-2">
                    {t.dashboard.nextPayment}{' '}
                    {new Date(subscription.next_payment_date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* How It Works — 5 Steps */}
        <div
          className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <h3 className="text-lg font-black text-[#0A192F] mb-2">איך זה עובד?</h3>
          <p className="text-xs text-[#33332D]/40 mb-7 font-light">חמישה שלבים לחופשה הגדולה</p>

          <div className="relative">
            <div className="absolute right-[1.6rem] top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-[#D4B483]/30 to-transparent" />

            <div className="space-y-4">
              {(() => {
                const count = subscription.successful_payments_count;
                const required = subscription.plans.required_successful_payments;
                const hotelUnlocked = count >= 12;
                const completed = count >= required;
                const eligible = subscription.is_eligible;

                const steps = [
                  {
                    label: 'תחילת תשלום',
                    desc: 'הצטרפת לתוכנית והתחלת לתרום',
                    done: true,
                    active: count === 0,
                  },
                  {
                    label: 'בחירת מלון ותאריך',
                    desc: hotelUnlocked
                      ? 'ניתן לבחור מלון ותאריך באזור האישי'
                      : `נפתח לאחר 12 תשלומים — עוד ${12 - count} תשלומים`,
                    done: hotelUnlocked,
                    active: count > 0 && !hotelUnlocked,
                  },
                  {
                    label: 'השלמת התשלומים',
                    desc: completed
                      ? 'השלמת את כל התשלומים!'
                      : `עוד ${required - count} תשלומים להשלמת התוכנית`,
                    done: completed,
                    active: hotelUnlocked && !completed,
                  },
                  {
                    label: 'קבלת שובר',
                    desc: eligible
                      ? 'השובר שלך מחכה לך — בדוק את המייל!'
                      : 'לאחר ההשלמה נשלח שובר שבת במלון שבחרת',
                    done: eligible,
                    active: completed && !eligible,
                  },
                  {
                    label: 'נסיעה — וממשיכים!',
                    desc: 'יוצאים לנפוש ולהירגע, וממשיכים את החסד',
                    done: false,
                    active: eligible,
                  },
                ];

                return steps.map(({ label, desc, done, active }, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`shrink-0 w-[3.2rem] h-[3.2rem] rounded-full flex items-center justify-center relative z-10 border transition-all ${
                      done
                        ? 'bg-[#626D58] border-[#626D58]'
                        : active
                        ? 'bg-[#0A192F] border-[#0A192F]'
                        : 'bg-white border-[#E5E1D8]'
                    }`}>
                      {done ? (
                        <CheckCircle size={16} className="text-white" />
                      ) : (
                        <span className={`text-[10px] font-black tracking-widest ${active ? 'text-[#D4B483]' : 'text-[#33332D]/30'}`}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <div className={`flex-1 rounded-2xl px-5 py-3.5 border transition-all ${
                      active
                        ? 'bg-[#0A192F]/3 border-[#0A192F]/15'
                        : done
                        ? 'bg-[#626D58]/4 border-[#626D58]/15'
                        : 'bg-[#FAFAF8] border-[#E5E1D8]/50'
                    }`}>
                      <p className={`text-sm font-bold mb-0.5 ${done || active ? 'text-[#0A192F]' : 'text-[#33332D]/40'}`}>
                        {label}
                      </p>
                      <p className={`text-xs font-light leading-relaxed ${done || active ? 'text-[#33332D]/60' : 'text-[#33332D]/30'}`}>
                        {desc}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div
          className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <h3 className="text-lg font-black text-[#0A192F] mb-6">{t.dashboard.paymentHistory}</h3>

          {payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-[#F7F5F0] flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-[#33332D]/20" size={24} />
              </div>
              <p className="text-[#33332D]/40 text-sm">{t.dashboard.noPaymentsYet}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/50 hover:border-[#D4B483]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      payment.status === 'succeeded' ? 'bg-[#626D58]/10' : 'bg-red-50'
                    }`}>
                      {payment.status === 'succeeded' ? (
                        <CheckCircle className="text-[#626D58]" size={16} />
                      ) : (
                        <XCircle className="text-red-500" size={16} />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-[#0A192F] text-sm">₪{payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-[#33332D]/40">
                        {new Date(payment.paid_at || payment.created_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                      payment.status === 'succeeded'
                        ? 'bg-[#626D58]/10 text-[#626D58]'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {payment.status === 'succeeded' ? t.dashboard.paymentSucceeded : t.dashboard.paymentFailed}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <VacationsTeaser limit={3} title="הנופשים שמחכים לכם" subtitle="צפו במלונות, וילות וצימרים שתוכלו לבחור מהם" />
      </div>
    </DonorLayout>
  );
}
