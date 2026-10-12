import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminPlansPage } from './AdminPlansPage';
import { AdminDonorsPage } from './AdminDonorsPage';
import { AdminSubscriptionsPage } from './AdminSubscriptionsPage';
import { AdminPaymentsPage } from './AdminPaymentsPage';
import { AdminHotelsPage } from './AdminHotelsPage';
import { AdminBookingsPage } from './AdminBookingsPage';
import { AdminSupportPage } from './AdminSupportPage';
import { AdminServiceDeskPage } from './AdminServiceDeskPage';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminBankDonorsPage } from './AdminBankDonorsPage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminVacationGalleryPage } from './AdminVacationGalleryPage';
import { AdminImmediateRequestsPage } from './AdminImmediateRequestsPage';
import { AdminPlanChangeRequestsPage } from './AdminPlanChangeRequestsPage';
import { AdminApproachingEligibilityPage } from './AdminApproachingEligibilityPage';
import { AdminAvailabilityChecksPage } from './AdminAvailabilityChecksPage';

export const AdminDashboard = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboardPage />} />
      <Route path="/plans" element={<AdminPlansPage />} />
      <Route path="/users" element={<AdminUsersPage />} />
      <Route path="/donors" element={<AdminDonorsPage />} />
      <Route path="/bank-donors" element={<AdminBankDonorsPage />} />
      <Route path="/subscriptions" element={<AdminSubscriptionsPage />} />
      <Route path="/payments" element={<AdminPaymentsPage />} />
      <Route path="/hotels" element={<AdminHotelsPage />} />
      <Route path="/bookings" element={<AdminBookingsPage />} />
      <Route path="/support" element={<AdminSupportPage />} />
      <Route path="/service-desk" element={<AdminServiceDeskPage />} />
      <Route path="/settings" element={<AdminSettingsPage />} />
      <Route path="/vacation-gallery" element={<AdminVacationGalleryPage />} />
      <Route path="/immediate-requests" element={<AdminImmediateRequestsPage />} />
      <Route path="/plan-change-requests" element={<AdminPlanChangeRequestsPage />} />
      <Route path="/approaching" element={<AdminApproachingEligibilityPage />} />
      <Route path="/availability-checks" element={<AdminAvailabilityChecksPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};
