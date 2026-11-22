import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  coopService,
  type CoopCampItem,
  type CoopVillageProgressItem,
} from '../../services/coopService';
import { KpiCard } from '../../components/common/KpiCard';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Users,
  X,
  MapPin,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  Tent,
  Search,
  Building2,
} from 'lucide-react';

export const CoopCampsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [camps, setCamps] = useState<CoopCampItem[]>([]);
  const [villages, setVillages] = useState<CoopVillageProgressItem[]>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name_gu: string; name_en: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [campaignId, setCampaignId] = useState<string>('');
  const [villageId, setVillageId] = useState<string>('');
  const [plannedStart, setPlannedStart] = useState<string>('');
  const [plannedEnd, setPlannedEnd] = useState<string>('');
  const [locationText, setLocationText] = useState<string>('');
  const [expectedFarmers, setExpectedFarmers] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [cmps, vils, campsList] = await Promise.all([
        coopService.listCamps(apiBaseUrl),
        coopService.getServedVillagesProgress(apiBaseUrl),
        coopService.listActiveCampaigns(apiBaseUrl),
      ]);
      setCamps(cmps || []);
      setVillages(vils || []);
      setCampaigns(campsList || []);
      if (vils && vils.length > 0) setVillageId(vils[0].village_id);
      if (campsList && campsList.length > 0) setCampaignId(campsList[0].id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !villageId || !plannedStart || !plannedEnd) {
      setFormError('બધી ફરજિયાત વિગતો ભરો.');
      return;
    }

    if (new Date(plannedEnd) <= new Date(plannedStart)) {
      setFormError('સમાપ્તિ સમય શરૂઆતના સમય પછીનો હોવો જોઈએ.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await coopService.proposeCamp(apiBaseUrl, {
        campaign_id: campaignId,
        village_id: villageId,
        planned_start: new Date(plannedStart).toISOString(),
        planned_end: new Date(plannedEnd).toISOString(),
        location_text: locationText.trim() || undefined,
        expected_farmers: expectedFarmers,
      });

      setFormSuccess('કેમ્પ દરખાસ્ત સફળતાપૂર્વક મોકલાઈ ગઈ છે. વેટરનરી ઓફિસર દ્વારા મંજૂરી અપાશે.');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
        loadData();
      }, 1600);
    } catch (err: any) {
      setFormError(err?.message || 'દરખાસ્ત મોકલવામાં નિષ્ફળ. ફરી પ્રયાસ કરો.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (iso?: string | null): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch {
      return iso;
    }
  };

  const filteredCamps = useMemo(() => {
    if (!searchQuery.trim()) return camps;
    const q = searchQuery.toLowerCase();
    return camps.filter((c) => {
      const loc = (c.location_text || '').toLowerCase();
      const org = (c.organizer_type || '').toLowerCase();
      const st = (c.status || '').toLowerCase();
      return loc.includes(q) || org.includes(q) || st.includes(q);
    });
  }, [camps, searchQuery]);

  const confirmedCount = useMemo(() => camps.filter((c) => c.status === 'CONFIRMED').length, [camps]);
  const proposedCount = useMemo(() => camps.filter((c) => c.status === 'PROPOSED').length, [camps]);
  const totalFarmersExpected = useMemo(() => camps.reduce((sum, c) => sum + (c.expected_farmers || 0), 0), [camps]);

  if (isLoading && camps.length === 0) {
    return <StateView state="loading" message="પશુ આરોગ્ય કેમ્પ માહિતી લોડ થઈ રહી છે..." />;
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
            પશુ આરોગ્ય કેમ્પ સંકલન • {camps.length} આયોજિત
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              પશુ આરોગ્ય કેમ્પ સંકલન
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>કેમ્પ સંકલન સક્રિય</span>
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
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ નવો કેમ્પ દરખાસ્ત</span>
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
                સત્તાવાર પશુ આરોગ્ય કેમ્પ આયોજન
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                કાર્યક્ષેત્ર સંકલન
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              કુલ કેમ્પ: {camps.length} • મંજૂર: {confirmedCount} • પ્રસ્તાવિત: {proposedCount} • અપેક્ષિત ખેડૂતો: {totalFarmersExpected}. તાલુકા પશુચિકિત્સા અધિકારી (VO) ટીમ સાથે ગામે-ગામ કેમ્પનું સચોટ આયોજન.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/village-progress')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>ગામવાર કવરેજ જુઓ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. CROSS-VILLAGE RESTRICTION ALERT                                     */}
      {/* ---------------------------------------------------------------------- */}
      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-900 font-bold mb-0.5">
            કાર્યક્ષેત્ર સીમા નીતિ (Boundary Policy):
          </strong>
          સહકારી મંડળી ફક્ત તેના ફાળવાયેલ સત્તાવાર કાર્યક્ષેત્ર ગામો પૂરતી જ કેમ્પ દરખાસ્ત કરી શકે છે. અન્ય ગામોમાં અનધિકૃત કેમ્પ પ્રસ્તાવ સિસ્ટમ દ્વારા સ્વીકારવામાં આવશે નહીં.
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ કેમ્પ આયોજન"
          value={isLoading ? '...' : String(camps.length)}
          subtext="કુલ નોંધાયેલ દરખાસ્તો"
          icon={<Calendar className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="મંજૂર થયેલ (Confirmed)"
          value={isLoading ? '...' : String(confirmedCount)}
          valueColor="text-[#176B5B]"
          subtext="VO ટીમ દ્વારા સ્વીકૃત"
          icon={<CheckCircle2 className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          badgeText="મંજૂર"
          badgeVariant="emerald"
        />

        <KpiCard
          label="પ્રસ્તાવિત (Pending)"
          value={isLoading ? '...' : String(proposedCount)}
          valueColor="text-amber-700"
          subtext="ચકાસણી પ્રતીક્ષામાં"
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
          badgeText={proposedCount > 0 ? 'બાકી' : 'પૂર્ણ'}
          badgeVariant={proposedCount > 0 ? 'amber' : 'emerald'}
        />

        <KpiCard
          label="અંદાજિત પશુપાલકો"
          value={isLoading ? '...' : String(totalFarmersExpected)}
          valueColor="text-[#0284C7]"
          subtext="સભાસદ લાભાર્થીઓ"
          icon={<Users className="w-4 h-4 text-[#0284C7]" />}
          iconVariant="blue"
        />

        <KpiCard
          label="સંકળાયેલ ગામો"
          value={isLoading ? '...' : String(villages.length)}
          valueColor="text-[#135D43]"
          subtext="મંડળી કાર્યક્ષેત્ર"
          icon={<Tent className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          badgeText="સત્તાવાર"
          badgeVariant="emerald"
          onClick={() => navigate('/coop/village-progress')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 5. CAMPS LIST / TABLE SECTION                                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 text-[#176B5B] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base font-heading">
                આયોજિત અને પ્રસ્તાવિત પશુ ચિકિત્સા કેમ્પ યાદી
              </h3>
              <p className="text-xs text-slate-500">
                સ્થળ, સમય, અપેક્ષિત પશુપાલકો અને મંજૂરી સ્થિતિ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="સ્થળ કે આયોજક શોધો..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#135D43]"
              />
            </div>
          </div>
        </div>

        {/* List Content */}
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs border-b border-red-200">
            {errorMsg}
          </div>
        )}

        {filteredCamps.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">કોઈ પશુ કેમ્પ આયોજિત નથી.</p>
            <p className="text-xs text-slate-400">
              નવો પશુ ચિકિત્સા કેમ્પ દરખાસ્ત કરવા ઉપરના બટન પર ક્લિક કરો.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {filteredCamps.map((camp) => {
              const isConf = camp.status === 'CONFIRMED';
              const isCanc = camp.status === 'CANCELLED';
              return (
                <div
                  key={camp.id}
                  className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#1E293B]">
                        {camp.location_text || 'પશુ ચિકિત્સા અને રસીકરણ કેમ્પ'}
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          isConf
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isCanc
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isConf ? 'મંજૂર (Confirmed)' : isCanc ? 'રદ થયેલ (Cancelled)' : 'પ્રસ્તાવિત (Proposed)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#64748B] flex-wrap">
                      <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[#135D43]" />
                        {formatDate(camp.planned_start)} થી {formatDate(camp.planned_end)}
                      </span>
                      {camp.expected_farmers && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          અપેક્ષિત ખેડૂતો: <strong>{camp.expected_farmers}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 self-start sm:self-auto text-right">
                    <span>આયોજક સ્તર: </span>
                    <strong className="text-slate-800">{camp.organizer_type || 'COOPERATIVE'}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 6. PROPOSE CAMP MODAL                                                  */}
      {/* ---------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-body animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-[#E2E8F0] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] text-[#135D43] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                    નવો પશુ ચિકિત્સા કેમ્પ પ્રસ્તાવ
                  </h3>
                  <p className="text-[11px] text-slate-500">ગામ સ્તરે રસીકરણ અને સ્વાસ્થ્ય તપાસ કેમ્પ</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleProposeSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  અભિયાન પસંદ કરો (Campaign) *
                </label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none bg-white"
                >
                  <option value="">-- અભિયાન પસંદ કરો --</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_gu || c.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  કાર્યક્ષેત્ર ગામ પસંદ કરો (ફક્ત મંડળીના માન્ય ગામો) *
                </label>
                <select
                  value={villageId}
                  onChange={(e) => setVillageId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none bg-white"
                >
                  <option value="">-- ગામ પસંદ કરો --</option>
                  {villages.map((v) => (
                    <option key={v.village_id} value={v.village_id}>
                      {v.village_name} ({v.village_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    શરૂઆત સમય *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={plannedStart}
                    onChange={(e) => setPlannedStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    સમાપ્તિ સમય *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={plannedEnd}
                    onChange={(e) => setPlannedEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  કેમ્પ સ્થળ વર્ણન (Location Text)
                </label>
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="દા.ત. દૂધ મંડળી ચોક, પંચાયત ભવન પાસે"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  અપેક્ષિત પશુપાલક સંખ્યા (Expected Farmers)
                </label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={expectedFarmers}
                  onChange={(e) => setExpectedFarmers(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs focus:ring-1 focus:ring-[#135D43] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  રદ કરો
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isSubmitting}
                  className="bg-[#135D43] text-white hover:bg-[#0F4C37]"
                >
                  દરખાસ્ત સબમિટ કરો
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
