import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const eventCorrectionSchema = z.object({
  action: z.enum(['AMEND', 'VOID']),
  reason: z.string().trim().min(3, 'સુધારણાનું કારણ ઓછામાં ઓછું ૩ અક્ષરનું હોવું જોઈએ').max(500),
  replacement_event_id: z.string().uuid().optional(),
});

const diseaseDecisionSchema = z.object({
  action: z.enum(['CONFIRM', 'DISPROVE', 'INSUFFICIENT']),
  confirmation_basis: z.string().trim().optional(),
  not_confirmed_reason: z.string().trim().optional(),
}).refine((data) => {
  if (data.action === 'CONFIRM') return !!data.confirmation_basis && data.confirmation_basis.length > 0;
  if (data.action === 'DISPROVE') return !!data.not_confirmed_reason && data.not_confirmed_reason.length > 0;
  return true;
}, {
  message: 'નિર્ણય માટે યોગ્ય ક્લિનિકલ કારણ આપવું ફરજિયાત છે',
});

describe('VO Portal Business Invariants & Permission Gating', () => {
  it('enforces mandatory reason for event corrections', () => {
    const validVoid = eventCorrectionSchema.safeParse({
      action: 'VOID',
      reason: 'ખોટો પ્રાણી આઈડી દાખલ થયો હતો',
    });
    expect(validVoid.success).toBe(true);

    const invalidEmptyReason = eventCorrectionSchema.safeParse({
      action: 'VOID',
      reason: '   ',
    });
    expect(invalidEmptyReason.success).toBe(false);
  });

  it('enforces mandatory basis when confirming or disproving disease reports', () => {
    const validConfirm = diseaseDecisionSchema.safeParse({
      action: 'CONFIRM',
      confirmation_basis: 'લેબોરેટરી એલિઝા ટેસ્ટ પોઝિટિવ આવ્યો',
    });
    expect(validConfirm.success).toBe(true);

    const invalidConfirmWithoutBasis = diseaseDecisionSchema.safeParse({
      action: 'CONFIRM',
      confirmation_basis: '',
    });
    expect(invalidConfirmWithoutBasis.success).toBe(false);

    const validDisprove = diseaseDecisionSchema.safeParse({
      action: 'DISPROVE',
      not_confirmed_reason: 'સામાન્ય મોં ના ચાંદા હતા, એફએમડી નથી',
    });
    expect(validDisprove.success).toBe(true);

    const invalidDisproveWithoutReason = diseaseDecisionSchema.safeParse({
      action: 'DISPROVE',
      not_confirmed_reason: '',
    });
    expect(invalidDisproveWithoutReason.success).toBe(false);
  });

  it('restricts disease confirmation action to users possessing disease.confirm permission', () => {
    const checkCanConfirm = (permissions: string[]): boolean => {
      return permissions.includes('disease.confirm');
    };

    expect(checkCanConfirm(['disease.review', 'animal.read'])).toBe(false);
    expect(checkCanConfirm(['disease.review', 'disease.confirm'])).toBe(true);
  });

  it('restricts direct vaccination recording to authorised vaccinators', () => {
    const checkCanRecordVaccination = (isApprovedVaccinator: boolean, permissions: string[]): boolean => {
      return isApprovedVaccinator || permissions.includes('vaccination.record');
    };

    expect(checkCanRecordVaccination(false, ['treatment.create'])).toBe(false);
    expect(checkCanRecordVaccination(true, ['treatment.create'])).toBe(true);
    expect(checkCanRecordVaccination(false, ['vaccination.record'])).toBe(true);
  });
});

