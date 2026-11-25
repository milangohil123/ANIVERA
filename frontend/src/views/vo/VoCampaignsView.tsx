import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import {
  voService,
  type VOCampaignVillageAssignment,
} from '../../services/voService';
import {
  Megaphone,
  RotateCcw,
  Users,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Check,
  X,
  Clock,
  ShieldCheck,
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

export const VoCampaignsView: React.FC = () => {
  const { apiBaseUrl, refreshProfile } = useAuth();

  const [assignments, setAssignments] = useState<VOCampaignVillageAssignment[]>([]);
  const [fieldWorkers, setFieldWorkers] = useState<Array<{ id: string; full_name: string; username: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Field Worker Assignment Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedVillageAssignment, setSelectedVillageAssignment] = useState<VOCampaignVillageAssignment | null>(null);
  const [selectedAssignVillageIds, setSelectedAssignVillageIds] = useState<string[]>([]);
  const [workerUserId, setWorkerUserId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Verification Submission State
  const [isSubmitVerifModalOpen, setIsSubmitVerifModalOpen] = useState(false);
  const [verifTarget, setVerifTarget] = useState<VOCampaignVillageAssignment | null>(null);
  const [verifVisitedCount, setVerifVisitedCount] = useState<number>(0);
  const [verifNotes, setVerifNotes] = useState('');
  const [verifPhotos, setVerifPhotos] = useState('');
  const [isSubmittingVerif, setIsSubmittingVerif] = useState(false);

  // Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState<VOCampaignVillageAssignment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Processing Accept
  const [processingAcceptId, setProcessingAcceptId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      await refreshProfile().catch(() => {});
      const [voAssignments, workerData] = await Promise.all([
        voService.listMyCampaignAssignments(apiBaseUrl).catch(() => []),
        voService.listFieldWorkers(apiBaseUrl).catch(() => []),
      ]);
      setAssignments(voAssignments);
      setFieldWorkers(workerData);

      if (workerData.length > 0 && !workerUserId) {
        setWorkerUserId(workerData[0].id);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ઝુંબેશ સોંપણી માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  // Handle VO Acceptance
  const handleAcceptAssignment = async (assign: VOCampaignVillageAssignment) => {
    setProcessingAcceptId(`${assign.campaign_id}-${assign.village_id}`);
    try {
      await voService.acceptCampaignAssignment(apiBaseUrl, assign.campaign_id, assign.village_id);
      setNotice({
        type: 'success',
        message: `ગામ ${assign.village_name_gu} માટે ઝુંબેશ સોંપણી સ્વીકારવામાં આવી છે. હવે તમે ક્ષેત્રીય કાર્યકર સોંપી શકો છો.`,
      });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ઝુંબેશ સ્વીકારવામાં નિષ્ફળ.',
      });
    } finally {
      setProcessingAcceptId(null);
    }
  };

  // Open Rejection Dialog
  const handleOpenReject = (assign: VOCampaignVillageAssignment) => {
    setRejectionTarget(assign);
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };

  // Submit Rejection
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionTarget || !rejectionReason.trim()) {
      setNotice({ type: 'error', message: 'કૃપા કરીને અસ્વીકારનું કારણ દાખલ કરો.' });
      return;
    }

    setIsSubmittingReject(true);
    try {
      await voService.rejectCampaignAssignment(
        apiBaseUrl,
        rejectionTarget.campaign_id,
        rejectionTarget.village_id,
        rejectionReason.trim()
      );
      setNotice({
        type: 'success',
        message: `ગામ ${rejectionTarget.village_name_gu} માટે ઝુંબેશ સોંપણી અસ્વીકાર કરવામાં આવી છે અને DAHO ને જાણ કરાઈ છે.`,
      });
      setIsRejectModalOpen(false);
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ઝુંબેશ અસ્વીકાર કરવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Open Assign FW Dialog
  const handleOpenAssignFW = (assign: VOCampaignVillageAssignment) => {
    setSelectedVillageAssignment(assign);
    setSelectedAssignVillageIds([assign.village_id]);
    setIsAssignModalOpen(true);
    if (fieldWorkers.length > 0 && !workerUserId) {
      setWorkerUserId(fieldWorkers[0].id);
    }
  };

  // Submit FW Assignment (Supports multiple villages)
  const handleAssignWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVillageAssignment || !workerUserId.trim() || selectedAssignVillageIds.length === 0) {
      setNotice({ type: 'error', message: 'કૃપા કરીને ક્ષેત્રીય કાર્યકર અને ઓછામાં ઓછું એક ગામ પસંદ કરો.' });
      return;
    }

    setIsSubmittingAssign(true);
    try {
      await voService.assignCampaignWorkersBulk(apiBaseUrl, selectedVillageAssignment.campaign_id, {
        village_ids: selectedAssignVillageIds,
        worker_user_id: workerUserId.trim(),
        role_type: 'FIELD_WORKER',
      });

      setNotice({
        type: 'success',
        message: `ક્ષેત્રીય કાર્યકર ${selectedAssignVillageIds.length} ગામો માટે ઝુંબેશ હેઠળ સફળતાપૂર્વક નિયુક્ત થયા.`,
      });
      setIsAssignModalOpen(false);
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'કાર્યકર સોંપવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Submit Village Verification
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifTarget) return;

    setIsSubmittingVerif(true);
    try {
      const photoUrls = verifPhotos
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      await voService.submitVillageVerification(
        apiBaseUrl,
        verifTarget.campaign_id,
        verifTarget.village_id,
        {
          animals_visited_count: Number(verifVisitedCount) || verifTarget.vaccinated_animals_count,
          vaccinations_completed_count: verifTarget.vaccinated_animals_count,
          pending_animals_count: verifTarget.pending_animals_count,
          completion_notes: verifNotes.trim() || undefined,
          evidence_photo_urls: photoUrls.length > 0 ? photoUrls : undefined,
        }
      );

      setNotice({
        type: 'success',
        message: `ગામ ${verifTarget.village_name_gu} ની કામગીરી પ્રમાણીકરણ માટે સફળતાપૂર્વક સબમિટ કરાઈ.`,
      });
      setIsSubmitVerifModalOpen(false);
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ચકાસણી સબમિશન નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingVerif(false);
    }
  };

  const pendingAssignments = assignments.filter((a) => a.acceptance_status === 'PENDING_ACCEPTANCE');
  const acceptedAssignments = assignments.filter((a) => a.acceptance_status === 'ACCEPTED');
  const rejectedAssignments = assignments.filter((a) => a.acceptance_status === 'REJECTED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] font-heading flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#135D43]" />
            રસીકરણ ઝુંબેશ અને ક્ષેત્રીય સંકલન
          </h2>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            તમારા અધિકૃત ગામોમાં ચાલતી સક્રિય ઝુંબેશની સ્વીકૃતિ અને ક્ષેત્રીય કાર્યકરોની નિયુક્તિ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            તાજું કરો
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Summary KPI Cards Grid — Unified Linear Style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <KpiCard
          label="સ્વીકૃતિ બાકી ઝુંબેશ"
          value={isLoading ? '...' : pendingAssignments.length}
          subtext="સ્વીકૃતિ રાહ જુએ છે"
          icon={<Clock className="w-3.5 h-3.5" />}
          iconVariant="amber"
          isLoading={isLoading}
        />
        <KpiCard
          label="સક્રિય સ્વીકૃત ગામો"
          value={isLoading ? '...' : acceptedAssignments.length}
          subtext="ક્ષેત્રીય કામગીરી ચાલુ"
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
        <KpiCard
          label="ક્ષેત્રીય કાર્યકરો"
          value={isLoading ? '...' : fieldWorkers.length}
          subtext="ઉપલબ્ધ સ્ટાફ"
          icon={<Users className="w-3.5 h-3.5" />}
          iconVariant="blue"
          isLoading={isLoading}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 1. Pending Campaign Notifications & Acceptance Grid                    */}
      {/* ---------------------------------------------------------------------- */}
      {pendingAssignments.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-sm font-bold text-[#0F172A] font-heading">
                નવી ઝુંબેશ સોંપણીઓ — તમારી સ્વીકૃતિ બાકી ({pendingAssignments.length})
              </h3>
            </div>
            <span className="text-xs font-medium text-[#64748B]">
              DAHO દ્વારા સોંપાયેલ • કૃપા કરીને ચકાસીને સ્વીકારો
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAssignments.map((a) => {
              const isProcessing = processingAcceptId === `${a.campaign_id}-${a.village_id}`;
              return (
                <div
                  key={`${a.campaign_id}-${a.village_id}`}
                  className="bg-white p-4 rounded-xl border border-[#E2E8F0] hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A] font-heading">
                        {localizeCampaignName(a.campaign_name)}
                      </h4>
                      <span className="text-xs font-mono text-[#64748B] font-medium">
                        {a.campaign_code}
                      </span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold shrink-0">
                      {a.disease_code || 'FMD'}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-700 bg-[#F8FAFB] p-3 rounded-lg border border-[#E2E8F0] font-medium">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">ગામ:</span>
                      <span className="font-bold text-[#0F172A]">
                        {a.village_name_gu} ({a.village_name_en || a.village_code})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">સમયગાળો:</span>
                      <span className="font-mono text-slate-800">
                        {a.start_date || '-'} થી {a.end_date || '-'}
                      </span>
                    </div>
                    {a.species_names_gu && a.species_names_gu.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">પાત્ર પશુઓ:</span>
                        <span className="font-semibold text-emerald-800">
                          {a.species_names_gu.join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">અંદાજિત પાત્ર પશુઓ:</span>
                      <span className="font-mono font-bold text-[#0F172A]">
                        {a.eligible_animals_count}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAcceptAssignment(a)}
                      isLoading={isProcessing}
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      className="flex-1"
                    >
                      સ્વીકારો
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenReject(a)}
                      leftIcon={<X className="w-3.5 h-3.5 text-red-600" />}
                    >
                      અસ્વીકાર કરો
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 2. Active Accepted Campaigns & FW Coordination                         */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            તમારા અધિકૃત સ્વીકૃત ઝુંબેશ ગામો ({acceptedAssignments.length})
          </h3>
        </div>

        {isLoading ? (
          <StateView state="loading" message="સોંપણીઓ લોડ થઈ રહી છે..." />
        ) : acceptedAssignments.length === 0 ? (
          <div className="p-8 rounded-xl bg-white border border-[#E2E8F0] text-center space-y-2">
            <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">કોઈ સ્વીકૃત ઝુંબેશ ગામ નથી</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
              {pendingAssignments.length > 0
                ? 'ઉપરની સૂચિમાંથી ઝુંબેશ સ્વીકારો જેથી તમે ક્ષેત્રીય કાર્યકરોને સોંપણી કરી શકો.'
                : 'હાલમાં તમારા અધિકૃત ગામો માટે કોઈ સક્રિય ઝુંબેશ સોંપણી ઉપલબ્ધ નથી.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acceptedAssignments.map((a) => {
              const compPct =
                a.eligible_animals_count > 0
                  ? Math.round((a.vaccinated_animals_count / a.eligible_animals_count) * 100)
                  : 0;
              return (
                <div
                  key={`${a.campaign_id}-${a.village_id}`}
                  className="bg-white p-5 rounded-xl border border-[#E2E8F0] hover:shadow-md transition-all duration-200 space-y-4"
                >
                  {/* Campaign Header & Status */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A] font-heading">
                        {localizeCampaignName(a.campaign_name)}
                      </h4>
                      <div className="text-xs text-[#64748B] font-mono mt-0.5 font-medium">
                        {a.campaign_code} • {a.disease_code || 'FMD'}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-medium shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
                      સક્રિય
                    </span>
                  </div>

                  {/* Context Info */}
                  <div className="p-3 rounded-lg bg-[#F8FAFB] border border-[#E2E8F0] text-xs space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">ગામ:</span>
                      <strong className="text-[#0F172A]">
                        {a.village_name_gu} ({a.village_name_en || a.village_code})
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">તાલુકો:</span>
                      <span className="text-slate-800">{a.taluka_name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">સમયગાળો:</span>
                      <span className="font-mono text-slate-800">
                        {a.start_date || '-'} થી {a.end_date || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100">
                      <span className="text-[11px] text-blue-700 font-medium block">પાત્ર પશુઓ</span>
                      <strong className="text-blue-900 font-mono text-sm">{a.eligible_animals_count}</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                      <span className="text-[11px] text-emerald-700 font-medium block">રસીકરણ થયેલ</span>
                      <strong className="text-emerald-900 font-mono text-sm">{a.vaccinated_animals_count}</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-100">
                      <span className="text-[11px] text-amber-700 font-medium block">બાકી પશુઓ</span>
                      <strong className="text-amber-900 font-mono text-sm">{a.pending_animals_count}</strong>
                    </div>
                  </div>

                  {/* Progress Bar (Matching Reference Design) */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-[#0F172A] mb-1.5">
                      <span>પ્રગતિ</span>
                      <span className="font-mono text-[#135D43]">{compPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#135D43] rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, compPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Verification Status & Work Completion Action */}
                  <div className="pt-2 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#64748B] font-semibold">સ્થિતિ:</span>
                      {a.verification_status === 'VERIFIED_COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          પ્રમાણિત (પૂર્ણ)
                        </span>
                      ) : a.verification_status === 'SUBMITTED_FOR_VERIFICATION' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          ચકાસણી પેન્ડિંગ
                        </span>
                      ) : a.verification_status === 'REJECTED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          સુધારણા જરૂરી
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          {a.vaccinated_animals_count > 0 ? 'ચાલુ છે' : 'સોંપાયેલ'}
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant={a.verification_status === 'VERIFIED_COMPLETED' ? 'outline' : 'primary'}
                      onClick={() => {
                        setVerifTarget(a);
                        setVerifVisitedCount(a.vaccinated_animals_count);
                        setVerifNotes(a.completion_notes || '');
                        setVerifPhotos((a.evidence_photo_urls || []).join('\n'));
                        setIsSubmitVerifModalOpen(true);
                      }}
                      leftIcon={<CheckCircle2 className="w-3 h-3" />}
                    >
                      {a.verification_status === 'SUBMITTED_FOR_VERIFICATION'
                        ? 'વિગત જુઓ / સુધારો'
                        : a.verification_status === 'VERIFIED_COMPLETED'
                        ? 'પ્રમાણિત વિગત'
                        : 'પૂર્ણતા ચકાસણી માટે મોકલો'}
                    </Button>
                  </div>

                  {/* Assigned Field Workers */}
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <div className="text-xs font-semibold text-[#0F172A] mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#64748B]">
                        <Users className="w-3.5 h-3.5" />
                        સોંપાયેલ ક્ષેત્રીય કાર્યકરો ({a.assigned_fws.length})
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAssignFW(a)}
                        leftIcon={<UserPlus className="w-3 h-3 text-[#135D43]" />}
                      >
                        કાર્યકર સોંપો
                      </Button>
                    </div>

                    {a.assigned_fws.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium italic">
                        કોઈ ક્ષેત્રીય કાર્યકર સોંપાયેલ નથી. કાર્યકર સોંપવા ઉપર બટન દબાવો.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {a.assigned_fws.map((fw) => (
                          <span
                            key={fw.user_id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[#F8FAFB] text-slate-800 border border-[#E2E8F0] font-medium"
                          >
                            {fw.full_name} ({fw.username})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. Rejected Assignments (if any)                                       */}
      {/* ---------------------------------------------------------------------- */}
      {rejectedAssignments.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            અસ્વીકાર કરેલ ઝુંબેશ સોંપણીઓ ({rejectedAssignments.length})
          </h4>
          <div className="space-y-1.5 text-xs">
            {rejectedAssignments.map((r) => (
              <div
                key={`${r.campaign_id}-${r.village_id}`}
                className="p-3 rounded-lg bg-white border border-[#E2E8F0] flex justify-between items-center"
              >
                <div>
                  <span className="font-semibold text-slate-800">{r.campaign_name}</span> — ગામ:{' '}
                  <strong>{r.village_name_gu}</strong>
                  {r.rejection_reason && (
                    <span className="block text-[11px] text-red-600 mt-0.5">
                      કારણ: {r.rejection_reason}
                    </span>
                  )}
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                  અસ્વીકૃત
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal: Assign Field Worker to Campaign Village                         */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`ક્ષેત્રીય કાર્યકર નિયુક્તિ: ${
          selectedVillageAssignment?.village_name_gu ||
          selectedVillageAssignment?.village_name_en ||
          selectedVillageAssignment?.village_code ||
          ''
        }`}
      >
        <form onSubmit={handleAssignWorker} className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs space-y-1.5 text-slate-700 font-medium">
            <div>
              ઝુંબેશ: <strong className="text-[#0F172A]">{selectedVillageAssignment?.campaign_name}</strong>
            </div>
            <div>
              ગામ:{' '}
              <strong className="text-[#0F172A]">
                {selectedVillageAssignment?.village_name_gu ||
                  selectedVillageAssignment?.village_name_en ||
                  selectedVillageAssignment?.village_code}
              </strong>{' '}
              ({selectedVillageAssignment?.village_name_en || selectedVillageAssignment?.village_code})
            </div>
          </div>

          <FormField label="ક્ષેત્રીય કાર્યકર પસંદ કરો" required>
            <select
              value={workerUserId}
              onChange={(e) => setWorkerUserId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-white font-medium"
            >
              {fieldWorkers.length === 0 ? (
                <option value="">કોઈ કાર્યકર ઉપલબ્ધ નથી</option>
              ) : (
                fieldWorkers.map((fw) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.full_name} ({fw.username})
                  </option>
                ))
              )}
            </select>
          </FormField>

          {/* Multi-Village Selection */}
          {selectedVillageAssignment && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0F172A] block">
                લક્ષ્યાંકિત ગામો પસંદ કરો (બહુવિધ ગામ સોંપણી):
              </label>
              <div className="p-3 bg-slate-50 border rounded-lg max-h-40 overflow-y-auto space-y-1.5 text-xs">
                {acceptedAssignments
                  .filter((a) => a.campaign_id === selectedVillageAssignment.campaign_id)
                  .map((a) => (
                    <label key={a.village_id} className="flex items-center gap-2 cursor-pointer font-medium hover:text-[#135D43]">
                      <input
                        type="checkbox"
                        checked={selectedAssignVillageIds.includes(a.village_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssignVillageIds((prev) => [...prev, a.village_id]);
                          } else {
                            setSelectedAssignVillageIds((prev) => prev.filter((id) => id !== a.village_id));
                          }
                        }}
                        className="rounded text-[#135D43] focus:ring-[#135D43]"
                      />
                      <span>{a.village_name_gu} ({a.village_code})</span>
                    </label>
                  ))}
              </div>
              <span className="text-[11px] text-[#64748B]">
                {selectedAssignVillageIds.length} ગામો પસંદ કરેલ છે
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button variant="outline" type="button" onClick={() => setIsAssignModalOpen(false)}>
              રદ કરો
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmittingAssign}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              કાર્યકર નિયુક્ત કરો
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* Modal: Reject Campaign Assignment Reason                               */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="ઝુંબેશ સોંપણી અસ્વીકાર"
      >
        <form onSubmit={handleSubmitReject} className="space-y-4">
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1 font-medium">
            <div>
              ઝુંબેશ: <strong>{rejectionTarget?.campaign_name}</strong>
            </div>
            <div>
              ગામ: <strong>{rejectionTarget?.village_name_gu}</strong>
            </div>
            <p className="pt-1 text-[11px] text-red-700">
              અસ્વીકાર કર્યા પછી DAHO ને આ કારણ સાથે તાત્કાલિક સૂચના મોકલવામાં આવશે.
            </p>
          </div>

          <FormField label="અસ્વીકાર કરવાનું કારણ *" required>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="દા.ત. અન્ય ક્ષેત્રીય ફરજ પર હોવાથી / પૂરતો સ્ટાફ ઉપલબ્ધ ન હોવાથી..."
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg font-medium"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button variant="outline" type="button" onClick={() => setIsRejectModalOpen(false)}>
              રદ કરો
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmittingReject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              અસ્વીકાર કન્ફર્મ કરો
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* Modal: Submit Village Work Verification                                */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={isSubmitVerifModalOpen}
        onClose={() => setIsSubmitVerifModalOpen(false)}
        title="ગામ રસીકરણ કામગીરી પૂર્ણતા ચકાસણી માટે મોકલો"
      >
        <form onSubmit={handleSubmitVerification} className="space-y-4">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <div>
              ઝુંબેશ: <strong className="text-[#135D43]">{verifTarget?.campaign_name}</strong>
            </div>
            <div>
              ગામ: <strong>{verifTarget?.village_name_gu} ({verifTarget?.village_code})</strong>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-gray-50 border">
              <span className="text-[10px] text-gray-500 block">પાત્ર પશુઓ</span>
              <strong className="text-gray-800">{verifTarget?.eligible_animals_count || 0}</strong>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
              <span className="text-[10px] text-emerald-700 block">રસીકરણ થયેલ</span>
              <strong className="text-emerald-800">{verifTarget?.vaccinated_animals_count || 0}</strong>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="text-[10px] text-amber-700 block">બાકી પશુઓ</span>
              <strong className="text-amber-800">{verifTarget?.pending_animals_count || 0}</strong>
            </div>
          </div>

          <FormField label="મુલાકાત લીધેલ પશુઓની સંખ્યા" required>
            <input
              type="number"
              min={0}
              value={verifVisitedCount}
              onChange={(e) => setVerifVisitedCount(parseInt(e.target.value) || 0)}
              disabled={verifTarget?.verification_status === 'VERIFIED_COMPLETED'}
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono font-medium"
              required
            />
          </FormField>

          <FormField label="ક્ષેત્રીય અવલોકન અને પૂર્ણતા નોંધ">
            <textarea
              rows={3}
              value={verifNotes}
              onChange={(e) => setVerifNotes(e.target.value)}
              disabled={verifTarget?.verification_status === 'VERIFIED_COMPLETED'}
              placeholder="દા.ત. નિર્ધારિત સમયગાળામાં લક્ષ્યાંક પૂર્ણ થયેલ છે, ગામમાં તમામ પશુપાલકોને રસીકરણનું પ્રમાણપત્ર આપેલ છે..."
              className="w-full px-3 py-2 text-xs border rounded-lg font-medium"
            />
          </FormField>

          <FormField label="પુરાવા ફોટા લિંક / URLs (પ્રતિ લાઇન એક)">
            <textarea
              rows={2}
              value={verifPhotos}
              onChange={(e) => setVerifPhotos(e.target.value)}
              disabled={verifTarget?.verification_status === 'VERIFIED_COMPLETED'}
              placeholder="https://example.com/field-photo.jpg"
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono text-[11px]"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button variant="outline" type="button" onClick={() => setIsSubmitVerifModalOpen(false)}>
              બંધ કરો
            </Button>
            {verifTarget?.verification_status !== 'VERIFIED_COMPLETED' && (
              <Button variant="primary" type="submit" isLoading={isSubmittingVerif}>
                {verifTarget?.verification_status === 'SUBMITTED_FOR_VERIFICATION' ? 'અપડેટ કરો' : 'ચકાસણી માટે મોકલો'}
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};
