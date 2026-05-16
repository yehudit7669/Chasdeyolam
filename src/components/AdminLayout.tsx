import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  Hotel,
  Calendar,
  BookOpen,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'לוח בקרה', exact: true },
    { path: '/admin/plans', icon: FileText, label: 'תוכניות' },
    { path: '/admin/donors', icon: Users, label: 'תורמים' },
    { path: '/admin/subscriptions', icon: Users, label: 'מנויים' },
    { path: '/admin/payments', icon: CreditCard, label: 'תשלומים' },
    { path: '/admin/hotels', icon: Hotel, label: 'מלונות' },
    { path: '/admin/inventory', icon: Calendar, label: 'מלאי' },
    { path: '/admin/bookings', icon: BookOpen, label: 'הזמנות' },
    { path: '/admin/support', icon: MessageSquare, label: 'תמיכה' },
    { path: '/admin/service-desk', icon: Settings, label: 'שירות לקוחות' },
    { path: '/admin/settings', icon: Settings, label: 'הגדרות' },
  ];

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 right-0 z-50 w-64 bg-[#0B3C5D] text-white transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-700">
            <h1 className="text-2xl font-bold text-[#C6A75E]">חסדי עולם</h1>
            <p className="text-sm text-gray-300 mt-1">לוח ניהול</p>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, item.exact);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        active
                          ? 'bg-[#C6A75E] text-[#0B3C5D] font-medium'
                          : 'hover:bg-gray-700'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name}</p>
                <p className="text-xs text-gray-400">מנהל מערכת</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <LogOut size={18} />
              <span>התנתק</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm lg:hidden sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-[#0B3C5D]">חסדי עולם</h1>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-[#0B3C5D]"
            >
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
