import { ReactNode } from 'react';
import logoImg from '../assets/לוגו-חסדי.png';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, FileText, Users, CreditCard, Hotel, Calendar,
  BookOpen, MessageSquare, Settings, LogOut, Menu, X,
  CircleUser as UserCircle, Building2, HeartHandshake, Wrench,
} from 'lucide-react';
import { useState } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

interface MenuItem {
  path: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
  highlight?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuSections: MenuSection[] = [
    {
      title: 'ראשי',
      items: [
        { path: '/admin', icon: LayoutDashboard, label: 'לוח בקרה', exact: true },
      ],
    },
    {
      title: 'תורמים',
      items: [
        { path: '/admin/users', icon: Users, label: 'משתמשים' },
        { path: '/admin/donors', icon: HeartHandshake, label: 'תורמים' },
        { path: '/admin/bank-donors', icon: Building2, label: 'הוראת קבע בנקאית', highlight: true },
      ],
    },
    {
      title: 'מנויים ותשלומים',
      items: [
        { path: '/admin/subscriptions', icon: FileText, label: 'מנויים' },
        { path: '/admin/payments', icon: CreditCard, label: 'תשלומים' },
        { path: '/admin/plans', icon: FileText, label: 'תוכניות' },
      ],
    },
    {
      title: 'מלונות',
      items: [
        { path: '/admin/hotels', icon: Hotel, label: 'מלונות' },
        { path: '/admin/inventory', icon: Calendar, label: 'מלאי' },
        { path: '/admin/bookings', icon: BookOpen, label: 'הזמנות' },
      ],
    },
    {
      title: 'תמיכה',
      items: [
        { path: '/admin/support', icon: MessageSquare, label: 'פניות תמיכה' },
        { path: '/admin/service-desk', icon: Wrench, label: 'שירות לקוחות' },
        { path: '/admin/settings', icon: Settings, label: 'הגדרות' },
      ],
    },
  ];

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch (error) { console.error('Sign out error:', error); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 right-0 z-50 w-64 bg-[#0B3C5D] text-white transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/10">
            <img
              src={logoImg}
              alt="חסדי עולם"
              className="h-14 w-auto object-contain brightness-0 invert mb-1"
              loading="eager"
              decoding="async"
            />
            <p className="text-sm text-gray-300 mt-1">לוח ניהול</p>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            {menuSections.map((section) => (
              <div key={section.title} className="mb-5">
                <div className="px-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
                  {section.title}
                </div>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path, item.exact);
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                            active
                              ? 'bg-[#C6A75E] text-[#0B3C5D] font-semibold'
                              : item.highlight
                              ? 'hover:bg-white/10 text-amber-300'
                              : 'hover:bg-white/10 text-white/80 hover:text-white'
                          }`}
                        >
                          <Icon size={18} />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-gray-400">מנהל מערכת</p>
            </div>
            <Link
              to="/dashboard"
              onClick={() => setSidebarOpen(false)}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white/80 hover:text-white mb-1"
            >
              <UserCircle size={17} />
              <span>המנוי שלי</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white/80 hover:text-white"
            >
              <LogOut size={17} />
              <span>התנתק</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm lg:hidden sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center justify-between">
            <img src={logoImg} alt="חסדי עולם" className="h-9 w-auto object-contain" loading="eager" decoding="async" />
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#0B3C5D]">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>

        <footer className="bg-white border-t border-gray-200 py-4">
          <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-600">
            © 2026 חסדי עולם - כל הזכויות שמורות
          </div>
        </footer>
      </div>
    </div>
  );
};
