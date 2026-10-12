import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import PlanSelectionPage from './pages/PlanSelectionPage';
import PaymentPage from './pages/PaymentPage';
import RedemptionChoicePage from './pages/RedemptionChoicePage';
import AvailabilityCheckPage from './pages/AvailabilityCheckPage';
import MyOrdersPage from './pages/MyOrdersPage';
import DonorDashboardPage from './pages/DonorDashboardPage';
import DonorHotelsPage from './pages/DonorHotelsPage';
import DonorAdditionalDonationPage from './pages/DonorAdditionalDonationPage';
import DonorManageSubscriptionPage from './pages/DonorManageSubscriptionPage';
import SwitchPlanPage from './pages/SwitchPlanPage';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { SupportPage } from './pages/SupportPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import TermsOfUsePage from './pages/TermsOfUsePage';
import RecommendationsPage from './pages/RecommendationsPage';
import ImmediateRedemptionPage from './pages/ImmediateRedemptionPage';
import OurVacationsPage from './pages/OurVacationsPage';
import VacationDetailPage from './pages/VacationDetailPage';

function AppRoutes() {
  const { user, loading, isAdmin, canView } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
      </div>
    );
  }

  const getDefaultRoute = () => {
    if (!user) return '/';
    if (isAdmin || canView) return '/admin';
    return '/dashboard';
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            isAdmin || canView ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />
          ) : (
            <HomePage />
          )
        }
      />
      <Route
        path="/signin"
        element={user ? <Navigate to={getDefaultRoute()} replace /> : <SignIn />}
      />
      <Route
        path="/signup"
        element={user ? <Navigate to={getDefaultRoute()} replace /> : <SignUp />}
      />
      <Route
        path="/plans"
        element={
          user && (isAdmin || canView) ? <Navigate to="/admin" replace /> : <PlanSelectionPage />
        }
      />
      <Route
        path="/redemption-choice"
        element={
          <ProtectedRoute>
            {isAdmin || canView ? <Navigate to="/admin" replace /> : <RedemptionChoicePage />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/availability-check"
        element={
          <ProtectedRoute>
            {isAdmin || canView ? <Navigate to="/admin" replace /> : <AvailabilityCheckPage />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment"
        element={
          <ProtectedRoute>
            {isAdmin || canView ? <Navigate to="/admin" replace /> : <PaymentPage />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DonorDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/donor/my-orders"
        element={
          <ProtectedRoute>
            <MyOrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/donor/hotels"
        element={
          <ProtectedRoute>
            <DonorHotelsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/donor/additional-donation"
        element={
          <ProtectedRoute>
            <DonorAdditionalDonationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/donor/manage-subscription"
        element={
          <ProtectedRoute>
            <DonorManageSubscriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/donor/switch-plan"
        element={
          <ProtectedRoute>
            <SwitchPlanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            {isAdmin || canView ? <Navigate to="/admin/support" replace /> : <SupportPage />}
          </ProtectedRoute>
        }
      />
      <Route path="/terms-of-use" element={<TermsOfUsePage />} />
      <Route path="/recommendations" element={<RecommendationsPage />} />
      <Route path="/immediate-redemption" element={<ImmediateRedemptionPage />} />
      <Route path="/our-vacations" element={<OurVacationsPage />} />
      <Route path="/our-vacations/:id" element={<VacationDetailPage />} />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
