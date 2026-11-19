import { describe, it, expect } from 'vitest';
import { normalizeRole, getRolePrefix } from '../context/AuthContext';
import {
  DAHO_NAV_ITEMS,
  VO_NAV_ITEMS,
  FW_NAV_ITEMS,
  FARMER_NAV_ITEMS,
  COOP_NAV_ITEMS,
  ADMIN_NAV_ITEMS,
} from '../constants/navConfig';

describe('Role Normalization & Navigation Mapping', () => {
  it('normalizes backend role strings accurately', () => {
    expect(normalizeRole('DAHO')).toBe('DAHO');
    expect(normalizeRole('VO')).toBe('VO');
    expect(normalizeRole('VET_OFFICER')).toBe('VO');
    expect(normalizeRole('FIELD_WORKER')).toBe('FW');
    expect(normalizeRole('FW')).toBe('FW');
    expect(normalizeRole('FARMER')).toBe('FARMER');
    expect(normalizeRole('DAIRY_STAFF')).toBe('COOP');
    expect(normalizeRole('COOPERATIVE')).toBe('COOP');
    expect(normalizeRole('SYS_ADMIN')).toBe('SYS_ADMIN');
    expect(normalizeRole('ADMIN')).toBe('SYS_ADMIN');
    expect(normalizeRole('INVALID_ROLE')).toBe('UNKNOWN');
    expect(normalizeRole(null)).toBe('UNKNOWN');
  });

  it('maps each role to its dedicated route prefix', () => {
    expect(getRolePrefix('DAHO')).toBe('/daho');
    expect(getRolePrefix('VO')).toBe('/vo');
    expect(getRolePrefix('FW')).toBe('/fw');
    expect(getRolePrefix('FARMER')).toBe('/farmer');
    expect(getRolePrefix('COOP')).toBe('/coop');
    expect(getRolePrefix('SYS_ADMIN')).toBe('/admin');
    expect(getRolePrefix('UNKNOWN')).toBe('/access-denied');
  });

  it('DAHO has all required Gujarati navigation items', () => {
    const paths = DAHO_NAV_ITEMS.map((i) => i.path);
    expect(paths).toContain('/daho/overview');
    expect(paths).toContain('/daho/master-data');
    expect(paths).toContain('/daho/staff');
    expect(paths).toContain('/daho/campaigns');
    expect(paths).toContain('/daho/camps');
    expect(paths).toContain('/daho/inventory');
    expect(paths).toContain('/daho/surveillance');
    expect(paths).toContain('/daho/maps');
    expect(paths).toContain('/daho/reports');
    expect(paths).toContain('/daho/profile');
  });

  it('VO has all required Gujarati navigation items', () => {
    const paths = VO_NAV_ITEMS.map((i) => i.path);
    expect(paths).toContain('/vo/overview');
    expect(paths).toContain('/vo/surveillance-reviews');
    expect(paths).toContain('/vo/animals');
    expect(paths).toContain('/vo/vaccinations');
    expect(paths).toContain('/vo/campaigns');
    expect(paths).toContain('/vo/camps');
    expect(paths).toContain('/vo/inventory');
    expect(paths).toContain('/vo/reports');
    expect(paths).toContain('/vo/maps');
    expect(paths).toContain('/vo/sync');
    expect(paths).toContain('/vo/profile');
  });

  it('FW navigation includes home, scan, pending, sync, profile, maps', () => {
    const paths = FW_NAV_ITEMS.map((i) => i.path);
    expect(paths).toContain('/fw/home');
    expect(paths).toContain('/fw/scan');
    expect(paths).toContain('/fw/pending');
    expect(paths).toContain('/fw/maps');
    expect(paths).toContain('/fw/sync');
    expect(paths).toContain('/fw/profile');
  });

  it('Farmer navigation has home, animals, profile', () => {
    const paths = FARMER_NAV_ITEMS.map((i) => i.path);
    expect(paths).toEqual(['/farmer/home', '/farmer/animals', '/farmer/profile']);
  });

  it('Coop has all required navigation items', () => {
    const paths = COOP_NAV_ITEMS.map((i) => i.path);
    expect(paths).toContain('/coop/overview');
    expect(paths).toContain('/coop/village-progress');
    expect(paths).toContain('/coop/camps');
    expect(paths).toContain('/coop/reports');
  });

  it('SYS_ADMIN has technical-only navigation items', () => {
    const paths = ADMIN_NAV_ITEMS.map((i) => i.path);
    expect(paths).toContain('/admin/overview');
    expect(paths).toContain('/admin/users');
    expect(paths).toContain('/admin/devices');
    expect(paths).toContain('/admin/audit-logs');
    expect(paths).toContain('/admin/system-health');
  });
});

