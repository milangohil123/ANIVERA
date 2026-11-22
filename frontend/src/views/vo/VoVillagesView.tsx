import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import { voService } from '../../services/voService';
import { reportService, type RegistryCountsReportItem } from '../../services/reportService';
import {
  MapPin,
  Search,
  RotateCcw,
  PawPrint,
  Users,
  Syringe,
  Activity,
  ChevronRight,
  TrendingUp,
  Map as MapIcon,
  ShieldAlert,
} from 'lucide-react';

interface VillageTelemetry {
  id: string;
  name_gu: string;
  name_en: string;
  code: string;
  animal_count: number;
  farmer_count: number;
  vaccinated_count: number;
  pending_count: number;
  coverage_pct: number;
  cattle_count: number;
  buffalo_count: number;
  goat_count: number;
  sheep_count: number;
}

export const VoVillagesView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';

  const [villages, setVillages] = useState<VillageTelemetry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVillageDetail, setSelectedVillageDetail] = useState<VillageTelemetry | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vList, registryList, vaccsList] = await Promise.all([
        voService.listVillages(apiBaseUrl).catch(() => []),
        reportService.getRegistryCounts(apiBaseUrl, token).catch(() => []),
        voService.listVaccinations(apiBaseUrl).catch(() => []),
      ]);

      const registryMap = new Map<string, RegistryCountsReportItem>();
      registryList.forEach((r) => registryMap.set(r.villageId, r));

      const vaxByVillage = new Map<string, number>();
      vaccsList.forEach((v) => {
        if (v.village_id) {
          vaxByVillage.set(v.village_id, (vaxByVillage.get(v.village_id) || 0) + 1);
        }
      });

      const combined: VillageTelemetry[] = vList.map((v) => {
        const reg = registryMap.get(v.id);
        const animals = reg?.totalAnimals || 0;
        const vax = vaxByVillage.get(v.id) || reg?.verifiedAnimals || 0;
        const covPct = animals > 0 ? Math.min(100, Math.round((vax / animals) * 100)) : 0;
        const pending = Math.max(0, animals - vax);

        return {
          id: v.id,
          name_gu: v.name_gu,
          name_en: v.name_en,
          code: v.code,
          animal_count: animals,
          farmer_count: reg?.farmerCount || 0,
          vaccinated_count: vax,
          pending_count: pending,
          coverage_pct: covPct,
          cattle_count: reg?.cattleCount || 0,
          buffalo_count: reg?.buffaloCount || 0,
          goat_count: reg?.goatCount || 0,
          sheep_count: reg?.sheepCount || 0,
        };
      });

      setVillages(combined);
    } catch (e) {
      console.warn('Failed to load village monitoring data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, token]);

  const filteredVillages = useMemo(() => {
    if (!searchQuery.trim()) return villages;
    const q = searchQuery.toLowerCase().trim();
    return villages.filter(
      (v) =>
        v.name_gu.toLowerCase().includes(q) ||
        v.name_en.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q)
    );
  }, [villages, searchQuery]);

  const totalVillages = villages.length;
  const totalAnimals = villages.reduce((acc, v) => acc + v.animal_count, 0);
  const totalFarmers = villages.reduce((acc, v) => acc + v.farmer_count, 0);
  const avgCoverage =
    totalVillages > 0
      ? Math.round(villages.reduce((acc, v) => acc + v.coverage_pct, 0) / totalVillages)
      : 0;

  const columns: Column<VillageTelemetry>[] = [
    {
      key: 'village_info',
      header: 'ગામનું નામ અને કોડ',
      render: (row) => (
        <div>
          <div className="font-bold text-[#0F172A] text-xs flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
            <span>{row.name_gu}</span>
            <span className="text-[11px] text-slate-400 font-normal">({row.name_en})</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5 ml-5">કોડ: {row.code}</div>
        </div>
      ),
    },
    {
      key: 'animals',
      header: 'નોંધાયેલ પશુઓ',
      render: (row) => (
        <div className="text-xs text-slate-800">
          <strong className="font-mono">{row.animal_count}</strong> પશુઓ
        </div>
      ),
    },
    {
      key: 'farmers',
      header: 'પશુપાલકો',
      render: (row) => (
        <div className="text-xs text-slate-800">
          <strong className="font-mono">{row.farmer_count}</strong> ખેડૂતો
        </div>
      ),
    },
    {
      key: 'coverage',
      header: 'રસીકરણ કવરેજ દર',
      render: (row) => {
        const isHigh = row.coverage_pct >= 80;
        const isMedium = row.coverage_pct >= 50;

        return (
          <div className="space-y-1 min-w-[120px]">
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-mono font-bold ${
                  isHigh ? 'text-emerald-700' : isMedium ? 'text-amber-700' : 'text-red-700'
                }`}
              >
                {row.coverage_pct}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {row.vaccinated_count}/{row.animal_count}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isHigh ? 'bg-emerald-600' : isMedium ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, row.coverage_pct)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'કાર્યવાહી',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedVillageDetail(row)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#135D43] shadow-2xs transition-colors"
        >
          <span>ગામ પૃથ્થકરણ</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#135D43]" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              કાર્યક્ષેત્ર ગામ મોનિટરિંગ અને પૃથ્થકરણ (Village Monitoring)
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {totalVillages} સોંપાયેલ ગામડાં
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            તમારા અધિકૃત ગામોનું પશુધન વિતરણ, રસીકરણ પૂર્ણતા દર અને આરોગ્ય સ્થિતિ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            રીફ્રેશ
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/vo/maps')}
            leftIcon={<MapIcon className="w-3.5 h-3.5" />}
          >
            GIS નકશામાં જુઓ
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="સોંપાયેલ ગામડાં"
          value={isLoading ? '...' : totalVillages}
          subtext="અધિકૃત કાર્યક્ષેત્ર"
          icon={<MapPin className="w-4 h-4 text-[#135D43]" />}
          iconVariant="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="કુલ પશુધન"
          value={isLoading ? '...' : totalAnimals}
          valueColor="text-[#135D43]"
          subtext="નોંધાયેલ કુલ પશુઓ"
          icon={<PawPrint className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
        <KpiCard
          label="કુલ પશુપાલકો"
          value={isLoading ? '...' : totalFarmers}
          valueColor="text-[#0284C7]"
          subtext="નોંધાયેલ ખેડૂતો"
          icon={<Users className="w-4 h-4 text-[#0284C7]" />}
          iconVariant="secondary"
          isLoading={isLoading}
        />
        <KpiCard
          label="સરેરાશ કવરેજ દર"
          value={isLoading ? '...' : `${avgCoverage}%`}
          valueColor={avgCoverage >= 80 ? 'text-emerald-700' : 'text-amber-700'}
          subtext="ઝુંબેશ રસીકરણ પ્રગતિ"
          icon={<TrendingUp className="w-4 h-4 text-emerald-700" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
      </div>

      {/* 3. Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ગામનું નામ અથવા કોડ શોધો..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#135D43] bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* 4. Villages Table */}
      {isLoading ? (
        <StateView state="loading" message="ગામ મોનિટરિંગ માહિતી લોડ થઈ રહી છે..." />
      ) : filteredVillages.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ ગામ મળ્યા નથી"
          message="તમારા સોંપાયેલા અધિકૃત કાર્યક્ષેત્રમાં કોઈ ગામ ઉપલબ્ધ નથી."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <DataTable data={filteredVillages} columns={columns} keyExtractor={(v) => v.id} />
        </div>
      )}

      {/* 5. Village Detail & Analytics Modal */}
      {selectedVillageDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVillageDetail(null)}
          title={`ગામ પૃથ્થકરણ: ${selectedVillageDetail.name_gu} (${selectedVillageDetail.code})`}
        >
          <div className="space-y-4">
            {/* Top Stat Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">કુલ પશુધન</span>
                <strong className="text-sm font-mono text-slate-900 block mt-0.5">
                  {selectedVillageDetail.animal_count}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-emerald-700 block">રસીકરણ થયેલ</span>
                <strong className="text-sm font-mono text-emerald-900 block mt-0.5">
                  {selectedVillageDetail.vaccinated_count}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-700 block">બાકી પશુઓ</span>
                <strong className="text-sm font-mono text-amber-900 block mt-0.5">
                  {selectedVillageDetail.pending_count}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-[11px] text-blue-700 block">કવરેજ ટકાવારી</span>
                <strong className="text-sm font-mono text-blue-900 block mt-0.5">
                  {selectedVillageDetail.coverage_pct}%
                </strong>
              </div>
            </div>

            {/* Species Breakdown */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <PawPrint className="w-3.5 h-3.5 text-[#135D43]" />
                <span>જાતિવાર પશુધન વહેંચણી (Species Composition)</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">ગાય (Cattle):</span>{' '}
                  <strong className="text-slate-900 font-mono">{selectedVillageDetail.cattle_count}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">ભેંસ (Buffalo):</span>{' '}
                  <strong className="text-slate-900 font-mono">{selectedVillageDetail.buffalo_count}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">બકરી (Goat):</span>{' '}
                  <strong className="text-slate-900 font-mono">{selectedVillageDetail.goat_count}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">ઘેટાં (Sheep):</span>{' '}
                  <strong className="text-slate-900 font-mono">{selectedVillageDetail.sheep_count}</strong>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/vo/maps')}
                leftIcon={<MapIcon className="w-3.5 h-3.5" />}
              >
                આ ગામ નકશામાં જુઓ
              </Button>

              <Button variant="primary" size="sm" onClick={() => setSelectedVillageDetail(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
