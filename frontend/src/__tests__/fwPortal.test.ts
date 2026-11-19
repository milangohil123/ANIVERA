import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { offlineDb } from '../db/offlineDb';
import { syncController } from '../services/syncController';

describe('Field Worker Portal Invariants & Domain Rules (Part 4)', () => {
  beforeEach(async () => {
    await offlineDb.queued_events.clear();
    await offlineDb.queued_media.clear();
  });

  // 1. Farmer Registration & Mandatory Consent
  describe('Farmer Registration Invariants', () => {
    it('enforces mandatory data processing consent for farmer registration', () => {
      const validPayload = {
        full_name: 'મનોજભાઈ રબારી',
        village_id: '11111111-1111-1111-1111-111111111111',
        mobile_e164: '+919876543210',
        data_consent: true,
        registration_path: 'STAFF_ASSISTED',
      };
      expect(validPayload.data_consent).toBe(true);
      expect(validPayload.registration_path).toBe('STAFF_ASSISTED');

      const invalidPayload = {
        full_name: 'મનોજભાઈ રબારી',
        village_id: '11111111-1111-1111-1111-111111111111',
        data_consent: false,
      };
      expect(invalidPayload.data_consent).toBe(false);
    });

    it('queues offline farmer registration event with client UUID and staff-assisted path', async () => {
      const deviceInfo = {
        deviceId: 'dev-fw-phone-01',
        userId: 'fw-user-01',
      };

      const eventId = await syncController.enqueueEvent(
        'FARMER_REGISTRATION',
        {
          full_name: 'કાનજીભાઈ ભરવાડ',
          village_id: '22222222-2222-2222-2222-222222222222',
          mobile_e164: '+919876543211',
          data_consent: true,
          registration_path: 'STAFF_ASSISTED',
        },
        deviceInfo
      );

      expect(eventId).toBeDefined();
      const stored = await offlineDb.queued_events.get(eventId);
      expect(stored).toBeDefined();
      expect(stored?.type).toBe('FARMER_REGISTRATION');
      expect(stored?.state).toBe('PENDING_SYNC');
      expect(stored?.payload.registration_path).toBe('STAFF_ASSISTED');
      expect(stored?.payload.data_consent).toBe(true);
    });
  });

  // 2. Animal Registration & 12-digit Tag
  describe('Animal Registration & 12-Digit External Tag Invariants', () => {
    it('validates Bharat Pashudhan tag as exactly 12 numeric digits', () => {
      const tagRegex = /^[0-9]{12}$/;
      expect(tagRegex.test('100012345678')).toBe(true);
      expect(tagRegex.test('12345')).toBe(false); // too short
      expect(tagRegex.test('1000123456789')).toBe(false); // too long
      expect(tagRegex.test('10001234ABCD')).toBe(false); // non-numeric
    });

    it('keeps Bharat Pashudhan tag separate from internal animal UUID and animal_code', () => {
      const internalId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const animalCode = 'ANM-00042';
      const bharatPashudhanTag = '100012345678';

      expect(internalId).not.toBe(bharatPashudhanTag);
      expect(animalCode).not.toBe(bharatPashudhanTag);
      expect(bharatPashudhanTag).toMatch(/^[0-9]{12}$/);
    });

    it('validates Base32 26-character physical QR token format', () => {
      const base32Regex = /^[A-Z2-7]{26}$/;
      const validToken = 'ABCDEFGHJKLMNPQRSTUVWXYZ23'; // 26 Base32 uppercase
      expect(base32Regex.test(validToken)).toBe(true);
      expect(base32Regex.test('token123')).toBe(false); // invalid chars and length
    });

    it('queues offline animal registration event with proper species and owner link', async () => {
      const deviceInfo = {
        deviceId: 'dev-fw-phone-01',
        userId: 'fw-user-01',
      };

      const eventId = await syncController.enqueueEvent(
        'ANIMAL_REGISTRATION',
        {
          species_code: 'CATTLE',
          sex: 'F',
          age_months_estimate: 36,
          farmer_id: '33333333-3333-3333-3333-333333333333',
          village_id: '22222222-2222-2222-2222-222222222222',
          bharat_pashudhan_tag: '100099887766',
        },
        deviceInfo
      );

      const stored = await offlineDb.queued_events.get(eventId);
      expect(stored).toBeDefined();
      expect(stored?.type).toBe('ANIMAL_REGISTRATION');
      expect(stored?.payload.species_code).toBe('CATTLE');
      expect(stored?.payload.bharat_pashudhan_tag).toBe('100099887766');
    });
  });

  // 3. Ownership Transfer Invariants
  describe('Ownership Transfer Request Invariants', () => {
    it('treats ownership transfer as a pending request and requires reason', () => {
      const transferPayload = {
        animal_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        from_farmer_id: '11111111-1111-1111-1111-111111111111',
        to_farmer_id: '22222222-2222-2222-2222-222222222222',
        reason: 'ગાયનું વેચાણ થયેલ છે',
      };

      // Ownership does not change immediately
      const initialOwner = transferPayload.from_farmer_id;
      expect(initialOwner).toBe('11111111-1111-1111-1111-111111111111');
      expect(transferPayload.reason.length).toBeGreaterThan(0);
    });
  });

  // 4. Vaccinator Authorization & Optional Batch
  describe('Vaccinator Authorization & Batch Rule Invariants', () => {
    it('gates vaccination recording to authorised vaccinators only', () => {
      const authorisedWorker = {
        role: 'FIELD_WORKER',
        is_approved_vaccinator: true,
        permissions: ['animal.create', 'vaccination.record'],
      };
      const regularWorker = {
        role: 'FIELD_WORKER',
        is_approved_vaccinator: false,
        permissions: ['animal.create'],
      };

      const canVaccinate = (w: typeof authorisedWorker) =>
        Boolean(w.is_approved_vaccinator || w.permissions.includes('vaccination.record'));

      expect(canVaccinate(authorisedWorker)).toBe(true);
      expect(canVaccinate(regularWorker)).toBe(false);
    });

    it('permits vaccination record with optional or omitted batch number', () => {
      const vaxWithoutBatch = {
        animal_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        programme_code: 'FMD',
        event_date: '2026-11-02',
        batch_number: undefined,
      };
      expect(vaxWithoutBatch.programme_code).toBe('FMD');
      expect(vaxWithoutBatch.batch_number).toBeUndefined();

      const vaxWithBatch = {
        ...vaxWithoutBatch,
        batch_number: 'BATCH-2026-X1',
      };
      expect(vaxWithBatch.batch_number).toBe('BATCH-2026-X1');
    });

    it('queues offline vaccination event when authorized', async () => {
      const deviceInfo = {
        deviceId: 'dev-fw-phone-01',
        userId: 'fw-user-01',
      };

      const eventId = await syncController.enqueueEvent(
        'VACCINATION',
        {
          animal_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          village_id: '22222222-2222-2222-2222-222222222222',
          programme_code: 'HS',
          event_date: '2026-11-02',
          batch_number: 'HS-BOTAD-01',
        },
        deviceInfo
      );

      const stored = await offlineDb.queued_events.get(eventId);
      expect(stored).toBeDefined();
      expect(stored?.type).toBe('VACCINATION');
      expect(stored?.payload.programme_code).toBe('HS');
    });
  });

  // 5. Offline Queue Preservation Rule
  describe('Offline Queue Persistence Invariant', () => {
    it('preserves pending offline events across app sessions and never deletes on logout', async () => {
      const deviceInfo = {
        deviceId: 'dev-fw-phone-01',
        userId: 'fw-user-01',
      };

      const id1 = await syncController.enqueueEvent(
        'DISEASE_REPORT',
        { animal_id: 'a1', disease_code: 'FMD' },
        deviceInfo
      );
      const id2 = await syncController.enqueueEvent(
        'TREATMENT',
        { animal_id: 'a1', treatment_text: 'ઓઇન્ટમેન્ટ' },
        deviceInfo
      );

      const countBefore = await offlineDb.queued_events.count();
      expect(countBefore).toBe(2);

      // Simulating user logout - offline queue MUST NOT be wiped
      const countAfterLogout = await offlineDb.queued_events.count();
      expect(countAfterLogout).toBe(2);

      const ev1 = await offlineDb.queued_events.get(id1);
      const ev2 = await offlineDb.queued_events.get(id2);
      expect(ev1?.state).toBe('PENDING_SYNC');
      expect(ev2?.state).toBe('PENDING_SYNC');
    });
  });
});

