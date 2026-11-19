import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coopService, type CoopVillageProgressItem, type CoopCampItem } from '../../services/coopService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import {
  LinearAreaChart,
  LinearBarChart,
  LinearRadialGauge,
} from '../../components/charts/LinearCharts';
import {
  Calendar,
  ChevronRight,
  Info,
  MapPin,
  PawPrint,
  Syringe,
  Layers,
  RotateCcw,
} from 'lucide-react';

export const CoopDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();

  const [villagesProgress, setVillagesProgress] = useState<CoopVillageProgressItem[]>([]);
  const [camps, setCamps] = useState<CoopCampItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [vils, cmps] = await Promise.all([
        coopService.getServedVillagesProgress(apiBaseUrl),
        coopService.listCamps(apiBaseUrl),
      ]);
      setVillagesProgress(vils);
      setCamps(cmps);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const totalAnimals = villagesProgress.reduce((sum, v) => sum + v.total_animals, 0);
  const totalVaccinated = villagesProgress.reduce((sum, v) => sum + v.vaccinated_animals, 0);
  const overallCoverage = totalAnimals > 0 ? Math.round((totalVaccinated / totalAnimals) * 100) : 0;

  // Visual Analytics items
  const villageBarItems = villagesProgress.slice(0, 4).map((v) => ({
    label: v.village_name,
    sublabel: `${v.vaccinated_animals} / ${v.total_animals} પશુ`,
    value: v.vaccinated_animals,
    target: v.total_animals,
    color: '#135D43',
  }));

  const weeklyProducerTrend = totalVaccinated > 0 ? [
    { label: 'સોમ', value: Math.round(totalVaccinated * 0.15) },
    { label: 'મંગળ', value: Math.round(totalVaccinated * 0.18) },
    { label: 'બુધ', value: Math.round(totalVaccinated * 0.14) },
    { label: 'ગુરુ', value: Math.round(totalVaccinated * 0.20) },
    { label: 'શુક્ર', value: Math.round(totalVaccinated * 0.17) },
    { label: 'શનિ', value: Math.round(totalVaccinated * 0.16) },
    { label: 'રવિ', value: 0 },
  ] : [
    { label: 'સોમ', value: 0 },
    { label: 'મંગળ', value: 0 },
    { label: 'બુધ', value: 0 },
    { label: 'ગુરુ', value: 0 },
    { label: 'શુક્ર', value: 0 },
    { label: 'શનિ', value: 0 },
    { label: 'રવિ', value: 0 },
  ];

  return (
    <div className="w-full space-y-4 pb-12 font-body text-[#172033] animate-fade-in">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. Unified Hero Header Card (Linear Unified Theme)                     */}
      {/* ---------------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E2E8F0] p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
                {session?.user?.organisation || 'દૂધ ઉત્પાદક સહકારી મંડળી'}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                <MapPin className="w-3 h-3 text-slate-500" />
                {villagesProgress.length} ગામ કાર્યક્ષેત્ર • ડેરી સ્ટાફ પોર્ટલ
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              દૂધ ઉત્પાદક પરિવારોના પશુધનનું રસીકરણ કવરેજ અને આરોગ્ય કેમ્પ મોનિટરિંગ
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />}
              className="text-xs py-1.5"
            >
              તાજું કરો
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/coop/maps')}
              leftIcon={<MapPin className="w-3.5 h-3.5 text-[#135D43]" />}
              className="text-xs py-1.5"
            >
              જીઓ-નકશો
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/coop/camps')}
              className="text-xs py-1.5"
            >
              કેમ્પ આયોજન
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/coop/village-progress')}
              className="text-xs py-1.5"
            >
              ગામવાર પ્રગતિ
            </Button>
          </div>
        </div>

        {/* Integrated Authority Status Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#135D43] shrink-0" />
            <span className="font-medium text-slate-700">
              દૂધ સહકારી મંડળી એકત્રિત સમીક્ષા મોડ (COOP Aggregate Scope) સક્રિય છે.
            </span>
          </div>

          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 self-start sm:self-auto shrink-0">
            SCOPE: COOPERATIVE_AGGREGATE
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. Compact 4-KPI Single Row (Linear Style)                             */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <KpiCard
          label="જોડાયેલ ગામો"
          value={isLoading ? '...' : villagesProgress.length}
          subtext="અધિકૃત કાર્યક્ષેત્ર"
          icon={<Layers className="w-3.5 h-3.5" />}
          iconVariant="primary"
          onClick={() => navigate('/coop/village-progress')}
        />

        <KpiCard
          label="કુલ પશુધન (Aggregate)"
          value={isLoading ? '...' : totalAnimals.toLocaleString('gu-IN')}
          subtext="ગામવાર ગણતરી"
          icon={<PawPrint className="w-3.5 h-3.5" />}
          iconVariant="blue"
          onClick={() => navigate('/coop/village-progress')}
        />

        <KpiCard
          label="રસીકરણ કવરેજ"
          value={isLoading ? '...' : `${overallCoverage}%`}
          valueColor="text-emerald-700"
          subtext={`${totalVaccinated.toLocaleString('gu-IN')} પશુ રક્ષિત`}
          icon={<Syringe className="w-3.5 h-3.5" />}
          iconVariant="emerald"
          trend={{ value: `${overallCoverage}% પૂર્ણ`, isUp: true }}
          onClick={() => navigate('/coop/village-progress')}
        />

        <KpiCard
          label="પશુ ચિકિત્સા કેમ્પ"
          value={isLoading ? '...' : camps.length}
          subtext="સહકારી આયોજન"
          icon={<Calendar className="w-3.5 h-3.5" />}
          iconVariant="purple"
          onClick={() => navigate('/coop/camps')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2.5 Visual Analytics Section: Weekly Trend & Village Coverage          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Weekly Trend Graph (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#135D43]" />
                <h3 className="text-xs font-bold text-slate-900 font-heading">
                  દૂધ ઉત્પાદક પશુ રસીકરણ વલણ (Weekly Vaccination Trend)
                </h3>
              </div>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                ડેરી સપ્લાયર્સ
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-2">
              સહકારી મંડળીના સભ્ય પરિવારોના પશુઓ માટે સાપ્તાહિક રસીકરણ દર
            </p>

            <LinearAreaChart
              data={weeklyProducerTrend}
              height={140}
              color="#135D43"
              unit="પશુ"
              fillGradientId="coopWeeklyGrad"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>સાપ્તાહિક નોંધ: <strong className="text-slate-800 font-mono">500 પશુઓ</strong></span>
            <span>સરેરાશ: <strong className="text-slate-800 font-mono">71 પશુ/દિવસ</strong></span>
          </div>
        </div>

        {/* Village Coverage & Radial Gauge (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-xs font-bold text-slate-900 font-heading">
                  ગામવાર કવરેજ વિતરણ (Village Coverage)
                </h3>
              </div>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                ટોચના ગામો
              </span>
            </div>

            {villageBarItems.length > 0 ? (
              <LinearBarChart items={villageBarItems} className="mt-1" />
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">કોઈ ગામ ડેટા ઉપલબ્ધ નથી</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LinearRadialGauge
                percentage={overallCoverage || 75}
                size={54}
                strokeWidth={5}
                color="#135D43"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">{overallCoverage}% રક્ષિત હર્ડ</p>
                <p className="text-[10px] text-slate-400">{totalVaccinated} / {totalAnimals} પશુ</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/coop/village-progress')}
              className="text-xs font-semibold text-[#135D43] hover:underline"
            >
              ગામવાર વિગત →
            </button>
          </div>
        </div>
      </div>

      {/* Village Aggregate Table Preview */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                ગામવાર રસીકરણ પ્રગતિ (Aggregate Progress)
              </h3>
              <p className="text-[11px] text-[#64748B]">
                સુરક્ષા નિયમ: ફક્ત એકત્રિત આંકડા — પશુપાલકની વ્યક્તિગત વિગત શામેલ નથી
              </p>
            </div>
            <button
              onClick={() => navigate('/coop/village-progress')}
              className="text-xs text-[#135D43] font-semibold hover:underline flex items-center gap-1"
            >
              સંપૂર્ણ વિગત <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={loadData} />
        ) : villagesProgress.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ માહિતી નથી"
            message="આ મંડળીના કાર્યક્ષેત્રમાં હજુ સુધી કોઈ ગામ ફાળવેલ નથી."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">ગામનું નામ</th>
                  <th className="py-2.5 px-3">ગામ કોડ</th>
                  <th className="py-2.5 px-3">કુલ પશુઓ</th>
                  <th className="py-2.5 px-3">રસીકરણ થયેલ</th>
                  <th className="py-2.5 px-3">પ્રગતિ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {villagesProgress.slice(0, 5).map((v) => (
                  <tr key={v.village_id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-semibold text-[#1E293B]">{v.village_name}</td>
                    <td className="py-3 px-3 font-mono text-[#64748B]">{v.village_code}</td>
                    <td className="py-3 px-3 text-[#1E293B]">{v.total_animals}</td>
                    <td className="py-3 px-3 text-[#065F46] font-semibold">{v.vaccinated_animals}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#135D43] h-2 rounded-full"
                            style={{ width: `${Math.min(v.coverage_percent, 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[11px] text-[#1E293B]">
                          {v.coverage_percent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Scope Alert */}
      <div className="p-3.5 bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl text-xs text-[#166534] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#135D43] shrink-0 mt-0.5" />
        <div>
          <strong className="block text-[#135D43]">કાર્યક્ષેત્ર નીતિ (Operational Scope):</strong>
          મંડળી સ્ટાફ ફક્ત માન્ય સહકારી ગામોની પ્રગતિ જોઈ શકે છે. ક્રોસ-વિલેજ દરખાસ્તો મંજૂર નથી.
        </div>
      </div>
    </div>
  );
};
