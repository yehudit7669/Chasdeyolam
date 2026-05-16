import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useStore } from '../store/useStore';
import { LogOut, Menu, X, Globe, Heart } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const { t, language } = useTranslation();
  const setLanguage = useStore((state) => state.setLanguage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'he' ? 'en' : 'he');
  };

  const isHome = location.pathname === '/';

  return (
    <div dir={language === 'he' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F7F5F0]">
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled || !isHome
            ? 'bg-white/90 backdrop-blur-md shadow-natural border-b border-[#E5E1D8]/50'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[#0A192F] flex items-center justify-center transition-transform group-hover:scale-105">
                <Heart className="text-[#D4B483]" size={18} fill="currentColor" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#0A192F]">
                {t.app.title}
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {user ? (
                <>
                  <Link
                    to={isAdmin ? '/admin' : '/dashboard'}
                    className="px-4 py-2 text-sm font-medium text-[#33332D]/70 hover:text-[#0A192F] transition-colors rounded-xl hover:bg-[#F7F5F0]"
                  >
                    {isAdmin ? t.admin.dashboard : t.dashboard.mySubscription}
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/support"
                      className="px-4 py-2 text-sm font-medium text-[#33332D]/70 hover:text-[#0A192F] transition-colors rounded-xl hover:bg-[#F7F5F0]"
                    >
                      {t.dashboard.support}
                    </Link>
                  )}
                  <div className="flex items-center gap-3 ms-2 ps-4 border-s border-[#E5E1D8]">
                    <span className="text-sm font-medium text-[#33332D]/60">{profile?.full_name}</span>
                    <button
                      onClick={handleSignOut}
                      className="p-2 text-[#33332D]/50 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
                      title="יציאה"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/signin"
                    className="px-4 py-2 text-sm font-medium text-[#33332D]/70 hover:text-[#0A192F] transition-colors rounded-xl hover:bg-[#F7F5F0]"
                  >
                    {t.auth.signIn}
                  </Link>
                  <Link
                    to="/plans"
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0A192F] rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md ms-1"
                  >
                    {language === 'he' ? 'הצטרף עכשיו' : 'Join Now'}
                  </Link>
                </>
              )}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#33332D]/60 hover:text-[#626D58] transition-colors rounded-xl hover:bg-[#F7F5F0] ms-1"
              >
                <Globe size={16} />
                <span>{language === 'he' ? 'EN' : 'עב'}</span>
              </button>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className="p-2 text-[#33332D]/60 hover:text-[#626D58] transition-colors"
              >
                <Globe size={20} />
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 text-[#33332D] hover:text-[#0A192F] transition-colors"
              >
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-[#E5E1D8]/50">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {user ? (
                <>
                  <Link
                    to={isAdmin ? '/admin' : '/dashboard'}
                    className="block px-4 py-3 text-sm font-medium text-[#33332D] hover:text-[#0A192F] hover:bg-[#F7F5F0] rounded-xl transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {isAdmin ? t.admin.dashboard : t.dashboard.mySubscription}
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/support"
                      className="block px-4 py-3 text-sm font-medium text-[#33332D] hover:text-[#0A192F] hover:bg-[#F7F5F0] rounded-xl transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t.dashboard.support}
                    </Link>
                  )}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E1D8]/50 mt-2">
                    <span className="text-sm text-[#33332D]/60">{profile?.full_name}</span>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
                    >
                      <LogOut size={16} />
                      <span>יציאה</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/signin"
                    className="block px-4 py-3 text-sm font-medium text-[#33332D] hover:bg-[#F7F5F0] rounded-xl transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t.auth.signIn}
                  </Link>
                  <Link
                    to="/plans"
                    className="block px-4 py-3 text-sm font-semibold text-white bg-[#0A192F] rounded-xl text-center transition-colors hover:bg-[#0A192F]/90"
                    onClick={() => setMenuOpen(false)}
                  >
                    {language === 'he' ? 'הצטרף עכשיו' : 'Join Now'}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16 md:pt-20">
        {children}
      </main>

      <footer className="bg-[#0A192F] text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Heart className="text-[#D4B483]" size={18} fill="currentColor" />
              </div>
              <div>
                <div className="font-bold text-white">{t.app.title}</div>
                <div className="text-xs text-white/40 mt-0.5">{t.app.slogan}</div>
              </div>
            </div>
            <div className="text-sm text-white/40">
              © {new Date().getFullYear()} {t.app.title}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
