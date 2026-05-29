import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle, XCircle, Loader2, Shield, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Plan {
  id: string;
  name_he: string;
  description_he: string;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
}

type PaymentState = 'loading_plan' | 'ready' | 'iframe_loading' | 'iframe_ready' | 'success' | 'failure' | 'cancel';

const NEDARIM_IFRAME_URL = 'https://www.matara.pro/nedarimplus/iframe/';
const MOSAD = '7010422';
const API_VALID = 'Rd8QEQCDEY';
const SUPABASE_FN_BASE = 'https://iuwdfxgkwpdhnvveucwz.supabase.co/functions/v1';
const CALLBACK_URL = `${SUPABASE_FN_BASE}/nedarim-keva-callback`;
const CALLBACK_MAIL_ERROR = '';

// Plans keyed by DB monthly_amount
const PLAN_CONFIG: Record<number, { paymentType: string; tashlumim: string; groupe: string }> = {
  290: { paymentType: 'HK', tashlumim: '15', groupe: 'תשלום דרך אתר נציבים' },
  350: { paymentType: 'HK', tashlumim: '15', groupe: 'תשלום דרך אתר נציבים' },
};

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [state, setState] = useState<PaymentState>('loading_plan');
  const [iframeHeight, setIframeHeight] = useState(600);
  const [agreed, setAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [iframeStarted, setIframeStarted] = useState(false);

  const planId = location.state?.planId;

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    if (!planId) { navigate('/plans'); return; }
    loadPlan();
  }, [user, planId]);

  const loadPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('plans').select('*').eq('id', planId).eq('active', true).maybeSingle();
      if (error) throw error;
      if (!data) { setErrorMsg('תוכנית לא נמצאה'); setState('failure'); return; }
      setPlan(data);
      setState('ready');
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בטעינת תוכנית');
      setState('failure');
    }
  };

  // PostMessage handler — listens to all messages from the Nedarim iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    // Only trust messages from matara.pro
    if (!event.origin.includes('matara.pro')) return;

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // Height update
    if (data.Name === 'Height' || data.height) {
      const h = parseInt(data.Value ?? data.height ?? '0', 10);
      if (h > 0) setIframeHeight(h + 40);
      return;
    }

    // iframe finished loading — fire PostNedarim
    if (data.Name === 'IframeReady' || data.Action === 'IframeReady') {
      setState('iframe_ready');
      sendPostNedarim();
      return;
    }

    // Payment result
    if (data.Name === 'PaymentSuccess' || data.Action === 'PaymentSuccess' || data.Status === 'Success') {
      setState('success');
      return;
    }
    if (data.Name === 'PaymentFailure' || data.Action === 'PaymentFailure' || data.Status === 'Failure') {
      setState('failure');
      setErrorMsg(data.Message ?? 'התשלום נכשל. נסה שוב.');
      return;
    }
    if (data.Name === 'PaymentCancel' || data.Action === 'PaymentCancel' || data.Status === 'Cancel') {
      setState('cancel');
      return;
    }
  }, [plan, user]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Poll iframe height on resize
  useEffect(() => {
    if (state !== 'iframe_ready' && state !== 'iframe_loading') return;
    const askHeight = () => {
      iframeRef.current?.contentWindow?.postMessage({ Name: 'Height' }, NEDARIM_IFRAME_URL);
    };
    const interval = setInterval(askHeight, 2000);
    window.addEventListener('resize', askHeight);
    return () => { clearInterval(interval); window.removeEventListener('resize', askHeight); };
  }, [state]);

  const sendPostNedarim = useCallback(() => {
    if (!plan || !user || !iframeRef.current?.contentWindow) return;

    const cfg = PLAN_CONFIG[plan.monthly_amount];
    if (!cfg) return;

    const payload = {
      // Required identification
      Mosad: MOSAD,
      ApiValid: API_VALID,

      // Payment type and amounts
      PaymentType: cfg.paymentType,
      Amount: String(plan.monthly_amount),
      Tashlumim: cfg.tashlumim,
      Currency: '1', // ILS

      // Category
      Groupe: cfg.groupe,
      Comment: '',

      // Identity — authenticated user UUID + plan ID
      Param1: user.id,
      Param2: plan.id,

      // Server-side callback
      CallBack: CALLBACK_URL,
      CallBackMailError: CALLBACK_MAIL_ERROR,

      // Donor fields — left blank, donor fills in iframe
      Zeout: '',
      FirstName: '',
      LastName: '',
      Street: '',
      City: '',
      Phone: '',
      Mail: '',
    };

    console.log('[PaymentPage] PostNedarim payload:', payload);

    iframeRef.current.contentWindow.postMessage(
      { Name: 'PostNedarim', Value: payload },
      NEDARIM_IFRAME_URL
    );
  }, [plan, user]);

  const startPayment = () => {
    if (!agreed || !plan || !user) return;
    setIframeStarted(true);
    setState('iframe_loading');
  };

  const handleIframeLoad = () => {
    // Ask for height as soon as iframe DOM loads; PostNedarim fires on IframeReady message
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ Name: 'Height' }, NEDARIM_IFRAME_URL);
    }, 500);
  };

  if (state === 'loading_plan') {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#33332D]/50 text-sm">טוען...</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
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
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all"
          >
            עבור ללוח הבקרה
          </button>
        </div>
      </div>
    );
  }

  if (state === 'cancel') {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white rounded-[2rem] p-10 max-w-md w-full text-center border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 8px 40px rgba(98,109,88,0.12)' }}>
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <XCircle size={32} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">התשלום בוטל</h2>
          <p className="text-[#33332D]/60 text-sm mb-8">ביטלת את תהליך התשלום. תוכל לחזור ולנסות שוב בכל עת.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/plans')}
              className="flex-1 py-3.5 border border-[#E5E1D8] text-[#33332D]/60 font-semibold rounded-xl hover:bg-[#F7F5F0] transition-all text-sm">
              חזרה לתוכניות
            </button>
            <button onClick={() => { setState('ready'); setIframeStarted(false); }}
              className="flex-1 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all text-sm">
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'failure') {
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
            <button onClick={() => { setState('ready'); setIframeStarted(false); setErrorMsg(''); }}
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

        {!iframeStarted && (
          <button onClick={() => navigate('/plans')}
            className="flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors">
            <ArrowRight size={16} />
            <span>חזרה לבחירת תוכניות</span>
          </button>
        )}

        <div className="flex items-center gap-2 mb-6 text-xs text-[#626D58] font-semibold">
          <Lock size={13} />
          <span>תשלום מאובטח SSL · End-to-End Encryption · נדרים פלוס</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left: form / iframe */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60"
              style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.08)' }}>

              {/* Pre-iframe agreement step */}
              {!iframeStarted && (
                <div className="p-8">
                  <h1 className="text-2xl font-black text-[#0A192F] mb-6">פרטי תשלום</h1>

                  <div className="rounded-2xl border border-[#E5E1D8]/60 bg-[#F9F8F4] p-5 mb-6 flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield size={18} className="text-[#626D58]" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#0A192F] text-sm mb-1">הוראת קבע דרך נדרים פלוס</div>
                      <div className="text-xs text-[#33332D]/50 leading-relaxed">
                        הטופס מוטמע ישירות באתר. הפרטים שלך מוזנים בסביבה מאובטחת של נדרים פלוס מבלי לצאת מהאתר.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/60 p-5 mb-6">
                    <h4 className="font-semibold text-[#0A192F] text-sm mb-3">תנאי השירות</h4>
                    <ul className="text-xs text-[#33332D]/60 space-y-2 leading-relaxed">
                      {[
                        'התשלומים יחויבו מדי חודש באופן אוטומטי',
                        'זכאות למלון תינתן רק לאחר השלמת כל התשלומים הנדרשים',
                        'ניתן לבטל את המנוי בכל עת דרך הגדרות החשבון',
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-2">
                          <CheckCircle size={12} className="text-[#626D58] mt-0.5 flex-shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <label className="flex items-start gap-3 p-4 rounded-2xl bg-[#D4B483]/5 border border-[#D4B483]/30 cursor-pointer mb-6">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#626D58] flex-shrink-0" />
                    <span className="text-sm text-[#33332D]/70">
                      אני מאשר/ת שקראתי והבנתי את תנאי השירות ומסכים/ה להם
                    </span>
                  </label>

                  <button onClick={startPayment} disabled={!agreed}
                    className="w-full py-4 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    <Shield size={18} />
                    <span>המשך לתשלום מאובטח</span>
                  </button>
                </div>
              )}

              {/* Iframe area */}
              {iframeStarted && (
                <div className="relative">
                  {(state === 'iframe_loading') && (
                    <div className="absolute inset-0 bg-white flex items-center justify-center z-10 rounded-[2rem]">
                      <div className="text-center">
                        <Loader2 size={36} className="animate-spin text-[#626D58] mx-auto mb-3" />
                        <p className="text-[#33332D]/50 text-sm">טוען טופס תשלום...</p>
                      </div>
                    </div>
                  )}
                  <iframe
                    ref={iframeRef}
                    src={NEDARIM_IFRAME_URL}
                    onLoad={handleIframeLoad}
                    style={{ width: '100%', height: `${iframeHeight}px`, border: 'none', display: 'block' }}
                    title="טופס תשלום נדרים פלוס"
                    allow="payment"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: order summary */}
          {plan && (
            <div className="lg:col-span-1">
              <div className="bg-[#0A192F] text-white rounded-[2rem] p-6 sticky top-8"
                style={{ boxShadow: '0 20px 60px rgba(10,25,47,0.15)' }}>
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#D4B483]/60 mb-4">
                  סיכום הזמנה
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{plan.name_he}</h2>
                <div className="text-xs text-white/40 mb-6">{plan.hotel_level}</div>

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
                    <span className="text-white/50">רמת זכאות</span>
                    <span className="font-semibold">{plan.hotel_level}</span>
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

                {iframeStarted && (
                  <button
                    onClick={() => { setState('cancel'); setIframeStarted(false); }}
                    className="mt-4 w-full py-2.5 text-xs text-white/40 hover:text-white/70 transition-colors border border-white/10 rounded-xl"
                  >
                    ביטול
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
