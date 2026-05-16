import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { UserPlus, DollarSign } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Plan {
  id: string;
  name_he: string;
  monthly_amount: number;
  required_successful_payments: number;
}

export const AdminServiceDeskPage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    plan_id: '',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name_he, monthly_amount, required_successful_payments')
        .eq('active', true)
        .order('name_he');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      showToast('שגיאה בטעינת תוכניות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDonor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    if (!formData.plan_id) {
      showToast('יש לבחור תוכנית', 'error');
      return;
    }

    try {
      // Create auth user with a temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: tempPassword,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: 'donor',
        });

      if (profileError) throw profileError;

      // Create subscription
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: authData.user.id,
          plan_id: formData.plan_id,
          status: 'active',
          successful_payments_count: 0,
          failed_payment_attempts: 0,
          is_eligible: false,
          started_at: new Date().toISOString(),
        });

      if (subscriptionError) throw subscriptionError;

      showToast('תורם ומנוי נוצרו בהצלחה', 'success');
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        plan_id: '',
      });
    } catch (error: any) {
      console.error('Error creating donor:', error);
      showToast(error.message || 'שגיאה ביצירת תורם', 'error');
    }
  };

  const handleAddManualPayment = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    const email = prompt('הזן כתובת אימייל של התורם:');
    if (!email) return;

    try {
      // Find user by email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (profileError) throw new Error('תורם לא נמצא');

      // Find active subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('id, plan_id, successful_payments_count, plans!subscriptions_plan_id_fkey(monthly_amount, required_successful_payments)')
        .eq('user_id', profileData.id)
        .eq('status', 'active')
        .single();

      if (subscriptionError) throw new Error('מנוי פעיל לא נמצא');

      // Add manual payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          subscription_id: subscriptionData.id,
          amount: subscriptionData.plans.monthly_amount,
          status: 'succeeded',
          attempt_number: 1,
          paid_at: new Date().toISOString(),
        });

      if (paymentError) throw paymentError;

      // Update subscription
      const newPaymentCount = subscriptionData.successful_payments_count + 1;
      const isEligible = newPaymentCount >= subscriptionData.plans.required_successful_payments;

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          successful_payments_count: newPaymentCount,
          is_eligible: isEligible,
        })
        .eq('id', subscriptionData.id);

      if (updateError) throw updateError;

      showToast('תשלום ידני נוסף בהצלחה וזכאות עודכנה', 'success');
    } catch (error: any) {
      console.error('Error adding manual payment:', error);
      showToast(error.message || 'שגיאה בהוספת תשלום ידני', 'error');
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
        <h1 className="text-3xl font-bold text-[#0B3C5D]">שירות לקוחות</h1>
        <p className="text-gray-600 mt-2">יצירה ידנית של תורמים ומנויים</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Create Donor Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus size={24} className="text-[#0B3C5D]" />
            <h2 className="text-xl font-semibold text-gray-900">יצירת תורם ומנוי חדש</h2>
          </div>

          <form onSubmit={handleCreateDonor} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                אימייל *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם מלא *
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                טלפון
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תוכנית מנוי *
              </label>
              <select
                value={formData.plan_id}
                onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
                disabled={!canEdit}
              >
                <option value="">בחר תוכנית</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name_he} - ₪{plan.monthly_amount}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!canEdit}
              className="w-full flex items-center justify-center gap-2 bg-[#0B3C5D] text-white px-4 py-3 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus size={20} />
              צור תורם ומנוי
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>הערה:</strong> התורם ייווצר עם סיסמה זמנית. יש לעדכן את התורם לשנות את הסיסמה בכניסה הראשונה.
            </p>
          </div>
        </div>

        {/* Manual Payment Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign size={24} className="text-[#C6A75E]" />
            <h2 className="text-xl font-semibold text-gray-900">הוספת תשלום ידני</h2>
          </div>

          <div className="space-y-4">
            <p className="text-gray-600">
              הוסף תשלום מוצלח ידנית למנוי קיים. התשלום יעדכן את מונה התשלומים ואת הזכאות.
            </p>

            <button
              onClick={handleAddManualPayment}
              disabled={!canEdit}
              className="w-full flex items-center justify-center gap-2 bg-[#C6A75E] text-white px-4 py-3 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DollarSign size={20} />
              הוסף תשלום ידני
            </button>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <strong>תהליך:</strong>
              </p>
              <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
                <li>לחץ על כפתור "הוסף תשלום ידני"</li>
                <li>הזן את כתובת האימייל של התורם</li>
                <li>התשלום יתווסף והזכאות תעודכן אוטומטית</li>
              </ol>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>טיפ:</strong> השתמש בפעולה זו למקרים חריגים בלבד, כמו תשלומים מזומן או תשלומים שנכשלו בטעות במערכת התשלומים.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!canEdit && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 text-center">
            אין לך הרשאות עריכה. רק מנהלים יכולים לבצע פעולות בדף זה.
          </p>
        </div>
      )}

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
