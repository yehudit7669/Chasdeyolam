import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/stripe';
import { AlertCircle, CheckCircle, Clock, Hotel, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  successful_payments_count: number;
  is_eligible: boolean;
  plans: {
    name_he: string;
    name_en: string;
    monthly_amount: number;
    required_successful_payments: number;
  };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  attempt_number: number;
  paid_at: string | null;
  created_at: string;
}

interface Booking {
  id: string;
  booking_date: string;
  voucher_code: string;
  status: string;
  hotels: {
    name_he: string;
    name_en: string;
    city_he: string;
    city_en: string;
  };
}

export const Dashboard = () => {
  const { user, profile } = useAuth();
  const { t, language } = useTranslation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plans (
            name_he,
            name_en,
            monthly_amount,
            required_successful_payments
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (subData) {
        setSubscription(subData as unknown as Subscription);

        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .eq('subscription_id', subData.id)
          .order('created_at', { ascending: false });

        if (paymentsData) {
          setPayments(paymentsData);
        }

        const { data: bookingData } = await supabase
          .from('bookings')
          .select(`
            *,
            hotels (
              name_he,
              name_en,
              city_he,
              city_en
            )
          `)
          .eq('subscription_id', subData.id)
          .eq('status', 'confirmed')
          .maybeSingle();

        if (bookingData) {
          setBooking(bookingData as unknown as Booking);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
        </div>
      </Layout>
    );
  }

  if (!subscription) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            {t.dashboard.welcome}, {profile?.full_name}!
          </h1>
          <p className="text-gray-600 mb-6">אין לך מנוי פעיל</p>
          <Link
            to="/plans"
            className="inline-block bg-[#0B3C5D] text-white px-6 py-3 rounded-lg font-medium hover:bg-opacity-90"
          >
            בחר תוכנית
          </Link>
        </div>
      </Layout>
    );
  }

  const plan = subscription.plans;
  const progress = (subscription.successful_payments_count / plan.required_successful_payments) * 100;
  const remaining = plan.required_successful_payments - subscription.successful_payments_count;

  const getStatusBadge = () => {
    if (booking) {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">{t.status.redeemed}</span>;
    }
    if (subscription.is_eligible) {
      return <span className="px-3 py-1 bg-[#C6A75E] text-white rounded-full text-sm font-medium">{t.status.eligible}</span>;
    }
    if (subscription.status === 'frozen') {
      return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">{t.status.frozen}</span>;
    }
    if (subscription.status === 'canceled') {
      return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">{t.status.canceled}</span>;
    }
    return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{t.status.active}</span>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-[#0B3C5D]">
              {t.dashboard.welcome}, {profile?.full_name}
            </h1>
            {getStatusBadge()}
          </div>

          {subscription.status === 'frozen' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-red-800 font-medium">{t.dashboard.subscriptionFrozen}</p>
                <Link
                  to="/update-payment"
                  className="text-red-600 underline hover:text-red-800 text-sm mt-1 inline-block"
                >
                  {t.dashboard.updatePayment}
                </Link>
              </div>
            </div>
          )}

          {subscription.status === 'canceled' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-gray-800">{t.dashboard.subscriptionCanceled}</p>
            </div>
          )}

          {booking && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={20} />
              <div className="flex-1">
                <p className="text-green-800 font-medium mb-2">{t.dashboard.bookingConfirmed}</p>
                <Link
                  to={`/booking/${booking.id}`}
                  className="text-green-600 underline hover:text-green-800 text-sm"
                >
                  {t.dashboard.viewBooking}
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-[#0B3C5D] mb-4">{t.dashboard.mySubscription}</h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">תוכנית:</span>
              <span className="font-medium">{language === 'he' ? plan.name_he : plan.name_en}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t.dashboard.monthlyAmount}:</span>
              <span className="font-medium text-[#0B3C5D]">{formatCurrency(plan.monthly_amount)}</span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">{t.dashboard.progress}:</span>
                <span className="font-medium">{subscription.successful_payments_count} / {plan.required_successful_payments}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-[#C6A75E] h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {remaining > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {remaining} {t.dashboard.paymentsRemaining}
                </p>
              )}
            </div>

            {subscription.is_eligible && !booking && subscription.status === 'active' && (
              <Link
                to="/booking"
                className="w-full bg-[#C6A75E] text-[#0B3C5D] py-3 rounded-lg font-bold hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2 mt-4"
              >
                <Hotel size={20} />
                {t.dashboard.chooseHotel}
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-[#0B3C5D] mb-4">{t.dashboard.paymentHistory}</h2>

          {payments.length === 0 ? (
            <p className="text-gray-600 text-center py-4">אין תשלומים</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">{t.dashboard.date}</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">{t.dashboard.amount}</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">{t.dashboard.statusLabel}</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">{t.dashboard.attempt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {format(new Date(payment.paid_at || payment.created_at), 'dd/MM/yyyy', { locale: he })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3">
                        {payment.status === 'succeeded' && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{t.status.succeeded}</span>
                        )}
                        {payment.status === 'failed' && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">{t.status.failed}</span>
                        )}
                        {payment.status === 'pending' && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">{t.status.pending}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{payment.attempt_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
