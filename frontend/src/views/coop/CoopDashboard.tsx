import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coopService, type CoopDashboardAnalytics } from '../../services/coopService';
import { KpiCard } from '../../components/common/KpiCard';
import { StateView } from '../../components/common/StateView';
import {
  Building2,
  Users,
  PawPrint,
  Syringe,
  Megaphone,
  Activity,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  Clock,
  RotateCcw,
  ChevronRight,
  TrendingUp,
  BarChart3,
  FileText,
  ShieldCheck,
  Tent,
  ArrowRight,
  Layers,
} from 'lucide-react';

export const CoopDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [analytics, setAnalytics] = useState<CoopDashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await coopService.getDashboardAnalytics(apiBaseUrl);
      setAnalytics(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'ડેરી સહકારી ડેશબોર્ડ ડેટા લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  if (isLoading && !analytics) {
    return <StateView state="loading" message="ડેરી સહકારી ડેશબોર્ડ લોડ થઈ રહ્યું છે..." />;
  }

  if (errorMsg && !analytics) {
    return (
      <StateView
        state="error"
        message={errorMsg}
        onRetry={loadData}
      />
    );
  }

  const kpis = analytics?.kpis || {
    total_member_farmers: 0,
    total_animals: 0,
    fully_vaccinated_animals: 0,
    partially_vaccinated_animals: 0,
    pending_vaccinations: 0,
    overdue_vaccinations: 0,
    overall_coverage_pct: 0,
    active_campaigns: 0,
    linked_villages: 0,
    suspected_disease_cases: 0,
    total_camps: 0,
  };

  const charts = analytics?.charts || {
    monthly_trend: [],
    species_distribution: [],
    status_distribution: [],
    village_farmers: [],
    village_livestock: [],
    village_coverage: [],
    campaign_progress: [],
    disease_trends: [],
  };

  const coopInfo = analytics?.cooperative || {};

  return (
    <div className="w-full space-y-4 animate-fade-in pb-12 font-body text-[#172033]">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER (Exact Reference Image Design)        */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>કામગીરી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>ડેરી સહકારી મંડળી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">
            {coopInfo.name_gu || 'ડેરી સહકારી મંડળી'} • {kpis.linked_villages} કાર્યક્ષેત્ર ગામો
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              ડેરી ઝાંખી ({coopInfo.name_gu || 'મંડળી ડેશબોર્ડ'})
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>સહકારી વહીવટ સક્રિય</span>
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
              onClick={() => navigate('/coop/reports')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-white mr-1" />
              <span>રિપોર્ટ્સ અને નિકાસ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. COOPERATIVE GOVERNANCE BANNER (Exact Reference Image Design)        */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                {coopInfo.name_gu || 'ડેરી સહકારી મંડળી'} સત્તાવાર સહકારી કાર્યક્ષેત્ર
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                ડેરી સહકારી કાર્યક્ષેત્ર
              </span>
              {coopInfo.is_demo && (
                <span className="px-2 py-0.2 bg-amber-400 text-slate-900 text-[10px] rounded font-extrabold uppercase">
                  DEMO
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              {coopInfo.name_gu} ({coopInfo.name_en || 'Dairy Cooperative'}) • કોડ: {coopInfo.code || 'COOP'} • {kpis.linked_villages} કાર્યક્ષેત્ર ગામડાં • નોંધાયેલ સભાસદો: {kpis.total_member_farmers} • સંલગ્ન પશુધન: {kpis.total_animals}. લાઈવ રસીકરણ અને દેખરેખ સક્રિય.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/maps')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>કાર્યક્ષેત્ર GIS વિશ્લેષણ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW (Exact DAHO Dashboard Reference Image)      */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ નોંધાયેલ પશુધન"
          value={isLoading ? '...' : String(kpis.total_animals)}
          subtext={`${kpis.linked_villages} ગામ • ${kpis.total_member_farmers} સભાસદો`}
          icon={<PawPrint className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          onClick={() => navigate('/coop/animals')}
        />

        <KpiCard
          label="રસીકરણ કવરેજ દર"
          value={isLoading ? '...' : `${kpis.overall_coverage_pct}%`}
          valueColor="text-[#176B5B]"
          subtext={`${kpis.fully_vaccinated_animals} સંપૂર્ણ • લક્ષ્ય ${kpis.total_animals}`}
          icon={<Syringe className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          onClick={() => navigate('/coop/vaccinations')}
        />

        <KpiCard
          label="બાકી / મુદત વીતી ગયેલ"
          value={isLoading ? '...' : String(kpis.pending_vaccinations)}
          valueColor="text-[#DC2626]"
          subtext="કતાર જુઓ →"
          badgeText={`${kpis.overdue_vaccinations} મુદતવીતી`}
          badgeVariant={kpis.overdue_vaccinations > 0 ? 'red' : 'slate'}
          icon={<Clock className="w-4 h-4 text-red-600" />}
          iconVariant="red"
          onClick={() => navigate('/coop/vaccinations')}
        />

        <KpiCard
          label="રોગ સર્વેક્ષણ કેસ"
          value={isLoading ? '...' : String(kpis.suspected_disease_cases)}
          subtext={`${kpis.suspected_disease_cases} સક્રિય કેસ`}
          badgeText={kpis.suspected_disease_cases > 0 ? 'એલર્ટ' : undefined}
          badgeVariant={kpis.suspected_disease_cases > 0 ? 'red' : undefined}
          icon={<Activity className="w-4 h-4 text-sky-600" />}
          iconVariant="blue"
          onClick={() => navigate('/coop/surveillance')}
        />

        <KpiCard
          label="સભ્ય પશુપાલકો"
          value={isLoading ? '...' : String(kpis.total_member_farmers)}
          subtext={`${kpis.linked_villages} કાર્યક્ષેત્ર ગામો`}
          subtextIcon={<span className="w-1.5 h-1.5 rounded-full bg-[#176B5B] shrink-0" />}
          icon={<Users className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="teal"
          onClick={() => navigate('/coop/farmers')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. SECOND ROW OF 5 IN-DEPTH OPERATIONAL KPIS                            */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="સંપૂર્ણ રસીકરણ થયેલ"
          value={isLoading ? '...' : String(kpis.fully_vaccinated_animals)}
          valueColor="text-emerald-700"
          subtext="બંને ડોઝ સુરક્ષિત"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          iconVariant="emerald"
          onClick={() => navigate('/coop/vaccinations')}
        />

        <KpiCard
          label="આંશિક રસીકરણ થયેલ"
          value={isLoading ? '...' : String(kpis.partially_vaccinated_animals)}
          valueColor="text-amber-700"
          subtext="૧ ડોઝ પૂર્ણ"
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
          onClick={() => navigate('/coop/vaccinations')}
        />

        <KpiCard
          label="સક્રિય રસીકરણ ઝુંબેશો"
          value={isLoading ? '...' : String(kpis.active_campaigns)}
          subtext="કાર્યક્ષેત્રમાં અમલમાં"
          icon={<Megaphone className="w-4 h-4 text-sky-600" />}
          iconVariant="blue"
          onClick={() => navigate('/coop/campaigns')}
        />

        <KpiCard
          label="કાર્યક્ષેત્ર ગામો"
          value={isLoading ? '...' : String(kpis.linked_villages)}
          subtext="GIS નકશામાં જુઓ →"
          icon={<MapPin className="w-4 h-4 text-[#135D43]" />}
          iconVariant="teal"
          onClick={() => navigate('/coop/maps')}
        />

        <KpiCard
          label="પશુ આરોગ્ય કેમ્પ"
          value={isLoading ? '...' : `${kpis.total_camps ?? 0} કેમ્પ`}
          subtext="કેમ્પ યાદી જુઓ →"
          icon={<Tent className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
          onClick={() => navigate('/coop/camps')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 5. ANALYTICS CHARTS SECTION WITH UNIFORM SECTION HEADER                 */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 flex items-center justify-center text-[#176B5B] shrink-0 shadow-2xs">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                  રસીકરણ અને પશુધન પૃથ્થકરણ (Operational Analytics)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#135D43]">
                  ૮ વિશ્લેષણ ચાર્ટ્સ
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                સભાસદ પશુધનની માસિક પ્રગતિ, પ્રજાતિ વિતરણ અને ગામવાર કામગીરીનું વિશ્લેષણ
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Chart 1: Monthly Vaccination Trend */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 md:col-span-2 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-800 text-xs">માસિક રસીકરણ વલણ (Monthly Trend)</h4>
              <span className="text-[10px] text-slate-400">છેલ્લા ૬ મહિના</span>
            </div>
            <div className="h-44 flex items-end gap-3 pt-6 pb-2 px-2">
              {charts.monthly_trend.map((m, idx) => {
                const maxVal = Math.max(...charts.monthly_trend.map((x) => x.doses), 10);
                const barHeight = m.doses > 0 ? Math.max(12, Math.round((m.doses / maxVal) * 120)) : 4;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className={`text-[10px] font-bold ${m.doses > 0 ? 'text-slate-700' : 'text-slate-400'}`}>{m.doses}</span>
                    <div
                      className={`w-full rounded-t transition-all ${m.doses > 0 ? 'bg-[#135D43] hover:bg-[#1c7a59]' : 'bg-slate-200'}`}
                      style={{ height: `${barHeight}px` }}
                    />
                    <span className="text-[10px] text-slate-500 font-medium">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: Species Distribution */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="font-bold text-slate-800 text-xs mb-3">પશુ જાતિ વિતરણ (Species)</h4>
            <div className="space-y-2.5">
              {charts.species_distribution.map((sp, idx) => {
                const total = kpis.total_animals || 1;
                const pct = Math.round((sp.count / total) * 100);
                return (
                  <div key={idx} className="text-xs">
                    <div className="flex justify-between text-slate-700 mb-1">
                      <span>{sp.species}</span>
                      <span className="font-bold">{sp.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: sp.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 3: Vaccination Status Distribution */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="font-bold text-slate-800 text-xs mb-3">રસીકરણ સ્થિતિ પ્રમાણ</h4>
            <div className="space-y-2.5">
              {charts.status_distribution.map((st, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                    <span className="text-slate-700 truncate max-w-[130px]">{st.name}</span>
                  </div>
                  <strong className="text-slate-900">{st.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 4: Village-wise Member Farmers */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-800 text-xs">ગામ મુજબ સભાસદો</h4>
              <button onClick={() => navigate('/coop/maps')} className="text-[10px] text-[#135D43] font-semibold hover:underline">
                નકશો →
              </button>
            </div>
            {charts.village_farmers.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">કોઈ કાર્યક્ષેત્ર ગામ લિંક થયેલ નથી</p>
            ) : (
              <div className="space-y-2">
                {charts.village_farmers.slice(0, 5).map((vf, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate('/coop/maps')}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 hover:bg-slate-50 cursor-pointer rounded px-1"
                  >
                    <span className="text-slate-600">{vf.village}</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{vf.farmers} ખેડૂત</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 5: Village Livestock */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-800 text-xs">ગામ મુજબ સંલગ્ન પશુધન</h4>
              <button onClick={() => navigate('/coop/maps')} className="text-[10px] text-[#135D43] font-semibold hover:underline">
                નકશો →
              </button>
            </div>
            {charts.village_livestock.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">કોઈ પશુધન નોંધાયેલ નથી</p>
            ) : (
              <div className="space-y-2">
                {charts.village_livestock.slice(0, 5).map((vl, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate('/coop/maps')}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 hover:bg-slate-50 cursor-pointer rounded px-1"
                  >
                    <span className="text-slate-600">{vl.village}</span>
                    <span className="font-bold text-[#135D43] bg-emerald-50 px-2 py-0.5 rounded">{vl.animals} પશુ</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 6: Village Coverage % */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-800 text-xs">ગામ કવરેજ સિદ્ધિ</h4>
              <button onClick={() => navigate('/coop/village-progress')} className="text-[10px] text-[#135D43] font-semibold hover:underline">
                પ્રગતિ →
              </button>
            </div>
            {charts.village_coverage.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">કોઈ રસીકરણ કવરેજ ડેટા નથી</p>
            ) : (
              <div className="space-y-2">
                {charts.village_coverage.slice(0, 5).map((vc, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate('/coop/village-progress')}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 hover:bg-slate-50 cursor-pointer rounded px-1"
                  >
                    <span className="text-slate-600">{vc.village}</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{vc.coverage_pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 7: Campaign Achievement */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="font-bold text-slate-800 text-xs mb-3">ઝુંબેશ લક્ષ્યાંક સિદ્ધિ</h4>
            {charts.campaign_progress.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">કોઈ સક્રિય ઝુંબેશ લક્ષ્યાંક નથી</p>
            ) : (
              <div className="space-y-2">
                {charts.campaign_progress.slice(0, 3).map((cp, idx) => {
                  const pct = Math.round((cp.achieved / (cp.target || 1)) * 100);
                  return (
                    <div key={idx} className="text-xs">
                      <div className="flex justify-between text-slate-700 mb-1">
                        <span className="truncate max-w-[120px]">{cp.campaign}</span>
                        <span className="font-bold">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
