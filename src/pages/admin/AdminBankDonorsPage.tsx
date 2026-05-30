import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Building2, Eye, Plus, Minus, XCircle, ExternalLink, FileText } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface BankSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'frozen' | 'canceled' | 'completed';
  successful_payments_count: number;
  is_eligible: boolean;
  started_at: string;
  next_payment_date: string | null;
  billing_day: number | null;
  admin_notes: string | null;
  source_thread_id: string | null;
  canceled_by: string | null;
  cancellation_reason: string | null;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
  plans: {
    name_he: string;
    monthly_amount: number;
    required_successful_payments: number;
  };
}

interface AuditEntry {
  id: string;
  action: string;
  notes: string | null;
  metadata: any;
  created_at: string;
  profiles: { full_name: string } | null;
}

export const AdminBankDonorsPage = () => {
  const [subscriptions, setSubscriptions] = useState<BankSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSub, setSelectedSub] = useState<BankSubscription | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{ isOpen: boolean; subId: string; reason: string }>({
    isOpen: false, subId: '', reason: '',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit, profile } = useAuth();

  useEffect(() => { loadSubscriptions(); }, [statusFilter]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('subscriptions')
        .select(`
          *,
          profiles!subscriptions_user_id_fkey(id, full_name, email, phone),
          plans!subscriptions_plan_id_fkey(name_he, monthly_amount, required_successful_payments)
        `)
        .eq('subscription_source', 'manual_bank')
        .order('started_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubscriptions(data || []);
    } catch (err) {
      console.error(err);
      showToast('שגיאה בטעינת נתונים', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async (subscriptionId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscription_audit_log')
        .select(`*, profiles!subscription_audit_log_performed_by_fkey(full_name)`)
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditLog(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const writeAudit = async (subscriptionId: string, donorId: string, action: string, notes?: string, metadata?: any) => {
    await supabase.from('subscription_audit_log').insert({
      subscription_id: subscriptionId,
      donor_id: donorId,
      performed_by: profile?.id,
      action,
      notes: notes || null,
      metadata: metadata || null,
    });
  };

  const openDetail = async (sub: BankSubscription) => {
    setSelectedSub(sub);
    await loadAuditLog(sub.id);
    setIsDetailOpen(true);
  };

  const adjustPaymentCount = async (sub: BankSubscription, delta: 1 | -1) => {
    if (!canEdit) { showToast('אין הרשאה', 'error'); return; }
    const newCount = sub.successful_payments_count + delta;
    if (newCount < 0) { showToast('לא ניתן להוריד מתחת לאפס', 'error'); return; }

    const isEligible = newCount >= sub.plans.required_successful_payments;
    const { error } = await supabase
      .from('subscriptions')
      .update({ successful_payments_count: newCount, is_eligible: isEligible })
      .eq('id', sub.id);

    if (error) { showToast('שגיאה בעדכון', 'error'); return; }

    const action = delta > 0 ? 'payment_count_increase' : 'payment_count_decrease';
    await writeAudit(sub.id, sub.user_id, action, `ספירה: ${sub.successful_payments_count} → ${newCount}`);
    showToast('ספירת תשלומים עודכנה', 'success');
    loadSubscriptions();
    if (selectedSub?.id === sub.id) {
      setSelectedSub({ ...sub, successful_payments_count: newCount, is_eligible: isEligible });
      loadAuditLog(sub.id);
    }
  };

  const openCancelDialog = (sub: BankSubscription) => {
    setCancelDialog({ isOpen: true, subId: sub.id, reason: '' });
  };

  const handleCancel = async () => {
    if (!canEdit) { showToast('אין הרשאה', 'error'); return; }
    const sub = subscriptions.find(s => s.id === cancelDialog.subId);
    if (!sub) return;

    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        canceled_by: profile?.id,
        cancellation_reason: cancelDialog.reason || null,
      })
      .eq('id', cancelDialog.subId);

    if (error) { showToast('שגיאה בביטול', 'error'); return; }

    await writeAudit(cancelDialog.subId, sub.user_id, 'subscription_canceled',
      cancelDialog.reason || 'ללא סיבה');
    showToast('מנוי בוטל', 'success');
    setCancelDialog({ isOpen: false, subId: '', reason: '' });
    loadSubscriptions();
    if (selectedSub?.id === cancelDialog.subId) setIsDetailOpen(false);
  };

  const openSourceThread = (threadId: string) => {
    window.open(`/admin/support?thread=${threadId}`, '_blank');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      frozen: 'bg-blue-100 text-blue-800',
      canceled: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      active: 'פעיל', frozen: 'מוקפא', canceled: 'בוטל', completed: 'הושלם',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      payment_count_increase: 'הגדלת ספירת תשלומים',
      payment_count_decrease: 'הקטנת ספירת תשלומים',
      subscription_canceled: 'ביטול מנוי',
      subscription_created: 'יצירת מנוי',
      ticket_approved: 'אישור פנייה',
    };
    return map[action] || action;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0B3C5D]/10 flex items-center justify-center">
          <Building2 size={22} className="text-[#0B3C5D]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#0B3C5D]">תורמים דרך הוראת קבע בנקאית</h1>
          <p className="text-gray-600 mt-1">ניהול מנויים ידניים שנפתחו דרך הבנק</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {['all', 'active', 'frozen', 'canceled', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f
                ? 'bg-[#0B3C5D] text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {{ all: 'הכל', active: 'פעיל', frozen: 'מוקפא', canceled: 'בוטל', completed: 'הושלם' }[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תורם</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 hidden md:table-cell">תוכנית</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סטטוס</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תשלומים</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 hidden lg:table-cell">יום חיוב</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  אין מנויים בנקאיים להצגה
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 text-sm">{sub.profiles?.full_name || '—'}</div>
                    <div className="text-xs text-gray-500">{sub.profiles?.email}</div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="text-sm text-gray-900">{sub.plans?.name_he}</div>
                    <div className="text-xs text-gray-500">₪{sub.plans?.monthly_amount?.toLocaleString()}/חודש</div>
                  </td>
                  <td className="px-6 py-4">{statusBadge(sub.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {canEdit && sub.status === 'active' && (
                        <button
                          onClick={() => adjustPaymentCount(sub, -1)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="הפחת תשלום"
                        >
                          <Minus size={14} />
                        </button>
                      )}
                      <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-center">
                        {sub.successful_payments_count}/{sub.plans?.required_successful_payments}
                      </span>
                      {canEdit && sub.status === 'active' && (
                        <button
                          onClick={() => adjustPaymentCount(sub, 1)}
                          className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded"
                          title="הוסף תשלום"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-600">
                    {sub.billing_day ? `ה-${sub.billing_day} לחודש` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDetail(sub)}
                        className="p-1.5 text-[#0B3C5D] hover:bg-[#0B3C5D]/10 rounded-lg transition-colors"
                        title="פרטים"
                      >
                        <Eye size={16} />
                      </button>
                      {sub.source_thread_id && (
                        <button
                          onClick={() => openSourceThread(sub.source_thread_id!)}
                          className="p-1.5 text-[#C6A75E] hover:bg-[#C6A75E]/10 rounded-lg transition-colors"
                          title="פנייה מקורית"
                        >
                          <ExternalLink size={16} />
                        </button>
                      )}
                      {canEdit && sub.status === 'active' && (
                        <button
                          onClick={() => openCancelDialog(sub)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="בטל מנוי"
                        >
                          <XCircle size={16} />
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

      {/* Detail Modal */}
      {isDetailOpen && selectedSub && (
        <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="פרטי מנוי בנקאי">
          <div className="space-y-5">
            {/* Donor */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">תורם</div>
              <div className="font-semibold text-gray-900">{selectedSub.profiles?.full_name || '—'}</div>
              <div className="text-sm text-gray-600">{selectedSub.profiles?.email}</div>
              {selectedSub.profiles?.phone && <div className="text-sm text-gray-600">{selectedSub.profiles.phone}</div>}
            </div>

            {/* Subscription details */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">תוכנית: </span><span className="font-medium">{selectedSub.plans?.name_he}</span></div>
              <div><span className="text-gray-400">סטטוס: </span>{statusBadge(selectedSub.status)}</div>
              <div><span className="text-gray-400">סכום: </span><span className="font-medium text-[#C6A75E]">₪{selectedSub.plans?.monthly_amount?.toLocaleString()}</span></div>
              <div><span className="text-gray-400">תשלומים: </span><span className="font-bold">{selectedSub.successful_payments_count}/{selectedSub.plans?.required_successful_payments}</span></div>
              <div><span className="text-gray-400">יום חיוב: </span><span className="font-medium">{selectedSub.billing_day ? `ה-${selectedSub.billing_day}` : '—'}</span></div>
              <div><span className="text-gray-400">זכאות: </span><span className={selectedSub.is_eligible ? 'text-green-600 font-semibold' : 'text-gray-500'}>{selectedSub.is_eligible ? 'כן' : 'לא'}</span></div>
              {selectedSub.admin_notes && (
                <div className="col-span-2"><span className="text-gray-400">הערות: </span><span>{selectedSub.admin_notes}</span></div>
              )}
            </div>

            {/* Quick actions */}
            {canEdit && selectedSub.status === 'active' && (
              <div className="flex gap-3">
                <button
                  onClick={() => adjustPaymentCount(selectedSub, 1)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold"
                >
                  <Plus size={16} />
                  הוסף תשלום
                </button>
                <button
                  onClick={() => adjustPaymentCount(selectedSub, -1)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors text-sm font-semibold"
                >
                  <Minus size={16} />
                  הפחת תשלום
                </button>
                <button
                  onClick={() => { setIsDetailOpen(false); openCancelDialog(selectedSub); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-semibold"
                >
                  <XCircle size={16} />
                  בטל מנוי
                </button>
              </div>
            )}

            {/* Source thread */}
            {selectedSub.source_thread_id && (
              <button
                onClick={() => openSourceThread(selectedSub.source_thread_id!)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#C6A75E] text-[#C6A75E] rounded-xl hover:bg-[#C6A75E]/5 transition-colors text-sm font-semibold"
              >
                <FileText size={16} />
                פתח פנייה מקורית
              </button>
            )}

            {/* Audit Log */}
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">יומן פעולות</div>
              {auditLog.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">אין פעולות רשומות</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="text-xs rounded-lg bg-gray-50 border border-gray-100 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-700">{actionLabel(entry.action)}</span>
                        <span className="text-gray-400">{new Date(entry.created_at).toLocaleString('he-IL')}</span>
                      </div>
                      {entry.notes && <div className="text-gray-500">{entry.notes}</div>}
                      {entry.profiles && <div className="text-gray-400 mt-1">בוצע ע"י: {entry.profiles.full_name}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Dialog */}
      {cancelDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">ביטול מנוי</h3>
            <p className="text-sm text-gray-600 mb-4">האם אתה בטוח שברצונך לבטל מנוי זה?</p>
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
                onClick={handleCancel}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold text-sm"
              >
                בטל מנוי
              </button>
              <button
                onClick={() => setCancelDialog({ isOpen: false, subId: '', reason: '' })}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-sm"
              >
                חזור
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
