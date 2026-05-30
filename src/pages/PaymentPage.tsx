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

type PageState = 'loading_plan' | 'ready' | 'iframe' | 'paying' | 'success' | 'failure' | 'cancel';

// Official URL from sample2.html — no www, no trailing slash
const NEDARIM_IFRAME_SRC = 'https://matara.pro/nedarimplus/iframe?language=he';
const MOSAD = '7010422';
const API_VALID = 'Rd8QEQCDEY';
const SUPABASE_FN_BASE = 'https://iuwdfxgkwpdhnvveucwz.supabase.co/functions/v1';
const CALLBACK_URL = `${SUPABASE_FN_BASE}/nedarim-keva-callback`;

const PLAN_CONFIG: Record<number, { paymentType: string; tashlumim: string }> = {
  290: { paymentType: 'HK', tashlumim: '15' },
  350: { paymentType: 'HK', tashlumim: '15' },
};

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
      if (!data) { setErrorMsg('תוכנית לא נמצאה'); setPageState('failure'); return; }
      setPlan(data);
      setPageState('ready');
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בטעינת תוכנית');
      setPageState('failure');
    }
  };

  // Matches sample2.html: PostNedarim(Data) { iframeWin.postMessage(Data, "*") }
  const postNedarim = useCallback((data: object) => {
    const iframeWin = iframeRef.current?.contentWindow;
    if (!iframeWin) {
      console.warn('[PaymentPage] postNedarim: iframe contentWindow not available');
      return;
    }
    console.log('[PaymentPage] postNedarim →', JSON.stringify(data));
    iframeWin.postMessage(data, '*'); // sample2.html uses "*" — NOT the iframe URL
  }, []);

  // Matches sample2.html: iframe.onload = () => PostNedarim({Name:'GetHeight'})
  const handleIframeLoad = useCallback(() => {
    console.log('[PaymentPage] iframe onload fired — sending GetHeight');
    postNedarim({ Name: 'GetHeight' });
  }, [postNedarim]);

  // Matches sample2.html ReadPostMessage switch on event.data.Name
  const handleMessage = useCallback((event: MessageEvent) => {
    // Log every message regardless of origin to see what arrives
    console.log('[PaymentPage] raw message received', 'origin:', event.origin, 'data:', JSON.stringify(event.data));

    // Only trust matara.pro — note: no www, check both
    if (event.origin && event.origin !== '' &&
        !event.origin.includes('matara.pro')) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.Name) {
      case 'Height': {
        // sample2.html: frame.style.height = (parseInt(Value) + 15) + "px"; hide loader
        const h = parseInt(data.Value ?? '0', 10);
        console.log('[PaymentPage] Height received:', h);
        if (h > 0) {
          setIframeHeight(h + 15);
          setIframeVisible(true);
          console.log('[PaymentPage] iframe is now visible, height set to', h + 15);
        }
        break;
      }
      case 'TransactionResponse': {
        const resp = data.Value ?? {};
        console.log('[PaymentPage] TransactionResponse:', JSON.stringify(resp));
        if (resp.Status === 'Error') {
          setErrorMsg(resp.Message ?? 'שגיאה בעיבוד התשלום');
          setPageState('failure');
        } else {
          setPageState('success');
        }
        break;
      }
      default:
        console.log('[PaymentPage] unhandled message Name:', data.Name);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Poll GetHeight while iframe is open for responsive resize
  useEffect(() => {
    if (pageState !== 'iframe' && pageState !== 'paying') return;
    const interval = setInterval(() => postNedarim({ Name: 'GetHeight' }), 3000);
    const onResize = () => postNedarim({ Name: 'GetHeight' });
    window.addEventListener('resize', onResize);
    return () => { clearInterval(interval); window.removeEventListener('resize', onResize); };
  }, [pageState, postNedarim]);

  // Called by "בצע תשלום" button — matches sample2.html PayBtClick → FinishTransaction2
  const handlePayClick = useCallback(() => {
    if (!plan || !user) return;
    const cfg = PLAN_CONFIG[plan.monthly_amount];
    if (!cfg) { setErrorMsg('תוכנית לא נתמכת'); setPageState('failure'); return; }

    const payload = {
      Name: 'FinishTransaction2',
      Value: {
        Mosad: MOSAD,
        ApiValid: API_VALID,
        PaymentType: cfg.paymentType,
        Currency: '1',
        Zeout: '',
        FirstName: '',
        LastName: '',
        Street: '',
        City: '',
        Phone: '',
        Mail: '',
        Amount: String(plan.monthly_amount),
        Tashlumim: cfg.tashlumim,
        Groupe: 'תשלום דרך אתר נציבים',
        Comment: '',
        Param1: user.id,
        Param2: plan.id,
        ForceUpdateMatching: '1',
        CallBack: CALLBACK_URL,
        CallBackMailError: '',
      },
    };

    console.log('[PaymentPage] FinishTransaction2 →', JSON.stringify(payload));
    setPageState('paying');
    postNedarim(payload);
  }, [plan, user, postNedarim]);

  const startIframe = () => {
    if (!agreed || !plan || !user) return;
    console.log('[PaymentPage] iframe starting, mounting element');
    setIframeVisible(false);
    setPageState('iframe');
  };

  // ── Result screens ────────────────────────────────────────

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

              {/* Step 1: agreement — before iframe is mounted */}
              {pageState === 'ready' && (
                <div className="p-8">
                  <h1 className="text-2xl font-black text-[#0A192F] mb-6">פרטי תשלום</h1>

                  <div className="rounded-2xl border border-[#E5E1D8]/60 bg-[#F9F8F4] p-5 mb-6 flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield size={18} className="text-[#626D58]" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#0A192F] text-sm mb-1">הוראת קבע דרך נדרים פלוס</div>
                      <div className="text-xs text-[#33332D]/50 leading-relaxed">
                        הטופס מוטמע ישירות באתר. הפרטים שלך מוזנים בסביבה מאובטחת של נדרים פלוס.
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

                  <button onClick={startIframe} disabled={!agreed}
                    className="w-full py-4 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    <Shield size={18} />
                    <span>המשך לטופס תשלום מאובטח</span>
                  </button>
                </div>
              )}

              {/* Step 2: iframe is mounted */}
              {(pageState === 'iframe' || pageState === 'paying') && (
                <div>
                  <div className="px-6 py-4 border-b border-[#E5E1D8]/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0A192F]">
                      <Shield size={16} className="text-[#626D58]" />
                      <span>טופס תשלום מאובטח — נדרים פלוס</span>
                    </div>
                    {pageState === 'iframe' && (
                      <button
                        onClick={() => { setPageState('cancel'); setIframeVisible(false); }}
                        className="text-xs text-[#33332D]/40 hover:text-[#33332D]/70 transition-colors">
                        ביטול
                      </button>
                    )}
                  </div>

                  {/* Spinner shown until Height message arrives from iframe */}
                  {!iframeVisible && (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <Loader2 size={36} className="animate-spin text-[#626D58] mx-auto mb-3" />
                        <p className="text-[#33332D]/50 text-sm">טוען טופס תשלום...</p>
                      </div>
                    </div>
                  )}

                  {/*
                    iframe is always mounted when pageState=iframe so onload fires.
                    display:none keeps it hidden until we get the Height postMessage back.
                    The official sample2.html flow:
                      iframe.onload → PostNedarim({Name:'GetHeight'})
                      iframe responds with {Name:'Height', Value:'620'}
                      → set height, hide loader
                  */}
                  <iframe
                    ref={iframeRef}
                    src={NEDARIM_IFRAME_SRC}
                    onLoad={handleIframeLoad}
                    style={{
                      width: '100%',
                      height: `${iframeHeight}px`,
                      border: 'none',
                      display: iframeVisible ? 'block' : 'none',
                    }}
                    title="טופס תשלום נדרים פלוס"
                    allow="payment"
                  />

                  {/* Pay button — shown only when iframe is visible and not mid-transaction */}
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

          {/* Order summary */}
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
    </div>
  );
}
