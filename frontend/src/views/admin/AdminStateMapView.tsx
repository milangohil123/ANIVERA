import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { adminService } from '../../services/adminService';
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
  Info,
  Layers,
  Database,
  Check,
} from 'lucide-react';

export const AdminStateMapView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();
  const { t, localizeDistrict, formatNumber } = useTranslation();

  const [stateGeoJson, setStateGeoJson] = useState<any | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);
  const [selectedTaluka, setSelectedTaluka] = useState<any | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<any | null>(null);
  const [viewLevel, setViewLevel] = useState<'DISTRICT' | 'TALUKA' | 'VILLAGE'>('DISTRICT');

  const [talukasGeoJson, setTalukasGeoJson] = useState<any | null>(null);
  const [villagesGeoJson, setVillagesGeoJson] = useState<any | null>(null);
  const [isLoadingSubLayer, setIsLoadingSubLayer] = useState<boolean>(false);

  const [hierarchyData, setHierarchyData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMapData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminService.getGujaratStateMap(apiBaseUrl);
      setStateGeoJson(data);
    } catch (err: any) {
      setErrorMsg(err?.message || t('superAdmin.common.loadFailed') || 'Failed to load map data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [apiBaseUrl]);

  const handleDistrictSelect = async (props: any) => {
    setSelectedDistrict(props);
    setSelectedTaluka(null);
    setSelectedVillage(null);
    setVillagesGeoJson(null);
    setViewLevel('TALUKA');

    if (props.district_id) {
      setIsLoadingHierarchy(true);
      setIsLoadingSubLayer(true);
      try {
        const [h, tGeo] = await Promise.all([
          adminService.getDistrictHierarchy(apiBaseUrl, props.district_id).catch(() => null),
          adminService.getDistrictTalukasGeoJson(apiBaseUrl, props.district_id).catch(() => null),
        ]);
        setHierarchyData(h);
        setTalukasGeoJson(tGeo);
      } catch (err) {
        console.warn('District sub-data load error:', err);
      } finally {
        setIsLoadingHierarchy(false);
        setIsLoadingSubLayer(false);
      }
    } else {
      setHierarchyData(null);
      setTalukasGeoJson(null);
    }
  };

  const handleTalukaSelect = async (props: any) => {
    setSelectedTaluka(props);
    setSelectedVillage(null);

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

  const handleCustomBoundarySave = async (geometry: any, reason: string) => {
    if (!selectedDistrict?.district_id) {
      throw new Error(t('superAdmin.map.selectDistrictPrompt') || 'Please select a target district first.');
    }
    await adminService.saveCustomJurisdiction(
      apiBaseUrl,
      selectedDistrict.district_id,
      geometry,
      reason
    );
    loadMapData();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/overview')}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            {t('nav.overview') || 'Dashboard'}
          </Button>
          <h1 className="text-base font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.map.title')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMapData}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.dashboard.refresh')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/geography')}
            leftIcon={<Database className="w-3.5 h-3.5 text-[#135D43]" />}
          >
            {t('superAdmin.geography.pageTitle') || 'Geographic Master'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/daho')}
            leftIcon={<Shield className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.dashboard.dahoManagement')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <StateView state="loading" title={t('superAdmin.common.loading')} />
      ) : errorMsg ? (
        <StateView state="error" title={t('superAdmin.common.error')} message={errorMsg} onRetry={loadMapData} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Map (3 cols on large screen) */}
          <div className="lg:col-span-3 space-y-3">
            <GujaratStateMap
              geoJsonData={stateGeoJson}
              selectedDistrictId={selectedDistrict?.district_id}
              selectedDistrictProps={selectedDistrict}
              onDistrictSelect={handleDistrictSelect}
              selectedTalukaId={selectedTaluka?.taluka_id}
              selectedTalukaProps={selectedTaluka}
              onTalukaSelect={handleTalukaSelect}
              selectedVillageId={selectedVillage?.village_id}
              selectedVillageProps={selectedVillage}
              onVillageSelect={handleVillageSelect}
              viewLevel={viewLevel}
              onViewLevelChange={handleViewLevelChange}
              talukasGeoJson={talukasGeoJson}
              villagesGeoJson={villagesGeoJson}
              isLoadingSubLayer={isLoadingSubLayer}
              enableDrawingMode={true}
              onCustomBoundarySave={handleCustomBoundarySave}
              height="620px"
              title={t('superAdmin.map.title')}
              subtitle={t('superAdmin.map.subtitle')}
            />
          </div>

          {/* Hierarchical Drill-down Info Drawer (1 col) */}
          <div className="lg:col-span-1 space-y-3">
            <Card className="p-4 border border-[#E2E8F0] shadow-xs bg-white text-xs">
              <div className="border-b border-[#E2E8F0] pb-2.5 mb-3">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                  {selectedVillage
                    ? 'Village Inspector'
                    : selectedTaluka
                    ? 'Taluka Inspector'
                    : t('superAdmin.map.inspectorTitle')}
                </span>
                <h3 className="text-base font-bold text-[#0F172A] font-heading mt-0.5 break-words">
                  {selectedVillage
                    ? selectedVillage.name_gu || selectedVillage.name_en
                    : selectedTaluka
                    ? selectedTaluka.name_gu || selectedTaluka.name_en
                    : selectedDistrict
                    ? localizeDistrict(selectedDistrict)
                    : t('superAdmin.map.selectDistrictPrompt')}
                </h3>
                {(selectedVillage || selectedTaluka) && (
                  <p className="text-[11px] text-[#64748B]">
                    {selectedVillage
                      ? `${selectedVillage.name_en} (${selectedVillage.code})`
                      : `${selectedTaluka.name_en} (${selectedTaluka.code})`}
                  </p>
                )}
              </div>

              {/* CASE 1: VILLAGE SELECTED */}
              {selectedVillage ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                    <span className="text-emerald-800 font-medium">Status:</span>
                    <StatusChip
                      status="ACTIVE"
                      label={selectedVillage.has_boundary !== false ? 'VERIFIED GIS POLYGON' : 'OFFICIAL CENTROID'}
                    />
                  </div>

                  <div className="space-y-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0]">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#64748B]">Village Code:</span>
                      <span className="font-mono font-bold text-[#0F172A]">{selectedVillage.code}</span>
                    </div>
                    {selectedVillage.census_code && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#64748B]">Census/LGD Code:</span>
                        <span className="font-mono text-[#0F172A]">{selectedVillage.census_code}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#64748B]">Centroid Coords:</span>
                      <span className="font-mono text-[#0F172A]">
                        {selectedVillage.latitude?.toFixed(4)}, {selectedVillage.longitude?.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#E2E8F0]">
                      <span className="text-[#64748B]">Parent Taluka:</span>
                      <span className="font-semibold text-[#0F172A]">
                        {selectedTaluka?.name_gu || selectedTaluka?.name_en || 'Taluka'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#64748B]">Parent District:</span>
                      <span className="font-semibold text-[#0F172A]">
                        {selectedDistrict ? localizeDistrict(selectedDistrict) : 'District'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => {
                        setViewLevel('TALUKA');
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
                  <div className="flex items-center justify-between bg-sky-50/70 p-2 rounded-xl border border-sky-200">
                    <span className="text-sky-800 font-medium">Boundary Status:</span>
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                      100% VERIFIED POLYGON
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0] text-center">
                      <span className="text-slate-500 text-[11px]">Total Villages</span>
                      <p className="font-bold text-sm text-[#0F172A]">
                        {formatNumber(selectedTaluka.village_count || selectedTaluka.total_villages || 0)}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0] text-center">
                      <span className="text-slate-500 text-[11px]">GIS Polygons</span>
                      <p className="font-bold text-sm text-emerald-700 flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" />
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
                        setViewLevel('VILLAGE');
                        if (!villagesGeoJson && selectedTaluka.taluka_id) {
                          handleTalukaSelect(selectedTaluka);
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
                        setViewLevel('DISTRICT');
                        setSelectedTaluka(null);
                      }}
                    >
                      Back to District View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-[#135D43]"
                      onClick={() =>
                        navigate(
                          `/admin/geography?district=${selectedDistrict?.district_id}&taluka=${selectedTaluka.taluka_id}`
                        )
                      }
                    >
                      Manage Taluka & Villages
                    </Button>
                  </div>
                </div>
              ) : selectedDistrict ? (
                /* CASE 3: DISTRICT SELECTED */
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]">
                    <span className="text-slate-500">{t('superAdmin.dashboard.registryTable.thStatus')}:</span>
                    <StatusChip
                      status={selectedDistrict.status === 'ASSIGNED' ? 'ACTIVE' : 'INACTIVE'}
                      label={
                        selectedDistrict.status === 'ASSIGNED'
                          ? t('superAdmin.dashboard.registryTable.tabAssigned')
                          : t('superAdmin.dashboard.registryTable.tabUnassigned')
                      }
                    />
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium block mb-1">{t('superAdmin.map.dahoOfficer')}:</span>
                    {selectedDistrict.daho_name ? (
                      <div className="p-2.5 rounded-xl border border-[#E2E8F0] bg-emerald-50/50">
                        <p className="font-bold text-[#0F172A]">{selectedDistrict.daho_name}</p>
                        <p className="text-[11px] text-[#64748B] font-mono">
                          @{selectedDistrict.daho_username}
                        </p>
                        <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                          ✓ {t('superAdmin.map.officialHead')}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-center">
                        {t('superAdmin.map.unassignedNotice')}
                      </div>
                    )}
                  </div>

                  {/* Hierarchy counts */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0] text-center">
                      <span className="text-slate-500 text-[11px]">{t('superAdmin.map.talukasCount')}</span>
                      <p className="font-bold text-sm text-[#0F172A]">
                        {isLoadingHierarchy
                          ? '...'
                          : formatNumber(hierarchyData?.total_talukas || selectedDistrict.taluka_count || 0)}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0] text-center">
                      <span className="text-slate-500 text-[11px]">{t('superAdmin.map.villagesCount')}</span>
                      <p className="font-bold text-sm text-[#0F172A]">
                        {isLoadingHierarchy
                          ? '...'
                          : formatNumber(hierarchyData?.total_villages || selectedDistrict.village_count || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 space-y-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => setViewLevel('TALUKA')}
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
                      >
                        {t('superAdmin.map.reassignBtn')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full justify-center"
                        onClick={() => navigate(`/admin/daho?assign=${selectedDistrict.district_id}`)}
                      >
                        {t('superAdmin.map.assignDahoBtn')}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-[#135D43]"
                      onClick={() => navigate(`/admin/geography?district=${selectedDistrict.district_id}`)}
                    >
                      {t('superAdmin.map.manageGeographyBtn')}
                    </Button>
                  </div>
                </div>
              ) : (
                /* CASE 4: NOTHING SELECTED */
                <div className="py-8 text-center text-slate-400">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>{t('superAdmin.map.selectDistrictPrompt')}</p>
                </div>
              )}
            </Card>

            <Card className="p-3 bg-white border border-[#E2E8F0] text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-[#0F172A] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#135D43]" />
                {t('superAdmin.map.drawingMode')}:
              </span>
              <p className="text-[11px] leading-relaxed text-[#64748B]">
                {t('superAdmin.map.drawingActive')}
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
