import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowRight, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Subscription {
  id: string;
  status: string;
  successful_payments_count: number;
  started_at: string;
  plans: {
    id: string;
    name_he: string;
    monthly_amount: number;
    required_successful_payments: number;
    hotel_level: string;
  };
}

interface Plan {
  id: string;
  name_he: string;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
}

export default function DonorManageSubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [subRes, plansRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select(`
            *,
            plans (
              id,
              name_he,
              monthly_amount,
              required_successful_payments,
              hotel_level
            )
          `)
          .eq('user_id', user!.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase.from('plans').select('*').eq('active', true).order('monthly_amount'),
      ]);

      if (subRes.data) {
        setSubscription(subRes.data as any);
      }

      if (plansRes.data) {
        setAvailablePlans(plansRes.data);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('id', subscription!.id);

      if (error) throw error;

      alert('המנוי בוטל בהצלחה');
      navigate('/plans');
    } catch (err: any) {
      alert('שגיאה בביטול מנוי: ' + err.message);
    } finally {
      setProcessing(false);
      setShowCancelDialog(false);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedPlan) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ plan_id: selectedPlan.id })
        .eq('id', subscription!.id);

      if (error) throw error;

      alert('התוכנית שונתה בהצלחה');
      loadData();
    } catch (err: any) {
      alert('שגיאה בשינוי תוכנית: ' + err.message);
    } finally {
      setProcessing(false);
      setShowChangePlanDialog(false);
      setSelectedPlan(null);
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

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Heart className="mx-auto mb-4 text-gray-400" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">אין לך מנוי פעיל</h2>
          <p className="text-gray-600 mb-6">הצטרף עכשיו כדי לנהל מנוי</p>
          <button
            onClick={() => navigate('/plans')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            בחר תוכנית תרומה
          </button>
        </div>
      </div>
    );
  }

  const otherPlans = availablePlans.filter(p => p.id !== subscription.plans.id);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowRight size={20} />
              <span>חזרה לדשבורד</span>
            </button>
            <div className="flex items-center gap-2">
              <Heart className="text-blue-600" size={28} />
              <h1 className="text-xl font-bold text-gray-900">ניהול תרומה</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">התוכנית הנוכחית שלך</h2>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-blue-900">{subscription.plans.name_he}</h3>
                <p className="text-blue-700 mt-1">
                  ₪{subscription.plans.monthly_amount.toLocaleString()} לחודש
                </p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                פעיל
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">תשלומים שבוצעו:</span>
                <span className="font-semibold text-blue-900 mr-2">
                  {subscription.successful_payments_count} / {subscription.plans.required_successful_payments}
                </span>
              </div>
              <div>
                <span className="text-blue-700">רמת זכאות:</span>
                <span className="font-semibold text-blue-900 mr-2">{subscription.plans.hotel_level}</span>
              </div>
              <div>
                <span className="text-blue-700">תאריך התחלה:</span>
                <span className="font-semibold text-blue-900 mr-2">
                  {new Date(subscription.started_at).toLocaleDateString('he-IL')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setShowChangePlanDialog(true)}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              שנה תוכנית תרומה
            </button>

            <button
              onClick={() => setShowCancelDialog(true)}
              className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-colors border-2 border-red-200"
            >
              בטל מנוי
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">חשוב לדעת:</p>
            <ul className="list-disc mr-5 space-y-1">
              <li>שינוי תוכנית יבוטל את ההתקדמות הנוכחית שלך</li>
              <li>ביטול מנוי יבטל את כל הזכאויות למלונות</li>
              <li>תשלומים שכבר בוצעו לא יוחזרו</li>
            </ul>
          </div>
        </div>
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">ביטול מנוי</h3>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-semibold mb-2">האם אתה בטוח?</p>
                <p className="text-sm text-red-700">
                  ביטול המנוי יגרום לאובדן כל ההטבות והזכאויות למלונות. תשלומים שבוצעו לא יוחזרו.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelSubscription}
                disabled={processing}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'מבטל...' : 'כן, בטל מנוי'}
              </button>
              <button
                onClick={() => setShowCancelDialog(false)}
                disabled={processing}
                className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePlanDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">שינוי תוכנית תרומה</h3>
              <button
                onClick={() => {
                  setShowChangePlanDialog(false);
                  setSelectedPlan(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {otherPlans.length === 0 ? (
                <p className="text-gray-600 text-center py-8">אין תוכניות אחרות זמינות כרגע</p>
              ) : (
                otherPlans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900">{plan.name_he}</h4>
                        <p className="text-gray-600 mt-1">
                          ₪{plan.monthly_amount.toLocaleString()} לחודש
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {plan.required_successful_payments} תשלומים | רמה: {plan.hotel_level}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedPlan?.id === plan.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedPlan?.id === plan.id && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {otherPlans.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={handleChangePlan}
                  disabled={!selectedPlan || processing}
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'משנה...' : 'שנה תוכנית'}
                </button>
                <button
                  onClick={() => {
                    setShowChangePlanDialog(false);
                    setSelectedPlan(null);
                  }}
                  disabled={processing}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  ביטול
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
