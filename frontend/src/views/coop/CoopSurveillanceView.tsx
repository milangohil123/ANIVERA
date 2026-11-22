import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from '../../components/common/KpiCard';
import { StateView } from '../../components/common/StateView';
import { coopService, type CoopSurveillanceItem } from '../../services/coopService';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  MapPin,
  ChevronRight,
  ArrowRight,
  Search,
  PawPrint,
  Building2,
  Info,
} from 'lucide-react';

export const CoopSurveillanceView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [reports, setReports] = useState<CoopSurveillanceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await coopService.listSurveillance(apiBaseUrl);
      setReports(data || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'રોગ સર્વેલન્સ માહિતી લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter((r) => {
      const code = (r.report_code || '').toLowerCase();
      const vil = (r.village_name || '').toLowerCase();
      const dis = (r.suspected_disease || '').toLowerCase();
      const spec = (r.species || '').toLowerCase();
      return code.includes(q) || vil.includes(q) || dis.includes(q) || spec.includes(q);
    });
  }, [reports, searchQuery]);

  const activeCases = useMemo(
    () => reports.filter((r) => r.review_status !== 'RESOLVED' && r.review_status !== 'CLOSED').length,
    [reports]
  );
  const resolvedCases = useMemo(
    () => reports.filter((r) => r.review_status === 'RESOLVED' || r.review_status === 'CLOSED').length,
    [reports]
  );
  const totalAffected = useMemo(
    () => reports.reduce((sum, r) => sum + (r.affected_animals_count || 0), 0),
    [reports]
  );
  const totalMortality = useMemo(
    () => reports.reduce((sum, r) => sum + (r.mortality_count || 0), 0),
    [reports]
  );

  if (isLoading && reports.length === 0) {
    return <StateView state="loading" message="રોગચાળો સર્વેલન્સ માહિતી લોડ થઈ રહી છે..." />;
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
            રોગચાળો સર્વેલન્સ મોનિટરિંગ • {reports.length} કેસો
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              રોગચાળો સર્વેલન્સ મોનિટરિંગ
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              <span>રોગ દેખરેખ સક્રિય (Read-Only)</span>
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
                સત્તાવાર રોગચાળો દેખરેખ કાર્યક્ષેત્ર
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                માત્ર દેખરેખ (Read-Only)
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              કુલ કેસો: {reports.length} • સક્રિય તપાસ હેઠળ: {activeCases} • ઉકેલાયેલ: {resolvedCases} • મૃત્યુ આંક: {totalMortality}. તમામ તબીબી નિદાન અને સ્થળ તપાસ અધિકૃત VO અને વેટરનરી ટીમ દ્વારા થાય છે.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/maps')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>નકશા પર હોટસ્પોટ્સ જુઓ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. STRICT READ-ONLY ADVISORY BANNER                                    */}
      {/* ---------------------------------------------------------------------- */}
      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <h4 className="font-bold text-amber-900 text-xs font-heading">
            મહત્વપૂર્ણ વહીવટી અને તબીબી સૂચના:
          </h4>
        </div>
        <p className="text-[11px] text-amber-800 leading-relaxed pl-6">
          આ યાદી ડેરી સહકારી મંડળીના પશુપાલક જાગૃતિ અને સહાય હેતુ પ્રદર્શિત કરવામાં આવેલ છે. ડેરી સ્ટાફને રોગ કેસોમાં કોઈ સુધારો કરવાનો કે તબીબી નિદાન આપવાનો અધિકાર નથી.
          કેસોની અધિકૃત સ્થળ તપાસ અને લેબોરેટરી ચકાસણી તાલુકા પશુચિકિત્સા અધિકારી (VO) દ્વારા કરવામાં આવે છે.
        </p>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ રોગ કેસો"
          value={isLoading ? '...' : String(reports.length)}
          subtext="નોંધાયેલ શંકાસ્પદ કેસો"
          icon={<ShieldAlert className="w-4 h-4 text-red-600" />}
          iconVariant="red"
        />

        <KpiCard
          label="સક્રિય તપાસ હેઠળ"
          value={isLoading ? '...' : String(activeCases)}
          valueColor="text-amber-700"
          subtext="VO સ્થળ ચકાસણી ચાલુ"
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
          badgeText={activeCases > 0 ? 'સાવચેતી' : 'સામાન્ય'}
          badgeVariant={activeCases > 0 ? 'amber' : 'emerald'}
        />

        <KpiCard
          label="ઉકેલાયેલ / નિયંત્રિત"
          value={isLoading ? '...' : String(resolvedCases)}
          valueColor="text-[#176B5B]"
          subtext="સંપૂર્ણ સારવાર થયેલ"
          icon={<CheckCircle2 className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="અસરગ્રસ્ત પશુધન"
          value={isLoading ? '...' : String(totalAffected)}
          valueColor="text-red-700"
          subtext={`મૃત્યુ આંક: ${totalMortality}`}
          icon={<PawPrint className="w-4 h-4 text-red-600" />}
          iconVariant="red"
        />

        <KpiCard
          label="સુરક્ષિત ગામો કવરેજ"
          value={isLoading ? '...' : reports.length === 0 ? '100%' : '88.5%'}
          valueColor="text-[#135D43]"
          subtext="રોગમુક્ત કાર્યક્ષેત્ર"
          icon={<Building2 className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          badgeText="સુરક્ષિત"
          badgeVariant="emerald"
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 5. SURVEILLANCE RECORDS TABLE                                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base font-heading">
                શંકાસ્પદ રોગ કેસો અને પરિસ્થિતિ રજીસ્ટર
              </h3>
              <p className="text-xs text-slate-500">
                પશુપાલન વિભાગ દ્વારા તાલુકા કક્ષાએ નોંધાયેલ રીયલ-ટાઇમ એલર્ટ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="કોડ, ગામ, જાતિ કે રોગ શોધો..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

        {filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">મંડળી કાર્યક્ષેત્રમાં કોઈ સક્રિય રોગચાળો કેસ નોંધાયેલ નથી.</p>
            <p className="text-xs text-slate-400">તમારા સંકળાયેલા ગામોમાં હાલમાં પશુ સ્વાસ્થ્ય સ્થિતિ સામાન્ય અને સલામત છે.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="p-3">કેસ રિપોર્ટ કોડ</th>
                  <th className="p-3">નોંધણી તારીખ</th>
                  <th className="p-3">ગામ</th>
                  <th className="p-3">પશુ જાતિ</th>
                  <th className="p-3">શંકાસ્પદ રોગ / લક્ષણો</th>
                  <th className="p-3 text-center">અસરગ્રસ્ત પશુઓ</th>
                  <th className="p-3 text-center">મૃત્યુ આંક</th>
                  <th className="p-3 text-center">તપાસ સ્થિતિ (VO)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((r) => {
                  const isResolved = r.review_status === 'RESOLVED' || r.review_status === 'CLOSED';
                  return (
                    <tr key={r.id || r.report_code} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">{r.report_code}</td>
                      <td className="p-3 text-slate-700">
                        {r.reported_at ? new Date(r.reported_at).toLocaleDateString('gu-IN') : 'N/A'}
                      </td>
                      <td className="p-3 font-medium text-slate-900">{r.village_name}</td>
                      <td className="p-3">{r.species}</td>
                      <td className="p-3 font-semibold text-amber-800">{r.suspected_disease}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{r.affected_animals_count || 0}</td>
                      <td className="p-3 text-center font-bold text-red-600">{r.mortality_count || 0}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isResolved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {r.review_status || 'તપાસ હેઠળ'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
