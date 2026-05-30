import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Lock, Unlock, Send, Building2, CheckCircle, X } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface SupportThread {
  id: string;
  user_id: string;
  booking_id: string | null;
  subject: string;
  status: 'open' | 'closed';
  thread_type: string;
  plan_id: string | null;
  plan_snapshot: any | null;
  linked_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface SupportMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

interface Plan {
  id: string;
  name_he: string;
  monthly_amount: number;
  required_successful_payments: number;
}

interface ApproveForm {
  plan_id: string;
  monthly_amount: string;
  required_payments: string;
  start_date: string;
  billing_day: string;
  admin_notes: string;
}

export const AdminSupportPage = () => {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<SupportThread | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [newMessage, setNewMessage] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveForm, setApproveForm] = useState<ApproveForm>({
    plan_id: '',
    monthly_amount: '',
    required_payments: '',
    start_date: new Date().toISOString().split('T')[0],
    billing_day: '',
    admin_notes: '',
  });
  const [approving, setApproving] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const { canEdit, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const autoSelectDone = useRef(false);

  useEffect(() => {
    loadThreads();
    loadPlans();
  }, []);

  useEffect(() => {
    loadThreads();
  }, [statusFilter, typeFilter]);

  const loadPlans = async () => {
    const { data } = await supabase
      .from('plans')
      .select('id, name_he, monthly_amount, required_successful_payments')
      .eq('active', true)
      .order('name_he');
    setPlans(data || []);
  };

  const loadThreads = async () => {
    try {
      let query = supabase
        .from('support_threads')
        .select(`*, profiles!support_threads_user_id_fkey(full_name, email)`)
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (typeFilter !== 'all') query = query.eq('thread_type', typeFilter);

      const { data, error } = await query;
      if (error) throw error;
      const loaded = data || [];
      setThreads(loaded);

      // Auto-select thread from ?thread= query param (only once)
      if (!autoSelectDone.current) {
        const threadId = searchParams.get('thread');
        if (threadId) {
          autoSelectDone.current = true;
          const match = loaded.find(t => t.id === threadId);
          if (match) {
            handleSelectThread(match);
          } else {
            // Thread not in current filter — fetch it directly
            const { data: direct } = await supabase
              .from('support_threads')
              .select(`*, profiles!support_threads_user_id_fkey(full_name, email)`)
              .eq('id', threadId)
              .maybeSingle();
            if (direct) handleSelectThread(direct);
          }
        }
      }
    } catch (error) {
      console.error('Error loading threads:', error);
      showToast('שגיאה בטעינת פניות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select(`*, profiles!support_messages_sender_id_fkey(full_name)`)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      showToast('שגיאה בטעינת הודעות', 'error');
    }
  };

  const handleSelectThread = async (thread: SupportThread) => {
    setSelectedThread(thread);
    await loadMessages(thread.id);
    // Pre-fill approve form from plan_snapshot if bank request
    if (thread.thread_type === 'bank_transfer_request' && thread.plan_snapshot) {
      const snap = thread.plan_snapshot;
      setApproveForm({
        plan_id: thread.plan_id || '',
        monthly_amount: String(snap.monthly_amount || ''),
        required_payments: String(snap.required_successful_payments || ''),
        start_date: new Date().toISOString().split('T')[0],
        billing_day: '',
        admin_notes: '',
      });
    }
  };

  const handleSendMessage = async () => {
    if (!canEdit) { showToast('אין הרשאה', 'error'); return; }
    if (!newMessage.trim()) { showToast('נא להזין הודעה', 'error'); return; }
    if (!selectedThread || !profile) return;

    try {
      const { error } = await supabase.from('support_messages').insert({
        thread_id: selectedThread.id,
        sender_id: profile.id,
        message: newMessage,
        is_admin: true,
      });
      if (error) throw error;

      await supabase.from('support_threads').update({ updated_at: new Date().toISOString() }).eq('id', selectedThread.id);
      showToast('הודעה נשלחה', 'success');
      setNewMessage('');
      await loadMessages(selectedThread.id);
      await loadThreads();
    } catch (error) {
      console.error(error);
      showToast('שגיאה בשליחת הודעה', 'error');
    }
  };

  const handleToggleStatus = async (threadId: string, currentStatus: string) => {
    if (!canEdit) { showToast('אין הרשאה', 'error'); return; }
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      const { error } = await supabase.from('support_threads').update({ status: newStatus }).eq('id', threadId);
      if (error) throw error;
      showToast(newStatus === 'closed' ? 'פנייה נסגרה' : 'פנייה נפתחה מחדש', 'success');
      if (selectedThread?.id === threadId) {
        setSelectedThread({ ...selectedThread, status: newStatus as 'open' | 'closed' });
      }
      await loadThreads();
    } catch (error) {
      showToast('שגיאה בשינוי סטטוס', 'error');
    }
  };

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    setApproveForm({
      ...approveForm,
      plan_id: planId,
      monthly_amount: plan ? String(plan.monthly_amount) : approveForm.monthly_amount,
      required_payments: plan ? String(plan.required_successful_payments) : approveForm.required_payments,
    });
  };

  const handleApproveDirectDebit = async () => {
    if (!canEdit || !selectedThread || !profile) return;
    if (!approveForm.monthly_amount || !approveForm.required_payments) {
      showToast('יש למלא סכום ומספר תשלומים', 'error');
      return;
    }

    setApproving(true);
    try {
      // Determine plan_id — use selected or find by monthly_amount
      let planId = approveForm.plan_id;
      if (!planId) {
        const match = plans.find(p => p.monthly_amount === Number(approveForm.monthly_amount));
        planId = match?.id || plans[0]?.id;
      }
      if (!planId) throw new Error('לא נמצאה תוכנית מתאימה');

      // Create the manual_bank subscription
      const { data: sub, error: subErr } = await supabase
        .from('subscriptions')
        .insert({
          user_id: selectedThread.user_id,
          plan_id: planId,
          subscription_source: 'manual_bank',
          status: 'active',
          successful_payments_count: 0,
          failed_payment_attempts: 0,
          is_eligible: false,
          started_at: new Date(approveForm.start_date).toISOString(),
          billing_day: approveForm.billing_day ? Number(approveForm.billing_day) : null,
          admin_note: approveForm.admin_notes || null,
          source_thread_id: selectedThread.id,
        })
        .select('id')
        .single();

      if (subErr) throw subErr;

      // Link subscription back to thread
      await supabase.from('support_threads').update({
        linked_subscription_id: sub.id,
        status: 'closed',
        updated_at: new Date().toISOString(),
      }).eq('id', selectedThread.id);

      // Add admin message to thread
      await supabase.from('support_messages').insert({
        thread_id: selectedThread.id,
        sender_id: profile.id,
        message: `פנייה אושרה ומנוי הוראת קבע בנקאית הוקם בהצלחה.\n\nפרטי המנוי:\n• סכום חודשי: ₪${approveForm.monthly_amount}\n• מספר תשלומים: ${approveForm.required_payments}\n• תאריך התחלה: ${approveForm.start_date}${approveForm.billing_day ? `\n• יום חיוב: ה-${approveForm.billing_day}` : ''}${approveForm.admin_notes ? `\n• הערות: ${approveForm.admin_notes}` : ''}`,
        is_admin: true,
      });

      // Audit log
      await supabase.from('subscription_audit_log').insert({
        subscription_id: sub.id,
        donor_id: selectedThread.user_id,
        performed_by: profile.id,
        action: 'subscription_created',
        note: `נוצר מפנייה ${selectedThread.id}`,
        metadata: {
          thread_id: selectedThread.id,
          monthly_amount: approveForm.monthly_amount,
          required_payments: approveForm.required_payments,
          billing_day: approveForm.billing_day,
        },
      });

      showToast('מנוי הוקם בהצלחה', 'success');
      setShowApproveModal(false);
      setSelectedThread({ ...selectedThread, status: 'closed', linked_subscription_id: sub.id });
      await loadMessages(selectedThread.id);
      await loadThreads();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'שגיאה ביצירת מנוי', 'error');
    } finally {
      setApproving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = { open: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-800' };
    const labels = { open: 'פתוח', closed: 'סגור' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    if (type === 'bank_transfer_request') {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
          <Building2 size={10} />
          הו"ק בנקאית
        </span>
      );
    }
    return null;
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

  const isBankRequest = selectedThread?.thread_type === 'bank_transfer_request';
  const isAlreadyApproved = !!selectedThread?.linked_subscription_id;

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0B3C5D]">תמיכה</h1>
        <p className="text-gray-600 mt-2">ניהול פניות תמיכה וצ'אט עם תורמים</p>
      </div>

      {/* Filters row */}
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="flex gap-2">
          {['all', 'open', 'closed'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm ${statusFilter === f ? 'bg-[#0B3C5D] text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
            >
              {{ all: 'הכל', open: 'פתוחים', closed: 'סגורים' }[f]}
            </button>
          ))}
        </div>
        <div className="w-px bg-gray-200 mx-1" />
        <div className="flex gap-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm ${typeFilter === 'all' ? 'bg-[#0B3C5D] text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
          >
            כל הקטגוריות
          </button>
          <button
            onClick={() => setTypeFilter('general')}
            className={`px-4 py-2 rounded-lg text-sm ${typeFilter === 'general' ? 'bg-[#0B3C5D] text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
          >
            תמיכה כללית
          </button>
          <button
            onClick={() => setTypeFilter('bank_transfer_request')}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 ${typeFilter === 'bank_transfer_request' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'}`}
          >
            <Building2 size={14} />
            בקשות הו"ק בנקאית
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Threads List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">פניות ({threads.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-6 text-center text-gray-500">אין פניות להצגה</div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedThread?.id === thread.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {thread.thread_type === 'bank_transfer_request'
                        ? <Building2 size={15} className="text-amber-500 flex-shrink-0" />
                        : <MessageSquare size={15} className="text-gray-400 flex-shrink-0" />
                      }
                      <span className="font-medium text-gray-900 text-sm truncate max-w-[120px]">
                        {thread.profiles?.full_name || thread.profiles?.email || '—'}
                      </span>
                    </div>
                    {getStatusBadge(thread.status)}
                  </div>
                  <div className="text-sm text-gray-900 mb-1 truncate">{thread.subject}</div>
                  {thread.thread_type === 'bank_transfer_request' && (
                    <div className="mb-1">{getTypeBadge(thread.thread_type)}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    {new Date(thread.updated_at).toLocaleDateString('he-IL')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat View */}
        <div className="col-span-2 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          {selectedThread ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-semibold text-gray-900">{selectedThread.subject}</h2>
                      {getTypeBadge(selectedThread.thread_type)}
                    </div>
                    <p className="text-sm text-gray-600">
                      {selectedThread.profiles?.full_name || selectedThread.profiles?.email || '—'}
                      {' · '}
                      {selectedThread.profiles?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Approve button for bank requests */}
                    {canEdit && isBankRequest && !isAlreadyApproved && selectedThread.status === 'open' && (
                      <button
                        onClick={() => setShowApproveModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle size={15} />
                        אשר הוראת קבע
                      </button>
                    )}
                    {isAlreadyApproved && (
                      <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <CheckCircle size={14} />
                        מנוי הוקם
                      </span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleToggleStatus(selectedThread.id, selectedThread.status)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                          selectedThread.status === 'open'
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {selectedThread.status === 'open' ? <><Lock size={15} />סגור</> : <><Unlock size={15} />פתח</>}
                      </button>
                    )}
                  </div>
                </div>

                {/* Plan snapshot summary for bank requests */}
                {isBankRequest && selectedThread.plan_snapshot && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 grid grid-cols-3 gap-2">
                    <div><span className="font-semibold">תוכנית: </span>{selectedThread.plan_snapshot.name_he}</div>
                    <div><span className="font-semibold">סכום: </span>₪{selectedThread.plan_snapshot.monthly_amount?.toLocaleString()}/חודש</div>
                    <div><span className="font-semibold">תשלומים: </span>{selectedThread.plan_snapshot.required_successful_payments}</div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[400px] space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500">אין הודעות</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg p-3 ${msg.is_admin ? 'bg-[#0B3C5D] text-white' : 'bg-gray-100 text-gray-900'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">
                            {msg.profiles?.full_name || '—'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${msg.is_admin ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                            {msg.is_admin ? 'מנהל' : 'תורם'}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <div className={`text-xs mt-2 ${msg.is_admin ? 'text-white/70' : 'text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleString('he-IL')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Form */}
              {canEdit && selectedThread.status === 'open' && (
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="כתוב תשובה..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent resize-none text-sm"
                      rows={3}
                    />
                    <button
                      onClick={handleSendMessage}
                      className="px-4 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
                    >
                      <Send size={18} />
                      שלח
                    </button>
                  </div>
                </div>
              )}

              {selectedThread.status === 'closed' && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600 text-center">פנייה זו סגורה</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">בחר פנייה לצפייה</div>
          )}
        </div>
      </div>

      {/* Approve Direct Debit Modal */}
      {showApproveModal && selectedThread && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <Building2 size={18} className="text-green-700" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">אישור הוראת קבע בנקאית</h2>
              </div>
              <button onClick={() => setShowApproveModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              <strong>תורם:</strong> {selectedThread.profiles?.full_name} ({selectedThread.profiles?.email})
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תוכנית</label>
                <select
                  value={approveForm.plan_id}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] text-sm"
                >
                  <option value="">בחר תוכנית (אופציונלי)</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name_he} — ₪{p.monthly_amount}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">סכום חודשי (₪) *</label>
                  <input
                    type="number"
                    value={approveForm.monthly_amount}
                    onChange={(e) => setApproveForm({ ...approveForm, monthly_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] text-sm"
                    placeholder="290"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר תשלומים *</label>
                  <input
                    type="number"
                    value={approveForm.required_payments}
                    onChange={(e) => setApproveForm({ ...approveForm, required_payments: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] text-sm"
                    placeholder="15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תאריך התחלה</label>
                  <input
                    type="date"
                    value={approveForm.start_date}
                    onChange={(e) => setApproveForm({ ...approveForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">יום חיוב בחודש</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={approveForm.billing_day}
                    onChange={(e) => setApproveForm({ ...approveForm, billing_day: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] text-sm"
                    placeholder="1–31"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הערות מנהל</label>
                <textarea
                  value={approveForm.admin_notes}
                  onChange={(e) => setApproveForm({ ...approveForm, admin_notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] resize-none text-sm"
                  placeholder="הערות פנימיות..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleApproveDirectDebit}
                disabled={approving}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle size={16} />
                {approving ? 'יוצר מנוי...' : 'אשר והקם מנוי'}
              </button>
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
