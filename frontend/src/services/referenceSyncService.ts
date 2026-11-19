/**
 * PashuRakshak Botad — Offline Authorised Reference-Data Synchronisation Service.
 *
 * Implements Part 6 Step 8.1/8.2:
 * - Scoped read-only reference data synchronization.
 * - Dexie caching tagged strictly by userId (never exposes another user's cached records).
 * - Freshness and stale tracking (>24h stale warning, >7d offline grant expiry).
 * - Queue invariant: Pending unsynced records are NEVER deleted on logout or cache clear.
 * - JSON export of pending records for fail-safe data preservation.
 */
import {
  offlineDb,
  type CachedAnimal,
  type CachedFarmer,
  type CachedProgramme,
  type CachedQrToken,
  type CachedSpecies,
  type CachedVillage,
  type ReferenceSyncMeta,
} from '../db/offlineDb';

export interface ReferenceSyncStatus {
  lastSyncAt: string | null;
  serverTime: string | null;
  isStale: boolean; // > 24 hours
  isExpired: boolean; // > 7 days (offline authorization expired)
  statusTextGu: string;
  offlineValidDays: number;
}

export interface PendingQueueStats {
  totalPending: number;
  pendingSync: number;
  syncing: number;
  syncFailed: number;
  needsReview: number;
  synced: number;
  hasUnsyncedData: boolean;
}

export class ReferenceSyncService {
  /**
   * Pull and cache authorized scoped reference data from backend.
   */
  async syncReferenceData(
    apiBaseUrl: string,
    authToken: string,
    userId: string,
    forceFull: boolean = false
  ): Promise<ReferenceSyncMeta> {
    const existingMeta = await offlineDb.reference_sync_meta.get(userId);
    let url = `${apiBaseUrl}/api/v1/sync/reference-data`;

    if (!forceFull && existingMeta?.serverTime) {
      url += `?since=${encodeURIComponent(existingMeta.serverTime)}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Reference data sync failed: HTTP ${res.status} ${errText}`);
    }

    const data = await res.json();
    const nowIso = new Date().toISOString();

    // Persist scoped reference records within a transaction
    await (offlineDb as any).transaction(
      'rw',
      [
        offlineDb.cached_villages,
        offlineDb.cached_farmers,
        offlineDb.cached_animals,
        offlineDb.cached_qr_tokens,
        offlineDb.cached_species,
        offlineDb.cached_programmes,
        offlineDb.reference_sync_meta,
      ],
      async () => {
        // 1. Villages
        if (Array.isArray(data.villages)) {
          for (const v of data.villages) {
            const village: CachedVillage = {
              id: v.id,
              code: v.code,
              nameGu: v.nameGu || v.name_gu,
              nameEn: v.nameEn || v.name_en,
              talukaId: v.talukaId || v.taluka_id,
              districtId: v.districtId || v.district_id,
              latitude: v.latitude,
              longitude: v.longitude,
              userId,
              cachedAt: nowIso,
            };
            await offlineDb.cached_villages.put(village);
          }
        }

        // 2. Farmers
        if (Array.isArray(data.farmers)) {
          for (const f of data.farmers) {
            const farmer: CachedFarmer = {
              id: f.id,
              villageId: f.villageId || f.village_id,
              fullName: f.fullName || f.full_name,
              nameNorm: f.nameNorm || f.name_norm,
              mobileE164: f.mobileE164 || f.mobile_e164,
              mobileStatus: f.mobileStatus || f.mobile_status,
              farmerCode: f.farmerCode || f.farmer_code,
              registrationStatus: f.registrationStatus || f.registration_status,
              userId,
              cachedAt: nowIso,
            };
            await offlineDb.cached_farmers.put(farmer);
          }
        }

        // 3. Animals
        if (Array.isArray(data.animals)) {
          for (const a of data.animals) {
            const animal: CachedAnimal = {
              id: a.id,
              animalCode: a.animalCode || a.animal_code,
              speciesCode: a.speciesCode || a.species_code,
              breedId: a.breedId || a.breed_id,
              sex: a.sex,
              birthDate: a.birthDate || a.birth_date,
              ageMonthsEstimate: a.ageMonthsEstimate || a.age_months_estimate,
              farmerId: a.farmerId || a.farmer_id,
              villageId: a.villageId || a.village_id,
              registrationStatus: a.registrationStatus || a.registration_status,
              status: a.status || 'ACTIVE',
              tag12: a.tag12,
              userId,
              cachedAt: nowIso,
            };
            await offlineDb.cached_animals.put(animal);
          }
        }

        // 4. QR Tokens
        if (Array.isArray(data.qrTokens || data.qr_tokens)) {
          const tokens = data.qrTokens || data.qr_tokens;
          for (const q of tokens) {
            const qr: CachedQrToken = {
              token: q.token,
              animalId: q.animalId || q.animal_id,
              status: q.status || 'ACTIVE',
              userId,
              cachedAt: nowIso,
            };
            await offlineDb.cached_qr_tokens.put(qr);
          }
        }

        // 5. Species Master
        if (Array.isArray(data.species)) {
          for (const s of data.species) {
            const sp: CachedSpecies = {
              code: s.code,
              nameGu: s.nameGu || s.name_gu,
              nameEn: s.nameEn || s.name_en,
            };
            await offlineDb.cached_species.put(sp);
          }
        }

        // 6. Programmes Master
        if (Array.isArray(data.programmes)) {
          for (const p of data.programmes) {
            const prog: CachedProgramme = {
              code: p.code,
              nameEn: p.nameEn || p.name_en,
            };
            await offlineDb.cached_programmes.put(prog);
          }
        }

        // 7. Update Meta
        const meta: ReferenceSyncMeta = {
          userId,
          lastSyncAt: nowIso,
          serverTime: data.serverTime || data.server_time || nowIso,
          offlineValidDays: data.offlineValidDays || data.offline_valid_days || 7,
          permissions: data.permissions || [],
        };
        await offlineDb.reference_sync_meta.put(meta);
      }
    );

    return (await offlineDb.reference_sync_meta.get(userId))!;
  }

  /**
   * Check reference data freshness and offline authorization validity.
   */
  async getReferenceSyncStatus(userId: string): Promise<ReferenceSyncStatus> {
    const meta = await offlineDb.reference_sync_meta.get(userId);
    if (!meta || !meta.lastSyncAt) {
      return {
        lastSyncAt: null,
        serverTime: null,
        isStale: true,
        isExpired: false,
        statusTextGu: 'રેફરન્સ ડેટા હજી સિન્ક થયો નથી',
        offlineValidDays: 7,
      };
    }

    const lastSyncMs = new Date(meta.lastSyncAt).getTime();
    const elapsedMs = Date.now() - lastSyncMs;
    const hoursElapsed = elapsedMs / (1000 * 60 * 60);
    const daysElapsed = hoursElapsed / 24;

    const isStale = hoursElapsed >= 24;
    const isExpired = daysElapsed >= meta.offlineValidDays;

    let statusTextGu = 'રેફરન્સ ડેટા તાજો છે (Fresh)';
    if (isExpired) {
      statusTextGu = 'ઓફલાઇન અધિકૃતતા સમાપ્ત થઈ છે. ઓનલાઇન લોગિન જરૂરી છે.';
    } else if (isStale) {
      statusTextGu = 'રેફરન્સ ડેટા જૂનો છે (૨૪ કલાકથી વધુ)';
    }

    return {
      lastSyncAt: meta.lastSyncAt,
      serverTime: meta.serverTime,
      isStale,
      isExpired,
      statusTextGu,
      offlineValidDays: meta.offlineValidDays,
    };
  }

  /**
   * Get total pending records in local queue for current device/user.
   */
  async getPendingQueueStats(userId?: string): Promise<PendingQueueStats> {
    let query = offlineDb.queued_events.toCollection();
    if (userId) {
      query = offlineDb.queued_events.where('ownerUserId').equals(userId);
    }
    const events = await query.toArray();

    let pendingSync = 0;
    let syncing = 0;
    let syncFailed = 0;
    let needsReview = 0;
    let synced = 0;

    for (const e of events) {
      switch (e.state) {
        case 'PENDING_SYNC':
          pendingSync++;
          break;
        case 'SYNCING':
          syncing++;
          break;
        case 'SYNC_FAILED':
          syncFailed++;
          break;
        case 'NEEDS_REVIEW':
          needsReview++;
          break;
        case 'SYNCED':
          synced++;
          break;
      }
    }

    const totalPending = pendingSync + syncing + syncFailed + needsReview;
    return {
      totalPending,
      pendingSync,
      syncing,
      syncFailed,
      needsReview,
      synced,
      hasUnsyncedData: totalPending > 0,
    };
  }

  /**
   * Clear read-only cached data for a specific user on account switch.
   * INVARIANT: Never deletes queued_events or queued_media!
   */
  async clearUserReadOnlyCache(userId: string): Promise<void> {
    await (offlineDb as any).transaction(
      'rw',
      [
        offlineDb.cached_villages,
        offlineDb.cached_farmers,
        offlineDb.cached_animals,
        offlineDb.cached_qr_tokens,
        offlineDb.reference_sync_meta,
      ],
      async () => {
        await offlineDb.cached_villages.where('userId').equals(userId).delete();
        await offlineDb.cached_farmers.where('userId').equals(userId).delete();
        await offlineDb.cached_animals.where('userId').equals(userId).delete();
        await offlineDb.cached_qr_tokens.where('userId').equals(userId).delete();
        await offlineDb.reference_sync_meta.delete(userId);
      }
    );
  }

  /**
   * Export unsynced pending records as a downloadable JSON file before logout.
   */
  async exportPendingRecords(userId?: string): Promise<void> {
    let eventsQuery = offlineDb.queued_events.toCollection();
    if (userId) {
      eventsQuery = offlineDb.queued_events.where('ownerUserId').equals(userId);
    }
    const events = await eventsQuery.toArray();
    const media = await offlineDb.queued_media.toArray();

    const backupData = {
      exportedAt: new Date().toISOString(),
      userId: userId || 'all',
      queuedEvents: events,
      queuedMediaMetadata: media.map((m) => ({
        mediaId: m.mediaId,
        parentEventId: m.parentEventId,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
        sha256: m.sha256,
        state: m.state,
        clientCreatedAt: m.clientCreatedAt,
      })),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pashurakshak_pending_backup_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const referenceSyncService = new ReferenceSyncService();

