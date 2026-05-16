import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CreditCard, Shield } from 'lucide-react';
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
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError('');

    try {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingSub) {
        setError('כבר קיים מנוי פעיל עבור חשבון זה');
        return;
      }

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user!.id,
          plan_id: plan!.id,
          status: 'active',
          successful_payments_count: 0,
          failed_payment_attempts: 0,
          is_eligible: false,
        })
        .select()
        .single();

      if (subError) throw subError;

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת מנוי');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'תוכנית לא נמצאה'}</p>
          <button
            onClick={() => navigate('/plans')}
            className="text-blue-600 hover:text-blue-700"
          >
            חזרה לבחירת תוכניות
          </button>
        </div>
      </div>
    );
  }

  const totalAmount = plan.monthly_amount * plan.required_successful_payments;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/plans')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowRight size={20} />
          <span>חזרה לבחירת תוכניות</span>
        </button>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-blue-600 text-white p-6">
            <h1 className="text-2xl font-bold mb-2">סיכום והרשמה למנוי</h1>
            <p className="text-blue-100">השלם את הפרטים להשלמת ההרשמה</p>
          </div>

          <div className="p-6">
            <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">פרטי התוכנית</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-700">תוכנית:</span>
                  <span className="font-semibold text-gray-900">{plan.name_he}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">תשלום חודשי:</span>
                  <span className="font-semibold text-gray-900">₪{plan.monthly_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">מספר תשלומים:</span>
                  <span className="font-semibold text-gray-900">{plan.required_successful_payments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">רמת זכאות למלונות:</span>
                  <span className="font-semibold text-gray-900">{plan.hotel_level}</span>
                </div>
                <div className="pt-3 border-t border-gray-300 flex justify-between">
                  <span className="font-bold text-gray-900">סה"כ לתשלום:</span>
                  <span className="font-bold text-xl text-blue-600">₪{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handlePayment} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="text-blue-600" size={24} />
                  <h3 className="font-semibold text-blue-900">פרטי תשלום</h3>
                </div>
                <p className="text-sm text-blue-800 mb-4">
                  אינטגרציה עם Stripe תתווסף בהמשך. כרגע המערכת תיצור מנוי פעיל עבורך.
                </p>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Shield size={16} />
                  <span>התשלומים שלך מאובטחים ומוצפנים</span>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">תנאי השירות</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• התשלומים יחויבו מדי חודש באופן אוטומטי</li>
                  <li>• זכאות למלון תינתן רק לאחר השלמת כל התשלומים הנדרשים</li>
                  <li>• ניתן לבטל את המנוי בכל עת דרך הגדרות החשבון</li>
                  <li>• החזרים יינתנו בהתאם למדיניות ההחזרים</li>
                </ul>
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  className="mt-1"
                />
                <label htmlFor="terms" className="text-sm text-amber-900">
                  אני מאשר/ת שקראתי והבנתי את תנאי השירות ומסכים/ה להם
                </label>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'מעבד...' : 'אישור והשלמת הרשמה'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
