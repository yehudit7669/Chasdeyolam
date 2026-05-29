import { ReactNode } from 'react';
import logoImg from '../assets/לוגו-חסדי.png';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  TrendingUp,
  Hotel,
  LifeBuoy,
  Settings,
  LogOut,
  DollarSign,
  LayoutDashboard,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface DonorLayoutProps {
  children: ReactNode;
}

export default function DonorLayout({ children }: DonorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, profile, isAdmin } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const tabs = [
    { path: '/dashboard', icon: TrendingUp, label: 'דף הבית' },
    { path: '/donor/hotels', icon: Hotel, label: 'מלונות' },
    { path: '/donor/additional-donation', icon: DollarSign, label: 'תרומה נוספת' },
    { path: '/support', icon: LifeBuoy, label: 'תמיכה' },
    { path: '/donor/manage-subscription', icon: Settings, label: 'ניהול תרומה' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F5F0]" dir="rtl">
      {/* Admin return bar — always visible for admins */}
      {isAdmin && (
        <Link
          to="/admin"
          className="flex items-center gap-2 w-full px-4 py-2.5 bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0B3C5D]/90 transition-colors"
        >
          <ArrowLeft size={15} className="shrink-0" />
          <span>חזרה לפאנל ניהול</span>
          <LayoutDashboard size={15} className="mr-auto shrink-0 opacity-60" />
        </Link>
      )}

      <header className="bg-white border-b border-[#E5E1D8]/60" style={{ boxShadow: '0 1px 8px 0 rgba(98,109,88,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img
                src={logoImg}
                alt="חסדי עולם"
                className="h-11 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="flex items-center gap-3">
              {profile?.full_name && (
                <span className="hidden sm:block text-sm font-medium text-[#33332D]/60">{profile.full_name}</span>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#33332D]/60 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">יציאה</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-[#E5E1D8]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {tabs.map(({ path, icon: Icon, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 ${
                  isActive(path)
                    ? 'border-[#626D58] text-[#626D58]'
                    : 'border-transparent text-[#33332D]/50 hover:text-[#33332D] hover:border-[#E5E1D8]'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
