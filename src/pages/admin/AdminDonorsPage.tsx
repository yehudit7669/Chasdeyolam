import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { callNedarimKevaService } from '../../lib/nedarimKevaService';
import { Search, Settings2, Pause, Play, Trash2, X, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface DonorRow {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  subscription_id: string;
  subscription_status: string;
  subscription_source: string;
  successful_payments_count: number;
  plan_name: string | null;
  started_at: string;
  keva_id: string | null;
  next_payment_date: string | null;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
}

interface KevaModal {
  donor: DonorRow;
  liveData: Record<string, unknown> | null;
  liveLoading: boolean;
  liveError: string | null;
  actionProcessing: boolean;
  confirmAction: 'pause' | 'resume' | 'cancel' | null;
}

export const AdminDonorsPage = () => {
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [filtered, setFiltered] = useState<DonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kevaModal, setKevaModal] = useState<KevaModal | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  useEffect(() => { loadDonors(); }, []);
  useEffect(() => { filterDonors(); }, [donors, searchTerm, statusFilter]);

  const loadDonors = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          subscription_source,
          successful_payments_count,
          started_at,
          keva_id,
          next_payment_date,
          profiles!subscriptions_user_id_fkey(id, full_name, email, phone, created_at, terms_accepted, terms_accepted_at),
          plans!subscriptions_plan_id_fkey(name_he)
        `)
        .order('started_at', { ascending: false });

      if (error) throw error;

      const rows: DonorRow[] = (data || []).map((s: any) => ({
        user_id: s.profiles?.id || '',
        full_name: s.profiles?.full_name || '',
        email: s.profiles?.email || '',
        phone: s.profiles?.phone || null,
        created_at: s.profiles?.created_at || '',
        subscription_id: s.id,
        subscription_status: s.status,
        subscription_source: s.subscription_source || 'nedarim',
        successful_payments_count: s.successful_payments_count,
        plan_name: s.plans?.name_he || null,
        started_at: s.started_at,
        keva_id: s.keva_id || null,
        next_payment_date: s.next_payment_date || null,
        terms_accepted: s.profiles?.terms_accepted ?? false,
        terms_accepted_at: s.profiles?.terms_accepted_at || null,
      }));

      setDonors(rows);
    } catch (err) {
      console.error(err);
      showToast('שגיאה בטעינת תורמים', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterDonors = () => {
    let result = donors;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      result = result.filter(d => (d.full_name || '').toLowerCase().includes(t) || d.email.toLowerCase().includes(t));
    }
    if (statusFilter !== 'all') {
      result = result.filter(d => d.subscription_status === statusFilter);
    }
    setFiltered(result);
  };

  const openKevaModal = (donor: DonorRow) => {
    const modal: KevaModal = { donor, liveData: null, liveLoading: true, liveError: null, actionProcessing: false, confirmAction: null };
    setKevaModal(modal);
    // Auto-fetch live data immediately on open
    callNedarimKevaService({
      operation: 'GetKevaId',
      subscriptionId: donor.subscription_id,
      kevaId: donor.keva_id ?? undefined,
      syncPayments: true,
    }).then((result) => {
      setKevaModal(m => m ? { ...m, liveData: result as Record<string, unknown>, liveLoading: false } : null);
      // Reload table to reflect any status change written to DB
      loadDonors();
    }).catch((err: unknown) => {
      setKevaModal(m => m ? { ...m, liveLoading: false, liveError: err instanceof Error ? err.message : 'שגיאה' } : null);
    });
  };

  const loadLiveKevaData = async () => {
    if (!kevaModal) return;
    setKevaModal(m => m ? { ...m, liveLoading: true, liveError: null } : null);
    try {
      const result = await callNedarimKevaService({
        operation: 'GetKevaId',
        subscriptionId: kevaModal.donor.subscription_id,
        kevaId: kevaModal.donor.keva_id ?? undefined,
        syncPayments: true,
      });
      setKevaModal(m => m ? { ...m, liveData: result as Record<string, unknown>, liveLoading: false } : null);
    } catch (err: unknown) {
      setKevaModal(m => m ? { ...m, liveLoading: false, liveError: err instanceof Error ? err.message : 'שגיאה' } : null);
    }
  };

  const executeKevaAction = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!kevaModal) return;
    setKevaModal(m => m ? { ...m, actionProcessing: true, confirmAction: null } : null);

    const opMap = { pause: 'DisableKeva', resume: 'EnableKevaNew', cancel: 'DeleteKeva' } as const;
    try {
      const result = await callNedarimKevaService({
        operation: opMap[action],
        subscriptionId: kevaModal.donor.subscription_id,
        notes: action === 'cancel' ? 'ביטול ע"י מנהל' : undefined,
      });
      if (result.success) {
        const label = action === 'pause' ? 'הוקפא' : action === 'resume' ? 'הופעל' : 'בוטל';
        showToast(`הוראת קבע ${label} בהצלחה`, 'success');
        setKevaModal(null);
        loadDonors();
      } else {
        showToast(result.error ?? 'שגיאה מנדרים פלוס', 'error');
        setKevaModal(m => m ? { ...m, actionProcessing: false } : null);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה', 'error');
      setKevaModal(m => m ? { ...m, actionProcessing: false } : null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      frozen: 'bg-blue-100 text-blue-800',
      canceled: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = { active: 'פעיל', frozen: 'מוקפא', canceled: 'בוטל', completed: 'הושלם' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const sourceBadge = (source: string) => {
    if (source === 'manual_bank') {
      return <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800">בנקאי</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">נדרים</span>;
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0B3C5D]">תורמים</h1>
        <p className="text-gray-600 mt-2">כל מי שיש לו מנוי קיים או היסטורי ({donors.length} רשומות)</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="חיפוש לפי שם או אימייל..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="active">פעיל</option>
            <option value="frozen">מוקפא</option>
            <option value="canceled">בוטל</option>
            <option value="completed">הושלם</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תורם</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תוכנית</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סטטוס</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">מקור</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תשלומים</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 hidden md:table-cell">התחלה</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תנאי שימוש</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">הוראת קבע</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-gray-500">אין תורמים להצגה</td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.subscription_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-gray-900">{d.full_name || <span className="italic text-gray-400">ללא שם</span>}</div>
                    <div className="text-xs text-gray-500">{d.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{d.plan_name || '—'}</td>
                  <td className="px-6 py-4">{statusBadge(d.subscription_status)}</td>
                  <td className="px-6 py-4">{sourceBadge(d.subscription_source)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{d.successful_payments_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                    {new Date(d.started_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-6 py-4">
                    {d.terms_accepted ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                          <CheckCircle size={13} className="text-green-600" />
                          אושר
                        </span>
                        {d.terms_accepted_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(d.terms_accepted_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <XCircle size={13} />
                        טרם אושר
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {canEdit && d.keva_id && (d.subscription_status === 'active' || d.subscription_status === 'frozen') ? (
                      <button
                        onClick={() => openKevaModal(d)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0B3C5D]/10 text-[#0B3C5D] rounded-lg hover:bg-[#0B3C5D]/20 transition-colors text-xs font-semibold"
                        title="נהל הוראת קבע"
                      >
                        <Settings2 size={14} />
                        נהל ה.ק.
                      </button>
                    ) : d.keva_id ? (
                      <span className="text-xs text-gray-400 font-mono">{d.keva_id.slice(0, 8)}…</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Keva Management Modal */}
      {kevaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0B3C5D]">
              <div>
                <h3 className="text-lg font-bold text-white">נהל הוראת קבע</h3>
                <p className="text-sm text-white/60">{kevaModal.donor.full_name || kevaModal.donor.email}</p>
              </div>
              <button onClick={() => setKevaModal(null)} className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'תוכנית', value: kevaModal.donor.plan_name || '—' },
                  { label: 'סטטוס', value: kevaModal.donor.subscription_status === 'active' ? 'פעיל' : 'מוקפא' },
                  { label: 'תשלומים', value: String(kevaModal.donor.successful_payments_count) },
                  {
                    label: 'תנאי שימוש',
                    value: kevaModal.donor.terms_accepted
                      ? `אושר${kevaModal.donor.terms_accepted_at ? ' · ' + new Date(kevaModal.donor.terms_accepted_at).toLocaleDateString('he-IL') : ''}`
                      : 'טרם אושר',
                  },
                  {
                    label: 'חיוב הבא',
                    value: kevaModal.donor.next_payment_date
                      ? new Date(kevaModal.donor.next_payment_date).toLocaleDateString('he-IL')
                      : '—',
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                    <div className="text-sm font-semibold text-gray-900">{value}</div>
                  </div>
                ))}
              </div>

              {/* KevaId */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-0.5">KevaId (נדרים פלוס)</div>
                <div className="text-sm font-mono text-gray-700">{kevaModal.donor.keva_id}</div>
              </div>

              {/* Live data from Nedarim */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">פרטים מנדרים פלוס (סנכרון חי)</span>
                  <button
                    onClick={loadLiveKevaData}
                    disabled={kevaModal.liveLoading}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={kevaModal.liveLoading ? 'animate-spin' : ''} />
                    {kevaModal.liveLoading ? 'טוען ומסנכרן...' : 'טען וסנכרן'}
                  </button>
                </div>
                {kevaModal.liveError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{kevaModal.liveError}</p>
                )}
                {kevaModal.liveData && (() => {
                  const d = kevaModal.liveData;
                  const history = Array.isArray(d.HistoryData) ? d.HistoryData as Record<string, unknown>[] : [];
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'KevaStatus', value: d.KevaStatus === '1' ? 'פעיל' : d.KevaStatus === '0' ? 'מוקפא' : String(d.KevaStatus ?? '—') },
                          { label: 'KevaNextDate', value: String(d.KevaNextDate ?? '—') },
                          { label: 'KevaSuccess', value: String(d.KevaSuccess ?? '—') },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-2">
                            <div className="text-[10px] text-gray-400">{label}</div>
                            <div className="text-xs font-semibold text-gray-700 mt-0.5">{value}</div>
                          </div>
                        ))}
                      </div>
                      {history.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-1.5">היסטוריית חיובים ({history.length})</div>
                          <div className="overflow-auto max-h-40 rounded-lg border border-gray-200">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th className="px-2 py-1.5 text-right text-gray-500 font-medium">תאריך</th>
                                  <th className="px-2 py-1.5 text-right text-gray-500 font-medium">סכום</th>
                                  <th className="px-2 py-1.5 text-right text-gray-500 font-medium">סטטוס</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {history.map((rec, i) => {
                                  const name = String(rec.Name ?? '');
                                  const isSuccess = !name || (!name.includes('סירוב') && !name.includes('ביטול') && !name.includes('נדחה'));
                                  const statusLabel = name.includes('סירוב') || name.includes('נדחה') ? 'נדחה' : name.includes('ביטול') ? 'בוטל' : 'הצליח';
                                  return (
                                    <tr key={i} className="bg-white hover:bg-gray-50">
                                      <td className="px-2 py-1.5 text-gray-700">{String(rec.Date ?? '—')}</td>
                                      <td className="px-2 py-1.5 font-semibold text-gray-900">₪{rec.Amount ?? '—'}</td>
                                      <td className={`px-2 py-1.5 font-medium ${isSuccess ? 'text-green-700' : 'text-red-600'}`}>{statusLabel}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Confirm action prompt */}
              {kevaModal.confirmAction && (
                <div className={`p-4 rounded-xl border ${kevaModal.confirmAction === 'cancel' ? 'bg-red-50 border-red-200' : kevaModal.confirmAction === 'pause' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                  <p className={`text-sm font-semibold mb-3 ${kevaModal.confirmAction === 'cancel' ? 'text-red-800' : kevaModal.confirmAction === 'pause' ? 'text-blue-800' : 'text-green-800'}`}>
                    {kevaModal.confirmAction === 'pause' && 'לאשר השהיית הוראת קבע?'}
                    {kevaModal.confirmAction === 'resume' && 'לאשר חידוש הוראת קבע?'}
                    {kevaModal.confirmAction === 'cancel' && 'לאשר ביטול לצמיתות? פעולה זו אינה הפיכה.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => executeKevaAction(kevaModal.confirmAction!)}
                      disabled={kevaModal.actionProcessing}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${kevaModal.confirmAction === 'cancel' ? 'bg-red-600 hover:bg-red-700' : kevaModal.confirmAction === 'pause' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      {kevaModal.actionProcessing ? '...' : 'אישור'}
                    </button>
                    <button
                      onClick={() => setKevaModal(m => m ? { ...m, confirmAction: null } : null)}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!kevaModal.confirmAction && (
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  {kevaModal.donor.subscription_status === 'active' && (
                    <button
                      onClick={() => setKevaModal(m => m ? { ...m, confirmAction: 'pause' } : null)}
                      disabled={kevaModal.actionProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-semibold disabled:opacity-50"
                    >
                      <Pause size={15} />
                      השהה
                    </button>
                  )}
                  {kevaModal.donor.subscription_status === 'frozen' && (
                    <button
                      onClick={() => setKevaModal(m => m ? { ...m, confirmAction: 'resume' } : null)}
                      disabled={kevaModal.actionProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors text-sm font-semibold disabled:opacity-50"
                    >
                      <Play size={15} />
                      חדש
                    </button>
                  )}
                  <button
                    onClick={() => setKevaModal(m => m ? { ...m, confirmAction: 'cancel' } : null)}
                    disabled={kevaModal.actionProcessing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors text-sm font-semibold disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    בטל
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
