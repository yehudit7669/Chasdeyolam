import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Zap, CheckCircle, ChevronLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';

interface PlanLite {
  id: string;
  name_he: string;
  monthly_amount: number;
  required_successful_payments: number;
  allow_immediate: boolean | null;
  allow_regular: boolean | null;
}

export default function RedemptionChoicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const planId = (location.state as { planId?: string } | null)?.planId;
  const [plan, setPlan] = useState<PlanLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) {
      navigate('/plans', { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('plans')
        .select('id, name_he, monthly_amount, required_successful_payments, allow_immediate, allow_regular')
        .eq('id', planId)
        .maybeSingle();
      if (data) {
        const allowImm = data.allow_immediate ?? true;
        const allowReg = data.allow_regular ?? true;
        // אם רק אפשרות אחת פעילה — דילוג ישיר לתשלום
        if (allowImm && !allowReg) { navigate('/availability-check', { state: { planId }, replace: true }); return; }
        if (allowReg && !allowImm) { navigate('/payment', { state: { planId, redemptionType: 'on_completion' }, replace: true }); return; }
        setPlan(data as PlanLite);
      }
      setLoading(false);
    })();
  }, [planId]);

  // מימוש מיידי עובר קודם בשאלה "יש העדפה למקום ותאריך?" — כדי לבדוק זמינות לפני שמשלמים את כל הסכום
  const goToPayment = (redemptionType: 'on_completion' | 'immediate') => {
    if (redemptionType === 'immediate') navigate('/availability-check', { state: { planId } });
    else navigate('/payment', { state: { planId, redemptionType } });
  };

  const total = plan ? plan.monthly_amount * plan.required_successful_payments : 0;

  return (
    <Layout>
      <div className="py-16 px-4" dir="rtl">
        <div className="max-w-4xl mx-auto">

          {/* Back */}
          <button
            onClick={() => navigate('/plans')}
            className="inline-flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה לתוכניות</span>
          </button>

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#626D58]/10 text-[#626D58] text-xs font-semibold uppercase tracking-widest mb-4">
              <Zap size={12} />
              <span>בחירת מסלול</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#0A192F] tracking-tight mb-3">
              איך תרצו לממש את החופשה?
            </h1>
            {plan && (
              <p className="text-[#33332D]/55 font-light text-lg">
                תוכנית <span className="font-bold text-[#0A192F]">{plan.name_he}</span> · ₪{plan.monthly_amount.toLocaleString()} לחודש · {plan.required_successful_payments} חודשים
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">

              {/* מסלול רגיל */}
              {plan?.allow_regular !== false && (
              <div className="bg-white border border-[#E5E1D8]/60 rounded-[2rem] p-8 flex flex-col"
                style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center">
                    <CalendarCheck size={20} className="text-[#626D58]" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#33332D]/40">מסלול רגיל</span>
                </div>
                <h2 className="text-2xl font-bold text-[#0A192F] mb-1">מימוש לאחר סיום</h2>
                <p className="text-sm text-[#33332D]/50 font-light mb-6">בוחרים נופש לאחר השלמת כל התשלומים</p>

                <ul className="space-y-3 mb-8 flex-1">
                  {['תרומה חודשית נוחה לאורך התוכנית', 'כל תשלום מקרב אתכם לחופשה', 'לאחר סיום — בוחרים מקום ותאריך', 'מקבלים שובר ישירות למייל'].map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle size={17} className="mt-0.5 flex-shrink-0 text-[#626D58]" />
                      <span className="text-sm text-[#33332D]/70 leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => goToPayment('on_completion')}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[#0A192F] text-white hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2"
                >
                  <span>המשך במסלול רגיל</span>
                  <ChevronLeft size={18} />
                </button>
              </div>
              )}

              {/* מימוש מיידי */}
              {plan?.allow_immediate !== false && (
              <div className="bg-[#0A192F] text-white rounded-[2rem] p-8 flex flex-col relative overflow-hidden"
                style={{ boxShadow: '0 24px 60px rgba(10,25,47,0.2)' }}>
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#D4B483]/10 blur-2xl pointer-events-none" />
                <div className="flex items-center gap-3 mb-5 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-[#D4B483]/20 flex items-center justify-center">
                    <Zap size={20} className="text-[#D4B483]" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#D4B483]/70">מסלול מיידי</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1 relative z-10">מימוש מיידי</h2>
                <p className="text-sm text-white/50 font-light mb-6 relative z-10">נהנים מהחופשה כבר עכשיו — בלי להמתין</p>

                <ul className="space-y-3 mb-8 flex-1 relative z-10">
                  {['תפיסת מסגרת אשראי בגובה כל התוכנית', 'הסכום יורד בתשלומים חודשיים רגילים', 'בוחרים נופש ותאריך מיד לאחר אישור', 'מקבלים שובר ישירות למייל'].map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle size={17} className="mt-0.5 flex-shrink-0 text-[#D4B483]" />
                      <span className="text-sm text-white/75 leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => goToPayment('immediate')}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-[#0A192F] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 relative z-10"
                  style={{ background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' }}
                >
                  <span>המשך במימוש מיידי</span>
                  <ChevronLeft size={18} />
                </button>
              </div>
              )}
            </div>
          )}

          {/* Footer note */}
          {plan && (
            <p className="text-center text-xs text-[#33332D]/40 mt-8">
              בשני המסלולים סך התוכנית זהה: ₪{total.toLocaleString()} ({plan.required_successful_payments} × ₪{plan.monthly_amount.toLocaleString()})
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
