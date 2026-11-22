import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import {
  fwService,
  type FWVillageItem,
  type FWCampaignAssignmentItem,
} from '../../services/fwService';
import {
  MapPin,
  Users,
  PawPrint,
  Syringe,
  Megaphone,
  Search,
  RotateCcw,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Activity,
  Calendar,
  Building,
} from 'lucide-react';

interface VillageTelemetry {
  village: FWVillageItem;
  totalFarmers: number;
  totalAnimals: number;
  vaccinatedCount: number;
  coveragePercentage: number;
  activeCampaignsCount: number;
  isLoading: boolean;
}

export const FwVillagesView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();

  const [villages, setVillages] = useState<FWVillageItem[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, VillageTelemetry>>({});
  const [campaigns, setCampaigns] = useState<FWCampaignAssignmentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVillageDetail, setSelectedVillageDetail] = useState<VillageTelemetry | null>(null);

  // Load initial assigned villages and campaigns
  const loadVillages = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [vList, cList] = await Promise.all([
        fwService.listAssignedVillages(apiBaseUrl).catch(() => []),
        fwService.listMyCampaignAssignments(apiBaseUrl).catch(() => []),
      ]);
      setVillages(vList);
      setCampaigns(cList);

      // Pre-seed telemetry map
      const initialMap: Record<string, VillageTelemetry> = {};
      vList.forEach((v) => {
        const vCampaigns = cList.filter((c) => c.village_id === v.id);
        initialMap[v.id] = {
          village: v,
          totalFarmers: 0,
          totalAnimals: 0,
          vaccinatedCount: 0,
          coveragePercentage: 0,
          activeCampaignsCount: vCampaigns.length,
          isLoading: true,
        };
      });
      setTelemetryMap(initialMap);

      // Hydrate telemetry asynchronously
      for (const v of vList) {
        fwService
          .getVillageStats(apiBaseUrl, v.id)
          .then((stats) => {
            setTelemetryMap((prev) => ({
              ...prev,
              [v.id]: {
                ...prev[v.id],
                totalFarmers: stats.total_farmers,
                totalAnimals: stats.total_animals,
                vaccinatedCount: stats.vaccinated_count,
                coveragePercentage: stats.coverage_percentage,
                isLoading: false,
              },
            }));
          })
          .catch(() => {
            setTelemetryMap((prev) => ({
              ...prev,
              [v.id]: { ...prev[v.id], isLoading: false },
            }));
          });
      }
    } catch (e) {
      console.warn('Failed to load assigned villages:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadVillages();
  }, [apiBaseUrl]);

  // Aggregate KPIs
  const kpiData = useMemo(() => {
    const totalVillages = villages.length;
    let totalAnimals = 0;
    let totalVaccinated = 0;
    let totalFarmers = 0;

    Object.values(telemetryMap).forEach((t) => {
      totalAnimals += t.totalAnimals;
      totalVaccinated += t.vaccinatedCount;
      totalFarmers += t.totalFarmers;
    });

    const avgCoverage =
      totalAnimals > 0 ? Math.round((totalVaccinated / totalAnimals) * 100) : 0;

    return {
      totalVillages,
      totalAnimals,
      totalFarmers,
      avgCoverage,
      activeCampaigns: campaigns.length,
    };
  }, [villages, telemetryMap, campaigns]);

  // Filtered villages
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

  const handleSelectVillageForWork = (villageId: string, path: string) => {
    localStorage.setItem('fw_active_village_id', villageId);
    navigate(path);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-body text-[#172033] animate-fade-in">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F3EF] text-[#176B5B] flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#0F172A] font-heading flex items-center gap-2">
              સોંપાયેલ ગામો અને કાર્યક્ષેત્ર
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {villages.length} ગામો
              </span>
            </h1>
            <p className="text-xs text-[#64748B]">
              ક્ષેત્રીય કાર્યકર તરીકે સોંપાયેલ તમામ ગામો, પશુધન વસ્તી, રસીકરણ સ્થિતિ અને ઝુંબેશ પ્રગતિ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadVillages(true)}
            isLoading={isRefreshing}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#176B5B]" />}
            className="text-xs"
          >
            તાજું કરો
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/fw/maps')}
            leftIcon={<Layers className="w-3.5 h-3.5" />}
            className="text-xs bg-[#176B5B] hover:bg-[#135D43]"
          >
            GIS નકશામાં જુઓ
          </Button>
        </div>
      </div>

      {/* 2. 4 Standard KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Villages */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              સોંપાયેલ ગામો
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.totalVillages}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
              સક્રિય કાર્યક્ષેત્ર
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#176B5B] flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Total Livestock */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              નોંધાયેલ પશુધન
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.totalAnimals}
            </p>
            <p className="text-[10px] text-[#64748B] mt-0.5">
              {kpiData.totalFarmers} પશુપાલકો
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <PawPrint className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Coverage Rate */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              સરેરાશ રસીકરણ
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.avgCoverage}%
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
              લક્ષ્યાંક સામે પ્રગતિ
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-[#176B5B] flex items-center justify-center">
            <Syringe className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Active Campaigns */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              સક્રિય ઝુંબેશો
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.activeCampaigns}
            </p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">
              ગામવાર લક્ષ્યાંક
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ગામનું નામ અથવા કોડ શોધો..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#176B5B] focus:border-transparent outline-none bg-neutral-50/50"
          />
        </div>
        <div className="text-xs text-[#64748B] self-start sm:self-auto">
          કુલ <span className="font-bold text-[#0F172A]">{filteredVillages.length}</span> ગામો દર્શાવેલ છે
        </div>
      </div>

      {/* 4. Villages Grid */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#E2E8F0]">
          <StateView state="loading" title="ગામની યાદી લોડ થઈ રહી છે..." />
        </div>
      ) : filteredVillages.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#E2E8F0]">
          <StateView
            state="empty"
            title="કોઈ ગામ મળ્યું નથી"
            message={
              searchQuery
                ? 'શોધેલ શબ્દ સાથે કોઈ મેળ ખાતું ગામ મળ્યું નથી.'
                : 'તમારા એકાઉન્ટ સાથે હાલમાં કોઈ ગામ સોંપાયેલ નથી. કૃપા કરીને વેટરનરી અધિકારી (VO) નો સંપર્ક કરો.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVillages.map((village) => {
            const telemetry = telemetryMap[village.id] || {
              totalFarmers: 0,
              totalAnimals: 0,
              vaccinatedCount: 0,
              coveragePercentage: 0,
              activeCampaignsCount: 0,
              isLoading: false,
            };

            const villageCampaigns = campaigns.filter((c) => c.village_id === village.id);

            return (
              <div
                key={village.id}
                className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs hover:border-[#176B5B]/50 transition-all duration-150 p-4.5 flex flex-col justify-between"
              >
                <div>
                  {/* Village Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-[#0F172A] font-heading flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#176B5B] shrink-0" />
                        <span>{village.name_gu}</span>
                        <span className="text-[11px] font-normal text-neutral-400">
                          ({village.name_en})
                        </span>
                      </h3>
                      <p className="text-[11px] text-[#64748B] font-mono mt-0.5">
                        કોડ: {village.code} {village.census_code ? `• સેન્સસ: ${village.census_code}` : ''}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-[#176B5B] border border-[#176B5B]/20">
                      સક્રિય
                    </span>
                  </div>

                  {/* Telemetry Stats */}
                  <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100 my-3 text-center">
                    <div>
                      <p className="text-[10px] text-neutral-500 font-medium">ખેડૂતો</p>
                      <p className="text-xs sm:text-sm font-bold text-[#0F172A] mt-0.5">
                        {telemetry.isLoading ? '...' : telemetry.totalFarmers}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-500 font-medium">પશુધન</p>
                      <p className="text-xs sm:text-sm font-bold text-[#0F172A] mt-0.5">
                        {telemetry.isLoading ? '...' : telemetry.totalAnimals}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-500 font-medium">રસીકરણ</p>
                      <p className="text-xs sm:text-sm font-bold text-emerald-700 mt-0.5">
                        {telemetry.isLoading ? '...' : `${telemetry.coveragePercentage}%`}
                      </p>
                    </div>
                  </div>

                  {/* Coverage Progress Bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-[10px] text-neutral-500 font-medium">
                      <span>રસીકરણ કવરેજ</span>
                      <span>{telemetry.coveragePercentage}% પૂર્ણ</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#176B5B] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(telemetry.coveragePercentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Campaign Pills */}
                  {villageCampaigns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {villageCampaigns.slice(0, 2).map((camp) => (
                        <span
                          key={camp.campaign_id}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                        >
                          {camp.campaign_name || camp.campaign_code}
                        </span>
                      ))}
                      {villageCampaigns.length > 2 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 text-neutral-600">
                          +{villageCampaigns.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSelectVillageForWork(village.id, '/fw/animals')}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] hover:bg-[#DCFCE7] transition-colors"
                  >
                    <PawPrint className="w-3.5 h-3.5" />
                    પશુધન ({telemetry.totalAnimals})
                  </button>
                  <button
                    onClick={() => handleSelectVillageForWork(village.id, '/fw/vaccinations')}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#176B5B] text-white hover:bg-[#135D43] transition-colors shadow-xs"
                  >
                    <Syringe className="w-3.5 h-3.5" />
                    રસીકરણ કરો
                  </button>
                  <button
                    onClick={() => handleSelectVillageForWork(village.id, '/fw/farmers')}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    પશુપાલકો
                  </button>
                  <button
                    onClick={() => setSelectedVillageDetail({ village, ...telemetry })}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    વિગત જુઓ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Village Detail Modal */}
      {selectedVillageDetail && (
        <Modal
          isOpen={Boolean(selectedVillageDetail)}
          onClose={() => setSelectedVillageDetail(null)}
          title={`ગામ વિગતો: ${selectedVillageDetail.village.name_gu} (${selectedVillageDetail.village.name_en})`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-neutral-500 font-medium">ગામ કોડ</p>
                  <p className="font-mono font-bold text-[#0F172A] mt-0.5">
                    {selectedVillageDetail.village.code}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-500 font-medium">કુલ ખેડૂતો</p>
                  <p className="font-bold text-base text-[#0F172A] mt-0.5">
                    {selectedVillageDetail.totalFarmers}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-500 font-medium">કુલ પશુધન</p>
                  <p className="font-bold text-base text-[#0F172A] mt-0.5">
                    {selectedVillageDetail.totalAnimals}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-500 font-medium">કવરેજ દર</p>
                  <p className="font-bold text-base text-emerald-700 mt-0.5">
                    {selectedVillageDetail.coveragePercentage}%
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Workflow Triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  handleSelectVillageForWork(selectedVillageDetail.village.id, '/fw/animals');
                  setSelectedVillageDetail(null);
                }}
                leftIcon={<PawPrint className="w-4 h-4" />}
                className="w-full bg-[#176B5B] hover:bg-[#135D43]"
              >
                પશુ યાદી અને નોંધણી
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleSelectVillageForWork(selectedVillageDetail.village.id, '/fw/vaccinations');
                  setSelectedVillageDetail(null);
                }}
                leftIcon={<Syringe className="w-4 h-4" />}
                className="w-full"
              >
                રસીકરણ નોંધણી
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleSelectVillageForWork(selectedVillageDetail.village.id, '/fw/farmers');
                  setSelectedVillageDetail(null);
                }}
                leftIcon={<Users className="w-4 h-4" />}
                className="w-full"
              >
                સહાયક ખેડૂત નોંધણી
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
