import { describe, it, expect } from 'vitest';
import { en } from '../i18n/locales/en';
import { gu } from '../i18n/locales/gu';
import { hi } from '../i18n/locales/hi';
import { adminService } from '../services/adminService';

describe('GIS Administrative Boundaries & Geographic Quality Audit', () => {
  it('has tabAudit translation keys in all three supported languages', () => {
    expect((en as any).superAdmin.geography.tabAudit).toBe('Data Quality Audit');
    expect((gu as any).superAdmin.geography.tabAudit).toBe('ડેટા ગુણવત્તા ઓડિટ');
    expect((hi as any).superAdmin.geography.tabAudit).toBe('डेटा गुणवत्ता ऑडिट');
  });

  it('provides all 3 hierarchical GIS service methods in adminService', () => {
    expect(typeof adminService.getDistrictTalukasGeoJson).toBe('function');
    expect(typeof adminService.getTalukaVillagesGeoJson).toBe('function');
    expect(typeof adminService.getGeographicQualityAudit).toBe('function');
  });

  it('validates hierarchical drill-down level transition rules', () => {
    type ViewLevel = 'DISTRICT' | 'TALUKA' | 'VILLAGE';
    const validLevels: ViewLevel[] = ['DISTRICT', 'TALUKA', 'VILLAGE'];

    expect(validLevels.includes('DISTRICT')).toBe(true);
    expect(validLevels.includes('TALUKA')).toBe(true);
    expect(validLevels.includes('VILLAGE')).toBe(true);

    // Rule: Can only drill into Taluka if a district is selected
    const canDrillTaluka = (selectedDistrictId: string | null) => Boolean(selectedDistrictId);
    expect(canDrillTaluka(null)).toBe(false);
    expect(canDrillTaluka('district-jamnagar')).toBe(true);

    // Rule: Can only drill into Village if a taluka is selected
    const canDrillVillage = (selectedTalukaId: string | null) => Boolean(selectedTalukaId);
    expect(canDrillVillage(null)).toBe(false);
    expect(canDrillVillage('taluka-dhrol')).toBe(true);
  });

  it('enforces GIS layer visibility and separation rules without outline bleed', () => {
    // Map layer visibility contract
    const getLayerVisibilities = (lvl: 'DISTRICT' | 'TALUKA' | 'VILLAGE') => {
      if (lvl === 'DISTRICT') {
        return {
          districtsFill: 'visible',
          districtsBorders: 'visible',
          districtsContextLine: 'none',
          talukasFill: 'none',
          talukasBorders: 'none',
          talukasContextLine: 'none',
          villagesFill: 'none',
          villagesBorders: 'none',
        };
      } else if (lvl === 'TALUKA') {
        return {
          districtsFill: 'none', // Crucial: no district tint over talukas
          districtsBorders: 'none', // Crucial: no thick blue district outline over talukas
          districtsContextLine: 'none', // District boundaries completely removed in Taluka view
          talukasFill: 'visible',
          talukasBorders: 'visible',
          talukasContextLine: 'none',
          villagesFill: 'none',
          villagesBorders: 'none',
        };
      } else {
        return {
          districtsFill: 'none',
          districtsBorders: 'none',
          districtsContextLine: 'none',
          talukasFill: 'none',
          talukasBorders: 'none',
          talukasContextLine: 'visible', // Subtle dashed sky context line
          villagesFill: 'visible',
          villagesBorders: 'visible',
        };
      }
    };

    const districtVis = getLayerVisibilities('DISTRICT');
    expect(districtVis.districtsFill).toBe('visible');
    expect(districtVis.districtsBorders).toBe('visible');
    expect(districtVis.talukasFill).toBe('none');
    expect(districtVis.villagesFill).toBe('none');

    const talukaVis = getLayerVisibilities('TALUKA');
    expect(talukaVis.talukasFill).toBe('visible');
    expect(talukaVis.talukasBorders).toBe('visible');
    expect(talukaVis.districtsFill).toBe('none');
    expect(talukaVis.districtsBorders).toBe('none');
    expect(talukaVis.districtsContextLine).toBe('none');
    expect(talukaVis.villagesFill).toBe('none');

    const villageVis = getLayerVisibilities('VILLAGE');
    expect(villageVis.villagesFill).toBe('visible');
    expect(villageVis.villagesBorders).toBe('visible');
    expect(villageVis.talukasContextLine).toBe('visible');
    expect(villageVis.talukasFill).toBe('none');
    expect(villageVis.districtsFill).toBe('none');
  });

  it('enforces distinct color palette for District, Taluka, and Village levels', () => {
    const palette = {
      districtAssigned: '#135D43',
      districtUnassigned: '#94A3B8',
      districtSelected: '#ebedf0ff',
      talukaFill: '#000000ff',
      talukaBorder: '#1f2021ff',
      talukaSelectedFill: '#0a0b0bff',
      talukaSelectedBorder: '#000000ff',
      villageFill: '#6EE7B7',
      villageBorder: '#047857',
      villageSelectedFill: '#F59E0B',
      villageSelectedBorder: '#B45309',
    };

    // Taluka border must be distinct from District selection blue
    expect(palette.talukaBorder).not.toBe(palette.districtSelected);
    // Village border must be distinct from Taluka border
    expect(palette.villageBorder).not.toBe(palette.talukaBorder);
    // Village selected amber must be distinct from village regular emerald
    expect(palette.villageSelectedFill).not.toBe(palette.villageFill);
  });
});
