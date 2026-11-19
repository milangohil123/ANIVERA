import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { networkSyncManager } from '../../services/networkSyncManager';
import { voService, type VODiseaseReport, type VOCamp, type VOCampaignVillageAssignment, type VOVaccination } from '../../services/voService';
import {
  dutyService,
  type ComplaintGroupResponse,
  type GroupRecommendationsResponse,
  type LiveFieldWorkerItem,
} from '../../services/dutyService';
import {
  Activity,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  MapPin,
  CheckCircle2,
  QrCode,
  FileSpreadsheet,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Filter,
  Check,
  Syringe,
  PawPrint,
  Clock,
  ChevronRight,
  UserCheck,
  Sparkles,
  Plus,
  X,
  Megaphone,
  UserPlus,
} from 'lucide-react';

const localizeCampaignName = (name?: string | null): string => {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.includes('foot & mouth') || lower.includes('fmd saturation') || lower.includes('saturation drive')) {
    return 'ખરવા-મોવાસા (FMD) સંપૂર્ણ રસીકરણ ઝુંબેશ';
  }
  if (lower.includes('hemorrhagic') || lower.includes('hs ring') || lower.includes('hs drive')) {
    return 'ગળસૂંઠો (HS) રિંગ રસીકરણ ઝુંબેશ';
  }
  if (lower.includes('black quarter') || lower.includes('bq pre-monsoon') || lower.includes('bq drive')) {
    return 'ગાઠીયો તાવ (BQ) ચોમાસા પૂર્વે રસીકરણ ઝુંબેશ';
  }
  if (lower.includes('brucella') || lower.includes('brucellosis')) {
    return 'બ્રુસેલોસિસ (Brucellosis) વાછરડી રસીકરણ ઝુંબેશ';
  }
  return name;
};

interface AnimalItem {
  id: string;
  village_id: string;
  species_code: string;
  breed_id?: string | null;
  gender: string;
  status: string;
  external_tag?: string | null;
  created_at: string;
}

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય',
  BUFFALO: 'ભેંસ',
  GOAT: 'બકરી',
  SHEEP: 'ઘેટું',
  OTHER: 'અન્ય',
};

export const VoDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [pendingReports, setPendingReports] = useState<VODiseaseReport[]>([]);
  const [camps, setCamps] = useState<VOCamp[]>([]);
  const [assignedVillageDetails, setAssignedVillageDetails] = useState<Array<{ id: string; name_gu: string; name_en: string; code: string }>>([]);
  const [pendingCampaignCount, setPendingCampaignCount] = useState<number>(0);
  const [firstPendingCampaign, setFirstPendingCampaign] = useState<{ id: string; name: string; village: string } | null>(null);
  const [voCampaigns, setVoCampaigns] = useState<VOCampaignVillageAssignment[]>([]);
  const [assignedAnimalsCount, setAssignedAnimalsCount] = useState<number>(0);
  const [vaccinationsCount, setVaccinationsCount] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [recentVaccinations, setRecentVaccinations] = useState<VOVaccination[]>([]);
  const [animalsList, setAnimalsList] = useState<AnimalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Smart Complaint Grouping & Assignment States
  const [complaintGroups, setComplaintGroups] = useState<ComplaintGroupResponse[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isGeneratingGroups, setIsGeneratingGroups] = useState(false);
  const [groupRecommendations, setGroupRecommendations] = useState<Record<string, GroupRecommendationsResponse>>({});
  const [loadingRecs, setLoadingRecs] = useState<Record<string, boolean>>({});
  const [liveFws, setLiveFws] = useState<LiveFieldWorkerItem[]>([]);

  // Manual Assign Modal
  const [manualAssignModal, setManualAssignModal] = useState<{
    isOpen: boolean;
    groupId: string;
    groupCode: string;
  }>({
    isOpen: false,
    groupId: '',
    groupCode: '',
  });
  const [manualFwId, setManualFwId] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // New Complaint Registration Modal
  const [isCreateComplaintOpen, setIsCreateComplaintOpen] = useState(false);
  const [newComplaint, setNewComplaint] = useState<{
    requester_name: string;
    contact_number: string;
    village_id: string;
    problem_text: string;
    priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  }>({
    requester_name: '',
    contact_number: '',
    village_id: '',
    problem_text: '',
    priority: 'NORMAL',
  });
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);

  // Load Complaint Groups
  const loadComplaintGroups = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingGroups(true);
    try {
      const [groups, fwData] = await Promise.all([
        dutyService.listComplaintGroups(apiBaseUrl).catch(() => []),
        dutyService.getVoLiveFieldWorkers(apiBaseUrl).catch(() => ({
          total_field_workers: 0,
          active_on_duty: 0,
          fresh_location_count: 0,
          stale_location_count: 0,
          field_workers: [],
        })),
      ]);
      setComplaintGroups(groups);
      setLiveFws(fwData.field_workers || []);

      // Batch load recommendations for pending groups without triggering individual cascading re-renders
      const pendingGroups = groups.filter((g) => g.status === 'PENDING_ASSIGNMENT');
      if (pendingGroups.length > 0) {
        setLoadingRecs((prev) => {
          const next = { ...prev };
          pendingGroups.forEach((g) => { next[g.id] = true; });
          return next;
        });
        Promise.all(
          pendingGroups.map(async (g) => {
            try {
              const recs = await dutyService.getGroupRecommendations(apiBaseUrl, g.id);
              return { groupId: g.id, recs };
            } catch {
              return null;
            }
          })
        ).then((results) => {
          const recsMap: Record<string, GroupRecommendationsResponse> = {};
          results.forEach((r) => {
            if (r) recsMap[r.groupId] = r.recs;
          });
          setGroupRecommendations((prev) => ({ ...prev, ...recsMap }));
          setLoadingRecs((prev) => {
            const next = { ...prev };
            pendingGroups.forEach((g) => { next[g.id] = false; });
            return next;
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load complaint groups:', e);
    } finally {
      if (!isSilent) setIsLoadingGroups(false);
    }
  }, [apiBaseUrl]);

  // Generate Complaint Groups
  const handleGenerateGroups = async () => {
    setIsGeneratingGroups(true);
    try {
      await dutyService.generateComplaintGroups(apiBaseUrl);
      await loadComplaintGroups(false);
    } catch (e: any) {
      alert(e.message || 'સ્વચાલિત ફરિયાદ જૂથ બનાવવામાં નિષ્ફળ.');
    } finally {
      setIsGeneratingGroups(false);
    }
  };

  // Assign FW (Recommended or Manual)
  const handleAssignFw = async (groupId: string, fwId: string, reason?: string) => {
    setIsAssigning(true);
    try {
      const res = await dutyService.assignGroup(apiBaseUrl, groupId, fwId, reason);
      alert(res.message || 'ફરિયાદ જૂથ સફળતાપૂર્વક સોંપવામાં આવ્યું છે.');
      setManualAssignModal({ isOpen: false, groupId: '', groupCode: '' });
      setManualFwId('');
      setManualReason('');
      await loadComplaintGroups(true);
    } catch (e: any) {
      alert(e.message || 'સોંપણી કરવામાં નિષ્ફળ.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Create Help Request / Complaint
  const handleCreateComplaintSubmit = async () => {
    if (!newComplaint.requester_name.trim() || !newComplaint.village_id || !newComplaint.problem_text.trim()) {
      alert('કૃપા કરીને અરજદારનું નામ, ગામ અને સમસ્યાની વિગત ભરો.');
      return;
    }
    setIsSubmittingComplaint(true);
    try {
      const res = await dutyService.createHelpRequest(apiBaseUrl, {
        requester_name: newComplaint.requester_name.trim(),
        contact_number: newComplaint.contact_number.trim() || undefined,
        village_id: newComplaint.village_id,
        problem_text: newComplaint.problem_text.trim(),
        priority: newComplaint.priority,
      });
      alert(res.message || 'ફરિયાદ સફળતાપૂર્વક નોંધાઈ ગઈ છે.');
      setIsCreateComplaintOpen(false);
      setNewComplaint({
        requester_name: '',
        contact_number: '',
        village_id: '',
        problem_text: '',
        priority: 'NORMAL',
      });
      // Re-generate or reload groups
      await handleGenerateGroups();
    } catch (e: any) {
      alert(e.message || 'ફરિયાદ નોંધણીમાં ભૂલ આવી.');
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const [reportsData, campsData, , vaccsData, vilsData, myCampaigns, anmsData] = await Promise.all([
        voService.listReports(apiBaseUrl, { status: 'SUSPECTED', limit: 10 }).catch(() => []),
        voService.listCamps(apiBaseUrl).catch(() => []),
        voService.listTreatments(apiBaseUrl).catch(() => []),
        voService.listVaccinations(apiBaseUrl).catch(() => []),
        voService.listVillages(apiBaseUrl).catch(() => []),
        voService.listMyCampaignAssignments(apiBaseUrl).catch(() => []),
        fetch(`${apiBaseUrl}/api/v1/animals?limit=100`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authService.getSession()?.accessToken || ''}`,
          },
        }).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);
      setPendingReports(reportsData);
      setCamps(campsData);
      setVaccinationsCount(Array.isArray(vaccsData) ? vaccsData.length : 0);
      setRecentVaccinations(Array.isArray(vaccsData) ? vaccsData : []);
      setAssignedVillageDetails(vilsData);
      setVoCampaigns(myCampaigns);
      const realAnimals = Array.isArray(anmsData) ? anmsData : [];
      setAnimalsList(realAnimals);
      setAssignedAnimalsCount(realAnimals.length);

      const pendingCamps = myCampaigns.filter((c) => c.acceptance_status === 'PENDING_ACCEPTANCE');
      setPendingCampaignCount(pendingCamps.length);
      if (pendingCamps.length > 0) {
        setFirstPendingCampaign({
          id: pendingCamps[0].campaign_id,
          name: pendingCamps[0].campaign_name,
          village: pendingCamps[0].village_name_gu,
        });
      } else {
        setFirstPendingCampaign(null);
      }

      await loadComplaintGroups(isSilent);
    } catch (e) {
      console.warn('VO dashboard load failed:', e);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [apiBaseUrl, loadComplaintGroups]);

  // Periodic offline sync count update
  useEffect(() => {
    let isMounted = true;
    const fetchSyncCount = async () => {
      try {
        const counts = await networkSyncManager.getPendingCounts();
        if (isMounted) {
          setPendingSyncCount((counts.pendingEvents || 0) + (counts.pendingMedia || 0));
        }
      } catch {
        // ignore
      }
    };
    fetchSyncCount();
    const interval = setInterval(fetchSyncCount, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Initial data load on mount
    loadDashboardData(false);

    // 20-second live background polling for Field Worker GPS status and locations
    const pollInterval = setInterval(() => {
      dutyService
        .getVoLiveFieldWorkers(apiBaseUrl)
        .then((fwData) => {
          if (fwData && Array.isArray(fwData.field_workers)) {
            setLiveFws(fwData.field_workers);
          }
        })
        .catch(() => {});
    }, 20000);

    return () => clearInterval(pollInterval);
  }, [apiBaseUrl, loadDashboardData]);

  return (
    <div className="w-full space-y-4 animate-fade-in pb-12 font-body text-[#172033]">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER                                      */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        {/* Breadcrumb line */}
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>કામગીરી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>ઓવરવ્યૂ</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">
            બોટાદ ઝોન • {assignedVillageDetails.length > 0 ? `${assignedVillageDetails.length} ગામો (${assignedVillageDetails.map((v) => v.name_gu).join(', ')})` : 'ગામ ફાળવણી બાકી'}
          </span>
        </div>

        {/* Page Title & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              વેટરનરી અધિકારી ક્ષેત્રીય કામગીરી ડેશબોર્ડ
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>સક્રિય ક્ષેત્રીય ઝુંબેશ</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/vo/sync')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#135D43]" />
              <span>સ્થાનિક સિંક</span>
              {pendingSyncCount > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-50 text-red-600 border border-red-200">
                  {pendingSyncCount} બાકી
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-[#135D43] border border-emerald-200">
                  પૂર્ણ
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/vo/animals')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-600" />
              <span>QR સ્કેનર</span>
            </button>

            <button
              onClick={() => navigate('/vo/animals')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <span>+ પશુ નોંધણી</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. SANDBOX PILOT ALERT BANNER                                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                પાયલોટ પ્રોજેક્ટ અમલીકરણ
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                તબક્કો-૨ સક્રિય
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              {assignedVillageDetails.length > 0
                ? `${assignedVillageDetails.length} ગામો ફાળવેલ: ${assignedVillageDetails.map((v) => v.name_gu).join(', ')}`
                : 'હાલમાં કોઈ ગામ સોંપાયેલ નથી (DAHO સોંપણી બાકી)'}{' '}
              • {camps.length} કેમ્પ આયોજિત.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/vo/reports')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>રિપોર્ટ વિગતો જુઓ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2.1 PENDING CAMPAIGN ACCEPTANCE ALERT BANNER                            */}
      {/* ---------------------------------------------------------------------- */}
      {pendingCampaignCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-950 font-heading">
                  નવી રસીકરણ ઝુંબેશ સોંપણી — તમારી સ્વીકૃતિ બાકી ({pendingCampaignCount})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  તાકીદની કાર્યવાહી
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5 truncate">
                {localizeCampaignName(firstPendingCampaign?.name || '')} (ગામ: {firstPendingCampaign?.village}). ક્ષેત્રીય કામગીરી શરૂ કરવા માટે કૃપા કરીને ઝુંબેશ સ્વીકારો.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/vo/campaigns')}
            className="px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-bold hover:bg-[#0F4C37] shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto transition-colors"
          >
            <span>ઝુંબેશ સ્વીકારો</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 2.2 ZERO ASSIGNED VILLAGES ALERT                                       */}
      {/* ---------------------------------------------------------------------- */}
      {assignedVillageDetails.length === 0 && !isLoading && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-700">
          <MapPin className="w-5 h-5 text-slate-500 shrink-0" />
          <div>
            <strong className="text-slate-900 block font-bold">ગામ ફાળવણી બાકી છે</strong>
            <span className="text-slate-600">
              હાલમાં તમારા વેટરનરી એકાઉન્ટ સાથે કોઈ ગામ સોંપાયેલ નથી. જિલ્લા પશુપાલન અધિકારી (DAHO) સ્ટાફ પેનલમાંથી તમને ગામ ફાળવશે તે પછી તમામ પશુધન અને રસીકરણ યાદી અહીં દેખાશે.
            </span>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW                                              */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="સોંપાયેલ પશુધન"
          value={isLoading ? '...' : String(assignedAnimalsCount)}
          subtext={`${assignedVillageDetails.length} સોંપાયેલ ગામડાં`}
          icon={<PawPrint className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="primary"
          onClick={() => navigate('/vo/animals')}
        />

        <KpiCard
          label="પૂર્ણ થયેલ રસીકરણ"
          value={isLoading ? '...' : (assignedAnimalsCount > 0 ? `${((vaccinationsCount / assignedAnimalsCount) * 100).toFixed(1)}%` : '0%')}
          valueColor="text-[#176B5B]"
          subtext={`${vaccinationsCount} / ${assignedAnimalsCount} ડોઝ નોંધાયેલ`}
          icon={<Syringe className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="primary"
          onClick={() => navigate('/vo/vaccinations')}
        />

        <KpiCard
          label="બાકી / મુદત વીતેલ"
          value={isLoading ? '...' : String(Math.max(0, assignedAnimalsCount - vaccinationsCount))}
          valueColor="text-red-600"
          subtext="કતાર વિગત જુઓ →"
          badgeText={`${Math.max(0, assignedAnimalsCount - vaccinationsCount)} બાકી`}
          badgeVariant={Math.max(0, assignedAnimalsCount - vaccinationsCount) > 0 ? 'red' : 'slate'}
          icon={<Clock className="w-4 h-4 text-red-600" />}
          iconVariant="danger"
          onClick={() => navigate('/vo/vaccinations')}
        />

        <KpiCard
          label="રોગ સર્વેક્ષણ કેસ"
          value={isLoading ? '...' : String(pendingReports.length)}
          subtext={`${pendingReports.length} શંકાસ્પદ કેસ સમીક્ષા`}
          icon={<Activity className="w-4 h-4 text-[#0284C7]" />}
          iconVariant="secondary"
          onClick={() => navigate('/vo/surveillance-reviews')}
        />

        <KpiCard
          label="ઑફલાઇન સિંક સ્થિતિ"
          value={pendingSyncCount > 0 ? `${pendingSyncCount} બાકી` : '0 બાકી'}
          subtext={pendingSyncCount > 0 ? `${pendingSyncCount} રેકોર્ડ્સ બાકી` : 'ક્લાઉડ સિંક પૂર્ણ'}
          subtextIcon={<span className="w-1.5 h-1.5 rounded-full bg-[#176B5B] shrink-0" />}
          icon={<RefreshCw className="w-4 h-4 text-slate-700" />}
          iconVariant="neutral"
          onClick={() => navigate('/vo/sync')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. MAIN TWO-COLUMN DASHBOARD GRID (Exact Match Reference Image 2)       */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ================================================================== */}
        {/* LEFT COLUMN (8 Columns on Large Screens)                           */}
        {/* ================================================================== */}
        <div className="lg:col-span-8 space-y-4">
          {/* Card 0: Smart Complaint Grouping & Intelligent FW Assignment */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#176B5B] flex items-center justify-center border border-teal-200 shadow-2xs">
                  <Sparkles className="w-5 h-5 text-[#176B5B]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                      સ્વચાલિત ફરિયાદ જૂથ અને સ્માર્ટ ફિલ્ડ વર્કર સોંપણી
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      હાવરસાઇન અલ્ગોરિધમ
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    નજીકના ગામડાઓની ફરિયાદોનું ક્લસ્ટરિંગ (≤ ૨૦ કિમી) અને લાઈવ લોકેશન આધારિત શ્રેષ્ઠ FW ભલામણ
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsCreateComplaintOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#176B5B]" />
                  <span>+ નવી ફરિયાદ</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateGroups}
                  disabled={isGeneratingGroups}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#176B5B] text-white text-xs font-bold hover:bg-[#164E45] shadow-xs transition-colors disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingGroups ? 'animate-spin' : ''}`} />
                  <span>સ્વચાલિત જૂથ બનાવો</span>
                </button>
              </div>
            </div>

            {/* Groups List */}
            {isLoadingGroups ? (
              <div className="text-center py-8 text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#176B5B]" />
                <span>ફરિયાદ જૂથો અને ભલામણો લોડ થઈ રહી છે...</span>
              </div>
            ) : complaintGroups.length === 0 ? (
              <div className="text-center py-7 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-800">હાલમાં કોઈ પેન્ડિંગ ફરિયાદ જૂથ નથી</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto">
                  અરજીઓ આપમેળે ક્લસ્ટર કરવા માટે ઉપર આપેલ 'સ્વચાલિત જૂથ બનાવો' બટન પર ક્લિક કરો અથવા નવી ફરિયાદ ઉમેરો.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {complaintGroups.map((group) => {
                  const recData = groupRecommendations[group.id];
                  const isLoadingThisRec = loadingRecs[group.id];
                  const isPending = group.status === 'PENDING_ASSIGNMENT';
                  const isAssigned = group.status === 'ASSIGNED';
                  const isInProgress = group.status === 'IN_PROGRESS';
                  const isCompleted = group.status === 'COMPLETED';

                  return (
                    <div
                      key={group.id}
                      className="rounded-xl border border-slate-200 bg-[#FCFDFD] p-4 space-y-3 shadow-2xs hover:border-teal-300 transition-colors"
                    >
                      {/* Group Header Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            #{group.group_code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              group.priority === 'CRITICAL'
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : group.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-sky-100 text-sky-800 border border-sky-200'
                            }`}
                          >
                            {group.priority === 'CRITICAL' ? 'અતિ તાકીદનું' : group.priority === 'HIGH' ? 'ઉચ્ચ અગ્રતા' : 'સામાન્ય'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : isInProgress
                                ? 'bg-teal-100 text-teal-800'
                                : isAssigned
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isCompleted
                              ? '✓ પૂર્ણ'
                              : isInProgress
                              ? 'પ્રગતિ હેઠળ'
                              : isAssigned
                              ? 'સોંપાયેલ'
                              : 'સોંપણી બાકી'}
                          </span>
                        </div>

                        <div className="text-right text-[11px] text-slate-500 font-mono">
                          {group.total_complaints} ફરિયાદો ({group.villages_count} ગામ)
                        </div>
                      </div>

                      {/* Route & Village Sequence */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-xs flex items-center gap-2 flex-wrap text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-[#176B5B] shrink-0" />
                        <span className="font-semibold text-slate-900">મુલાકાત ક્રમ:</span>
                        <span className="font-medium text-[#176B5B]">
                          {group.villages_summary_gu && group.villages_summary_gu.length > 0
                            ? group.villages_summary_gu.join(' ➔ ')
                            : 'સ્થાનિક ગામડાઓ'}
                        </span>
                        {group.centroid_latitude && group.centroid_longitude && (
                          <span className="text-slate-400 font-mono text-[10px]">
                            (કેન્દ્ર: {group.centroid_latitude.toFixed(3)}, {group.centroid_longitude.toFixed(3)})
                          </span>
                        )}
                      </div>

                      {/* Complaints Preview */}
                      {group.items && group.items.length > 0 && (
                        <div className="space-y-1.5">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="p-2 rounded-lg bg-white border border-slate-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{item.requester_name || 'પશુપાલક'}</span>
                                <span className="text-slate-500 text-[11px]"> • ગામ: {item.village_name_gu}</span>
                                {item.contact_number && (
                                  <span className="text-slate-500 text-[11px] font-mono"> • {item.contact_number}</span>
                                )}
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  સમસ્યા: {item.problem_text || 'પશુ તપાસ વિનંતી'}
                                </p>
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 self-start sm:self-auto">
                                {item.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Intelligent Field Worker Recommendations */}
                      {isPending && (
                        <div className="pt-2 border-t border-slate-100 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                              <span>શ્રેષ્ઠ ભલામણ કરેલ ફિલ્ડ વર્કર્સ (Top Recommended FWs):</span>
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setManualAssignModal({
                                  isOpen: true,
                                  groupId: group.id,
                                  groupCode: group.group_code,
                                })
                              }
                              className="text-xs font-semibold text-[#176B5B] hover:underline"
                            >
                              અન્ય FW પસંદ કરો →
                            </button>
                          </div>

                          {isLoadingThisRec ? (
                            <div className="py-3 text-center text-xs text-slate-500">
                              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-teal-600" />
                              <span>હાવરસાઇન અંતર અને કાર્યભાર વિશ્લેષણ ચાલુ છે...</span>
                            </div>
                          ) : recData && recData.recommendations && recData.recommendations.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {recData.recommendations.map((rec) => (
                                <div
                                  key={rec.fw_user_id}
                                  className="p-3 rounded-xl border border-teal-200 bg-white hover:border-[#176B5B] hover:shadow-2xs transition-all space-y-2 flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-900">
                                        #{rec.rank} ભલામણ
                                      </span>
                                      <span className="text-xs font-bold font-mono text-[#176B5B]">
                                        {rec.distance_km} કિમી દૂર
                                      </span>
                                    </div>

                                    <h5 className="font-bold text-xs text-slate-900 mt-1">
                                      {rec.full_name}
                                    </h5>
                                    {rec.mobile_e164 && (
                                      <p className="text-[10px] text-slate-500 font-mono">
                                        {rec.mobile_e164}
                                      </p>
                                    )}

                                    {/* Reasoning Badge */}
                                    <div className="mt-1.5 p-1.5 rounded-lg bg-teal-50/70 border border-teal-100 text-[10px] text-teal-900 leading-tight">
                                      💡 {rec.recommendation_reason}
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-slate-500">
                                      કાર્યભાર: {rec.active_assignments_count} જૂથ
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAssignFw(group.id, rec.fw_user_id)}
                                      disabled={isAssigning}
                                      className="px-2.5 py-1 rounded-lg bg-[#176B5B] hover:bg-[#164E45] text-white text-[11px] font-bold shadow-2xs transition-colors"
                                    >
                                      આ FW ને સોંપો
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                              <span>૮૦ કિમી પરિઘમાં કોઈ સક્રિય કાર્યકર મળ્યો નથી.</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setManualAssignModal({
                                    isOpen: true,
                                    groupId: group.id,
                                    groupCode: group.group_code,
                                  })
                                }
                                className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 font-bold text-[11px]"
                              >
                                મેન્યુઅલ સોંપણી કરો
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* If Assigned */}
                      {(isAssigned || isInProgress || isCompleted) && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                            <span>
                              સોંપાયેલ ક્ષેત્રીય કાર્યકર: <strong className="text-slate-900">{group.assigned_fw_name || 'ક્ષેત્રીય કાર્યકર'}</strong>
                            </span>
                            {group.assigned_at && (
                              <span className="text-slate-400">
                                ({new Date(group.assigned_at).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </div>

                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() =>
                                setManualAssignModal({
                                  isOpen: true,
                                  groupId: group.id,
                                  groupCode: group.group_code,
                                })
                              }
                              className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                            >
                              કાર્યકર બદલો →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 1: Authorized Vaccination Campaigns for this Veterinary Officer */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#135D43] flex items-center justify-center border border-emerald-200">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                    અધિકૃત રસીકરણ ઝુંબેશ (Authorized Campaigns)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    તમારા અધિકૃત ગામોમાં ચાલતી સક્રિય ઝુંબેશ, સ્વીકૃતિ અને ક્ષેત્રીય કાર્યકર નિયુક્તિ
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#135D43] border border-emerald-300">
                  {voCampaigns.length} ઝુંબેશ સોંપાયેલ
                </span>
                <button
                  type="button"
                  onClick={() => loadDashboardData(false)}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  title="તાજું કરો"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#135D43]' : ''}`} />
                </button>
              </div>
            </div>

            {voCampaigns.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                <Megaphone className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-700">હાલમાં કોઈ સક્રિય રસીકરણ ઝુંબેશ નથી</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto">
                  જિલ્લા પશુપાલન અધિકારી (DAHO) દ્વારા ઝુંબેશ શરૂ કરવામાં આવશે ત્યારે તેની સૂચના અને લક્ષ્યાંક અહીં આપમેળે દર્શાવવામાં આવશે.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {voCampaigns.map((camp) => {
                  const compPct =
                    camp.eligible_animals_count > 0
                      ? Math.round((camp.vaccinated_animals_count / camp.eligible_animals_count) * 100)
                      : 0;

                  const isPending = camp.acceptance_status === 'PENDING_ACCEPTANCE';
                  const isAccepted = camp.acceptance_status === 'ACCEPTED';
                  const isRejected = camp.acceptance_status === 'REJECTED';

                  return (
                    <div
                      key={`${camp.campaign_id}-${camp.village_id}`}
                      className="rounded-xl border border-slate-200 bg-[#FCFDFD] p-3.5 sm:p-4 space-y-3.5 shadow-2xs hover:border-[#135D43]/40 transition-colors"
                    >
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#0F172A] font-heading">
                              {localizeCampaignName(camp.campaign_name)}
                            </span>
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {camp.campaign_code}
                            </span>
                            {camp.disease_code && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                રોગ: {camp.disease_code}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isAccepted
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : isRejected
                                  ? 'bg-red-100 text-red-800 border border-red-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {isAccepted ? '✓ સ્વીકૃત' : isRejected ? '✕ અસ્વીકૃત' : '⏳ સ્વીકૃતિ બાકી'}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            ગામ: <strong className="text-slate-800">{camp.village_name_gu || camp.village_name_en}</strong> ({camp.village_code}) {camp.taluka_name ? `• તાલુકો: ${camp.taluka_name}` : ''}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate('/vo/campaigns')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs shrink-0 self-start sm:self-auto transition-colors cursor-pointer ${
                            isPending ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#135D43] hover:bg-[#0F4C37]'
                          }`}
                        >
                          {isPending ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ઝુંબેશ સ્વીકારો</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>કાર્યકર સોંપો / સંચાલન</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* 3 Metric Stat Boxes */}
                      <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                        <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100">
                          <span className="text-[11px] text-blue-700 font-medium block">પાત્ર પશુઓ</span>
                          <strong className="text-blue-900 font-mono text-sm">{camp.eligible_animals_count}</strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                          <span className="text-[11px] text-emerald-700 font-medium block">રસીકરણ થયેલ</span>
                          <strong className="text-emerald-900 font-mono text-sm">{camp.vaccinated_animals_count}</strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-100">
                          <span className="text-[11px] text-amber-700 font-medium block">બાકી પશુઓ</span>
                          <strong className="text-amber-900 font-mono text-sm">{camp.pending_animals_count}</strong>
                        </div>
                      </div>

                      {/* Stepped Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-[#0F172A] mb-1.5">
                          <span className="text-slate-600">રસીકરણ પૂર્ણતા દર</span>
                          <span className="font-mono text-[#135D43] font-bold">{compPct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#135D43] rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, compPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Assigned Field Workers & Dates */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#64748B] flex-wrap gap-2">
                        <span>
                          સમયગાળો: <strong>{camp.start_date || '-'}</strong> થી <strong>{camp.end_date || '-'}</strong>
                        </span>
                        {camp.assigned_fws && camp.assigned_fws.length > 0 ? (
                          <span>
                            સોંપાયેલ FW: <strong>{camp.assigned_fws.map((f) => f.full_name).join(', ')}</strong>
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">
                            કોઈ ક્ષેત્રીય કાર્યકર સોંપાયેલ નથી
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 2: Urgent Veterinary Tasks & Vaccination Queue Table */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#0F172A] font-heading">
                  તાકીદના પશુચિકિત્સા કાર્યો અને રસીકરણ કતાર
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#135D43]">
                  {animalsList.length} નોંધાયેલ પશુઓ
                </span>
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ટેગ અથવા ID શોધો..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#135D43] focus:outline-none w-44 sm:w-56"
                  />
                </div>
                <button className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50">
                  <Filter className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#64748B]">
              અધિકૃત ગામોમાં નોંધાયેલ પશુઓની આરોગ્ય અને રસીકરણ કતાર:
            </p>

            {/* Real Animal Table */}
            {animalsList.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-800">હાલમાં કોઈ બાકી રસીકરણ કતાર નથી</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto">
                  અધિકૃત ગામોમાં નોંધાયેલ તમામ પશુઓની સ્થિતિ અદ્યતન છે અથવા હજુ સુધી પશુ નોંધણી થયેલ નથી.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                      <th className="py-2.5 px-3">પશુ ટેગ / ઓળખ આઈડી</th>
                      <th className="py-2.5 px-3">ગામ</th>
                      <th className="py-2.5 px-3">જાતિ અને વર્ગીકરણ</th>
                      <th className="py-2.5 px-3">સ્થિતિ</th>
                      <th className="py-2.5 px-3 text-right">કાર્યવાહી</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {animalsList
                      .filter((a) => {
                        if (!searchQuery.trim()) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          a.id.toLowerCase().includes(q) ||
                          (a.external_tag && a.external_tag.toLowerCase().includes(q)) ||
                          (a.species_code && a.species_code.toLowerCase().includes(q))
                        );
                      })
                      .slice(0, 5)
                      .map((animal) => {
                        const village = assignedVillageDetails.find((v) => v.id === animal.village_id);
                        return (
                          <tr key={animal.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="border-l-2 border-[#135D43] pl-2">
                                <span className="font-mono font-bold text-slate-900 block text-xs">
                                  {animal.external_tag || animal.id.slice(0, 13)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  UUID: {animal.id.slice(0, 8)}...
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-900 block">
                                {village?.name_gu || village?.name_en || 'અધિકૃત ગામ'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">{village?.code || '-'}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-900 block">
                                {SPECIES_NAMES_GU[animal.species_code] || animal.species_code}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {animal.gender === 'FEMALE' ? 'માદા' : 'નર'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#135D43] border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
                                <span>{animal.status || 'સક્રિય'}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => navigate('/vo/vaccinations')}
                                className="px-2.5 py-1 rounded bg-[#135D43] text-white font-semibold text-[11px] hover:bg-[#0F4C37] shadow-xs"
                              >
                                રસી નોંધો
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer Links */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
              <span>કુલ {animalsList.length} પશુઓ નોંધાયેલ છે</span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/vo/animals')}
                  className="font-semibold text-[#135D43] hover:underline"
                >
                  તમામ {animalsList.length} રેકોર્ડ્સ જુઓ →
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Recent Field Verification & Inoculation Log (Audit Ledger) */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] font-heading">
                  તાજેતરની ક્ષેત્રીય ચકાસણી અને રસીકરણ ઓડિટ લોગ
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  બોટાદ બ્લોકમાં અધિકૃત પશુધન નિરીક્ષકો દ્વારા નોંધાયેલ તાજેતરની કામગીરી
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadDashboardData(false)}
                className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#135D43] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ઓડિટ તાજું કરો</span>
              </button>
            </div>

            {recentVaccinations.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5 opacity-80" />
                <p className="text-xs font-bold text-slate-700">હાલમાં કોઈ તાજેતરની ક્ષેત્રીય ચકાસણી કે રસીકરણ લોગ નથી</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto">
                  ક્ષેત્રીય કાર્યકરો દ્વારા રસીકરણ કે ચકાસણી પૂર્ણ કરવામાં આવશે ત્યારે ઓડિટ લોગ અહીં આપમેળે દેખાશે.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {recentVaccinations.slice(0, 5).map((v) => (
                  <div key={v.event_id} className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/80 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#135D43] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-[#135D43]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-bold text-slate-900">{v.programme_code || 'નિયમિત રસીકરણ'}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          {v.batch_number ? `બેચ: ${v.batch_number}` : `ID: ${v.event_id.slice(0, 8)}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        સંચાલક: {v.administered_by_name || 'અધિકૃત કાર્યકર'} • સમીક્ષા: {v.review_status || 'ચકાસાયેલ'}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                        પશુ ID: {v.animal_id} • તારીખ: {new Date(v.event_date || v.received_at).toLocaleDateString('gu-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================== */}
        {/* RIGHT COLUMN (4 Columns on Large Screens)                          */}
        {/* ================================================================== */}
        <div className="lg:col-span-4 space-y-4">
          {/* Section 1: Quick Field Actions */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h3 className="text-xs font-bold text-[#0F172A] font-heading">
                ત્વરિત ક્ષેત્રીય કામગીરી
              </h3>
              <span className="text-[10px] text-[#64748B]">ડેસ્કટોપ અને મોબાઇલ</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigate('/vo/animals')}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#135D43]/50 hover:bg-emerald-50/40 text-left transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <QrCode className="w-5 h-5 text-[#135D43]" />
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#135D43] transition-colors" />
                </div>
                <span className="font-bold text-xs text-slate-900 block font-heading">કાનનો ટેગ સ્કેન કરો</span>
                <span className="text-[10px] text-[#64748B]">ત્વરિત પશુ ઓળખ</span>
              </button>

              <button
                onClick={() => navigate('/vo/vaccinations')}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#135D43]/50 hover:bg-emerald-50/40 text-left transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#0284C7]" />
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0284C7] transition-colors" />
                </div>
                <span className="font-bold text-xs text-slate-900 block font-heading">સામૂહિક ડેટા (CSV)</span>
                <span className="text-[10px] text-[#64748B]">કેમ્પ બેચ એન્ટ્રી</span>
              </button>

              <button
                onClick={() => navigate('/vo/animals')}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#135D43]/50 hover:bg-emerald-50/40 text-left transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <Printer className="w-5 h-5 text-teal-700" />
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 transition-colors" />
                </div>
                <span className="font-bold text-xs text-slate-900 block font-heading">ટેગ લેબલ પ્રિન્ટ</span>
                <span className="text-[10px] text-[#64748B]">મોબાઇલ પ્રિન્ટર</span>
              </button>

              <button
                onClick={() => navigate('/vo/surveillance-reviews')}
                className="p-3 rounded-xl bg-red-50/50 border border-red-200 hover:border-red-400 text-left transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <ArrowRight className="w-3.5 h-3.5 text-red-400 group-hover:text-red-600 transition-colors" />
                </div>
                <span className="font-bold text-xs text-red-700 block font-heading">રોગચાળો ચેતવણી</span>
                <span className="text-[10px] text-red-500">તાકીદનો રિપોર્ટ</span>
              </button>
            </div>
          </div>

          {/* Section 2: Surveillance & Outbreak Triage */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <h3 className="text-xs font-bold text-[#0F172A] font-heading">
                  રોગચાળો દેખરેખ અને તાકીદની ચેતવણી
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {pendingReports.length} કેસ
              </span>
            </div>

            {pendingReports.length === 0 ? (
              <div className="p-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5 opacity-80" />
                <p className="text-xs font-bold text-slate-800">હાલમાં કોઈ સક્રિય રોગચાળો ચેતવણી નથી</p>
                <p className="text-[11px] text-slate-500 mt-0.5">નવી શંકાસ્પદ કેસ નોંધણી થતાં અહીં આપમેળે એલર્ટ આવશે.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingReports.slice(0, 3).map((r) => (
                  <div key={r.report_id} className="p-3 rounded-xl bg-red-50/40 border border-red-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-red-600 uppercase">શંકાસ્પદ • {r.status}</span>
                      <span className="text-[10px] text-slate-500">{new Date(r.report_date || r.received_at).toLocaleDateString('gu-IN')}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{r.disease_code} રોગ અહેવાલ</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {r.observation_text || (r.symptoms && r.symptoms.length > 0 ? `લક્ષણો: ${r.symptoms.join(', ')}` : 'પશુ તપાસ જરૂરી')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">અહેવાલકર્તા: {r.reported_by}</span>
                      <button
                        onClick={() => navigate('/vo/surveillance-reviews')}
                        className="px-2.5 py-1 rounded bg-[#135D43] text-white font-semibold text-[10px] hover:bg-[#0F4C37]"
                      >
                        સમીક્ષા કરો
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mini Spatial Cluster View with GIS Button */}
            <div
              onClick={() => navigate('/vo/maps')}
              className="relative rounded-xl overflow-hidden border border-slate-200 cursor-pointer group shadow-2xs"
            >
              <div className="h-24 bg-gradient-to-r from-emerald-100 via-teal-50 to-sky-100 flex items-center justify-center p-3 text-center">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-800 text-[11px] font-bold shadow-xs">
                    <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                    <span>બોટાદ જિલ્લો જીઓ-નકશો</span>
                  </div>
                  <p className="text-[10px] text-[#135D43] font-semibold">
                    રોગચાળો ક્લસ્ટર નકશો ↗
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Local Sync & Storage */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#135D43]" />
                <h3 className="text-xs font-bold text-[#0F172A] font-heading">
                  સ્થાનિક સિંક અને સ્ટોરેજ સ્થિતિ
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#135D43]">
                ઑફલાઇન સક્ષમ
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-[#64748B]">સ્થાનિક ડેટાબેઝ:</span>
                <strong className="text-slate-900 font-mono">{assignedAnimalsCount} પશુઓ ઉપલબ્ધ</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-[#64748B]">સિંક બાકી રેકોર્ડ્સ:</span>
                <strong className={`font-mono font-bold ${pendingSyncCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {pendingSyncCount} રેકોર્ડ્સ
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-[#64748B]">ક્લાઉડ સિંક સ્થિતિ:</span>
                <span className="text-slate-800 font-medium">
                  {pendingSyncCount === 0 ? 'સંપૂર્ણ અપ-ટુ-ડેટ' : `${pendingSyncCount} બાકી`}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#64748B]">નેટવર્ક જોડાણ:</span>
                <span className="text-[#135D43] font-semibold">
                  {navigator.onLine ? 'ઓનલાઇન (નેટવર્ક સક્રિય)' : 'ઑફલાઇન મોડ'}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/vo/sync')}
              className="w-full py-2.5 rounded-lg bg-[#135D43] text-white text-xs font-bold hover:bg-[#0F4C37] shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>બાકી રહેલ રેકોર્ડ્સ અત્યારે સિંક કરો</span>
            </button>

            <p className="text-[10px] text-center text-[#64748B] pt-1">
              બોટાદ એન.આઈ.સી. ડેટા હબ સાથે એન્ડ-ટુ-એન્ડ સુરક્ષિત
            </p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 5. MANUAL FIELD WORKER ASSIGNMENT MODAL                                */}
      {/* ---------------------------------------------------------------------- */}
      {manualAssignModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#176B5B] flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    મેન્યુઅલ ફિલ્ડ વર્કર સોંપણી
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    જૂથ: #{manualAssignModal.groupCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualAssignModal({ isOpen: false, groupId: '', groupCode: '' })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  કાર્યકર પસંદ કરો (Select Field Worker):
                </label>
                <select
                  value={manualFwId}
                  onChange={(e) => setManualFwId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#176B5B]"
                >
                  <option value="">-- ફિલ્ડ વર્કર પસંદ કરો --</option>
                  {liveFws.map((fw) => (
                    <option key={fw.fw_user_id} value={fw.fw_user_id}>
                      {fw.full_name} ({fw.duty_status === 'ACTIVE' ? 'સક્રિય' : 'ડ્યૂટી બંધ'} • કાર્યભાર: {fw.active_assignments_count} જૂથ)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  મેન્યુઅલ સોંપણીનું કારણ (Reason):
                </label>
                <textarea
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  rows={3}
                  placeholder="દા.ત. ક્ષેત્રીય કાર્યકર તે ગામમાં પહેલેથી હાજર છે અથવા અતિ તાકીદની જરૂરિયાત છે."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#176B5B] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setManualAssignModal({ isOpen: false, groupId: '', groupCode: '' })}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                રદ કરો
              </button>
              <button
                type="button"
                disabled={!manualFwId || isAssigning}
                onClick={() => handleAssignFw(manualAssignModal.groupId, manualFwId, manualReason)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#176B5B] hover:bg-[#164E45] text-xs font-bold text-white shadow-xs disabled:opacity-50"
              >
                {isAssigning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>સોંપણી થઈ રહી છે...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>સોંપણી પુષ્ટિ કરો</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. CREATE COMPLAINT / HELP REQUEST MODAL                               */}
      {/* ---------------------------------------------------------------------- */}
      {isCreateComplaintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#176B5B] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    નવી પશુ ચિકિત્સા ફરિયાદ નોંધણી
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    પશુપાલકની તાકીદની સારવાર કે રોગચાળા બાબત સહાય વિનંતી
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateComplaintOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    અરજદાર / પશુપાલકનું નામ: *
                  </label>
                  <input
                    type="text"
                    value={newComplaint.requester_name}
                    onChange={(e) =>
                      setNewComplaint((prev) => ({ ...prev, requester_name: e.target.value }))
                    }
                    placeholder="દા.ત. રમેશભાઈ ડાભી"
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#176B5B]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    સંપર્ક મોબાઇલ નંબર:
                  </label>
                  <input
                    type="tel"
                    value={newComplaint.contact_number}
                    onChange={(e) =>
                      setNewComplaint((prev) => ({ ...prev, contact_number: e.target.value }))
                    }
                    placeholder="દા.ત. 9876543210"
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#176B5B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ગામ પસંદ કરો: *
                  </label>
                  <select
                    value={newComplaint.village_id}
                    onChange={(e) =>
                      setNewComplaint((prev) => ({ ...prev, village_id: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#176B5B]"
                  >
                    <option value="">-- ગામ પસંદ કરો --</option>
                    {assignedVillageDetails.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name_gu} ({v.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    અગ્રતા સ્થિતિ (Priority):
                  </label>
                  <select
                    value={newComplaint.priority}
                    onChange={(e) =>
                      setNewComplaint((prev) => ({
                        ...prev,
                        priority: e.target.value as any,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#176B5B]"
                  >
                    <option value="NORMAL">સામાન્ય (Normal)</option>
                    <option value="HIGH">ઉચ્ચ અગ્રતા (High)</option>
                    <option value="CRITICAL">અતિ તાકીદનું (Critical Emergency)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  સમસ્યા / બીમારીની વિગત: *
                </label>
                <textarea
                  value={newComplaint.problem_text}
                  onChange={(e) =>
                    setNewComplaint((prev) => ({ ...prev, problem_text: e.target.value }))
                  }
                  rows={3}
                  placeholder="દા.ત. ગાયને વધુ તાવ છે અને મોંમાંથી લાળ પડે છે, તાકીદે મુલાકાત જરૂરી."
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#176B5B] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateComplaintOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                રદ કરો
              </button>
              <button
                type="button"
                disabled={isSubmittingComplaint}
                onClick={handleCreateComplaintSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#176B5B] hover:bg-[#164E45] text-xs font-bold text-white shadow-xs disabled:opacity-50"
              >
                {isSubmittingComplaint ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>નોંધણી થઈ રહી છે...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ફરિયાદ નોંધો અને જૂથ બનાવો</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
