import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  coopService,
  type CoopVillageMapData,
  type CoopVillageDetailTelemetry,
} from '../../services/coopService';
import { GujaratStateMap } from '../../components/maps/GujaratStateMap';
import { KpiCard } from '../../components/common/KpiCard';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import {
  MapPin,
  Search,
  Filter,
  Users,
  PawPrint,
  Syringe,
  Layers,
  RotateCcw,
  AlertTriangle,
  Phone,
  X,
  CheckCircle2,
  Clock,
  Megaphone,
  Tent,
  ChevronRight,
  Eye,
  Building2,
  LayoutGrid,
  Map as MapIcon,
  ArrowRight,
} from 'lucide-react';

type FilterStatus = 'ALL' | 'HIGH' | 'MODERATE' | 'LOW' | 'ALERT';

export const CoopMapsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlVillageId = searchParams.get('village_id');
  const { apiBaseUrl } = useAuth();

  // Core Data States
  const [mapData, setMapData] = useState<CoopVillageMapData | null>(null);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(urlVillageId);
  const [villageDetails, setVillageDetails] = useState<CoopVillageDetailTelemetry | null>(null);

  // UI & Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map');
  const [activeDrawerTab, setActiveDrawerTab] = useState<'overview' | 'farmers' | 'animals' | 'vaccinations' | 'surveillance'>('overview');

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [farmerSearch, setFarmerSearch] = useState<string>('');
  const [animalSearch, setAnimalSearch] = useState<string>('');

  // 1. Load Map Data
  const loadMapData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await coopService.getVillageMapData(apiBaseUrl);
      setMapData(data);
      if (urlVillageId) {
        setSelectedVillageId(urlVillageId);
      }
    } catch (err: any) {
      setError(err?.message || 'નકશા ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [apiBaseUrl]);

  // 2. Fetch Village In-Depth Details when a Village is Clicked / Selected
  useEffect(() => {
    if (!selectedVillageId) {
      setVillageDetails(null);
      return;
    }

    let isMounted = true;
    setIsDetailsLoading(true);
    coopService
      .getVillageDetails(apiBaseUrl, selectedVillageId)
      .then((data) => {
        if (isMounted) setVillageDetails(data);
      })
      .catch((err) => {
        console.warn('Failed to load village details:', err);
      })
      .finally(() => {
        if (isMounted) setIsDetailsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVillageId, apiBaseUrl]);

  // 3. Filtered GeoJSON based on search and status filter
  const filteredVillagesGeoJson = useMemo(() => {
    if (!mapData?.villages_geojson?.features) return null;

    let feats = mapData.villages_geojson.features;

    // Filter by status
    if (statusFilter !== 'ALL') {
      feats = feats.filter((f) => {
        const p = f.properties;
        if (statusFilter === 'ALERT') return p.disease_alert;
        if (statusFilter === 'HIGH') return p.coverage_pct >= 80;
        if (statusFilter === 'MODERATE') return p.coverage_pct >= 50 && p.coverage_pct < 80;
        if (statusFilter === 'LOW') return p.coverage_pct < 50;
        return true;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      feats = feats.filter((f) => {
        const p = f.properties;
        const nameGu = (p.village_name || '').toLowerCase();
        const nameEn = (p.village_name_en || '').toLowerCase();
        const code = (p.village_code || '').toLowerCase();
        return nameGu.includes(q) || nameEn.includes(q) || code.includes(q);
      });
    }

    // Enhance properties for GujaratStateMap rendering
    const enhancedFeatures = feats.map((f) => {
      const isSelected = f.properties.village_id === selectedVillageId;
      return {
        ...f,
        properties: {
          ...f.properties,
          fillColor: f.properties.fill_color || '#16A34A',
          border_color: isSelected ? '#1D4ED8' : '#0F172A',
          fill_opacity: isSelected ? 0.9 : 0.72,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features: enhancedFeatures,
    };
  }, [mapData?.villages_geojson, statusFilter, searchQuery, selectedVillageId]);

  // Handler for Village Selection from Map
  const handleVillageSelect = (villageProps: any) => {
    const vId = villageProps?.village_id || villageProps?.id;
    if (vId) {
      setSelectedVillageId(vId);
      setSearchParams({ village_id: vId });
      setActiveDrawerTab('overview');
    }
  };

  const handleCloseDrawer = () => {
    setSelectedVillageId(null);
    setVillageDetails(null);
    setSearchParams({});
  };

  // Reset Filters
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  // Selected village property lookup
  const selectedVillageFeature = useMemo(() => {
    if (!selectedVillageId || !mapData?.villages_geojson?.features) return null;
    return mapData.villages_geojson.features.find((f) => f.properties.village_id === selectedVillageId);
  }, [selectedVillageId, mapData]);

  return (
    <div className="w-full space-y-4 animate-fade-in pb-12 font-body text-[#172033]">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER                                       */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>કામગીરી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>ડેરી સહકારી મંડળી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">
            કાર્યક્ષેત્ર GIS ભૌગોલિક નકશો • {mapData?.summary?.total_villages || 0} ગામડાં
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              કાર્યક્ષેત્ર GIS ભૌગોલિક નકશો
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>ભૌગોલિક દેખરેખ સક્રિય</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0] text-xs">
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                  viewMode === 'map'
                    ? 'bg-white text-[#135D43] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                નકશો
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-[#135D43] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                કાર્ડ્સ
              </button>
            </div>

            <button
              onClick={loadMapData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />
              <span>તાજું કરો</span>
            </button>

            <button
              onClick={() => navigate('/coop/village-progress')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-[#135D43]" />
              <span>કોષ્ટક યાદી (Table)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. GOVERNANCE BANNER                                                   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                સત્તાવાર ડેરી સહકારી કાર્યક્ષેત્ર GIS નકશો
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                સહકારી ભૌગોલિક અધિકારક્ષેત્ર
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              મંડળી: {mapData?.cooperative?.name_gu || 'ડેરી સહકારી મંડળી'} • {mapData?.summary?.total_villages || 0} કાર્યક્ષેત્ર ગામો • {mapData?.summary?.total_members || 0} સભાસદો • {mapData?.summary?.total_animals || 0} પશુધન. ગામ પર ક્લિક કરીને લાઈવ વિગત જુઓ.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/village-progress')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>ગામવાર પ્રગતિ કોષ્ટક</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ કાર્યક્ષેત્ર ગામ"
          value={isLoading ? '...' : String(mapData?.summary?.total_villages || 0)}
          subtext="મંડળી અધિકારક્ષેત્ર"
          icon={<Building2 className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="સભ્ય પશુપાલકો"
          value={isLoading ? '...' : String(mapData?.summary?.total_members || 0)}
          valueColor="text-[#0284C7]"
          subtext="નોંધાયેલ સભાસદો"
          icon={<Users className="w-4 h-4 text-[#0284C7]" />}
          iconVariant="blue"
          onClick={() => navigate('/coop/farmers')}
        />

        <KpiCard
          label="સંલગ્ન પશુધન"
          value={isLoading ? '...' : String(mapData?.summary?.total_animals || 0)}
          valueColor="text-[#176B5B]"
          subtext="કુલ નોંધાયેલ પશુઓ"
          icon={<PawPrint className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          onClick={() => navigate('/coop/animals')}
        />

        <KpiCard
          label="રસીકરણ થયેલ પશુઓ"
          value={isLoading ? '...' : String(mapData?.summary?.total_vaccinated || 0)}
          valueColor="text-[#135D43]"
          subtext={`${mapData?.summary?.overall_coverage_pct || 0}% કવરેજ સિદ્ધિ`}
          icon={<Syringe className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          badgeText="સક્રિય"
          badgeVariant="emerald"
          onClick={() => navigate('/coop/vaccinations')}
        />

        <KpiCard
          label="રોગ એલર્ટ ગામો"
          value={isLoading ? '...' : String(mapData?.summary?.alert_villages_count || 0)}
          valueColor={(mapData?.summary?.alert_villages_count || 0) > 0 ? 'text-red-600' : 'text-slate-800'}
          subtext="તાત્કાલિક દેખરેખ હેઠળ"
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          iconVariant={(mapData?.summary?.alert_villages_count || 0) > 0 ? 'red' : 'slate'}
          badgeText={(mapData?.summary?.alert_villages_count || 0) > 0 ? 'સાવચેતી' : 'સામાન્ય'}
          badgeVariant={(mapData?.summary?.alert_villages_count || 0) > 0 ? 'red' : 'emerald'}
          onClick={() => setStatusFilter('ALERT')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. OPERATIONAL FILTER BAR                                              */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#135D43]" />
            સ્થિતિ ફિલ્ટર:
          </span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-[#135D43] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            તમામ ({mapData?.villages_geojson?.features?.length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('HIGH')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              statusFilter === 'HIGH'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            ઉચ્ચ કવરેજ (&gt;= 80%)
          </button>
          <button
            onClick={() => setStatusFilter('MODERATE')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              statusFilter === 'MODERATE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            મધ્યમ (50-79%)
          </button>
          <button
            onClick={() => setStatusFilter('LOW')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              statusFilter === 'LOW'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            ઓછું (&lt; 50%)
          </button>
          <button
            onClick={() => setStatusFilter('ALERT')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              statusFilter === 'ALERT'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block" />
            રોગચાળો ચેતવણી
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ગામનું નામ અથવા કોડ શોધો..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {(statusFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-[#135D43]" />
              <span>રીસેટ</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 5. MAIN BODY: GIS MAP OR CARDS VIEW + IN-DEPTH DRAWER                  */}
      {/* ---------------------------------------------------------------------- */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <StateView state="loading" message="કાર્યક્ષેત્ર GIS નકશો લોડ થઈ રહ્યો છે…" />
        </Card>
      ) : error ? (
        <Card className="p-8 text-center">
          <StateView state="error" message={error} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Map / Cards Canvas (Cols 1-3 when drawer open, or 4 when closed) */}
          <div className={selectedVillageId ? 'lg:col-span-3 space-y-3' : 'lg:col-span-4 space-y-3'}>
            {viewMode === 'map' ? (
              <Card className="p-0 overflow-hidden border border-[#E2E8F0] shadow-xs bg-white relative rounded-xl">
                {/* Dynamic Map Legend Overlay */}
                <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-[#E2E8F0] shadow-md max-w-xs text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                    <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-[#135D43]" />
                      રસીકરણ કવરેજ રંગ સંકેત
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {filteredVillagesGeoJson?.features?.length || 0} ગામ દર્શાવ્યા
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#16A34A] border border-black/20" />
                        <span className="text-slate-700">ઉચ્ચ કવરેજ (&gt;= 80%)</span>
                      </div>
                      <span className="font-mono text-slate-500 text-[10px]">આદર્શ</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#EAB308] border border-black/20" />
                        <span className="text-slate-700">મધ્યમ કવરેજ (50-79%)</span>
                      </div>
                      <span className="font-mono text-slate-500 text-[10px]">સામાન્ય</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#F97316] border border-black/20" />
                        <span className="text-slate-700">ઓછું કવરેજ (20-49%)</span>
                      </div>
                      <span className="font-mono text-slate-500 text-[10px]">ધ્યાનપાત્ર</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#EF4444] border border-black/20" />
                        <span className="text-slate-700">અતિ ઓછું કવરેજ (&lt; 20%)</span>
                      </div>
                      <span className="font-mono text-red-600 text-[10px] font-bold">તાકીદ</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                        <span className="text-red-700 font-bold">રોગચાળો ચેતવણી (Alert)</span>
                      </div>
                      <span className="font-mono text-red-600 text-[10px] font-bold">શંકાસ્પદ કેસ</span>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-[#E2E8F0] text-[10px] text-slate-500">
                    💡 <em>ગામ પર ક્લિક કરવાથી તે ગામમાં શું થયું છે તેની સંપૂર્ણ વિગત ખુલશે.</em>
                  </div>
                </div>

                {/* Map Component */}
                <GujaratStateMap
                  viewLevel="VILLAGE"
                  selectedVillageId={selectedVillageId || undefined}
                  onVillageSelect={handleVillageSelect}
                  villagesGeoJson={filteredVillagesGeoJson}
                  height="650px"
                />
              </Card>
            ) : (
              /* Cards View */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredVillagesGeoJson?.features?.map((f) => {
                  const p = f.properties;
                  const isSelected = p.village_id === selectedVillageId;
                  return (
                    <div
                      key={p.village_id}
                      onClick={() => handleVillageSelect(p)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'border-[#135D43] ring-2 ring-[#135D43]/20'
                          : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 font-heading flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                            {p.village_name}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">{p.village_code}</span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            p.disease_alert
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : p.coverage_pct >= 80
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : p.coverage_pct >= 50
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-orange-50 text-orange-800 border border-orange-200'
                          }`}
                        >
                          {p.status_label}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">રસીકરણ કવરેજ:</span>
                          <span className="font-bold text-slate-800 font-mono">{p.coverage_pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(p.coverage_pct, 100)}%`,
                              backgroundColor: p.fill_color,
                            }}
                          />
                        </div>
                      </div>

                      {/* Metrics 3-grid */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-500 block">ખેડૂતો</span>
                          <span className="font-bold text-slate-900 font-mono text-xs">
                            {p.member_farmers_count}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">પશુધન</span>
                          <span className="font-bold text-slate-900 font-mono text-xs">
                            {p.total_animals}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">રસીકરણ</span>
                          <span className="font-bold text-emerald-700 font-mono text-xs">
                            {p.vaccinated_animals}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#135D43]">
                        <span className="font-semibold flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          ગામની વિગતવાર માહિતી જુઓ
                        </span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar: "ગામમાં શું થયું છે" Comprehensive Telemetry Drawer (Col 4) */}
          {selectedVillageId && (
            <div className="lg:col-span-1 space-y-3">
              <Card className="p-3 bg-white border border-[#E2E8F0] shadow-md rounded-xl space-y-3">
                {/* Drawer Header */}
                <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-[#135D43] uppercase tracking-wider block">
                      ગામ કામગીરી વિગત
                    </span>
                    <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#135D43]" />
                      {villageDetails?.village?.name_gu || selectedVillageFeature?.properties?.village_name || 'ગામ વિગત'}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-mono">
                      કોડ: {villageDetails?.village?.code || selectedVillageFeature?.properties?.village_code}
                    </span>
                  </div>
                  <button
                    onClick={handleCloseDrawer}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Drawer Tabs */}
                <div className="flex items-center gap-1 border-b border-[#E2E8F0] pb-2 overflow-x-auto text-[11px]">
                  <button
                    onClick={() => setActiveDrawerTab('overview')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      activeDrawerTab === 'overview'
                        ? 'bg-[#E8F5E9] text-[#135D43]'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    ઝાંખી
                  </button>
                  <button
                    onClick={() => setActiveDrawerTab('farmers')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      activeDrawerTab === 'farmers'
                        ? 'bg-[#E8F5E9] text-[#135D43]'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    ખેડૂતો ({villageDetails?.farmers?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveDrawerTab('animals')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      activeDrawerTab === 'animals'
                        ? 'bg-[#E8F5E9] text-[#135D43]'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    પશુધન ({villageDetails?.animals?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveDrawerTab('vaccinations')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      activeDrawerTab === 'vaccinations'
                        ? 'bg-[#E8F5E9] text-[#135D43]'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    રસીકરણ ({villageDetails?.vaccinations?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveDrawerTab('surveillance')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      activeDrawerTab === 'surveillance'
                        ? 'bg-[#E8F5E9] text-[#135D43]'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    સર્વેલન્સ / કેમ્પ
                  </button>
                </div>

                {/* Drawer Content */}
                {isDetailsLoading ? (
                  <div className="py-8 text-center text-slate-500">
                    <div className="w-5 h-5 border-2 border-[#135D43] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs">ગામની માહિતી લોડ થઈ રહી છે...</span>
                  </div>
                ) : !villageDetails ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    કોઈ વિગતો ઉપલબ્ધ નથી.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 1. Tab: Overview (ઝાંખી) */}
                    {activeDrawerTab === 'overview' && (
                      <div className="space-y-3 text-xs">
                        {/* 4 Mini KPI Cards */}
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-500 block">સભ્ય પશુપાલકો</span>
                            <span className="text-base font-bold text-slate-900 font-heading">
                              {villageDetails.kpis.total_members}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-500 block">કુલ પશુધન</span>
                            <span className="text-base font-bold text-slate-900 font-heading">
                              {villageDetails.kpis.total_animals}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9]">
                            <span className="text-[10px] text-[#135D43] block">રસીકરણ થયેલ</span>
                            <span className="text-base font-bold text-[#135D43] font-heading">
                              {villageDetails.kpis.vaccinated_animals}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="text-[10px] text-amber-800 block">બાકી રસીકરણ</span>
                            <span className="text-base font-bold text-amber-700 font-heading">
                              {villageDetails.kpis.pending_animals}
                            </span>
                          </div>
                        </div>

                        {/* Coverage Progress Bar */}
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-800">રસીકરણ કવરેજ ટકાવારી:</span>
                            <span className="font-bold text-emerald-800 font-mono">
                              {villageDetails.kpis.coverage_pct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-full bg-[#135D43] rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(villageDetails.kpis.coverage_pct, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Species Distribution */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            પ્રજાતિ મુજબ પશુધન વહેંચણી:
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                              <span className="text-slate-500">ગાય (Cattle):</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {villageDetails.species_breakdown?.CATTLE || 0}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                              <span className="text-slate-500">ભેંસ (Buffalo):</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {villageDetails.species_breakdown?.BUFFALO || 0}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                              <span className="text-slate-500">બકરી (Goat):</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {villageDetails.species_breakdown?.GOAT || 0}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                              <span className="text-slate-500">ઘેટાં (Sheep):</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {villageDetails.species_breakdown?.SHEEP || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Disease & Campaign Summary Pills */}
                        <div className="space-y-2 pt-1 border-t border-slate-200">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200 text-red-900">
                            <span className="text-[11px] font-semibold flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              રોગ સર્વેલન્સ કેસ:
                            </span>
                            <span className="font-bold font-mono">
                              {villageDetails.kpis.disease_reports_count}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-900">
                            <span className="text-[11px] font-semibold flex items-center gap-1.5">
                              <Megaphone className="w-3.5 h-3.5 text-sky-600" />
                              સક્રિય રસીકરણ ઝુંબેશો:
                            </span>
                            <span className="font-bold font-mono">
                              {villageDetails.kpis.active_campaigns_count}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                            <span className="text-[11px] font-semibold flex items-center gap-1.5">
                              <Tent className="w-3.5 h-3.5 text-amber-600" />
                              પશુ આરોગ્ય કેમ્પ:
                            </span>
                            <span className="font-bold font-mono">
                              {villageDetails.kpis.camps_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Tab: Member Farmers (સભાસદો) */}
                    {activeDrawerTab === 'farmers' && (
                      <div className="space-y-2 text-xs">
                        <div className="relative">
                          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={farmerSearch}
                            onChange={(e) => setFarmerSearch(e.target.value)}
                            placeholder="ખેડૂતનું નામ અથવા સભ્ય નં..."
                            className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none"
                          />
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {villageDetails.farmers
                            .filter((f) => {
                              const q = farmerSearch.toLowerCase();
                              return (
                                f.full_name.toLowerCase().includes(q) ||
                                (f.member_no || '').toLowerCase().includes(q) ||
                                f.farmer_code.toLowerCase().includes(q)
                              );
                            })
                            .map((f) => (
                              <div
                                key={f.farmer_id}
                                className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1 text-xs hover:border-[#135D43] transition-all"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900">{f.full_name}</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#E8F5E9] text-[#135D43]">
                                    {f.member_no || f.farmer_code}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>કુલ પશુઓ: <strong className="text-slate-800">{f.total_animals}</strong></span>
                                  <span>રસીકરણ: <strong className="text-emerald-700">{f.vaccinated_animals}</strong> ({f.coverage_percent}%)</span>
                                </div>
                                {f.mobile_e164 && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                    <Phone className="w-2.5 h-2.5 text-[#135D43]" />
                                    {f.mobile_e164}
                                  </div>
                                )}
                              </div>
                            ))}
                          {villageDetails.farmers.length === 0 && (
                            <p className="text-center py-4 text-slate-400">આ ગામમાં કોઈ સભાસદ નોંધાયેલ નથી.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. Tab: Livestock (પશુધન) */}
                    {activeDrawerTab === 'animals' && (
                      <div className="space-y-2 text-xs">
                        <div className="relative">
                          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={animalSearch}
                            onChange={(e) => setAnimalSearch(e.target.value)}
                            placeholder="ટેગ અથવા માલિકનું નામ શોધો..."
                            className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none"
                          />
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {villageDetails.animals
                            .filter((a) => {
                              const q = animalSearch.toLowerCase();
                              return (
                                a.animal_code.toLowerCase().includes(q) ||
                                (a.bharat_pashudhan_tag || '').toLowerCase().includes(q) ||
                                a.farmer_name.toLowerCase().includes(q)
                              );
                            })
                            .map((a) => (
                              <div
                                key={a.id}
                                className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 flex items-center gap-1">
                                    <PawPrint className="w-3 h-3 text-[#135D43]" />
                                    {a.species} ({a.breed})
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                      a.vaccination_status === 'COVERED'
                                        ? 'bg-emerald-50 text-emerald-800'
                                        : a.vaccination_status === 'OVERDUE'
                                        ? 'bg-red-50 text-red-800'
                                        : 'bg-amber-50 text-amber-800'
                                    }`}
                                  >
                                    {a.vaccination_status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  ટેગ: {a.bharat_pashudhan_tag || a.animal_code}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  માલિક: <strong className="text-slate-800">{a.farmer_name}</strong>
                                </div>
                                {a.next_due_date && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                    <Clock className="w-2.5 h-2.5 text-amber-600" />
                                    આગામી રસીકરણ: {a.next_due_date}
                                  </div>
                                )}
                              </div>
                            ))}
                          {villageDetails.animals.length === 0 && (
                            <p className="text-center py-4 text-slate-400">કોઈ સંલગ્ન પશુ નોંધાયેલ નથી.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. Tab: Vaccinations (રસીકરણ) */}
                    {activeDrawerTab === 'vaccinations' && (
                      <div className="space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          તાજેતરનું રસીકરણ ઇતિહાસ:
                        </span>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {villageDetails.vaccinations.map((v) => (
                            <div
                              key={v.id}
                              className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#135D43]">{v.vaccine_name}</span>
                                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[#E8F5E9] text-[#135D43]">
                                  ડોઝ #{v.dose_number}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                રોગ: <strong className="text-slate-800">{v.disease_name}</strong>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span>ખેડૂત: {v.farmer_name}</span>
                                <span className="font-mono">{v.administered_at?.split('T')[0]}</span>
                              </div>
                            </div>
                          ))}
                          {villageDetails.vaccinations.length === 0 && (
                            <p className="text-center py-4 text-slate-400">તાજેતરમાં કોઈ રસીકરણ નોંધાયેલ નથી.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 5. Tab: Surveillance & Camps (સર્વેલન્સ અને કેમ્પ) */}
                    {activeDrawerTab === 'surveillance' && (
                      <div className="space-y-3 text-xs">
                        {/* Disease reports */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            શંકાસ્પદ રોગ રિપોર્ટ્સ ({villageDetails.disease_reports.length}):
                          </span>
                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {villageDetails.disease_reports.map((dr) => (
                              <div
                                key={dr.report_id}
                                className="p-2 rounded-lg border border-red-200 bg-red-50/50 space-y-1 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-red-800">{dr.disease_code}</span>
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-red-200 text-red-700">
                                    {dr.status}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  રિપોર્ટ નં: {dr.report_code} • {dr.received_at?.split('T')[0]}
                                </div>
                              </div>
                            ))}
                            {villageDetails.disease_reports.length === 0 && (
                              <p className="text-[11px] text-slate-400 p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
                                આ ગામમાં કોઈ સક્રિય રોગ રિપોર્ટ નથી.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Health Camps */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-200">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                            <Tent className="w-3 h-3 text-amber-600" />
                            આરોગ્ય કેમ્પ અને ડોરસ્ટેપ રાઉન્ડ્સ ({villageDetails.camps.length}):
                          </span>
                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {villageDetails.camps.map((camp) => (
                              <div
                                key={camp.id}
                                className="p-2 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber-900">{camp.camp_code}</span>
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-amber-200 text-amber-800">
                                    {camp.status}
                                  </span>
                                </div>
                                {camp.location_text && (
                                  <div className="text-[10px] text-slate-500">
                                    સ્થળ: {camp.location_text}
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-500 font-mono">
                                  તારીખ: {camp.planned_start?.split('T')[0]}
                                </div>
                              </div>
                            ))}
                            {villageDetails.camps.length === 0 && (
                              <p className="text-[11px] text-slate-400 p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
                                કોઈ કેમ્પ સૂચિબદ્ધ નથી.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
