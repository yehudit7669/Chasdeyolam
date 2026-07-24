import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Repeat, CheckCircle, AlertTriangle, Clock, XCircle, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { createNotification } from '../hooks/useNotifications';
import DonorLayout from '../components/DonorLayout';

interface Plan {
  id: string;
  name_he: string;
  name_en: string;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
}

interface Subscription {
  id: string;
  plan_id: string;
  successful_payments_count: number;
  credited_payments: number;
  plans: Plan;
}

interface PlanChangeRequest {
  id: string;
  new_plan_id: string;
  new_plan_name_he: string;
  months_to_pay: number;
  status: string;
}

export default function SwitchPlanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const sp = t.donor.switchPlan;

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [otherPlans, setOtherPlans] = useState<Plan[]>([]);
  const [activeRequest, setActiveRequest] = useState<PlanChangeRequest | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, plan_id, successful_payments_count, credited_payments, plans (id, name_he, name_en, monthly_amount, required_successful_payments, hotel_level)')
      .eq('user_id', user!.id)
      .in('status', ['active', 'frozen'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) { setLoading(false); return; }
    setSubscription(sub as unknown as Subscription);

    const { data: req } = await supabase
      .from('plan_change_requests')
      .select('id, new_plan_id, new_plan_name_he, months_to_pay, status')
      .eq('user_id', user!.id)
      .eq('old_subscription_id', sub.id)
      .in('status', ['pending_review', 'approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (req) setActiveRequest(req as PlanChangeRequest);

    const { data: plans } = await supabase
      .from('plans')
      .select('id, name_he, name_en, monthly_amount, required_successful_payments, hotel_level')
      .eq('active', true)
      .neq('id', (sub as unknown as Subscription).plan_id)
      .order('monthly_amount');
    setOtherPlans(plans ?? []);
    setLoading(false);
  };

  const calc = useMemo(() => {
    if (!subscription || !selectedPlan) return null;
    const oldPlan = subscription.plans;
    const effectiveMonthsPaid = (subscription.successful_payments_count ?? 0) + (subscription.credited_payments ?? 0);
    const paidAmount = effectiveMonthsPaid * oldPlan.monthly_amount;
    const creditedMonths = Math.max(Math.floor(paidAmount / selectedPlan.monthly_amount), 0);
    const creditedRemainder = paidAmount - creditedMonths * selectedPlan.monthly_amount;
    const monthsToPay = Math.max(selectedPlan.required_successful_payments - creditedMonths, 0);
    return { paidAmount, creditedMonths, creditedRemainder, monthsToPay };
  }, [subscription, selectedPlan]);

  const planName = (p: Plan) => (language === 'he' ? p.name_he : (p.name_en || p.name_he));

  const submitRequest = async () => {
    if (!subscription || !selectedPlan || !calc || !user) return;
    setSubmitting(true);
    try {
      const { data: newReq, error } = await supabase.from('plan_change_requests').insert({
        user_id: user.id,
        old_subscription_id: subscription.id,
        old_plan_id: subscription.plan_id,
        new_plan_id: selectedPlan.id,
        old_plan_name_he: subscription.plans.name_he,
        new_plan_name_he: selectedPlan.name_he,
        paid_amount_snapshot: calc.paidAmount,
        credited_months: calc.creditedMonths,
        credited_remainder: calc.creditedRemainder,
        months_to_pay: calc.monthsToPay,
      }).select('id').single();

      if (error) throw error;

      await createNotification({
        for_admin: true,
        type: 'plan_change_request',
        title: 'בקשת החלפת תוכנית חדשה',
        body: `תורם מבקש לעבור מ"${subscription.plans.name_he}" ל"${selectedPlan.name_he}". זיכוי: ${calc.creditedMonths} חודשים.`,
        link: '/admin/plan-change-requests',
        email: { toAdmin: true },
      });

      setSubmitted(true);
      void newReq;
    } catch (err) {
      console.error('Error submitting plan change request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const goToPayment = () => {
    if (!activeRequest) return;
    navigate('/payment', {
      state: {
        planId: activeRequest.new_plan_id,
        redemptionType: 'on_completion',
        overrideMonths: activeRequest.months_to_pay,
        planChangeRequestId: activeRequest.id,
      },
    });
  };

  if (loading) {
    return (
      <DonorLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin" />
        </div>
      </DonorLayout>
    );
  }

  if (!subscription) {
    return (
      <DonorLayout>
        <div className="text-center py-24">
          <p className="text-[#33332D]/50">{t.donor.manageSubscription.noSubscriptionDesc}</p>
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/donor/manage-subscription')}
          className="flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] transition-colors"
        >
          <ArrowRight size={16} />
          <span>{sp.backToManage}</span>
        </button>

        <div>
          <h1 className="text-2xl font-black text-[#0A192F] flex items-center gap-2">
            <Repeat size={22} className="text-[#626D58]" />
            {sp.pageTitle}
          </h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">{sp.pageSubtitle}</p>
        </div>

        {/* Existing request banners */}
        {activeRequest && activeRequest.status === 'pending_review' && (
          <div className="flex items-start gap-4 p-5 rounded-2xl border border-amber-200 bg-amber-50">
            <Clock className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-amber-800 mb-1">{sp.pendingBannerTitle}</p>
              <p className="text-sm text-amber-700 font-light">{sp.pendingBannerDesc}</p>
            </div>
          </div>
        )}

        {activeRequest && activeRequest.status === 'approved' && (
          <div className="p-5 rounded-2xl border border-green-200 bg-green-50">
            <div className="flex items-start gap-4 mb-4">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-green-800 mb-1">{sp.approvedBannerTitle}</p>
                <p className="text-sm text-green-700 font-light">{sp.approvedBannerDesc}</p>
              </div>
            </div>
            <button
              onClick={goToPayment}
              className="w-full py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all"
            >
              {sp.approvedBannerCta}
            </button>
          </div>
        )}

        {activeRequest && activeRequest.status === 'rejected' && (
          <div className="flex items-start gap-4 p-5 rounded-2xl border border-red-200 bg-red-50">
            <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-red-800 mb-1">{sp.rejectedBannerTitle}</p>
              <p className="text-sm text-red-700 font-light">{sp.rejectedBannerDesc}</p>
            </div>
          </div>
        )}

        {/* Plan picker — only if no pending/approved request blocking */}
        {(!activeRequest || activeRequest.status === 'rejected') && !submitted && (
          <>
            <div className="p-5 rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/60">
              <div className="text-xs text-[#33332D]/40 mb-1">{sp.currentPlanLabel}</div>
              <div className="font-bold text-[#0A192F]">{planName(subscription.plans)}</div>
              <div className="text-sm text-[#626D58] font-semibold">₪{subscription.plans.monthly_amount.toLocaleString()} {t.donor.manageSubscription.perMonth}</div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-[#33332D]/70 mb-3">{sp.chooseNewPlan}</h2>
              {otherPlans.length === 0 ? (
                <p className="text-sm text-[#33332D]/40">{sp.noOtherPlans}</p>
              ) : (
                <div className="space-y-2">
                  {otherPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`w-full text-right p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                        selectedPlan?.id === plan.id
                          ? 'border-[#0A192F] bg-[#0A192F]/5'
                          : 'border-[#E5E1D8] bg-white hover:border-[#D4B483]/50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-[#0A192F]">{planName(plan)}</div>
                        <div className="text-xs text-[#33332D]/50">{plan.required_successful_payments} {t.planSelection.paymentsCount}</div>
                      </div>
                      <div className="text-[#626D58] font-bold">₪{plan.monthly_amount.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPlan && calc && (
              <div className="p-6 rounded-[2rem] bg-white border border-[#E5E1D8]/60" style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.08)' }}>
                <h3 className="font-bold text-[#0A192F] mb-4">{sp.creditTitle}</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#33332D]/50">{sp.paidSoFarLabel}</span>
                    <span className="font-semibold text-[#0A192F]">₪{calc.paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#33332D]/50">{sp.creditMonthsLabel}</span>
                    <span className="font-semibold text-green-700">{calc.creditedMonths}</span>
                  </div>
                  {calc.creditedRemainder > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#33332D]/50">{sp.creditRemainderLabel}</span>
                      <span className="font-semibold text-[#33332D]/70">₪{calc.creditedRemainder.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-[#E5E1D8]/60">
                    <span className="text-[#33332D]/50">{sp.monthsToPayLabel}</span>
                    <span className="font-bold text-[#0A192F] text-lg">{calc.monthsToPay}</span>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{sp.processNote1}</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{sp.processNote2}</span>
                  </div>
                </div>

                <button
                  onClick={submitRequest}
                  disabled={submitting}
                  className="w-full mt-5 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
                  {submitting ? sp.submitting : sp.submitRequest}
                </button>
              </div>
            )}
          </>
        )}

        {submitted && (
          <div className="p-8 rounded-[2rem] bg-white border border-[#E5E1D8]/60 text-center" style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.08)' }}>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-black text-[#0A192F] mb-2">{sp.requestSentTitle}</h2>
            <p className="text-sm text-[#33332D]/60 mb-6">{sp.requestSentDesc}</p>
            <button
              onClick={() => navigate('/donor/manage-subscription')}
              className="w-full py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all"
            >
              {sp.backToManage}
            </button>
          </div>
        )}
      </div>
    </DonorLayout>
  );
}
