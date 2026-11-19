/**
 * PashuRakshak Botad — Offline Media Synchronization Controller.
 *
 * Implements Step 8.2 media synchronization:
 * - Decoupled from /api/v1/sync/push (binary media uploaded strictly via dedicated multipart requests).
 * - Phase 1: Unlocks media only after parent disease report is confirmed 'SYNCED' with server receipt.
 * - Phase 2: Active probe verification (GET /disease-reports/{id}) before sending binary payload.
 * - Concurrency & Duplicate handling: Treats both HTTP 201 (Created) and HTTP 200 (Already Existed) as successful sync.
 * - Zero Silent Drops: Pending media blobs remain in IndexedDB indefinitely until confirmed persisted.
 */
import { offlineDb, type QueuedMedia } from '../db/offlineDb';

export class MediaSyncController {
  private isProcessing = false;
  private readonly RETRY_INTERVALS_SEC = [5, 15, 45, 120, 300, 900]; // 5s -> 15m max

  /**
   * Main media sync loop: Reconcile parent report state, then upload ready media.
   */
  async processMediaQueue(apiBaseUrl: string, authToken: string): Promise<{
    reconciledCount: number;
    uploadedCount: number;
    failedCount: number;
  }> {
    if (this.isProcessing) {
      return { reconciledCount: 0, uploadedCount: 0, failedCount: 0 };
    }

    this.isProcessing = true;
    let reconciledCount = 0;
    let uploadedCount = 0;
    let failedCount = 0;

    try {
      // Phase 1: Reconcile media waiting for parent report sync
      reconciledCount = await this.reconcilePendingReports();

      // Phase 2: Upload all ready media items
      const uploadResults = await this.uploadReadyMedia(apiBaseUrl, authToken);
      uploadedCount = uploadResults.uploaded;
      failedCount = uploadResults.failed;
    } finally {
      this.isProcessing = false;
    }

    return { reconciledCount, uploadedCount, failedCount };
  }

  /**
   * Check local queued_events for parent disease report synchronization status.
   */
  private async reconcilePendingReports(): Promise<number> {
    const pendingMedia = await offlineDb.queued_media
      .where('state')
      .anyOf('PENDING_REPORT_SYNC', 'REJECTED_PARENT')
      .toArray();

    let reconciled = 0;

    for (const media of pendingMedia) {
      const parentEvent = await offlineDb.queued_events.get(media.parentEventId);

      if (!parentEvent) {
        continue;
      }

      // Check if parent event successfully synced and accepted by server
      if (parentEvent.state === 'SYNCED') {
        const status = parentEvent.serverAck?.status;
        if (status === 'ACCEPTED' || status === 'ALREADY_ACCEPTED') {
          // Resolved server report ID is identical to the client event UUID (verified by schema rule S3)
          await offlineDb.queued_media.update(media.mediaId, {
            parentReportId: parentEvent.eventId,
            state: 'READY_FOR_UPLOAD',
            attempts: 0,
            lastError: undefined,
          });
          reconciled++;
        }
      } else if (parentEvent.state === 'PENDING_SYNC' || parentEvent.state === 'SYNCING') {
        // Parent report is being retried or waiting for sync
        if (media.state !== 'PENDING_REPORT_SYNC') {
          await offlineDb.queued_media.update(media.mediaId, {
            state: 'PENDING_REPORT_SYNC',
            lastError: undefined,
          });
        }
      } else if (parentEvent.state === 'SYNC_FAILED') {
        // Parent report was rejected by server; do NOT upload media
        await offlineDb.queued_media.update(media.mediaId, {
          state: 'REJECTED_PARENT',
          lastError: `Parent report rejected: ${parentEvent.serverAck?.code || 'REJECTED'}`,
        });
      }
    }

    return reconciled;
  }

  /**
   * Upload all media items currently in 'READY_FOR_UPLOAD' state.
   */
  private async uploadReadyMedia(
    apiBaseUrl: string,
    authToken: string
  ): Promise<{ uploaded: number; failed: number }> {
    const nowIso = new Date().toISOString();
    const readyItems = await offlineDb.queued_media
      .where('state')
      .equals('READY_FOR_UPLOAD')
      .toArray();

    // Filter items respecting retry backoff
    const eligibleItems = readyItems.filter(
      (m: QueuedMedia) => !m.nextRetryAt || m.nextRetryAt <= nowIso
    );

    let uploaded = 0;
    let failed = 0;

    for (const media of eligibleItems) {
      if (!media.parentReportId) {
        continue;
      }

      try {
        // Step A: Probe check to ensure parent report actively exists on server
        const probeRes = await fetch(
          `${apiBaseUrl}/api/v1/disease-reports/${media.parentReportId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (probeRes.status === 404) {
          // Parent report does not exist on server
          await offlineDb.queued_media.update(media.mediaId, {
            state: 'FAILED',
            lastError: 'Parent disease report not found on server (HTTP 404)',
          });
          failed++;
          continue;
        }

        if (!probeRes.ok) {
          throw new Error(`Probe check failed: HTTP ${probeRes.status}`);
        }

        // Step B: Multipart binary upload
        const formData = new FormData();
        formData.append('file', media.blob, `${media.mediaId}.jpg`);

        const uploadRes = await fetch(
          `${apiBaseUrl}/api/v1/disease-reports/${media.parentReportId}/attachments`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            body: formData,
          }
        );

        if (uploadRes.status === 201 || uploadRes.status === 200) {
          // Both 201 Created (new) and 200 OK (idempotent replay) confirm persistence
          const data = await uploadRes.json();
          await offlineDb.queued_media.update(media.mediaId, {
            state: 'SYNCED',
            serverAttachmentId: data.id,
            attempts: media.attempts + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: undefined,
          });
          uploaded++;
        } else {
          throw new Error(`HTTP ${uploadRes.status}: ${await uploadRes.text()}`);
        }
      } catch (err) {
        failed++;
        const nextAttempt = media.attempts + 1;
        const delaySec =
          this.RETRY_INTERVALS_SEC[
          Math.min(media.attempts, this.RETRY_INTERVALS_SEC.length - 1)
          ];
        const nextRetry = new Date(Date.now() + delaySec * 1000).toISOString();

        await offlineDb.queued_media.update(media.mediaId, {
          attempts: nextAttempt,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: nextRetry,
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { uploaded, failed };
  }
}

export const mediaSyncController = new MediaSyncController();

