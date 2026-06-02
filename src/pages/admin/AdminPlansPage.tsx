import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase, hotelLevelLabel } from '../../lib/supabase';
import { Plus, Edit2, Power, PowerOff, CheckCircle, XCircle, Hotel, Trash2 } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Plan {
  id: string;
  name_he: string;
  name_en: string;
  description_he: string | null;
  description_en: string | null;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
  active: boolean;
  created_at: string;
  hotels?: Hotel[];
}

interface Hotel {
  id: string;
  name_he: string;
  name_en: string;
  level: string;
}

export const AdminPlansPage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    planId: string;
    currentStatus: boolean;
    action: 'toggle' | 'delete';
  }>({
    isOpen: false,
    planId: '',
    currentStatus: false,
    action: 'toggle',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  const [formData, setFormData] = useState({
    name_he: '',
    name_en: '',
    description_he: '',
    description_en: '',
    monthly_amount: '',
    required_successful_payments: '',
    hotel_level: 'bronze',
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;

      const { data: hotelsData, error: hotelsError } = await supabase
        .from('hotels')
        .select('id, name_he, name_en, level')
        .eq('active', true);

      if (hotelsError) throw hotelsError;

      const plansWithHotels = (plansData || []).map(plan => ({
        ...plan,
        hotels: (hotelsData || []).filter(hotel => hotel.level === plan.hotel_level)
      }));

      setPlans(plansWithHotels);
    } catch (error) {
      console.error('Error loading plans:', error);
      showToast('שגיאה בטעינת תוכניות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name_he: plan.name_he,
        name_en: plan.name_en,
        description_he: plan.description_he || '',
        description_en: plan.description_en || '',
        monthly_amount: plan.monthly_amount.toString(),
        required_successful_payments: plan.required_successful_payments.toString(),
        hotel_level: plan.hotel_level,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name_he: '',
        name_en: '',
        description_he: '',
        description_en: '',
        monthly_amount: '',
        required_successful_payments: '',
        hotel_level: 'bronze',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    const planData = {
      name_he: formData.name_he,
      name_en: formData.name_en,
      description_he: formData.description_he || null,
      description_en: formData.description_en || null,
      monthly_amount: parseInt(formData.monthly_amount),
      required_successful_payments: parseInt(formData.required_successful_payments),
      hotel_level: formData.hotel_level,
    };

    if (planData.monthly_amount <= 0 || planData.required_successful_payments < 1) {
      showToast('ערכים לא תקינים - סכום חודשי חייב להיות גדול מ-0 ותשלומים נדרשים חייבים להיות לפחות 1', 'error');
      return;
    }

    try {
      if (editingPlan) {
        const { error } = await supabase
          .from('plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        showToast('תוכנית עודכנה בהצלחה', 'success');
      } else {
        const { error } = await supabase
          .from('plans')
          .insert(planData);

        if (error) throw error;
        showToast('תוכנית נוספה בהצלחה', 'success');
      }

      setIsModalOpen(false);
      loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      showToast('שגיאה בשמירת תוכנית', 'error');
    }
  };

  const handleToggleActive = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('plans')
        .update({ active: !confirmDialog.currentStatus })
        .eq('id', confirmDialog.planId);

      if (error) throw error;
      showToast(
        confirmDialog.currentStatus ? 'תוכנית הושבתה בהצלחה' : 'תוכנית הופעלה בהצלחה',
        'success'
      );
      loadPlans();
    } catch (error) {
      console.error('Error toggling plan status:', error);
      showToast('שגיאה בשינוי סטטוס תוכנית', 'error');
    }
  };

  const handleDelete = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', confirmDialog.planId);

      if (error) throw error;
      showToast('תוכנית נמחקה בהצלחה', 'success');
      loadPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      showToast('שגיאה במחיקת תוכנית', 'error');
    }
  };

  const handleConfirmAction = () => {
    if (confirmDialog.action === 'delete') {
      handleDelete();
    } else {
      handleToggleActive();
    }
    setConfirmDialog({ ...confirmDialog, isOpen: false });
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'platinum':
        return 'bg-gray-800 text-white';
      case 'gold':
        return 'bg-yellow-500 text-white';
      case 'silver':
        return 'bg-gray-400 text-white';
      case 'bronze':
        return 'bg-orange-600 text-white';
      default:
        return 'bg-gray-300 text-gray-800';
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0B3C5D]">ניהול תוכניות מנוי</h1>
          <p className="text-gray-600 mt-2">ניהול תוכניות התרומה והמנוי</p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-[#0B3C5D] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
          >
            <Plus size={20} />
            הוסף תוכנית
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500">אין תוכניות להצגה</p>
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-100 hover:shadow-lg transition-shadow"
            >
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold">{plan.name_he}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      plan.active
                        ? 'bg-green-400 text-green-900'
                        : 'bg-red-400 text-red-900'
                    }`}
                  >
                    {plan.active ? 'פעיל' : 'מושבת'}
                  </span>
                </div>
                <p className="text-blue-100 text-sm mb-4">{plan.name_en}</p>
                <div className="text-3xl font-bold">₪{plan.monthly_amount.toLocaleString()}</div>
                <p className="text-blue-100 text-sm">לחודש</p>
              </div>

              <div className="p-6 space-y-4">
                {plan.description_he && (
                  <div>
                    <p className="text-gray-700 text-sm">{plan.description_he}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">תשלומים נדרשים:</span>
                    <span className="font-semibold text-gray-900">{plan.required_successful_payments}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">רמת מלון:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getLevelBadgeColor(plan.hotel_level)}`}>
                      {hotelLevelLabel(plan.hotel_level)}
                    </span>
                  </div>
                </div>

                {plan.hotels && plan.hotels.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Hotel size={18} className="text-blue-600" />
                      <span className="font-semibold text-gray-900">מלונות זמינים:</span>
                    </div>
                    <div className="space-y-2">
                      {plan.hotels.map((hotel) => (
                        <div key={hotel.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded px-3 py-2">
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                          <span>{hotel.name_he}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!plan.hotels || plan.hotels.length === 0) && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded px-3 py-2">
                      <XCircle size={16} />
                      <span>אין מלונות מוגדרים</span>
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="space-y-2 pt-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(plan)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 size={18} />
                        עריכה
                      </button>
                      <button
                        onClick={() =>
                          setConfirmDialog({
                            isOpen: true,
                            planId: plan.id,
                            currentStatus: plan.active,
                            action: 'toggle',
                          })
                        }
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          plan.active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {plan.active ? <PowerOff size={18} /> : <Power size={18} />}
                        {plan.active ? 'השבת' : 'הפעל'}
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          planId: plan.id,
                          currentStatus: plan.active,
                          action: 'delete',
                        })
                      }
                      className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={18} />
                      מחק
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? 'עריכת תוכנית' : 'הוספת תוכנית חדשה'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם (עברית) *
              </label>
              <input
                type="text"
                value={formData.name_he}
                onChange={(e) => setFormData({ ...formData, name_he: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם (אנגלית) *
              </label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תיאור (עברית)
              </label>
              <textarea
                value={formData.description_he}
                onChange={(e) => setFormData({ ...formData, description_he: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תיאור (אנגלית)
              </label>
              <textarea
                value={formData.description_en}
                onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                rows={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סכום חודשי (₪) *
              </label>
              <input
                type="number"
                value={formData.monthly_amount}
                onChange={(e) => setFormData({ ...formData, monthly_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תשלומים נדרשים *
              </label>
              <input
                type="number"
                value={formData.required_successful_payments}
                onChange={(e) =>
                  setFormData({ ...formData, required_successful_payments: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                רמת מלון *
              </label>
              <select
                value={formData.hotel_level}
                onChange={(e) => setFormData({ ...formData, hotel_level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
              >
                <option value="bronze">בסיסי</option>
                <option value="silver">כסף</option>
                <option value="gold">זהב</option>
                <option value="platinum">פרימיום</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              {editingPlan ? 'עדכן' : 'הוסף'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmAction}
        title={
          confirmDialog.action === 'delete'
            ? 'מחיקת תוכנית'
            : confirmDialog.currentStatus
            ? 'השבתת תוכנית'
            : 'הפעלת תוכנית'
        }
        message={
          confirmDialog.action === 'delete'
            ? 'האם אתה בטוח שברצונך למחוק תוכנית זו? פעולה זו בלתי הפיכה.'
            : confirmDialog.currentStatus
            ? 'האם אתה בטוח שברצונך להשבית תוכנית זו? תורמים לא יוכלו להירשם אליה.'
            : 'האם אתה בטוח שברצונך להפעיל תוכנית זו?'
        }
        type={confirmDialog.action === 'delete' ? 'danger' : confirmDialog.currentStatus ? 'warning' : 'info'}
      />

      {toast.isOpen && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </AdminLayout>
  );
};
