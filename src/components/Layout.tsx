import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useStore } from '../store/useStore';
import { LogOut, Menu, X, Globe } from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const { t, language } = useTranslation();
  const setLanguage = useStore((state) => state.setLanguage);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <div dir={language === 'he' ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50">
      <nav className="bg-[#0B3C5D] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold text-[#C6A75E]">
                {t.app.title}
              </Link>
              <span className="mr-3 text-sm text-gray-300">{t.app.slogan}</span>
            </div>

            <div className="hidden md:flex items-center gap-6">
              {user && (
                <>
                  <Link
                    to={isAdmin ? '/admin' : '/dashboard'}
                    className="hover:text-[#C6A75E] transition-colors"
                  >
                    {isAdmin ? t.admin.dashboard : t.dashboard.mySubscription}
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/support"
                      className="hover:text-[#C6A75E] transition-colors"
                    >
                      {t.dashboard.support}
                    </Link>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{profile?.full_name}</span>
                    <button
                      onClick={handleSignOut}
                      className="hover:text-[#C6A75E] transition-colors"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>
                </>
              )}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 hover:text-[#C6A75E] transition-colors"
              >
                <Globe size={18} />
                <span className="text-sm">{language === 'he' ? 'EN' : 'עב'}</span>
              </button>
            </div>

            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-white"
              >
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-[#0B3C5D] border-t border-gray-700">
            <div className="px-4 py-3 space-y-3">
              {user && (
                <>
                  <Link
                    to={isAdmin ? '/admin' : '/dashboard'}
                    className="block hover:text-[#C6A75E] transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {isAdmin ? t.admin.dashboard : t.dashboard.mySubscription}
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/support"
                      className="block hover:text-[#C6A75E] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t.dashboard.support}
                    </Link>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{profile?.full_name}</span>
                    <button
                      onClick={handleSignOut}
                      className="hover:text-[#C6A75E] transition-colors"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>
                </>
              )}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 hover:text-[#C6A75E] transition-colors"
              >
                <Globe size={18} />
                <span>{language === 'he' ? 'English' : 'עברית'}</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-[#0B3C5D] text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-300">
            © 2026 {t.app.title}
          </div>
        </div>
      </footer>
    </div>
  );
};
