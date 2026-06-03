import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  Hotel,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { supabase, hotelLevelLabel } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import DonorLayout from '../components/DonorLayout';

interface Subscription {
  id: string;
  status: string;
  successful_payments_count: number;
  is_eligible: boolean;
  started_at: string;
  next_payment_date: string | null;
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
  const { user, profile } = useAuth();
  const { t, language } = useTranslation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    const loadData = async () => {
      try {
        const { data: subData, error: subError } = await supabase
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
          .eq('user_id', user.id)
          .in('status', ['active', 'frozen'])
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('[Dashboard] subscription query result:', { subData, subError, userId: user.id });

        if (subData) {
          setSubscription(subData as any);

          const { data: paymentsData } = await supabase
            .from('payments')
            .select('*')
            .eq('subscription_id', subData.id)
            .order('created_at', { ascending: false });

          if (paymentsData) setPayments(paymentsData);
        }
      } catch (err) {
        console.error('[Dashboard] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <DonorLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#33332D]/50 text-sm">{ t.dashboard.loading}</p>
          </div>
        </div>
      </DonorLayout>
    );
  }

  if (!subscription) {
    return (
      <DonorLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-[1.5rem] bg-[#0A192F]/5 flex items-center justify-center mb-6">
            <Heart className="text-[#33332D]/20" size={36} />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">{t.dashboard.noSubscriptionTitle}</h2>
          <p className="text-[#33332D]/50 mb-8 max-w-xs font-light">{t.dashboard.noSubscriptionDesc}</p>
          <p className="text-[10px] text-[#33332D]/20 font-mono mb-4">uid:{user?.id}</p>
          <button
            onClick={() => navigate('/plans')}
            className="px-8 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md"
          >
            {t.dashboard.choosePlan}
          </button>
        </div>
      </DonorLayout>
    );
  }

  const progress = Math.min(
    (subscription.successful_payments_count / subscription.plans.required_successful_payments) * 100,
    100
  );
  const remainingPayments = subscription.plans.required_successful_payments - subscription.successful_payments_count;
  const totalPaid = subscription.successful_payments_count * subscription.plans.monthly_amount;

  const isFrozen = subscription.status === 'frozen';

  return (
    <DonorLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-black text-[#0A192F]">
            שלום, {profile?.full_name || 'ידיד'}
          </h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">{t.dashboard.welcomeSubtitle}</p>
        </div>

        {/* Frozen subscription banner */}
        {isFrozen && (
          <div
            className="flex items-start gap-4 p-5 rounded-2xl border-2 border-orange-300"
            style={{ backgroundColor: 'rgba(251, 146, 60, 0.08)' }}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-orange-600" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-orange-800 text-base mb-1">{t.dashboard.frozenTitle}</p>
              <p className="text-sm text-orange-700/80 font-light leading-relaxed">
                {t.dashboard.frozenDesc}
              </p>
              <button
                onClick={() => navigate('/donor/manage-subscription')}
                className="flex items-center gap-1.5 mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800 transition-colors"
              >
                <Settings size={14} />
                {t.dashboard.manageSubscription}
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Featured dark card */}
          <div
            className="relative rounded-[2rem] p-7 overflow-hidden"
            style={{
              background: isFrozen
                ? 'linear-gradient(135deg, #92400e 0%, #b45309 100%)'
                : 'linear-gradient(135deg, #0A192F 0%, #2D3E40 100%)',
              boxShadow: '0 20px 60px rgba(10,25,47,0.15)',
            }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#D4B483]/10 blur-2xl pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#D4B483]/60 mb-4">{t.dashboard.myPlan}</div>
            <div className="text-xl font-bold text-white mb-1">{subscription.plans.name_he}</div>
            {isFrozen && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-200/20 border border-orange-300/30 mt-2 mb-2">
                <AlertTriangle size={12} className="text-orange-300" />
                <span className="text-xs font-bold text-orange-200">{t.dashboard.suspended}</span>
              </div>
            )}
            <div className="text-[#D4B483] font-black text-2xl mt-1">
              ₪{subscription.plans.monthly_amount.toLocaleString()}
              <span className="text-sm font-normal text-white/40 mr-1">{t.dashboard.perMonth}</span>
            </div>
          </div>

          {/* Payments card */}
          <div
            className="rounded-[2rem] p-7 bg-white border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center">
                <CheckCircle className="text-[#626D58]" size={20} />
              </div>
              <span className="text-sm font-semibold text-[#33332D]/60">{t.dashboard.paymentsLabel}</span>
            </div>
            <div className="text-4xl font-black text-[#0A192F] mb-1">
              {subscription.successful_payments_count}
            </div>
            <div className="text-xs text-[#33332D]/40">
              {t.dashboard.outOf} {subscription.plans.required_successful_payments} {t.dashboard.required}
            </div>
          </div>

          {/* Total card */}
          <div
            className="rounded-[2rem] p-7 bg-white border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#D4B483]/10 flex items-center justify-center">
                <TrendingUp className="text-[#B08D57]" size={20} />
              </div>
              <span className="text-sm font-semibold text-[#33332D]/60">{t.dashboard.totalDonations}</span>
            </div>
            <div className="text-4xl font-black text-[#0A192F] mb-1">
              ₪{totalPaid.toLocaleString()}
            </div>
            <div className="text-xs text-[#33332D]/40">{t.dashboard.cumulativeImpact}</div>
          </div>
        </div>

        {/* Progress */}
        <div
          className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <h3 className="text-lg font-black text-[#0A192F] mb-6">{t.dashboard.progressTitle}</h3>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-[#33332D]/50 font-medium">
                {subscription.successful_payments_count} {t.dashboard.outOf} {subscription.plans.required_successful_payments} {t.dashboard.payments}
              </span>
              <span className="font-bold text-[#0A192F]">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-3 bg-[#F7F5F0] rounded-full overflow-hidden border border-[#E5E1D8]/50">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #626D58 0%, #D4B483 100%)',
                }}
              />
            </div>
          </div>

          {subscription.is_eligible ? (
            <div
              className="flex items-start gap-4 p-5 rounded-2xl border border-[#626D58]/30"
              style={{ backgroundColor: 'rgba(98,109,88,0.06)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#626D58]/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="text-[#626D58]" size={20} />
              </div>
              <div>
                <p className="font-bold text-[#0A192F] mb-1">{t.dashboard.eligibleTitle}</p>
                <p className="text-sm text-[#33332D]/50 font-light">
                  {t.dashboard.eligibleDesc} {hotelLevelLabel(subscription.plans.hotel_level)}
                </p>
                <button
                  onClick={() => navigate('/donor/hotels')}
                  className="flex items-center gap-2 text-sm font-semibold text-[#626D58] hover:text-[#626D58]/80 transition-colors mt-3"
                >
                  <Hotel size={16} />
                  <span>{t.dashboard.viewHotels}</span>
                </button>
              </div>
            </div>
          ) : subscription.successful_payments_count === 0 ? (
            <div
              className="flex items-start gap-4 p-5 rounded-2xl border border-[#0A192F]/10"
              style={{ backgroundColor: 'rgba(10,25,47,0.03)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0A192F]/8 flex items-center justify-center flex-shrink-0">
                <Calendar className="text-[#0A192F]/60" size={20} />
              </div>
              <div>
                <p className="font-bold text-[#0A192F] mb-1">{t.dashboard.pendingFirstPaymentTitle}</p>
                <p className="text-sm text-[#33332D]/50 font-light">
                  {t.dashboard.pendingFirstPaymentDesc}
                </p>
                {subscription.next_payment_date && (
                  <p className="text-sm font-semibold text-[#0A192F]/70 mt-2">
                    {t.dashboard.expectedChargeDate}{' '}
                    {new Date(subscription.next_payment_date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex items-start gap-4 p-5 rounded-2xl border border-[#D4B483]/30"
              style={{ backgroundColor: 'rgba(212,180,131,0.06)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#D4B483]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="text-[#B08D57]" size={20} />
              </div>
              <div>
                <p className="font-bold text-[#0A192F] mb-1">
                  {t.dashboard.remainingPaymentsTitle.replace('{n}', String(remainingPayments))}
                </p>
                <p className="text-sm text-[#33332D]/50 font-light">
                  {t.dashboard.remainingPaymentsDesc}
                </p>
                {subscription.next_payment_date && (
                  <p className="text-sm font-semibold text-[#0A192F]/70 mt-2">
                    {t.dashboard.nextPayment}{' '}
                    {new Date(subscription.next_payment_date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payment History */}
        <div
          className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <h3 className="text-lg font-black text-[#0A192F] mb-6">{t.dashboard.paymentHistory}</h3>

          {payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-[#F7F5F0] flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-[#33332D]/20" size={24} />
              </div>
              <p className="text-[#33332D]/40 text-sm">{t.dashboard.noPaymentsYet}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/50 hover:border-[#D4B483]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      payment.status === 'succeeded' ? 'bg-[#626D58]/10' : 'bg-red-50'
                    }`}>
                      {payment.status === 'succeeded' ? (
                        <CheckCircle className="text-[#626D58]" size={16} />
                      ) : (
                        <XCircle className="text-red-500" size={16} />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-[#0A192F] text-sm">₪{payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-[#33332D]/40">
                        {new Date(payment.paid_at || payment.created_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                      payment.status === 'succeeded'
                        ? 'bg-[#626D58]/10 text-[#626D58]'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {payment.status === 'succeeded' ? t.dashboard.paymentSucceeded : t.dashboard.paymentFailed}
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
