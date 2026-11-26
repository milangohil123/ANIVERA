import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { GujaratStateMap } from '../../components/maps/GujaratStateMap';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { KpiCard } from '../../components/common/KpiCard';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  MapPin,
  Users,
  PawPrint,
  Syringe,
  Layers,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Megaphone,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  Trash2,
  ShieldAlert,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  Calendar,
} from 'lucide-react';

export const TahoDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, profile, session, selectedTalukaId, assignedTalukas } = useAuth();
  const [overview, setOverview] = useState<any | null>(null);
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [villagesGeoJson, setVillagesGeoJson] = useState<any | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ov, hier] = await Promise.all([
        adminService.getTahoOverview(apiBaseUrl, selectedTalukaId || undefined),
        adminService.getTahoHierarchy(apiBaseUrl, selectedTalukaId || undefined).catch(() => null),
      ]);
      setOverview(ov);
      setHierarchy(hier);
      setIsLoading(false);

      if (ov?.taluka_id) {
        adminService
          .getTalukaVillagesGeoJson(apiBaseUrl, ov.taluka_id)
          .then((vGeo) => {
            if (vGeo) setVillagesGeoJson(vGeo);
          })
          .catch(() => null);
      }
    } catch (err: any) {
      console.warn('Failed to load TAHO operational data:', err);
      setError(err?.message || 'તાલુકા ડેટા લોડ કરવામાં નિષ્ફળ.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (assignedTalukas.length > 1 && !selectedTalukaId) {
      navigate('/taho/select-taluka');
      return;
    }
    loadData();
  }, [apiBaseUrl, selectedTalukaId, assignedTalukas.length]);

  const handleSeedDemo = async () => {
    if (!window.confirm('શું તમે તાલુકા માટે ૨ ડેમો રેકોર્ડ્સ (VO, FW, ઝુંબેશ, ખેડૂત, પશુઓ અને રસીકરણ) લોડ કરવા માંગો છો? આ રેકોર્ડ્સ [DEMO] તરીકે ચિહ્નિત થશે.')) return;
    setIsSeedingDemo(true);
    setActionMessage(null);
    try {
      const res = await adminService.seedTahoDemoData(apiBaseUrl);
      setActionMessage({ text: res.message || 'ડેમો ડેટા સફળતાપૂર્વક લોડ થયો.', type: 'success' });
      await loadData();
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'ડેમો ડેટા લોડ કરવામાં નિષ્ફળ.', type: 'error' });
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('શું તમે તમામ ડેમો રેકોર્ડ્સ [DEMO] દૂર કરવા માંગો છો?')) return;
    setIsResettingDemo(true);
    setActionMessage(null);
    try {
      const res = await adminService.resetTahoDemoData(apiBaseUrl);
      setActionMessage({ text: res.message || 'ડેમો ડેટા સફળતાપૂર્વક દૂર કરાયો.', type: 'success' });
      await loadData();
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'ડેમો ડેટા રીસેટ કરવામાં નિષ્ફળ.', type: 'error' });
    } finally {
      setIsResettingDemo(false);
    }
  };

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

  if (isLoading && !overview) {
    return (
      <div className="space-y-5 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-64 bg-slate-200 rounded" />
          <div className="h-8 w-96 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-16 w-full bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-72 bg-slate-200 rounded-xl" />
          <div className="h-72 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !overview?.has_assignment) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <Card className="p-8 bg-amber-50/60 border border-amber-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 font-heading">તાલુકા સોંપણી બાકી છે</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {overview?.message || error || 'તમારા ખાતામાં હાલમાં કોઈ સક્રિય તાલુકો સોંપાયેલ નથી. કૃપા કરીને તમારા જિલ્લા પશુપાલન અધિકારી (DAHO) નો સંપર્ક કરો.'}
          </p>
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            ફરી તપાસો
          </Button>
        </Card>
      </div>
    );
  }

  const kpis = overview.kpis || {};
  const charts = overview.charts || {};
  const insights = overview.actionable_insights || [];
  const villageCoverage = charts.village_coverage || [];
  const speciesDist = charts.species_distribution || [];
  const vaccineDist = charts.vaccine_breakdown || [];
  const dailyTrends = charts.daily_trends || [];
  const diseaseBreakdown = charts.disease_breakdown || [];
  const staffPerf = charts.staff_performance || { vos: [], fws: [] };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER (Exact Enterprise Reference Design)   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>કામગીરી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>તાલુકા પશુપાલન અધિકારી (TAHO)</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">
            {talukaNameGu} તાલુકો ({districtNameGu} જિલ્લો) • {overview.total_villages} કાર્યક્ષેત્ર ગામો
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              {talukaNameGu} તાલુકા વહીવટી ડેશબોર્ડ (TAHO)
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>તાલુકા વહીવટ સક્રિય</span>
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-[#135D43] border border-emerald-200 font-bold">
              {overview.taluka_code}
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
              onClick={() => navigate('/taho/maps')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#E8EEFC] text-xs font-semibold text-[#135D43] hover:bg-[#D8E4FA] shadow-xs transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
              <span>GIS ભૌગોલિક નકશો</span>
            </button>

            <button
              onClick={() => navigate('/taho/campaigns')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <Megaphone className="w-3.5 h-3.5 text-white mr-1" />
              <span>+ નવી ઝુંબેશ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. TALUKA GOVERNANCE BANNER (Exact Reference Image Design)              */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                {talukaNameGu} તાલુકા સત્તાવાર વહીવટી કાર્યક્ષેત્ર
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                તાલુકા કક્ષાએ મંજૂર
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              જિલ્લો: {districtNameGu} ({overview.district_name_en}) • તાલુકા પશુપાલન અધિકારી: {profile?.full_name || session?.user?.fullName} • {overview.total_villages} કાર્યક્ષેત્ર ગામો • સક્રિય VO: {kpis.active_vos ?? 0} • સક્રિય FW: {kpis.active_fws ?? 0} • પશુધન રક્ષણ અને રોગ નિયંત્રણ કાર્યક્રમ હેઠળ સક્રિય.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/taho/maps')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>કાર્યક્ષેત્ર GIS વિશ્લેષણ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs font-bold underline ml-2">
            બંધ કરો
          </button>
        </div>
      )}

      {/* 2. Actionable Insights Alerts Banner */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            તાત્કાલિક ધ્યાન આપવા યોગ્ય બાબતો (Actionable Insights)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {insights.map((ins: any, idx: number) => {
              const isCrit = ins.severity === 'CRITICAL';
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-all ${
                    isCrit ? 'bg-red-50/70 border-red-200 text-red-900' : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-xs">{ins.title}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        isCrit ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {ins.severity}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 text-slate-700 line-clamp-2">{ins.description}</p>
                  {ins.action_url && (
                    <button
                      onClick={() => navigate(ins.action_url)}
                      className="mt-2 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 inline-flex items-center gap-1"
                    >
                      વિગતો જુઓ <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 3. ROW 1: 5 ADMINISTRATIVE BASELINE KPIS (Exact Reference Design)       */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          isLoading={isLoading}
          label="કુલ ગામો"
          value={kpis.total_villages ?? overview.total_villages ?? 0}
          subtext="GIS સીમાઓ ઉપલબ્ધ"
          icon={<Layers className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          onClick={() => navigate('/taho/maps')}
        />

        <KpiCard
          isLoading={isLoading}
          label="વેટરનરી ઓફિસર"
          value={kpis.active_vos ?? overview.active_vos ?? 0}
          subtext="સક્રિય VO સ્ટાફ"
          icon={<Users className="w-4 h-4 text-sky-600" />}
          iconVariant="blue"
          onClick={() => navigate('/taho/staff')}
        />

        <KpiCard
          isLoading={isLoading}
          label="ફીલ્ડ વર્કર્સ"
          value={kpis.active_fws ?? overview.active_fws ?? 0}
          subtext="સક્રિય FW સ્ટાફ"
          icon={<Users className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="teal"
          onClick={() => navigate('/taho/staff')}
        />

        <KpiCard
          isLoading={isLoading}
          label="નોંધાયેલ ખેડૂતો"
          value={kpis.total_farmers ?? overview.total_farmers ?? 0}
          subtext="પશુપાલક પરિવારો"
          icon={<Users className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
          onClick={() => navigate('/taho/farmers')}
        />

        <KpiCard
          isLoading={isLoading}
          label="પશુધન સંખ્યા"
          value={kpis.total_animals ?? overview.total_animals ?? 0}
          subtext="ટેગ થયેલ પશુઓ"
          icon={<PawPrint className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          onClick={() => navigate('/taho/animals')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. ROW 2: 5 OPERATIONAL VACCINATION & HEALTH KPIS                       */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          isLoading={isLoading}
          label="સંપૂર્ણ રસીકરણ થયેલ"
          value={kpis.completed_vaccinations ?? overview.total_vaccinations ?? 0}
          valueColor="text-emerald-700"
          subtext="સફળતાપૂર્વક અપાયેલ"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          iconVariant="emerald"
          onClick={() => navigate('/taho/vaccinations')}
        />

        <KpiCard
          isLoading={isLoading}
          label="બાકી / મુદત વીતી ગયેલ"
          value={kpis.pending_vaccinations ?? 0}
          valueColor={(kpis.overdue_vaccinations ?? 0) > 0 ? 'text-[#DC2626]' : 'text-amber-700'}
          subtext="કતાર જુઓ →"
          badgeText={`${kpis.overdue_vaccinations ?? 0} મુદતવીતી`}
          badgeVariant={(kpis.overdue_vaccinations ?? 0) > 0 ? 'red' : 'slate'}
          icon={<Clock className="w-4 h-4 text-red-600" />}
          iconVariant="red"
          onClick={() => navigate('/taho/vaccinations')}
        />

        <KpiCard
          isLoading={isLoading}
          label="સક્રિય રસીકરણ ઝુંબેશો"
          value={kpis.active_campaigns ?? 0}
          subtext="તાલુકા અભિયાન"
          icon={<Megaphone className="w-4 h-4 text-sky-600" />}
          iconVariant="blue"
          onClick={() => navigate('/taho/campaigns')}
        />

        <KpiCard
          isLoading={isLoading}
          label="રોગ સર્વેક્ષણ કેસ"
          value={kpis.disease_reports ?? 0}
          subtext={`${kpis.disease_reports ?? 0} સક્રિય કેસ`}
          badgeText={(kpis.active_alerts ?? 0) > 0 ? `${kpis.active_alerts} એલર્ટ` : undefined}
          badgeVariant={(kpis.active_alerts ?? 0) > 0 ? 'red' : undefined}
          icon={<Activity className="w-4 h-4 text-purple-600" />}
          iconVariant="blue"
          onClick={() => navigate('/taho/surveillance')}
        />

        <KpiCard
          isLoading={isLoading}
          label="સરેરાશ કવરેજ દર"
          value={`${kpis.overall_coverage_pct ?? 0}%`}
          valueColor="text-[#176B5B]"
          subtext="તાલુકા પ્રગતિ"
          icon={<TrendingUp className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="teal"
          onClick={() => navigate('/taho/campaigns')}
        />
      </div>

      {/* 4. Quick Module Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/taho/maps')}
          className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-xs transition-all text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition-colors">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">ગ્રામીણ GIS નકશો</div>
              <div className="text-[10px] text-slate-500">ગામ સીમાઓ & વિશ્લેષણ</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700" />
        </button>

        <button
          onClick={() => navigate('/taho/staff')}
          className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-xs transition-all text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center group-hover:bg-sky-700 group-hover:text-white transition-colors">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">સ્ટાફ વહીવટ (VO/FW)</div>
              <div className="text-[10px] text-slate-500">ગામ સોંપણી & ખાતા નિયંત્રણ</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-700" />
        </button>

        <button
          onClick={() => navigate('/taho/campaigns')}
          className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-xs transition-all text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-700 group-hover:text-white transition-colors">
              <Megaphone className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">રસીકરણ ઝુંબેશો</div>
              <div className="text-[10px] text-slate-500">લક્ષ્યાંક & પ્રગતિ ટ્રેકિંગ</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700" />
        </button>

        <button
          onClick={() => navigate('/taho/surveillance')}
          className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-xs transition-all text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center group-hover:bg-red-700 group-hover:text-white transition-colors">
              <Activity className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">રોગ સર્વેલન્સ</div>
              <div className="text-[10px] text-slate-500">ક્લસ્ટર ચેતવણીઓ & તપાસ</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-red-700" />
        </button>
      </div>

      {/* 5. Village GIS Map & Interactive Sidebar (Requirement 3 & 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map View Column (2/3 width) */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden border border-slate-200 shadow-xs bg-white">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-800">
                  {talukaNameGu} તાલુકા ગ્રામીણ સીમા નકશો (Village GIS Map)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/taho/maps')}
                className="text-xs font-bold text-emerald-800 hover:bg-emerald-50 h-7"
              >
                મોટો નકશો જુઓ <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            <GujaratStateMap
              viewLevel="VILLAGE"
              selectedTalukaId={overview.taluka_id}
              selectedTalukaProps={selectedTalukaProps}
              selectedVillageId={selectedVillage?.village_id}
              selectedVillageProps={selectedVillage}
              onVillageSelect={(vp) => setSelectedVillage(vp)}
              villagesGeoJson={villagesGeoJson}
              height="500px"
            />
          </Card>
        </div>

        {/* Selected Village Info & Quick Directory (1/3 width) */}
        <div className="lg:col-span-1 space-y-3">
          <Card className="p-4 bg-white border border-slate-200 shadow-xs text-xs space-y-3">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                પસંદ કરેલ ગામની વિગતો
              </span>
              {selectedVillage && (
                <StatusChip status="ACTIVE" label={selectedVillage.coord_status || 'VERIFIED'} />
              )}
            </div>

            {selectedVillage ? (
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    {selectedVillage.name_gu || transliterateToGujarati(selectedVillage.name_en)}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedVillage.name_en} • કોડ: {selectedVillage.code}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">સેન્સસ કોડ:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedVillage.census_code || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">સીમા પોલિગોન:</span>
                    <span className="font-bold text-emerald-700">સત્તાવાર GIS (Polygon)</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => navigate(`/taho/maps?village_id=${selectedVillage.village_id}`)}
                  >
                    ગામની સંપૂર્ણ એનાલિટિક્સ જુઓ
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 space-y-2">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs">નકશામાંથી કોઈપણ ગામ પર ક્લિક કરો જેથી તેની વિગતો અહીં જોઈ શકાય.</p>
              </div>
            )}
          </Card>

          {/* Villages Directory List */}
          <Card className="p-3 bg-white border border-slate-200 shadow-xs text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-800">
                તાલુકાના ગામો ({hierarchy?.villages?.length || villagesGeoJson?.features?.length || 0})
              </span>
              <span className="text-[10px] text-slate-400">ક્લિક કરીને પસંદ કરો</span>
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pr-1">
              {(hierarchy?.villages || []).map((v: any) => {
                const isSel = selectedVillage?.village_id === v.village_id;
                return (
                  <div
                    key={v.village_id}
                    onClick={() => setSelectedVillage(v)}
                    className={`p-2 rounded-md cursor-pointer transition-colors flex items-center justify-between ${
                      isSel ? 'bg-emerald-50 border border-emerald-300' : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        {v.name_gu || transliterateToGujarati(v.name_en)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{v.name_en}</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 6. ANALYTICS CHARTS SECTION WITH UNIFORM SECTION HEADER                */}
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
                  તાલુકા રસીકરણ અને પશુધન પૃથ્થકરણ (Operational Analytics)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#135D43]">
                  વિશ્લેષણ ચાર્ટ્સ
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                તાલુકા હેઠળના ગામોની માસિક પ્રગતિ, પ્રજાતિ વિતરણ અને કામગીરીનું વિશ્લેષણ
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Village Coverage Breakdown */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#135D43]" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  ગામ મુજબ રસીકરણ કવરેજ (Village Coverage)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">ટોચના ગામો</span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {villageCoverage.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">હજુ સુધી કોઈ રસીકરણ નોંધાયેલ નથી.</p>
              ) : (
                villageCoverage.slice(0, 8).map((vc: any, idx: number) => {
                  const pct = vc.coverage_pct || 0;
                  const barColor = pct >= 70 ? 'bg-[#135D43]' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">
                          {vc.village_name_gu || transliterateToGujarati(vc.village_name_en)}
                        </span>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {vc.vaccinated_count} / {vc.target_animals} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Species & Vaccine Distribution */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-[#135D43]" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  પ્રાણી પ્રજાતિ & રસી વિતરણ (Species & Vaccines)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">તાલુકા આંકડા</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Species */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase">પશુધન પ્રજાતિ</div>
                {speciesDist.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">ડેટા ઉપલબ્ધ નથી</p>
                ) : (
                  speciesDist.map((sp: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50 border border-slate-100">
                      <span className="font-medium text-slate-700">{sp.species_name_gu || sp.species_code}</span>
                      <span className="font-mono font-bold text-slate-900">{sp.count}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Vaccines */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase">રસી મુજબ પૂર્ણ ડોઝ</div>
                {vaccineDist.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">ડેટા ઉપલબ્ધ નથી</p>
                ) : (
                  vaccineDist.map((vx: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-emerald-50/50 border border-emerald-100">
                      <span className="font-medium text-emerald-900">{vx.vaccine_name_gu || vx.disease_code}</span>
                      <span className="font-mono font-bold text-emerald-700">{vx.doses_administered}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
