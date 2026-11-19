import { describe, it, expect } from 'vitest';
import { getLocalizedDistrictName, formatLocalizedNumber, formatLocalizedDate } from '../i18n/localize';
import { en } from '../i18n/locales/en';
import { gu } from '../i18n/locales/gu';
import { hi } from '../i18n/locales/hi';

describe('Multilingual Engine & Master Data Localization', () => {
  it('localizes Gujarat districts accurately across all 3 languages', () => {
    // 1. By English string
    expect(getLocalizedDistrictName('Botad', 'en')).toBe('Botad');
    expect(getLocalizedDistrictName('Botad', 'gu')).toBe('બોટાદ');
    expect(getLocalizedDistrictName('Botad', 'hi')).toBe('बोटाद');

    expect(getLocalizedDistrictName('Ahmedabad', 'en')).toBe('Ahmedabad');
    expect(getLocalizedDistrictName('Ahmedabad', 'gu')).toBe('અમદાવાદ');
    expect(getLocalizedDistrictName('Ahmedabad', 'hi')).toBe('अहमदाबाद');

    // 2. By District Object with name_en, name_gu, name_hi
    const districtObj = {
      name_en: 'Rajkot',
      name_gu: 'રાજકોટ',
      name_hi: 'राजकोट',
    };
    expect(getLocalizedDistrictName(districtObj, 'en')).toBe('Rajkot');
    expect(getLocalizedDistrictName(districtObj, 'gu')).toBe('રાજકોટ');
    expect(getLocalizedDistrictName(districtObj, 'hi')).toBe('राजकोट');
  });

  it('formats localized numbers accurately', () => {
    expect(formatLocalizedNumber(12500, 'en')).toBe('12,500');
    expect(formatLocalizedNumber(0, 'gu')).toBe('0');
    expect(formatLocalizedNumber(100, 'hi')).toBe('100');
  });

  it('formats localized dates accurately across locales', () => {
    const testDate = new Date('2026-11-19T10:00:00Z');
    const formattedEn = formatLocalizedDate(testDate, 'en');
    const formattedGu = formatLocalizedDate(testDate, 'gu');
    const formattedHi = formatLocalizedDate(testDate, 'hi');

    expect(formattedEn).toBeTruthy();
    expect(formattedGu).toBeTruthy();
    expect(formattedHi).toBeTruthy();
    expect(typeof formattedGu).toBe('string');
  });

  it('maintains structural parity between en, gu, and hi superAdmin dictionaries', () => {
    const enSuperAdmin = (en as any).superAdmin;
    const guSuperAdmin = (gu as any).superAdmin;
    const hiSuperAdmin = (hi as any).superAdmin;

    expect(enSuperAdmin).toBeDefined();
    expect(guSuperAdmin).toBeDefined();
    expect(hiSuperAdmin).toBeDefined();

    // Verify key sections exist in all 3
    const sections = ['common', 'dashboard', 'map', 'daho', 'geography', 'assignments', 'oversight', 'roles'];
    sections.forEach((sec) => {
      expect(enSuperAdmin[sec]).toBeDefined();
      expect(guSuperAdmin[sec]).toBeDefined();
      expect(hiSuperAdmin[sec]).toBeDefined();
    });

    // Check dashboard title
    expect(enSuperAdmin.dashboard.title).toBe('State Administrative Portal (SUPER_ADMIN)');
    expect(guSuperAdmin.dashboard.title).toBe('રાજ્ય વહીવટી પોર્ટલ (SUPER_ADMIN)');
    expect(hiSuperAdmin.dashboard.title).toBe('राज्य प्रशासनिक पोर्टल (SUPER_ADMIN)');

    // Verify critical sub-objects that caused key leakage
    const subObjects = ['kpis', 'selectedDistrict', 'quickNav', 'registryTable', 'audit', 'systemHealth'];
    subObjects.forEach((sub) => {
      expect(enSuperAdmin.dashboard[sub]).toBeDefined();
      expect(guSuperAdmin.dashboard[sub]).toBeDefined();
      expect(hiSuperAdmin.dashboard[sub]).toBeDefined();
    });

    // Verify specific previously leaking keys exist and are non-empty
    expect(enSuperAdmin.dashboard.selectedDistrict.title).toBe('Selected District');
    expect(guSuperAdmin.dashboard.selectedDistrict.title).toBe('પસંદ કરેલ જિલ્લો');
    expect(hiSuperAdmin.dashboard.selectedDistrict.title).toBe('चयनित जिला');

    expect(enSuperAdmin.dashboard.registryTable.title).toBe('District Administrative Assignment Registry');
    expect(guSuperAdmin.dashboard.registryTable.title).toBe('જિલ્લાવાર વહીવટી સોંપણી રજિસ્ટ્રી');
    expect(hiSuperAdmin.dashboard.registryTable.title).toBe('जिलेवार प्रशासनिक आवंटन रजिस्ट्री');

    expect(enSuperAdmin.map.legendAssigned).toBe('Assigned District');
    expect(guSuperAdmin.map.legendAssigned).toBe('સોંપાયેલ જિલ્લો');
    expect(hiSuperAdmin.map.legendAssigned).toBe('आवंटित जिला');
  });

  it('ensures no keys in superAdmin resolve to raw technical paths or undefined', () => {
    function flattenObject(obj: any, prefix = ''): Record<string, string> {
      let res: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') {
          res[fullKey] = v;
        } else if (v && typeof v === 'object') {
          Object.assign(res, flattenObject(v, fullKey));
        }
      }
      return res;
    }

    const flatEn = flattenObject(en.superAdmin, 'superAdmin');
    const flatGu = flattenObject(gu.superAdmin, 'superAdmin');
    const flatHi = flattenObject(hi.superAdmin, 'superAdmin');

    const allKeys = Object.keys(flatEn);
    expect(allKeys.length).toBeGreaterThan(150);

    for (const key of allKeys) {
      expect(flatEn[key]).toBeDefined();
      expect(typeof flatEn[key]).toBe('string');
      expect(flatEn[key].length).toBeGreaterThan(0);
      expect(flatEn[key].startsWith('superAdmin.')).toBe(false);

      expect(flatGu[key]).toBeDefined();
      expect(typeof flatGu[key]).toBe('string');
      expect(flatGu[key].length).toBeGreaterThan(0);
      expect(flatGu[key].startsWith('superAdmin.')).toBe(false);

      expect(flatHi[key]).toBeDefined();
      expect(typeof flatHi[key]).toBe('string');
      expect(flatHi[key].length).toBeGreaterThan(0);
      expect(flatHi[key].startsWith('superAdmin.')).toBe(false);
    }
  });
});
