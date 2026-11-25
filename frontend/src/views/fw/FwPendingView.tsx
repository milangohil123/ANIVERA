import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  fwService,
  type FWCampaignOption,
  type FWCampaignPendingResponse,
  type FWPendingFarmerGroup,
  type FWPendingAnimalItem,
  type FWVillageItem,
  type FWCampOption,
} from '../../services/fwService';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  HeartPulse,
  MapPin,
  Megaphone,
  ArrowLeft,
} from 'lucide-react';

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય',
  BUFFALO: 'ભેંસ',
  GOAT: 'બકરી',
  SHEEP: 'ઘેટું',
  OTHER: 'અન્ય',
};

export const FwPendingView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, scope, hasPermission, deviceInfo } = useAuth();
  const isVaccinator = Boolean(scope?.is_approved_vaccinator || hasPermission('vaccination.record'));

  // Village state
  const [villages, setVillages] = useState<FWVillageItem[]>([]);
  const [activeVillageId, setActiveVillageId] = useState<string>(() => {
    return localStorage.getItem('fw_active_village_id') || '';
  });
  const [isLoadingVillages, setIsLoadingVillages] = useState(true);

  // Campaigns & Camps
  const [campaigns, setCampaigns] = useState<FWCampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [villageCamps, setVillageCamps] = useState<FWCampOption[]>([]);

  // Pending Data
  const [pendingData, setPendingData] = useState<FWCampaignPendingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // UI state
  const [filterMode, setFilterMode] = useState<'PENDING_ONLY' | 'ALL'>('PENDING_ONLY');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFarmers, setExpandedFarmers] = useState<Record<string, boolean>>({});

  // Quick Vaccinate Modal State
  const [isVaxModalOpen, setIsVaxModalOpen] = useState(false);
  const [targetAnimal, setTargetAnimal] = useState<FWPendingAnimalItem | null>(null);
  const [targetFarmer, setTargetFarmer] = useState<FWPendingFarmerGroup | null>(null);
  const [vaxDate, setVaxDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [selectedCampId, setSelectedCampId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [vaxRemarks, setVaxRemarks] = useState('');
  const [isSubmittingVax, setIsSubmittingVax] = useState(false);

  // Village Completion & Verification Workflow State
  const [verificationData, setVerificationData] = useState<any | null>(null);
  const [isSubmitVerifModalOpen, setIsSubmitVerifModalOpen] = useState(false);
  const [verifVisitedCount, setVerifVisitedCount] = useState<number>(0);
  const [verifNotes, setVerifNotes] = useState('');
  const [verifPhotos, setVerifPhotos] = useState('');
  const [isSubmittingVerif, setIsSubmittingVerif] = useState(false);

  // 1. Load Assigned Villages strictly from server
  useEffect(() => {
    let isMounted = true;
    const fetchVillages = async () => {
      setIsLoadingVillages(true);
      try {
        const list = await fwService.listAssignedVillages(apiBaseUrl);
        if (isMounted) {
          setVillages(list);
          if (list.length > 0) {
            const saved = localStorage.getItem('fw_active_village_id');
            const valid = list.some((v) => v.id === saved);
            const activeId = valid && saved ? saved : list[0].id;
            setActiveVillageId(activeId);
            localStorage.setItem('fw_active_village_id', activeId);
          } else {
            setActiveVillageId('');
            localStorage.removeItem('fw_active_village_id');
          }
        }
      } catch (err) {
        console.warn('Failed to load assigned villages:', err);
      } finally {
        if (isMounted) setIsLoadingVillages(false);
      }
    };

    fetchVillages();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // 2. Load Active Campaigns & Camps when village is established
  useEffect(() => {
    let isMounted = true;
    const fetchCampaignsAndCamps = async () => {
      try {
        const [campsList, campsData] = await Promise.all([
          fwService.listActiveCampaigns(apiBaseUrl).catch(() => []),
          activeVillageId
            ? fwService.listVillageCamps(apiBaseUrl, activeVillageId).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (isMounted) {
          setCampaigns(campsList);
          setVillageCamps(campsData);
          if (campsList.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(campsList[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to load campaigns:', err);
      }
    };

    if (activeVillageId) {
      fetchCampaignsAndCamps();
    }
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, activeVillageId]);

  // 3. Load Pending List for selected campaign & village
  const loadPendingList = async () => {
    if (!selectedCampaignId || !activeVillageId) {
      setPendingData(null);
      setVerificationData(null);
      return;
    }

    setIsLoading(true);
    setNotice(null);
    try {
      const [data, verifs] = await Promise.all([
        fwService.getPendingVaccinations(apiBaseUrl, selectedCampaignId, activeVillageId),
        fwService.listVillageVerifications(apiBaseUrl, selectedCampaignId).catch(() => []),
      ]);
      setPendingData(data);
      const curVerif = (verifs || []).find((v: any) => v.village_id === activeVillageId);
      setVerificationData(curVerif || null);

      // Auto-expand farmers who have pending animals
      const autoExpanded: Record<string, boolean> = {};
      data.farmers.forEach((f) => {
        if (f.remaining_count > 0) {
          autoExpanded[f.farmer_id] = true;
        }
      });
      setExpandedFarmers(autoExpanded);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'બાકી રસીકરણ યાદી મેળવવામાં નિષ્ફળ.',
      });
      setPendingData(null);
      setVerificationData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId || !activeVillageId) return;

    setIsSubmittingVerif(true);
    try {
      const photoUrls = verifPhotos
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const res = await fwService.submitVillageVerification(
        apiBaseUrl,
        selectedCampaignId,
        activeVillageId,
        {
          animals_visited_count: Number(verifVisitedCount) || (pendingData?.total_vaccinated || 0),
          vaccinations_completed_count: pendingData?.total_vaccinated || 0,
          pending_animals_count: pendingData?.total_remaining || 0,
          completion_notes: verifNotes.trim() || undefined,
          evidence_photo_urls: photoUrls.length > 0 ? photoUrls : undefined,
        }
      );

      setVerificationData(res);
      setNotice({
        type: 'success',
        message: 'કામગીરી સફળતાપૂર્વક ચકાસણી માટે મોકલાઈ. DAHO/TAHO સમીક્ષા કરીને પ્રમાણિત કરશે.',
      });
      setIsSubmitVerifModalOpen(false);
      await loadPendingList();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ચકાસણી સબમિશન નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingVerif(false);
    }
  };

  useEffect(() => {
    loadPendingList();
  }, [selectedCampaignId, activeVillageId, apiBaseUrl]);

  // Toggle Farmer accordion
  const toggleFarmer = (farmerId: string) => {
    setExpandedFarmers((prev) => ({
      ...prev,
      [farmerId]: !prev[farmerId],
    }));
  };

  // Open Quick Vaccinate Modal
  const handleOpenVaccinate = (animal: FWPendingAnimalItem, farmer: FWPendingFarmerGroup) => {
    setTargetAnimal(animal);
    setTargetFarmer(farmer);
    setSelectedCampId('');
    setBatchNumber('');
    setVaxRemarks('');
    setVaxDate(new Date().toISOString().substring(0, 10));
    setIsVaxModalOpen(true);
  };

  // Submit Quick Vaccination
  const handleSubmitVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAnimal || !activeVillageId || !selectedCampaignId) return;

    setIsSubmittingVax(true);
    try {
      const res = await fwService.recordVaccination(
        apiBaseUrl,
        {
          animal_id: targetAnimal.animal_id,
          village_id: activeVillageId,
          programme_code: targetAnimal.programme_code,
          event_date: vaxDate,
          batch_number: batchNumber.trim() || undefined,
          remarks: vaxRemarks.trim() || undefined,
          campaign_id: selectedCampaignId,
          camp_id: selectedCampId || undefined,
        },
        deviceInfo
      );

      setNotice({
        type: 'success',
        message: res.isOffline
          ? `ઓફલાઇન રસીકરણ સાચવાયું. નેટવર્ક જોડાતાં સિંક થશે.`
          : `પશુ ${targetAnimal.animal_code} નું રસીકરણ સફળતાપૂર્વક નોંધાયું. બાકી યાદી તાજી થઈ.`,
      });

      setIsVaxModalOpen(false);
      setTargetAnimal(null);
      setTargetFarmer(null);

      // Refresh live server data
      await loadPendingList();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રસીકરણ નોંધણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingVax(false);
    }
  };

  // Filtered farmers
  const filteredFarmers = useMemo(() => {
    if (!pendingData) return [];
    let list = pendingData.farmers;

    // Filter mode: pending only vs all
    if (filterMode === 'PENDING_ONLY') {
      list = list.filter((f) => f.remaining_count > 0);
    }

    // Search query: farmer name, mobile, code, or animal code
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((f) => {
        const matchFarmer =
          f.farmer_name.toLowerCase().includes(q) ||
          (f.mobile_e164 && f.mobile_e164.includes(q)) ||
          (f.farmer_code && f.farmer_code.toLowerCase().includes(q));
        const matchAnimal = f.animals.some(
          (a) =>
            a.animal_code.toLowerCase().includes(q) ||
            (a.tag_number && a.tag_number.includes(q)) ||
            (a.qr_token && a.qr_token.toLowerCase().includes(q))
        );
        return matchFarmer || matchAnimal;
      });
    }

    return list;
  }, [pendingData, filterMode, searchQuery]);

  return (
    <div className="w-full space-y-4 pb-12 font-body text-[#172033]">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/fw/home')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          હોમ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#135D43]" />
          બાકી રસીકરણ યાદી
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPendingList}
          isLoading={isLoading}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          તાજું કરો
        </Button>
      </div>

      {/* Honest Warning if No Village Assigned */}
      {villages.length === 0 && !isLoadingVillages && (
        <Card noPadding className="p-4 bg-red-50/70 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-900 leading-relaxed">
              <p className="font-bold text-red-800">ગામ સોંપણી ગેરહાજર:</p>
              <p className="mt-0.5">
                તમને હાલમાં કોઈ ગામની સોંપણી કરવામાં આવી નથી. કૃપા કરીને અધિકૃત અધિકારીનો સંપર્ક કરો.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Read-only Assigned Village & Campaign Header */}
      {villages.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                કાર્યક્ષેત્ર (સક્રિય ગામ):
              </span>
              <div className="mt-1 flex items-center gap-2">
                {villages.length === 1 ? (
                  <span className="font-bold text-sm text-[#135D43] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    {villages[0].name_gu} ({villages[0].code})
                  </span>
                ) : (
                  <select
                    value={activeVillageId}
                    onChange={(e) => {
                      setActiveVillageId(e.target.value);
                      localStorage.setItem('fw_active_village_id', e.target.value);
                    }}
                    className="px-3 py-1 text-xs border rounded-lg font-bold text-[#135D43] bg-emerald-50 focus:ring-1 focus:ring-[#135D43]"
                  >
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name_gu} ({v.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Campaign Selector */}
            <div className="min-w-[200px]">
              <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1">
                <Megaphone className="w-3.5 h-3.5 text-[#135D43]" />
                સક્રિય રસીકરણ ઝુંબેશ:
              </span>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] shadow-xs focus:ring-1 focus:ring-[#135D43]"
              >
                {campaigns.length === 0 ? (
                  <option value="">કોઈ સક્રિય ઝુંબેશ નથી</option>
                ) : (
                  campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code}] {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Campaign Live Stats Card */}
          {pendingData && (
            <div className="pt-3 border-t border-[#E2E8F0] grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-gray-50 border border-[#E2E8F0]">
                <span className="text-[10px] text-[#64748B] font-semibold block">કુલ પાત્ર પશુઓ</span>
                <span className="text-base font-bold text-[#1E293B] font-mono mt-0.5 block">
                  {pendingData.total_eligible}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-[10px] text-emerald-800 font-semibold block">રસીકરણ પૂર્ણ</span>
                <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
                  {pendingData.total_vaccinated}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[10px] text-amber-800 font-semibold block">બાકી પશુઓ</span>
                <span className="text-base font-bold text-amber-700 font-mono mt-0.5 block">
                  {pendingData.total_remaining}
                </span>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {pendingData && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-[#64748B]">ઝુંબેશ પ્રગતિ દર</span>
                <span className="text-[#135D43] font-mono">{pendingData.completion_percentage}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#135D43] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, pendingData.completion_percentage)}%` }}
                />
              </div>
            </div>
          )}

          {/* Village Work Completion & Verification Status Bar */}
          {pendingData && (
            <div className="pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#64748B]">કામગીરી સ્થિતિ:</span>
                  {verificationData?.status === 'VERIFIED_COMPLETED' ? (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      પૂર્ણ અને પ્રમાણિત (મંજૂર)
                    </span>
                  ) : verificationData?.status === 'SUBMITTED_FOR_VERIFICATION' ? (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      ચકાસણી માટે મોકલેલ (પેન્ડિંગ)
                    </span>
                  ) : verificationData?.status === 'REJECTED' ? (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                      સુધારણા જરૂરી
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {pendingData.total_vaccinated > 0 ? 'કામગીરી ચાલુ છે (In Progress)' : 'સોંપાયેલ (Assigned)'}
                    </span>
                  )}
                </div>
                {verificationData?.rejection_reason && verificationData?.status === 'REJECTED' && (
                  <p className="text-[11px] text-red-700 font-medium">
                    કારણ: {verificationData.rejection_reason}
                  </p>
                )}
                {verificationData?.status === 'VERIFIED_COMPLETED' && verificationData?.verified_at && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    પ્રમાણિત તારીખ: {new Date(verificationData.verified_at).toLocaleDateString('gu-IN')} {verificationData.verification_notes ? `• ${verificationData.verification_notes}` : ''}
                  </p>
                )}
              </div>

              <Button
                size="sm"
                variant={verificationData?.status === 'SUBMITTED_FOR_VERIFICATION' ? 'outline' : 'primary'}
                onClick={() => {
                  setVerifVisitedCount(pendingData.total_vaccinated || 0);
                  setVerifNotes(verificationData?.completion_notes || '');
                  setVerifPhotos((verificationData?.evidence_photo_urls || []).join('\n'));
                  setIsSubmitVerifModalOpen(true);
                }}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                {verificationData?.status === 'SUBMITTED_FOR_VERIFICATION'
                  ? 'સબમિશન વિગત જુઓ / અપડેટ કરો'
                  : verificationData?.status === 'VERIFIED_COMPLETED'
                  ? 'પ્રમાણિત વિગતો જુઓ'
                  : 'પૂર્ણતા ચકાસણી માટે મોકલો'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      {pendingData && (
        <div className="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Filter Pills */}
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setFilterMode('PENDING_ONLY')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'PENDING_ONLY'
                  ? 'bg-white text-[#135D43] shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              માત્ર બાકી પશુપાલકો ({pendingData.farmers.filter((f) => f.remaining_count > 0).length})
            </button>
            <button
              onClick={() => setFilterMode('ALL')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-white text-[#135D43] shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              બધા પશુપાલકો ({pendingData.farmers.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ખેડૂત, મોબાઈલ અથવા ટેગ શોધો..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-[#135D43]"
            />
          </div>
        </div>
      )}

      {/* Farmers & Animals List */}
      {isLoading ? (
        <StateView state="loading" message="બાકી રસીકરણ યાદી લાવી રહ્યા છીએ..." />
      ) : !selectedCampaignId ? (
        <StateView
          state="empty"
          title="કોઈ ઝુંબેશ પસંદ કરેલ નથી"
          message="બાકી રસીકરણ જોવા માટે કૃપા કરીને ઉપરની યાદીમાંથી સક્રિય ઝુંબેશ પસંદ કરો."
        />
      ) : filteredFarmers.length === 0 ? (
        <Card noPadding className="p-8 text-center bg-white">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#1E293B]">
            {filterMode === 'PENDING_ONLY'
              ? 'અભિનંદન! આ ઝુંબેશ હેઠળ કોઈ બાકી પશુ નથી.'
              : 'કોઈ પરિણામ મળ્યું નથી.'}
          </h3>
          <p className="text-xs text-[#64748B] mt-1">
            {filterMode === 'PENDING_ONLY'
              ? 'તમારા કાર્યક્ષેત્રના તમામ પાત્ર પશુઓનું રસીકરણ પૂર્ણ થયેલ છે.'
              : 'શોધ પરિણામ મુજબ કોઈ પશુપાલક મળ્યા નથી.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFarmers.map((farmer) => {
            const isExpanded = expandedFarmers[farmer.farmer_id];
            const isCompleted = farmer.remaining_count === 0;

            return (
              <Card
                key={farmer.farmer_id}
                noPadding
                className={`overflow-hidden border transition-all ${
                  isCompleted ? 'border-gray-200 bg-gray-50/40' : 'border-emerald-200 bg-white shadow-xs'
                }`}
              >
                {/* Farmer Header */}
                <div
                  onClick={() => toggleFarmer(farmer.farmer_id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl text-white ${
                        isCompleted ? 'bg-gray-400' : 'bg-[#135D43]'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-[#1E293B]">{farmer.farmer_name}</h4>
                        {farmer.farmer_code && (
                          <span className="text-[10px] font-mono text-[#64748B]">
                            ({farmer.farmer_code})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                        {farmer.mobile_e164 && <span>મોબાઇલ: {farmer.mobile_e164}</span>}
                        <span>• કુલ પશુઓ: {farmer.eligible_count}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        સંપૂર્ણ ({farmer.vaccinated_count})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3 text-amber-600" />
                        {farmer.remaining_count} બાકી
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#64748B]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#64748B]" />
                    )}
                  </div>
                </div>

                {/* Animals Drawer */}
                {isExpanded && (
                  <div className="border-t border-[#E2E8F0] p-3 space-y-2 bg-gray-50/50">
                    <p className="text-[11px] font-semibold text-[#64748B]">
                      પાત્ર પશુઓની યાદી ({farmer.animals.length}):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {farmer.animals.map((anim) => (
                        <div
                          key={`${anim.animal_id}-${anim.programme_code}`}
                          className={`p-2.5 rounded-xl border text-xs bg-white flex flex-col justify-between gap-2 ${
                            anim.is_vaccinated ? 'border-gray-200' : 'border-amber-200 shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#1E293B] font-mono">
                                {anim.animal_code}
                              </span>
                              <span className="text-[10px] font-semibold text-[#64748B]">
                                {SPECIES_NAMES_GU[anim.species_code] || anim.species_code} • {anim.sex === 'F' ? 'માદા' : 'નર'}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#64748B] mt-1 space-y-0.5">
                              {anim.tag_number && (
                                <p className="font-mono text-[#1E293B]">ટેગ: {anim.tag_number}</p>
                              )}
                              <p>
                                કાર્યક્રમ: <strong className="text-emerald-800">{anim.programme_code}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
                            {anim.is_vaccinated ? (
                              <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>રસીકરણ પૂર્ણ ({anim.vaccinated_date})</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>રસીકરણ બાકી</span>
                              </span>
                            )}

                            {!anim.is_vaccinated && isVaccinator && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenVaccinate(anim, farmer)}
                                leftIcon={<HeartPulse className="w-3 h-3" />}
                              >
                                રસી આપો
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Vaccinate Modal */}
      <Modal
        isOpen={isVaxModalOpen}
        onClose={() => setIsVaxModalOpen(false)}
        title="ત્વરિત રસીકરણ નોંધણી"
      >
        {targetAnimal && targetFarmer && (
          <form onSubmit={handleSubmitVaccination} className="space-y-4 text-xs">
            {/* Animal & Farmer Summary */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#64748B]">પશુ કોડ:</span>
                <span className="font-bold text-[#1E293B] font-mono">{targetAnimal.animal_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">પશુપાલક:</span>
                <span className="font-semibold text-[#1E293B]">{targetFarmer.farmer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">કાર્યક્રમ:</span>
                <span className="font-bold text-emerald-800">{targetAnimal.programme_code}</span>
              </div>
            </div>

            {/* Camp selector (if camp active) */}
            <FormField label="પશુ આરોગ્ય કેમ્પ (વૈકલ્પિક)">
              <select
                value={selectedCampId}
                onChange={(e) => setSelectedCampId(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              >
                <option value="">-- કેમ્પ સિવાય / ઘેર-ઘેર (ડોરસ્ટેપ) --</option>
                {villageCamps.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.camp_code} ({cp.planned_start.substring(0, 10)})
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="રસીકરણ તારીખ" required>
                <input
                  type="date"
                  value={vaxDate}
                  onChange={(e) => setVaxDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg"
                  required
                />
              </FormField>

              <FormField label="રસી બેચ નંબર (વૈકલ્પિક)">
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="દા.ત. BATCH-2026-04"
                  className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                />
              </FormField>
            </div>

            <FormField label="વિશેષ નોંધ (વૈકલ્પિક)">
              <input
                type="text"
                value={vaxRemarks}
                onChange={(e) => setVaxRemarks(e.target.value)}
                placeholder="અન્ય કોઈ નોંધ..."
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setIsVaxModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" type="submit" isLoading={isSubmittingVax}>
                રસીકરણ સાચવો અને યાદી તાજી કરો
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Submit for Verification Modal */}
      <Modal
        isOpen={isSubmitVerifModalOpen}
        onClose={() => setIsSubmitVerifModalOpen(false)}
        title="ગામ રસીકરણ કામગીરી પૂર્ણતા ચકાસણી માટે મોકલો"
      >
        <form onSubmit={handleSubmitVerification} className="space-y-4 font-body">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-[#135D43]" />
              ઝુંબેશ ક્ષેત્રીય કામગીરી પ્રમાણીકરણ
            </p>
            <p className="text-[11px] text-emerald-800">
              આ ફોર્મ સબમિટ કરવાથી સંબંધિત તાલુકા પશુપાલન અધિકારી (TAHO) અને DAHO ને સૂચના મળશે અને તેઓ તમારા કામનું મૂલ્યાંકન કરી સત્તાવાર મંજૂરી આપશે.
            </p>
          </div>

          {/* Quick Progress Recap */}
          {pendingData && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-gray-50 border">
                <span className="text-[10px] text-gray-500 block">કુલ પાત્ર</span>
                <strong className="text-gray-800">{pendingData.total_eligible}</strong>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-[10px] text-emerald-700 block">રસીકરણ થયેલ</span>
                <strong className="text-emerald-800">{pendingData.total_vaccinated}</strong>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-[10px] text-amber-700 block">બાકી પશુઓ</span>
                <strong className="text-amber-800">{pendingData.total_remaining}</strong>
              </div>
            </div>
          )}

          {verificationData?.status === 'REJECTED' && verificationData.rejection_reason && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 space-y-1">
              <span className="font-bold flex items-center gap-1 text-red-800">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                અગાઉ પુનઃતપાસ માટે મોકલાયેલ (કારણ):
              </span>
              <p className="text-[11px] font-medium">{verificationData.rejection_reason}</p>
            </div>
          )}

          {verificationData?.status === 'VERIFIED_COMPLETED' && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <span className="font-bold flex items-center gap-1 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                આ ગામનું કામ પહેલેથી પ્રમાણિત થયેલ છે
              </span>
              <p className="text-[11px]">
                ચકાસણી કરનાર: {verificationData.verified_by_name || 'અધિકારી'} • નોંધ: {verificationData.verification_notes || 'મંજૂર'}
              </p>
            </div>
          )}

          <FormField label="મુલાકાત લીધેલ પશુઓની સંખ્યા" required>
            <input
              type="number"
              min={0}
              value={verifVisitedCount}
              onChange={(e) => setVerifVisitedCount(parseInt(e.target.value) || 0)}
              disabled={verificationData?.status === 'VERIFIED_COMPLETED'}
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
              required
            />
          </FormField>

          <FormField label="ક્ષેત્રીય અવલોકન અને પૂર્ણતા નોંધ (Field Observations & Completion Notes)">
            <textarea
              rows={3}
              value={verifNotes}
              onChange={(e) => setVerifNotes(e.target.value)}
              disabled={verificationData?.status === 'VERIFIED_COMPLETED'}
              placeholder="દા.ત. ગામના તમામ પશુપાલકોના ઢોરની મુલાકાત લીધી, ૯૫% રસીકરણ લક્ષ્યાંક સિદ્ધ, બીમાર પશુઓની અલગ યાદી બનાવી..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <FormField label="પુરાવા ફોટા લિંક / Evidence Photo URLs (પ્રતિ લાઇન એક URL)">
            <textarea
              rows={2}
              value={verifPhotos}
              onChange={(e) => setVerifPhotos(e.target.value)}
              disabled={verificationData?.status === 'VERIFIED_COMPLETED'}
              placeholder="https://example.com/field-photo-1.jpg&#10;https://example.com/field-photo-2.jpg"
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono text-[11px]"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" type="button" onClick={() => setIsSubmitVerifModalOpen(false)}>
              બંધ કરો
            </Button>
            {verificationData?.status !== 'VERIFIED_COMPLETED' && (
              <Button variant="primary" type="submit" isLoading={isSubmittingVerif}>
                {verificationData?.status === 'SUBMITTED_FOR_VERIFICATION' ? 'અપડેટ કરો' : 'ચકાસણી માટે મોકલો'}
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};

