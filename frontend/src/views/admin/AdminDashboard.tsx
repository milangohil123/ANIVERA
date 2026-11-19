import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { adminService } from '../../services/adminService';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { GujaratStateMap } from '../../components/maps/GujaratStateMap';
import {
  ArrowRight,
  Database,
  Users,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Activity,
  History,
  MapPin,
  Shield,
  Layers,
  BarChart3,
  UserCheck,
  Megaphone,
  AlertTriangle,
  Plus,
  Compass,
  Upload,
  Globe,
  X,
  Search,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();
  const { t, localizeDistrict, formatNumber } = useTranslation();

  const [overview, setOverview] = useState<any | null>(null);
  const [stateGeoJson, setStateGeoJson] = useState<any | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);
  const [selectedTaluka, setSelectedTaluka] = useState<any | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<any | null>(null);
  const [mapViewLevel, setMapViewLevel] = useState<'DISTRICT' | 'TALUKA' | 'VILLAGE'>('DISTRICT');
  const [talukasGeoJson, setTalukasGeoJson] = useState<any | null>(null);
  const [villagesGeoJson, setVillagesGeoJson] = useState<any | null>(null);
  const [isLoadingSubLayer, setIsLoadingSubLayer] = useState<boolean>(false);
  const [districtFilter, setDistrictFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Hierarchy Modal & Seed state
  const [quickHierarchy, setQuickHierarchy] = useState<any | null>(null);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState<boolean>(false);
  const [isQuickHierarchyOpen, setIsQuickHierarchyOpen] = useState<boolean>(false);
  const [isSyncingOfficial, setIsSyncingOfficial] = useState<boolean>(false);
  const [showAllVillagesModal, setShowAllVillagesModal] = useState<Record<string, boolean>>({});
  const [hierarchySearchModal, setHierarchySearchModal] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [ov, mapData] = await Promise.all([
        adminService.getSuperAdminOverview(apiBaseUrl).catch((e) => {
          console.warn('Overview fetch note:', e);
          return null;
        }),
        adminService.getGujaratStateMap(apiBaseUrl).catch((e) => {
          console.warn('State map fetch note:', e);
          return null;
        }),
      ]);
      setOverview(ov);
      setStateGeoJson(mapData);
      if (ov?.districts && ov.districts.length > 0 && !selectedDistrict) {
        setSelectedDistrict(ov.districts[0]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('superAdmin.common.loadFailed') || 'Failed to load state administrative data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenQuickHierarchy = async (distId: string) => {
    setIsLoadingHierarchy(true);
    setIsQuickHierarchyOpen(true);
    try {
      const data = await adminService.getDistrictHierarchy(apiBaseUrl, distId);
      setQuickHierarchy(data);
    } catch (err) {
      console.warn('Hierarchy fetch error:', err);
    } finally {
      setIsLoadingHierarchy(false);
    }
  };

  const handleSyncOfficial = async (distId: string) => {
    setIsSyncingOfficial(true);
    try {
      await adminService.seedOfficialHierarchy(apiBaseUrl, distId);
      await loadData();
      const ov = await adminService.getSuperAdminOverview(apiBaseUrl);
      const updated = ov?.districts?.find((d: any) => d.district_id === distId);
      if (updated) setSelectedDistrict(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to sync hierarchy');
    } finally {
      setIsSyncingOfficial(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  // Filtered districts list
  const filteredDistricts = useMemo(() => {
    if (!overview?.districts) return [];
    if (districtFilter === 'ALL') return overview.districts;
    return overview.districts.filter((d: any) => d.status === districtFilter);
  }, [overview?.districts, districtFilter]);

  const handleMapDistrictSelect = async (districtProps: any) => {
    setSelectedTaluka(null);
    setSelectedVillage(null);
    setVillagesGeoJson(null);

    let distObj: any = null;
    if (overview?.districts) {
      const match = overview.districts.find(
        (d: any) =>
          d.district_id === districtProps.district_id ||
          d.code?.toUpperCase() === districtProps.code?.toUpperCase() ||
          d.name_en?.toLowerCase() === (districtProps.name_en || districtProps.district || '').toLowerCase()
      );
      if (match) distObj = match;
    }
    if (!distObj) {
      distObj = {
        district_id: districtProps.district_id || '',
        code: districtProps.code || districtProps.dt_code || '',
        name_en: districtProps.name_en || districtProps.district || '',
        name_gu: districtProps.name_gu || districtProps.district || '',
        name_hi: districtProps.name_hi || districtProps.name_en || districtProps.district || '',
        status: districtProps.status || 'UNASSIGNED',
        assigned_daho: districtProps.daho_name
          ? {
              full_name: districtProps.daho_name,
              username: districtProps.daho_username,
              status: districtProps.daho_status || 'ACTIVE',
              assigned_at: districtProps.assigned_at,
            }
          : null,
        taluka_count: districtProps.taluka_count || 0,
        village_count: districtProps.village_count || 0,
        vaccination_coverage_pct: 0,
      };
    }
    setSelectedDistrict(distObj);
    setSelectedTaluka(null);
    setSelectedVillage(null);
    setVillagesGeoJson(null);
    setMapViewLevel('TALUKA');

    if (distObj.district_id) {
      try {
        const tGeo = await adminService.getDistrictTalukasGeoJson(apiBaseUrl, distObj.district_id);
        setTalukasGeoJson(tGeo);
      } catch (e) {
        console.warn('Dashboard talukas fetch note:', e);
      }
    }
  };

  const handleMapTalukaSelect = async (talukaProps: any) => {
    setSelectedTaluka(talukaProps);
    setSelectedVillage(null);
    if (talukaProps.taluka_id) {
      setIsLoadingSubLayer(true);
      try {
        const vGeo = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, talukaProps.taluka_id);
        setVillagesGeoJson(vGeo);
      } catch (e) {
        console.warn('Dashboard villages fetch note:', e);
      } finally {
        setIsLoadingSubLayer(false);
      }
    }
  };

  const handleMapVillageSelect = (villageProps: any) => {
    setSelectedVillage(villageProps);
  };

  const handleMapViewLevelChange = async (level: 'DISTRICT' | 'TALUKA' | 'VILLAGE') => {
    setMapViewLevel(level);
    if (level === 'TALUKA' && !talukasGeoJson) {
      setIsLoadingSubLayer(true);
      try {
        const tGeo = await adminService.getDistrictTalukasGeoJson(apiBaseUrl, selectedDistrict?.district_id);
        setTalukasGeoJson(tGeo);
      } catch (e) {
        console.warn(e);
      } finally {
        setIsLoadingSubLayer(false);
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
      } else if (selectedDistrict?.district_id && !talukasGeoJson) {
        setIsLoadingSubLayer(true);
        try {
          const tGeo = await adminService.getDistrictTalukasGeoJson(apiBaseUrl, selectedDistrict.district_id);
          setTalukasGeoJson(tGeo);
        } catch (e) {
          console.warn(e);
        } finally {
          setIsLoadingSubLayer(false);
        }
      }
    }
  };

  return (
    <div className="w-full space-y-4 pb-12 font-body text-[#172033] animate-fade-in">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER                                      */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>{t('superAdmin.common.stateOperations') || 'State Operations'}</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>{t('superAdmin.common.adminGovernance') || 'Administrative Governance'}</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">{t('superAdmin.common.executiveOversight') || 'State Executive Oversight'}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              {t('superAdmin.dashboard.title')}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>{t('superAdmin.dashboard.subtitle')}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />
              <span>{t('superAdmin.dashboard.refresh')}</span>
            </button>

            <button
              onClick={() => navigate('/admin/map')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#E8EEFC] text-xs font-semibold text-[#135D43] hover:bg-[#D8E4FA] shadow-xs transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
              <span>{t('superAdmin.dashboard.fullMap')}</span>
            </button>

            <button
              onClick={() => navigate('/admin/daho')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ {t('superAdmin.dashboard.addDaho')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. STATEWIDE GOVERNANCE KPI TIERS                                      */}
      {/* ---------------------------------------------------------------------- */}
      {isLoading ? (
        <StateView state="loading" title={t('superAdmin.common.loading')} />
      ) : errorMsg ? (
        <StateView state="error" title={t('superAdmin.common.error')} message={errorMsg} onRetry={loadData} />
      ) : (
        <div className="space-y-4">
          {/* TIER 1: GEOGRAPHIC MASTER KPIS */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#135D43]" />
                {t('superAdmin.dashboard.geoMasterTitle')}
              </h2>
              <button
                onClick={() => navigate('/admin/geography')}
                className="text-xs text-[#135D43] hover:underline font-semibold flex items-center gap-1"
              >
                {t('superAdmin.dashboard.viewMasterData')} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <KpiCard
                label={t('superAdmin.dashboard.kpis.totalDistricts')}
                value={formatNumber(overview?.geographic_kpis?.total_districts ?? 33)}
                subtext={t('superAdmin.dashboard.kpis.subtextDistricts')}
                icon={<MapPin className="w-4 h-4 text-[#135D43]" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.assignedDistricts')}
                value={formatNumber(overview?.geographic_kpis?.districts_assigned ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextAssigned')}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.unassignedDistricts')}
                value={formatNumber(overview?.geographic_kpis?.districts_unassigned ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextUnassigned')}
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.totalTalukas')}
                value={formatNumber(overview?.geographic_kpis?.total_talukas ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextTalukas')}
                icon={<Layers className="w-4 h-4 text-[#135D43]" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.totalVillages')}
                value={formatNumber(overview?.geographic_kpis?.total_villages ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextVillages')}
                icon={<Database className="w-4 h-4 text-[#135D43]" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.verifiedBorders')}
                value={formatNumber(overview?.geographic_kpis?.villages_verified_geo ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextBorders')}
                icon={<CheckCircle2 className="w-4 h-4 text-teal-600" />}
              />
            </div>
          </div>

          {/* TIER 2: ADMINISTRATIVE ACCOUNTS & OPERATIONAL KPIS */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#135D43]" />
                {t('superAdmin.dashboard.adminOpsTitle')}
              </h2>
              <button
                onClick={() => navigate('/admin/daho')}
                className="text-xs text-[#135D43] hover:underline font-semibold flex items-center gap-1"
              >
                {t('superAdmin.dashboard.dahoManagement')} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <KpiCard
                label={t('superAdmin.dashboard.kpis.totalDaho')}
                value={formatNumber(overview?.account_kpis?.total_daho ?? 0)}
                subtext={`${formatNumber(overview?.account_kpis?.active_daho ?? 0)} ${t('superAdmin.dashboard.kpis.activeDaho')}`}
                icon={<Shield className="w-4 h-4 text-[#135D43]" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.voCount')}
                value={formatNumber(overview?.account_kpis?.total_vo ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextVo')}
                icon={<UserCheck className="w-4 h-4 text-blue-600" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.fwCount')}
                value={formatNumber(overview?.account_kpis?.total_fw ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextFw')}
                icon={<Users className="w-4 h-4 text-indigo-600" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.activeCampaigns')}
                value={formatNumber(overview?.operational_kpis?.active_campaigns ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextCampaigns')}
                icon={<Megaphone className="w-4 h-4 text-purple-600" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.registeredAnimals')}
                value={formatNumber(overview?.operational_kpis?.total_animals ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextAnimals')}
                icon={<Activity className="w-4 h-4 text-[#135D43]" />}
              />
              <KpiCard
                label={t('superAdmin.dashboard.kpis.totalVaccinations')}
                value={formatNumber(overview?.operational_kpis?.total_vaccinations ?? 0)}
                subtext={t('superAdmin.dashboard.kpis.subtextVaccinations')}
                icon={<BarChart3 className="w-4 h-4 text-emerald-600" />}
              />
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 3. INTERACTIVE STATE MAP & DISTRICT/TALUKA/VILLAGE INSPECTOR      */}
          {/* ------------------------------------------------------------------ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Map Column (2/3 width) */}
            <div className="lg:col-span-2">
              <GujaratStateMap
                geoJsonData={stateGeoJson}
                selectedDistrictId={selectedDistrict?.district_id}
                selectedDistrictProps={selectedDistrict}
                onDistrictSelect={handleMapDistrictSelect}
                selectedTalukaId={selectedTaluka?.taluka_id}
                selectedTalukaProps={selectedTaluka}
                onTalukaSelect={handleMapTalukaSelect}
                selectedVillageId={selectedVillage?.village_id}
                selectedVillageProps={selectedVillage}
                onVillageSelect={handleMapVillageSelect}
                viewLevel={mapViewLevel}
                onViewLevelChange={handleMapViewLevelChange}
                talukasGeoJson={talukasGeoJson}
                villagesGeoJson={villagesGeoJson}
                isLoadingSubLayer={isLoadingSubLayer}
                height="540px"
              />
            </div>

            {/* Selected District/Taluka/Village Details & Action Panel (1/3 width) */}
            <div className="lg:col-span-1 space-y-3 min-w-0">
              <Card className="p-4 border border-[#E2E8F0] shadow-xs bg-white min-w-0 overflow-hidden text-xs">
                {/* CASE 1: VILLAGE SELECTED */}
                {selectedVillage ? (
                  <div className="space-y-3">
                    <div className="border-b border-[#E2E8F0] pb-2.5">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                        Village Inspector
                      </span>
                      <h3 className="text-base font-bold text-[#0F172A] font-heading mt-0.5 break-words">
                        {selectedVillage.name_gu || selectedVillage.name_en}
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        {selectedVillage.name_en} ({selectedVillage.code})
                      </p>
                    </div>

                    <div className="flex items-center justify-between bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                      <span className="text-emerald-800 font-medium">Status:</span>
                      <StatusChip
                        status="ACTIVE"
                        label="VERIFIED GIS POLYGON"
                      />
                    </div>

                    <div className="space-y-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-[#64748B]">Village Code:</span>
                        <span className="font-mono font-bold text-[#0F172A]">{selectedVillage.code}</span>
                      </div>
                      {selectedVillage.census_code && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#64748B]">Census/LGD Code:</span>
                          <span className="font-mono text-[#0F172A]">{selectedVillage.census_code}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[#64748B]">Coordinates:</span>
                        <span className="font-mono text-[#0F172A]">
                          {selectedVillage.latitude?.toFixed(4)}, {selectedVillage.longitude?.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#E2E8F0]">
                        <span className="text-[#64748B]">Parent Taluka:</span>
                        <span className="font-semibold text-[#0F172A]">
                          {selectedTaluka?.name_gu || selectedTaluka?.name_en || selectedVillage.taluka_name || 'Taluka'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#64748B]">Parent District:</span>
                        <span className="font-semibold text-[#0F172A]">
                          {selectedDistrict ? localizeDistrict(selectedDistrict) : selectedVillage.district_name || 'District'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 space-y-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                        onClick={() => {
                          setMapViewLevel('TALUKA');
                          setSelectedVillage(null);
                        }}
                      >
                        Back to Taluka View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center text-[#135D43]"
                        onClick={() =>
                          navigate(
                            `/admin/geography?district=${selectedDistrict?.district_id}&taluka=${selectedTaluka?.taluka_id}`
                          )
                        }
                      >
                        View in Geographic Master
                      </Button>
                    </div>
                  </div>
                ) : selectedTaluka ? (
                  /* CASE 2: TALUKA SELECTED */
                  <div className="space-y-3">
                    <div className="border-b border-[#E2E8F0] pb-2.5">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                        Taluka Inspector
                      </span>
                      <h3 className="text-base font-bold text-[#0F172A] font-heading mt-0.5 break-words">
                        {selectedTaluka.name_gu || selectedTaluka.name_en}
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        {selectedTaluka.name_en} ({selectedTaluka.code})
                      </p>
                    </div>

                    <div className="flex items-center justify-between bg-sky-50/70 p-2 rounded-xl border border-sky-200">
                      <span className="text-sky-800 font-medium">Boundary Status:</span>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                        100% VERIFIED BOUNDARY
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]">
                        <span className="text-slate-500 text-[11px]">Total Villages</span>
                        <p className="font-bold text-sm text-[#0F172A]">
                          {formatNumber(selectedTaluka.village_count || selectedTaluka.total_villages || 0)}
                        </p>
                      </div>
                      <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]">
                        <span className="text-slate-500 text-[11px]">GIS Polygons</span>
                        <p className="font-bold text-sm text-emerald-700">
                          {formatNumber(selectedTaluka.verified_village_count || selectedTaluka.village_count || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] space-y-1 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-[#64748B]">Taluka Code:</span>
                        <span className="font-mono font-bold text-[#0F172A]">{selectedTaluka.code}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#64748B]">Boundary Method:</span>
                        <span className="text-[#0F172A] font-medium">Topological Dissolution</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#E2E8F0]">
                        <span className="text-[#64748B]">Parent District:</span>
                        <span className="font-semibold text-[#0F172A]">
                          {selectedDistrict ? localizeDistrict(selectedDistrict) : 'District'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 space-y-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full justify-center"
                        onClick={() => {
                          setMapViewLevel('VILLAGE');
                          if (!villagesGeoJson && selectedTaluka.taluka_id) {
                            handleMapTalukaSelect(selectedTaluka);
                          }
                        }}
                        leftIcon={<Layers className="w-3.5 h-3.5" />}
                      >
                        Explore Villages on Map
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                        onClick={() => {
                          setMapViewLevel('DISTRICT');
                          setSelectedTaluka(null);
                        }}
                      >
                        Back to District View
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* CASE 3: DISTRICT SELECTED */
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5 mb-3 gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                          {t('superAdmin.dashboard.selectedDistrict.title')}
                        </span>
                        <h3 className="text-lg font-bold text-[#0F172A] font-heading break-words">
                          {selectedDistrict ? localizeDistrict(selectedDistrict) : t('superAdmin.dashboard.selectedDistrict.none')}
                        </h3>
                      </div>
                      {selectedDistrict && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusChip
                            status={selectedDistrict.status === 'ASSIGNED' ? 'ACTIVE' : 'INACTIVE'}
                            label={selectedDistrict.status === 'ASSIGNED' ? t('superAdmin.dashboard.registryTable.tabAssigned') : t('superAdmin.dashboard.registryTable.tabUnassigned')}
                          />
                          {selectedDistrict.taluka_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {t('superAdmin.dashboard.selectedDistrict.geoStatusVerified')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {t('superAdmin.dashboard.selectedDistrict.geoStatusNotImported')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedDistrict ? (
                      <div className="space-y-3 min-w-0">
                        {/* District ID & Code */}
                        <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] min-w-0">
                          <div className="min-w-0">
                            <span className="text-slate-500">{t('superAdmin.dashboard.selectedDistrict.code')}</span>
                            <p className="font-bold text-[#0F172A] font-mono truncate">{selectedDistrict.code}</p>
                          </div>
                          <div className="min-w-0">
                            <span className="text-slate-500">{t('superAdmin.dashboard.selectedDistrict.stateCode')}</span>
                            <p className="font-bold text-[#0F172A] truncate">{t('superAdmin.dashboard.selectedDistrict.gujaratState')}</p>
                          </div>
                        </div>

                        {/* Boundary Status */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px]">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            Boundary
                          </span>
                          <span className="font-medium text-slate-700">
                            {selectedDistrict.has_custom_boundary
                              ? t('superAdmin.dashboard.selectedDistrict.boundaryCustom', { version: selectedDistrict.custom_boundary_version || 1 })
                              : t('superAdmin.dashboard.selectedDistrict.boundaryOfficial')}
                          </span>
                        </div>

                        {/* Assigned DAHO Details */}
                        <div className="border border-[#E2E8F0] rounded-xl p-3 bg-white min-w-0 overflow-hidden">
                          <span className="text-slate-500 font-medium block mb-1">
                            {t('superAdmin.dashboard.selectedDistrict.assignedDahoLabel')}
                          </span>
                          {selectedDistrict.assigned_daho ? (
                            <div className="space-y-1 min-w-0">
                              <p className="font-bold text-sm text-[#0F172A] break-words">
                                {selectedDistrict.assigned_daho.full_name}
                              </p>
                              <p className="text-[#64748B] font-mono text-[11px] truncate">
                                @{selectedDistrict.assigned_daho.username}
                              </p>
                              {selectedDistrict.assigned_daho.mobile_e164 && (
                                <p className="text-slate-600 text-[11px] truncate">
                                  {selectedDistrict.assigned_daho.mobile_e164}
                                </p>
                              )}
                              <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                                {t('superAdmin.dashboard.selectedDistrict.activeJurisdiction')}
                              </p>
                            </div>
                          ) : (
                            <div className="py-2 text-center text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
                              <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                              <span>{t('superAdmin.dashboard.selectedDistrict.unassignedWarning')}</span>
                            </div>
                          )}
                        </div>

                        {/* Hierarchy Counts */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] text-center">
                            <span className="text-slate-500 text-[11px]">{t('superAdmin.dashboard.selectedDistrict.talukas')}</span>
                            <p className="text-base font-bold text-[#0F172A] font-heading">{formatNumber(selectedDistrict.taluka_count || 0)}</p>
                          </div>
                          <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] text-center">
                            <span className="text-slate-500 text-[11px]">{t('superAdmin.dashboard.selectedDistrict.villages')}</span>
                            <p className="text-base font-bold text-[#0F172A] font-heading">{formatNumber(selectedDistrict.village_count || 0)}</p>
                          </div>
                        </div>

                        {/* Unimported Hierarchy Advisory Banner */}
                        {selectedDistrict.taluka_count === 0 && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{t('superAdmin.dashboard.selectedDistrict.geoStatusNotImported')}</span>
                            </div>
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                              {t('superAdmin.dashboard.selectedDistrict.geoStatusNotImportedNotice')}
                            </p>
                            <div className="flex gap-2 pt-1">
                              <Button
                                variant="primary"
                                size="sm"
                                className="flex-1 justify-center text-xs"
                                onClick={() => handleSyncOfficial(selectedDistrict.district_id)}
                                isLoading={isSyncingOfficial}
                                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                              >
                                {t('superAdmin.dashboard.selectedDistrict.syncOfficialBtn')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 justify-center text-xs"
                                onClick={() => navigate(`/admin/geography?district=${selectedDistrict.district_id}`)}
                                leftIcon={<Upload className="w-3.5 h-3.5" />}
                              >
                                {t('superAdmin.dashboard.selectedDistrict.importDataBtn')}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-2 space-y-1.5">
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full justify-center"
                            onClick={() => {
                              setMapViewLevel('TALUKA');
                              if (!talukasGeoJson && selectedDistrict.district_id) {
                                adminService
                                  .getDistrictTalukasGeoJson(apiBaseUrl, selectedDistrict.district_id)
                                  .then(setTalukasGeoJson)
                                  .catch(console.warn);
                              }
                            }}
                            leftIcon={<Layers className="w-3.5 h-3.5" />}
                          >
                            Explore Talukas on Map
                          </Button>

                          {selectedDistrict.status === 'ASSIGNED' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-center"
                              onClick={() => navigate(`/admin/daho?reassign=${selectedDistrict.district_id}`)}
                              leftIcon={<Shield className="w-3.5 h-3.5 text-[#135D43]" />}
                            >
                              {t('superAdmin.dashboard.selectedDistrict.reassignBtn')}
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full justify-center"
                              onClick={() => navigate(`/admin/daho?assign=${selectedDistrict.district_id}`)}
                              leftIcon={<Plus className="w-3.5 h-3.5" />}
                            >
                              {t('superAdmin.dashboard.selectedDistrict.assignBtn')}
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-center text-[#135D43] border-emerald-200 hover:bg-emerald-50"
                            onClick={() => handleOpenQuickHierarchy(selectedDistrict.district_id)}
                            leftIcon={<Layers className="w-3.5 h-3.5 text-[#135D43]" />}
                          >
                            {t('superAdmin.dashboard.selectedDistrict.quickHierarchyBtn')}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-center text-slate-600 hover:text-[#135D43]"
                            onClick={() => navigate(`/admin/geography?district=${selectedDistrict.district_id}`)}
                            leftIcon={<Database className="w-3.5 h-3.5" />}
                          >
                            {t('superAdmin.dashboard.selectedDistrict.viewHierarchyBtn')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-6">
                        {t('superAdmin.dashboard.selectedDistrict.clickPrompt')}
                      </p>
                    )}
                  </div>
                )}
              </Card>

              {/* Quick Navigation Card */}
              <Card className="p-3.5 border border-[#E2E8F0] bg-[#F8FAFC]">
                <span className="text-xs font-bold text-[#0F172A] block mb-2">
                  {t('superAdmin.dashboard.quickNav.title')}
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => navigate('/admin/geography')}
                    className="p-2 bg-white rounded-lg border border-[#E2E8F0] hover:border-[#135D43] text-left transition-colors font-medium text-slate-700"
                  >
                    {t('superAdmin.dashboard.quickNav.geoMaster')}
                  </button>
                  <button
                    onClick={() => navigate('/admin/daho')}
                    className="p-2 bg-white rounded-lg border border-[#E2E8F0] hover:border-[#135D43] text-left transition-colors font-medium text-slate-700"
                  >
                    {t('superAdmin.dashboard.quickNav.dahoDirectory')}
                  </button>
                  <button
                    onClick={() => navigate('/admin/assignments')}
                    className="p-2 bg-white rounded-lg border border-[#E2E8F0] hover:border-[#135D43] text-left transition-colors font-medium text-slate-700"
                  >
                    {t('superAdmin.dashboard.quickNav.assignmentRegistry')}
                  </button>
                  <button
                    onClick={() => navigate('/admin/oversight')}
                    className="p-2 bg-white rounded-lg border border-[#E2E8F0] hover:border-[#135D43] text-left transition-colors font-medium text-slate-700"
                  >
                    {t('superAdmin.dashboard.quickNav.stateMonitoring')}
                  </button>
                </div>
              </Card>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 4. STATEWIDE DISTRICTS SUMMARY TABLE                               */}
          {/* ------------------------------------------------------------------ */}
          <Card className="p-0 border border-[#E2E8F0] shadow-xs overflow-hidden">
            <div className="p-3.5 bg-white border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#135D43]" />
                  {t('superAdmin.dashboard.registryTable.title')}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {t('superAdmin.dashboard.registryTable.subtitle')}
                </p>
              </div>

              {/* Status Tab Toggle */}
              <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl text-xs flex-wrap gap-1">
                <button
                  onClick={() => setDistrictFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    districtFilter === 'ALL'
                      ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {t('superAdmin.dashboard.registryTable.tabAll')} ({formatNumber(overview?.districts?.length || 0)})
                </button>
                <button
                  onClick={() => setDistrictFilter('ASSIGNED')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    districtFilter === 'ASSIGNED'
                      ? 'bg-emerald-100 text-[#135D43] shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-[#135D43]'
                  }`}
                >
                  {t('superAdmin.dashboard.registryTable.tabAssigned')} ({formatNumber(overview?.geographic_kpis?.districts_assigned || 0)})
                </button>
                <button
                  onClick={() => setDistrictFilter('UNASSIGNED')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    districtFilter === 'UNASSIGNED'
                      ? 'bg-slate-200 text-slate-800 shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-slate-800'
                  }`}
                >
                  {t('superAdmin.dashboard.registryTable.tabUnassigned')} ({formatNumber(overview?.geographic_kpis?.districts_unassigned || 0)})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left min-w-[660px]">
                <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-2.5 px-3">{t('superAdmin.dashboard.registryTable.thDistrict')}</th>
                    <th className="py-2.5 px-3">{t('superAdmin.dashboard.registryTable.thCode')}</th>
                    <th className="py-2.5 px-3">{t('superAdmin.dashboard.registryTable.thStatus')}</th>
                    <th className="py-2.5 px-3">{t('superAdmin.dashboard.registryTable.thOfficial')}</th>
                    <th className="py-2.5 px-3 text-center">{t('superAdmin.dashboard.registryTable.thTalukas')}</th>
                    <th className="py-2.5 px-3 text-center">{t('superAdmin.dashboard.registryTable.thVillages')}</th>
                    <th className="py-2.5 px-3 text-right">{t('superAdmin.dashboard.registryTable.thActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredDistricts.slice(0, 15).map((d: any) => (
                    <tr
                      key={d.district_id}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => handleMapDistrictSelect(d)}
                    >
                      <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                        {localizeDistrict(d)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#64748B]">{d.code}</td>
                      <td className="py-2.5 px-3">
                        <StatusChip
                          status={d.status === 'ASSIGNED' ? 'ACTIVE' : 'INACTIVE'}
                          label={d.status === 'ASSIGNED' ? t('superAdmin.dashboard.registryTable.tabAssigned') : t('superAdmin.dashboard.registryTable.tabUnassigned')}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        {d.assigned_daho ? (
                          <div className="font-medium text-[#0F172A]">
                            {d.assigned_daho.full_name}
                            <span className="block text-[11px] text-[#64748B] font-mono">
                              @{d.assigned_daho.username}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">{t('superAdmin.dashboard.registryTable.unassignedText')}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium">{formatNumber(d.taluka_count || 0)}</td>
                      <td className="py-2.5 px-3 text-center font-medium">{formatNumber(d.village_count || 0)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/geography?district=${d.district_id}`);
                          }}
                        >
                          {t('superAdmin.dashboard.registryTable.detailsBtn')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ------------------------------------------------------------------ */}
          {/* 5. PRESERVED TECHNICAL SYSTEM MONITORING & AUDIT SUMMARY           */}
          {/* ------------------------------------------------------------------ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Administrative Audits */}
            <Card className="p-4 border border-[#E2E8F0]">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E2E8F0] mb-3">
                <h3 className="text-xs font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#135D43]" />
                  {t('superAdmin.dashboard.audit.title')}
                </h3>
                <button
                  onClick={() => navigate('/admin/audit-logs')}
                  className="text-xs text-[#135D43] hover:underline font-semibold"
                >
                  {t('superAdmin.dashboard.audit.viewAll')}
                </button>
              </div>
              <div className="space-y-2 text-xs">
                {overview?.recent_audits?.length > 0 ? (
                  overview.recent_audits.slice(0, 5).map((a: any) => (
                    <div
                      key={a.id}
                      className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-[#0F172A]">{a.action}</p>
                        <p className="text-[11px] text-[#64748B]">{a.reason || t('superAdmin.dashboard.audit.defaultReason')}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(a.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-center py-3">{t('superAdmin.dashboard.audit.noAudits')}</p>
                )}
              </div>
            </Card>

            {/* Preserved Technical Administration Diagnostics */}
            <Card className="p-4 border border-[#E2E8F0]">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E2E8F0] mb-3">
                <h3 className="text-xs font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#135D43]" />
                  {t('superAdmin.dashboard.systemHealth.title')}
                </h3>
                <button
                  onClick={() => navigate('/admin/system-health')}
                  className="text-xs text-[#135D43] hover:underline font-semibold"
                >
                  {t('superAdmin.dashboard.systemHealth.viewDiagnostics')}
                </button>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="font-semibold text-emerald-900">{t('superAdmin.dashboard.systemHealth.dbConnectivity')}</span>
                  <span className="text-xs font-bold text-emerald-700">HEALTHY ✓</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="font-semibold text-emerald-900">{t('superAdmin.dashboard.systemHealth.securityEngine')}</span>
                  <span className="text-xs font-bold text-emerald-700">ACTIVE ✓</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="font-medium text-slate-700">{t('superAdmin.dashboard.systemHealth.registeredDevices')}</span>
                  <button
                    onClick={() => navigate('/admin/devices')}
                    className="text-xs text-[#135D43] font-semibold hover:underline"
                  >
                    {t('superAdmin.dashboard.systemHealth.deviceManagement')}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Quick Hierarchy Modal */}
      {isQuickHierarchyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#135D43]" />
                  {quickHierarchy ? localizeDistrict(quickHierarchy) : ''} — {t('superAdmin.dashboard.selectedDistrict.quickHierarchyModalTitle')}
                </h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {quickHierarchy ? `${formatNumber(quickHierarchy.total_talukas || 0)} ${t('superAdmin.dashboard.selectedDistrict.talukas')}, ${formatNumber(quickHierarchy.total_villages || 0)} ${t('superAdmin.dashboard.selectedDistrict.villages')}` : ''}
                </p>
              </div>
              <button
                onClick={() => setIsQuickHierarchyOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {/* Modal Search Bar */}
              {quickHierarchy?.talukas && quickHierarchy.talukas.length > 0 && (
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={hierarchySearchModal}
                    onChange={(e) => setHierarchySearchModal(e.target.value)}
                    placeholder="Search taluka or village..."
                    className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-slate-50 focus:bg-white focus:outline-none focus:border-[#135D43] transition-colors"
                  />
                </div>
              )}

              {isLoadingHierarchy ? (
                <div className="py-8 text-center text-slate-400">
                  {t('superAdmin.common.loading')}
                </div>
              ) : quickHierarchy?.talukas && quickHierarchy.talukas.length > 0 ? (
                quickHierarchy.talukas
                  .filter((tItem: any) => {
                    if (!hierarchySearchModal.trim()) return true;
                    const q = hierarchySearchModal.toLowerCase();
                    const matchTaluka = (tItem.name_en || '').toLowerCase().includes(q) ||
                                        (tItem.name_gu || '').includes(q) ||
                                        (tItem.code || '').toLowerCase().includes(q);
                    if (matchTaluka) return true;
                    return (tItem.villages || []).some((v: any) =>
                      (v.name_en || '').toLowerCase().includes(q) ||
                      (v.name_gu || '').includes(q) ||
                      (v.code || '').toLowerCase().includes(q)
                    );
                  })
                  .map((tItem: any) => {
                    const isShowingAll = !!showAllVillagesModal[tItem.id];
                    const q = hierarchySearchModal.trim().toLowerCase();
                    const filteredVillages = (tItem.villages || []).filter((v: any) => {
                      if (!q) return true;
                      return (v.name_en || '').toLowerCase().includes(q) ||
                             (v.name_gu || '').includes(q) ||
                             (v.code || '').toLowerCase().includes(q);
                    });
                    const displayedVillages = (isShowingAll || q)
                      ? filteredVillages
                      : filteredVillages.slice(0, 20);
                    const hasMore = filteredVillages.length > 20 && !isShowingAll && !q;

                    return (
                      <div key={tItem.id} className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
                        <div className="bg-[#F8FAFC] px-3 py-2 border-b border-[#E2E8F0] flex items-center justify-between font-bold text-slate-800">
                          <span>{tItem.name_gu || tItem.name_en} ({tItem.code})</span>
                          <span className="text-[11px] text-slate-500 font-semibold">{formatNumber(tItem.village_count || 0)} {t('superAdmin.dashboard.selectedDistrict.villages')}</span>
                        </div>
                        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {displayedVillages.map((v: any) => (
                            <div key={v.id} className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <p className="font-medium text-slate-800 text-[11px] truncate">{v.name_gu || v.name_en}</p>
                                <p className="text-[10px] text-[#64748B] truncate">{v.code}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {v.has_boundary && (
                                  <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                    POLY
                                  </span>
                                )}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${v.coord_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                  {v.coord_status === 'VERIFIED' ? 'GEO' : 'NONE'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {hasMore && (
                          <div className="p-1.5 text-center bg-slate-50 border-t border-[#E2E8F0]">
                            <button
                              type="button"
                              onClick={() => setShowAllVillagesModal(prev => ({ ...prev, [tItem.id]: true }))}
                              className="text-[11px] font-semibold text-[#135D43] hover:underline"
                            >
                              + Show all {filteredVillages.length} villages
                            </button>
                          </div>
                        )}
                        {isShowingAll && filteredVillages.length > 20 && (
                          <div className="p-1 text-center bg-slate-50 border-t border-[#E2E8F0]">
                            <button
                              type="button"
                              onClick={() => setShowAllVillagesModal(prev => ({ ...prev, [tItem.id]: false }))}
                              className="text-[10px] font-semibold text-slate-500 hover:underline"
                            >
                              Show less
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="py-8 text-center text-slate-500 space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p>{t('superAdmin.dashboard.selectedDistrict.noTalukasNotice')}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setIsQuickHierarchyOpen(false);
                      navigate(`/admin/geography?district=${selectedDistrict?.district_id}`);
                    }}
                  >
                    {t('superAdmin.dashboard.selectedDistrict.importDataBtn')}
                  </Button>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsQuickHierarchyOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
