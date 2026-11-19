import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../services/authService';
import { offlineDb } from '../db/offlineDb';

describe('Auth Offline Invariant & 401 Handling', () => {
  beforeEach(async () => {
    localStorage.clear();
    await offlineDb.queued_events.clear();
    await offlineDb.queued_media.clear();
  });

  it('preserves queued offline events and media when auth session is cleared or logged out', async () => {
    // 1. Seed an offline queued event in Dexie
    const testEventId = 'test-offline-event-123';
    await offlineDb.queued_events.add({
      eventId: testEventId,
      ownerUserId: 'u-fw-01',
      deviceId: 'dev-01',
      type: 'DISEASE_REPORT',
      clientCreatedAt: new Date().toISOString(),
      schemaVersion: 1,
      state: 'PENDING_SYNC',
      attempts: 0,
      payload: { disease_code: 'FMD', village_id: 'test-v-01' },
    });

    // 2. Seed an offline queued media item in Dexie
    const testMediaId = 'test-offline-media-456';
    await offlineDb.queued_media.add({
      mediaId: testMediaId,
      parentEventId: testEventId,
      blob: new Blob(['fake image data'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      sizeBytes: 15,
      sha256: 'abc123hash',
      clientCreatedAt: new Date().toISOString(),
      state: 'PENDING_REPORT_SYNC',
      attempts: 0,
    });

    // Verify Dexie has items
    expect(await offlineDb.queued_events.count()).toBe(1);
    expect(await offlineDb.queued_media.count()).toBe(1);

    // 3. Perform logout
    await authService.logout('http://127.0.0.1:8000');

    // 4. Verify invariant: Dexie data MUST remain completely untouched
    expect(await offlineDb.queued_events.count()).toBe(1);
    expect(await offlineDb.queued_media.count()).toBe(1);

    const savedEvent = await offlineDb.queued_events.get(testEventId);
    expect(savedEvent).toBeDefined();
    expect(savedEvent?.eventId).toBe(testEventId);
    expect(savedEvent?.state).toBe('PENDING_SYNC');

    const savedMedia = await offlineDb.queued_media.get(testMediaId);
    expect(savedMedia).toBeDefined();
    expect(savedMedia?.mediaId).toBe(testMediaId);
    expect(savedMedia?.state).toBe('PENDING_REPORT_SYNC');
  });
});

