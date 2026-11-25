import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  Layers,
  ArrowLeft,
  Search,
  RotateCcw,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export const AdminAssignmentsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();
  const { t, localizeDistrict, formatNumber } = useTranslation();

  const [districts, setDistricts] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedDistrictId, setExpandedDistrictId] = useState<string | null>(null);
  const [hierarchyData, setHierarchyData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const ov = await adminService.getSuperAdminOverview(apiBaseUrl);
      if (ov?.districts) {
        const seen = new Set<string>();
        const clean = ov.districts.filter((d: any) => {
          const nameEn = (d.name_en || '').trim();
          const nameGu = (d.name_gu || '').trim();
          const code = (d.code || '').trim().toUpperCase();
          if (
            code.startsWith('D_') ||
            nameEn.startsWith('D_') ||
            nameGu.startsWith('જી') ||
            nameGu === 'જી' ||
            nameGu.startsWith('જી ') ||
            nameEn.toLowerCase() === 'ji' ||
            nameEn.toLowerCase() === 'jji'
          ) {
            return false;
          }
          let canonical = (nameEn || code).toLowerCase().trim();
          if (canonical.includes('botad')) canonical = 'botad';
          if (seen.has(canonical)) return false;
          seen.add(canonical);
          return true;
        });
        setDistricts(clean);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('superAdmin.common.loadFailed') || 'Failed to load assignments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const toggleExpand = async (distId: string) => {
    if (expandedDistrictId === distId) {
      setExpandedDistrictId(null);
      return;
    }
    setExpandedDistrictId(distId);
    if (!hierarchyData[distId]) {
      try {
        const h = await adminService.getDistrictHierarchy(apiBaseUrl, distId);
        setHierarchyData((prev) => ({ ...prev, [distId]: h }));
      } catch (err) {
        console.warn('Hierarchy fetch note:', err);
      }
    }
  };

  const filteredDistricts = useMemo(() => {
    let list = districts;
    if (filterStatus !== 'ALL') {
      list = list.filter((d: any) => d.status === filterStatus);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (d: any) =>
          d.name_en?.toLowerCase().includes(q) ||
          d.name_gu?.toLowerCase().includes(q) ||
          d.name_hi?.toLowerCase().includes(q) ||
          d.code?.toLowerCase().includes(q) ||
          d.assigned_daho?.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [districts, filterStatus, searchTerm]);

  if (isLoading) {
    return <StateView state="loading" title={t('superAdmin.common.loading')} />;
  }

  if (errorMsg) {
    return <StateView state="error" message={errorMsg} onRetry={loadData} />;
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12 font-body animate-fade-in">
      {/* Header */}
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
            <Layers className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.assignments.pageTitle')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.dashboard.refresh')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/daho')}
            leftIcon={<Shield className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.assignments.dahoManagementBtn')}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3 bg-white border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#64748B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('superAdmin.assignments.searchPlaceholder')}
              className="pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white w-48 sm:w-64"
            />
          </div>
        </div>

        <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              filterStatus === 'ALL'
                ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {t('superAdmin.assignments.filterAll')} ({formatNumber(districts.length)})
          </button>
          <button
            onClick={() => setFilterStatus('ASSIGNED')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              filterStatus === 'ASSIGNED'
                ? 'bg-emerald-100 text-[#135D43] shadow-xs font-bold'
                : 'text-[#64748B] hover:text-[#135D43]'
            }`}
          >
            {t('superAdmin.assignments.filterAssigned')} ({formatNumber(districts.filter((d: any) => d.status === 'ASSIGNED').length)})
          </button>
          <button
            onClick={() => setFilterStatus('UNASSIGNED')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              filterStatus === 'UNASSIGNED'
                ? 'bg-slate-200 text-slate-800 shadow-xs font-bold'
                : 'text-[#64748B] hover:text-slate-800'
            }`}
          >
            {t('superAdmin.assignments.filterUnassigned')} ({formatNumber(districts.filter((d: any) => d.status === 'UNASSIGNED').length)})
          </button>
        </div>
      </Card>

      {/* Expandable Hierarchy Registry List */}
      <div className="space-y-2.5">
        {filteredDistricts.map((d: any) => {
          const isExpanded = expandedDistrictId === d.district_id;
          const h = hierarchyData[d.district_id];

          return (
            <Card
              key={d.district_id}
              className="p-0 border border-[#E2E8F0] shadow-xs overflow-hidden bg-white text-xs"
            >
              <div
                onClick={() => toggleExpand(d.district_id)}
                className="p-3.5 bg-white hover:bg-[#F8FAFC] transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <button className="text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#135D43]" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div>
                    <span className="font-bold text-sm text-[#0F172A] font-heading">
                      {localizeDistrict(d)}
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-[#64748B]">
                      [{d.code}]
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <span className="text-slate-400 text-[11px] block">{t('superAdmin.assignments.dahoLabel')}:</span>
                    <span className="font-semibold text-slate-800">
                      {d.assigned_daho ? d.assigned_daho.full_name : t('superAdmin.dashboard.registryTable.unassignedText')}
                    </span>
                  </div>

                  <div className="text-center hidden md:block">
                    <span className="text-slate-400 text-[11px] block">{t('superAdmin.assignments.talukasLabel')} / {t('superAdmin.assignments.villagesLabel')}</span>
                    <span className="font-semibold text-slate-700">
                      {formatNumber(d.taluka_count || 0)} / {formatNumber(d.village_count || 0)}
                    </span>
                  </div>

                  <StatusChip
                    status={d.status === 'ASSIGNED' ? 'ACTIVE' : 'INACTIVE'}
                    label={d.status === 'ASSIGNED' ? t('superAdmin.dashboard.registryTable.tabAssigned') : t('superAdmin.dashboard.registryTable.tabUnassigned')}
                  />
                </div>
              </div>

              {/* Expanded Hierarchy Breakdown (Talukas & Villages) */}
              {isExpanded && (
                <div className="p-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] space-y-3">
                  {h?.talukas?.length > 0 ? (
                    h.talukas.map((tItem: any) => (
                      <div key={tItem.id} className="bg-white p-2.5 rounded-xl border border-[#E2E8F0] space-y-2">
                        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                          <span className="font-bold text-[#0F172A]">
                            {tItem.name_gu || tItem.name_en} — {tItem.code}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {formatNumber(tItem.village_count || 0)} {t('superAdmin.map.villagesCount')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {tItem.villages?.map((v: any) => (
                            <div key={v.id} className="p-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                              <p className="font-medium text-slate-800">{v.name_gu || v.name_en}</p>
                              <p className="text-[10px] text-[#64748B]">{v.code}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : !h ? (
                    <p className="text-slate-400 text-center py-2">
                      {t('superAdmin.common.loading')}
                    </p>
                  ) : (
                    <div className="py-4 text-center space-y-2 bg-white rounded-xl border border-dashed border-[#CBD5E1] p-4">
                      <p className="text-slate-600 text-xs font-medium">
                        {t('superAdmin.dashboard.selectedDistrict.noTalukasNotice')}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs mx-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/geography?district=${d.district_id}`);
                        }}
                      >
                        {t('superAdmin.dashboard.selectedDistrict.importDataBtn')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
