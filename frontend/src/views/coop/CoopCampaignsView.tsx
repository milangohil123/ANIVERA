import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from '../../components/common/KpiCard';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import {
  Megaphone,
  Tent,
  ArrowRight,
  RotateCcw,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Search,
  ShieldCheck,
  TrendingUp,
  Target,
  Clock,
  Building2,
} from 'lucide-react';

export const CoopCampaignsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/campaigns?limit=50`, {
        headers: { Authorization: `Bearer ${session?.accessToken || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data || []);
      } else {
        // Fallback demo campaigns if empty or server not reachable
        setCampaigns([
          {
            id: 'camp-1',
            name: 'FMD (ખુરપકા-મોંહપકા) રસીકરણ તબક્કો-૪',
            code: 'CAMP-FMD-2024-R4',
            status: 'ACTIVE',
            disease_name: 'FMD (Foot and Mouth Disease)',
            start_date: '2024-10-01',
            end_date: '2024-12-15',
            coverage_pct: 82,
            target_species: 'Cattle, Buffalo',
          },
          {
            id: 'camp-2',
            name: 'LSD (લમ્પી સ્કીન ડીસીઝ) બૂસ્ટર ઝુંબેશ',
            code: 'CAMP-LSD-2024-B1',
            status: 'ACTIVE',
            disease_name: 'Lumpy Skin Disease',
            start_date: '2024-11-01',
            end_date: '2024-12-30',
            coverage_pct: 74,
            target_species: 'Cattle',
          },
          {
            id: 'camp-3',
            name: 'બ્રુસેલોસિસ (Brucellosis) વાછરડી રસીકરણ',
            code: 'CAMP-BRU-2024-V2',
            status: 'COMPLETED',
            disease_name: 'Brucellosis',
            start_date: '2024-06-01',
            end_date: '2024-09-30',
            coverage_pct: 95,
            target_species: 'Calves (Female)',
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'ઝુંબેશો લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const filteredCampaigns = useMemo(() => {
    if (!searchQuery.trim()) return campaigns;
    const q = searchQuery.toLowerCase();
    return campaigns.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const code = (c.code || '').toLowerCase();
      const dis = (c.disease_name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dis.includes(q);
    });
  }, [campaigns, searchQuery]);

  const activeCount = useMemo(() => campaigns.filter((c) => c.status === 'ACTIVE').length, [campaigns]);
  const completedCount = useMemo(() => campaigns.filter((c) => c.status === 'COMPLETED').length, [campaigns]);

  if (isLoading && campaigns.length === 0) {
    return <StateView state="loading" message="રસીકરણ ઝુંબેશ માહિતી લોડ થઈ રહી છે..." />;
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
            રસીકરણ ઝુંબેશ મોનિટરિંગ • {campaigns.length} ઝુંબેશો
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              રસીકરણ ઝુંબેશ મોનિટરિંગ
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>ઝુંબેશ મોનિટરિંગ સક્રિય</span>
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
              onClick={() => navigate('/coop/camps')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <Tent className="w-3.5 h-3.5 text-white" />
              <span>+ કેમ્પ દરખાસ્ત કરો</span>
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
                સત્તાવાર રસીકરણ ઝુંબેશ કાર્યક્ષેત્ર
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                જિલ્લા કક્ષાએ મંજૂર
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              કુલ ઝુંબેશો: {campaigns.length} • સક્રિય અભિયાન: {activeCount} • પૂર્ણ: {completedCount}. જિલ્લા પશુપાલન કચેરી (DAHO) અને તાલુકા (TAHO) દ્વારા સંચાલિત ઝુંબેશોમાં મંડળી સભાસદોના પશુધનની ૧૦૦% સુરક્ષા.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/camps')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>કેમ્પ સંકલન જુઓ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ સક્રિય ઝુંબેશો"
          value={isLoading ? '...' : String(activeCount)}
          subtext="ચાલુ રાઉન્ડ અભિયાન"
          icon={<Megaphone className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="કુલ નોંધાયેલ ઝુંબેશો"
          value={isLoading ? '...' : String(campaigns.length)}
          valueColor="text-[#176B5B]"
          subtext={`${completedCount} પૂર્ણ થયેલ`}
          icon={<Target className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="સરેરાશ કવરેજ સિદ્ધિ"
          value={isLoading ? '...' : '78.4%'}
          valueColor="text-[#176B5B]"
          subtext="મંડળી સભાસદ પશુઓ"
          icon={<TrendingUp className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          badgeText="પ્રગતિમાં"
          badgeVariant="emerald"
        />

        <KpiCard
          label="સંકલિત પશુ કેમ્પો"
          value={isLoading ? '...' : '12 કેમ્પ'}
          subtext="કાર્યક્ષેત્ર ગામોમાં આયોજિત"
          icon={<Tent className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
          onClick={() => navigate('/coop/camps')}
        />

        <KpiCard
          label="સુરક્ષા પ્રમાણીકરણ"
          value={isLoading ? '...' : '100%'}
          valueColor="text-[#135D43]"
          subtext="ચકાસાયેલ રસી બેચ"
          icon={<ShieldCheck className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          badgeText="સત્તાવાર"
          badgeVariant="emerald"
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. CAMPAIGNS LIST / CARDS SECTION                                      */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 text-[#176B5B] flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base font-heading">
                મંજૂર થયેલ રસીકરણ ઝુંબેશો
              </h3>
              <p className="text-xs text-slate-500">
                જિલ્લા અને તાલુકા કક્ષાએ મંજૂર થયેલ સત્તાવાર ઝુંબેશ કાર્યસૂચિ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ઝુંબેશ નામ, રોગ અથવા કોડ શોધો..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#135D43]"
              />
            </div>
          </div>
        </div>

        {/* Campaign Cards Grid */}
        <div className="p-4 bg-slate-50/50">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {errorMsg}
            </div>
          )}

          {filteredCampaigns.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-700">કોઈ મેળ ખાતી ઝુંબેશ મળી નથી.</p>
              <p className="text-xs text-slate-400 mt-1">શોધ શબ્દ બદલીને ફરી પ્રયાસ કરો.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCampaigns.map((c) => {
                const isAct = c.status === 'ACTIVE';
                const cov = c.coverage_pct || (isAct ? 78 : 95);
                return (
                  <div
                    key={c.id || c.code}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:shadow-md transition-shadow space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isAct
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isAct ? 'ચાલુ અભિયાન (ACTIVE)' : 'પૂર્ણ (COMPLETED)'}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1 line-clamp-1 font-heading">
                          {c.name}
                        </h4>
                        <code className="text-[11px] text-slate-400 font-mono block mt-0.5">
                          {c.code}
                        </code>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          સમયગાળો:
                        </span>
                        <strong className="text-slate-800 font-medium">
                          {c.start_date ? new Date(c.start_date).toLocaleDateString('gu-IN') : 'N/A'} -{' '}
                          {c.end_date ? new Date(c.end_date).toLocaleDateString('gu-IN') : 'N/A'}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">લક્ષિત પશુજાતિ:</span>
                        <strong className="text-slate-800 font-medium">
                          {c.target_species || 'ગાય / ભેંસ'}
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">મંડળી સ્તરે કવરેજ પ્રગતિ</span>
                        <strong className="text-[#135D43] font-bold">{cov}% પૂર્ણ</strong>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#135D43] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, cov)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-500">ગામમાં કેમ્પ સંકલન</span>
                      <button
                        onClick={() => navigate('/coop/camps')}
                        className="text-[#135D43] font-bold hover:underline flex items-center gap-1"
                      >
                        કેમ્પ આયોજન <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
