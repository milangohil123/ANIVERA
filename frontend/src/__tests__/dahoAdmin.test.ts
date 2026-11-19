import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const talukaSchema = z.object({
  code: z.string().trim().min(2, 'કોડ ઓછામાં ઓછો ૨ અક્ષરનો હોવો જોઈએ').max(30),
  name_gu: z.string().trim().min(1, 'ગુજરાતી નામ જરૂરી છે'),
  name_en: z.string().trim().min(1, 'અંગ્રેજી નામ જરૂરી છે'),
});

const villageSchema = z.object({
  taluka_id: z.string().uuid('કૃપા કરીને માન્ય તાલુકો પસંદ કરો'),
  code: z.string().trim().min(2, 'કોડ ઓછામાં ઓછો ૨ અક્ષરનો હોવો જોઈએ').max(30),
  name_gu: z.string().trim().min(1, 'ગુજરાતી નામ જરૂરી છે'),
  name_en: z.string().trim().min(1, 'અંગ્રેજી નામ જરૂરી છે'),
  census_code: z.string().trim().optional(),
  latitude: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= -90 && Number(val) <= 90), {
      message: 'અક્ષાંશ -90 અને 90 ની વચ્ચે હોવો જોઈએ',
    }),
  longitude: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= -180 && Number(val) <= 180), {
      message: 'રેખાંશ -180 અને 180 ની વચ્ચે હોવો જોઈએ',
    }),
  is_pilot: z.boolean().default(false),
});

const voSchema = z.object({
  full_name: z.string().trim().min(2, 'સંપૂર્ણ નામ ઓછામાં ઓછું ૨ અક્ષરનું હોવું જોઈએ').max(150),
  username: z.string().trim().min(3, 'વપરાશકર્તા નામ ઓછામાં ઓછું ૩ અક્ષરનું હોવું જોઈએ').max(50),
  password: z.string().min(8, 'પાસવર્ડ ઓછામાં ઓછો ૮ અક્ષરનો હોવો જોઈએ').max(128),
  mobile_e164: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\+[1-9][0-9]{7,14}$/.test(val), {
      message: 'મોબાઇલ નંબર માન્ય E.164 ફોર્મેટમાં હોવો જોઈએ (દા.ત. +919876543210)',
    }),
});

describe('DAHO Administration Validation & Scope Rules', () => {
  it('validates taluka payload correctly', () => {
    const valid = talukaSchema.safeParse({
      code: 'TALUKA_BOTAD',
      name_gu: 'બોટાદ',
      name_en: 'Botad',
    });
    expect(valid.success).toBe(true);

    const invalid = talukaSchema.safeParse({
      code: 'B',
      name_gu: '',
      name_en: 'Botad',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates village coordinates strictly when provided', () => {
    // Optional coordinates allowed as empty string or undefined
    const validNoCoords = villageSchema.safeParse({
      taluka_id: '3f401b76-a2fa-4d3f-a8aa-a532d30ac244',
      code: 'V_PALIYAD',
      name_gu: 'પાળીયાદ',
      name_en: 'Paliyad',
      latitude: '',
      longitude: '',
    });
    expect(validNoCoords.success).toBe(true);

    // Valid coordinates allowed
    const validWithCoords = villageSchema.safeParse({
      taluka_id: '3f401b76-a2fa-4d3f-a8aa-a532d30ac244',
      code: 'V_PALIYAD',
      name_gu: 'પાળીયાદ',
      name_en: 'Paliyad',
      latitude: '22.17',
      longitude: '71.66',
    });
    expect(validWithCoords.success).toBe(true);

    // Invalid latitude (> 90) rejected
    const invalidCoords = villageSchema.safeParse({
      taluka_id: '3f401b76-a2fa-4d3f-a8aa-a532d30ac244',
      code: 'V_PALIYAD',
      name_gu: 'પાળીયાદ',
      name_en: 'Paliyad',
      latitude: '95.5',
      longitude: '71.66',
    });
    expect(invalidCoords.success).toBe(false);
  });

  it('validates staff mobile in E.164 format and password length', () => {
    const validVO = voSchema.safeParse({
      full_name: 'ડૉ. રમેશભાઈ પટેલ',
      username: 'vo_botad_01',
      password: 'SecurePassword123!',
      mobile_e164: '+919876543210',
    });
    expect(validVO.success).toBe(true);

    // Invalid mobile without +91 prefix rejected
    const invalidMobile = voSchema.safeParse({
      full_name: 'ડૉ. રમેશભાઈ પટેલ',
      username: 'vo_botad_01',
      password: 'SecurePassword123!',
      mobile_e164: '9876543210',
    });
    expect(invalidMobile.success).toBe(false);

    // Password shorter than 8 chars rejected
    const shortPassword = voSchema.safeParse({
      full_name: 'ડૉ. રમેશભાઈ પટેલ',
      username: 'vo_botad_01',
      password: 'short',
    });
    expect(shortPassword.success).toBe(false);
  });
});

