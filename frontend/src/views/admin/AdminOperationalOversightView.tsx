import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { KpiCard } from '../../components/common/KpiCard';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  BarChart3,
  ArrowLeft,
  RotateCcw,
  Megaphone,
  Activity,
  AlertTriangle,
  Syringe,
  TrendingUp,
} from 'lucide-react';

export const AdminOperationalOversightView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();
  const { t, localizeDistrict, formatNumber } = useTranslation();

  const [overview, setOverview] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'CAMPAIGNS' | 'VACCINATIONS' | 'SURVEILLANCE'>('CAMPAIGNS');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminService.getSuperAdminOverview(apiBaseUrl);
      setOverview(data);
    } catch (err: any) {
      setErrorMsg(err?.message || t('superAdmin.common.loadFailed') || 'Failed to load oversight data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  if (isLoading) {
    return <StateView state="loading" title={t('superAdmin.common.loading')} />;
  }

  if (errorMsg) {
    return <StateView state="error" message={errorMsg} onRetry={loadData} />;
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12 font-body animate-fade-in">
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
            <BarChart3 className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.oversight.pageTitle')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
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
            onClick={loadData}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.dashboard.refresh')}
          </Button>
        </div>
      </div>

      {/* Operational KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          icon={<Syringe className="w-4 h-4 text-emerald-600" />}
        />
        <KpiCard
          label={t('superAdmin.oversight.outbreakAlerts')}
          value={formatNumber(overview?.operational_kpis?.active_outbreak_alerts ?? 0)}
          subtext={t('superAdmin.oversight.surveillanceTitle')}
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        />
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl text-xs w-fit">
        <button
          onClick={() => setActiveTab('CAMPAIGNS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === 'CAMPAIGNS'
              ? 'bg-white text-[#0F172A] shadow-xs font-bold'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          {t('superAdmin.oversight.tabCampaigns')}
        </button>
        <button
          onClick={() => setActiveTab('VACCINATIONS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === 'VACCINATIONS'
              ? 'bg-white text-[#0F172A] shadow-xs font-bold'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          {t('superAdmin.oversight.tabVaccinations')}
        </button>
        <button
          onClick={() => setActiveTab('SURVEILLANCE')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === 'SURVEILLANCE'
              ? 'bg-white text-[#0F172A] shadow-xs font-bold'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          {t('superAdmin.oversight.tabSurveillance')}
        </button>
      </div>

      {/* Tab 1: Campaigns */}
      {activeTab === 'CAMPAIGNS' && (
        <Card className="p-4 border border-[#E2E8F0] bg-white text-xs space-y-3">
          <h2 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.oversight.activeCampaignsTitle')}
          </h2>
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#0F172A]">FMD Campaign — Statewide</span>
              <StatusChip status="ACTIVE" label={t('superAdmin.roles.activeStatus')} />
            </div>
            <p className="text-[#64748B] text-[11px]">
              {t('superAdmin.oversight.activeCampaignsTitle')}
            </p>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-[#135D43] h-full rounded-full" style={{ width: '83%' }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>{t('superAdmin.oversight.coveragePct')}: 83%</span>
              <span>Botad & Saurashtra Region</span>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 2: Vaccination Coverage */}
      {activeTab === 'VACCINATIONS' && (
        <Card className="p-4 border border-[#E2E8F0] bg-white text-xs space-y-3">
          <h2 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
            <Syringe className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.oversight.vaccinationsTitle')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-2.5 px-3">{t('superAdmin.assignments.districtLabel')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.oversight.targetAnimals')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.oversight.vaccinatedCount')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.oversight.coveragePct')}</th>
                  <th className="py-2.5 px-3 text-right">{t('superAdmin.dashboard.registryTable.thStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {(overview?.districts || []).slice(0, 8).map((d: any) => (
                  <tr key={d.district_id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-bold text-[#0F172A]">{localizeDistrict(d)}</td>
                    <td className="py-2.5 px-3 font-mono">{formatNumber(d.total_animals || 0)}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">{formatNumber(d.vaccinated_count || 0)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold">{formatNumber(d.vaccination_coverage_pct || 0)}%</td>
                    <td className="py-2.5 px-3 text-right">
                      <StatusChip
                        status={d.vaccination_coverage_pct >= 60 ? 'ACTIVE' : 'INACTIVE'}
                        label={d.vaccination_coverage_pct >= 60 ? 'Satisfactory' : 'In Progress'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Disease Surveillance */}
      {activeTab === 'SURVEILLANCE' && (
        <Card className="p-4 border border-[#E2E8F0] bg-white text-xs space-y-3">
          <h2 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.oversight.surveillanceTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <span className="font-bold text-amber-900">{t('superAdmin.oversight.suspectedReports')}</span>
              <p className="text-2xl font-bold text-amber-950 font-heading">
                {formatNumber(overview?.operational_kpis?.suspected_cases ?? 0)}
              </p>
              <p className="text-[11px] text-amber-800">VO verification queue</p>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <span className="font-bold text-rose-900">{t('superAdmin.oversight.confirmedReports')}</span>
              <p className="text-2xl font-bold text-rose-950 font-heading">
                {formatNumber(overview?.operational_kpis?.confirmed_cases ?? 0)}
              </p>
              <p className="text-[11px] text-rose-800">Containment protocol activated</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
