import { useEffect, useState } from 'react';
import { networkSyncManager } from '../services/networkSyncManager';

export function useSyncStatus(apiBaseUrl: string) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCounts, setPendingCounts] = useState({
    pendingEvents: 0,
    pendingMedia: 0,
    failedEvents: 0,
    failedMedia: 0,
  });

  const refreshCounts = async () => {
    try {
      const counts = await networkSyncManager.getPendingCounts();
      setPendingCounts(counts);
    } catch (e) {
      console.warn('Failed to refresh pending counts:', e);
    }
  };

  useEffect(() => {
    networkSyncManager.initAutoSync(() => apiBaseUrl);

    const handleOnline = () => {
      setIsOnline(true);
      refreshCounts();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshCounts();
    const interval = setInterval(refreshCounts, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [apiBaseUrl]);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await networkSyncManager.triggerSync(apiBaseUrl);
      await refreshCounts();
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    isSyncing,
    pendingCount: pendingCounts.pendingEvents + pendingCounts.pendingMedia,
    failedCount: pendingCounts.failedEvents + pendingCounts.failedMedia,
    pendingCounts,
    triggerSync,
    refreshCounts,
  };
}

