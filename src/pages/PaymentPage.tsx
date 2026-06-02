import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, XCircle, Loader2, Shield, Lock, CreditCard, Building2, X, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase, hotelLevelLabel } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Plan {
  id: string;
  name_he: string;
  description_he: string;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
}

type PageState = 'loading_plan' | 'ready' | 'iframe' | 'paying' | 'success' | 'failure' | 'cancel' | 'bank_success';

const NEDARIM_IFRAME_SRC = 'https://matara.pro/nedarimplus/iframe/';
const MOSAD = '7010422';
const API_VALID = 'Rd8QEQCDEY';
const SUPABASE_FN_BASE = 'https://iuwdfxgkwpdhnvveucwz.supabase.co/functions/v1';
const CALLBACK_URL = `${SUPABASE_FN_BASE}/nedarim-keva-callback`;
const NEDARIM_PAYMENT_TYPE = 'HK';
const NEDARIM_TASHLUMIM = '15';

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading_plan');
  const [iframeHeight, setIframeHeight] = useState(500);
  const [iframeVisible, setIframeVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [profile, setProfile] = useState<{ full_name: string; phone: string | null } | null>(null);

  // Bank transfer modal state
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankNote, setBankNote] = useState('');
  const [bankSubmitting, setBankSubmitting] = useState(false);

  const planId = location.state?.planId;

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    if (!planId) { navigate('/plans'); return; }
    loadPlan();
    loadProfile();
  }, [user, planId]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const loadPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('plans').select('*').eq('id', planId).eq('active', true).maybeSingle();
      if (error) throw error;
      if (!data) { setErrorMsg('תוכנית לא נמצאה'); setPageState('failure'); return; }
      setPlan(data);
      setPageState('ready');
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בטעינת תוכנית');
      setPageState('failure');
    }
  };

  const postNedarim = useCallback((data: object) => {
    const iframeWin = iframeRef.current?.contentWindow;
    if (!iframeWin) return;
    iframeWin.postMessage(data, '*');
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIframeVisible(true);
    let attempts = 0;
    const retry = setInterval(() => {
      attempts++;
      postNedarim({ Name: 'GetHeight' });
      if (attempts >= 17) clearInterval(retry);
    }, 300);
    postNedarim({ Name: 'GetHeight' });
  }, [postNedarim]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin && event.origin !== '' && !event.origin.includes('matara.pro')) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.Name) {
      case 'Height': {
        const h = parseInt(data.Value ?? '0', 10);
        if (h > 0) setIframeHeight(h + 15);
        break;
      }
      case 'TransactionResponse': {
        const resp = data.Value ?? {};
        if (resp.Status === 'Error') {
          setErrorMsg(resp.Message ?? 'שגיאה בעיבוד התשלום');
          setPageState('failure');
        } else {
          setPageState('success');
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (pageState !== 'iframe' && pageState !== 'paying') return;
    const interval = setInterval(() => postNedarim({ Name: 'GetHeight' }), 3000);
    const onResize = () => postNedarim({ Name: 'GetHeight' });
    window.addEventListener('resize', onResize);
    return () => { clearInterval(interval); window.removeEventListener('resize', onResize); };
  }, [pageState, postNedarim]);

  const handlePayClick = useCallback(() => {
    if (!plan || !user) return;

    // Split full_name into first/last (Hebrew names: last word = last name)
    const fullName = profile?.full_name?.trim() ?? '';
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : fullName;
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const phone = profile?.phone ?? '';
    const mail = user.email ?? '';

    console.log('[PaymentPage] Nedarim payload fields:', { FirstName: firstName, LastName: lastName, Phone: phone, Mail: mail });

    const payload = {
      Name: 'FinishTransaction2',
      Value: {
        Mosad: MOSAD,
        ApiValid: API_VALID,
        PaymentType: NEDARIM_PAYMENT_TYPE,
        Currency: '1',
        Zeout: '',
        FirstName: firstName,
        LastName: lastName,
        Street: '',
        City: '',
        Phone: phone,
        Mail: mail,
        Amount: String(plan.monthly_amount),
        Tashlumim: NEDARIM_TASHLUMIM,
        Groupe: 'תשלום דרך אתר נציבים',
        Comment: '',
        Param1: user.id,
        Param2: plan.id,
        ForceUpdateMatching: '1',
        CallBack: CALLBACK_URL,
        CallBackMailError: '',
      },
    };

    setPageState('paying');
    postNedarim(payload);
  }, [plan, user, profile, postNedarim]);

  const startIframe = () => {
    if (!agreed || !plan || !user) return;
    // Save terms acceptance to DB when proceeding
    supabase
      .from('profiles')
      .update({ terms_accepted: true, terms_accepted_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {});
    setIframeHeight(500);
    setIframeVisible(false);
    setPageState('iframe');
  };

  const submitBankRequest = async () => {
    if (!user || !plan) return;
    setBankSubmitting(true);
    try {
      // Save terms acceptance
      await supabase
        .from('profiles')
        .update({ terms_accepted: true, terms_accepted_at: new Date().toISOString() })
        .eq('id', user.id);

      const body = [
        'סוג בקשה: הצטרפות להוראת קבע בנקאית',
        '',
        'פרטי תוכנית:',
        `• שם תוכנית: ${plan.name_he}`,
        `• סכום חודשי: ₪${plan.monthly_amount.toLocaleString()}`,
        `• מספר תשלומים: ${plan.required_successful_payments}`,
        `• רמת מלון: ${hotelLevelLabel(plan.hotel_level)}`,
        `• סה"כ: ₪${(plan.monthly_amount * plan.required_successful_payments).toLocaleString()}`,
        '',
        'פרטי מבקש:',
        `• אימייל: ${user.email ?? '—'}`,
        `• מזהה משתמש: ${user.id}`,
        bankNote ? `\nהערת הלקוח: ${bankNote}` : '',
      ].filter((l) => l !== undefined).join('\n');

      const { data: thread, error: threadErr } = await supabase
        .from('support_threads')
        .insert({
          user_id: user.id,
          subject: `בקשת הוראת קבע בנקאית — ${plan.name_he}`,
          status: 'open',
          thread_type: 'bank_transfer_request',
          plan_id: plan.id,
          plan_snapshot: {
            name_he: plan.name_he,
            monthly_amount: plan.monthly_amount,
            required_successful_payments: plan.required_successful_payments,
            hotel_level: plan.hotel_level,
          },
        })
        .select('id')
        .single();

      if (threadErr) throw threadErr;

      if (thread) {
        await supabase.from('support_messages').insert({
          thread_id: thread.id,
          sender_id: user.id,
          message: body,
          is_admin: false,
        });
      }

      setShowBankModal(false);
      setPageState('bank_success');
    } catch (err: any) {
      console.error('Bank request error:', err);
    } finally {
      setBankSubmitting(false);
    }
  };

  // ── Result screens ────────────────────────────────────────────────────────

  if (pageState === 'loading_plan') {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#33332D]/50 text-sm">טוען...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'bank_success') {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white rounded-[2rem] p-10 max-w-md w-full text-center border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 8px 40px rgba(98,109,88,0.12)' }}>
          <div className="w-16 h-16 rounded-full bg-[#626D58]/10 flex items-center justify-center mx-auto mb-5">
            <MessageSquare size={32} className="text-[#626D58]" />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">הפנייה נשלחה!</h2>
          <p className="text-[#33332D]/60 text-sm mb-2 leading-relaxed">
            קיבלנו את בקשתך להצטרפות באמצעות הוראת קבע בנקאית.
          </p>
          <p className="text-[#33332D]/60 text-sm mb-8 leading-relaxed">
            נציג מצוות התמיכה שלנו יחזור אליך בהקדם כדי לסייע בהקמת הוראת הקבע.
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/support')}
              className="flex-1 py-3.5 border border-[#E5E1D8] text-[#33332D]/70 font-semibold rounded-xl hover:bg-[#F7F5F0] transition-all text-sm">
              צפה בפנייה
            </button>
            <button onClick={() => navigate('/dashboard')}
              className="flex-1 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all text-sm">
              לדשבורד
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white rounded-[2rem] p-10 max-w-md w-full text-center border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 8px 40px rgba(98,109,88,0.12)' }}>
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">התשלום הושלם!</h2>
          <p className="text-[#33332D]/60 text-sm mb-8 leading-relaxed">
            הוראת הקבע נרשמה בהצלחה. המנוי שלך פעיל וצבירת הזכאות מתחילה מעכשיו.
          </p>
          <button onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all">
            עבור ללוח הבקרה
          </button>
        </div>
      </div>
    );
  }

  if (pageState === 'cancel') {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white rounded-[2rem] p-10 max-w-md w-full text-center border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 8px 40px rgba(98,109,88,0.12)' }}>
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <XCircle size={32} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">התשלום בוטל</h2>
          <p className="text-[#33332D]/60 text-sm mb-8">ביטלת את תהליך התשלום.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/plans')}
              className="flex-1 py-3.5 border border-[#E5E1D8] text-[#33332D]/60 font-semibold rounded-xl hover:bg-[#F7F5F0] transition-all text-sm">
              חזרה לתוכניות
            </button>
            <button onClick={() => { setPageState('ready'); setIframeVisible(false); }}
              className="flex-1 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all text-sm">
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'failure') {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white rounded-[2rem] p-10 max-w-md w-full text-center border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 8px 40px rgba(98,109,88,0.12)' }}>
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">שגיאה בתשלום</h2>
          <p className="text-[#33332D]/60 text-sm mb-8">{errorMsg || 'אירעה שגיאה. נסה שוב.'}</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/plans')}
              className="flex-1 py-3.5 border border-[#E5E1D8] text-[#33332D]/60 font-semibold rounded-xl hover:bg-[#F7F5F0] transition-all text-sm">
              חזרה לתוכניות
            </button>
            <button onClick={() => { setPageState('ready'); setIframeVisible(false); setErrorMsg(''); }}
              className="flex-1 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all text-sm">
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalAmount = plan ? plan.monthly_amount * plan.required_successful_payments : 0;

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-10 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {pageState === 'ready' && (
          <button onClick={() => navigate('/plans')}
            className="flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors">
            <ArrowRight size={16} />
            <span>חזרה לבחירת תוכניות</span>
          </button>
        )}

        <div className="flex items-center gap-2 mb-6 text-xs text-[#626D58] font-semibold">
          <Lock size={13} />
          <span>תשלום מאובטח SSL · נדרים פלוס PCI DSS</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60"
              style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.08)' }}>

              {/* Step 1: choose payment method */}
              {pageState === 'ready' && (
                <div className="p-8">
                  <h1 className="text-2xl font-black text-[#0A192F] mb-6">פרטי תשלום</h1>

                  {/* Plan summary */}
                  {plan && (
                    <div className="rounded-2xl bg-[#0A192F] p-5 mb-6 text-white">
                      <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#D4B483]/60 mb-3">סיכום ההתחייבות</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-white/40 text-xs mb-0.5">תוכנית</div>
                          <div className="font-bold">{plan.name_he}</div>
                        </div>
                        <div>
                          <div className="text-white/40 text-xs mb-0.5">סוג תשלום</div>
                          <div className="font-bold">הוראת קבע חודשית</div>
                        </div>
                        <div>
                          <div className="text-white/40 text-xs mb-0.5">תשלום חודשי</div>
                          <div className="font-bold text-[#D4B483]">₪{plan.monthly_amount.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-white/40 text-xs mb-0.5">מספר תשלומים</div>
                          <div className="font-bold">{plan.required_successful_payments} חודשים</div>
                        </div>
                        <div>
                          <div className="text-white/40 text-xs mb-0.5">סה"כ התחייבות</div>
                          <div className="font-bold">₪{totalAmount.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-white/40 text-xs mb-0.5">רמת מלון</div>
                          <div className="font-bold">{hotelLevelLabel(plan.hotel_level)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Terms summary */}
                  <div className="rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/60 p-5 mb-6">
                    <h4 className="font-semibold text-[#0A192F] text-sm mb-3">עיקרי תנאי השירות</h4>
                    <ul className="text-xs text-[#33332D]/60 space-y-2 leading-relaxed">
                      {[
                        'התשלומים יחויבו מדי חודש באופן אוטומטי',
                        'זכאות למלון תינתן רק לאחר השלמת כל התשלומים הנדרשים',
                        'כל הכספים ששולמו מהווים תרומה ולא יוחזרו במקרה של ביטול',
                        'ניתן לבטל את המנוי בכל עת דרך הגדרות החשבון',
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-2">
                          <CheckCircle size={12} className="text-[#626D58] mt-0.5 flex-shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Terms agreement checkbox */}
                  <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer mb-2 transition-all ${
                    agreed
                      ? 'bg-[#626D58]/5 border-[#626D58]/40'
                      : 'bg-[#D4B483]/5 border-[#D4B483]/30 hover:border-[#D4B483]/50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#626D58] flex-shrink-0"
                    />
                    <span className="text-sm text-[#33332D]/70 leading-relaxed">
                      קראתי ואני מאשר/ת את{' '}
                      <Link
                        to="/terms-of-use"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0A192F] font-semibold underline underline-offset-2 hover:text-[#626D58] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        תנאי השימוש ומדיניות התרומות
                      </Link>
                    </span>
                  </label>

                  {/* Blocking message */}
                  {!agreed && (
                    <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>יש לאשר את תנאי השימוש לפני המשך התהליך</span>
                    </div>
                  )}

                  {/* TWO payment method buttons */}
                  <div className="space-y-3 mt-4">
                    <p className="text-xs font-semibold text-[#33332D]/50 mb-2">בחר אמצעי תשלום:</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {/* Credit card — Nedarim iframe */}
                      <button
                        onClick={startIframe}
                        disabled={!agreed}
                        className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-right transition-all ${
                          agreed
                            ? 'border-[#0A192F] bg-[#0A192F] text-white hover:bg-[#0A192F]/90 cursor-pointer shadow-md hover:shadow-lg'
                            : 'border-[#E5E1D8] bg-[#F9F8F4] text-[#33332D]/30 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${agreed ? 'bg-white/15' : 'bg-[#E5E1D8]'}`}>
                          <CreditCard size={20} className={agreed ? 'text-white' : 'text-[#33332D]/30'} />
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-sm">כרטיס אשראי</div>
                          <div className={`text-xs mt-0.5 ${agreed ? 'text-white/60' : 'text-[#33332D]/25'}`}>
                            הוראת קבע דרך נדרים פלוס
                          </div>
                        </div>
                      </button>

                      {/* Bank direct debit */}
                      <button
                        onClick={() => agreed && setShowBankModal(true)}
                        disabled={!agreed}
                        className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-right transition-all ${
                          agreed
                            ? 'border-[#626D58] bg-white text-[#0A192F] hover:bg-[#F9F8F4] cursor-pointer shadow-sm hover:shadow-md'
                            : 'border-[#E5E1D8] bg-[#F9F8F4] text-[#33332D]/30 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${agreed ? 'bg-[#626D58]/10' : 'bg-[#E5E1D8]'}`}>
                          <Building2 size={20} className={agreed ? 'text-[#626D58]' : 'text-[#33332D]/30'} />
                        </div>
                        <div className="text-center">
                          <div className={`font-bold text-sm ${agreed ? 'text-[#0A192F]' : ''}`}>הוראת קבע בנקאית</div>
                          <div className={`text-xs mt-0.5 ${agreed ? 'text-[#33332D]/50' : 'text-[#33332D]/25'}`}>
                            דרך הבנק — צוות התמיכה יסייע
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Nedarim iframe */}
              {(pageState === 'iframe' || pageState === 'paying') && (
                <div>
                  {plan && (
                    <div className="px-6 pt-5 pb-0">
                      <div className="rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/60 p-4 flex flex-wrap gap-x-6 gap-y-2 text-xs mb-1">
                        <span className="font-bold text-[#0A192F]">{plan.name_he}</span>
                        <span className="text-[#33332D]/50">הוראת קבע</span>
                        <span className="text-[#626D58] font-semibold">₪{plan.monthly_amount.toLocaleString()} × {plan.required_successful_payments} חודשים</span>
                        <span className="text-[#B08D57] font-bold">סה"כ: ₪{totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  <div className="px-6 py-4 border-b border-[#E5E1D8]/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0A192F]">
                      <Shield size={16} className="text-[#626D58]" />
                      <span>טופס תשלום מאובטח — נדרים פלוס</span>
                    </div>
                    {pageState === 'iframe' && (
                      <button onClick={() => { setPageState('cancel'); setIframeVisible(false); }}
                        className="text-xs text-[#33332D]/40 hover:text-[#33332D]/70 transition-colors">
                        ביטול
                      </button>
                    )}
                  </div>

                  {!iframeVisible && (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <Loader2 size={36} className="animate-spin text-[#626D58] mx-auto mb-3" />
                        <p className="text-[#33332D]/50 text-sm">טוען טופס תשלום...</p>
                      </div>
                    </div>
                  )}

                  <iframe
                    ref={iframeRef}
                    src={NEDARIM_IFRAME_SRC}
                    onLoad={handleIframeLoad}
                    style={{ width: '100%', height: `${iframeHeight}px`, border: 'none', display: iframeVisible ? 'block' : 'none' }}
                    title="טופס תשלום נדרים פלוס"
                    allow="payment"
                  />

                  {iframeVisible && pageState === 'iframe' && (
                    <div className="px-6 py-5 border-t border-[#E5E1D8]/60">
                      <button onClick={handlePayClick}
                        className="w-full py-4 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                        <Shield size={18} />
                        <span>בצע תשלום</span>
                      </button>
                      <p className="text-center text-xs text-[#33332D]/40 mt-3">
                        לחיצה על "בצע תשלום" תשלח את פרטי הכרטיס לנדרים פלוס בצורה מוצפנת
                      </p>
                    </div>
                  )}

                  {pageState === 'paying' && (
                    <div className="px-6 py-5 border-t border-[#E5E1D8]/60 flex items-center justify-center gap-3">
                      <Loader2 size={20} className="animate-spin text-[#626D58]" />
                      <span className="text-sm text-[#33332D]/60">מעבד תשלום...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Order summary sidebar */}
          {plan && (
            <div className="lg:col-span-1">
              <div className="bg-[#0A192F] text-white rounded-[2rem] p-6 sticky top-8"
                style={{ boxShadow: '0 20px 60px rgba(10,25,47,0.15)' }}>
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#D4B483]/60 mb-4">
                  סיכום הזמנה
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{plan.name_he}</h2>
                <div className="text-xs text-white/40 mb-6">{hotelLevelLabel(plan.hotel_level)}</div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">תשלום חודשי</span>
                    <span className="font-semibold">₪{plan.monthly_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">מספר תשלומים</span>
                    <span className="font-semibold">{plan.required_successful_payments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">סוג</span>
                    <span className="font-semibold">הוראת קבע</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-white/50">סה"כ צבירה</span>
                    <span className="text-[#D4B483] font-bold text-lg">₪{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-6 p-3 rounded-xl bg-[#626D58]/20 border border-[#626D58]/30">
                  <div className="flex items-center gap-2 text-xs text-[#D4B483]">
                    <CheckCircle size={14} />
                    <span>זכאות מיידית — הצבירה מתחילה כעת</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bank transfer modal */}
      {showBankModal && plan && (
        <div className="fixed inset-0 bg-[#0A192F]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] max-w-lg w-full p-8 border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 24px 60px rgba(10,25,47,0.2)' }}>

            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-[#626D58]" />
                </div>
                <h2 className="text-xl font-black text-[#0A192F]">הצטרפות באמצעות הוראת קבע בנקאית</h2>
              </div>
              <button onClick={() => setShowBankModal(false)}
                className="p-2 text-[#33332D]/40 hover:text-[#33332D] transition-colors rounded-xl hover:bg-[#F7F5F0] flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Plan details */}
            <div className="rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/60 p-4 mb-5">
              <div className="text-xs text-[#33332D]/50 mb-2 font-semibold uppercase tracking-wide">פרטי התוכנית שנבחרה</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[#33332D]/40">תוכנית: </span><span className="font-semibold text-[#0A192F]">{plan.name_he}</span></div>
                <div><span className="text-[#33332D]/40">סכום חודשי: </span><span className="font-semibold text-[#626D58]">₪{plan.monthly_amount.toLocaleString()}</span></div>
                <div><span className="text-[#33332D]/40">תשלומים: </span><span className="font-semibold text-[#0A192F]">{plan.required_successful_payments}</span></div>
                <div><span className="text-[#33332D]/40">רמת מלון: </span><span className="font-semibold text-[#0A192F]">{hotelLevelLabel(plan.hotel_level)}</span></div>
                <div className="col-span-2 pt-2 border-t border-[#E5E1D8]/60 mt-1">
                  <span className="text-[#33332D]/40">סה"כ: </span>
                  <span className="font-bold text-[#B08D57]">₪{(plan.monthly_amount * plan.required_successful_payments).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* User details */}
            <div className="rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/60 p-4 mb-5">
              <div className="text-xs text-[#33332D]/50 mb-2 font-semibold uppercase tracking-wide">פרטי הגשה</div>
              <div className="text-sm">
                <span className="text-[#33332D]/40">אימייל: </span>
                <span className="font-semibold text-[#0A192F]">{user?.email ?? '—'}</span>
              </div>
            </div>

            <p className="text-sm text-[#33332D]/60 leading-relaxed mb-5">
              אם ברצונך להצטרף למנוי באמצעות הוראת קבע מהבנק, יש ליצור קשר עם צוות התמיכה שלנו.
              נציג יחזור אליך ויסייע בהקמת הוראת הקבע.
            </p>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">הערה (אופציונלי)</label>
              <textarea
                value={bankNote}
                onChange={(e) => setBankNote(e.target.value)}
                rows={3}
                placeholder='לדוגמה: "אני מעוניין לבצע הוראת קבע דרך בנק הפועלים"'
                className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={submitBankRequest} disabled={bankSubmitting}
                className="flex-1 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {bankSubmitting
                  ? <Loader2 size={18} className="animate-spin" />
                  : <><Send size={16} /><span>שלח בקשה</span></>
                }
              </button>
              <button onClick={() => setShowBankModal(false)} disabled={bankSubmitting}
                className="flex-1 py-3.5 bg-[#F7F5F0] text-[#33332D] font-semibold rounded-xl hover:bg-[#E5E1D8] transition-colors">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
