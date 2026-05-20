import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CreditCard, Shield, Lock, CheckCircle } from 'lucide-react';
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

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const planId = location.state?.planId;

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    if (!planId) {
      navigate('/plans');
      return;
    }
    loadPlan();
  }, [user, planId]);

  const loadPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .eq('active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setError('תוכנית לא נמצאה');
        return;
      }
      setPlan(data);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת תוכנית');
    } finally {
      setLoading(false);
    }
  };

  const PAYMENT_LINKS: Record<number, string> = {
    290: 'https://www.matara.pro/nedarimplus/online/?mosad=7010422&onlykeva=1&Amount=290&AmountLock=1&Payment=15&PaymentLock=1&groupe=%D7%AA%D7%A9%D7%9C%D7%95%D7%9D%20%D7%93%D7%A8%D7%9A%20%D7%90%D7%AA%D7%A8%20%D7%A0%D7%A6%D7%99%D7%91%D7%99%D7%9D&groupelock=1',
    350: 'https://www.matara.pro/nedarimplus/online/?mosad=7010422&onlykeva=1&Amount=350&AmountLock=1&Payment=15&PaymentLock=1&groupe=%D7%AA%D7%A9%D7%9C%D7%95%D7%9D%20%D7%93%D7%A8%D7%9A%20%D7%90%D7%AA%D7%A8%20%D7%A0%D7%A6%D7%99%D7%91%D7%99%D7%9D&groupelock=1',
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed || !plan) return;

    const paymentUrl = PAYMENT_LINKS[plan.monthly_amount];
    if (!paymentUrl) {
      setError('קישור תשלום לא נמצא עבור תוכנית זו');
      return;
    }

    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#33332D]/50 text-sm">טוען...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'תוכנית לא נמצאה'}</p>
          <button
            onClick={() => navigate('/plans')}
            className="text-[#626D58] hover:text-[#626D58]/80 text-sm font-medium transition-colors"
          >
            חזרה לבחירת תוכניות
          </button>
        </div>
      </div>
    );
  }

  const totalAmount = plan.monthly_amount * plan.required_successful_payments;

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-12 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/plans')}
          className="flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors"
        >
          <ArrowRight size={16} />
          <span>חזרה לבחירת תוכניות</span>
        </button>

        {/* Security badge */}
        <div className="flex items-center gap-2 mb-6 text-xs text-[#626D58] font-semibold">
          <Lock size={13} />
          <span>תשלום מאובטח SSL · End-to-End Encryption</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Payment form — 2 cols */}
          <div className="lg:col-span-2">
            <div
              className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
              style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
            >
              <h1 className="text-2xl font-black text-[#0A192F] mb-8">פרטי תשלום</h1>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl mb-6 text-red-700 text-sm">
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePayment} className="space-y-6">
                {/* Payment info */}
                <div
                  className="rounded-2xl border-2 border-dashed border-[#E5E1D8] p-6 flex items-center gap-4"
                  style={{ backgroundColor: '#F9F8F4' }}
                >
                  <div className="w-12 h-12 rounded-xl bg-[#0A192F]/5 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="text-[#626D58]" size={22} />
                  </div>
                  <div>
                    <div className="font-semibold text-[#0A192F] text-sm">תשלום מאובטח דרך נדרים פלוס</div>
                    <div className="text-xs text-[#33332D]/50 mt-0.5">
                      לחיצה על הכפתור תעביר אותך לדף התשלום המאובטח של נדרים פלוס.
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <div className="rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/60 p-5">
                  <h4 className="font-semibold text-[#0A192F] text-sm mb-3">תנאי השירות</h4>
                  <ul className="text-xs text-[#33332D]/60 space-y-1.5 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <CheckCircle size={12} className="text-[#626D58] mt-0.5 flex-shrink-0" />
                      התשלומים יחויבו מדי חודש באופן אוטומטי
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={12} className="text-[#626D58] mt-0.5 flex-shrink-0" />
                      זכאות למלון תינתן רק לאחר השלמת כל התשלומים הנדרשים
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={12} className="text-[#626D58] mt-0.5 flex-shrink-0" />
                      ניתן לבטל את המנוי בכל עת דרך הגדרות החשבון
                    </li>
                  </ul>
                </div>

                {/* Agreement */}
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-[#D4B483]/5 border border-[#D4B483]/30 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#626D58] flex-shrink-0"
                  />
                  <span className="text-sm text-[#33332D]/70">
                    אני מאשר/ת שקראתי והבנתי את תנאי השירות ומסכים/ה להם
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!agreed}
                  className="w-full py-4 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Shield size={18} />
                  <span>המשך לתשלום מאובטח</span>
                </button>
              </form>
            </div>
          </div>

          {/* Order summary — 1 col */}
          <div className="lg:col-span-1">
            <div
              className="bg-[#0A192F] text-white rounded-[2rem] p-6 sticky top-8"
              style={{ boxShadow: '0 20px 60px rgba(10,25,47,0.15)' }}
            >
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
