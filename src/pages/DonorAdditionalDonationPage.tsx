import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, Heart, Loader2, Shield, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DonorLayout from '../components/DonorLayout';
import { useAuth } from '../hooks/useAuth';

type PaymentState = 'select' | 'iframe_loading' | 'iframe_ready' | 'success' | 'failure' | 'cancel';

const NEDARIM_IFRAME_URL = 'https://www.matara.pro/nedarimplus/iframe/';
const MOSAD = '7010422';
const API_VALID = 'Rd8QEQCDEY';
const SUPABASE_FN_BASE = 'https://iuwdfxgkwpdhnvveucwz.supabase.co/functions/v1';
const CALLBACK_URL = `${SUPABASE_FN_BASE}/nedarim-payment-callback`;
const CALLBACK_MAIL_ERROR = '';

const PRESET_AMOUNTS = [50, 100, 180, 250, 500, 1000];

export default function DonorAdditionalDonationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [state, setState] = useState<PaymentState>('select');
  const [iframeHeight, setIframeHeight] = useState(600);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedAmount = parseInt(amount) || 0;

  const handleAmountSelect = (value: number) => {
    setAmount(value.toString());
    setCustomAmount('');
  };

  const handleCustomChange = (value: string) => {
    const n = value.replace(/[^0-9]/g, '');
    setCustomAmount(n);
    setAmount(n);
  };

  const sendPostNedarim = useCallback(() => {
    if (!user || !iframeRef.current?.contentWindow || selectedAmount < 10) return;

    const payload = {
      Mosad: MOSAD,
      ApiValid: API_VALID,
      PaymentType: 'Ragil',
      Amount: String(selectedAmount),
      Tashlumim: '1',
      Currency: '1',
      Groupe: 'תרומה נוספת דרך אתר נציבים',
      Comment: '',
      Param1: user.id,
      Param2: 'additional_donation',
      CallBack: CALLBACK_URL,
      CallBackMailError: CALLBACK_MAIL_ERROR,
      Zeout: '',
      FirstName: '',
      LastName: '',
      Street: '',
      City: '',
      Phone: '',
      Mail: '',
    };

    console.log('[AdditionalDonation] PostNedarim payload:', payload);

    iframeRef.current.contentWindow.postMessage(
      { Name: 'PostNedarim', Value: payload },
      NEDARIM_IFRAME_URL
    );
  }, [user, selectedAmount]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.origin.includes('matara.pro')) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.Name === 'Height' || data.height) {
      const h = parseInt(data.Value ?? data.height ?? '0', 10);
      if (h > 0) setIframeHeight(h + 40);
      return;
    }
    if (data.Name === 'IframeReady' || data.Action === 'IframeReady') {
      setState('iframe_ready');
      sendPostNedarim();
      return;
    }
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
  }, [sendPostNedarim]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (state !== 'iframe_ready' && state !== 'iframe_loading') return;
    const askHeight = () => {
      iframeRef.current?.contentWindow?.postMessage({ Name: 'Height' }, NEDARIM_IFRAME_URL);
    };
    const interval = setInterval(askHeight, 2000);
    window.addEventListener('resize', askHeight);
    return () => { clearInterval(interval); window.removeEventListener('resize', askHeight); };
  }, [state]);

  const startPayment = () => {
    if (selectedAmount < 10) return;
    setState('iframe_loading');
  };

  const handleIframeLoad = () => {
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ Name: 'Height' }, NEDARIM_IFRAME_URL);
    }, 500);
  };

  if (state === 'success') {
    return (
      <DonorLayout>
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-white rounded-[2rem] p-10 text-center border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 8px 40px rgba(98,109,88,0.12)' }}>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-[#0A192F] mb-3">תרומה התקבלה!</h2>
            <p className="text-[#33332D]/60 text-sm mb-8 leading-relaxed">
              תודה על תרומתך הנוספת! תרומתך תעזור לנו לעזור ליותר משפחות.
            </p>
            <button onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all">
              חזרה ללוח הבקרה
            </button>
          </div>
        </div>
      </DonorLayout>
    );
  }

  if (state === 'cancel' || state === 'failure') {
    const isCancel = state === 'cancel';
    return (
      <DonorLayout>
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-white rounded-[2rem] p-10 text-center border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 8px 40px rgba(98,109,88,0.12)' }}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${isCancel ? 'bg-amber-100' : 'bg-red-100'}`}>
              <XCircle size={32} className={isCancel ? 'text-amber-500' : 'text-red-500'} />
            </div>
            <h2 className="text-2xl font-black text-[#0A192F] mb-3">
              {isCancel ? 'התשלום בוטל' : 'שגיאה בתשלום'}
            </h2>
            <p className="text-[#33332D]/60 text-sm mb-8">
              {isCancel ? 'ביטלת את תהליך התשלום.' : (errorMsg || 'אירעה שגיאה. נסה שוב.')}
            </p>
            <button onClick={() => { setState('select'); setErrorMsg(''); }}
              className="w-full py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all">
              נסה שוב
            </button>
          </div>
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A192F]">תרומה נוספת</h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">
            תרום סכום נוסף מעבר למנוי החודשי שלך
          </p>
        </div>

        {state === 'select' && (
          <>
            <div className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
              style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.08)' }}>
              <h2 className="text-lg font-black text-[#0A192F] mb-6">בחר סכום לתרומה</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {PRESET_AMOUNTS.map((value) => (
                  <button key={value} onClick={() => handleAmountSelect(value)}
                    className={`p-5 rounded-2xl border-2 transition-all text-center ${
                      amount === value.toString()
                        ? 'border-[#626D58] bg-[#626D58]/5 shadow-sm'
                        : 'border-[#E5E1D8] hover:border-[#D4B483]/60 hover:bg-[#F9F8F4]'
                    }`}>
                    <div className={`text-2xl font-black mb-0.5 ${amount === value.toString() ? 'text-[#626D58]' : 'text-[#0A192F]'}`}>
                      ₪{value.toLocaleString()}
                    </div>
                    <div className="text-xs text-[#33332D]/40">תרומה חד פעמית</div>
                  </button>
                ))}
              </div>

              <div className="mb-8">
                <label className="block text-sm font-semibold text-[#33332D]/70 mb-3">או הזן סכום אחר:</label>
                <div className="relative">
                  <span className="absolute start-4 top-1/2 -translate-y-1/2 text-[#33332D]/40 font-semibold text-lg pointer-events-none">₪</span>
                  <input type="text" value={customAmount} onChange={(e) => handleCustomChange(e.target.value)}
                    placeholder="0" dir="ltr"
                    className="w-full ps-10 pe-4 py-3.5 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] text-lg font-bold placeholder-[#33332D]/20 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all" />
                </div>
                <p className="text-xs text-[#33332D]/40 mt-2">סכום מינימלי: ₪10</p>
              </div>

              {selectedAmount > 0 && (
                <div className="flex items-center justify-between p-5 rounded-2xl border border-[#D4B483]/30 mb-6"
                  style={{ backgroundColor: 'rgba(212,180,131,0.05)' }}>
                  <span className="text-sm font-semibold text-[#33332D]/60">סכום לתרומה</span>
                  <span className="text-2xl font-black text-[#0A192F]">₪{selectedAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4 text-xs text-[#626D58] font-semibold">
                <Lock size={12} />
                <span>תשלום מאובטח · נדרים פלוס · SSL</span>
              </div>

              <button onClick={startPayment} disabled={selectedAmount < 10}
                className={`w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
                  selectedAmount >= 10
                    ? 'bg-[#0A192F] text-white hover:bg-[#0A192F]/90 shadow-sm hover:shadow-md'
                    : 'bg-[#F7F5F0] text-[#33332D]/30 cursor-not-allowed border border-[#E5E1D8]'
                }`}>
                <Heart size={18} className={selectedAmount >= 10 ? 'text-[#D4B483]' : ''} />
                <span>{selectedAmount >= 10 ? `תרום ₪${selectedAmount.toLocaleString()} עכשיו` : 'בחר סכום לתרומה'}</span>
              </button>
            </div>

            <div className="bg-white rounded-[2rem] p-7 border border-[#E5E1D8]/60"
              style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.06)' }}>
              <h3 className="text-base font-bold text-[#0A192F] mb-4">למה לתרום תרומה נוספת?</h3>
              <ul className="space-y-3">
                {[
                  'תרומתך מסייעת לנו להמשיך לעזור למשפחות נזקקות',
                  'כל שקל עוזר לנו לספק שירותי אירוח איכותיים יותר',
                  'תרומה נוספת מאפשרת לנו להרחיב את מאגר המלונות',
                ].map((text) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-[#33332D]/60 font-light">
                    <div className="w-5 h-5 rounded-full bg-[#D4B483]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Heart size={10} className="text-[#B08D57]" fill="currentColor" />
                    </div>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Iframe payment step */}
        {(state === 'iframe_loading' || state === 'iframe_ready') && (
          <div className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.08)' }}>

            <div className="px-6 py-4 border-b border-[#E5E1D8]/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0A192F]">
                <Shield size={16} className="text-[#626D58]" />
                <span>תשלום מאובטח — ₪{selectedAmount.toLocaleString()}</span>
              </div>
              <button onClick={() => setState('cancel')}
                className="text-xs text-[#33332D]/40 hover:text-[#33332D]/70 transition-colors">
                ביטול
              </button>
            </div>

            <div className="relative">
              {state === 'iframe_loading' && (
                <div className="absolute inset-0 bg-white flex items-center justify-center z-10" style={{ minHeight: 300 }}>
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
          </div>
        )}
      </div>
    </DonorLayout>
  );
}
