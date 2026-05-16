import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import DonorLayout from '../components/DonorLayout';

interface Subscription {
  id: string;
  status: string;
  successful_payments_count: number;
  is_eligible: boolean;
  started_at: string;
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
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const { data: subData } = await supabase
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
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subData) {
        setSubscription(subData as any);

        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .eq('subscription_id', subData.id)
          .order('created_at', { ascending: false });

        if (paymentsData) {
          setPayments(paymentsData);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DonorLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">טוען נתונים...</p>
          </div>
        </div>
      </DonorLayout>
    );
  }

  if (!subscription) {
    return (
      <DonorLayout>
        <div className="text-center py-20">
          <Heart className="mx-auto mb-4 text-gray-400" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">עדיין אין לך מנוי פעיל</h2>
          <p className="text-gray-600 mb-6">הצטרף עכשיו ותתחיל לתרום</p>
          <button
            onClick={() => navigate('/plans')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            בחר תוכנית תרומה
          </button>
        </div>
      </DonorLayout>
    );
  }

  const progress = (subscription.successful_payments_count / subscription.plans.required_successful_payments) * 100;
  const remainingPayments = subscription.plans.required_successful_payments - subscription.successful_payments_count;
  const totalPaid = subscription.successful_payments_count * subscription.plans.monthly_amount;
  const totalRequired = subscription.plans.required_successful_payments * subscription.plans.monthly_amount;

  return (
    <DonorLayout>
      <div className="space-y-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <Heart size={32} />
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">תוכנית פעילה</span>
            </div>
            <h3 className="text-2xl font-bold mb-2">{subscription.plans.name_he}</h3>
            <p className="text-blue-100">₪{subscription.plans.monthly_amount.toLocaleString()} לחודש</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <span className="font-semibold text-gray-700">תשלומים שבוצעו</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {subscription.successful_payments_count}
            </div>
            <p className="text-sm text-gray-600">
              מתוך {subscription.plans.required_successful_payments} נדרשים
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-amber-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp className="text-amber-600" size={24} />
              </div>
              <span className="font-semibold text-gray-700">סה"כ תרומה</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              ₪{totalPaid.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">התקדמות לקראת זכאות</h3>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>התקדמות</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          {subscription.is_eligible ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <p className="font-semibold text-green-900">מזל טוב! אתה זכאי לשהייה</p>
                <p className="text-sm text-green-700">
                  ניתן להזמין מלון ברמה: {subscription.plans.hotel_level}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Calendar className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold text-blue-900">
                  נותרו {remainingPayments} תשלומים לזכאות
                </p>
                <p className="text-sm text-blue-700">
                  המשך לתרום באופן קבוע כדי לפתוח את הזכאות למלונות
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">היסטוריית תשלומים</h3>
          {payments.length === 0 ? (
            <p className="text-gray-600 text-center py-8">עדיין אין תשלומים</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    {payment.status === 'succeeded' ? (
                      <CheckCircle className="text-green-600" size={20} />
                    ) : (
                      <XCircle className="text-red-600" size={20} />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">₪{payment.amount.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(payment.paid_at || payment.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${
                      payment.status === 'succeeded'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {payment.status === 'succeeded' ? 'בוצע' : 'נכשל'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DonorLayout>
  );
}
