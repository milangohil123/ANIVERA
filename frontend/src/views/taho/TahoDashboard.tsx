import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { GujaratStateMap } from '../../components/maps/GujaratStateMap';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
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
  BarChart3,
  Calendar,
} from 'lucide-react';

export const TahoDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, profile, session } = useAuth();
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
        adminService.getTahoOverview(apiBaseUrl),
        adminService.getTahoHierarchy(apiBaseUrl).catch(() => null),
      ]);
      setOverview(ov);
      setHierarchy(hier);

      if (ov?.taluka_id) {
        const vGeo = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, ov.taluka_id).catch(() => null);
        setVillagesGeoJson(vGeo);
      }
    } catch (err: any) {
      console.warn('Failed to load TAHO operational data:', err);
      setError(err?.message || 'તાલુકા ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

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

  if (isLoading) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-9 h-9 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">તાલુકા વહીવટી ડેટા અને ગામ સીમાઓ લોડ થઈ રહી છે...</p>
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
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4.5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
            <h1 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
              {talukaNameGu} તાલુકા વહીવટી ડેશબોર્ડ (TAHO)
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {overview.taluka_code}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            જિલ્લો: <strong>{districtNameGu} ({overview.district_name_en})</strong> • તાલુકા પશુપાલન અધિકારી:{' '}
            <span className="font-semibold text-slate-700">{profile?.full_name || session?.user?.fullName}</span>
          </p>
        </div>

        {/* Demo Dataset Controls & Refresh */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDemo}
            isLoading={isSeedingDemo}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
            title="ડેમો ટેસ્ટિંગ માટે ૨ રેકોર્ડ્સ લોડ કરો"
          >
            ડેમો ડેટા લોડ કરો
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDemo}
            isLoading={isResettingDemo}
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
            className="text-red-600 hover:bg-red-50"
            title="ડેમો રેકોર્ડ્સ રીસેટ કરો"
          >
            ડેમો રીસેટ
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
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

      {/* 3. 11 Real Database Operational KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">કુલ ગામો</span>
            <Layers className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold font-heading text-slate-900 mt-1">
            {kpis.total_villages ?? overview.total_villages ?? 0}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">GIS સીમાઓ ઉપલબ્ધ</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">વેટરનરી ઓફિસર</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold font-heading text-slate-900 mt-1">
            {kpis.active_vos ?? overview.active_vos ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">સક્રિય VO સ્ટાફ</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">ફીલ્ડ વર્કર્સ</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-heading text-slate-900 mt-1">
            {kpis.active_fws ?? overview.active_fws ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">સક્રિય FW સ્ટાફ</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">નોંધાયેલ ખેડૂતો</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-heading text-slate-900 mt-1">
            {kpis.total_farmers ?? overview.total_farmers ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">પશુપાલક પરિવારો</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">પશુધન સંખ્યા</span>
            <PawPrint className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold font-heading text-slate-900 mt-1">
            {kpis.total_animals ?? overview.total_animals ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">ટેગ થયેલ પશુઓ</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">પૂર્ણ રસીકરણ</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-heading text-emerald-700 mt-1">
            {kpis.completed_vaccinations ?? overview.total_vaccinations ?? 0}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">સફળતાપૂર્વક અપાયેલ</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">બાકી રસીકરણ</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-heading text-amber-600 mt-1">
            {kpis.pending_vaccinations ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">પ્રક્રિયામાં</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">મુદતવીતી (Overdue)</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-bold font-heading text-red-600 mt-1">
            {kpis.overdue_vaccinations ?? 0}
          </div>
          <span className="text-[10px] text-red-500 font-medium">સમયમર્યાદા બહાર</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">સક્રિય ઝુંબેશો</span>
            <Megaphone className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold font-heading text-slate-900 mt-1">
            {kpis.active_campaigns ?? 0}
          </div>
          <span className="text-[10px] text-sky-700">તાલુકા અભિયાન</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">રોગ રિપોર્ટ્સ</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold font-heading text-slate-900 mt-1">
            {kpis.disease_reports ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">સર્વેલન્સ કેસો</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">રોગ ચેતવણીઓ</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-xl font-bold font-heading text-red-600 mt-1">
            {kpis.active_alerts ?? 0}
          </div>
          <span className="text-[10px] text-red-600 font-medium">ક્લસ્ટર / સર્જ એલર્ટ</span>
        </Card>

        <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">સરેરાશ કવરેજ</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold font-heading text-emerald-700 mt-1">
            {kpis.overall_coverage_pct ?? 0}%
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">તાલુકા પ્રગતિ</span>
        </Card>
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

      {/* 6. Operational Visualizations & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Village Coverage Breakdown */}
        <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-700" />
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
                const barColor = pct >= 70 ? 'bg-emerald-600' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
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
        </Card>

        {/* Species & Vaccine Distribution */}
        <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <PawPrint className="w-4 h-4 text-emerald-700" />
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
        </Card>
      </div>
    </div>
  );
};
