import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Settings, Save } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface AdminSettings {
  id: number;
  default_required_payments: number;
  enable_english: boolean;
  email_sender_name: string;
  email_sender_address: string;
  created_at: string;
  updated_at: string;
}

export const AdminSettingsPage = () => {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    default_required_payments: '',
    enable_english: false,
    email_sender_name: '',
    email_sender_address: '',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) {
        // If no settings exist, create default ones
        if (error.code === 'PGRST116') {
          const defaultSettings = {
            id: 1,
            default_required_payments: 12,
            enable_english: false,
            email_sender_name: 'חסדי עולם',
            email_sender_address: 'noreply@example.com',
          };

          const { data: newData, error: insertError } = await supabase
            .from('admin_settings')
            .insert(defaultSettings)
            .select()
            .single();

          if (insertError) throw insertError;

          setSettings(newData);
          setFormData({
            default_required_payments: newData.default_required_payments.toString(),
            enable_english: newData.enable_english,
            email_sender_name: newData.email_sender_name,
            email_sender_address: newData.email_sender_address,
          });
        } else {
          throw error;
        }
      } else {
        setSettings(data);
        setFormData({
          default_required_payments: data.default_required_payments.toString(),
          enable_english: data.enable_english,
          email_sender_name: data.email_sender_name,
          email_sender_address: data.email_sender_address,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast('שגיאה בטעינת הגדרות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    const requiredPayments = parseInt(formData.default_required_payments);

    if (requiredPayments < 1) {
      showToast('מספר תשלומים נדרש חייב להיות לפחות 1', 'error');
      return;
    }

    setSaving(true);

    try {
      const updateData = {
        default_required_payments: requiredPayments,
        enable_english: formData.enable_english,
        email_sender_name: formData.email_sender_name,
        email_sender_address: formData.email_sender_address,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('admin_settings')
        .update(updateData)
        .eq('id', 1);

      if (error) throw error;

      showToast('הגדרות נשמרו בהצלחה', 'success');
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('שגיאה בשמירת הגדרות', 'error');
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-3">
          <Settings size={32} className="text-[#0B3C5D]" />
          <div>
            <h1 className="text-3xl font-bold text-[#0B3C5D]">הגדרות מערכת</h1>
            <p className="text-gray-600 mt-1">ניהול הגדרות כלליות של המערכת</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Payment Settings */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                הגדרות תשלומים
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מספר תשלומים נדרש (ברירת מחדל) *
                </label>
                <input
                  type="number"
                  value={formData.default_required_payments}
                  onChange={(e) =>
                    setFormData({ ...formData, default_required_payments: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                  required
                  min="1"
                  disabled={!canEdit}
                />
                <p className="text-sm text-gray-500 mt-1">
                  מספר התשלומים המוצלחים הנדרש לצורך זכאות להזמנת מלון
                </p>
              </div>
            </div>

            {/* Localization Settings */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                הגדרות שפה
              </h2>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enable_english"
                  checked={formData.enable_english}
                  onChange={(e) =>
                    setFormData({ ...formData, enable_english: e.target.checked })
                  }
                  className="w-5 h-5 text-[#0B3C5D] border-gray-300 rounded focus:ring-[#0B3C5D]"
                  disabled={!canEdit}
                />
                <label htmlFor="enable_english" className="text-sm font-medium text-gray-700">
                  אפשר תמיכה באנגלית
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-2 mr-8">
                כאשר מופעל, תורמים יוכלו לבחור בין עברית לאנגלית בממשק המשתמש
              </p>
            </div>

            {/* Email Settings */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                הגדרות אימייל
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    שם שולח *
                  </label>
                  <input
                    type="text"
                    value={formData.email_sender_name}
                    onChange={(e) =>
                      setFormData({ ...formData, email_sender_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                    required
                    disabled={!canEdit}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    השם שיוצג כשולח בהודעות אימייל שנשלחות למשתמשים
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    כתובת אימייל שולח *
                  </label>
                  <input
                    type="email"
                    value={formData.email_sender_address}
                    onChange={(e) =>
                      setFormData({ ...formData, email_sender_address: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                    required
                    disabled={!canEdit}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    כתובת האימייל שממנה ישלחו הודעות (חייבת להיות מאומתת במערכת האימייל)
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={loadSettings}
                disabled={!canEdit || saving}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                איפוס
              </button>
              <button
                type="submit"
                disabled={!canEdit || saving}
                className="flex items-center gap-2 px-6 py-2 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    שומר...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    שמור הגדרות
                  </>
                )}
              </button>
            </div>
          </form>

          {!canEdit && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700 text-center">
                אין לך הרשאות עריכה. רק מנהלים יכולים לשנות הגדרות מערכת.
              </p>
            </div>
          )}
        </div>

        {settings && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>עדכון אחרון:</strong>{' '}
              {new Date(settings.updated_at).toLocaleString('he-IL')}
            </p>
          </div>
        )}
      </div>

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
