import React from 'react';
import { WebSidebarLayout } from './WebSidebarLayout';
import { useAuth } from '../context/AuthContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import {
  DAHO_NAV_ITEMS,
  TAHO_NAV_ITEMS,
  VO_NAV_ITEMS,
  FW_NAV_ITEMS,
  FARMER_NAV_ITEMS,
  COOP_NAV_ITEMS,
  ADMIN_NAV_ITEMS,
} from '../constants/navConfig';

export const DahoLayoutWrapper: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const syncStatus = useSyncStatus(apiBaseUrl);

  return (
    <WebSidebarLayout
      navItems={DAHO_NAV_ITEMS}
      isOnline={syncStatus.isOnline}
      isSyncing={syncStatus.isSyncing}
      pendingCount={syncStatus.pendingCount}
      failedCount={syncStatus.failedCount}
      onTriggerSync={syncStatus.triggerSync}
    />
  );
};

export const TahoLayoutWrapper: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const syncStatus = useSyncStatus(apiBaseUrl);

  return (
    <WebSidebarLayout
      navItems={TAHO_NAV_ITEMS}
      isOnline={syncStatus.isOnline}
      isSyncing={syncStatus.isSyncing}
      pendingCount={syncStatus.pendingCount}
      failedCount={syncStatus.failedCount}
      onTriggerSync={syncStatus.triggerSync}
    />
  );
};

export const VoLayoutWrapper: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const syncStatus = useSyncStatus(apiBaseUrl);

  return (
    <WebSidebarLayout
      navItems={VO_NAV_ITEMS}
      isOnline={syncStatus.isOnline}
      isSyncing={syncStatus.isSyncing}
      pendingCount={syncStatus.pendingCount}
      failedCount={syncStatus.failedCount}
      onTriggerSync={syncStatus.triggerSync}
    />
  );
};

export const FwLayoutWrapper: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const syncStatus = useSyncStatus(apiBaseUrl);

  return (
    <WebSidebarLayout
      navItems={FW_NAV_ITEMS}
      isOnline={syncStatus.isOnline}
      isSyncing={syncStatus.isSyncing}
      pendingCount={syncStatus.pendingCount}
      failedCount={syncStatus.failedCount}
      onTriggerSync={syncStatus.triggerSync}
    />
  );
};

export const FarmerLayoutWrapper: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const syncStatus = useSyncStatus(apiBaseUrl);

  return (
    <WebSidebarLayout
      navItems={FARMER_NAV_ITEMS}
      isOnline={syncStatus.isOnline}
      isSyncing={syncStatus.isSyncing}
      pendingCount={syncStatus.pendingCount}
      failedCount={syncStatus.failedCount}
      onTriggerSync={syncStatus.triggerSync}
    />
  );
};

export const CoopLayoutWrapper: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const syncStatus = useSyncStatus(apiBaseUrl);

  return (
    <WebSidebarLayout
      navItems={COOP_NAV_ITEMS}
      isOnline={syncStatus.isOnline}
      isSyncing={syncStatus.isSyncing}
      pendingCount={syncStatus.pendingCount}
      failedCount={syncStatus.failedCount}
      onTriggerSync={syncStatus.triggerSync}
    />
  );
};

export const AdminLayoutWrapper: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const syncStatus = useSyncStatus(apiBaseUrl);

  return (
    <WebSidebarLayout
      navItems={ADMIN_NAV_ITEMS}
      isOnline={syncStatus.isOnline}
      isSyncing={syncStatus.isSyncing}
      pendingCount={syncStatus.pendingCount}
      failedCount={syncStatus.failedCount}
      onTriggerSync={syncStatus.triggerSync}
    />
  );
};
