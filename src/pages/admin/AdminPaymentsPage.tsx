import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Download } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Payment {
  id: string;
  subscription_id: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  attempt_number: number;
  paid_at: string | null;
  created_at: string;
  failure_reason: string | null;
  subscriptions: {
    profiles: {
      full_name: string;
      email: string;
    };
  };
}

export const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast, showToast, hideToast } = useToast();
  const { canView } = useAuth();

  useEffect(() => {
    if (!canView) {
      showToast('אין לך הרשאה לצפות בדף זה', 'error');
      return;
    }
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          subscriptions!payments_subscription_id_fkey(
            profiles!subscriptions_user_id_fkey(full_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      showToast('שגיאה בטעינת תשלומים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadPayments();
    }
  }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    const badges = {
      succeeded: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    const labels = {
      succeeded: 'הצליח',
      failed: 'נכשל',
      pending: 'ממתין',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const handleExportCSV = () => {
    try {
      // Prepare CSV data
      const headers = ['תאריך', 'שם תורם', 'אימייל', 'סכום', 'סטטוס', 'ניסיון', 'סיבת כישלון'];
      const rows = payments.map((payment) => [
        payment.paid_at
          ? new Date(payment.paid_at).toLocaleDateString('he-IL')
          : new Date(payment.created_at).toLocaleDateString('he-IL'),
        payment.subscriptions?.profiles?.full_name || 'לא זמין',
        payment.subscriptions?.profiles?.email || 'לא זמין',
        `₪${payment.amount}`,
        payment.status === 'succeeded' ? 'הצליח' : payment.status === 'failed' ? 'נכשל' : 'ממתין',
        payment.attempt_number.toString(),
        payment.failure_reason || '',
      ]);

      // Create CSV content with BOM for proper Hebrew encoding
      const BOM = '\uFEFF';
      const csvContent =
        BOM +
        [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `payments_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('הקובץ יוצא בהצלחה', 'success');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showToast('שגיאה בייצוא הקובץ', 'error');
    }
  };

  if (!canView) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">אין לך הרשאה לצפות בדף זה</p>
        </div>
      </AdminLayout>
    );
  }

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0B3C5D]">ניהול תשלומים</h1>
          <p className="text-gray-600 mt-2">צפייה וניתוח תשלומים</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-[#C6A75E] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
        >
          <Download size={20} />
          ייצא ל-CSV
        </button>
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
          onClick={() => setStatusFilter('succeeded')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'succeeded'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          הצליחו
        </button>
        <button
          onClick={() => setStatusFilter('failed')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'failed'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          נכשלו
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'pending'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          ממתינים
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תורם</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סכום</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סטטוס</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">ניסיון</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תאריך</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סיבת כישלון</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  אין תשלומים להצגה
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">
                        {payment.subscriptions?.profiles?.full_name || 'לא זמין'}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {payment.subscriptions?.profiles?.email || 'לא זמין'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">₪{payment.amount}</td>
                  <td className="px-6 py-4 text-sm">{getStatusBadge(payment.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.attempt_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {payment.paid_at
                      ? new Date(payment.paid_at).toLocaleDateString('he-IL')
                      : new Date(payment.created_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {payment.failure_reason || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
