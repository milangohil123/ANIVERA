import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { GujaratStateMap } from '../../components/maps/GujaratStateMap';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  MapPin,
  Search,
  Filter,
  Users,
  PawPrint,
  Syringe,
  Activity,
  Layers,
  RotateCcw,
  AlertTriangle,
  Phone,
  Calendar,
  X,
  CheckCircle2,
  Clock,
  Megaphone,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Sparkles,
  PieChart,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

export type LayerMode = 'coverage' | 'disease' | 'pending' | 'campaign' | 'population' | 'risk';

export const TahoMapsView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlVillageId = searchParams.get('village_id');
  const { apiBaseUrl, profile, selectedTalukaId } = useAuth();

  // Core Data States
  const [overview, setOverview] = useState<any | null>(null);
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [baseVillagesGeoJson, setBaseVillagesGeoJson] = useState<any | null>(null);
  const [gisData, setGisData] = useState<any | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<any | null>(null);
  const [villageAnalytics, setVillageAnalytics] = useState<any | null>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState<boolean>(false);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'charts'>('map');
  const [activeDrawerTab, setActiveDrawerTab] = useState<'info' | 'vax' | 'disease' | 'campaign' | 'staff'>('info');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Filter States
  const [layerMode, setLayerMode] = useState<LayerMode>('coverage');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVaccine, setSelectedVaccine] = useState<string>('');
  const [selectedDisease, setSelectedDisease] = useState<string>('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [selectedVaxStatus, setSelectedVaxStatus] = useState<string>('');
  const [selectedDiseaseStatus, setSelectedDiseaseStatus] = useState<string>('');
  const [dateRangeOption, setDateRangeOption] = useState<string>('all');
  const [selectedVo, setSelectedVo] = useState<string>('');
  const [selectedFw, setSelectedFw] = useState<string>('');
  const [coverageRange, setCoverageRange] = useState<string>('');

  // 1. Initial Load of Taluka Hierarchy and Base GeoJSON
  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ov, hier] = await Promise.all([
        adminService.getTahoOverview(apiBaseUrl, selectedTalukaId || undefined),
        adminService.getTahoHierarchy(apiBaseUrl, selectedTalukaId || undefined).catch(() => null),
      ]);
      setOverview(ov);
      setHierarchy(hier);

      if (ov?.taluka_id) {
        const vGeo = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, ov.taluka_id).catch(() => null);
        setBaseVillagesGeoJson(vGeo);
      }
    } catch (err: any) {
      console.warn('Initial load error:', err);
      setError(err?.message || 'તાલુકા નકશા ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [apiBaseUrl, selectedTalukaId]);

  // 2. Fetch Filter-aware GIS Analytics from Backend
  const fetchGisAnalytics = async () => {
    const activeTalukaId = selectedTalukaId || overview?.taluka_id;
    if (!activeTalukaId) return;
    setIsFiltering(true);

    // Calculate dates based on dateRangeOption
    let start_date: string | undefined = undefined;
    let end_date: string | undefined = undefined;
    const now = new Date();
    if (dateRangeOption === '7d') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start_date = d.toISOString().split('T')[0];
    } else if (dateRangeOption === '30d') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start_date = d.toISOString().split('T')[0];
    } else if (dateRangeOption === '90d') {
      const d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      start_date = d.toISOString().split('T')[0];
    }

    try {
      const res = await adminService.getTahoGisAnalytics(apiBaseUrl, {
        taluka_id: activeTalukaId,
        layer_mode: layerMode,
        vaccine_code: selectedVaccine || undefined,
        disease_code: selectedDisease || undefined,
        campaign_id: selectedCampaign || undefined,
        species_code: selectedSpecies || undefined,
        vaccination_status: selectedVaxStatus || undefined,
        disease_status: selectedDiseaseStatus || undefined,
        start_date,
        end_date,
        vo_id: selectedVo || undefined,
        fw_id: selectedFw || undefined,
        coverage_range: coverageRange || undefined,
      });
      setGisData(res);
    } catch (err: any) {
      console.warn('Failed to fetch GIS analytics:', err);
    } finally {
      setIsFiltering(false);
    }
  };

  // Re-fetch GIS analytics whenever layer or filter parameters change
  useEffect(() => {
    if (overview?.taluka_id) {
      fetchGisAnalytics();
    }
  }, [
    overview?.taluka_id,
    layerMode,
    selectedVaccine,
    selectedDisease,
    selectedCampaign,
    selectedSpecies,
    selectedVaxStatus,
    selectedDiseaseStatus,
    dateRangeOption,
    selectedVo,
    selectedFw,
    coverageRange,
  ]);

  // 3. Merge Computed Colors & Metrics into villagesGeoJson for MapLibre Rendering
  const enrichedVillagesGeoJson = useMemo(() => {
    if (!baseVillagesGeoJson || !baseVillagesGeoJson.features) return null;
    const metricsMap = new Map<string, any>();
    if (gisData?.villages) {
      gisData.villages.forEach((m: any) => {
        metricsMap.set(m.village_id, m);
      });
    }

    const enrichedFeatures = baseVillagesGeoJson.features.map((f: any) => {
      const vId = f.properties?.village_id;
      const m = metricsMap.get(vId);
      const isSelected = vId === selectedVillage?.village_id;
      const hasActiveDisease = Boolean(m?.has_active_disease || (m?.disease_count ?? 0) > 0);

      // Color computation: If village has an active disease case or we are in disease layer, highlight in bright RED (#EF4444)
      let fillColor = m?.fill_color || '#E2E8F0';
      if (layerMode === 'disease' || layerMode === 'risk') {
        fillColor = hasActiveDisease ? '#EF4444' : '#10B981';
      } else if (hasActiveDisease) {
        // Prominently highlight active disease village in red across all layers
        fillColor = '#EF4444';
      }

      return {
        ...f,
        properties: {
          ...f.properties,
          fill_color: fillColor,
          fillColor: fillColor,
          border_color: hasActiveDisease ? '#B91C1C' : isSelected ? '#1D4ED8' : '#0F172A',
          border_width: hasActiveDisease ? 3.5 : isSelected ? 2.5 : 1.2,
          fill_opacity: isSelected ? 0.92 : hasActiveDisease ? 0.88 : 0.72,
          coverage_pct: m?.coverage_pct ?? 0,
          animal_count: m?.animal_count ?? 0,
          farmer_count: m?.farmer_count ?? 0,
          vaccinated_count: m?.vaccinated_count ?? 0,
          pending_count: m?.pending_count ?? 0,
          disease_count: m?.disease_count ?? 0,
          has_active_disease: hasActiveDisease,
          status_label: hasActiveDisease ? `સક્રિય રોગ કેસ (${m?.disease_count || 1})` : (m?.status_label || 'સામાન્ય'),
          matches_filter: m?.matches_filter ?? true,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features: enrichedFeatures,
    };
  }, [baseVillagesGeoJson, gisData?.villages, selectedVillage?.village_id]);

  // 4. Fetch Deep Village Analytics when a Village is Clicked / Selected
  useEffect(() => {
    if (!selectedVillage?.village_id) {
      setVillageAnalytics(null);
      return;
    }

    let isMounted = true;
    setIsAnalyticsLoading(true);
    adminService
      .getTahoVillageAnalytics(apiBaseUrl, selectedVillage.village_id)
      .then((data) => {
        if (isMounted) setVillageAnalytics(data);
      })
      .catch((err) => {
        console.warn('Failed to load village analytics:', err);
      })
      .finally(() => {
        if (isMounted) setIsAnalyticsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVillage?.village_id, apiBaseUrl]);

  // Handle URL village_id initial selection
  useEffect(() => {
    if (urlVillageId && hierarchy?.villages && !selectedVillage) {
      const match = hierarchy.villages.find((v: any) => v.village_id === urlVillageId);
      if (match) setSelectedVillage(match);
    }
  }, [urlVillageId, hierarchy?.villages]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedVaccine('');
    setSelectedDisease('');
    setSelectedCampaign('');
    setSelectedSpecies('');
    setSelectedVaxStatus('');
    setSelectedDiseaseStatus('');
    setDateRangeOption('all');
    setSelectedVo('');
    setSelectedFw('');
    setCoverageRange('');
    setSearchQuery('');
    setSelectedVillage(null);
  };

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedVaccine) count++;
    if (selectedDisease) count++;
    if (selectedCampaign) count++;
    if (selectedSpecies) count++;
    if (selectedVaxStatus) count++;
    if (selectedDiseaseStatus) count++;
    if (dateRangeOption !== 'all') count++;
    if (selectedVo) count++;
    if (selectedFw) count++;
    if (coverageRange) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    selectedVaccine,
    selectedDisease,
    selectedCampaign,
    selectedSpecies,
    selectedVaxStatus,
    selectedDiseaseStatus,
    dateRangeOption,
    selectedVo,
    selectedFw,
    coverageRange,
    searchQuery,
  ]);

  const talukaNameGu = overview?.taluka_name_gu || (overview?.taluka_name_en ? transliterateToGujarati(overview.taluka_name_en) : 'તાલુકો');
  const districtNameGu = overview?.district_name_gu || (overview?.district_name_en ? transliterateToGujarati(overview.district_name_en) : 'જિલ્લો');

  const selectedTalukaProps = useMemo(() => {
    if (!overview?.taluka_id) return null;
    return {
      taluka_id: overview.taluka_id,
      code: overview.taluka_code,
      name_en: overview.taluka_name_en,
      name_gu: talukaNameGu,
      district_name_en: overview.district_name_en,
      district_name_gu: districtNameGu,
      village_count: overview.total_villages,
    };
  }, [overview, talukaNameGu, districtNameGu]);

  // Filtered village directory for list & search
  const filteredVillageList = useMemo(() => {
    const list = gisData?.villages || hierarchy?.villages || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((v: any) => {
      const nameEn = (v.name_en || '').toLowerCase();
      const nameGu = (v.name_gu || '').toLowerCase();
      const code = (v.code || '').toLowerCase();
      return nameEn.includes(q) || nameGu.includes(q) || code.includes(q);
    });
  }, [gisData?.villages, hierarchy?.villages, searchQuery]);

  if (isLoading) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-9 h-9 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">તાલુકા ગ્રામીણ GIS સીમાઓ અને એનાલિટિક્સ લોડ થઈ રહ્યા છે...</p>
      </div>
    );
  }

  if (error || !overview?.has_assignment) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <Card className="p-8 bg-amber-50/60 border border-amber-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 font-heading">GIS નકશો ઉપલબ્ધ નથી</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {error || 'તમારા ખાતામાં કોઈ સક્રિય તાલુકો સોંપાયેલ નથી.'}
          </p>
          <Button variant="outline" size="sm" onClick={loadInitialData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            ફરી તપાસો
          </Button>
        </Card>
      </div>
    );
  }

  const summary = gisData?.summary || {};
  const legend = gisData?.legend || [];
  const charts = gisData?.charts || {};
  const filterOptions = gisData?.filter_options || {};

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 0. Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
        <span>નોંધ અને સાધનો</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span>તાલુકા પશુપાલન અધિકારી (TAHO)</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-[#0F172A] font-medium">
          {talukaNameGu} તાલુકો GIS નકશો • {summary.total_villages || overview.total_villages || 0} ગામો
        </span>
      </div>

      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-700" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              {talukaNameGu} તાલુકો — ઇન્ટરેક્ટિવ GIS એનાલિટિક્સ ડેશબોર્ડ
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {summary.total_villages || overview.total_villages || 0} ગામો
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                {activeFiltersCount} સક્રિય ફિલ્ટર્સ
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            જિલ્લો: <strong>{districtNameGu} ({overview.district_name_en})</strong> • ફિલ્ટર-આધારિત રંગ-કોડેડ ગામ સીમાઓ અને નિર્ણય સહાયક વિશ્લેષણ
          </p>
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

          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-100 p-0.5">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                activeTab === 'map' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GIS નકશો
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                activeTab === 'charts' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              વિશ્લેષણાત્મક ચાર્ટ્સ (10)
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={fetchGisAnalytics} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {/* 2. Map-Level Summary Analytics Cards (Requirement 6) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        <Card className="p-2.5 bg-white border border-slate-200 shadow-2xs text-center">
          <span className="text-[10px] text-slate-500 block">કુલ ગામો</span>
          <span className="text-base font-bold text-slate-900 font-heading block mt-0.5">
            {summary.total_villages || 0}
          </span>
          <span className="text-[9px] text-emerald-700 font-mono">100% GIS</span>
        </Card>

        <Card className="p-2.5 bg-white border border-slate-200 shadow-2xs text-center">
          <span className="text-[10px] text-slate-500 block">પશુધન સંખ્યા</span>
          <span className="text-base font-bold text-slate-900 font-heading block mt-0.5">
            {summary.total_animals || 0}
          </span>
          <span className="text-[9px] text-slate-400">ટેગ થયેલ પશુ</span>
        </Card>

        <Card className="p-2.5 bg-white border border-slate-200 shadow-2xs text-center">
          <span className="text-[10px] text-slate-500 block">ખેડૂતો</span>
          <span className="text-base font-bold text-slate-900 font-heading block mt-0.5">
            {summary.total_farmers || 0}
          </span>
          <span className="text-[9px] text-slate-400">પશુપાલકો</span>
        </Card>

        <Card className="p-2.5 bg-emerald-50/70 border border-emerald-200 shadow-2xs text-center">
          <span className="text-[10px] text-emerald-800 block">પૂર્ણ રસીકરણ</span>
          <span className="text-base font-bold text-emerald-700 font-heading block mt-0.5">
            {summary.vaccinated_animals || 0}
          </span>
          <span className="text-[9px] text-emerald-700 font-bold">{summary.overall_coverage_pct || 0}% કવરેજ</span>
        </Card>

        <Card className="p-2.5 bg-amber-50/70 border border-amber-200 shadow-2xs text-center">
          <span className="text-[10px] text-amber-800 block">બાકી રસીકરણ</span>
          <span className="text-base font-bold text-amber-600 font-heading block mt-0.5">
            {summary.pending_vaccinations || 0}
          </span>
          <span className="text-[9px] text-amber-700 font-medium">પ્રક્રિયામાં</span>
        </Card>

        <Card className="p-2.5 bg-white border border-slate-200 shadow-2xs text-center">
          <span className="text-[10px] text-slate-500 block">મુદતવીતી (Overdue)</span>
          <span className="text-base font-bold text-red-600 font-heading block mt-0.5">
            {summary.overdue_vaccinations || 0}
          </span>
          <span className="text-[9px] text-slate-400">સમય બહાર</span>
        </Card>

        <Card className="p-2.5 bg-sky-50/70 border border-sky-200 shadow-2xs text-center">
          <span className="text-[10px] text-sky-800 block">સરેરાશ કવરેજ</span>
          <span className="text-base font-bold text-sky-700 font-heading block mt-0.5">
            {summary.overall_coverage_pct || 0}%
          </span>
          <span className="text-[9px] text-sky-700 font-medium">તાલુકા સરેરાશ</span>
        </Card>

        <Card className="p-2.5 bg-purple-50/70 border border-purple-200 shadow-2xs text-center">
          <span className="text-[10px] text-purple-800 block">રોગ કેસો</span>
          <span className="text-base font-bold text-purple-700 font-heading block mt-0.5">
            {summary.total_disease_reports || 0}
          </span>
          <span className="text-[9px] text-purple-700">સર્વેલન્સ કેસો</span>
        </Card>

        <Card className="p-2.5 bg-red-50/70 border border-red-200 shadow-2xs text-center">
          <span className="text-[10px] text-red-800 block">સક્રિય તપાસ</span>
          <span className="text-base font-bold text-red-600 font-heading block mt-0.5">
            {summary.active_disease_investigations || 0}
          </span>
          <span className="text-[9px] text-red-700">VO મોકલાયેલ</span>
        </Card>

        <Card className="p-2.5 bg-white border border-slate-200 shadow-2xs text-center">
          <span className="text-[10px] text-slate-500 block">સક્રિય ઝુંબેશો</span>
          <span className="text-base font-bold text-slate-900 font-heading block mt-0.5">
            {summary.active_campaigns || 0}
          </span>
          <span className="text-[9px] text-slate-400">અભિયાન</span>
        </Card>
      </div>

      {/* 3. Color-Coded Layer Selector & Interactive Filter Panel (Requirement 2 & 3) */}
      <Card className="p-3 bg-white border border-slate-200 shadow-xs space-y-3">
        {/* Layer Mode Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>નકશા વિઝ્યુઅલાઇઝેશન લેયર (GIS Layer):</span>
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
              <span>રસીકરણ કવરેજ</span>
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
              <span>રોગ સર્વેલન્સ</span>
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
              <span>બાકી રસીકરણ</span>
            </button>

            <button
              onClick={() => setLayerMode('campaign')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                layerMode === 'campaign'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>ઝુંબેશ પ્રગતિ</span>
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
              <span>પશુધન વસ્તી</span>
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
              <span>રોગ જોખમ સિગ્નલ</span>
            </button>
          </div>
        </div>

        {/* Primary Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          {/* 1. Village Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ગામ શોધો..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* 2. Vaccine Filter */}
          <select
            value={selectedVaccine}
            onChange={(e) => setSelectedVaccine(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ રસીઓ (All Vaccines)</option>
            {(filterOptions.vaccines || []).map((vx: any) => (
              <option key={vx.code} value={vx.code}>
                {vx.name} ({vx.code})
              </option>
            ))}
          </select>

          {/* 3. Disease Filter */}
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ રોગો (All Diseases)</option>
            {(filterOptions.diseases || []).map((dis: any) => (
              <option key={dis.code} value={dis.code}>
                {dis.name} ({dis.code})
              </option>
            ))}
          </select>

          {/* 4. Species Filter */}
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ પ્રજાતિ (All Species)</option>
            {(filterOptions.species || []).map((sp: any) => (
              <option key={sp.code} value={sp.code}>
                {sp.name}
              </option>
            ))}
          </select>

          {/* 5. Date Range Selector */}
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

          {/* 6. Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`p-1.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
              showAdvancedFilters || activeFiltersCount > 3
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>વધુ ફિલ્ટર્સ {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
          </button>
        </div>

        {/* Collapsible Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs animate-fade-in">
            {/* Campaign Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">રસીકરણ ઝુંબેશ:</label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">તમામ ઝુંબેશો (All Campaigns)</option>
                {(filterOptions.campaigns || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Coverage Range Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">કવરેજ ટકાવારી:</label>
              <select
                value={coverageRange}
                onChange={(e) => setCoverageRange(e.target.value)}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">તમામ રેન્જ (All Ranges)</option>
                <option value="0-25">અતિ ઓછું (0-25%)</option>
                <option value="26-50">લક્ષ્યાંકથી ઓછું (26-50%)</option>
                <option value="51-75">મધ્યમ (51-75%)</option>
                <option value="76-100">ઉચ્ચ કવરેજ (76-100%)</option>
              </select>
            </div>

            {/* VO Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">વેટરનરી ઓફિસર (VO):</label>
              <select
                value={selectedVo}
                onChange={(e) => setSelectedVo(e.target.value)}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">તમામ VO સ્ટાફ (All VOs)</option>
                {(filterOptions.vos || []).map((vo: any) => (
                  <option key={vo.id} value={vo.id}>
                    {vo.name}
                  </option>
                ))}
              </select>
            </div>

            {/* FW Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ફીલ્ડ વર્કર (FW):</label>
              <select
                value={selectedFw}
                onChange={(e) => setSelectedFw(e.target.value)}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">તમામ FW સ્ટાફ (All FWs)</option>
                {(filterOptions.fws || []).map((fw: any) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* 4. Main View Area: Either GIS Map + Dynamic Legend OR 10 Connected Analytics Charts */}
      {activeTab === 'map' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Map Canvas (Col 3/4) */}
          <div className="lg:col-span-3 space-y-3">
            <Card className="p-0 overflow-hidden border border-slate-200 shadow-xs bg-white relative">
              {/* Dynamic Legend Overlay on Map (Requirement 4) */}
              <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 shadow-md max-w-xs text-xs space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                    {layerMode === 'coverage'
                      ? 'રસીકરણ કવરેજ સંકેત'
                      : layerMode === 'disease'
                      ? 'રોગ સર્વેલન્સ સંકેત'
                      : layerMode === 'pending'
                      ? 'બાકી રસીકરણ સંકેત'
                      : layerMode === 'campaign'
                      ? 'ઝુંબેશ પ્રગતિ સંકેત'
                      : layerMode === 'population'
                      ? 'પશુધન વસ્તી સ્તર'
                      : 'રોગ ચેતવણી સંકેત'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {summary.filtered_villages_count || 0} ગામ
                  </span>
                </div>

                <div className="space-y-1">
                  {legend.map((leg: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-xs shrink-0 border border-black/20"
                          style={{ backgroundColor: leg.color }}
                        />
                        <span className="text-slate-700">{leg.label}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800 text-[10px]">{leg.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map Instance */}
              <GujaratStateMap
                viewLevel="VILLAGE"
                selectedTalukaId={overview.taluka_id}
                selectedTalukaProps={selectedTalukaProps}
                selectedVillageId={selectedVillage?.village_id}
                selectedVillageProps={selectedVillage}
                onVillageSelect={(vp) => setSelectedVillage(vp)}
                villagesGeoJson={enrichedVillagesGeoJson}
                height="650px"
              />
            </Card>
          </div>

          {/* Right Sidebar: Village Details Drawer & Directory (Col 1/4) */}
          <div className="lg:col-span-1 space-y-3">
            {/* Selected Village Detailed Analytics Drawer (Requirement 5) */}
            <Card className="p-3 bg-white border border-slate-200 shadow-xs text-xs space-y-3">
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  ગામ વિશ્લેષણ (Village Analytics)
                </span>
                {selectedVillage && (
                  <StatusChip status="ACTIVE" label={selectedVillage.status_label || selectedVillage.coord_status || 'VERIFIED'} />
                )}
              </div>

              {selectedVillage ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-heading">
                      {selectedVillage.name_gu || transliterateToGujarati(selectedVillage.name_en)}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {selectedVillage.name_en} • કોડ: {selectedVillage.code}
                    </p>
                  </div>

                  {/* Drawer Navigation Tabs */}
                  <div className="flex border-b border-slate-200 text-[11px] space-x-2">
                    <button
                      onClick={() => setActiveDrawerTab('info')}
                      className={`pb-1 font-bold ${
                        activeDrawerTab === 'info' ? 'border-b-2 border-emerald-700 text-emerald-800' : 'text-slate-500'
                      }`}
                    >
                      વિહંગાવલોકન
                    </button>
                    <button
                      onClick={() => setActiveDrawerTab('vax')}
                      className={`pb-1 font-bold ${
                        activeDrawerTab === 'vax' ? 'border-b-2 border-emerald-700 text-emerald-800' : 'text-slate-500'
                      }`}
                    >
                      રસીકરણ
                    </button>
                    <button
                      onClick={() => setActiveDrawerTab('disease')}
                      className={`pb-1 font-bold ${
                        activeDrawerTab === 'disease' ? 'border-b-2 border-emerald-700 text-emerald-800' : 'text-slate-500'
                      }`}
                    >
                      રોગ
                    </button>
                    <button
                      onClick={() => setActiveDrawerTab('staff')}
                      className={`pb-1 font-bold ${
                        activeDrawerTab === 'staff' ? 'border-b-2 border-emerald-700 text-emerald-800' : 'text-slate-500'
                      }`}
                    >
                      સ્ટાફ
                    </button>
                  </div>

                  {isAnalyticsLoading ? (
                    <div className="py-6 text-center text-slate-400">
                      <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <span className="text-[10px] mt-1 block">વિગતો લોડ થઈ રહી છે...</span>
                    </div>
                  ) : villageAnalytics ? (
                    <div className="space-y-2.5 text-xs">
                      {/* Tab: Overview */}
                      {activeDrawerTab === 'info' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 rounded bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-500 block">કુલ પશુધન</span>
                              <span className="text-base font-bold text-slate-900 font-heading">
                                {villageAnalytics.animal_count}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-500 block">ખેડૂતો</span>
                              <span className="text-base font-bold text-slate-900 font-heading">
                                {villageAnalytics.farmer_count}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                              <span className="text-[10px] text-emerald-800 block">પૂર્ણ રસીકરણ</span>
                              <span className="text-base font-bold text-emerald-700 font-heading">
                                {villageAnalytics.vaccinated_count}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-amber-50 border border-amber-100">
                              <span className="text-[10px] text-amber-800 block">બાકી રસીકરણ</span>
                              <span className="text-base font-bold text-amber-600 font-heading">
                                {villageAnalytics.pending_count}
                              </span>
                            </div>
                          </div>

                          {/* Species Breakdown */}
                          <div className="space-y-1 pt-1 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-600 block uppercase">પ્રજાતિ મુજબ સંખ્યા:</span>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                              {Object.entries(villageAnalytics.species_breakdown || {}).map(([sp, cnt]: any) => (
                                <div key={sp} className="p-1 rounded bg-slate-50 flex justify-between">
                                  <span className="font-medium text-slate-700">{sp}:</span>
                                  <span className="font-mono font-bold text-slate-900">{cnt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab: Vaccination Details */}
                      {activeDrawerTab === 'vax' && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-600">રસીકરણ કવરેજ:</span>
                              <span className="font-bold text-emerald-800 font-mono">
                                {villageAnalytics.coverage_pct}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full"
                                style={{ width: `${Math.min(villageAnalytics.coverage_pct, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1 pt-1 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-600 block uppercase">ઝુંબેશ પ્રગતિ:</span>
                            {villageAnalytics.campaigns && villageAnalytics.campaigns.length > 0 ? (
                              villageAnalytics.campaigns.map((c: any) => (
                                <div key={c.id} className="p-1.5 rounded bg-sky-50 text-[11px] space-y-0.5">
                                  <div className="font-bold text-sky-900">{c.name}</div>
                                  <div className="text-[10px] text-sky-700 font-mono">સ્થિતિ: {c.status}</div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] text-slate-400">કોઈ સક્રિય ઝુંબેશ સામેલ નથી.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tab: Disease Surveillance */}
                      {activeDrawerTab === 'disease' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-100 text-red-900">
                            <span className="font-semibold text-[11px]">કુલ રોગ રિપોર્ટ્સ:</span>
                            <span className="font-mono font-bold text-base">{villageAnalytics.disease_count}</span>
                          </div>

                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {villageAnalytics.disease_reports && villageAnalytics.disease_reports.length > 0 ? (
                              villageAnalytics.disease_reports.map((dr: any) => (
                                <div key={dr.report_id} className="p-1.5 rounded border border-slate-200 space-y-1 text-[11px]">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-red-800">{dr.disease_code}</span>
                                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100">{dr.status}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">તારીખ: {dr.report_date}</div>
                                  <p className="text-[10px] text-slate-700 italic">{dr.observation_text}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400 text-center py-3">આ ગામમાં કોઈ રોગ રિપોર્ટ નોંધાયેલ નથી.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tab: Assigned Staff */}
                      {activeDrawerTab === 'staff' && (
                        <div className="space-y-1.5">
                          {villageAnalytics.staff && villageAnalytics.staff.length > 0 ? (
                            villageAnalytics.staff.map((st: any) => (
                              <div
                                key={st.user_id}
                                className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-semibold text-slate-800">{st.full_name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {st.role === 'VET_OFFICER' ? 'વેટરનરી અધિકારી (VO)' : 'ફીલ્ડ વર્કર (FW)'}
                                  </div>
                                </div>
                                {st.mobile && (
                                  <a
                                    href={`tel:${st.mobile}`}
                                    className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    title="કૉલ કરો"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-slate-400 py-3 text-center">કોઈ સ્ટાફ સોંપાયેલ નથી.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs">નકશામાંથી કોઈપણ ગામ પર ક્લિક કરો જેથી તેની સંપૂર્ણ વિગતો જોઈ શકાય.</p>
                </div>
              )}
            </Card>

            {/* Village Directory List */}
            <Card className="p-3 bg-white border border-slate-200 shadow-xs text-xs space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-bold text-slate-800">
                  તાલુકા ગામો ({filteredVillageList.length})
                </span>
                <span className="text-[10px] text-slate-400">ક્લિક કરીને પસંદ કરો</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {filteredVillageList.map((v: any) => {
                  const isSel = selectedVillage?.village_id === v.village_id;
                  const fColor = v.fill_color || '#E2E8F0';
                  return (
                    <div
                      key={v.village_id}
                      onClick={() => setSelectedVillage(v)}
                      className={`p-2 rounded-md cursor-pointer transition-colors flex items-center justify-between ${
                        isSel ? 'bg-emerald-50 border border-emerald-300' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fColor }} />
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {v.name_gu || transliterateToGujarati(v.name_en)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{v.name_en}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* 5. Connected 10 Interactive GIS Analytics Charts View (Requirement 7) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Chart 1: Village Coverage List */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase">
                  <BarChart3 className="w-4 h-4" />
                  <span>૧. ગામ મુજબ કવરેજ (Top Villages)</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.village_coverage || []).slice(0, 10).map((vc: any) => (
                  <div
                    key={vc.village_id}
                    onClick={() => {
                      const match = (hierarchy?.villages || []).find((v: any) => v.village_id === vc.village_id);
                      if (match) {
                        setSelectedVillage(match);
                        setActiveTab('map');
                      }
                    }}
                    className="p-1.5 rounded hover:bg-slate-50 cursor-pointer space-y-1 text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-800">{vc.village_name}</span>
                      <span className="font-mono text-emerald-700 font-bold">{vc.coverage_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(vc.coverage_pct, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 2: Village Pending Vaccinations */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase">
                  <Clock className="w-4 h-4" />
                  <span>૨. ગામ મુજબ બાકી રસીકરણ</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.village_pending || []).slice(0, 10).map((vp: any) => (
                  <div
                    key={vp.village_id}
                    onClick={() => {
                      const match = (hierarchy?.villages || []).find((v: any) => v.village_id === vp.village_id);
                      if (match) {
                        setSelectedVillage(match);
                        setActiveTab('map');
                      }
                    }}
                    className="p-1.5 rounded hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                  >
                    <span className="font-semibold text-slate-800">{vp.village_name}</span>
                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      {vp.pending_count} બાકી
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 3: Disease-wise Reports */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase">
                  <Activity className="w-4 h-4" />
                  <span>૩. રોગ મુજબ કેસો (Disease Cases)</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.disease_breakdown || []).map((db: any) => (
                  <div key={db.code} className="p-1.5 rounded bg-red-50/50 flex justify-between items-center text-xs">
                    <span className="font-semibold text-red-950">{db.name}</span>
                    <span className="font-mono font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      {db.count} કેસો
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 4: Disease Reports by Village */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-purple-800 font-bold text-xs uppercase">
                  <ShieldAlert className="w-4 h-4" />
                  <span>૪. અસરગ્રસ્ત ગામો (Affected Villages)</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.disease_by_village || []).map((dv: any) => (
                  <div
                    key={dv.village_id}
                    onClick={() => {
                      const match = (hierarchy?.villages || []).find((v: any) => v.village_id === dv.village_id);
                      if (match) {
                        setSelectedVillage(match);
                        setActiveTab('map');
                      }
                    }}
                    className="p-1.5 rounded hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                  >
                    <span className="font-semibold text-slate-800">{dv.village_name}</span>
                    <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      {dv.disease_count} કેસ
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 5: Vaccine-wise Doses */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase">
                  <Syringe className="w-4 h-4" />
                  <span>૫. રસી મુજબ વિતરણ (Vaccine Doses)</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.vaccine_coverage || []).map((vc: any) => (
                  <div key={vc.code} className="p-1.5 rounded bg-emerald-50/50 flex justify-between items-center text-xs">
                    <span className="font-semibold text-emerald-950">{vc.name}</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {vc.doses} ડોઝ
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 6: Species-wise Vaccination */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-sky-800 font-bold text-xs uppercase">
                  <PawPrint className="w-4 h-4" />
                  <span>૬. પ્રજાતિ મુજબ રસીકરણ (Species)</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.species_vaccination || []).map((sp: any) => (
                  <div key={sp.code} className="p-1.5 rounded bg-sky-50/50 flex justify-between items-center text-xs">
                    <span className="font-semibold text-sky-950">{sp.name}</span>
                    <span className="font-mono font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                      {sp.count} પશુ
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 7: Campaign Progress */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-indigo-800 font-bold text-xs uppercase">
                  <Megaphone className="w-4 h-4" />
                  <span>૭. ઝુંબેશ ગામ પ્રગતિ (Campaigns)</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.campaign_progress || []).map((cp: any) => (
                  <div key={cp.village_id} className="p-1.5 rounded space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-800">{cp.village_name}</span>
                      <span className="font-mono font-bold text-indigo-700">{cp.progress_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(cp.progress_pct, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 8: Disease Trends */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase">
                  <TrendingUp className="w-4 h-4" />
                  <span>૮. રોગ ટ્રેન્ડ (30 Days Timeline)</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(charts.disease_trends || []).map((dt: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-1 rounded bg-slate-50">
                    <span className="font-mono text-slate-600">{dt.date}</span>
                    <span className="font-mono font-bold text-red-600">{dt.cases} કેસ</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 9: Vaccination Trends */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase">
                  <TrendingUp className="w-4 h-4" />
                  <span>૯. રસીકરણ દૈનિક પ્રગતિ (30 Days)</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(charts.vaccination_trends || []).map((vt: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-1 rounded bg-emerald-50/50">
                    <span className="font-mono text-slate-600">{vt.date}</span>
                    <span className="font-mono font-bold text-emerald-700">{vt.doses} ડોઝ</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 10: Investigation Status */}
            <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>૧૦. રોગ તપાસ સ્થિતિ (Status)</span>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(charts.investigation_status || []).map((st: any) => (
                  <div key={st.status} className="p-1.5 rounded bg-slate-50 flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-800">{st.label}</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {st.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
