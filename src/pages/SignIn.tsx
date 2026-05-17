import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { Layout } from '../components/Layout';
import logoImg from '../assets/לוגו-חסדי.png';
import { Heart, LogIn, AlertCircle } from 'lucide-react';

export const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
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
              {t.auth.welcomeBack}
            </h1>
            <p className="text-sm text-[#33332D]/50 mt-2 font-light">
              היכנסו לניהול התרומה שלכם
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
                  {t.auth.password}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                  placeholder="••••••••"
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
                    <LogIn size={18} />
                    <span>{t.auth.signIn}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#E5E1D8]/60 text-center">
              <p className="text-sm text-[#33332D]/50">
                {t.auth.dontHaveAccount}{' '}
                <Link to="/signup" className="text-[#626D58] font-semibold hover:text-[#626D58]/80 transition-colors">
                  {t.auth.signUp}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
