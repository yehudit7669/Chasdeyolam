import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, profile, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D] mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <AlertCircle size={24} />
            <h2 className="text-xl font-bold">שגיאה בטעינת הפרופיל</h2>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-600 mb-6">
            אנא נסה להתנתק ולהתחבר שוב, או פנה לתמיכה אם הבעיה נמשכת.
          </p>
          <a
            href="/signin"
            className="block w-full bg-[#0B3C5D] text-white py-3 rounded-lg text-center hover:bg-opacity-90"
          >
            חזור לדף התחברות
          </a>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-yellow-600 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-4">פרופיל לא נמצא</h2>
          <p className="text-gray-600 mb-6">
            לא הצלחנו לטעון את הפרופיל שלך. אנא התנתק והתחבר שוב.
          </p>
          <a
            href="/signin"
            className="block w-full bg-[#0B3C5D] text-white py-3 rounded-lg hover:bg-opacity-90"
          >
            חזור לדף התחברות
          </a>
        </div>
      </div>
    );
  }

  if (requireAdmin && profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-red-600 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-4">אין הרשאת גישה</h2>
          <p className="text-gray-600 mb-6">
            דף זה זמין רק למנהלי מערכת. תפקידך הנוכחי: {profile.role === 'donor' ? 'תורם' : profile.role}
          </p>
          <a
            href="/dashboard"
            className="block w-full bg-[#0B3C5D] text-white py-3 rounded-lg hover:bg-opacity-90"
          >
            חזור ללוח הבקרה
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
