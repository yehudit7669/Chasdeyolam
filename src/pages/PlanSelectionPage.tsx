import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Hotel, Heart, ShieldCheck, Star, ChevronDown } from 'lucide-react';
import { supabase, hotelLevelLabel } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Layout } from '../components/Layout';

const HOTELS_INITIALLY_VISIBLE = 4;

function HotelList({ hotels, isFeatured, showLess, moreHotels }: { hotels: HotelItem[]; isFeatured: boolean; showLess: string; moreHotels: (n: number) => string }) {
  const [expanded, setExpanded] = useState(false);
  const extraRef = useRef<HTMLDivElement>(null);
  const [extraHeight, setExtraHeight] = useState(0);

  const visible = hotels.slice(0, HOTELS_INITIALLY_VISIBLE);
  const extra = hotels.slice(HOTELS_INITIALLY_VISIBLE);
  const hasExtra = extra.length > 0;

  useEffect(() => {
    if (!extraRef.current) return;
    setExtraHeight(expanded ? extraRef.current.scrollHeight : 0);
  }, [expanded]);

  const itemCls = `flex items-start gap-2 text-sm ${isFeatured ? 'text-white/60' : 'text-[#33332D]/60'}`;
  const checkCls = `mt-0.5 flex-shrink-0 ${isFeatured ? 'text-[#D4B483]' : 'text-[#626D58]'}`;

  return (
    <ul className="space-y-2">
      {visible.map((hotel) => (
        <li key={hotel.id} className={itemCls}>
          <Check size={14} className={checkCls} />
          <span>{hotel.name_he} — {hotel.city_he}</span>
        </li>
      ))}

      {hasExtra && (
        <>
          {/* Animated extra hotels */}
          <li className="list-none p-0">
            <div
              ref={extraRef}
              className="overflow-hidden"
              style={{
                maxHeight: extraHeight,
                opacity: expanded ? 1 : 0,
                transition: 'max-height 0.35s ease, opacity 0.25s ease',
              }}
              aria-hidden={!expanded}
            >
              <ul className="space-y-2 pt-2">
                {extra.map((hotel) => (
                  <li key={hotel.id} className={itemCls}>
                    <Check size={14} className={checkCls} />
                    <span>{hotel.name_he} — {hotel.city_he}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>

          <li className="list-none">
            <button
              onClick={() => setExpanded((v) => !v)}
              className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
                isFeatured
                  ? 'text-[#D4B483]/70 hover:text-[#D4B483]'
                  : 'text-[#626D58]/70 hover:text-[#626D58]'
              }`}
            >
              <ChevronDown
                size={13}
                className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              />
              {expanded ? showLess : moreHotels(extra.length)}
            </button>
          </li>
        </>
      )}
    </ul>
  );
}

interface Plan {
  id: string;
  name_he: string;
  description_he: string;
  monthly_amount: number;
  required_successful_payments: number;
  hotel_level: string;
}

interface HotelItem {
  id: string;
  name_he: string;
  city_he: string;
  level: string;
}

export default function PlanSelectionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const ps = t.planSelection;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hotelsByLevel, setHotelsByLevel] = useState<Record<string, HotelItem[]>>({});
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

      if (plansRes.data) setPlans(plansRes.data);

      if (hotelsRes.data) {
        const grouped = hotelsRes.data.reduce((acc, hotel) => {
          if (!acc[hotel.level]) acc[hotel.level] = [];
          acc[hotel.level].push(hotel);
          return acc;
        }, {} as Record<string, HotelItem[]>);
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
      setError(ps.errorPasswordMismatch);
      return;
    }
    if (formData.password.length < 6) {
      setError(ps.errorPasswordShort);
      return;
    }

    setRegistering(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Trigger handle_new_user() already created the profile row.
        // Update phone and full_name which the trigger doesn't set from form.
        await supabase
          .from('profiles')
          .update({ full_name: formData.fullName, phone: formData.phone || null })
          .eq('id', authData.user.id);

        navigate('/payment', { state: { planId: selectedPlan?.id } });
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        setError(ps.errorEmailExists);
      } else if (msg.includes('invalid email')) {
        setError(ps.errorInvalidEmail);
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setError(ps.errorRateLimit);
      } else {
        setError(ps.errorGeneral);
      }
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#33332D]/50 text-sm">{ps.loading}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (showRegistration && selectedPlan) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4" dir="rtl">
          <div className="w-full max-w-lg">
            <button
              onClick={() => setShowRegistration(false)}
              className="flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors"
            >
              <ArrowRight size={16} />
              <span>{ps.backToPlanSelection}</span>
            </button>

            {/* Selected plan summary */}
            <div
              className="p-5 rounded-2xl border border-[#D4B483]/40 mb-6"
              style={{ background: 'linear-gradient(135deg, #D4B483/5 0%, transparent 100%)', backgroundColor: 'rgba(212,180,131,0.05)' }}
            >
              <div className="text-xs font-bold uppercase tracking-widest text-[#D4B483] mb-1">{ps.selectedPlanLabel}</div>
              <div className="font-bold text-[#0A192F]">{selectedPlan.name_he}</div>
              <div className="text-sm text-[#33332D]/60 mt-0.5">
                ₪{selectedPlan.monthly_amount.toLocaleString()} {ps.perMonth} · {selectedPlan.required_successful_payments} {ps.paymentsCount}
              </div>
            </div>

            <div
              className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
              style={{ boxShadow: '0 8px 40px 0 rgba(98,109,88,0.1)' }}
            >
              <h2 className="text-2xl font-black text-[#0A192F] mb-6">{ps.registrationTitle}</h2>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl mb-6 text-red-700 text-sm">
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegistration} className="space-y-4">
                {[
                  { label: ps.fieldFullName, type: 'text', key: 'fullName', placeholder: ps.fieldFullNamePlaceholder, dir: 'rtl' },
                  { label: ps.fieldEmail, type: 'email', key: 'email', placeholder: 'your@email.com', dir: 'ltr' },
                  { label: ps.fieldPhone, type: 'tel', key: 'phone', placeholder: '050-000-0000', dir: 'ltr' },
                  { label: ps.fieldPassword, type: 'password', key: 'password', placeholder: ps.fieldPasswordPlaceholder, dir: 'rtl' },
                  { label: ps.fieldConfirmPassword, type: 'password', key: 'confirmPassword', placeholder: ps.fieldConfirmPasswordPlaceholder, dir: 'rtl' },
                ].map(({ label, type, key, placeholder, dir }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">{label}</label>
                    <input
                      type={type}
                      required={label.includes('*')}
                      placeholder={placeholder}
                      dir={dir}
                      value={formData[key as keyof typeof formData]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                    />
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={registering}
                  className="w-full py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    ps.registerButton
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[#33332D]/50">
                {ps.hasAccount}{' '}
                <button
                  onClick={() => navigate('/signin', { state: { returnTo: '/plans', planId: selectedPlan.id } })}
                  className="text-[#626D58] font-semibold hover:text-[#626D58]/80 transition-colors"
                >
                  {ps.signInLink}
                </button>
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const featuredIndex = Math.floor(plans.length / 2);

  return (
    <Layout>
      <div className="py-16 px-4" dir="rtl">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-14">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-6 transition-colors"
            >
              <ArrowRight size={16} />
              <span>{ps.backToHome}</span>
            </button>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#626D58]/10 text-[#626D58] text-xs font-semibold uppercase tracking-widest mb-4">
              <Star size={12} fill="currentColor" />
              <span>{ps.badge}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight mb-4">
              {ps.title}
            </h1>
            <p className="text-[#33332D]/50 max-w-lg mx-auto font-light">
              {ps.subtitle}
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan, i) => {
              const eligibleHotels = hotelsByLevel[plan.hotel_level] || [];
              const totalAmount = plan.monthly_amount * plan.required_successful_payments;
              const isFeatured = i === featuredIndex;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-[2rem] overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col ${
                    isFeatured
                      ? 'bg-[#0A192F] text-white'
                      : 'bg-white border border-[#E5E1D8]/60'
                  }`}
                  style={{
                    boxShadow: isFeatured
                      ? '0 24px 60px rgba(10,25,47,0.2)'
                      : '0 4px 24px 0 rgba(98,109,88,0.08)',
                  }}
                >
                  {isFeatured && (
                    <div className="absolute top-5 start-5">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#D4B483] text-[#0A192F] text-[10px] font-bold uppercase tracking-widest">
                        <Star size={10} fill="currentColor" />
                        {ps.mostPopular}
                      </span>
                    </div>
                  )}

                  <div className="p-8 flex flex-col flex-1">
                    <div className={`text-xs font-bold uppercase tracking-[0.25em] mb-6 ${isFeatured ? 'text-[#D4B483]/60 mt-6' : 'text-[#33332D]/30'}`}>
                      {hotelLevelLabel(plan.hotel_level, language)}
                    </div>

                    <h3 className={`text-2xl font-bold mb-2 ${isFeatured ? 'text-white' : 'text-[#0A192F]'}`}>
                      {plan.name_he}
                    </h3>

                    {plan.description_he && (
                      <p className={`text-sm mb-6 font-light leading-relaxed ${isFeatured ? 'text-white/50' : 'text-[#33332D]/50'}`}>
                        {plan.description_he}
                      </p>
                    )}

                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-black ${isFeatured ? 'text-white' : 'text-[#0A192F]'}`}>
                          ₪{plan.monthly_amount.toLocaleString()}
                        </span>
                        <span className={`text-sm font-light ${isFeatured ? 'text-white/50' : 'text-[#33332D]/50'}`}>
                          {ps.perMonth}
                        </span>
                      </div>
                      <div className={`text-xs mt-1.5 ${isFeatured ? 'text-white/40' : 'text-[#33332D]/40'}`}>
                        {plan.required_successful_payments} {ps.paymentsTotal} ₪{totalAmount.toLocaleString()}
                      </div>
                    </div>

                    {/* Hotels */}
                    <div className="mb-8 flex-1">
                      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-3 ${isFeatured ? 'text-[#D4B483]/70' : 'text-[#33332D]/40'}`}>
                        <Hotel size={12} />
                        <span>{ps.hotelEligibility}</span>
                      </div>
                      {eligibleHotels.length > 0 ? (
                        <HotelList hotels={eligibleHotels} isFeatured={isFeatured} showLess={ps.showLess} moreHotels={(n) => ps.moreHotels.replace('{n}', String(n))} />
                      ) : (
                        <p className={`text-sm ${isFeatured ? 'text-white/30' : 'text-[#33332D]/30'}`}>
                          {ps.noHotels}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      className={`w-full py-3.5 rounded-xl font-semibold transition-all text-sm hover:shadow-md ${
                        isFeatured
                          ? 'text-[#0A192F] hover:-translate-y-0.5'
                          : 'bg-[#0A192F] text-white hover:bg-[#0A192F]/90'
                      }`}
                      style={isFeatured ? { background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' } : {}}
                    >
                      {user ? ps.selectPlan : ps.selectPlanRegister}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {plans.length === 0 && (
            <div className="text-center py-16">
              <Heart className="mx-auto mb-4 text-[#33332D]/20" size={48} />
              <p className="text-[#33332D]/50">{ps.noPlans}</p>
            </div>
          )}

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-8 mt-12 flex-wrap">
            {[
              { icon: ShieldCheck, text: ps.sslBadge },
              { icon: Check, text: ps.cancelAnytime },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-[#33332D]/40">
                <Icon size={16} className="text-[#626D58]" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
