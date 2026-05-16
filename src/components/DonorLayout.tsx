import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Heart,
  TrendingUp,
  Hotel,
  LifeBuoy,
  Settings,
  LogOut,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface DonorLayoutProps {
  children: ReactNode;
}

export default function DonorLayout({ children }: DonorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-2">
              <Heart className="text-blue-600" size={32} />
              <h1 className="text-2xl font-bold text-gray-900">חסדי עולם</h1>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-red-600 transition-colors"
            >
              <LogOut size={20} />
              <span>יציאה</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
              isActive('/dashboard')
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TrendingUp size={20} />
            <span>דף הבית</span>
          </button>
          <button
            onClick={() => navigate('/donor/hotels')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
              isActive('/donor/hotels')
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Hotel size={20} />
            <span>מלונות</span>
          </button>
          <button
            onClick={() => navigate('/donor/additional-donation')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
              isActive('/donor/additional-donation')
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <DollarSign size={20} />
            <span>תרומה נוספת</span>
          </button>
          <button
            onClick={() => navigate('/support')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
              isActive('/support')
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <LifeBuoy size={20} />
            <span>תמיכה</span>
          </button>
          <button
            onClick={() => navigate('/donor/manage-subscription')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
              isActive('/donor/manage-subscription')
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Settings size={20} />
            <span>ניהול תרומה</span>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
