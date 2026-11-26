/**
 * PashuRakshak Botad — Offline Synchronisation Controller.
 *
 * Implements TRD §6.1-§6.7:
 * - Queueing offline records with client-generated UUIDs.
 * - Server offline grant validity enforcement (7-day rule).
 * - Automatic & manual synchronization triggers.
 * - Bounded exponential backoff retry (5s, 15s, 45s, 2m, 5m, max 15m).
 * - Per-record acknowledgment processing:
 *   - ACCEPTED / ALREADY_ACCEPTED -> state 'SYNCED'
 *   - REJECTED -> state 'SYNC_FAILED' (preserves original payload)
 *   - NEEDS_REVIEW / HELD_FOR_REVIEW -> state 'NEEDS_REVIEW' (preserves payload and conflict ID)
 * - Network failure handling: returns to 'PENDING_SYNC', never deletes data.
 */
import { offlineDb, type QueuedEvent, type QueuedEventType } from '../db/offlineDb';
import { mediaSyncController } from './mediaSyncController';
import { authService } from './authService';
import { generateUUID } from '../utils/uuid';
import { apiCache } from '../utils/apiCache';

export interface DeviceInfo {
  deviceId: string;
  userId: string;
  offlineValidUntil?: string;
  offlineGrant?: string;
}

export interface SyncAckItem {
  eventId: string;
  status: 'ACCEPTED' | 'ALREADY_ACCEPTED' | 'REJECTED' | 'NEEDS_REVIEW' | 'HELD_FOR_REVIEW';
  code?: string;
  errors?: Array<{ field?: string; message: string; code?: string }>;
  conflictId?: string;
  serverEventSeq?: number;
}

export interface SyncPushApiResponse {
  batchId: string;
  serverTime: string;
  totalReceived: number;
  acceptedCount: number;
  alreadyAcceptedCount: number;
  rejectedCount: number;
  needsReviewCount: number;
  results: SyncAckItem[];
}

export class SyncController {
  private isSyncing = false;
  private readonly RETRY_INTERVALS_SEC = [5, 15, 45, 120, 300, 900]; // 5s -> 15m max

  /**
   * Enqueue a new event created offline in the field.
   */
  async enqueueEvent(
    type: QueuedEventType,
    payload: Record<string, unknown>,
    deviceInfo: DeviceInfo
  ): Promise<string> {
    const eventId = generateUUID();
    const nowIso = new Date().toISOString();

    const event: QueuedEvent = {
      eventId,
      ownerUserId: deviceInfo.userId,
      deviceId: deviceInfo.deviceId,
      type,
      payload,
      clientCreatedAt: nowIso,
      schemaVersion: 1,
      state: 'PENDING_SYNC',
      attempts: 0,
    };

    await offlineDb.queued_events.add(event);
    return eventId;
  }

  /**
   * Update the payload of an existing queued event (e.g. to fix validation errors)
   * and reset it to PENDING_SYNC for retry, preserving the eventId and any linked photos.
   */
  async updateAndRetryEvent(
    eventId: string,
    updatedPayload: Record<string, unknown>
  ): Promise<void> {
    await offlineDb.queued_events.update(eventId, {
      payload: updatedPayload,
      state: 'PENDING_SYNC',
      attempts: 0,
      nextRetryAt: undefined,
      serverAck: undefined,
    });

    // Reconcile and reset any child media from REJECTED_PARENT to PENDING_REPORT_SYNC
    const mediaItems = await offlineDb.queued_media
      .where('parentEventId')
      .equals(eventId)
      .toArray();

    for (const m of mediaItems) {
      if (m.state === 'REJECTED_PARENT') {
        await offlineDb.queued_media.update(m.mediaId, {
          state: 'PENDING_REPORT_SYNC',
          lastError: undefined,
        });
      }
    }
  }

  /**
   * Request and persist a fresh 7-day server offline authorization grant.
   */
  async requestOfflineGrant(
    apiBaseUrl: string,
    authToken: string,
    deviceId: string,
    label?: string
  ): Promise<{ offlineGrant: string; expiresAt: string }> {
    const res = await fetch(`${apiBaseUrl}/api/v1/sync/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        deviceId,
        label: label || navigator.userAgent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to obtain offline grant: HTTP ${res.status} ${errText}`);
    }

    const data = await res.json();
    await offlineDb.offline_meta.put({
      key: 'offline_grant_data',
      value: {
        offlineGrant: data.offlineGrant,
        expiresAt: data.expiresAt,
        deviceId: data.deviceId,
        userId: data.userId,
      },
      updatedAt: new Date().toISOString(),
    });

    return {
      offlineGrant: data.offlineGrant,
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Check whether offline grant validity has lapsed (7-day rule).
   */
  async isOfflineGrantValid(deviceInfo: DeviceInfo): Promise<boolean> {
    if (!deviceInfo.offlineValidUntil) {
      return false;
    }
    const expiry = new Date(deviceInfo.offlineValidUntil).getTime();
    return Date.now() < expiry;
  }

  /**
   * Synchronise all pending or retryable events with the backend.
   */
  async syncQueue(
    apiBaseUrl: string,
    authToken: string,
    deviceInfo: DeviceInfo
  ): Promise<SyncPushApiResponse | null> {
    if (this.isSyncing) {
      return null;
    }

    // Verify offline grant or dynamically refresh if user has valid online token
    const isValidGrant = await this.isOfflineGrantValid(deviceInfo);
    if (!isValidGrant) {
      if (!authToken || authToken === 'mock-bearer-token-for-dev') {
        throw new Error(
          'Offline authorization grant has expired. Online re-authentication is required before synchronisation.'
        );
      }
      try {
        const freshGrant = await this.requestOfflineGrant(apiBaseUrl, authToken, deviceInfo.deviceId);
        deviceInfo.offlineGrant = freshGrant.offlineGrantToken;
        deviceInfo.offlineValidUntil = freshGrant.validUntil;
      } catch (grantErr) {
        console.warn('Could not acquire offline grant token; proceeding with authenticated token:', grantErr);
      }
    }

    this.isSyncing = true;
    try {
      // 1. Fetch pending items (max 50 events per batch)
      const pendingEvents = await offlineDb.queued_events
        .where('state')
        .anyOf('PENDING_SYNC', 'SYNC_FAILED')
        .filter((e: QueuedEvent) => {
          if (!e.nextRetryAt) return true;
          return new Date(e.nextRetryAt).getTime() <= Date.now();
        })
        .sortBy('clientCreatedAt');

      if (pendingEvents.length === 0) {
        return null;
      }

      const batch = pendingEvents.slice(0, 50);
      const batchIds = batch.map((e: QueuedEvent) => e.eventId);

      // 2. Mark local records as SYNCING
      await offlineDb.queued_events.where('eventId').anyOf(batchIds).modify({
        state: 'SYNCING',
        lastAttemptAt: new Date().toISOString(),
      });

      // 3. Dispatch batch to FastAPI backend
      const requestPayload = {
        deviceId: deviceInfo.deviceId,
        clientTime: new Date().toISOString(),
        offlineGrant: deviceInfo.offlineGrant,
        events: batch.map((e: QueuedEvent) => ({
          eventId: e.eventId,
          type: e.type,
          clientCreatedAt: e.clientCreatedAt,
          schemaVersion: e.schemaVersion,
          payload: e.payload,
        })),
      };

      let response: Response;
      let effectiveToken = authToken;

      try {
        response = await fetch(`${apiBaseUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveToken}`,
          },
          body: JSON.stringify(requestPayload),
        });

        // If access token expired (HTTP 401), attempt proactive refresh once
        if (response.status === 401) {
          try {
            const freshToken = await authService.getValidAccessToken(apiBaseUrl);
            if (freshToken && freshToken !== effectiveToken) {
              effectiveToken = freshToken;
              response = await fetch(`${apiBaseUrl}/api/v1/sync/push`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${effectiveToken}`,
                },
                body: JSON.stringify(requestPayload),
              });
            }
          } catch (refreshErr) {
            console.warn('Proactive token refresh during sync failed:', refreshErr);
          }
        }
      } catch (networkError) {
        // Network timeout / connection error -> rollback to PENDING_SYNC with backoff
        await this.handleNetworkFailure(batch);
        throw networkError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        await this.handleNetworkFailure(batch);
        if (response.status === 401) {
          throw new Error('Authentication required: Access token is invalid or expired. Please log in.');
        }
        throw new Error(`Sync failed with HTTP ${response.status}: ${errorText}`);
      }

      const syncResult: SyncPushApiResponse = await response.json();

      // 4. Update individual event records based on per-record acks
      await this.applyServerAcknowledgements(syncResult.results);

      // Invalidate frontend cache and notify application of fresh data synchronization
      apiCache.invalidate();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pashurakshak_data_synced', { detail: syncResult }));
      }

      // 5. Trigger media sync controller now that parent reports are confirmed SYNCED
      try {
        await mediaSyncController.processMediaQueue(apiBaseUrl, effectiveToken);
      } catch (mediaErr) {
        console.warn('Post-sync media queue processing encountered an error:', mediaErr);
      }

      return syncResult;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Apply server per-record acknowledgements without deleting pending unacknowledged records.
   */
  private async applyServerAcknowledgements(acks: SyncAckItem[]): Promise<void> {
    for (const ack of acks) {
      const event = await offlineDb.queued_events.get(ack.eventId);
      if (!event) continue;

      if (ack.status === 'ACCEPTED' || ack.status === 'ALREADY_ACCEPTED') {
        await offlineDb.queued_events.update(ack.eventId, {
          state: 'SYNCED',
          serverAck: {
            status: ack.status,
            code: ack.code,
          },
        });
      } else if (ack.status === 'REJECTED') {
        await offlineDb.queued_events.update(ack.eventId, {
          state: 'SYNC_FAILED',
          serverAck: {
            status: 'REJECTED',
            code: ack.code,
            errors: ack.errors,
          },
        });
      } else if (ack.status === 'NEEDS_REVIEW' || ack.status === 'HELD_FOR_REVIEW') {
        await offlineDb.queued_events.update(ack.eventId, {
          state: 'NEEDS_REVIEW',
          serverAck: {
            status: ack.status,
            code: ack.code,
            conflictId: ack.conflictId,
            errors: ack.errors,
          },
        });
      }
    }
  }

  /**
   * Handle transient network failure: compute exponential backoff, NEVER delete records.
   */
  private async handleNetworkFailure(batch: QueuedEvent[]): Promise<void> {
    const now = Date.now();
    for (const event of batch) {
      const nextAttempt = event.attempts + 1;
      const intervalSec =
        this.RETRY_INTERVALS_SEC[Math.min(nextAttempt, this.RETRY_INTERVALS_SEC.length - 1)];
      const nextRetryAt = new Date(now + intervalSec * 1000).toISOString();

      await offlineDb.queued_events.update(event.eventId, {
        state: 'PENDING_SYNC',
        attempts: nextAttempt,
        nextRetryAt,
      });
    }
  }

  /**
   * Prune only records marked SYNCED after confirmation.
   */
  async pruneSyncedEvents(olderThanDays = 3): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86400 * 1000).toISOString();
    const syncedIds = await offlineDb.queued_events
      .where('state')
      .equals('SYNCED')
      .filter((e: QueuedEvent) => e.clientCreatedAt < cutoff)
      .primaryKeys();

    await offlineDb.queued_events.bulkDelete(syncedIds);
    return syncedIds.length;
  }
}

export const syncController = new SyncController();

