import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { Layout } from '../components/Layout';
import logoImg from '../assets/לוגו-חסדי.png';
import { Heart, UserPlus, AlertCircle } from 'lucide-react';

export const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUp(email, password, fullName, phone);
      navigate('/plans');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        setError('כתובת האימייל כבר רשומה במערכת. נסו להתחבר במקום.');
      } else if (msg.includes('invalid email')) {
        setError('כתובת האימייל אינה תקינה.');
      } else if (msg.includes('password') && msg.includes('short')) {
        setError('הסיסמה קצרה מדי. יש להזין לפחות 6 תווים.');
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('יותר מדי ניסיונות הרשמה. נסו שוב מאוחר יותר.');
      } else {
        setError('אירעה שגיאה בהרשמה. נסו שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4" dir="rtl">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img
                src={logoImg}
                alt="חסדי עולם"
                className="h-20 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
            <h1 className="text-3xl font-black text-[#0A192F] tracking-tight">
              {t.auth.createAccount}
            </h1>
            <p className="text-sm text-[#33332D]/50 mt-2 font-light">
              הצטרפו לקהילת הנתינה שלנו
            </p>
          </div>

          {/* Card */}
          <div
            className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 8px 40px 0 rgba(98,109,88,0.1)' }}
          >
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl mb-6 text-red-700 text-sm">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">
                  {t.auth.fullName}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                  placeholder="ישראל ישראלי"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">
                  {t.auth.email}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                  placeholder="your@email.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">
                  {t.auth.phone}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                  placeholder="050-000-0000"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">
                  {t.auth.password}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                  placeholder="לפחות 6 תווים"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus size={18} />
                    <span>{t.auth.signUp}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#E5E1D8]/60 text-center">
              <p className="text-sm text-[#33332D]/50">
                {t.auth.alreadyHaveAccount}{' '}
                <Link to="/signin" className="text-[#626D58] font-semibold hover:text-[#626D58]/80 transition-colors">
                  {t.auth.signIn}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
