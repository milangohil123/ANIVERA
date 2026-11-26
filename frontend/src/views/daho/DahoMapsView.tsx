import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { StateView } from '../../components/common/StateView';
import { StatusChip } from '../../components/common/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { GoogleMapViewer, type MapLayerMode } from '../../components/maps/GoogleMapViewer';
import { GujaratStateMap } from '../../components/maps/GujaratStateMap';
import { adminService } from '../../services/adminService';
import { masterService, type DiseaseItem, type VaccineItem } from '../../services/masterService';
import {
  mapService,
  type MapLayersResponse,
} from '../../services/mapService';
import {
  RotateCcw,
  Table as TableIcon,
  Map as MapIcon,
  MapPin,
  Layers,
  Syringe,
  Activity,
  Clock,
  Megaphone,
  PawPrint,
  ShieldAlert,
  Search,
  Filter,
} from 'lucide-react';

type GisTabMode = 'ADMIN_BOUNDARIES' | 'TELEMETRY' | 'TABLE';
export type LayerMode = 'coverage' | 'disease' | 'pending' | 'risk' | 'population';

export const DahoMapsView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlView = searchParams.get('view');
  const urlTalukaId = searchParams.get('taluka_id');

  const { apiBaseUrl, session, scope, profile, selectedDistrictId, assignedDistricts } = useAuth();
  const token = session?.accessToken || '';

  const activeDistrictId =
    selectedDistrictId ||
    assignedDistricts[0]?.id ||
    assignedDistricts[0]?.district_id ||
    scope?.assigned_districts?.[0] ||
    profile?.assigned_districts?.[0];

  const currentDistrictObj = assignedDistricts.find(
    (d: any) => (d.id || d.district_id) === activeDistrictId
  ) || null;

  const currentDistrictNameGu = currentDistrictObj?.name_gu || 'જિલ્લો';

  const [gisTab, setGisTab] = useState<GisTabMode>('ADMIN_BOUNDARIES');
  const [viewLevel, setViewLevel] = useState<'DISTRICT' | 'TALUKA' | 'VILLAGE'>(
    urlView === 'village' ? 'VILLAGE' : 'TALUKA'
  );
  const [selectedTalukaId, setSelectedTalukaId] = useState<string | undefined>(
    urlTalukaId || undefined
  );
  const [selectedTalukaProps, setSelectedTalukaProps] = useState<any | null>(null);
  const [selectedVillageProps, setSelectedVillageProps] = useState<any | null>(null);

  const [talukasGeoJson, setTalukasGeoJson] = useState<any | null>(null);
  const [villagesGeoJson, setVillagesGeoJson] = useState<any | null>(null);
  const [isLoadingSubLayer, setIsLoadingSubLayer] = useState<boolean>(false);

  // Filters State
  const [layerMode, setLayerMode] = useState<LayerMode>('coverage');
  const [masterDiseases, setMasterDiseases] = useState<DiseaseItem[]>([]);
  const [masterVaccines, setMasterVaccines] = useState<VaccineItem[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<string>('');
  const [selectedVaccine, setSelectedVaccine] = useState<string>('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [coverageRange, setCoverageRange] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [talukaGisData, setTalukaGisData] = useState<any | null>(null);

  const [layerData, setLayerData] = useState<MapLayersResponse | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerMode>('VACCINATION');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoadDoneRef = useRef(false);

  const loadLayers = useCallback(async (isSilent = false) => {
    if (!token) return;

    if (!isInitialLoadDoneRef.current) {
      setIsLoading(true);
    } else if (!isSilent) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const [data, diseases, vaccines, tGeo] = await Promise.all([
        mapService.getLayers(apiBaseUrl, token),
        masterService.listDiseases(apiBaseUrl, true).catch(() => []),
        masterService.listVaccines(apiBaseUrl).catch(() => []),
        adminService.getDistrictTalukasGeoJson(apiBaseUrl).catch(() => null),
      ]);
      setLayerData(data);
      setMasterDiseases(diseases);
      setMasterVaccines(vaccines);
      if (tGeo) setTalukasGeoJson(tGeo);
      isInitialLoadDoneRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'નકશા ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    loadLayers(false);
  }, [apiBaseUrl]);

  // Load Taluka GIS Analytics and Village GeoJSON when Taluka changes
  useEffect(() => {
    if (!selectedTalukaId) return;
    let isMounted = true;
    setIsLoadingSubLayer(true);

    Promise.all([
      adminService.getTalukaVillagesGeoJson(apiBaseUrl, selectedTalukaId).catch(() => null),
      adminService.getTahoGisAnalytics(apiBaseUrl, {
        taluka_id: selectedTalukaId,
        layer_mode: layerMode,
        disease_code: selectedDisease || undefined,
        vaccine_code: selectedVaccine || undefined,
        species_code: selectedSpecies || undefined,
        coverage_range: coverageRange || undefined,
      }).catch(() => null),
    ]).then(([vGeo, gisRes]) => {
      if (isMounted) {
        if (vGeo) setVillagesGeoJson(vGeo);
        if (gisRes) setTalukaGisData(gisRes);
        setIsLoadingSubLayer(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedTalukaId, layerMode, selectedDisease, selectedVaccine, selectedSpecies, coverageRange, apiBaseUrl]);

  const handleResetFilters = () => {
    setSelectedDisease('');
    setSelectedVaccine('');
    setSelectedSpecies('');
    setCoverageRange('');
    setSearchQuery('');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedDisease) count++;
    if (selectedVaccine) count++;
    if (selectedSpecies) count++;
    if (coverageRange) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [selectedDisease, selectedVaccine, selectedSpecies, coverageRange, searchQuery]);

  const mappedVillages = useMemo(() => layerData?.mappedVillages || [], [layerData?.mappedVillages]);
  const unmappedVillages = useMemo(() => layerData?.unmappedVillages || [], [layerData?.unmappedVillages]);
  const surveillanceLayer = useMemo(() => layerData?.surveillanceLayer || {}, [layerData?.surveillanceLayer]);
  const vaccinationLayer = useMemo(() => layerData?.vaccinationLayer || {}, [layerData?.vaccinationLayer]);

  // Color generator based on mode & metrics
  const getEntityColor = (coveragePct: number, hasDiseaseAlert: boolean, pendingCount: number) => {
    if (layerMode === 'disease') {
      return hasDiseaseAlert ? '#DC2626' : '#10B981';
    }
    if (layerMode === 'risk') {
      return hasDiseaseAlert ? '#E11D48' : coveragePct < 50 ? '#F97316' : '#10B981';
    }
    if (layerMode === 'pending') {
      return pendingCount > 100 ? '#EA580C' : pendingCount > 20 ? '#F59E0B' : '#10B981';
    }
    if (layerMode === 'population') {
      return '#6366F1';
    }
    if (coveragePct >= 80) return '#10B981';
    if (coveragePct >= 50) return '#F59E0B';
    return '#EF4444';
  };

  // Enriched Talukas GeoJSON strictly calculated from real database records
  const enrichedTalukasGeoJson = useMemo(() => {
    if (!talukasGeoJson?.features) return talukasGeoJson;

    // Build real taluka aggregation from real mapped villages & layers
    const talukaMetrics = new Map<string, { totalTarget: number; totalVax: number; diseaseCount: number }>();
    if (mappedVillages.length > 0) {
      mappedVillages.forEach((v: any) => {
        const tId = v.taluka_id ? String(v.taluka_id) : '';
        const tName = (v.taluka_name || '').toLowerCase();
        const vax = vaccinationLayer[v.id];
        const dis = surveillanceLayer[v.id];

        const target = Number(vax?.targetCount ?? vax?.total_animals ?? 0);
        const vaccinated = Number(vax?.vaccinatedCount ?? vax?.vaccinated_animals ?? 0);
        const cases = Number(dis?.caseCount ?? dis?.active_alerts ?? 0);

        [tId, tName].filter(Boolean).forEach((key) => {
          const curr = talukaMetrics.get(key) || { totalTarget: 0, totalVax: 0, diseaseCount: 0 };
          curr.totalTarget += target;
          curr.totalVax += vaccinated;
          curr.diseaseCount += cases;
          talukaMetrics.set(key, curr);
        });
      });
    }

    const feats = talukasGeoJson.features.map((f: any) => {
      const p = f.properties || {};
      const tId = p.taluka_id ? String(p.taluka_id) : p.id ? String(p.id) : '';
      const tCode = (p.code || '').toLowerCase();
      const tName = (p.name_en || '').toLowerCase();

      const realAgg = talukaMetrics.get(tId) || talukaMetrics.get(tCode) || talukaMetrics.get(tName);
      const totalTarget = realAgg?.totalTarget ?? (p.target_animals || p.animal_count || 0);
      const totalVax = realAgg?.totalVax ?? (p.vaccinated_animals || p.vaccination_count || 0);
      const diseaseCount = realAgg?.diseaseCount ?? (p.disease_count || 0);

      const coveragePct = totalTarget > 0 ? Math.min(100, Math.round((totalVax / totalTarget) * 100)) : (p.coverage_pct || 0);
      const hasDiseaseAlert = diseaseCount > 0;
      const pendingCount = Math.max(0, totalTarget - totalVax);

      let color = getEntityColor(coveragePct, hasDiseaseAlert, pendingCount);
      if (coverageRange === '<50' && coveragePct >= 50) color = '#E2E8F0';
      if (coverageRange === '50-80' && (coveragePct < 50 || coveragePct > 80)) color = '#E2E8F0';
      if (coverageRange === '>80' && coveragePct < 80) color = '#E2E8F0';

      return {
        ...f,
        properties: {
          ...p,
          fill_color: color,
          fillColor: color,
          coverage_pct: coveragePct,
          has_disease_alert: hasDiseaseAlert,
          pending_count: pendingCount,
          animal_count: totalTarget,
          vaccination_count: totalVax,
          disease_count: diseaseCount,
        },
      };
    });
    return { ...talukasGeoJson, features: feats };
  }, [talukasGeoJson, mappedVillages, vaccinationLayer, surveillanceLayer, layerMode, selectedDisease, coverageRange]);

  // Enriched Villages GeoJSON strictly calculated from real database records
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
      const sItem = surveillanceLayer[vId];
      const vItem = vaccinationLayer[vId];

      const coveragePct = Number(m?.coverage_pct ?? vItem?.coveragePct ?? p.coverage_pct ?? 0);
      const hasDisease = Boolean(m?.has_active_disease || (m?.disease_count ?? 0) > 0 || (sItem?.caseCount ?? 0) > 0 || p.disease_alert);
      const pendingCount = Number(m?.pending_count ?? vItem?.pendingCount ?? Math.max(0, (p.total_animals || 0) - (p.vaccinated_animals || 0)));

      let color = m?.fill_color || getEntityColor(coveragePct, hasDisease, pendingCount);
      if (hasDisease && (layerMode === 'disease' || layerMode === 'risk')) {
        color = '#DC2626';
      }

      return {
        ...f,
        properties: {
          ...p,
          fill_color: color,
          fillColor: color,
          border_color: hasDisease ? '#991B1B' : '#0F172A',
          border_width: hasDisease ? 2.8 : 1,
          coverage_pct: coveragePct,
          disease_alert: hasDisease,
          pending_count: pendingCount,
          animal_count: m?.total_animals ?? vItem?.targetCount ?? p.total_animals ?? 0,
          vaccinated_count: m?.vaccinated_animals ?? vItem?.vaccinatedCount ?? p.vaccinated_animals ?? 0,
          disease_count: m?.disease_count ?? sItem?.caseCount ?? 0,
        },
      };
    });
    return { ...villagesGeoJson, features: feats };
  }, [villagesGeoJson, talukaGisData, surveillanceLayer, vaccinationLayer, layerMode, selectedDisease]);

  const legendItems = useMemo(() => {
    if (layerMode === 'disease') {
      return [
        { color: '#DC2626', label: 'સક્રિય રોગચાળો / હોટસ્પોટ (Active Outbreak Hotspots)' },
        { color: '#F97316', label: 'શંકાસ્પદ કેસ / તપાસ હેઠળ (Under Investigation)' },
        { color: '#10B981', label: 'કોઈ રોગ નથી / સુરક્ષિત ક્ષેત્ર (Disease Free Zones)' },
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
        { color: '#4338CA', label: 'ઉચ્ચ પશુધન ઘનતા (High Animal Density)' },
        { color: '#6366F1', label: 'મધ્યમ ઘનતા (Medium Density)' },
        { color: '#A5B4FC', label: 'ઓછી ઘનતા (Low Density)' },
      ];
    }
    return [
      { color: '#10B981', label: 'ઉચ્ચ કવરેજ >= ૮૦% (High Coverage)' },
      { color: '#F59E0B', label: 'મધ્યમ કવરેજ ૫૦-૭૯% (Moderate Coverage)' },
      { color: '#EF4444', label: 'ઓછું કવરેજ < ૫૦% (Low Coverage / Urgent)' },
    ];
  }, [layerMode]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10 animate-fade-in font-body text-slate-800">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#135D43]" />
          <h2 className="text-sm font-bold text-[#0F172A] font-heading">
            {currentDistrictNameGu} ભૌગોલિક વહીવટી અને આરોગ્ય નકશો (District GIS Portal)
          </h2>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
            DAHO_SCOPE
          </span>
          {activeFiltersCount > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
              {activeFiltersCount} સક્રિય ફિલ્ટર્સ
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
            <button
              onClick={() => setGisTab('ADMIN_BOUNDARIES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                gisTab === 'ADMIN_BOUNDARIES'
                  ? 'bg-white shadow-xs text-[#135D43]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>વહીવટી સીમા નકશો (GIS)</span>
            </button>
            <button
              onClick={() => setGisTab('TELEMETRY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                gisTab === 'TELEMETRY'
                  ? 'bg-white shadow-xs text-[#135D43]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>રસીકરણ/રોગ મોનિટરિંગ</span>
            </button>
            <button
              onClick={() => setGisTab('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                gisTab === 'TABLE'
                  ? 'bg-white shadow-xs text-[#135D43]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>કોષ્ટક (Table)</span>
            </button>
          </div>

          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-amber-700 hover:bg-amber-50 text-xs py-1.5"
            >
              ફિલ્ટર્સ રીસેટ
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLayers(false)}
            isLoading={isRefreshing}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />}
            className="text-xs py-1.5"
          >
            તાજું કરો
          </Button>
        </div>
      </div>

      {/* 2. Interactive Layer Mode Switcher & Filters Bar */}
      <Card className="p-3 bg-white border border-[#E2E8F0] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>નકશા વિશ્લેષણ લેયર (GIS Layer):</span>
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
              <span>રોગચાળો અને સર્વેલન્સ</span>
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
              <span>રોગ જોખમ ચેતવણી</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ગામ / તાલુકો શોધો..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

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
              </>
            )}
          </select>

          <select
            value={selectedVaccine}
            onChange={(e) => setSelectedVaccine(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ રસીઓ (All Vaccines)</option>
            {masterVaccines.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name_gu} ({v.code})
              </option>
            ))}
          </select>

          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ પશુ પ્રજાતિ (All Species)</option>
            <option value="CATTLE">ગાય (Cattle)</option>
            <option value="BUFFALO">ભેંસ (Buffalo)</option>
            <option value="GOAT">બકરી (Goat)</option>
            <option value="SHEEP">ઘેટાં (Sheep)</option>
          </select>

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
        </div>
      </Card>

      {/* 3. Main View Area */}
      {gisTab === 'ADMIN_BOUNDARIES' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <Card className="overflow-hidden border border-[#E2E8F0] shadow-xs bg-white p-0 relative">
              {/* Dynamic Legend */}
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
                    {viewLevel === 'TALUKA' ? 'તાલુકા સ્તર' : 'ગામ સ્તર'}
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

              <GujaratStateMap
                viewLevel={viewLevel}
                onViewLevelChange={setViewLevel}
                selectedDistrictId={activeDistrictId}
                selectedTalukaId={selectedTalukaId}
                selectedTalukaProps={selectedTalukaProps}
                onTalukaSelect={(tp) => {
                  setSelectedTalukaId(tp?.taluka_id);
                  setSelectedTalukaProps(tp);
                }}
                selectedVillageId={selectedVillageProps?.village_id}
                selectedVillageProps={selectedVillageProps}
                onVillageSelect={(vp) => setSelectedVillageProps(vp)}
                talukasGeoJson={enrichedTalukasGeoJson}
                villagesGeoJson={enrichedVillagesGeoJson}
                isLoadingSubLayer={isLoadingSubLayer}
                height="650px"
                title={`${currentDistrictNameGu} સત્તાવાર GIS નકશો`}
                subtitle="જિલ્લાના તાલુકા અને ગામડાઓનું રંગ-કોડેડ રસીકરણ અને રોગ મોનિટરિંગ"
              />
            </Card>
          </div>

          {/* Right Inspector Drawer */}
          <div className="lg:col-span-1 space-y-3">
            <Card className="p-4 border border-[#E2E8F0] shadow-xs bg-white text-xs">
              <div className="border-b border-[#E2E8F0] pb-2.5 mb-3">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                  {selectedVillageProps
                    ? 'ગામ વિશ્લેષણ (Village Analytics)'
                    : selectedTalukaProps
                    ? 'તાલુકો વિશ્લેષણ (Taluka Analytics)'
                    : 'જિલ્લા વિહંગાવલોકન'}
                </span>
                <h3 className="text-base font-bold text-[#0F172A] font-heading mt-0.5 break-words">
                  {selectedVillageProps
                    ? selectedVillageProps.name_gu || selectedVillageProps.name_en
                    : selectedTalukaProps
                    ? selectedTalukaProps.name_gu || selectedTalukaProps.name_en
                    : currentDistrictNameGu}
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-medium">સ્થિતિ:</span>
                  <StatusChip status="ACTIVE" label="ચકાસાયેલ GIS પોલિગોન" />
                </div>

                <div className="space-y-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0]">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#64748B]">રસીકરણ સિદ્ધિ દર:</span>
                    <span className="font-bold text-emerald-700">
                      {selectedVillageProps?.coverage_pct ?? selectedTalukaProps?.coverage_pct ?? 0}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, selectedVillageProps?.coverage_pct ?? selectedTalukaProps?.coverage_pct ?? 0)}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1">
                    <span className="text-[#64748B]">રોગ સર્વેલન્સ એલર્ટ:</span>
                    <span className={`font-bold ${(selectedVillageProps?.disease_alert || selectedTalukaProps?.has_disease_alert || (selectedVillageProps?.disease_count ?? selectedTalukaProps?.disease_count ?? 0) > 0) ? 'text-red-600' : 'text-emerald-700'}`}>
                      {(selectedVillageProps?.disease_alert || selectedTalukaProps?.has_disease_alert || (selectedVillageProps?.disease_count ?? selectedTalukaProps?.disease_count ?? 0) > 0) ? 'સક્રિય કેસ' : 'સુરક્ષિત'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#64748B]">બાકી રસીકરણ:</span>
                    <span className="font-mono font-bold text-amber-700">
                      {selectedVillageProps?.pending_count ?? selectedTalukaProps?.pending_count ?? 0} પશુઓ
                    </span>
                  </div>
                </div>

                {selectedVillageProps && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      setViewLevel('TALUKA');
                      setSelectedVillageProps(null);
                    }}
                  >
                    તાલુકા વ્યુ પર પાછા જાઓ
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : isLoading ? (
        <StateView state="loading" message="જિલ્લા જીઓસ્પેશિયલ નકશો લોડ થઈ રહ્યો છે..." />
      ) : error ? (
        <StateView state="error" message={error} onRetry={loadLayers} />
      ) : gisTab === 'TELEMETRY' ? (
        <GoogleMapViewer
          mappedVillages={mappedVillages}
          unmappedVillages={unmappedVillages}
          surveillanceLayer={surveillanceLayer}
          vaccinationLayer={vaccinationLayer}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          roleScope="DAHO"
          title={`${currentDistrictNameGu} ભૌગોલિક પોર્ટલ (DAHO District GIS)`}
          subtitle="જિલ્લાના તમામ તાલુકા અને ગામડાઓમાં રસીકરણ સિદ્ધિ દર અને રોગ સર્વેક્ષણ જીઓ-મોનિટરિંગ."
        />
      ) : (
        /* Table View */
        <Card className="overflow-hidden border border-[#E2E8F0] shadow-xs">
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] font-heading">
                જિલ્લા ગામવાર રસીકરણ કવરેજ અને રોગ સર્વેક્ષણ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentDistrictNameGu} અધિકૃત ડેટાબેઝ રેકોર્ડ્સ
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
              કુલ ગામ: {mappedVillages.length + unmappedVillages.length}
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-slate-500 border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">ગામનું નામ</th>
                <th className="p-3.5">કોડ</th>
                <th className="p-3.5">સ્થાન સ્થિતિ</th>
                <th className="p-3.5 text-right">શંકાસ્પદ કેસ</th>
                <th className="p-3.5 text-right">પુષ્ટિ થયેલ કેસ</th>
                <th className="p-3.5 text-right">રસીકરણ સંખ્યા</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {[...mappedVillages, ...unmappedVillages].map((v) => {
                const surv = surveillanceLayer[v.villageId];
                const vac = vaccinationLayer[v.villageId];
                return (
                  <tr key={v.villageId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-[#0F172A]">{v.nameGu}</td>
                    <td className="p-3.5 font-mono text-slate-500">{v.code}</td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                        <MapPin className="w-2.5 h-2.5 text-slate-500" />
                        {v.latitude ? 'ચકાસાયેલ જીઓ-પોઇન્ટ' : 'સંદર્ભ જીઓ-પોઇન્ટ'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-amber-700">
                      {surv?.suspectedCount || 0}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-red-700">
                      {surv?.confirmedCount || 0}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-800">
                      {vac?.totalVaccinatedCount || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export default DahoMapsView;
