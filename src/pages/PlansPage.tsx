import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/stripe';
import { CheckCircle } from 'lucide-react';

interface Plan {
  id: string;
  name_he: string;
  name_en: string;
  description_he: string | null;
  description_en: string | null;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
}

export const PlansPage = () => {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data } = await supabase
        .from('plans')
        .select('*')
        .eq('active', true)
        .order('monthly_amount');

      if (data) {
        setPlans(data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      navigate('/signin');
      return;
    }

    setSelectedPlan(planId);

    try {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSub) {
        navigate('/dashboard');
        return;
      }

      alert('Stripe integration required. In production, this would create a subscription.');

    } catch (error) {
      console.error('Error creating subscription:', error);
      alert('Failed to create subscription');
    } finally {
      setSelectedPlan(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#0B3C5D] mb-4">בחר את התוכנית שלך</h1>
          <p className="text-gray-600">תרום באופן קבוע וזכה בשהייה במלון</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-transparent hover:border-[#C6A75E] transition-all"
            >
              <div className="bg-gradient-to-br from-[#0B3C5D] to-[#0B3C5D]/80 text-white p-6">
                <h3 className="text-2xl font-bold mb-2">
                  {language === 'he' ? plan.name_he : plan.name_en}
                </h3>
                <div className="text-4xl font-bold mb-2">{formatCurrency(plan.monthly_amount)}</div>
                <div className="text-sm opacity-90">לחודש</div>
              </div>

              <div className="p-6">
                {plan.description_he && (
                  <p className="text-gray-600 mb-6">{language === 'he' ? plan.description_he : plan.description_en}</p>
                )}

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={18} />
                    <span className="text-sm text-gray-700">
                      {plan.required_successful_payments} תשלומים חודשיים
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={18} />
                    <span className="text-sm text-gray-700">
                      זכאות לשהייה ברמה: {plan.hotel_level}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={18} />
                    <span className="text-sm text-gray-700">
                      חדר זוגי כלול
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={selectedPlan === plan.id}
                  className="w-full bg-[#C6A75E] text-[#0B3C5D] py-3 rounded-lg font-bold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                >
                  {selectedPlan === plan.id ? 'מעבד...' : 'בחר תוכנית'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};
