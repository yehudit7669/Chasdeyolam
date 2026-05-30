import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Eye, Pause, Play, CreditCard as Edit2, XCircle } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'frozen' | 'canceled' | 'completed';
  successful_payments_count: number;
  is_eligible: boolean;
  started_at: string;
  next_payment_date: string | null;
  frozen_at: string | null;
  canceled_at: string | null;
  completed_at: string | null;
  profiles: {
    full_name: string;
    email: string;
  };
  plans: {
    name_he: string;
    name_en: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export const AdminSubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    subscriptionId: string;
    action: 'freeze' | 'unfreeze';
  }>({
    isOpen: false,
    subscriptionId: '',
    action: 'freeze',
  });
  const [cancelDialog, setCancelDialog] = useState<{ isOpen: boolean; subId: string; reason: string }>({
    isOpen: false, subId: '', reason: '',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit, profile } = useAuth();

  useEffect(() => {
    loadSubscriptions();
    loadPlans();
  }, []);

  const loadSubscriptions = async () => {
    try {
      let query = supabase
        .from('subscriptions')
        .select(`
          *,
          profiles!subscriptions_user_id_fkey(full_name, email),
          plans!subscriptions_plan_id_fkey(name_he, name_en)
        `)
        .order('started_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      showToast('שגיאה בטעינת מנויים', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('active', true)
        .order('name_he');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [statusFilter]);

  const handleViewDetails = async (subscription: Subscription) => {
    setSelectedSubscription(subscription);

    // Load payments for this subscription
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      showToast('שגיאה בטעינת תשלומים', 'error');
    }

    setIsDetailsModalOpen(true);
  };

  const handleToggleFreeze = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    try {
      const newStatus = confirmDialog.action === 'freeze' ? 'frozen' : 'active';
      const updateData: any = {
        status: newStatus,
      };

      if (confirmDialog.action === 'freeze') {
        updateData.frozen_at = new Date().toISOString();
      } else {
        updateData.frozen_at = null;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', confirmDialog.subscriptionId);

      if (error) throw error;

      showToast(
        confirmDialog.action === 'freeze' ? 'מנוי הוקפא בהצלחה' : 'מנוי הופעל מחדש בהצלחה',
        'success'
      );
      loadSubscriptions();
    } catch (error) {
      console.error('Error toggling freeze:', error);
      showToast('שגיאה בשינוי סטטוס מנוי', 'error');
    }
  };

  const handleChangePlan = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    if (!selectedPlanId) {
      showToast('יש לבחור תוכנית', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ plan_id: selectedPlanId })
        .eq('id', selectedSubscription!.id);

      if (error) throw error;

      showToast('תוכנית שונתה בהצלחה', 'success');
      setIsChangePlanModalOpen(false);
      setIsDetailsModalOpen(false);
      loadSubscriptions();
    } catch (error) {
      console.error('Error changing plan:', error);
      showToast('שגיאה בשינוי תוכנית', 'error');
    }
  };

  const handleCancelSubscription = async () => {
    if (!canEdit) { showToast('אין הרשאה', 'error'); return; }
    const sub = subscriptions.find(s => s.id === cancelDialog.subId);
    if (!sub) return;

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          canceled_by: profile?.id,
          cancellation_reason: cancelDialog.reason || null,
        })
        .eq('id', cancelDialog.subId);

      if (error) throw error;

      await supabase.from('subscription_audit_log').insert({
        subscription_id: cancelDialog.subId,
        donor_id: sub.user_id,
        performed_by: profile?.id,
        action: 'subscription_canceled',
        note: cancelDialog.reason || 'ביטול ע"י מנהל',
      });

      showToast('מנוי בוטל בהצלחה', 'success');
      setCancelDialog({ isOpen: false, subId: '', reason: '' });
      setIsDetailsModalOpen(false);
      loadSubscriptions();
    } catch (error) {
      console.error(error);
      showToast('שגיאה בביטול מנוי', 'error');
    }
  };

  const getStatusBadge = (subscription: Subscription) => {
    if (subscription.status === 'active' && subscription.successful_payments_count === 0) {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 whitespace-nowrap">
          פעיל – ממתין לחיוב ראשון
        </span>
      );
    }
    const badges = {
      active: 'bg-green-100 text-green-800',
      frozen: 'bg-blue-100 text-blue-800',
      canceled: 'bg-red-100 text-red-800',
      completed: 'bg-purple-100 text-purple-800',
    };
    const labels = {
      active: 'פעיל',
      frozen: 'מוקפא',
      canceled: 'בוטל',
      completed: 'הושלם',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[subscription.status as keyof typeof badges]}`}>
        {labels[subscription.status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#0B3C5D]">ניהול מנויים</h1>
          <p className="text-gray-600 mt-2">מעקב וניהול מנויי תורמים</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'all'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          הכל
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'active'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          פעילים
        </button>
        <button
          onClick={() => setStatusFilter('frozen')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'frozen'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          מוקפאים
        </button>
        <button
          onClick={() => setStatusFilter('canceled')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'canceled'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          מבוטלים
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'completed'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          הושלמו
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תורם</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תוכנית</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סטטוס</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תשלומים מוצלחים</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">זכאות</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תאריך התחלה</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תשלום הבא</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  אין מנויים להצגה
                </td>
              </tr>
            ) : (
              subscriptions.map((subscription) => (
                <tr
                  key={subscription.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewDetails(subscription)}
                >
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{subscription.profiles?.full_name || subscription.profiles?.email || 'משתמש לא ידוע'}</div>
                      <div className="text-gray-500 text-xs">{subscription.profiles?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{subscription.plans.name_he}</td>
                  <td className="px-6 py-4 text-sm">{getStatusBadge(subscription)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{subscription.successful_payments_count}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        subscription.is_eligible
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {subscription.is_eligible ? 'זכאי' : 'לא זכאי'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(subscription.started_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {subscription.next_payment_date
                      ? new Date(subscription.next_payment_date).toLocaleDateString('he-IL')
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(subscription)}
                        className="text-blue-600 hover:text-blue-800"
                        title="צפייה"
                      >
                        <Eye size={18} />
                      </button>
                      {canEdit && subscription.status === 'active' && (
                        <button
                          onClick={() =>
                            setConfirmDialog({
                              isOpen: true,
                              subscriptionId: subscription.id,
                              action: 'freeze',
                            })
                          }
                          className="text-blue-600 hover:text-blue-800"
                          title="הקפא"
                        >
                          <Pause size={18} />
                        </button>
                      )}
                      {canEdit && subscription.status === 'frozen' && (
                        <button
                          onClick={() =>
                            setConfirmDialog({
                              isOpen: true,
                              subscriptionId: subscription.id,
                              action: 'unfreeze',
                            })
                          }
                          className="text-green-600 hover:text-green-800"
                          title="הפעל מחדש"
                        >
                          <Play size={18} />
                        </button>
                      )}
                      {canEdit && (subscription.status === 'active' || subscription.status === 'frozen') && (
                        <button
                          onClick={() => setCancelDialog({ isOpen: true, subId: subscription.id, reason: '' })}
                          className="text-red-500 hover:text-red-700"
                          title="בטל מנוי"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="פרטי מנוי"
        maxWidth="xl"
      >
        {selectedSubscription && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תורם</label>
                <p className="text-gray-900">{selectedSubscription.profiles?.full_name || selectedSubscription.profiles?.email || 'משתמש לא ידוע'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תוכנית</label>
                <p className="text-gray-900">{selectedSubscription.plans.name_he}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
                {getStatusBadge(selectedSubscription)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">זכאות</label>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    selectedSubscription.is_eligible
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedSubscription.is_eligible ? 'זכאי' : 'לא זכאי'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תשלומים מוצלחים</label>
                <p className="text-gray-900">{selectedSubscription.successful_payments_count}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תאריך התחלה</label>
                <p className="text-gray-900">
                  {new Date(selectedSubscription.started_at).toLocaleDateString('he-IL')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תשלום הבא</label>
                <p className="text-gray-900">
                  {selectedSubscription.next_payment_date
                    ? new Date(selectedSubscription.next_payment_date).toLocaleDateString('he-IL')
                    : '—'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">היסטוריית תשלומים</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-right font-medium text-gray-700">סכום</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-700">סטטוס</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-700">תאריך</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                          אין תשלומים
                        </td>
                      </tr>
                    ) : (
                      payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-4 py-2 text-gray-900">₪{payment.amount}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                payment.status === 'succeeded'
                                  ? 'bg-green-100 text-green-800'
                                  : payment.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {payment.status === 'succeeded'
                                ? 'הצליח'
                                : payment.status === 'failed'
                                ? 'נכשל'
                                : 'ממתין'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-900">
                            {payment.paid_at
                              ? new Date(payment.paid_at).toLocaleDateString('he-IL')
                              : new Date(payment.created_at).toLocaleDateString('he-IL')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {canEdit && (
              <div className="flex gap-3 justify-end pt-4 border-t">
                {(selectedSubscription.status === 'active' || selectedSubscription.status === 'frozen') && (
                  <button
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setCancelDialog({ isOpen: true, subId: selectedSubscription.id, reason: '' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <XCircle size={16} />
                    בטל מנוי
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedPlanId(selectedSubscription.plan_id);
                    setIsChangePlanModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90"
                >
                  <Edit2 size={16} />
                  שנה תוכנית
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Change Plan Modal */}
      <Modal
        isOpen={isChangePlanModalOpen}
        onClose={() => setIsChangePlanModalOpen(false)}
        title="שינוי תוכנית מנוי"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">בחר תוכנית חדשה</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
            >
              <option value="">בחר תוכנית</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name_he} - ₪{plan.monthly_amount}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={() => setIsChangePlanModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              ביטול
            </button>
            <button
              onClick={handleChangePlan}
              className="px-4 py-2 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90"
            >
              שמור
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleToggleFreeze}
        title={confirmDialog.action === 'freeze' ? 'הקפאת מנוי' : 'הפעלה מחדש של מנוי'}
        message={
          confirmDialog.action === 'freeze'
            ? 'האם אתה בטוח שברצונך להקפיא מנוי זה? התורם לא יוכל להזמין מלון עד להפעלה מחדש.'
            : 'האם אתה בטוח שברצונך להפעיל מנוי זה מחדש?'
        }
        type={confirmDialog.action === 'freeze' ? 'warning' : 'info'}
      />

      {/* Cancel subscription dialog */}
      {cancelDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" dir="rtl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">ביטול מנוי</h3>
            <p className="text-sm text-gray-600 mb-4">האם אתה בטוח שברצונך לבטל מנוי זה? לא ניתן לבטל פעולה זו.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">סיבת ביטול (אופציונלי)</label>
              <textarea
                value={cancelDialog.reason}
                onChange={(e) => setCancelDialog({ ...cancelDialog, reason: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent resize-none text-sm"
                placeholder="הזן סיבת ביטול..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancelSubscription}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-sm"
              >
                בטל מנוי
              </button>
              <button
                onClick={() => setCancelDialog({ isOpen: false, subId: '', reason: '' })}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold text-sm"
              >
                חזור
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.isOpen && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </AdminLayout>
  );
};
