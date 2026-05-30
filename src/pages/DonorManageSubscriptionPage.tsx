import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, AlertTriangle, X, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import DonorLayout from '../components/DonorLayout';

interface Subscription {
  id: string;
  status: string;
  successful_payments_count: number;
  started_at: string;
  next_payment_date: string | null;
  plans: {
    id: string;
    name_he: string;
    monthly_amount: number;
    required_successful_payments: number;
    hotel_level: string;
  };
}

export default function DonorManageSubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plans (
            id,
            name_he,
            monthly_amount,
            required_successful_payments,
            hotel_level
          )
        `)
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (data) setSubscription(data as any);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('id', subscription!.id);

      if (error) throw error;
      alert('המנוי בוטל בהצלחה. הוראת הקבע בנדרים פלוס תבוטל בנפרד.');
      navigate('/plans');
    } catch (err: any) {
      alert('שגיאה בביטול מנוי: ' + err.message);
    } finally {
      setProcessing(false);
      setShowCancelDialog(false);
    }
  };

  if (loading) {
    return (
      <DonorLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin" />
        </div>
      </DonorLayout>
    );
  }

  if (!subscription) {
    return (
      <DonorLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-[1.5rem] bg-[#0A192F]/5 flex items-center justify-center mb-6">
            <Heart className="text-[#33332D]/20" size={36} />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">אין לך מנוי פעיל</h2>
          <p className="text-[#33332D]/50 mb-8 font-light">הצטרף עכשיו כדי לנהל מנוי</p>
          <button
            onClick={() => navigate('/plans')}
            className="px-8 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all"
          >
            בחר תוכנית תרומה
          </button>
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A192F]">ניהול תרומה</h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">פרטי המנוי הנוכחי שלך</p>
        </div>

        {/* Current plan card */}
        <div
          className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <div
            className="p-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0A192F 0%, #2D3E40 100%)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#D4B483]/10 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#D4B483]/60 mb-2">המנוי הנוכחי שלי</div>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{subscription.plans.name_he}</h2>
                  <div className="text-[#D4B483] font-bold mt-1">
                    ₪{subscription.plans.monthly_amount.toLocaleString()}
                    <span className="text-white/40 text-sm font-normal mr-1">/ לחודש</span>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-[#626D58] text-white text-xs font-bold rounded-xl">פעיל</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { label: 'תשלומים שבוצעו', value: `${subscription.successful_payments_count} / ${subscription.plans.required_successful_payments}` },
                { label: 'רמת זכאות', value: subscription.plans.hotel_level },
                { label: 'תאריך התחלה', value: new Date(subscription.started_at).toLocaleDateString('he-IL') },
                {
                  label: 'חיוב הבא',
                  value: subscription.next_payment_date
                    ? new Date(subscription.next_payment_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 rounded-2xl bg-[#F9F8F4] border border-[#E5E1D8]/50">
                  <div className="text-xs text-[#33332D]/40 mb-1">{label}</div>
                  <div className="font-bold text-[#0A192F] text-sm">{value}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowCancelDialog(true)}
              className="w-full py-3.5 bg-red-50 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition-colors border-2 border-red-100"
            >
              בטל מנוי
            </button>
          </div>
        </div>

        {/* Change plan — not supported via self-service */}
        <div
          className="flex items-start gap-4 p-5 rounded-2xl border border-[#0A192F]/10"
          style={{ backgroundColor: 'rgba(10,25,47,0.03)' }}
        >
          <Info className="text-[#0A192F]/40 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-[#33332D]/60">
            <p className="font-semibold text-[#33332D]/80 mb-1">שינוי תוכנית</p>
            <p className="font-light leading-relaxed">
              שינוי תוכנית הוראת קבע מחייב יצירת הסדר חדש בנדרים פלוס. לביצוע שינוי תוכנית,
              צור קשר עם התמיכה שלנו — אנו נטפל בזה עבורך.
            </p>
          </div>
        </div>

        {/* Warning */}
        <div
          className="flex items-start gap-4 p-5 rounded-2xl border border-[#D4B483]/20"
          style={{ backgroundColor: 'rgba(212,180,131,0.05)' }}
        >
          <AlertTriangle className="text-[#B08D57] flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-[#33332D]/60">
            <p className="font-semibold text-[#33332D]/80 mb-2">חשוב לדעת:</p>
            <ul className="space-y-1 font-light">
              <li>ביטול מנוי יבטל את ההתקדמות הנוכחית שלך</li>
              <li>ביטול מנוי יבטל את כל הזכאויות למלונות</li>
              <li>תשלומים שכבר בוצעו לא יוחזרו</li>
              <li>הביטול בנדרים פלוס יבוצע בנפרד על ידי הצוות שלנו</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-[#0A192F]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-[2rem] max-w-md w-full p-8 border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 24px 60px rgba(10,25,47,0.2)' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#0A192F]">ביטול מנוי</h3>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="p-2 text-[#33332D]/40 hover:text-[#33332D] transition-colors rounded-xl hover:bg-[#F7F5F0]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-red-50 border border-red-200 mb-6">
              <p className="font-bold text-red-800 mb-2">האם אתה בטוח?</p>
              <p className="text-sm text-red-700 font-light leading-relaxed">
                ביטול המנוי יגרום לאובדן כל ההטבות והזכאויות למלונות. תשלומים שבוצעו לא יוחזרו.
                הביטול בנדרים פלוס יבוצע על ידי הצוות שלנו בנפרד.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelSubscription}
                disabled={processing}
                className="flex-1 py-3.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {processing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'כן, בטל מנוי'}
              </button>
              <button
                onClick={() => setShowCancelDialog(false)}
                disabled={processing}
                className="flex-1 py-3.5 bg-[#F7F5F0] text-[#33332D] font-semibold rounded-xl hover:bg-[#E5E1D8] transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </DonorLayout>
  );
}
