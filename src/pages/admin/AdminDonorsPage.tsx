import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Search, ExternalLink } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';

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
}

export const AdminDonorsPage = () => {
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [filtered, setFiltered] = useState<DonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast, showToast, hideToast } = useToast();

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
          profiles!subscriptions_user_id_fkey(id, full_name, email, phone, created_at),
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
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">מנוי</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">אין תורמים להצגה</td>
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
                    <a
                      href={`/admin/subscriptions`}
                      className="p-1.5 text-[#0B3C5D] hover:bg-[#0B3C5D]/10 rounded-lg transition-colors inline-flex"
                      title="פרטי מנוי"
                    >
                      <ExternalLink size={15} />
                    </a>
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
