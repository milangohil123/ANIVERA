/**
 * PashuRakshak Botad — Global Network & Sync Lifecycle Manager.
 *
 * Implements Step 8.1 & 8.2 synchronization authentication lifecycle:
 * - Listens for window 'online' reconnection events.
 * - Coordinates two-phase sync: Domain events (syncController) -> Media binaries (mediaSyncController).
 * - Dynamically acquires valid, non-expired access tokens via authService.
 * - Gracefully handles HTTP 401 unauthenticated states without discarding local Dexie events or photos.
 * - Avoids concurrent duplicate executions via atomic processing guard.
 */
import { syncController, type DeviceInfo, type SyncPushApiResponse } from './syncController';
import { mediaSyncController } from './mediaSyncController';
import { offlineDb } from '../db/offlineDb';
import { authService } from './authService';

export class NetworkSyncManager {
  private isSyncing = false;
  private isOnlineListenerAttached = false;

  /**
   * Initialize online event listener if running in browser window.
   */
  initAutoSync(getApiBaseUrl: () => string): void {
    if (typeof window === 'undefined' || this.isOnlineListenerAttached) {
      return;
    }

    window.addEventListener('online', async () => {
      const apiBaseUrl = getApiBaseUrl();
      const session = authService.getSession();
      if (!session) {
        console.warn('Network reconnected but no user is currently authenticated. Sync deferred.');
        return;
      }

      const validToken = await authService.getValidAccessToken(apiBaseUrl);
      if (validToken) {
        const deviceInfo: DeviceInfo = {
          deviceId: session.deviceId,
          userId: session.user.id,
          offlineValidUntil: session.offlineValidUntil,
          offlineGrant: session.offlineGrant,
        };

        this.triggerFullSync(apiBaseUrl, validToken, deviceInfo).catch((err) => {
          console.warn('Automatic online sync trigger encountered an issue:', err);
        });
      }
    });

    this.isOnlineListenerAttached = true;
  }

  /**
   * Convenience manual trigger using active auth session.
   */
  async triggerSync(apiBaseUrl: string): Promise<{
    eventResult: SyncPushApiResponse | null;
    mediaResult: { reconciledCount: number; uploadedCount: number; failedCount: number };
  } | null> {
    const session = authService.getSession();
    if (!session) {
      throw new Error('સિંક કરવા માટે કૃપા કરીને પહેલાં લોગિન કરો.');
    }
    const token = await authService.getValidAccessToken(apiBaseUrl);
    if (!token) {
      throw new Error('માન્ય ઓથેન્ટિકેશન ટોકન ઉપલબ્ધ નથી.');
    }
    const deviceInfo: DeviceInfo = {
      deviceId: session.deviceId,
      userId: session.user.id,
      offlineValidUntil: session.offlineValidUntil,
      offlineGrant: session.offlineGrant,
    };
    return this.triggerFullSync(apiBaseUrl, token, deviceInfo);
  }

  /**
   * Run full two-phase sync with valid authenticated credentials:
   * Phase 1: Push domain events (Disease reports, vaccinations, registrations)
   * Phase 2: Upload confirmed pending media blobs
   */
  async triggerFullSync(
    apiBaseUrl: string,
    authToken: string,
    deviceInfo: DeviceInfo
  ): Promise<{
    eventResult: SyncPushApiResponse | null;
    mediaResult: { reconciledCount: number; uploadedCount: number; failedCount: number };
  }> {
    if (this.isSyncing) {
      return {
        eventResult: null,
        mediaResult: { reconciledCount: 0, uploadedCount: 0, failedCount: 0 },
      };
    }

    // Resolve or refresh access token dynamically
    const validToken = (await authService.getValidAccessToken(apiBaseUrl)) || authToken;
    if (!validToken || validToken === 'mock-bearer-token-for-dev') {
      throw new Error('Authentication required: Please log in with valid credentials before syncing.');
    }

    this.isSyncing = true;
    try {
      // Phase 1: Synchronize queued domain events
      const eventResult = await syncController.syncQueue(apiBaseUrl, validToken, deviceInfo);

      // Phase 2: Synchronize queued media attachments
      const mediaResult = await mediaSyncController.processMediaQueue(apiBaseUrl, validToken);

      return { eventResult, mediaResult };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Count how many pending and rejected/failed items exist in local IndexedDB.
   */
  async getPendingCounts(): Promise<{
    pendingEvents: number;
    pendingMedia: number;
    failedEvents: number;
    failedMedia: number;
  }> {
    const pendingEvents = await offlineDb.queued_events
      .where('state')
      .anyOf('PENDING_SYNC', 'SYNCING')
      .count();

    const failedEvents = await offlineDb.queued_events
      .where('state')
      .equals('SYNC_FAILED')
      .count();

    const pendingMedia = await offlineDb.queued_media
      .where('state')
      .anyOf('PENDING_REPORT_SYNC', 'READY_FOR_UPLOAD', 'UPLOADING')
      .count();

    const failedMedia = await offlineDb.queued_media
      .where('state')
      .anyOf('FAILED', 'REJECTED_PARENT')
      .count();

    return { pendingEvents, pendingMedia, failedEvents, failedMedia };
  }
}

export const networkSyncManager = new NetworkSyncManager();
