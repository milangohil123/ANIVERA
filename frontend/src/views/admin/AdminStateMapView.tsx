import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { adminService, cachedJsonFetch } from '../../services/adminService';
import { masterService, type DiseaseItem, type VaccineItem } from '../../services/masterService';
import { GujaratStateMap } from '../../components/maps/GujaratStateMap';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  MapPin,
  ArrowLeft,
  RotateCcw,
  Shield,
  Layers,
  Database,
  Syringe,
  Activity,
  Clock,
  PawPrint,
  ShieldAlert,
  Search,
  TrendingUp,
} from 'lucide-react';

export type LayerMode = 'coverage' | 'disease' | 'pending' | 'risk' | 'population';

export const AdminStateMapView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();
  const { t, localizeDistrict } = useTranslation();

  // Core Map States
  const [stateGeoJson, setStateGeoJson] = useState<any | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);
  const [selectedTaluka, setSelectedTaluka] = useState<any | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<any | null>(null);
  const [viewLevel, setViewLevel] = useState<'DISTRICT' | 'TALUKA' | 'VILLAGE'>('DISTRICT');

  const [talukasGeoJson, setTalukasGeoJson] = useState<any | null>(null);
  const [villagesGeoJson, setVillagesGeoJson] = useState<any | null>(null);
  const [isLoadingSubLayer, setIsLoadingSubLayer] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real Database Analytics & Master Data
  const [districtPerformanceList, setDistrictPerformanceList] = useState<any[]>([]);
  const [superAdminOverview, setSuperAdminOverview] = useState<any | null>(null);
  const [masterDiseases, setMasterDiseases] = useState<DiseaseItem[]>([]);
  const [masterVaccines, setMasterVaccines] = useState<VaccineItem[]>([]);

  // Filter States
  const [layerMode, setLayerMode] = useState<LayerMode>('coverage');
  const [selectedDisease, setSelectedDisease] = useState<string>('');
  const [selectedVaccine, setSelectedVaccine] = useState<string>('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [coverageRange, setCoverageRange] = useState<string>('');
  const [dateRangeOption, setDateRangeOption] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredDistrict, setHoveredDistrict] = useState<any | null>(null);
  const [filterAnalyticsData, setFilterAnalyticsData] = useState<{
    vaxDistrictMap: Map<string, any>;
    disDistrictMap: Map<string, any>;
  }>({
    vaxDistrictMap: new Map(),
    disDistrictMap: new Map(),
  });
  const [talukaGisData, setTalukaGisData] = useState<any | null>(null);

  // Load Real Data from PostgreSQL via Admin API
  const loadMapData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [mapData, diseases, vaccines, chartsData, overviewData] = await Promise.all([
        adminService.getGujaratStateMap(apiBaseUrl),
        masterService.listDiseases(apiBaseUrl, true).catch(() => []),
        masterService.listVaccines(apiBaseUrl).catch(() => []),
        adminService.getSuperAdminCharts(apiBaseUrl).catch(() => null),
        adminService.getSuperAdminOverview(apiBaseUrl).catch(() => null),
      ]);
      setStateGeoJson(mapData);
      setMasterDiseases(diseases);
      setMasterVaccines(vaccines);
      if (chartsData?.district_performance) {
        setDistrictPerformanceList(chartsData.district_performance);
      }
      if (overviewData) {
        setSuperAdminOverview(overviewData);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('superAdmin.common.loadFailed') || 'Failed to load map data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [apiBaseUrl]);

  // Real Database District Performance Map (O(1) lookup by ID, code, or name)
  const districtPerformanceMap = useMemo(() => {
    const map = new Map<string, any>();
    if (superAdminOverview?.district_summaries) {
      superAdminOverview.district_summaries.forEach((d: any) => {
        if (d.district_id) map.set(String(d.district_id), d);
        if (d.code) map.set(String(d.code).toUpperCase(), d);
        if (d.name_en) map.set(String(d.name_en).toLowerCase(), d);
      });
    }
    if (districtPerformanceList.length > 0) {
      districtPerformanceList.forEach((dp: any) => {
        const existing =
          map.get(String(dp.district_id)) ||
          map.get(String(dp.code).toUpperCase()) ||
          map.get(String(dp.name_en).toLowerCase()) ||
          {};
        const merged = { ...existing, ...dp };
        if (dp.district_id) map.set(String(dp.district_id), merged);
        if (dp.code) map.set(String(dp.code).toUpperCase(), merged);
        if (dp.name_en) map.set(String(dp.name_en).toLowerCase(), merged);
      });
    }
    return map;
  }, [districtPerformanceList, superAdminOverview]);

  // Auto-refresh upon synchronization events
  useEffect(() => {
    const handleSync = () => {
      loadMapData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pashurakshak_data_synced', handleSync);
      return () => window.removeEventListener('pashurakshak_data_synced', handleSync);
    }
  }, [apiBaseUrl]);

  // Load Filter-Aware Analytics for all 34 Gujarat Districts
  useEffect(() => {
    let isMounted = true;
    const fetchFilteredAnalytics = async () => {
      try {
        const vaxParams = new URLSearchParams();
        const disParams = new URLSearchParams();

        if (selectedDisease) {
          vaxParams.set('disease_code', selectedDisease);
          disParams.set('disease_code', selectedDisease);
        }
        if (selectedVaccine) {
          vaxParams.set('vaccine_code', selectedVaccine);
        }
        if (selectedSpecies) {
          vaxParams.append('species_codes', selectedSpecies);
          disParams.append('species_codes', selectedSpecies);
        }
        if (dateRangeOption === '7d') {
          const d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
          vaxParams.set('start_date', d);
          disParams.set('start_date', d);
        } else if (dateRangeOption === '30d') {
          const d = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
          vaxParams.set('start_date', d);
          disParams.set('start_date', d);
        } else if (dateRangeOption === '90d') {
          const d = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
          vaxParams.set('start_date', d);
          disParams.set('start_date', d);
        }

        const [vaxRes, disRes] = await Promise.all([
          cachedJsonFetch<any>(apiBaseUrl, `/api/v1/analytics/vaccination?${vaxParams.toString()}`).catch(() => null),
          cachedJsonFetch<any>(apiBaseUrl, `/api/v1/analytics/disease?${disParams.toString()}`).catch(() => null),
        ]);

        if (!isMounted) return;

        const vaxMap = new Map<string, any>();
        if (vaxRes?.graphs?.district_comparison) {
          vaxRes.graphs.district_comparison.forEach((d: any) => {
            if (d.district_id) vaxMap.set(String(d.district_id), d);
            if (d.district_name_en) vaxMap.set(String(d.district_name_en).toLowerCase(), d);
          });
        }

        const disMap = new Map<string, any>();
        if (disRes?.graphs?.district_comparison) {
          disRes.graphs.district_comparison.forEach((d: any) => {
            if (d.district_id) disMap.set(String(d.district_id), d);
            if (d.district_name_en) disMap.set(String(d.district_name_en).toLowerCase(), d);
          });
        }

        setFilterAnalyticsData({ vaxDistrictMap: vaxMap, disDistrictMap: disMap });
      } catch (e) {
        console.warn('Filtered analytics fetch notice:', e);
      }
    };

    fetchFilteredAnalytics();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, selectedDisease, selectedVaccine, selectedSpecies, dateRangeOption]);

  // Load Real GIS Analytics from Backend when a Taluka is selected
  useEffect(() => {
    if (!selectedTaluka?.taluka_id) {
      setTalukaGisData(null);
      return;
    }
    let isMounted = true;
    adminService
      .getTahoGisAnalytics(apiBaseUrl, {
        taluka_id: selectedTaluka.taluka_id,
        layer_mode: layerMode,
        disease_code: selectedDisease || undefined,
        vaccine_code: selectedVaccine || undefined,
        species_code: selectedSpecies || undefined,
        coverage_range: coverageRange || undefined,
      })
      .then((res) => {
        if (isMounted) setTalukaGisData(res);
      })
      .catch((err) => {
        console.warn('Failed to load taluka GIS analytics:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedTaluka?.taluka_id, layerMode, selectedDisease, selectedVaccine, selectedSpecies, coverageRange, apiBaseUrl]);

  const handleDistrictSelect = async (props: any) => {
    setSelectedDistrict(props);
    setSelectedTaluka(null);
    setSelectedVillage(null);
    setVillagesGeoJson(null);
    // In DISTRICT view, keep user in DISTRICT view so district analytics drawer opens!
    if (props?.district_id) {
      setIsLoadingSubLayer(true);
      try {
        const tGeo = (!talukasGeoJson || talukasGeoJson.features?.length < 50)
          ? await adminService.getDistrictTalukasGeoJson(apiBaseUrl).catch(() => null)
          : talukasGeoJson;
        if (tGeo) setTalukasGeoJson(tGeo);
      } catch (err) {
        console.warn('District sub-data load error:', err);
      } finally {
        setIsLoadingSubLayer(false);
      }
    }
  };

  const handleTalukaSelect = async (props: any) => {
    setSelectedTaluka(props);
    setSelectedVillage(null);

    if (props.district_id && stateGeoJson?.features) {
      const matchFeat = stateGeoJson.features.find(
        (f: any) =>
          f.properties?.district_id === props.district_id ||
          (f.properties?.name_en && props.district_name && f.properties.name_en.toLowerCase() === props.district_name.toLowerCase())
      );
      if (matchFeat) setSelectedDistrict(matchFeat.properties);
    }

    if (props.taluka_id) {
      setIsLoadingSubLayer(true);
      try {
        const vGeo = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, props.taluka_id);
        setVillagesGeoJson(vGeo);
      } catch (err) {
        console.warn('Taluka villages load error:', err);
      } finally {
        setIsLoadingSubLayer(false);
      }
    } else {
      setVillagesGeoJson(null);
    }
  };

  const handleVillageSelect = (props: any) => {
    setSelectedVillage(props);
  };

  const handleViewLevelChange = async (level: 'DISTRICT' | 'TALUKA' | 'VILLAGE') => {
    setViewLevel(level);
    if (level === 'TALUKA') {
      if (!talukasGeoJson || talukasGeoJson.features?.length < 50) {
        setIsLoadingSubLayer(true);
        try {
          const tGeo = await adminService.getDistrictTalukasGeoJson(apiBaseUrl);
          setTalukasGeoJson(tGeo);
        } catch (e) {
          console.warn(e);
        } finally {
          setIsLoadingSubLayer(false);
        }
      }
    }
    if (level === 'VILLAGE') {
      if (selectedTaluka?.taluka_id && !villagesGeoJson) {
        setIsLoadingSubLayer(true);
        try {
          const vGeo = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, selectedTaluka.taluka_id);
          setVillagesGeoJson(vGeo);
        } catch (e) {
          console.warn(e);
        } finally {
          setIsLoadingSubLayer(false);
        }
      } else if (selectedDistrict?.district_id) {
        setIsLoadingSubLayer(true);
        try {
          let tGeo = talukasGeoJson;
          if (!tGeo || tGeo.features?.length < 10) {
            tGeo = await adminService.getDistrictTalukasGeoJson(apiBaseUrl);
            setTalukasGeoJson(tGeo);
          }
          const distTalukas = tGeo?.features?.filter(
            (f: any) => f.properties?.district_id === selectedDistrict.district_id
          );
          const firstTaluka = distTalukas && distTalukas.length > 0 ? distTalukas[0].properties : null;
          if (firstTaluka?.taluka_id) {
            setSelectedTaluka(firstTaluka);
            const vGeo = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, firstTaluka.taluka_id);
            setVillagesGeoJson(vGeo);
          }
        } catch (e) {
          console.warn('Map view villages fetch note:', e);
        } finally {
          setIsLoadingSubLayer(false);
        }
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedDisease('');
    setSelectedVaccine('');
    setSelectedSpecies('');
    setCoverageRange('');
    setDateRangeOption('all');
    setSearchQuery('');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedDisease) count++;
    if (selectedVaccine) count++;
    if (selectedSpecies) count++;
    if (coverageRange) count++;
    if (dateRangeOption !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [selectedDisease, selectedVaccine, selectedSpecies, coverageRange, dateRangeOption, searchQuery]);

  // Enriched District GeoJSON Strictly Using Real Database Records
  const enrichedDistrictsGeoJson = useMemo(() => {
    if (!stateGeoJson?.features) return stateGeoJson;
    const feats = stateGeoJson.features.map((f: any) => {
      const p = f.properties || {};
      const distId = p.district_id ? String(p.district_id) : '';
      const distCode = p.code ? String(p.code).toUpperCase() : '';
      const distName = p.name_en ? String(p.name_en).toLowerCase() : '';
      const distPropName = (p.district || p.name || p.name_en || '').toLowerCase().trim();

      // Match actual record from PostgreSQL
      const realPerf =
        districtPerformanceMap.get(distId) ||
        districtPerformanceMap.get(distCode) ||
        districtPerformanceMap.get(distName) ||
        districtPerformanceMap.get(distPropName);

      // Check if specific filter options are active
      const hasFilterConstraint = Boolean(
        selectedDisease || selectedVaccine || selectedSpecies || dateRangeOption !== 'all'
      );
      const vaxFiltered =
        filterAnalyticsData.vaxDistrictMap.get(distId) ||
        filterAnalyticsData.vaxDistrictMap.get(distCode) ||
        filterAnalyticsData.vaxDistrictMap.get(distName) ||
        filterAnalyticsData.vaxDistrictMap.get(distPropName);
      const disFiltered =
        filterAnalyticsData.disDistrictMap.get(distId) ||
        filterAnalyticsData.disDistrictMap.get(distCode) ||
        filterAnalyticsData.disDistrictMap.get(distName) ||
        filterAnalyticsData.disDistrictMap.get(distPropName);

      const animalCount = Number(
        hasFilterConstraint
          ? (vaxFiltered?.eligible_count ?? realPerf?.animal_count ?? p.animal_count ?? 0)
          : (realPerf?.animal_count ?? p.animal_count ?? 0)
      );
      const vaccinationCount = Number(
        hasFilterConstraint
          ? (vaxFiltered?.vaccinated_count ?? 0)
          : (realPerf?.vaccination_count ?? realPerf?.vaccinated_count ?? 0)
      );
      const diseaseCount = Number(
        hasFilterConstraint
          ? (disFiltered?.total_cases ?? 0)
          : (realPerf?.disease_count ?? realPerf?.active_alerts_count ?? 0)
      );
      const coveragePct = Number(
        hasFilterConstraint
          ? (vaxFiltered?.coverage_pct ?? 0.0)
          : (realPerf?.coverage_pct ?? realPerf?.vaccination_coverage_pct ?? 0.0)
      );
      const isAssigned = Boolean(realPerf?.is_assigned || realPerf?.assigned_daho || p.status === 'ASSIGNED');
      const dahoName = realPerf?.daho_name || realPerf?.assigned_daho?.full_name || p.daho_name || null;

      // Color computation strictly from real metrics
      let color = '#94A3B8'; // Slate for districts with no active pilot data yet
      if (layerMode === 'disease') {
        if (diseaseCount > 0) {
          color = '#DC2626'; // Red: real confirmed outbreak hotspot
        } else if (animalCount > 0) {
          color = '#10B981'; // Green: verified disease free
        } else {
          color = '#94A3B8'; // Slate: awaiting surveillance data
        }
      } else if (layerMode === 'risk') {
        if (diseaseCount > 0) {
          color = '#E11D48'; // High risk: active outbreak reports
        } else if (animalCount > 0 && coveragePct < 50) {
          color = '#F97316'; // Moderate risk: low coverage rate
        } else if (animalCount > 0) {
          color = '#10B981'; // Low risk
        } else {
          color = '#94A3B8';
        }
      } else if (layerMode === 'pending') {
        const pending = Math.max(0, animalCount - vaccinationCount);
        if (animalCount === 0) {
          color = '#94A3B8';
        } else if (pending > 100) {
          color = '#EA580C';
        } else if (pending > 20) {
          color = '#F59E0B';
        } else {
          color = '#10B981';
        }
      } else if (layerMode === 'population') {
        if (animalCount > 500) {
          color = '#4338CA';
        } else if (animalCount > 100) {
          color = '#6366F1';
        } else if (animalCount > 0) {
          color = '#A5B4FC';
        } else {
          color = '#CBD5E1';
        }
      } else {
        // 'coverage' mode
        if (animalCount === 0) {
          color = isAssigned ? '#135D43' : '#94A3B8';
        } else if (coveragePct >= 80) {
          color = '#10B981';
        } else if (coveragePct >= 50) {
          color = '#F59E0B';
        } else {
          color = '#EF4444';
        }
      }

      // Filter by coverage range if selected
      if (coverageRange === '<50' && (animalCount === 0 || coveragePct >= 50)) color = '#CBD5E1';
      if (coverageRange === '50-80' && (coveragePct < 50 || coveragePct > 80)) color = '#CBD5E1';
      if (coverageRange === '>80' && coveragePct < 80) color = '#CBD5E1';

      return {
        ...f,
        properties: {
          ...p,
          fill_color: color,
          fillColor: color,
          animal_count: animalCount,
          vaccination_count: vaccinationCount,
          disease_count: diseaseCount,
          coverage_pct: coveragePct,
          is_assigned: isAssigned,
          daho_name: dahoName,
          talukas_count: realPerf?.talukas_count || realPerf?.taluka_count || p.talukas_count || p.taluka_count || 0,
          villages_count: realPerf?.villages_count || realPerf?.village_count || p.villages_count || p.village_count || 0,
        },
      };
    });
    return { ...stateGeoJson, features: feats };
  }, [
    stateGeoJson,
    districtPerformanceMap,
    layerMode,
    coverageRange,
    filterAnalyticsData,
    selectedDisease,
    selectedVaccine,
    selectedSpecies,
    dateRangeOption,
  ]);

  // Enriched Talukas GeoJSON
  const enrichedTalukasGeoJson = useMemo(() => {
    if (!talukasGeoJson?.features) return talukasGeoJson;
    const feats = talukasGeoJson.features.map((f: any) => {
      const p = f.properties || {};
      const isSelected = p.taluka_id === selectedTaluka?.taluka_id;
      const isAssigned = Boolean(p.status === 'ASSIGNED' || p.is_assigned);

      const color = isSelected ? '#38BDF8' : isAssigned ? '#135D43' : '#0EA5E9';

      return {
        ...f,
        properties: {
          ...p,
          fill_color: color,
          fillColor: color,
          border_color: isSelected ? '#1D4ED8' : '#0F172A',
        },
      };
    });
    return { ...talukasGeoJson, features: feats };
  }, [talukasGeoJson, selectedTaluka]);

  // Enriched Villages GeoJSON Strictly Using Real GIS Analytics
  const enrichedVillagesGeoJson = useMemo(() => {
    if (!villagesGeoJson?.features) return villagesGeoJson;
    const metricsMap = new Map<string, any>();
    if (talukaGisData?.villages) {
      talukaGisData.villages.forEach((m: any) => metricsMap.set(m.village_id, m));
    }

    const feats = villagesGeoJson.features.map((f: any) => {
      const p = f.properties || {};
      const vId = p.village_id || p.id;
      const m = metricsMap.get(vId);
      const isSelected = vId === selectedVillage?.village_id;

      const coveragePct = Number(m?.coverage_pct ?? 0);
      const hasDisease = Boolean(m?.has_active_disease || (m?.disease_count ?? 0) > 0);
      const pendingCount = Number(m?.pending_count ?? 0);
      const animalCount = Number(m?.animal_count ?? 0);
      const vaxCount = Number(m?.vaccinated_count ?? 0);

      let color = m?.fill_color || '#E2E8F0';
      if (hasDisease && (layerMode === 'disease' || layerMode === 'risk')) {
        color = '#DC2626';
      } else if (hasDisease) {
        color = '#EF4444';
      }

      return {
        ...f,
        properties: {
          ...p,
          fill_color: color,
          fillColor: color,
          border_color: hasDisease ? '#991B1B' : isSelected ? '#1D4ED8' : '#0F172A',
          border_width: hasDisease ? 2.8 : isSelected ? 2.5 : 1,
          coverage_pct: coveragePct,
          disease_alert: hasDisease,
          disease_count: m?.disease_count ?? 0,
          pending_count: pendingCount,
          animal_count: animalCount,
          vaccinated_count: vaxCount,
        },
      };
    });
    return { ...villagesGeoJson, features: feats };
  }, [villagesGeoJson, talukaGisData, layerMode, selectedVillage]);

  // Dynamic Legend Items Matching Real Status
  const legendItems = useMemo(() => {
    if (layerMode === 'disease') {
      return [
        { color: '#DC2626', label: 'સક્રિય રોગચાળો / હોટસ્પોટ (Active Outbreak Hotspots)' },
        { color: '#10B981', label: 'રોગમુક્ત / સુરક્ષિત ક્ષેત્ર (Disease Free / Safe)' },
        { color: '#94A3B8', label: 'સર્વેલન્સ શરૂ બાકી (Awaiting Data)' },
      ];
    }
    if (layerMode === 'risk') {
      return [
        { color: '#E11D48', label: 'અતિ ઉચ્ચ જોખમ વિસ્તાર (High Risk Signal)' },
        { color: '#F97316', label: 'મધ્યમ જોખમ વિસ્તાર (Moderate Risk)' },
        { color: '#10B981', label: 'સામાન્ય / નિયંત્રિત (Low Risk)' },
      ];
    }
    if (layerMode === 'pending') {
      return [
        { color: '#EA580C', label: 'મોટો બાકી જથ્થો >100 પશુ (High Pending Backlog)' },
        { color: '#F59E0B', label: 'સાધારણ બાકી 20-100 પશુ (Moderate Pending)' },
        { color: '#10B981', label: 'ઓછા બાકી / પૂર્ણ સમકક્ષ (Low Pending)' },
      ];
    }
    if (layerMode === 'population') {
      return [
        { color: '#4338CA', label: 'ઉચ્ચ પશુધન ઘનતા >500 (High Density)' },
        { color: '#6366F1', label: 'મધ્યમ ઘનતા 100-500 (Medium Density)' },
        { color: '#A5B4FC', label: 'ઓછી ઘનતા <100 (Low Density)' },
      ];
    }
    return [
      { color: '#10B981', label: 'ઉચ્ચ કવરેજ >= ૮૦% (High Coverage)' },
      { color: '#F59E0B', label: 'મધ્યમ કવરેજ ૫૦-૭૯% (Moderate Coverage)' },
      { color: '#EF4444', label: 'ઓછું કવરેજ < ૫૦% (Low Coverage / Urgent)' },
      { color: '#135D43', label: 'DAHO સોંપાયેલ / પાઇલોટ ક્ષેત્ર (DAHO Assigned)' },
      { color: '#94A3B8', label: 'અનસાઇન / પાઇલોટ બાકી (Unassigned / Pending)' },
    ];
  }, [layerMode]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body animate-fade-in text-slate-800">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/overview')}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            {t('nav.overview') || 'Dashboard'}
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-base font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#135D43]" />
            ગુજરાત રાજ્ય વહીવટી અને આરોગ્ય GIS નકશો (State GIS Intelligence Portal)
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
            SUPER_ADMIN
          </span>
          {activeFiltersCount > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
              {activeFiltersCount} સક્રિય ફિલ્ટર્સ
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-amber-700 hover:bg-amber-50"
            >
              ફિલ્ટર્સ રીસેટ
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadMapData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/geography')}
            leftIcon={<Database className="w-3.5 h-3.5 text-[#135D43]" />}
          >
            માસ્ટર ડેટા
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/analytics')}
            leftIcon={<TrendingUp className="w-3.5 h-3.5" />}
          >
            ઇન્ફરન્સ ડેશબોર્ડ (Live Analytics)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/daho')}
            leftIcon={<Shield className="w-3.5 h-3.5" />}
          >
            DAHO સંચાલન
          </Button>
        </div>
      </div>

      {/* 2. Interactive Layer Mode Switcher & Filters Bar */}
      <Card className="p-3 bg-white border border-[#E2E8F0] shadow-xs space-y-3">
        {/* Layer Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>નકશા વિશ્લેષણ લેયર (GIS Visualization Layer):</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setLayerMode('coverage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                layerMode === 'coverage'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Syringe className="w-3.5 h-3.5" />
              <span>રસીકરણ કવરેજ દર</span>
            </button>

            <button
              onClick={() => setLayerMode('disease')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                layerMode === 'disease'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>રોગચાળો અને હોટસ્પોટ્સ</span>
            </button>

            <button
              onClick={() => setLayerMode('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                layerMode === 'pending'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>બાકી રસીકરણ બેકલોગ</span>
            </button>

            <button
              onClick={() => setLayerMode('risk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                layerMode === 'risk'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>રોગ જોખમ ચેતવણી (Risk Signal)</span>
            </button>

            <button
              onClick={() => setLayerMode('population')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                layerMode === 'population'
                  ? 'bg-indigo-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <PawPrint className="w-3.5 h-3.5" />
              <span>પશુધન વસ્તી ગીચતા</span>
            </button>
          </div>
        </div>

        {/* Filters Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* 1. Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="જિલ્લો / તાલુકો / ગામ શોધો..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* 2. Disease Selector */}
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ રોગ લક્ષ્યાંકો (All Diseases)</option>
            {masterDiseases.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name_gu} ({d.code})
              </option>
            ))}
            {!masterDiseases.length && (
              <>
                <option value="FMD">ખરવા-મોવાસા (FMD)</option>
                <option value="LSD">લમ્પી ત્વચા રોગ (LSD)</option>
                <option value="HS">ગળસૂંઠો (HS)</option>
                <option value="BQ">ગાંઠિયો તાવ (BQ)</option>
                <option value="BRUCELLOSIS">બ્રુસેલોસિસ (Brucellosis)</option>
                <option value="PPR">પીપીઆર (PPR)</option>
                <option value="ANTHRAX">કાળીયો તાવ (Anthrax)</option>
                <option value="RABIES">હડકવા (Rabies)</option>
              </>
            )}
          </select>

          {/* 3. Vaccine Selector */}
          <select
            value={selectedVaccine}
            onChange={(e) => setSelectedVaccine(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ અધિકૃત રસીઓ (All Vaccines)</option>
            {masterVaccines.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name_gu} ({v.code})
              </option>
            ))}
          </select>

          {/* 4. Species Selector */}
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ પશુ પ્રજાતિ (All Species)</option>
            <option value="CATTLE">ગાય (Cattle / Cow)</option>
            <option value="BUFFALO">ભેંસ (Buffalo)</option>
            <option value="GOAT">બકરી (Goat)</option>
            <option value="SHEEP">ઘેટાં (Sheep)</option>
            <option value="CAMEL">ઊંટ (Camel)</option>
            <option value="HORSE">ઘોડો (Horse)</option>
          </select>

          {/* 5. Coverage Range */}
          <select
            value={coverageRange}
            onChange={(e) => setCoverageRange(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ કવરેજ દર (All Coverage)</option>
            <option value=">80">ઉચ્ચ કવરેજ (&gt;= ૮૦%)</option>
            <option value="50-80">મધ્યમ કવરેજ (૫૦-૭૯%)</option>
            <option value="<50">ઓછું કવરેજ (&lt; ૫૦%)</option>
          </select>

          {/* 6. Date Range */}
          <select
            value={dateRangeOption}
            onChange={(e) => setDateRangeOption(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="all">સમગ્ર સમયગાળો (All Time)</option>
            <option value="7d">છેલ્લા ૭ દિવસ (Last 7 Days)</option>
            <option value="30d">છેલ્લા ૩૦ દિવસ (Last 30 Days)</option>
            <option value="90d">છેલ્લા ૯૦ દિવસ (Last 90 Days)</option>
          </select>
        </div>
      </Card>

      {/* 3. Main Map & Inspector Area */}
      {isLoading ? (
        <StateView state="loading" title={t('superAdmin.common.loading')} />
      ) : errorMsg ? (
        <StateView state="error" title={t('superAdmin.common.error')} message={errorMsg} onRetry={loadMapData} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Map (3 cols on large screen) */}
          <div className="lg:col-span-3 space-y-3">
            <Card className="p-0 overflow-hidden border border-[#E2E8F0] shadow-xs bg-white relative">
              {/* Dynamic Color Legend Overlay */}
              <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 shadow-md max-w-xs text-xs space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                    {layerMode === 'coverage'
                      ? 'રસીકરણ કવરેજ સંકેત'
                      : layerMode === 'disease'
                      ? 'રોગચાળો અને સર્વેલન્સ સંકેત'
                      : layerMode === 'pending'
                      ? 'બાકી રસીકરણ સંકેત'
                      : layerMode === 'risk'
                      ? 'રોગ જોખમ ચેતવણી'
                      : 'પશુધન વસ્તી સ્તર'}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-800 font-bold">
                    {viewLevel === 'DISTRICT' ? 'રાજ્ય સ્તર (૩૪ જિલ્લા)' : viewLevel === 'TALUKA' ? 'તાલુકા સ્તર' : 'ગામ સ્તર'}
                  </span>
                </div>

                <div className="space-y-1">
                  {legendItems.map((leg, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-xs shrink-0 border border-black/20"
                          style={{ backgroundColor: leg.color }}
                        />
                        <span className="text-slate-700">{leg.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map Instance with Dynamic Filter-Aware Colors */}
              <GujaratStateMap
                geoJsonData={enrichedDistrictsGeoJson}
                selectedDistrictId={selectedDistrict?.district_id}
                selectedDistrictProps={selectedDistrict}
                onDistrictSelect={handleDistrictSelect}
                onDistrictHover={(props) => setHoveredDistrict(props)}
                selectedTalukaId={selectedTaluka?.taluka_id}
                selectedTalukaProps={selectedTaluka}
                onTalukaSelect={handleTalukaSelect}
                selectedVillageId={selectedVillage?.village_id}
                selectedVillageProps={selectedVillage}
                onVillageSelect={handleVillageSelect}
                viewLevel={viewLevel}
                onViewLevelChange={handleViewLevelChange}
                talukasGeoJson={enrichedTalukasGeoJson}
                villagesGeoJson={enrichedVillagesGeoJson}
                isLoadingSubLayer={isLoadingSubLayer}
                enableDrawingMode={false}
                height="650px"
                title="ગુજરાત પશુરક્ષક GIS પોર્ટલ"
                subtitle="રાજ્ય, જિલ્લા, તાલુકા અને ગામડાઓનું રસીકરણ અને રોગ મોનિટરિંગ"
              />
            </Card>
          </div>

          {/* Hierarchical Drill-down Info Drawer (1 col) */}
          <div className="lg:col-span-1 space-y-3">
            {(() => {
              const activeDisplayDistrict = selectedDistrict || (viewLevel === 'DISTRICT' ? hoveredDistrict : null);
              const isDistrictHoverPreview = !selectedDistrict && Boolean(hoveredDistrict) && viewLevel === 'DISTRICT';
              const hasActiveSelection = Boolean(selectedVillage || selectedTaluka || activeDisplayDistrict);

              return (
                <Card className="p-4 border border-[#E2E8F0] shadow-xs bg-white text-xs">
                  <div className="border-b border-[#E2E8F0] pb-2.5 mb-3">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                        {selectedVillage
                          ? 'ગામ વિશ્લેષણ (Village Analytics)'
                          : selectedTaluka
                          ? 'તાલુકો વિશ્લેષણ (Taluka Analytics)'
                          : isDistrictHoverPreview
                          ? 'જિલ્લો પૂર્વાવલોકન (Hover Preview)'
                          : 'જિલ્લો વિશ્લેષણ (District Analytics)'}
                      </span>
                      {isDistrictHoverPreview && (
                        <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          હોવર પૂર્વાવલોકન
                        </span>
                      )}
                      {selectedDistrict && viewLevel === 'DISTRICT' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          પસંદ કરેલ જિલ્લો
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#0F172A] font-heading mt-0.5 break-words">
                      {selectedVillage
                        ? selectedVillage.name_gu || selectedVillage.name_en
                        : selectedTaluka
                        ? selectedTaluka.name_gu || selectedTaluka.name_en
                        : activeDisplayDistrict
                        ? localizeDistrict(activeDisplayDistrict)
                        : 'વિગત જોવા માટે નકશા પર જિલ્લો પસંદ કરો'}
                    </h3>
                    {hasActiveSelection && (
                      <p className="text-[11px] text-[#64748B]">
                        {selectedVillage
                          ? `${selectedVillage.name_en} (${selectedVillage.code || 'VIL'})`
                          : selectedTaluka
                          ? `${selectedTaluka.name_en} (${selectedTaluka.code || 'TAL'})`
                          : activeDisplayDistrict
                          ? `${activeDisplayDistrict.name_en || ''} (${activeDisplayDistrict.code || activeDisplayDistrict.district_code || 'DIST'})`
                          : ''}
                      </p>
                    )}
                  </div>

                  {/* Inferences breakdown strictly from real records */}
                  {hasActiveSelection ? (
                    <div className="space-y-3">
                      {activeFiltersCount > 0 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg text-[10px] space-y-0.5">
                          <span className="font-bold block">સક્રિય ફિલ્ટર લાગુ કરેલ:</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedDisease && <span className="bg-white/80 px-1 py-0.5 rounded">રોગ: {selectedDisease}</span>}
                            {selectedVaccine && <span className="bg-white/80 px-1 py-0.5 rounded">રસી: {selectedVaccine}</span>}
                            {selectedSpecies && <span className="bg-white/80 px-1 py-0.5 rounded">પ્રજાતિ: {selectedSpecies}</span>}
                            {coverageRange && <span className="bg-white/80 px-1 py-0.5 rounded">કવરેજ: {coverageRange}%</span>}
                            {dateRangeOption !== 'all' && <span className="bg-white/80 px-1 py-0.5 rounded">સમય: {dateRangeOption}</span>}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                        <span className="text-emerald-800 font-medium">DAHO સોંપણી સ્થિતિ:</span>
                        <StatusChip
                          status={activeDisplayDistrict?.is_assigned || activeDisplayDistrict?.daho_name ? 'ACTIVE' : 'DRAFT'}
                          label={activeDisplayDistrict?.daho_name ? `${activeDisplayDistrict.daho_name} (નિયુક્ત)` : 'ખાલી (Unassigned)'}
                        />
                      </div>

                      {/* Metrics summary card from authentic database values */}
                      <div className="space-y-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0]">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[#64748B]">નોંધાયેલ પશુધન:</span>
                          <span className="font-mono font-bold text-[#0F172A]">
                            {selectedVillage?.animal_count ?? activeDisplayDistrict?.animal_count ?? 0} પશુઓ
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[#64748B]">કુલ રસીકરણ ડોઝ:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {selectedVillage?.vaccinated_count ?? activeDisplayDistrict?.vaccination_count ?? 0} ડોઝ
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[#64748B]">સરેરાશ રસીકરણ કવરેજ:</span>
                          <span className="font-bold text-emerald-700">
                            {selectedVillage?.coverage_pct ?? activeDisplayDistrict?.coverage_pct ?? 0}%
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, selectedVillage?.coverage_pct ?? activeDisplayDistrict?.coverage_pct ?? 0)}%`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#E2E8F0]">
                          <span className="text-[#64748B]">રોગ સર્વેલન્સ કેસ:</span>
                          <span className={`font-bold ${(selectedVillage?.disease_count ?? activeDisplayDistrict?.disease_count ?? 0) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {(selectedVillage?.disease_count ?? activeDisplayDistrict?.disease_count ?? 0) > 0
                              ? `${selectedVillage?.disease_count ?? activeDisplayDistrict?.disease_count} કેસ નોંધાયેલ`
                              : 'કોઈ રોગ નથી (સુરક્ષિત)'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[#64748B]">કુલ તાલુકા / ગામો:</span>
                          <span className="font-semibold text-[#0F172A]">
                            {activeDisplayDistrict?.talukas_count || activeDisplayDistrict?.taluka_count || '-'} તાલુકા • {activeDisplayDistrict?.villages_count || activeDisplayDistrict?.village_count || '-'} ગામો
                          </span>
                        </div>

                        {selectedVillage?.census_code && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-[#64748B]">LGD/Census કોડ:</span>
                            <span className="font-mono text-[#0F172A]">{selectedVillage.census_code}</span>
                          </div>
                        )}
                      </div>

                      {/* Navigation drill-down buttons */}
                      <div className="pt-2 space-y-1.5">
                        {viewLevel === 'DISTRICT' && activeDisplayDistrict && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full justify-center bg-[#135D43] hover:bg-[#0f4a35] text-white"
                              onClick={() => {
                                handleDistrictSelect(activeDisplayDistrict);
                                handleViewLevelChange('TALUKA');
                              }}
                            >
                              આ જિલ્લાના તાલુકાઓ જુઓ (Explore Talukas) ➔
                            </Button>
                            {selectedDistrict && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-center text-slate-600 border-slate-300"
                                onClick={() => setSelectedDistrict(null)}
                              >
                                પસંદગી રદ કરો (Clear Pin)
                              </Button>
                            )}
                          </>
                        )}
                        {selectedVillage && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-center"
                            onClick={() => {
                              setViewLevel('TALUKA');
                              setSelectedVillage(null);
                            }}
                          >
                            તાલુકા વ્યુ પર પાછા જાઓ
                          </Button>
                        )}
                        {selectedTaluka && !selectedVillage && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-center"
                            onClick={() => {
                              setViewLevel('DISTRICT');
                              setSelectedTaluka(null);
                            }}
                          >
                            જિલ્લા વ્યુ પર પાછા જાઓ
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 space-y-2">
                      <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                      <p>નકશા પર કોઈપણ જિલ્લો અથવા તાલુકો પસંદ કરો તેની સંપૂર્ણ સાચી ડેટાબેઝ વિગતો જોવા માટે.</p>
                    </div>
                  )}
                </Card>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStateMapView;
