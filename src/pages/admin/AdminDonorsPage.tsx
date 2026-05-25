import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Search, UserCog } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Donor {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  created_at: string;
  subscriptions: {
    id: string;
    status: string;
    successful_payments_count: number;
    next_payment_date: string | null;
    plans: { name_he: string } | null;
  }[];
}

export const AdminDonorsPage = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    donorId: string;
    newRole: string;
  }>({
    isOpen: false,
    donorId: '',
    newRole: '',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  useEffect(() => {
    loadDonors();
  }, []);

  useEffect(() => {
    filterDonors();
  }, [donors, searchTerm, roleFilter]);

  const loadDonors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          subscriptions (
            id,
            status,
            successful_payments_count,
            next_payment_date,
            plans ( name_he )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonors(data || []);
    } catch (error) {
      console.error('Error loading donors:', error);
      showToast('שגיאה בטעינת תורמים', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterDonors = () => {
    let filtered = donors;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.full_name.toLowerCase().includes(term) ||
          d.email.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((d) => d.role === roleFilter);
    }

    setFilteredDonors(filtered);
  };

  const handleChangeRole = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: confirmDialog.newRole })
        .eq('id', confirmDialog.donorId);

      if (error) throw error;
      showToast('תפקיד עודכן בהצלחה', 'success');
      loadDonors();
    } catch (error) {
      console.error('Error updating role:', error);
      showToast('שגיאה בעדכון תפקיד', 'error');
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'מנהל';
      case 'viewer':
        return 'צופה';
      case 'donor':
        return 'תורם';
      default:
        return role;
    }
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
        <h1 className="text-3xl font-bold text-[#0B3C5D]">ניהול תורמים ומשתמשים</h1>
        <p className="text-gray-600 mt-2">צפייה וניהול משתמשי המערכת</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="חיפוש לפי שם או אימייל..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
          >
            <option value="all">כל התפקידים</option>
            <option value="donor">תורמים</option>
            <option value="admin">מנהלים</option>
            <option value="viewer">צופים</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">שם מלא</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">אימייל</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">טלפון</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תפקיד</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">מנוי</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תאריך הצטרפות</th>
              {canEdit && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredDonors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  לא נמצאו תורמים
                </td>
              </tr>
            ) : (
              filteredDonors.map((donor) => (
                <tr key={donor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{donor.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{donor.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{donor.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        donor.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : donor.role === 'viewer'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {getRoleName(donor.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {(() => {
                      const activeSub = donor.subscriptions?.find(
                        (s) => s.status === 'active' || s.status === 'frozen'
                      );
                      if (!activeSub) {
                        return <span className="text-gray-400 text-xs">אין מנוי</span>;
                      }
                      if (activeSub.status === 'frozen') {
                        return (
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            מוקפא
                          </span>
                        );
                      }
                      if (activeSub.successful_payments_count === 0) {
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 w-fit">
                              פעיל – ממתין לחיוב ראשון
                            </span>
                            {activeSub.plans?.name_he && (
                              <span className="text-xs text-gray-500">{activeSub.plans.name_he}</span>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 w-fit">
                            פעיל · {activeSub.successful_payments_count} תשלומים
                          </span>
                          {activeSub.plans?.name_he && (
                            <span className="text-xs text-gray-500">{activeSub.plans.name_he}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(donor.created_at).toLocaleDateString('he-IL')}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => {
                          setSelectedDonor(donor);
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="שינוי תפקיד"
                      >
                        <UserCog size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="שינוי תפקיד משתמש"
        maxWidth="sm"
      >
        {selectedDonor && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">משתמש:</p>
              <p className="font-medium">{selectedDonor.full_name}</p>
              <p className="text-sm text-gray-600">{selectedDonor.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">תפקיד נוכחי:</p>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedDonor.role === 'admin'
                    ? 'bg-purple-100 text-purple-800'
                    : selectedDonor.role === 'viewer'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {getRoleName(selectedDonor.role)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                תפקיד חדש:
              </label>
              <div className="space-y-2">
                {['donor', 'viewer', 'admin'].map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        donorId: selectedDonor.id,
                        newRole: role,
                      });
                      setIsModalOpen(false);
                    }}
                    disabled={role === selectedDonor.role}
                    className={`w-full px-4 py-2 rounded-lg text-right transition-colors ${
                      role === selectedDonor.role
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    {getRoleName(role)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleChangeRole}
        title="אישור שינוי תפקיד"
        message={`האם אתה בטוח שברצונך לשנות את תפקיד המשתמש ל-${getRoleName(confirmDialog.newRole)}?`}
        type="warning"
      />

      {toast.isOpen && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </AdminLayout>
  );
};
