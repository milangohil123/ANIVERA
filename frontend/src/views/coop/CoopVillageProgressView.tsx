import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  coopService,
  type CoopVillageProgressItem,
  type CoopVillageDetailTelemetry,
} from '../../services/coopService';
import { KpiCard } from '../../components/common/KpiCard';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import {
  Building2,
  Download,
  Eye,
  MapPin,
  Search,
  X,
  PawPrint,
  Syringe,
  AlertTriangle,
  Tent,
  Clock,
  RotateCcw,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { reportService } from '../../services/reportService';

export const CoopVillageProgressView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';

  const [villages, setVillages] = useState<CoopVillageProgressItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [villageDetails, setVillageDetails] = useState<CoopVillageDetailTelemetry | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'overview' | 'farmers' | 'animals' | 'vaccinations' | 'surveillance'>('overview');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownloadCsv = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      await reportService.downloadCoopProgressCsv(apiBaseUrl, token);
    } catch (err: any) {
      alert(err?.message || 'CSV ડાઉનલોડ નિષ્ફળ.');
    } finally {
      setIsExporting(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await coopService.getServedVillagesProgress(apiBaseUrl);
      setVillages(data || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  // Load Village details when selected
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

  const filteredVillages = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return villages;
    return villages.filter((v) =>
      (v.village_name || '').toLowerCase().includes(term) ||
      (v.village_code || '').toLowerCase().includes(term)
    );
  }, [villages, searchTerm]);

  // Aggregated KPI numbers
  const totalMembers = useMemo(() => villages.reduce((sum, v) => sum + (v.total_farmers || 0), 0), [villages]);
  const totalAnimals = useMemo(() => villages.reduce((sum, v) => sum + (v.total_animals || 0), 0), [villages]);
  const totalVaccinated = useMemo(() => villages.reduce((sum, v) => sum + (v.vaccinated_animals || 0), 0), [villages]);
  const overallPct = totalAnimals > 0 ? ((totalVaccinated / totalAnimals) * 100).toFixed(1) : '0';

  const highCoverageCount = useMemo(() => villages.filter((v) => v.coverage_percent >= 80).length, [villages]);
  const moderateCoverageCount = useMemo(
    () => villages.filter((v) => v.coverage_percent >= 50 && v.coverage_percent < 80).length,
    [villages]
  );
  const lowCoverageCount = useMemo(() => villages.filter((v) => v.coverage_percent < 50).length, [villages]);
  const alertVillagesCount = useMemo(() => villages.filter((v) => v.disease_alert).length, [villages]);

  if (isLoading && villages.length === 0) {
    return <StateView state="loading" message="ગામવાર પ્રગતિ ડેટા લોડ થઈ રહ્યો છે..." />;
  }

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
            ગામવાર રસીકરણ પ્રગતિ • {villages.length} કાર્યક્ષેત્ર ગામો
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              ગામવાર રસીકરણ પ્રગતિ અને કામગીરી
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>કાર્યક્ષેત્ર ગામ પ્રગતિ સક્રિય</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />
              <span>તાજું કરો</span>
            </button>

            <button
              onClick={() => navigate('/coop/maps')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#E8EEFC] text-xs font-semibold text-[#135D43] hover:bg-[#D8E4FA] shadow-xs transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
              <span>GIS ભૌગોલિક નકશો</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>{isExporting ? 'નિકાસ થઈ રહી છે...' : 'CSV ડાઉનલોડ'}</span>
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
                સત્તાવાર કાર્યક્ષેત્ર ગામવાર કામગીરી
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                ગામડાં સ્તર મોનિટરિંગ
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              કુલ કાર્યક્ષેત્ર ગામો: {villages.length} • સભાસદ ખેડૂતો: {totalMembers} • સંલગ્ન પશુધન: {totalAnimals} • રસીકરણ થયેલ: {totalVaccinated} ({overallPct}%). ગામ પર ક્લિક કરીને ઊંડાણપૂર્વક વિગત જુઓ.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/maps')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>નકશામાં જુઓ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ કાર્યક્ષેત્ર ગામો"
          value={isLoading ? '...' : String(villages.length)}
          subtext="મંડળી અધિકારક્ષેત્ર"
          icon={<Building2 className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="ઉચ્ચ કવરેજ (80%+)"
          value={isLoading ? '...' : String(highCoverageCount)}
          valueColor="text-[#176B5B]"
          subtext="સંતોષકારક સ્થિતિ"
          icon={<CheckCircle2 className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          badgeText="શ્રેષ્ઠ"
          badgeVariant="emerald"
        />

        <KpiCard
          label="મધ્યમ કવરેજ (50-80%)"
          value={isLoading ? '...' : String(moderateCoverageCount)}
          valueColor="text-amber-700"
          subtext="ચાલુ કામગીરી"
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
        />

        <KpiCard
          label="ઓછું કવરેજ (<50%)"
          value={isLoading ? '...' : String(lowCoverageCount)}
          valueColor={lowCoverageCount > 0 ? 'text-red-600' : 'text-slate-700'}
          subtext={alertVillagesCount > 0 ? `${alertVillagesCount} રોગ એલર્ટ ગામો` : 'ધ્યાન જરૂરી'}
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          iconVariant={lowCoverageCount > 0 ? 'red' : 'slate'}
        />

        <KpiCard
          label="સરેરાશ રસીકરણ સિદ્ધિ"
          value={isLoading ? '...' : `${overallPct}%`}
          valueColor="text-[#135D43]"
          subtext={`${totalVaccinated} / ${totalAnimals} સુરક્ષિત`}
          icon={<Syringe className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          badgeText="પ્રગતિમાં"
          badgeVariant="emerald"
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. VILLAGES TABLE SECTION                                              */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 text-[#176B5B] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base font-heading">
                કાર્યક્ષેત્ર ગામોની રસીકરણ સ્થિતિ અને સભાસદ યાદી
              </h3>
              <p className="text-xs text-slate-500">
                ગામ પર ક્લિક કરીને ખેડૂતો, પશુધન અને રસીકરણ ઇતિહાસની સંપૂર્ણ વિગત તપાસો
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ગામના નામ અથવા કોડ વડે શોધો..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#135D43]"
              />
            </div>
          </div>
        </div>

        {/* Table Body */}
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs border-b border-red-200">
            {errorMsg}
          </div>
        )}

        {filteredVillages.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">આ શોધ સાથે મેળ ખાતું કોઈ ગામ મળ્યું નથી.</p>
            <p className="text-xs text-slate-400">શોધ શબ્દ તપાસીને ફરી પ્રયાસ કરો.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="p-3">ગામ</th>
                  <th className="p-3">ગામ કોડ</th>
                  <th className="p-3 text-center">સભ્ય પશુપાલકો</th>
                  <th className="p-3 text-center">કુલ પશુઓ</th>
                  <th className="p-3 text-center">રસીકરણ થયેલ</th>
                  <th className="p-3">કવરેજ (%)</th>
                  <th className="p-3 text-center">સ્થિતિ</th>
                  <th className="p-3 text-right">કાર્યવાહી</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVillages.map((v) => (
                  <tr
                    key={v.village_id}
                    className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedVillageId(v.village_id);
                      setActiveDrawerTab('overview');
                    }}
                  >
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                      {v.village_name}
                      {v.disease_alert && (
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block ml-1" title="રોગ એલર્ટ" />
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-500">{v.village_code}</td>
                    <td className="p-3 text-center text-slate-900 font-medium">{v.total_farmers}</td>
                    <td className="p-3 text-center text-slate-900 font-bold">{v.total_animals}</td>
                    <td className="p-3 text-center text-[#135D43] font-bold">{v.vaccinated_animals}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              v.coverage_percent >= 80
                                ? 'bg-emerald-600'
                                : v.coverage_percent >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(v.coverage_percent, 100)}%` }}
                          />
                        </div>
                        <span className="font-bold text-[11px] text-slate-800 font-mono">
                          {v.coverage_percent}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                          v.disease_alert
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : v.coverage_percent >= 80
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : v.coverage_percent >= 50
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}
                      >
                        {v.disease_alert
                          ? 'રોગ એલર્ટ'
                          : v.coverage_percent >= 80
                          ? 'ઉચ્ચ'
                          : v.coverage_percent >= 50
                          ? 'મધ્યમ'
                          : 'ઓછું'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedVillageId(v.village_id);
                            setActiveDrawerTab('overview');
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#E8F5E9] text-[#135D43] hover:bg-[#C8E6C9] flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3 h-3" />
                          વિગત
                        </button>
                        <button
                          onClick={() => navigate(`/coop/maps?village_id=${v.village_id}`)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F1F5F9] text-slate-600 hover:text-slate-900 hover:bg-[#E2E8F0] flex items-center gap-1 transition-all"
                          title="નકશા પર જુઓ"
                        >
                          <MapPin className="w-3 h-3 text-[#135D43]" />
                          નકશો
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 5. SELECTED VILLAGE IN-DEPTH MODAL ("ગામમાં શું થયું છે")             */}
      {/* ---------------------------------------------------------------------- */}
      {selectedVillageId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-body">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[#E2E8F0]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <span className="text-[10px] font-bold text-[#135D43] uppercase tracking-wider block">
                  ગામ કામગીરી અને સ્થિતિ વિગત
                </span>
                <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#135D43]" />
                  {villageDetails?.village?.name_gu || 'ગામ વિગત'}
                  <span className="text-xs font-mono font-normal text-slate-500">
                    ({villageDetails?.village?.code})
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/coop/maps?village_id=${selectedVillageId}`)}
                  leftIcon={<MapPin className="w-3.5 h-3.5 text-[#135D43]" />}
                >
                  GIS નકશામાં જુઓ
                </Button>
                <button
                  onClick={() => setSelectedVillageId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-4 pt-2 border-b border-[#E2E8F0] overflow-x-auto text-xs bg-white">
              <button
                onClick={() => setActiveDrawerTab('overview')}
                className={`px-3 py-2 font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeDrawerTab === 'overview'
                    ? 'border-[#135D43] text-[#135D43]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                ઝાંખી (Overview)
              </button>
              <button
                onClick={() => setActiveDrawerTab('farmers')}
                className={`px-3 py-2 font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeDrawerTab === 'farmers'
                    ? 'border-[#135D43] text-[#135D43]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                સભાસદ ખેડૂતો ({villageDetails?.farmers?.length || 0})
              </button>
              <button
                onClick={() => setActiveDrawerTab('animals')}
                className={`px-3 py-2 font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeDrawerTab === 'animals'
                    ? 'border-[#135D43] text-[#135D43]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                સંલગ્ન પશુધન ({villageDetails?.animals?.length || 0})
              </button>
              <button
                onClick={() => setActiveDrawerTab('vaccinations')}
                className={`px-3 py-2 font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeDrawerTab === 'vaccinations'
                    ? 'border-[#135D43] text-[#135D43]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                રસીકરણ ઇતિહાસ ({villageDetails?.vaccinations?.length || 0})
              </button>
              <button
                onClick={() => setActiveDrawerTab('surveillance')}
                className={`px-3 py-2 font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeDrawerTab === 'surveillance'
                    ? 'border-[#135D43] text-[#135D43]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                રોગ સર્વેલન્સ અને કેમ્પ
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 text-xs">
              {isDetailsLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="w-6 h-6 border-2 border-[#135D43] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>વિગતો લોડ થઈ રહી છે...</span>
                </div>
              ) : !villageDetails ? (
                <div className="py-12 text-center text-slate-500">કોઈ વિગત મળી નથી.</div>
              ) : (
                <div className="space-y-4">
                  {/* Tab 1: Overview */}
                  {activeDrawerTab === 'overview' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">સભ્ય પશુપાલકો</span>
                          <span className="text-lg font-bold text-slate-900 font-heading">
                            {villageDetails.kpis.total_members}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">કુલ પશુઓ</span>
                          <span className="text-lg font-bold text-slate-900 font-heading">
                            {villageDetails.kpis.total_animals}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9]">
                          <span className="text-[10px] text-[#135D43] block">રસીકરણ થયેલ</span>
                          <span className="text-lg font-bold text-[#135D43] font-heading">
                            {villageDetails.kpis.vaccinated_animals}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                          <span className="text-[10px] text-amber-800 block">બાકી રસીકરણ</span>
                          <span className="text-lg font-bold text-amber-700 font-heading">
                            {villageDetails.kpis.pending_animals}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">રસીકરણ કવરેજ સિદ્ધિ:</span>
                          <span className="font-bold text-emerald-800 font-mono text-sm">
                            {villageDetails.kpis.coverage_pct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-[#135D43] rounded-full"
                            style={{ width: `${Math.min(villageDetails.kpis.coverage_pct, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Species Breakdown */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                          પ્રજાતિ મુજબ વિભાજન (Species Count)
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                          <div className="p-2 rounded-lg bg-slate-50">
                            <span className="text-slate-500 block text-[10px]">ગાય (Cattle)</span>
                            <span className="font-bold font-mono text-slate-900">{villageDetails.species_breakdown?.CATTLE || 0}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50">
                            <span className="text-slate-500 block text-[10px]">ભેંસ (Buffalo)</span>
                            <span className="font-bold font-mono text-slate-900">{villageDetails.species_breakdown?.BUFFALO || 0}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50">
                            <span className="text-slate-500 block text-[10px]">બકરી (Goat)</span>
                            <span className="font-bold font-mono text-slate-900">{villageDetails.species_breakdown?.GOAT || 0}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50">
                            <span className="text-slate-500 block text-[10px]">ઘેટાં (Sheep)</span>
                            <span className="font-bold font-mono text-slate-900">{villageDetails.species_breakdown?.SHEEP || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Farmers */}
                  {activeDrawerTab === 'farmers' && (
                    <div className="space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">ખેડૂતનું નામ</th>
                              <th className="p-2.5">સભ્ય નં</th>
                              <th className="p-2.5">મોબાઇલ</th>
                              <th className="p-2.5 text-center">પશુઓ</th>
                              <th className="p-2.5 text-center">રસીકરણ</th>
                              <th className="p-2.5 text-right">કવરેજ (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {villageDetails.farmers.map((f) => (
                              <tr key={f.farmer_id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-semibold text-slate-900">{f.full_name}</td>
                                <td className="p-2.5 font-mono text-[#135D43]">{f.member_no || f.farmer_code}</td>
                                <td className="p-2.5 font-mono text-slate-500">{f.mobile_e164 || '-'}</td>
                                <td className="p-2.5 text-center font-semibold">{f.total_animals}</td>
                                <td className="p-2.5 text-center text-emerald-700 font-semibold">{f.vaccinated_animals}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-800">{f.coverage_percent}%</td>
                              </tr>
                            ))}
                            {villageDetails.farmers.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-6 text-center text-slate-400">
                                  આ ગામમાં કોઈ સભાસદ નોંધાયેલ નથી.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Animals */}
                  {activeDrawerTab === 'animals' && (
                    <div className="space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">ટેગ / કોડ</th>
                              <th className="p-2.5">પ્રજાતિ</th>
                              <th className="p-2.5">ઓળખ / જાતિ</th>
                              <th className="p-2.5">માલિકનું નામ</th>
                              <th className="p-2.5 text-center">સ્થિતિ</th>
                              <th className="p-2.5 text-right">આગામી તારીખ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {villageDetails.animals.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-mono font-semibold text-slate-900">
                                  {a.bharat_pashudhan_tag || a.animal_code}
                                </td>
                                <td className="p-2.5">{a.species}</td>
                                <td className="p-2.5 text-slate-500">{a.breed}</td>
                                <td className="p-2.5 text-slate-900">{a.farmer_name}</td>
                                <td className="p-2.5 text-center">
                                  <span
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                      a.vaccination_status === 'COVERED'
                                        ? 'bg-emerald-50 text-emerald-800'
                                        : a.vaccination_status === 'OVERDUE'
                                        ? 'bg-red-50 text-red-800'
                                        : 'bg-amber-50 text-amber-800'
                                    }`}
                                  >
                                    {a.vaccination_status}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-500">
                                  {a.next_due_date || '-'}
                                </td>
                              </tr>
                            ))}
                            {villageDetails.animals.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-6 text-center text-slate-400">
                                  કોઈ પશુધન નોંધાયેલ નથી.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 4: Vaccinations */}
                  {activeDrawerTab === 'vaccinations' && (
                    <div className="space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">રસીનું નામ</th>
                              <th className="p-2.5">લક્ષિત રોગ</th>
                              <th className="p-2.5">પશુપાલક</th>
                              <th className="p-2.5">ડોઝ / બેચ</th>
                              <th className="p-2.5 text-right">તારીખ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {villageDetails.vaccinations.map((v) => (
                              <tr key={v.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-semibold text-[#135D43]">{v.vaccine_name}</td>
                                <td className="p-2.5 text-slate-900">{v.disease_name}</td>
                                <td className="p-2.5 text-slate-500">{v.farmer_name}</td>
                                <td className="p-2.5 font-mono text-[10px]">#{v.dose_number} • {v.batch_number}</td>
                                <td className="p-2.5 text-right font-mono text-slate-500">{v.administered_at?.split('T')[0]}</td>
                              </tr>
                            ))}
                            {villageDetails.vaccinations.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-slate-400">
                                  તાજેતરમાં કોઈ રસીકરણ નોંધાયેલ નથી.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 5: Surveillance & Camps */}
                  {activeDrawerTab === 'surveillance' && (
                    <div className="space-y-4">
                      {/* Disease Reports */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          શંકાસ્પદ રોગ સર્વેલન્સ કેસ ({villageDetails.disease_reports.length})
                        </h4>
                        <div className="space-y-2">
                          {villageDetails.disease_reports.map((dr) => (
                            <div key={dr.report_id} className="p-2.5 rounded-xl border border-red-200 bg-red-50/40 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-red-900">{dr.disease_code}</span>
                                <span className="text-[10px] text-slate-500 font-mono ml-2">({dr.report_code})</span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-red-700 border border-red-200">
                                {dr.status}
                              </span>
                            </div>
                          ))}
                          {villageDetails.disease_reports.length === 0 && (
                            <p className="p-3 bg-slate-50 text-center text-slate-400 rounded-xl border border-slate-200">
                              કોઈ સક્રિય શંકાસ્પદ રોગ રિપોર્ટ નથી.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Camps */}
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <Tent className="w-3.5 h-3.5 text-amber-600" />
                          પશુ આરોગ્ય કેમ્પ અને ઝુંબેશ ({villageDetails.camps.length})
                        </h4>
                        <div className="space-y-2">
                          {villageDetails.camps.map((camp) => (
                            <div key={camp.id} className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-amber-900">{camp.camp_code}</span>
                                {camp.location_text && <span className="text-[10px] text-slate-500 ml-2">({camp.location_text})</span>}
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-amber-800 border border-amber-200">
                                {camp.status}
                              </span>
                            </div>
                          ))}
                          {villageDetails.camps.length === 0 && (
                            <p className="p-3 bg-slate-50 text-center text-slate-400 rounded-xl border border-slate-200">
                              કોઈ કેમ્પ આયોજિત નથી.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#E2E8F0] flex justify-end bg-[#F8FAFC]">
              <Button variant="outline" size="sm" onClick={() => setSelectedVillageId(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
