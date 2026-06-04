import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Search, UserCog, Trash2 } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface UserProfile {
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

export const AdminUsersPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filtered, setFiltered] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; userId: string; newRole: string }>({
    isOpen: false, userId: '', newRole: '',
  });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; user: UserProfile | null; loading: boolean }>({
    isOpen: false, user: null, loading: false,
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { filterUsers(); }, [users, searchTerm, roleFilter]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, subscriptions!subscriptions_user_id_fkey(id, status, successful_payments_count, next_payment_date, plans(name_he))`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error(err);
      showToast('שגיאה בטעינת משתמשים', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let result = users;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      result = result.filter(u => (u.full_name || '').toLowerCase().includes(t) || u.email.toLowerCase().includes(t));
    }
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }
    setFiltered(result);
  };

  const handleChangeRole = async () => {
    if (!canEdit) { showToast('אין הרשאה', 'error'); return; }
    const { error } = await supabase.from('profiles').update({ role: confirmDialog.newRole }).eq('id', confirmDialog.userId);
    if (error) { showToast('שגיאה בעדכון תפקיד', 'error'); return; }
    showToast('תפקיד עודכן בהצלחה', 'success');
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!canEdit || !deleteDialog.user) return;
    setDeleteDialog(d => ({ ...d, loading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId: deleteDialog.user.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? 'שגיאה במחיקת המשתמש', 'error');
        setDeleteDialog(d => ({ ...d, loading: false }));
        return;
      }
      showToast('המשתמש נמחק בהצלחה.', 'success');
      setDeleteDialog({ isOpen: false, user: null, loading: false });
      loadUsers();
    } catch {
      showToast('שגיאה בלתי צפויה במחיקת המשתמש', 'error');
      setDeleteDialog(d => ({ ...d, loading: false }));
    }
  };

  const getRoleName = (role: string) => ({ admin: 'מנהל', viewer: 'צופה', donor: 'תורם' }[role] || role);

  const roleBadge = (role: string) => {
    const cls = { admin: 'bg-red-100 text-red-800', viewer: 'bg-blue-100 text-blue-800', donor: 'bg-green-100 text-green-800' }[role] || 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded-full text-xs ${cls}`}>{getRoleName(role)}</span>;
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
        <h1 className="text-3xl font-bold text-[#0B3C5D]">משתמשים</h1>
        <p className="text-gray-600 mt-2">כל חשבונות המשתמשים הרשומים במערכת ({users.length} סה"כ)</p>
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
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
          >
            <option value="all">כל התפקידים</option>
            <option value="donor">תורם</option>
            <option value="admin">מנהל</option>
            <option value="viewer">צופה</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">שם / אימייל</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">טלפון</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תפקיד</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">מנוי</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">הצטרף</th>
              {canEdit && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">לא נמצאו משתמשים</td>
              </tr>
            ) : (
              filtered.map((u) => {
                const activeSub = u.subscriptions?.find(s => ['active', 'frozen'].includes(s.status));
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm text-gray-900">{u.full_name || <span className="text-gray-400 italic">ללא שם</span>}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.phone || '—'}</td>
                    <td className="px-6 py-4">{roleBadge(u.role)}</td>
                    <td className="px-6 py-4 text-sm">
                      {activeSub ? (
                        <div>
                          <span className={`px-2 py-1 rounded-full text-xs ${activeSub.status === 'frozen' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                            {activeSub.status === 'frozen' ? 'מוקפא' : 'פעיל'}
                          </span>
                          {activeSub.plans?.name_he && <div className="text-xs text-gray-500 mt-0.5">{activeSub.plans.name_he}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">אין מנוי</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(u.created_at).toLocaleDateString('he-IL')}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => { setSelectedUser(u); setIsModalOpen(true); }}
                            className="text-[#0B3C5D] hover:text-[#0B3C5D]/70 transition-colors"
                            title="שינוי תפקיד"
                          >
                            <UserCog size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteDialog({ isOpen: true, user: u, loading: false })}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            title="מחיקת משתמש"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="שינוי תפקיד" maxWidth="sm">
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-gray-900">{selectedUser.full_name}</p>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
              <div className="mt-2">{roleBadge(selectedUser.role)}</div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">שנה ל:</p>
              {['donor', 'viewer', 'admin'].map((role) => (
                <button
                  key={role}
                  onClick={() => { setConfirmDialog({ isOpen: true, userId: selectedUser.id, newRole: role }); setIsModalOpen(false); }}
                  disabled={role === selectedUser.role}
                  className={`w-full px-4 py-2 rounded-lg text-right text-sm ${role === selectedUser.role ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100 text-gray-900'}`}
                >
                  {getRoleName(role)}
                </button>
              ))}
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

      {/* Delete user confirmation */}
      {deleteDialog.isOpen && deleteDialog.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => { if (!deleteDialog.loading) setDeleteDialog({ isOpen: false, user: null, loading: false }); }} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                  <Trash2 className="text-red-600" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#0B3C5D] mb-2">מחיקת משתמש</h3>
                  <p className="text-gray-600 mb-1">
                    האם אתה בטוח שברצונך למחוק את המשתמש?
                  </p>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {deleteDialog.user.full_name || 'ללא שם'} — {deleteDialog.user.email}
                  </p>
                  {deleteDialog.user.subscriptions?.some(s => ['active', 'frozen'].includes(s.status)) && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2">
                      למשתמש זה יש מנוי פעיל. המנוי יבוטל אוטומטית לפני המחיקה.
                    </p>
                  )}
                  <p className="text-sm text-red-600 mt-2">פעולה זו תמחק את המשתמש לצמיתות מהמערכת.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6 justify-end">
                <button
                  onClick={() => setDeleteDialog({ isOpen: false, user: null, loading: false })}
                  disabled={deleteDialog.loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleteDialog.loading}
                  className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleteDialog.loading && (
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  מחק משתמש
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
