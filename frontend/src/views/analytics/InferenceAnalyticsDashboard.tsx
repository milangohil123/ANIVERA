import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import {
  LinearAreaChart,
  LinearBarChart,
  LinearRadialGauge,
  type LinearBarItem,
  type DataPoint,
} from '../../components/charts/LinearCharts';
import {
  analyticsService,
  type AnalyticsMetadata,
  type VaccinationAnalyticsResponse,
  type DiseaseAnalyticsResponse,
} from '../../services/analyticsService';
import {
  Syringe,
  Activity,
  Calendar,
  Filter,
  RotateCcw,
  Layers,
  MapPin,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  PawPrint,
  Clock,
  ArrowUpRight,
  PieChart,
  BarChart2,
  Building,
  Info,
} from 'lucide-react';

type AnalyticsTab = 'VACCINATION' | 'DISEASE';

export const InferenceAnalyticsDashboard: React.FC = () => {
  const { apiBaseUrl, session, role, selectedDistrict, assignedDistricts } = useAuth();
  const { t } = useTranslation();
  const token = session?.accessToken || '';

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('VACCINATION');
  const [metadata, setMetadata] = useState<AnalyticsMetadata | null>(null);

  // Filter States
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');
  const [selectedTalukaId, setSelectedTalukaId] = useState<string>('ALL');
  const [selectedProgramme, setSelectedProgramme] = useState<string>('ALL');
  const [selectedDisease, setSelectedDisease] = useState<string>('ALL');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Data Loading States
  const [vaccinationData, setVaccinationData] = useState<VaccinationAnalyticsResponse | null>(null);
  const [diseaseData, setDiseaseData] = useState<DiseaseAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Metadata Options once
  useEffect(() => {
    if (!token) return;
    analyticsService
      .getMetadata(apiBaseUrl, token)
      .then((meta) => {
        setMetadata(meta);
        // If DAHO with single district, pre-select it
        if (role === 'DAHO' && meta.districts.length === 1) {
          setSelectedDistrictId(meta.districts[0].id);
        }
      })
      .catch((err) => {
        console.warn('Metadata load notice:', err);
      });
  }, [apiBaseUrl, token, role]);

  // Filtered Talukas based on selected district
  const availableTalukas = useMemo(() => {
    if (!metadata?.talukas) return [];
    if (selectedDistrictId === 'ALL') return metadata.talukas;
    return metadata.talukas.filter((t) => t.district_id === selectedDistrictId);
  }, [metadata, selectedDistrictId]);

  // Load Main Analytics Telemetry
  const fetchAnalytics = useCallback(async (showFullLoader = false) => {
    if (!token) return;
    if (showFullLoader) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    const commonParams = {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      district_ids: selectedDistrictId !== 'ALL' ? [selectedDistrictId] : undefined,
      taluka_ids: selectedTalukaId !== 'ALL' ? [selectedTalukaId] : undefined,
      species_codes: selectedSpecies !== 'ALL' ? [selectedSpecies] : undefined,
    };

    try {
      if (activeTab === 'VACCINATION') {
        const vaxRes = await analyticsService.getVaccinationAnalytics(apiBaseUrl, token, {
          ...commonParams,
          programme_code: selectedProgramme !== 'ALL' ? selectedProgramme : undefined,
          disease_code: selectedDisease !== 'ALL' ? selectedDisease : undefined,
        });
        setVaccinationData(vaxRes);
      } else {
        const disRes = await analyticsService.getDiseaseAnalytics(apiBaseUrl, token, {
          ...commonParams,
          disease_code: selectedDisease !== 'ALL' ? selectedDisease : undefined,
        });
        setDiseaseData(disRes);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'ઇન્ફરન્સ ડેટા લોડ કરવામાં અસમર્થ.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, apiBaseUrl, token, startDate, endDate, selectedDistrictId, selectedTalukaId, selectedProgramme, selectedDisease, selectedSpecies]);

  useEffect(() => {
    fetchAnalytics(true);
  }, [activeTab, fetchAnalytics]);

  // Quick Date Preset Handlers
  const handleDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleResetFilters = () => {
    setSelectedDistrictId(role === 'DAHO' && metadata?.districts[0] ? metadata.districts[0].id : 'ALL');
    setSelectedTalukaId('ALL');
    setSelectedProgramme('ALL');
    setSelectedDisease('ALL');
    setSelectedSpecies('ALL');
    const d = new Date();
    d.setDate(d.getDate() - 90);
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  // Convert time trend to DataPoint format for LinearAreaChart
  const vaccinationTrendPoints: DataPoint[] = useMemo(() => {
    if (!vaccinationData?.graphs?.time_trend) return [];
    return vaccinationData.graphs.time_trend.map((pt) => ({
      label: pt.label,
      value: pt.value,
    }));
  }, [vaccinationData]);

  const diseaseTrendPoints: DataPoint[] = useMemo(() => {
    if (!diseaseData?.graphs?.cases_trend) return [];
    return diseaseData.graphs.cases_trend.map((pt) => ({
      label: pt.label,
      value: pt.total_reports,
    }));
  }, [diseaseData]);

  // Convert District Comparisons to LinearBarItem
  const districtVaxBarItems: LinearBarItem[] = useMemo(() => {
    if (!vaccinationData?.graphs?.district_comparison) return [];
    return vaccinationData.graphs.district_comparison.slice(0, 8).map((d) => ({
      label: d.district_name_gu || d.district_name_en,
      sublabel: `${d.coverage_pct}% કવરેજ`,
      value: d.vaccinated_count,
      target: d.eligible_count > 0 ? d.eligible_count : d.vaccinated_count,
      color: '#135D43',
    }));
  }, [vaccinationData]);

  const programmeBarItems: LinearBarItem[] = useMemo(() => {
    if (!vaccinationData?.graphs?.programme_progress) return [];
    return vaccinationData.graphs.programme_progress.map((p) => ({
      label: p.programme_name,
      sublabel: `${p.coverage_pct}% સિદ્ધિ`,
      value: p.vaccinated_count,
      target: p.total_target,
      color: '#0284C7',
    }));
  }, [vaccinationData]);

  const speciesVaxBarItems: LinearBarItem[] = useMemo(() => {
    if (!vaccinationData?.graphs?.species_comparison) return [];
    return vaccinationData.graphs.species_comparison.map((s) => ({
      label: s.species_name_gu,
      sublabel: `${s.coverage_pct}% પૂર્ણ`,
      value: s.vaccinated_count,
      target: s.eligible_count > 0 ? s.eligible_count : s.vaccinated_count,
      color: '#7C3AED',
    }));
  }, [vaccinationData]);

  const diseaseReportBarItems: LinearBarItem[] = useMemo(() => {
    if (!diseaseData?.graphs?.disease_wise_reports) return [];
    const maxVal = Math.max(...diseaseData.graphs.disease_wise_reports.map((d) => d.total_cases), 1);
    return diseaseData.graphs.disease_wise_reports.map((d) => ({
      label: d.disease_name_gu,
      sublabel: `${d.percentage}% કુલ કેસ`,
      value: d.total_cases,
      target: maxVal,
      color: '#DC2626',
    }));
  }, [diseaseData]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-body select-none">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. TOP HEADER & INFERENCE TITLE                                         */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-200/60 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                પશુરક્ષક ઇન્ફરન્સ અને પૃથ્થકરણ ડેશબોર્ડ (Analytics & Inference)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                વાસ્તવિક ડેટાબેઝ આધારીત રસીકરણ કવરેજ, રોગ સર્વેક્ષણ અને જિલ્લા-તાલુકાવાર વિશ્લેષણ.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher & Refresh */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('VACCINATION')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'VACCINATION'
                  ? 'bg-white text-[#135D43] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Syringe className="w-3.5 h-3.5" />
              <span>રસીકરણ ઇન્ફરન્સ</span>
            </button>
            <button
              onClick={() => setActiveTab('DISEASE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'DISEASE'
                  ? 'bg-white text-rose-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>રોગ સર્વેક્ષણ ઇન્ફરન્સ</span>
            </button>
          </div>

          <button
            onClick={() => fetchAnalytics(false)}
            disabled={isRefreshing || isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="ડેટા તાજો કરો (Refresh)"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#135D43]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. TOP FILTER BAR (Strict Top-Down RBAC Geographic Scoping)             */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Filter className="w-3.5 h-3.5 text-[#135D43]" />
            <span>ફિલ્ટર નિયંત્રણો (Filter Controls)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
              ભૂમિકા: {role}
            </span>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">ઝડપી તારીખ:</span>
            <button
              onClick={() => handleDatePreset(30)}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            >
              ૩૦ દિવસ
            </button>
            <button
              onClick={() => handleDatePreset(90)}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            >
              ૯૦ દિવસ
            </button>
            <button
              onClick={() => handleDatePreset(180)}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            >
              ૬ મહિના
            </button>
            <button
              onClick={() => handleDatePreset(365)}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            >
              ૧ વર્ષ
            </button>
          </div>
        </div>

        {/* Filter Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* 1. District Selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#135D43]" />
              જિલ્લો (District):
            </label>
            <select
              value={selectedDistrictId}
              onChange={(e) => {
                setSelectedDistrictId(e.target.value);
                setSelectedTalukaId('ALL');
              }}
              disabled={role === 'DAHO' && metadata?.districts.length === 1}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
            >
              {metadata?.can_select_all_districts && (
                <option value="ALL">તમામ જિલ્લાઓ (All Gujarat)</option>
              )}
              {metadata?.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_gu} ({d.name_en})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Taluka Selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">તાલુકો (Taluka):</label>
            <select
              value={selectedTalukaId}
              onChange={(e) => setSelectedTalukaId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
            >
              <option value="ALL">તમામ તાલુકાઓ (All Talukas)</option>
              {availableTalukas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name_gu} ({t.name_en})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Programme / Disease Selection */}
          {activeTab === 'VACCINATION' ? (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">કાર્યક્રમ (Programme):</label>
              <select
                value={selectedProgramme}
                onChange={(e) => setSelectedProgramme(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
              >
                <option value="ALL">તમામ કાર્યક્રમો (All)</option>
                {metadata?.programmes.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name_gu} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">રોગ (Disease):</label>
              <select
                value={selectedDisease}
                onChange={(e) => setSelectedDisease(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
              >
                <option value="ALL">તમામ રોગો (All Diseases)</option>
                {metadata?.diseases.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name_gu} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Species Selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">પશુ કેટેગરી (Species):</label>
            <select
              value={selectedSpecies}
              onChange={(e) => setSelectedSpecies(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
            >
              <option value="ALL">તમામ પશુઓ (All Species)</option>
              {metadata?.species.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name_gu}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Start Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              શરૂઆત તારીખ:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
            />
          </div>

          {/* 6. End Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              અંતિમ તારીખ:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-500">
            તારીખ અવધિ:{' '}
            <strong className="font-mono text-slate-700">{startDate}</strong> થી{' '}
            <strong className="font-mono text-slate-700">{endDate}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold transition-colors"
            >
              રીસેટ (Reset)
            </button>
            <button
              onClick={() => fetchAnalytics(false)}
              className="px-4 py-1.5 rounded-lg bg-[#135D43] hover:bg-[#0F4C37] text-white font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Filter className="w-3 h-3" />
              <span>લાગુ કરો (Apply)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 3. VACCINATION ANALYTICS SECTION                                       */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'VACCINATION' && (
        <div className="space-y-5 animate-fade-in">
          {/* KPI Cards Row (Vaccination) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* KPI 1 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">કુલ પાત્ર પશુધન</span>
              <p className="text-xl font-bold font-heading text-slate-900 mt-1 font-mono">
                {isLoading ? '...' : vaccinationData?.kpis.total_eligible_animals.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">સક્રિય નોંધાયેલ પશુઓ</span>
            </div>

            {/* KPI 2 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 block">રસીકરણ પૂર્ણ પશુઓ</span>
              <p className="text-xl font-bold font-heading text-emerald-800 mt-1 font-mono">
                {isLoading ? '...' : vaccinationData?.kpis.vaccinated_animals.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-emerald-600 mt-0.5 block">વિશિષ્ટ પશુઓ (Deduplicated)</span>
            </div>

            {/* KPI 3 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-700 block">બાકી પાત્ર પશુઓ</span>
              <p className="text-xl font-bold font-heading text-amber-800 mt-1 font-mono">
                {isLoading ? '...' : vaccinationData?.kpis.pending_animals.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-amber-600 mt-0.5 block">કવરેજ લક્ષ્યાંક બાકી</span>
            </div>

            {/* KPI 4 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-700 block">કવરેજ સિદ્ધિ દર</span>
              <p className="text-xl font-bold font-heading text-blue-900 mt-1 font-mono">
                {isLoading ? '...' : `${vaccinationData?.kpis.coverage_percentage || 0}%`}
              </p>
              <span className="text-[10px] text-blue-600 mt-0.5 block">પાત્રતા આધારીત %</span>
            </div>

            {/* KPI 5 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-600 block">કુલ આપેલ ડોઝ</span>
              <p className="text-xl font-bold font-heading text-slate-800 mt-1 font-mono">
                {isLoading ? '...' : vaccinationData?.kpis.total_doses_administered.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {vaccinationData?.kpis.total_programmes || 0} કાર્યક્રમો હેઠળ
              </span>
            </div>
          </div>

          {/* Graphs Grid (Vaccination) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Graph 1: Coverage Gauge & Breakdown */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#135D43]" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    કુલ રસીકરણ કવરેજ ટકાવારી (%)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">લક્ષ્ય vs પૂર્ણ</span>
              </div>

              <div className="py-2 flex justify-center">
                <LinearRadialGauge
                  percentage={vaccinationData?.kpis.coverage_percentage || 0}
                  size={120}
                  strokeWidth={10}
                  color="#135D43"
                  label="સમગ્ર કવરેજ દર"
                  sublabel="પાત્ર પશુધન આધારે"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    રસીકરણ પૂર્ણ પશુઓ:
                  </span>
                  <strong className="font-mono text-slate-800">
                    {vaccinationData?.kpis.vaccinated_animals.toLocaleString('gu-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    બાકી પાત્ર પશુઓ:
                  </span>
                  <strong className="font-mono text-slate-800">
                    {vaccinationData?.kpis.pending_animals.toLocaleString('gu-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    કુલ પાત્ર પશુધન:
                  </span>
                  <strong className="font-mono text-slate-800">
                    {vaccinationData?.kpis.total_eligible_animals.toLocaleString('gu-IN')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Graph 2: Time-wise Vaccination Trend */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    સમયગાળાવાર રસીકરણ પ્રવાહ (Time Trend)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">દૈનિક રસી ડોઝ</span>
              </div>

              {vaccinationTrendPoints.length > 0 ? (
                <LinearAreaChart
                  data={vaccinationTrendPoints}
                  height={190}
                  color="#135D43"
                  unit="ડોઝ"
                />
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Info className="w-5 h-5 text-slate-300 mb-1" />
                  <span>પસંદ કરેલ તારીખગાળામાં કોઈ રસીકરણ પ્રવાહ ઉપલબ્ધ નથી.</span>
                </div>
              )}
            </div>

            {/* Graph 3: District-wise Vaccination Comparison */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    જિલ્લાવાર રસીકરણ સરખામણી (District Comparison)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">કવરેજ દર %</span>
              </div>

              {districtVaxBarItems.length > 0 ? (
                <LinearBarChart items={districtVaxBarItems} />
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  કોઈ જિલ્લા સરખામણી ડેટા મળ્યો નથી.
                </div>
              )}
            </div>

            {/* Graph 4: Species-wise Vaccination Graph */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    પશુ કેટેગરીવાર રસીકરણ કવરેજ (Species Breakdown)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">પ્રજાતિવાર વિશ્લેષણ</span>
              </div>

              {speciesVaxBarItems.length > 0 ? (
                <LinearBarChart items={speciesVaxBarItems} />
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  કોઈ પ્રજાતિવાર ડેટા મળ્યો નથી.
                </div>
              )}
            </div>

            {/* Graph 5: Programme-wise Vaccination Progress */}
            <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-700" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    કાર્યક્રમવાર રસીકરણ પ્રગતિ (Programme-wise Progress)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">પૂર્ણ vs બાકી</span>
              </div>

              {programmeBarItems.length > 0 ? (
                <LinearBarChart items={programmeBarItems} />
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  કોઈ કાર્યક્રમ પ્રગતિ ઉપલબ્ધ નથી.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. DISEASE SURVEILLANCE ANALYTICS SECTION                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'DISEASE' && (
        <div className="space-y-5 animate-fade-in">
          {/* KPI Cards Row (Disease) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* KPI 1 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">કુલ રોગ અહેવાલો</span>
              <p className="text-xl font-bold font-heading text-slate-900 mt-1 font-mono">
                {isLoading ? '...' : diseaseData?.kpis.total_disease_reports.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">સર્વેક્ષણ કેસ</span>
            </div>

            {/* KPI 2 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-700 block">પુષ્ટિ થયેલ કેસ</span>
              <p className="text-xl font-bold font-heading text-rose-800 mt-1 font-mono">
                {isLoading ? '...' : diseaseData?.kpis.confirmed_cases.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-rose-600 mt-0.5 block">લેબ/ક્લિનિકલ પુષ્ટિ</span>
            </div>

            {/* KPI 3 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-700 block">તપાસ હેઠળ અહેવાલો</span>
              <p className="text-xl font-bold font-heading text-amber-800 mt-1 font-mono">
                {isLoading ? '...' : diseaseData?.kpis.pending_disease_reports.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-amber-600 mt-0.5 block">પ્રત્યક્ષ મુલાકાત બાકી</span>
            </div>

            {/* KPI 4 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 block">નિરાકરણ થયેલ કેસ</span>
              <p className="text-xl font-bold font-heading text-emerald-800 mt-1 font-mono">
                {isLoading ? '...' : diseaseData?.kpis.completed_verified_cases.toLocaleString('gu-IN') || 0}
              </p>
              <span className="text-[10px] text-emerald-600 mt-0.5 block">ચકાસાયેલ સારવાર</span>
            </div>

            {/* KPI 5 */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-600 block">નોંધાયેલ રોગો</span>
              <p className="text-xl font-bold font-heading text-slate-800 mt-1 font-mono">
                {isLoading ? '...' : diseaseData?.kpis.distinct_diseases_count || 0}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">અલગ-અલગ રોગ પ્રકાર</span>
            </div>
          </div>

          {/* Graphs Grid (Disease) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Graph 1: Disease-wise Reports */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    રોગવાર અહેવાલ વિશ્લેષણ (Disease-wise Reports)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">કેસ ટકાવારી %</span>
              </div>

              {diseaseReportBarItems.length > 0 ? (
                <LinearBarChart items={diseaseReportBarItems} />
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  કોઈ રોગ અહેવાલ મળ્યો નથી.
                </div>
              )}
            </div>

            {/* Graph 2: Disease Cases Trend */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    રોગચાળો સમયગાળાવાર પ્રવાહ (Disease Trend)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">દૈનિક કેસ નોંધણી</span>
              </div>

              {diseaseTrendPoints.length > 0 ? (
                <LinearAreaChart
                  data={diseaseTrendPoints}
                  height={190}
                  color="#DC2626"
                  unit="કેસ"
                />
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Info className="w-5 h-5 text-slate-300 mb-1" />
                  <span>પસંદ કરેલ તારીખગાળામાં કોઈ રોગ પ્રવાહ ઉપલબ્ધ નથી.</span>
                </div>
              )}
            </div>

            {/* Graph 3: Workflow Status Breakdown */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    કાર્યવાહી સ્થિતિ વહેંચણી (Status)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">કેસ પ્રગતિ</span>
              </div>

              <div className="space-y-2.5">
                {diseaseData?.graphs?.status_breakdown?.map((st) => (
                  <div key={st.status} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">{st.label_gu}</span>
                      <span className="font-mono text-slate-600 text-[11px]">
                        <strong>{st.count}</strong> ({st.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-600"
                        style={{ width: `${st.percentage}%` }}
                      />
                    </div>
                  </div>
                )) || (
                  <p className="text-center text-slate-400 py-6 text-xs">કોઈ સ્થિતિ ડેટા નથી.</p>
                )}
              </div>
            </div>

            {/* Graph 4: Regional Hotspots / Alert Clusters */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">
                    રોગચાળો હોટસ્પોટ ક્લસ્ટર્સ (Regional Clusters)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">જોખમ વર્ગીકરણ</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                      <th className="py-2 px-3">તાલુકો / જિલ્લો</th>
                      <th className="py-2 px-3 text-center">કુલ નોંધાયેલ કેસ</th>
                      <th className="py-2 px-3 text-center">પુષ્ટિ થયેલ કેસ</th>
                      <th className="py-2 px-3 text-right">જોખમ સ્તર</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {diseaseData?.graphs?.regional_hotspots?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          કોઈ હોટસ્પોટ ક્લસ્ટર નોંધાયેલ નથી.
                        </td>
                      </tr>
                    ) : (
                      diseaseData?.graphs?.regional_hotspots?.map((h) => (
                        <tr key={h.taluka_id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900">{h.taluka_name_gu}</span>
                            {h.district_name_gu && (
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {h.district_name_gu}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                            {h.case_count}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-700">
                            {h.confirmed_count}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                h.risk_level === 'HIGH'
                                  ? 'bg-rose-100 text-rose-800'
                                  : h.risk_level === 'MODERATE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {h.risk_level === 'HIGH'
                                ? 'અતિ ઉચ્ચ જોખમ'
                                : h.risk_level === 'MODERATE'
                                ? 'મધ્યમ જોખમ'
                                : 'સામાન્ય'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
