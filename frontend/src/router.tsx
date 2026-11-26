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
import { TahoTalukaSelectorView } from './views/taho/TahoTalukaSelectorView';
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
import { AdminCampaignsView } from './views/admin/AdminCampaignsView';
import { AdminMasterManagementView } from './views/admin/AdminMasterManagementView';
import { AdminStateMapView } from './views/admin/AdminStateMapView';
import { AdminGeographyView } from './views/admin/AdminGeographyView';
import { AdminDahoView } from './views/admin/AdminDahoView';
import { AdminAssignmentsView } from './views/admin/AdminAssignmentsView';
import { AdminOperationalOversightView } from './views/admin/AdminOperationalOversightView';
import { AdminRbacView } from './views/admin/AdminRbacView';
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
import { InferenceAnalyticsDashboard } from './views/analytics/InferenceAnalyticsDashboard';

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

      {/* TAHO Taluka Selection Screen (Multi-Taluka Jurisdiction) */}
      <Route
        path="/taho/select-taluka"
        element={
          <ProtectedRoute allowedRoles={['TAHO', 'SYS_ADMIN']}>
            <TahoTalukaSelectorView />
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
        <Route path="cooperatives" element={<ProtectedRoute requiredPermission="coop.manage"><DahoCooperativesView /></ProtectedRoute>} />
        <Route path="master-data" element={<ProtectedRoute requiredPermission="geo.district.manage"><DahoMasterDataView /></ProtectedRoute>} />
        <Route path="staff" element={<ProtectedRoute requiredPermission="user.staff.manage"><DahoStaffView /></ProtectedRoute>} />
        <Route path="campaigns" element={<ProtectedRoute requiredPermission="campaign.monitor"><DahoCampaignsView /></ProtectedRoute>} />
        <Route path="camps" element={<ProtectedRoute requiredPermission="campaign.monitor"><DahoCampsView /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute requiredPermission="reports.district"><DahoInventoryView /></ProtectedRoute>} />
        <Route path="surveillance" element={<ProtectedRoute requiredPermission="disease.case.assign"><DahoSurveillanceView /></ProtectedRoute>} />
        <Route path="maps" element={<ProtectedRoute requiredPermission="map.view"><DahoMapsView /></ProtectedRoute>} />
        <Route path="map" element={<Navigate to="/daho/maps" replace />} />
        <Route path="reports" element={<ProtectedRoute requiredPermission="reports.district"><DahoReportsView /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute requiredPermission="reports.district"><InferenceAnalyticsDashboard /></ProtectedRoute>} />
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
        <Route path="maps" element={<ProtectedRoute requiredPermission="map.view"><TahoMapsView /></ProtectedRoute>} />
        <Route path="map" element={<Navigate to="/taho/maps" replace />} />
        <Route path="staff" element={<ProtectedRoute requiredPermission="user.staff.manage"><TahoStaffView /></ProtectedRoute>} />
        <Route path="campaigns" element={<ProtectedRoute requiredPermission="campaign.monitor"><TahoCampaignsView /></ProtectedRoute>} />
        <Route path="vaccinations" element={<ProtectedRoute requiredPermission="vaccination.history.view"><TahoVaccinationsView /></ProtectedRoute>} />
        <Route path="animals" element={<ProtectedRoute requiredPermission="animal.view"><TahoAnimalsView /></ProtectedRoute>} />
        <Route path="farmers" element={<ProtectedRoute requiredPermission="farmer.view"><TahoFarmersView /></ProtectedRoute>} />
        <Route path="surveillance" element={<ProtectedRoute requiredPermission="disease.case.assign"><TahoSurveillanceView /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute requiredPermission="reports.taluka"><TahoReportsView /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute requiredPermission="reports.taluka"><InferenceAnalyticsDashboard /></ProtectedRoute>} />
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
        <Route path="villages" element={<ProtectedRoute requiredPermission="map.view"><VoVillagesView /></ProtectedRoute>} />
        <Route path="staff" element={<ProtectedRoute requiredPermission="user.staff.manage"><VoStaffView /></ProtectedRoute>} />
        <Route path="farmers" element={<ProtectedRoute requiredPermission="farmer.view"><VoFarmersView /></ProtectedRoute>} />
        <Route path="surveillance-reviews" element={<ProtectedRoute requiredPermission="disease.report"><VoDiseaseInboxView /></ProtectedRoute>} />
        <Route path="animals" element={<ProtectedRoute requiredPermission="animal.view"><VoAnimalsView /></ProtectedRoute>} />
        <Route path="vaccinations" element={<ProtectedRoute requiredPermission="vaccination.create"><VoVaccinationsView /></ProtectedRoute>} />
        <Route path="campaigns" element={<ProtectedRoute requiredPermission="campaign.monitor"><VoCampaignsView /></ProtectedRoute>} />
        <Route path="camps" element={<ProtectedRoute requiredPermission="campaign.monitor"><VoCampsView /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute requiredPermission="reports.village"><VoInventoryView /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute requiredPermission="reports.village"><VoReportsView /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute requiredPermission="reports.village"><InferenceAnalyticsDashboard /></ProtectedRoute>} />
        <Route path="maps" element={<ProtectedRoute requiredPermission="map.view"><VoMapsView /></ProtectedRoute>} />
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
        <Route path="villages" element={<ProtectedRoute requiredPermission="map.view"><FwVillagesView /></ProtectedRoute>} />
        <Route path="farmers" element={<ProtectedRoute requiredPermission="farmer.view"><FwFarmersView /></ProtectedRoute>} />
        <Route path="animals" element={<ProtectedRoute requiredPermission="animal.register"><FwAnimalsView /></ProtectedRoute>} />
        <Route path="scan" element={<ProtectedRoute requiredPermission="animal.view"><FwScanView /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute requiredPermission="reports.village"><FwReportsView /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute requiredPermission="reports.village"><InferenceAnalyticsDashboard /></ProtectedRoute>} />
        <Route path="reports/new" element={<ProtectedRoute requiredPermission="disease.report"><FwDiseaseReportView /></ProtectedRoute>} />
        <Route path="reports/attachments" element={<ProtectedRoute requiredPermission="disease.report"><FwAttachmentView /></ProtectedRoute>} />
        <Route path="vaccinations" element={<ProtectedRoute requiredPermission="vaccination.create"><FwVaccinationsView /></ProtectedRoute>} />
        <Route path="pending" element={<ProtectedRoute requiredPermission="vaccination.create"><FwPendingView /></ProtectedRoute>} />
        <Route path="maps" element={<ProtectedRoute requiredPermission="map.view"><VoMapsView /></ProtectedRoute>} />
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
        <Route path="animals" element={<ProtectedRoute requiredPermission="animal.view"><FarmerAnimalsView /></ProtectedRoute>} />
        <Route path="maps" element={<ProtectedRoute requiredPermission="map.view"><DahoMapsView /></ProtectedRoute>} />
        <Route path="map" element={<Navigate to="/farmer/maps" replace />} />
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
        <Route path="farmers" element={<ProtectedRoute requiredPermission="farmer.view"><CoopFarmersView /></ProtectedRoute>} />
        <Route path="animals" element={<ProtectedRoute requiredPermission="animal.view"><CoopAnimalsView /></ProtectedRoute>} />
        <Route path="vaccinations" element={<ProtectedRoute requiredPermission="vaccination.history.view"><CoopVaccinationsView /></ProtectedRoute>} />
        <Route path="campaigns" element={<ProtectedRoute requiredPermission="campaign.monitor"><CoopCampaignsView /></ProtectedRoute>} />
        <Route path="village-progress" element={<ProtectedRoute requiredPermission="coop.monitor"><CoopVillageProgressView /></ProtectedRoute>} />
        <Route path="maps" element={<ProtectedRoute requiredPermission="map.view"><CoopMapsView /></ProtectedRoute>} />
        <Route path="map" element={<Navigate to="/coop/maps" replace />} />
        <Route path="camps" element={<ProtectedRoute requiredPermission="coop.schedules.create"><CoopCampsView /></ProtectedRoute>} />
        <Route path="surveillance" element={<ProtectedRoute requiredPermission="reports.analytics.disease"><CoopSurveillanceView /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute requiredPermission="reports.village"><CoopReportsView /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute requiredPermission="reports.village"><InferenceAnalyticsDashboard /></ProtectedRoute>} />
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
        <Route path="campaigns" element={<ProtectedRoute requiredPermission="campaign.configure"><AdminCampaignsView /></ProtectedRoute>} />
        <Route path="masters" element={<ProtectedRoute requiredPermission="system.settings.manage"><AdminMasterManagementView /></ProtectedRoute>} />
        <Route path="map" element={<ProtectedRoute requiredPermission="map.view"><AdminStateMapView /></ProtectedRoute>} />
        <Route path="geography" element={<ProtectedRoute requiredPermission="geo.state.manage"><AdminGeographyView /></ProtectedRoute>} />
        <Route path="daho" element={<ProtectedRoute requiredPermission="user.daho.create"><AdminDahoView /></ProtectedRoute>} />
        <Route path="assignments" element={<ProtectedRoute requiredPermission="user.role.assign"><AdminAssignmentsView /></ProtectedRoute>} />
        <Route path="oversight" element={<ProtectedRoute requiredPermission="reports.district"><AdminOperationalOversightView /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute requiredPermission="reports.district"><InferenceAnalyticsDashboard /></ProtectedRoute>} />
        <Route path="rbac" element={<ProtectedRoute requiredPermission="system.roles.manage"><AdminRbacView /></ProtectedRoute>} />
        <Route path="roles" element={<ProtectedRoute requiredPermission="system.roles.manage"><AdminRbacView /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute requiredPermission="user.staff.manage"><AdminUsersView /></ProtectedRoute>} />
        <Route path="devices" element={<ProtectedRoute requiredPermission="system.settings.manage"><AdminDevicesView /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute requiredPermission="system.logs.view"><AdminAuditLogsView /></ProtectedRoute>} />
        <Route path="system-health" element={<ProtectedRoute requiredPermission="system.settings.manage"><AdminSystemHealthView /></ProtectedRoute>} />
        <Route path="notifications" element={<NotificationsView />} />
        <Route path="profile" element={<AdminProfileView />} />
      </Route>

      {/* Wildcard / Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
