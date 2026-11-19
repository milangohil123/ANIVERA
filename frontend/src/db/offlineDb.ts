/**
 * PashuRakshak Botad — Offline IndexedDB Schema using Dexie.js.
 *
 * Implements TRD §5.1-§5.3 & PRD requirements:
 * - Local-first event queue with stable client-generated UUIDs.
 * - Local state tracking: PENDING_SYNC, SYNCING, SYNCED, SYNC_FAILED, NEEDS_REVIEW.
 * - Offline grant storage with 7-day validity tracking.
 * - Queue invariant: Pending rows are NEVER deleted on failed sync or session logout.
 */
import Dexie, { type Table } from 'dexie';

export type QueuedEventState = 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'SYNC_FAILED' | 'NEEDS_REVIEW';

export type QueuedMediaState =
  | 'PENDING_REPORT_SYNC'
  | 'READY_FOR_UPLOAD'
  | 'UPLOADING'
  | 'SYNCED'
  | 'FAILED'
  | 'REJECTED_PARENT';

export interface QueuedMedia {
  mediaId: string; // crypto.randomUUID()
  parentEventId: string; // ID of the local QueuedEvent (e.g. disease report eventId)
  parentReportId?: string; // Resolved confirmed server report_id
  blob: Blob; // Raw image binary data
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  clientCreatedAt: string;
  state: QueuedMediaState;
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  serverAttachmentId?: string;
  lastError?: string;
}

export type QueuedEventType =
  | 'FARMER_REGISTRATION'
  | 'ANIMAL_REGISTRATION'
  | 'VACCINATION'
  | 'TREATMENT'
  | 'OBSERVATION'
  | 'DISEASE_REPORT';

export interface QueuedEvent {
  eventId: string; // Client-generated UUID (crypto.randomUUID()); stable idempotency key
  ownerUserId: string; // User ID who created the record
  deviceId: string; // Bound client device UUID
  type: QueuedEventType;
  payload: Record<string, unknown>; // Preserved original form values
  clientCreatedAt: string; // ISO 8601 device timestamp
  schemaVersion: number;
  state: QueuedEventState;
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  serverAck?: {
    status: string;
    code?: string;
    errors?: Array<{ field?: string; message: string; code?: string }>;
    conflictId?: string;
    serverTime?: string;
  };
}

export interface CachedVillage {
  id: string;
  code: string;
  nameGu: string;
  nameEn: string;
  talukaId: string;
  districtId?: string;
  latitude?: number;
  longitude?: number;
  userId: string;
  cachedAt: string;
}

export interface CachedFarmer {
  id: string;
  villageId: string;
  fullName: string;
  nameNorm?: string;
  mobileE164?: string;
  mobileStatus?: string;
  farmerCode?: string;
  registrationStatus?: string;
  userId: string;
  cachedAt: string;
}

export interface CachedAnimal {
  id: string;
  animalCode?: string;
  speciesCode: string;
  breedId?: string;
  sex?: string;
  birthDate?: string;
  ageMonthsEstimate?: number;
  farmerId: string;
  villageId: string;
  registrationStatus?: string;
  status: string;
  tag12?: string;
  userId: string;
  cachedAt: string;
}

export interface CachedQrToken {
  token: string;
  animalId: string;
  status: string;
  userId: string;
  cachedAt: string;
}

export interface CachedSpecies {
  code: string;
  nameGu: string;
  nameEn: string;
}

export interface CachedProgramme {
  code: string;
  nameEn: string;
}

export interface ReferenceSyncMeta {
  userId: string;
  lastSyncAt: string;
  serverTime: string;
  offlineValidDays: number;
  permissions: string[];
}

export interface OfflineMeta {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface QueuedLocation {
  id: string; // crypto.randomUUID()
  userId: string;
  sessionId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
  recordedAt: string;
  synced: boolean;
}

export interface PashuRakshakOfflineDB extends Dexie {}

export class PashuRakshakOfflineDB extends Dexie {
  queued_events!: Table<QueuedEvent, string>;
  queued_media!: Table<QueuedMedia, string>;
  queued_locations!: Table<QueuedLocation, string>;
  cached_villages!: Table<CachedVillage, string>;
  cached_farmers!: Table<CachedFarmer, string>;
  cached_animals!: Table<CachedAnimal, string>;
  cached_qr_tokens!: Table<CachedQrToken, string>;
  cached_species!: Table<CachedSpecies, string>;
  cached_programmes!: Table<CachedProgramme, string>;
  reference_sync_meta!: Table<ReferenceSyncMeta, string>;
  offline_meta!: Table<OfflineMeta, string>;

  constructor() {
    super('PashuRakshakBotadOfflineDB');

    this.version(1).stores({
      queued_events: 'eventId, ownerUserId, deviceId, type, state, clientCreatedAt, nextRetryAt',
      cached_farmers: 'id, villageId, fullName, mobileE164',
      cached_animals: 'id, animalCode, speciesCode, farmerId, villageId',
      offline_meta: 'key',
    });

    this.version(2).stores({
      queued_events: 'eventId, ownerUserId, deviceId, type, state, clientCreatedAt, nextRetryAt',
      queued_media: 'mediaId, parentEventId, parentReportId, state, clientCreatedAt, nextRetryAt',
      cached_farmers: 'id, villageId, fullName, mobileE164',
      cached_animals: 'id, animalCode, speciesCode, farmerId, villageId',
      offline_meta: 'key',
    });

    this.version(3).stores({
      queued_events: 'eventId, ownerUserId, deviceId, type, state, clientCreatedAt, nextRetryAt',
      queued_media: 'mediaId, parentEventId, parentReportId, state, clientCreatedAt, nextRetryAt',
      cached_villages: 'id, [userId+id], userId, talukaId',
      cached_farmers: 'id, [userId+id], userId, villageId, fullName, mobileE164, farmerCode',
      cached_animals: 'id, [userId+id], userId, animalCode, speciesCode, farmerId, villageId, tag12',
      cached_qr_tokens: 'token, [userId+token], userId, animalId',
      cached_species: 'code',
      cached_programmes: 'code',
      reference_sync_meta: 'userId',
      offline_meta: 'key',
    });

    this.version(4).stores({
      queued_events: 'eventId, ownerUserId, deviceId, type, state, clientCreatedAt, nextRetryAt',
      queued_media: 'mediaId, parentEventId, parentReportId, state, clientCreatedAt, nextRetryAt',
      queued_locations: 'id, userId, recordedAt, synced',
      cached_villages: 'id, [userId+id], userId, talukaId',
      cached_farmers: 'id, [userId+id], userId, villageId, fullName, mobileE164, farmerCode',
      cached_animals: 'id, [userId+id], userId, animalCode, speciesCode, farmerId, villageId, tag12',
      cached_qr_tokens: 'token, [userId+token], userId, animalId',
      cached_species: 'code',
      cached_programmes: 'code',
      reference_sync_meta: 'userId',
      offline_meta: 'key',
    });
  }
}

export const offlineDb = new PashuRakshakOfflineDB();

