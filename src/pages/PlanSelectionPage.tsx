import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Heart, Hotel } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Plan {
  id: string;
  name_he: string;
  description_he: string;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
}

interface Hotel {
  id: string;
  name_he: string;
  city_he: string;
  level: string;
}

export default function PlanSelectionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hotelsByLevel, setHotelsByLevel] = useState<Record<string, Hotel[]>>({});
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRegistration, setShowRegistration] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    loadPlansAndHotels();
  }, []);

  const loadPlansAndHotels = async () => {
    try {
      const [plansRes, hotelsRes] = await Promise.all([
        supabase.from('plans').select('*').eq('active', true).order('monthly_amount'),
        supabase.from('hotels').select('id, name_he, city_he, level').eq('active', true),
      ]);

      if (plansRes.data) {
        setPlans(plansRes.data);
      }

      if (hotelsRes.data) {
        const grouped = hotelsRes.data.reduce((acc, hotel) => {
          if (!acc[hotel.level]) {
            acc[hotel.level] = [];
          }
          acc[hotel.level].push(hotel);
          return acc;
        }, {} as Record<string, Hotel[]>);
        setHotelsByLevel(grouped);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    if (user) {
      navigate('/payment', { state: { planId: plan.id } });
    } else {
      setSelectedPlan(plan);
      setShowRegistration(true);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    if (formData.password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setRegistering(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
          phone: formData.phone,
          role: 'donor',
        });

        if (profileError) throw profileError;

        navigate('/payment', { state: { planId: selectedPlan?.id } });
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בהרשמה');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען תוכניות...</p>
        </div>
      </div>
    );
  }

  if (showRegistration && selectedPlan) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <button
              onClick={() => setShowRegistration(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowRight size={20} />
              <span>חזרה לבחירת תוכנית</span>
            </button>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">תוכנית נבחרה:</h3>
              <p className="text-blue-800">{selectedPlan.name_he}</p>
              <p className="text-sm text-blue-600">
                ₪{selectedPlan.monthly_amount.toLocaleString()} לחודש | {selectedPlan.required_successful_payments} תשלומים
              </p>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-6">הרשמה למערכת</h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleRegistration} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  שם מלא *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  אימייל *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  טלפון
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  סיסמה *
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  אימות סיסמה *
                </label>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registering ? 'מבצע הרשמה...' : 'הרשמה ומעבר לתשלום'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              כבר יש לך חשבון?{' '}
              <button
                onClick={() => navigate('/signin', { state: { returnTo: '/plans', planId: selectedPlan.id } })}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                התחבר כאן
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowRight size={20} />
            <span>חזרה לדף הבית</span>
          </button>

          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">בחר תוכנית תרומה</h1>
          </div>
          <p className="text-gray-600">בחר את התוכנית המתאימה לך ותתחיל לתרום היום</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const eligibleHotels = hotelsByLevel[plan.hotel_level] || [];
            const totalAmount = plan.monthly_amount * plan.required_successful_payments;

            return (
              <div
                key={plan.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow border-2 border-gray-100"
              >
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name_he}</h3>
                  {plan.description_he && (
                    <p className="text-gray-600 mb-4 text-sm">{plan.description_he}</p>
                  )}

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-4xl font-bold text-blue-600">
                        ₪{plan.monthly_amount.toLocaleString()}
                      </span>
                      <span className="text-gray-600">לחודש</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {plan.required_successful_payments} תשלומים חודשיים
                    </p>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      סה"כ: ₪{totalAmount.toLocaleString()}
                    </p>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Hotel size={18} className="text-blue-600" />
                      זכאות לשהייה במלונות:
                    </h4>
                    {eligibleHotels.length > 0 ? (
                      <ul className="space-y-2">
                        {eligibleHotels.map((hotel) => (
                          <li key={hotel.id} className="flex items-start gap-2 text-sm">
                            <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">
                              {hotel.name_he} - {hotel.city_he}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">לא נמצאו מלונות זמינים ברמה זו</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {user ? 'בחר תוכנית זו' : 'הירשם ובחר תוכנית זו'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">אין תוכניות זמינות כרגע</p>
          </div>
        )}
      </div>
    </div>
  );
}
