/**
 * React hook for live offline synchronisation telemetry and manual triggers.
 *
 * Utilizes dexie-react-hooks (useLiveQuery) to provide real-time counts of:
 * - pendingCount (PENDING_SYNC)
 * - syncingCount (SYNCING)
 * - failedCount (SYNC_FAILED)
 * - needsReviewCount (NEEDS_REVIEW)
 * - syncedCount (SYNCED)
 */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '../db/offlineDb';
import { syncController, type DeviceInfo } from '../services/syncController';

export interface UseSyncQueueResult {
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  needsReviewCount: number;
  syncedCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  isOfflineGrantValid: boolean;
  triggerSyncNow: () => Promise<void>;
  errorMessage: string | null;
}

export function useSyncQueue(
  apiBaseUrl: string,
  authToken: string,
  deviceInfo: DeviceInfo
): UseSyncQueueResult {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGrantValid, setIsGrantValid] = useState<boolean>(true);

  // Live queries on Dexie tables
  const pendingCount = useLiveQuery(
    () => offlineDb.queued_events.where('state').equals('PENDING_SYNC').count(),
    [],
    0
  );

  const syncingCount = useLiveQuery(
    () => offlineDb.queued_events.where('state').equals('SYNCING').count(),
    [],
    0
  );

  const failedCount = useLiveQuery(
    () => offlineDb.queued_events.where('state').equals('SYNC_FAILED').count(),
    [],
    0
  );

  const needsReviewCount = useLiveQuery(
    () => offlineDb.queued_events.where('state').equals('NEEDS_REVIEW').count(),
    [],
    0
  );

  const syncedCount = useLiveQuery(
    () => offlineDb.queued_events.where('state').equals('SYNCED').count(),
    [],
    0
  );

  // Monitor connectivity status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger debounced sync when network returns
      triggerSyncNow();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [authToken, deviceInfo.deviceId]);

  // Check grant validity
  useEffect(() => {
    syncController.isOfflineGrantValid(deviceInfo).then(setIsGrantValid);
  }, [deviceInfo.offlineValidUntil]);

  const triggerSyncNow = async () => {
    if (!navigator.onLine || !authToken) return;

    setErrorMessage(null);
    setIsSyncing(true);
    try {
      await syncController.syncQueue(apiBaseUrl, authToken, deviceInfo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown synchronisation error';
      setErrorMessage(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    pendingCount,
    syncingCount,
    failedCount,
    needsReviewCount,
    syncedCount,
    isOnline,
    isSyncing,
    isOfflineGrantValid: isGrantValid,
    triggerSyncNow,
    errorMessage,
  };
}

