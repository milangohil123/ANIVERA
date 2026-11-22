import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { LoginView } from './views/auth/LoginView';
import { FarmerLoginView } from './views/auth/FarmerLoginView';
import { AccessDeniedView } from './views/auth/AccessDeniedView';
import { LandingPage } from './views/LandingPage';

// Role Layouts
import {
  DahoLayoutWrapper,
  TahoLayoutWrapper,
  VoLayoutWrapper,
  FwLayoutWrapper,
  FarmerLayoutWrapper,
  CoopLayoutWrapper,
  AdminLayoutWrapper,
} from './layouts/RoleLayoutWrappers';

// Views
import { DahoDistrictSelectorView } from './views/daho/DahoDistrictSelectorView';
import { TahoDashboard } from './views/taho/TahoDashboard';
import { TahoMapsView } from './views/taho/TahoMapsView';
import { TahoStaffView } from './views/taho/TahoStaffView';
import { TahoCampaignsView } from './views/taho/TahoCampaignsView';
import { TahoVaccinationsView } from './views/taho/TahoVaccinationsView';
import { TahoAnimalsView } from './views/taho/TahoAnimalsView';
import { TahoFarmersView } from './views/taho/TahoFarmersView';
import { TahoSurveillanceView } from './views/taho/TahoSurveillanceView';
import { TahoReportsView } from './views/taho/TahoReportsView';
import { TahoProfileView } from './views/taho/TahoProfileView';
import { DahoDashboard } from './views/daho/DahoDashboard';
import { DahoCooperativesView } from './views/daho/DahoCooperativesView';
import { DahoMasterDataView } from './views/daho/DahoMasterDataView';
import { DahoStaffView } from './views/daho/DahoStaffView';
import { DahoCampaignsView } from './views/daho/DahoCampaignsView';
import { DahoCampsView } from './views/daho/DahoCampsView';
import { DahoInventoryView } from './views/daho/DahoInventoryView';
import { DahoSurveillanceView } from './views/daho/DahoSurveillanceView';
import { DahoMapsView } from './views/daho/DahoMapsView';
import { DahoReportsView } from './views/daho/DahoReportsView';
import { DahoProfileView } from './views/daho/DahoProfileView';
import { VoDashboard } from './views/vo/VoDashboard';
import { VoDiseaseInboxView } from './views/vo/VoDiseaseInboxView';
import { VoAnimalsView } from './views/vo/VoAnimalsView';
import { VoVaccinationsView } from './views/vo/VoVaccinationsView';
import { VoCampaignsView } from './views/vo/VoCampaignsView';
import { VoCampsView } from './views/vo/VoCampsView';
import { VoInventoryView } from './views/vo/VoInventoryView';
import { VoSyncView } from './views/vo/VoSyncView';
import { VoProfileView } from './views/vo/VoProfileView';
import { VoReportsView } from './views/vo/VoReportsView';
import { VoMapsView } from './views/vo/VoMapsView';
import { VoFarmersView } from './views/vo/VoFarmersView';
import { VoStaffView } from './views/vo/VoStaffView';
import { VoVillagesView } from './views/vo/VoVillagesView';
import { FwDashboard } from './views/fw/FwDashboard';
import { FwVillagesView } from './views/fw/FwVillagesView';
import { FwFarmersView } from './views/fw/FwFarmersView';
import { FwAnimalsView } from './views/fw/FwAnimalsView';
import { FwScanView } from './views/fw/FwScanView';
import { FwVaccinationsView } from './views/fw/FwVaccinationsView';
import { FwReportsView } from './views/fw/FwReportsView';
import { FwProfileView } from './views/fw/FwProfileView';
import { FarmerDashboard } from './views/farmer/FarmerDashboard';
import { FarmerAnimalsView } from './views/farmer/FarmerAnimalsView';
import { FarmerProfileView } from './views/farmer/FarmerProfileView';
import { CoopDashboard } from './views/coop/CoopDashboard';
import { CoopFarmersView } from './views/coop/CoopFarmersView';
import { CoopAnimalsView } from './views/coop/CoopAnimalsView';
import { CoopVaccinationsView } from './views/coop/CoopVaccinationsView';
import { CoopCampaignsView } from './views/coop/CoopCampaignsView';
import { CoopSurveillanceView } from './views/coop/CoopSurveillanceView';
import { CoopVillageProgressView } from './views/coop/CoopVillageProgressView';
import { CoopMapsView } from './views/coop/CoopMapsView';
import { CoopCampsView } from './views/coop/CoopCampsView';
import { CoopReportsView } from './views/coop/CoopReportsView';
import { CoopProfileView } from './views/coop/CoopProfileView';
import { AdminDashboard } from './views/admin/AdminDashboard';
import { AdminStateMapView } from './views/admin/AdminStateMapView';
import { AdminGeographyView } from './views/admin/AdminGeographyView';
import { AdminDahoView } from './views/admin/AdminDahoView';
import { AdminAssignmentsView } from './views/admin/AdminAssignmentsView';
import { AdminOperationalOversightView } from './views/admin/AdminOperationalOversightView';
import { AdminRoleOversightView } from './views/admin/AdminRoleOversightView';
import { AdminUsersView } from './views/admin/AdminUsersView';
import { AdminDevicesView } from './views/admin/AdminDevicesView';
import { AdminAuditLogsView } from './views/admin/AdminAuditLogsView';
import { AdminSystemHealthView } from './views/admin/AdminSystemHealthView';
import { AdminProfileView } from './views/admin/AdminProfileView';
import { FwDiseaseReportView } from './views/fw/FwDiseaseReportView';
import { FwAttachmentView } from './views/fw/FwAttachmentView';
import { FwPendingView } from './views/fw/FwPendingView';
import { FwSyncView } from './views/fw/FwSyncView';
import { NotificationsView } from './views/notifications/NotificationsView';

const RootRedirect: React.FC = () => {
  const { isAuthenticated, rolePrefix, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LandingPage />;
  return <Navigate to={rolePrefix} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginView />} />
      <Route path="/farmer/login" element={<FarmerLoginView />} />
      <Route path="/access-denied" element={<AccessDeniedView />} />

      {/* Root Dynamic Redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* DAHO District Selection Screen (Multi-District Jurisdiction) */}
      <Route
        path="/daho/select-district"
        element={
          <ProtectedRoute allowedRoles={['DAHO', 'SYS_ADMIN']}>
            <DahoDistrictSelectorView />
          </ProtectedRoute>
        }
      />

      {/* DAHO Protected Tree */}
      <Route
        path="/daho"
        element={
          <ProtectedRoute allowedRoles={['DAHO']}>
            <DahoLayoutWrapper />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/daho/overview" replace />} />
        <Route path="overview" element={<DahoDashboard />} />
        <Route path="cooperatives" element={<DahoCooperativesView />} />
        <Route path="master-data" element={<DahoMasterDataView />} />
        <Route path="staff" element={<DahoStaffView />} />
        <Route path="campaigns" element={<DahoCampaignsView />} />
        <Route path="camps" element={<DahoCampsView />} />
        <Route path="inventory" element={<DahoInventoryView />} />
        <Route path="surveillance" element={<DahoSurveillanceView />} />
        <Route path="maps" element={<DahoMapsView />} />
        <Route path="map" element={<Navigate to="/daho/maps" replace />} />
        <Route path="reports" element={<DahoReportsView />} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<DahoProfileView />} />
      </Route>

      {/* TAHO Protected Tree */}
      <Route
        path="/taho"
        element={
          <ProtectedRoute allowedRoles={['TAHO']}>
            <TahoLayoutWrapper />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/taho/overview" replace />} />
        <Route path="overview" element={<TahoDashboard />} />
        <Route path="maps" element={<TahoMapsView />} />
        <Route path="map" element={<Navigate to="/taho/maps" replace />} />
        <Route path="staff" element={<TahoStaffView />} />
        <Route path="campaigns" element={<TahoCampaignsView />} />
        <Route path="vaccinations" element={<TahoVaccinationsView />} />
        <Route path="animals" element={<TahoAnimalsView />} />
        <Route path="farmers" element={<TahoFarmersView />} />
        <Route path="surveillance" element={<TahoSurveillanceView />} />
        <Route path="reports" element={<TahoReportsView />} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<TahoProfileView />} />
      </Route>

      {/* VO Protected Tree */}
      <Route
        path="/vo"
        element={
          <ProtectedRoute allowedRoles={['VO']}>
            <VoLayoutWrapper />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/vo/overview" replace />} />
        <Route path="overview" element={<VoDashboard />} />
        <Route path="villages" element={<VoVillagesView />} />
        <Route path="staff" element={<VoStaffView />} />
        <Route path="farmers" element={<VoFarmersView />} />
        <Route path="surveillance-reviews" element={<VoDiseaseInboxView />} />
        <Route path="animals" element={<VoAnimalsView />} />
        <Route path="vaccinations" element={<VoVaccinationsView />} />
        <Route path="campaigns" element={<VoCampaignsView />} />
        <Route path="camps" element={<VoCampsView />} />
        <Route path="inventory" element={<VoInventoryView />} />
        <Route path="reports" element={<VoReportsView />} />
        <Route path="maps" element={<VoMapsView />} />
        <Route path="map" element={<Navigate to="/vo/maps" replace />} />
        <Route path="sync" element={<VoSyncView />} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<VoProfileView />} />
      </Route>

      {/* Field Worker Protected Tree */}
      <Route
        path="/fw"
        element={
          <ProtectedRoute allowedRoles={['FW']}>
            <FwLayoutWrapper />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/fw/home" replace />} />
        <Route path="home" element={<FwDashboard />} />
        <Route path="villages" element={<FwVillagesView />} />
        <Route path="farmers" element={<FwFarmersView />} />
        <Route path="animals" element={<FwAnimalsView />} />
        <Route path="scan" element={<FwScanView />} />
        <Route path="reports" element={<FwReportsView />} />
        <Route path="reports/new" element={<FwDiseaseReportView />} />
        <Route path="reports/attachments" element={<FwAttachmentView />} />
        <Route path="vaccinations" element={<FwVaccinationsView />} />
        <Route path="pending" element={<FwPendingView />} />
        <Route path="maps" element={<VoMapsView />} />
        <Route path="map" element={<Navigate to="/fw/maps" replace />} />
        <Route path="sync" element={<FwSyncView />} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<FwProfileView />} />
      </Route>

      {/* Farmer Protected Tree */}
      <Route
        path="/farmer"
        element={
          <ProtectedRoute allowedRoles={['FARMER']}>
            <FarmerLayoutWrapper />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/farmer/home" replace />} />
        <Route path="home" element={<FarmerDashboard />} />
        <Route path="animals" element={<FarmerAnimalsView />} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<FarmerProfileView />} />
      </Route>

      {/* Cooperative Protected Tree */}
      <Route
        path="/coop"
        element={
          <ProtectedRoute allowedRoles={['COOP']}>
            <CoopLayoutWrapper />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/coop/overview" replace />} />
        <Route path="overview" element={<CoopDashboard />} />
        <Route path="farmers" element={<CoopFarmersView />} />
        <Route path="animals" element={<CoopAnimalsView />} />
        <Route path="vaccinations" element={<CoopVaccinationsView />} />
        <Route path="campaigns" element={<CoopCampaignsView />} />
        <Route path="village-progress" element={<CoopVillageProgressView />} />
        <Route path="maps" element={<CoopMapsView />} />
        <Route path="map" element={<Navigate to="/coop/maps" replace />} />
        <Route path="camps" element={<CoopCampsView />} />
        <Route path="surveillance" element={<CoopSurveillanceView />} />
        <Route path="reports" element={<CoopReportsView />} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<CoopProfileView />} />
      </Route>

      {/* SYS_ADMIN / SUPER_ADMIN Protected Tree */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['SYS_ADMIN']}>
            <AdminLayoutWrapper />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/overview" replace />} />
        <Route path="overview" element={<AdminDashboard />} />
        <Route path="map" element={<AdminStateMapView />} />
        <Route path="geography" element={<AdminGeographyView />} />
        <Route path="daho" element={<AdminDahoView />} />
        <Route path="assignments" element={<AdminAssignmentsView />} />
        <Route path="oversight" element={<AdminOperationalOversightView />} />
        <Route path="roles" element={<AdminRoleOversightView />} />
        <Route path="users" element={<AdminUsersView />} />
        <Route path="devices" element={<AdminDevicesView />} />
        <Route path="audit-logs" element={<AdminAuditLogsView />} />
        <Route path="system-health" element={<AdminSystemHealthView />} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<AdminProfileView />} />
      </Route>

      {/* Wildcard / Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

