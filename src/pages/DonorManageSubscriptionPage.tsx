import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, AlertTriangle, X, Info, Pause, Play, Trash2 } from 'lucide-react';
import { supabase, hotelLevelLabel } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { callNedarimKevaService } from '../lib/nedarimKevaService';
import DonorLayout from '../components/DonorLayout';

interface Subscription {
  id: string;
  status: string;
  subscription_source: string;
  successful_payments_count: number;
  started_at: string;
  next_payment_date: string | null;
  keva_id: string | null;
  plans: {
    id: string;
    name_he: string;
    monthly_amount: number;
    required_successful_payments: number;
    hotel_level: string;
  };
}

type DialogType = 'pause' | 'resume' | 'cancel' | null;

export default function DonorManageSubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select(`
          id, status, subscription_source, successful_payments_count, started_at, next_payment_date, keva_id,
          plans (id, name_he, monthly_amount, required_successful_payments, hotel_level)
        `)
        .eq('user_id', user!.id)
        .in('status', ['active', 'frozen'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setSubscription(data as unknown as Subscription);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (type: DialogType) => {
    if (!type || !subscription) return;
    setProcessing(true);
    setErrorMsg(null);

    const operationMap: Record<NonNullable<DialogType>, 'DisableKeva' | 'EnableKevaNew' | 'DeleteKeva'> = {
      pause: 'DisableKeva',
      resume: 'EnableKevaNew',
      cancel: 'DeleteKeva',
    };

    try {
      const result = await callNedarimKevaService({
        operation: operationMap[type],
        subscriptionId: subscription.id,
        notes: type === 'cancel' ? 'ביטול עצמי על ידי תורם' : undefined,
      });

      if (result.success) {
        if (type === 'cancel') {
          navigate('/plans');
        } else {
          await loadData();
          setDialog(null);
        }
      } else {
        setErrorMsg(result.error ?? 'שגיאה לא ידועה');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בביצוע הפעולה');
    } finally {
      setProcessing(false);
    }
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
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-[1.5rem] bg-[#0A192F]/5 flex items-center justify-center mb-6">
            <Heart className="text-[#33332D]/20" size={36} />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">{t.donor.manageSubscription.noSubscriptionTitle}</h2>
          <p className="text-[#33332D]/50 mb-8 font-light">{t.donor.manageSubscription.noSubscriptionDesc}</p>
          <button
            onClick={() => navigate('/plans')}
            className="px-8 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all"
          >
            {t.donor.manageSubscription.choosePlan}
          </button>
        </div>
      </DonorLayout>
    );
  }

  const isActive = subscription.status === 'active';
  const isFrozen = subscription.status === 'frozen';
  const isNedarim = subscription.subscription_source !== 'manual_bank';
  const hasKevaId = !!subscription.keva_id;
  const canSelfManage = isNedarim && hasKevaId;

  const statusLabel = isActive ? t.donor.manageSubscription.statusActive : isFrozen ? t.donor.manageSubscription.statusFrozen : subscription.status;
  const statusColor = isActive
    ? 'bg-[#626D58] text-white'
    : isFrozen
    ? 'bg-orange-500 text-white'
    : 'bg-gray-400 text-white';

  return (
    <DonorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A192F]">{t.donor.manageSubscription.pageTitle}</h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">{t.donor.manageSubscription.pageSubtitle}</p>
        </div>

        {/* Current plan card */}
        <div
          className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <div
            className="p-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0A192F 0%, #2D3E40 100%)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#D4B483]/10 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#D4B483]/60 mb-2">{t.donor.manageSubscription.currentPlan}</div>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{subscription.plans.name_he}</h2>
                  <div className="text-[#D4B483] font-bold mt-1">
                    ₪{subscription.plans.monthly_amount.toLocaleString()}
                    <span className="text-white/40 text-sm font-normal mr-1">{t.donor.manageSubscription.perMonth}</span>
                  </div>
                </div>
                <span className={`px-3 py-1.5 text-xs font-bold rounded-xl ${statusColor}`}>{statusLabel}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                {
                  label: t.donor.manageSubscription.paymentsCompleted,
                  value: `${subscription.successful_payments_count} / ${subscription.plans.required_successful_payments}`,
                },
                { label: t.donor.manageSubscription.eligibilityLevel, value: hotelLevelLabel(subscription.plans.hotel_level) },
                {
                  label: t.donor.manageSubscription.startDate,
                  value: new Date(subscription.started_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US'),
                },
                {
                  label: t.donor.manageSubscription.nextCharge,
                  value: subscription.next_payment_date
                    ? new Date(subscription.next_payment_date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/50">
                  <div className="text-xs text-[#33332D]/40 mb-1">{label}</div>
                  <div className="font-bold text-[#0A192F] text-sm">{value}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              {canSelfManage && isActive && (
                <button
                  onClick={() => setDialog('pause')}
                  className="w-full py-3.5 bg-blue-50 text-blue-700 font-semibold rounded-xl hover:bg-blue-100 transition-colors border-2 border-blue-100 flex items-center justify-center gap-2"
                >
                  <Pause size={16} />
                  {t.donor.manageSubscription.suspendBtn}
                </button>
              )}
              {canSelfManage && isFrozen && (
                <button
                  onClick={() => setDialog('resume')}
                  className="w-full py-3.5 bg-green-50 text-green-700 font-semibold rounded-xl hover:bg-green-100 transition-colors border-2 border-green-100 flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  {t.donor.manageSubscription.resumeBtn}
                </button>
              )}
              {canSelfManage && (
                <button
                  onClick={() => setDialog('cancel')}
                  className="w-full py-3.5 bg-red-50 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition-colors border-2 border-red-100 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  {t.donor.manageSubscription.cancelBtn}
                </button>
              )}
              {!canSelfManage && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-800 text-center">
                  {t.donor.manageSubscription.contactSupport}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info — change plan */}
        <div
          className="flex items-start gap-4 p-5 rounded-2xl border border-[#0A192F]/10"
          style={{ backgroundColor: 'rgba(10,25,47,0.03)' }}
        >
          <Info className="text-[#0A192F]/40 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-[#33332D]/60">
            <p className="font-semibold text-[#33332D]/80 mb-1">{t.donor.manageSubscription.changePlanTitle}</p>
            <p className="font-light leading-relaxed">
              {t.donor.manageSubscription.changePlanDesc}
            </p>
          </div>
        </div>

        {/* Warning */}
        <div
          className="flex items-start gap-4 p-5 rounded-2xl border border-[#D4B483]/20"
          style={{ backgroundColor: 'rgba(212,180,131,0.05)' }}
        >
          <AlertTriangle className="text-[#B08D57] flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-[#33332D]/60">
            <p className="font-semibold text-[#33332D]/80 mb-2">{t.donor.manageSubscription.importantTitle}</p>
            <ul className="space-y-1 font-light">
              <li>{t.donor.manageSubscription.warningBullet1}</li>
              <li>{t.donor.manageSubscription.warningBullet2}</li>
              <li>{t.donor.manageSubscription.warningBullet3}</li>
              <li>{t.donor.manageSubscription.warningBullet4}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {dialog && (
        <div className="fixed inset-0 bg-[#0A192F]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-[2rem] max-w-md w-full p-8 border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 24px 60px rgba(10,25,47,0.2)' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#0A192F]">
                {dialog === 'pause' && t.donor.manageSubscription.dialogSuspendTitle}
                {dialog === 'resume' && t.donor.manageSubscription.dialogResumeTitle}
                {dialog === 'cancel' && t.donor.manageSubscription.dialogCancelTitle}
              </h3>
              <button
                onClick={() => { setDialog(null); setErrorMsg(null); }}
                className="p-2 text-[#33332D]/40 hover:text-[#33332D] transition-colors rounded-xl hover:bg-[#F7F5F0]"
              >
                <X size={20} />
              </button>
            </div>

            <div
              className={`p-5 rounded-2xl border mb-6 ${
                dialog === 'cancel'
                  ? 'bg-red-50 border-red-200'
                  : dialog === 'pause'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <p
                className={`font-bold mb-2 ${
                  dialog === 'cancel' ? 'text-red-800' : dialog === 'pause' ? 'text-blue-800' : 'text-green-800'
                }`}
              >
                {dialog === 'pause' && t.donor.manageSubscription.dialogPauseQuestion}
                {dialog === 'resume' && t.donor.manageSubscription.dialogResumeQuestion}
                {dialog === 'cancel' && t.donor.manageSubscription.dialogCancelQuestion}
              </p>
              <p
                className={`text-sm font-light leading-relaxed ${
                  dialog === 'cancel' ? 'text-red-700' : dialog === 'pause' ? 'text-blue-700' : 'text-green-700'
                }`}
              >
                {dialog === 'pause' && t.donor.manageSubscription.dialogPauseDesc}
                {dialog === 'resume' && t.donor.manageSubscription.dialogResumeDesc}
                {dialog === 'cancel' && t.donor.manageSubscription.dialogCancelDesc}
              </p>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 mb-4 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleAction(dialog)}
                disabled={processing}
                className={`flex-1 py-3.5 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  dialog === 'cancel'
                    ? 'bg-red-600 hover:bg-red-700'
                    : dialog === 'pause'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {processing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {dialog === 'pause' && <Pause size={16} />}
                    {dialog === 'resume' && <Play size={16} />}
                    {dialog === 'cancel' && <Trash2 size={16} />}
                    {dialog === 'pause' && t.donor.manageSubscription.confirmSuspend}
                    {dialog === 'resume' && t.donor.manageSubscription.confirmResume}
                    {dialog === 'cancel' && t.donor.manageSubscription.confirmCancel}
                  </>
                )}
              </button>
              <button
                onClick={() => { setDialog(null); setErrorMsg(null); }}
                disabled={processing}
                className="flex-1 py-3.5 bg-[#F7F5F0] text-[#33332D] font-semibold rounded-xl hover:bg-[#E5E1D8] transition-colors"
              >
                {t.donor.manageSubscription.back}
              </button>
            </div>
          </div>
        </div>
      )}
    </DonorLayout>
  );
}
