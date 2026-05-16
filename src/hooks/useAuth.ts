import { useAuth as useAuthContext } from '../contexts/AuthContext';

export const useAuth = () => {
  const context = useAuthContext();

  const isAdmin = context.user?.role === 'admin';
  const isViewer = context.user?.role === 'viewer';
  const canEdit = isAdmin;
  const canView = isAdmin || isViewer;

  return {
    ...context,
    isAdmin,
    isViewer,
    canEdit,
    canView,
  };
};