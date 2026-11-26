import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { masterService, type DiseaseItem, type VaccineItem, type SpeciesItem } from '../../services/masterService';
import { dahoOpsService, type CampaignMonitoringData } from '../../services/dahoOpsService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField } from '../../components/common/FormField';
import { StateView } from '../../components/common/StateView';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  Megaphone,
  Plus,
  Calendar,
  RotateCcw,
  Layers,
  PawPrint,
  ChevronRight,
  Eye,
  CheckCircle2,
  UserPlus,
  Users,
} from 'lucide-react';

export const TahoCampaignsView: React.FC = () => {
  const { apiBaseUrl, hasPermission, selectedTalukaId } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    disease_code: 'FMD',
    vaccine_code: '',
    custom_vaccine_name: '',
    is_custom_vaccine: false,
    species_codes: ['CATTLE', 'BUFFALO'] as string[],
    start_date: '',
    end_date: '',
    village_ids: [] as string[],
  });
  const [masterDiseases, setMasterDiseases] = useState<DiseaseItem[]>([]);
  const [masterVaccines, setMasterVaccines] = useState<VaccineItem[]>([]);
  const [masterSpecies, setMasterSpecies] = useState<SpeciesItem[]>([]);

  // Monitoring Drill-down Modal State
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);
  const [selectedCampaignForMonitoring, setSelectedCampaignForMonitoring] = useState<any | null>(null);
  const [monitoringData, setMonitoringData] = useState<CampaignMonitoringData | null>(null);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);

  // Staff Assignment Modal State
  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState(false);
  const [assignTargetVillage, setAssignTargetVillage] = useState<{ village_id: string; village_name: string } | null>(null);
  const [selectedMultiAssignVillageIds, setSelectedMultiAssignVillageIds] = useState<string[]>([]);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState('');
  const [availableStaffList, setAvailableStaffList] = useState<Array<{ id: string; full_name: string; username?: string | null; role?: string }>>([]);
  const [isLoadingStaffList, setIsLoadingStaffList] = useState(false);
  const [isSubmittingStaffAssign, setIsSubmittingStaffAssign] = useState(false);

  // Verification Review Modal State
  const [isVerificationReviewModalOpen, setIsVerificationReviewModalOpen] = useState(false);
  const [reviewVillageItem, setReviewVillageItem] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cList, hier, disList, spList] = await Promise.all([
        adminService.listTahoCampaigns(apiBaseUrl, selectedTalukaId || undefined).catch(() => []),
        adminService.getTahoHierarchy(apiBaseUrl, selectedTalukaId || undefined).catch(() => null),
        masterService.listDiseases(apiBaseUrl, true).catch(() => []),
        masterService.listSpecies(apiBaseUrl, true).catch(() => []),
      ]);
      setCampaigns(cList || []);
      setHierarchy(hier);
      setMasterDiseases(disList || []);
      setMasterSpecies(spList || []);
    } catch (err: any) {
      console.warn('Campaigns load note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, selectedTalukaId]);

  const allVillages = useMemo(() => hierarchy?.villages || [], [hierarchy]);

  const compatibleVaccines = useMemo(() => {
    if (!formData.species_codes || formData.species_codes.length === 0) return masterVaccines;
    const filtered = masterVaccines.filter(
      (v) =>
        !v.applicable_species ||
        v.applicable_species.length === 0 ||
        v.applicable_species.some((sp) => formData.species_codes.includes(sp))
    );
    return filtered.length > 0 ? filtered : masterVaccines;
  }, [masterVaccines, formData.species_codes]);

  useEffect(() => {
    if (formData.disease_code) {
      masterService
        .listVaccines(apiBaseUrl, { activeOnly: true, diseaseCode: formData.disease_code })
        .then((vacs) => {
          setMasterVaccines(vacs);
          if (vacs.length > 0) {
            setFormData((prev) => ({ ...prev, vaccine_code: vacs[0].code }));
          } else {
            setFormData((prev) => ({ ...prev, vaccine_code: 'OTHER', is_custom_vaccine: true }));
          }
        })
        .catch(() => setMasterVaccines([]));
    }
  }, [formData.disease_code, apiBaseUrl]);

  const handleOpenModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormData({
      name: '',
      code: '',
      disease_code: masterDiseases[0]?.code || 'FMD',
      vaccine_code: '',
      custom_vaccine_name: '',
      is_custom_vaccine: false,
      species_codes: ['CATTLE', 'BUFFALO'],
      start_date: today,
      end_date: in30Days,
      village_ids: allVillages.map((v: any) => v.village_id), // Default all villages
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.start_date || !formData.end_date) {
      alert('કૃપા કરીને નામ અને તારીખો દાખલ કરો.');
      return;
    }
    if (formData.species_codes.length === 0) {
      alert('ઓછામાં ઓછી એક પશુ કેટેગરી પસંદ કરો.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedVacObj = masterVaccines.find((v) => v.code === formData.vaccine_code);
      const isCustom = formData.vaccine_code === 'OTHER' || !selectedVacObj;
      const finalVaccineName = isCustom
        ? formData.custom_vaccine_name.trim()
        : (selectedVacObj?.name_gu || selectedVacObj?.name_en || '');

      await adminService.createTahoCampaign(apiBaseUrl, {
        ...formData,
        vaccine_code: isCustom ? 'CUSTOM' : formData.vaccine_code,
        vaccine_name: finalVaccineName,
        custom_vaccine_name: isCustom ? formData.custom_vaccine_name.trim() : undefined,
        is_custom_vaccine: isCustom,
      });
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'ઝુંબેશ બનાવવામાં નિષ્ફળ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVillage = (vId: string) => {
    setFormData((prev) => ({
      ...prev,
      village_ids: prev.village_ids.includes(vId)
        ? prev.village_ids.filter((id) => id !== vId)
        : [...prev.village_ids, vId],
    }));
  };

  const handleOpenMonitoring = async (camp: any) => {
    setSelectedCampaignForMonitoring(camp);
    setIsMonitoringModalOpen(true);
    setIsLoadingMonitoring(true);
    try {
      const data = await dahoOpsService.getCampaignMonitoring(apiBaseUrl, camp.id);
      setMonitoringData(data);
    } catch (e: any) {
      console.warn('Could not load campaign monitoring:', e);
      setMonitoringData(null);
    } finally {
      setIsLoadingMonitoring(false);
    }
  };

  const handleOpenTahoAssignStaff = async (villageItem: any) => {
    setAssignTargetVillage({
      village_id: villageItem.village_id,
      village_name: villageItem.village_name_gu || villageItem.village_name_en || villageItem.village_code || 'ગામ',
    });
    setSelectedMultiAssignVillageIds([villageItem.village_id]);
    setIsAssignStaffModalOpen(true);
    setIsLoadingStaffList(true);
    setSelectedStaffUserId('');
    try {
      const [voList, fwList] = await Promise.all([
        adminService.listTahoVos(apiBaseUrl, selectedTalukaId || undefined).catch(() => []),
        adminService.listTahoFws(apiBaseUrl, selectedTalukaId || undefined).catch(() => []),
      ]);
      const combined = [
        ...voList.map((v: any) => ({ id: v.id, full_name: `ડૉ. ${v.full_name || v.username} (VO)`, username: v.username, role: 'VET_OFFICER' })),
        ...fwList.map((f: any) => ({ id: f.id, full_name: `${f.full_name || f.username} (FW)`, username: f.username, role: 'FIELD_WORKER' })),
      ];
      setAvailableStaffList(combined);
      if (combined.length > 0) {
        setSelectedStaffUserId(combined[0].id);
      }
    } catch (e) {
      console.warn('Could not load staff list:', e);
    } finally {
      setIsLoadingStaffList(false);
    }
  };

  const handleTahoSubmitAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignForMonitoring || !assignTargetVillage || !selectedStaffUserId || selectedMultiAssignVillageIds.length === 0) {
      return;
    }
    setIsSubmittingStaffAssign(true);
    try {
      const st = availableStaffList.find((s) => s.id === selectedStaffUserId);
      await dahoOpsService.assignCampaignWorkersBulk(apiBaseUrl, selectedCampaignForMonitoring.id, {
        village_ids: selectedMultiAssignVillageIds,
        worker_user_id: selectedStaffUserId,
        role_type: st?.role || 'FIELD_WORKER',
      });
      alert(`સ્ટાફ સફળતાપૂર્વક ${selectedMultiAssignVillageIds.length} ગામો માટે નિયુક્ત થયો.`);
      setIsAssignStaffModalOpen(false);
      const updated = await dahoOpsService.getCampaignMonitoring(apiBaseUrl, selectedCampaignForMonitoring.id);
      setMonitoringData(updated);
    } catch (err: any) {
      alert(err?.message || 'સ્ટાફ સોંપવામાં નિષ્ફળ.');
    } finally {
      setIsSubmittingStaffAssign(false);
    }
  };

  const handleOpenVerificationReview = (villageItem: any) => {
    setReviewVillageItem(villageItem);
    setReviewNotes(villageItem.verification_notes || '');
    setRejectionReason(villageItem.rejection_reason || '');
    setIsVerificationReviewModalOpen(true);
  };

  const handleReviewDecision = async (decision: 'APPROVE' | 'REJECT' | 'REOPEN') => {
    if (!selectedCampaignForMonitoring || !reviewVillageItem) return;
    if (decision === 'REJECT' && !rejectionReason.trim()) {
      alert('કૃપા કરીને અસ્વીકાર / સુધારણાનું કારણ દાખલ કરો.');
      return;
    }

    setIsReviewSubmitting(true);
    try {
      await dahoOpsService.verifyVillageCompletion(
        apiBaseUrl,
        selectedCampaignForMonitoring.id,
        reviewVillageItem.village_id,
        {
          decision,
          review_notes: reviewNotes.trim() || undefined,
          rejection_reason: rejectionReason.trim() || undefined,
        }
      );

      alert(
        decision === 'APPROVE'
          ? `ગામ ${reviewVillageItem.village_name_gu} ની કામગીરી પ્રમાણિત અને મંજૂર થઈ.`
          : decision === 'REJECT'
            ? `ગામ ${reviewVillageItem.village_name_gu} ની કામગીરી સુધારણા માટે પરત મોકલાઈ.`
            : `ગામ ${reviewVillageItem.village_name_gu} ની કામગીરી પુનઃ ખોલવામાં આવી.`
      );
      setIsVerificationReviewModalOpen(false);
      const updated = await dahoOpsService.getCampaignMonitoring(apiBaseUrl, selectedCampaignForMonitoring.id);
      setMonitoringData(updated);
    } catch (err: any) {
      alert(err?.message || 'ચકાસણી નિર્ણય નિષ્ફળ.');
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 0. Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
        <span>કામગીરી</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span>તાલુકા પશુપાલન અધિકારી (TAHO)</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-[#0F172A] font-medium">તાલુકા રસીકરણ ઝુંબેશો • {campaigns.length} ઝુંબેશો</span>
      </div>

      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-700" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              તાલુકા રસીકરણ ઝુંબેશો (Vaccination Campaigns)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            તાલુકા-કક્ષાના સામૂહિક રસીકરણ અભિયાનોનું આયોજન, લક્ષ્યાંક નિર્ધારણ અને ગામ મુજબ પ્રગતિ
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('campaign.create') && (
            <Button variant="primary" size="sm" onClick={handleOpenModal} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              નવી ઝુંબેશ શરૂ કરો
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {/* 2. Campaigns Grid / Cards */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">ઝુંબેશ ડેટા લોડ થઈ રહ્યો છે...</div>
      ) : campaigns.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-white border border-slate-200">
          <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">હાલમાં કોઈ સક્રિય રસીકરણ ઝુંબેશ નથી</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            તાલુકાના ગામો માટે નવું રસીકરણ અભિયાન શરૂ કરવા માટે ઉપરના "નવી ઝુંબેશ શરૂ કરો" બટન પર ક્લિક કરો.
          </p>
          <Button variant="primary" size="sm" onClick={handleOpenModal}>
            પ્રથમ ઝુંબેશ બનાવો
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((camp) => {
            const pct = camp.completion_pct || 0;
            return (
              <Card key={camp.id} className="p-4 bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm font-heading">{camp.name}</h3>
                      <span className="text-[10px] font-mono text-slate-500 block">{camp.code}</span>
                    </div>
                    <StatusChip status={camp.status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED'} label={camp.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">લક્ષ્યાંકિત ગામો:</span>
                      <span className="font-bold text-slate-800 font-mono flex items-center gap-1">
                        <Layers className="w-3 h-3 text-emerald-700" />
                        {camp.target_villages_count} ગામ
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">કુલ રસીકરણ:</span>
                      <span className="font-bold text-emerald-700 font-mono flex items-center gap-1">
                        <PawPrint className="w-3 h-3 text-emerald-700" />
                        {camp.vaccinated_count} ડોઝ
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">પ્રગતિ:</span>
                      <span className="font-bold text-emerald-800 font-mono">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{camp.start_date || '-'} થી {camp.end_date || '-'}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenMonitoring(camp)}
                    leftIcon={<Eye className="w-3 h-3 text-[#135D43]" />}
                  >
                    મોનિટરિંગ અને ચકાસણી
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 3. Create Campaign Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="નવું રસીકરણ અભિયાન બનાવો" maxWidth="md">
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">ઝુંબેશનું નામ *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="દા.ત. FMD મુક્ત તાલુકો અભિયાન ૨૦૨૬"
              className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">ઝુંબેશ કોડ (ઓપ્શનલ)</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="CAMP-FMD-2026"
              className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">શરૂઆત તારીખ *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">સમાપ્તિ તારીખ *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Disease Selection (Master Data) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">રોગ પસંદ કરો (Disease Master) *</label>
            <select
              required
              value={formData.disease_code}
              onChange={(e) => setFormData({ ...formData, disease_code: e.target.value })}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              {masterDiseases.length > 0 ? (
                masterDiseases.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name_gu} ({d.code})
                  </option>
                ))
              ) : (
                <>
                  <option value="FMD">FMD (ખરવા મોવાસા)</option>
                  <option value="LSD">LSD (લમ્પી ત્વચા રોગ)</option>
                  <option value="HS">HS (ગળસૂંઠો)</option>
                  <option value="BQ">BQ (ગાઠીયો તાવ)</option>
                  <option value="BRUCELLOSIS">Brucellosis (બ્રુસેલોસિસ)</option>
                  <option value="PPR">PPR (બકરીઓમાં પીપીઆર)</option>
                </>
              )}
            </select>
          </div>

          {/* Vaccine Selection (Master Data + Custom Fallback) */}
          <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-2">
            <label className="block font-semibold text-slate-800 text-[11px]">રસી પસંદ કરો (Vaccine Formulary) *</label>
            <select
              value={formData.vaccine_code}
              onChange={(e) => setFormData({ ...formData, vaccine_code: e.target.value })}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-white font-medium"
            >
              {compatibleVaccines.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.verification_status === 'VERIFIED' ? '✓ [Verified] ' : '[Pending] '}
                  {v.name_gu} ({v.standard_dosage || '2ml'} {v.administration_route || 'S/C'})
                </option>
              ))}
              <option value="OTHER">+ અન્ય / જાતે દાખલ કરો (Enter Manually / Custom)</option>
            </select>

            {formData.vaccine_code === 'OTHER' && (
              <div className="pt-1 space-y-1">
                <input
                  type="text"
                  required
                  value={formData.custom_vaccine_name}
                  onChange={(e) => setFormData({ ...formData, custom_vaccine_name: e.target.value })}
                  placeholder="કસ્ટમ રસીનું નામ દાખલ કરો..."
                  className="w-full p-1.5 text-xs rounded border border-amber-300 bg-white focus:outline-none"
                />
                <span className="text-[10px] text-amber-800 block">
                  * આ રસી માત્ર આ ઝુંબેશ માટે સાચવવામાં આવશે.
                </span>
              </div>
            )}
          </div>

          {/* Species Multi-select */}
          <div className="space-y-1 pt-1">
            <label className="block font-semibold text-slate-700 text-[11px]">પાત્ર પશુ પ્રજાતિઓ (Species)</label>
            <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50 border rounded-lg max-h-28 overflow-y-auto">
              {(masterSpecies.length > 0 ? masterSpecies : [
                { code: 'CATTLE', name_gu: 'ગાય' },
                { code: 'BUFFALO', name_gu: 'ભેંસ' },
                { code: 'GOAT', name_gu: 'બકરી' },
                { code: 'SHEEP', name_gu: 'ઘેટાં' },
              ]).map((s: any) => {
                const isChecked = formData.species_codes.includes(s.code);
                return (
                  <label key={s.code} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setFormData((prev) => ({
                          ...prev,
                          species_codes: isChecked
                            ? prev.species_codes.filter((c) => c !== s.code)
                            : [...prev.species_codes, s.code],
                        }));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{s.name_gu} ({s.code})</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Villages Multi-select */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">
                લક્ષ્યાંકિત ગામો ({formData.village_ids.length} પસંદ કરેલ)
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, village_ids: allVillages.map((v: any) => v.village_id) })}
                className="text-emerald-700 hover:underline text-[11px] font-semibold"
              >
                તમામ પસંદ કરો
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto p-2 rounded-lg border border-slate-200 grid grid-cols-2 gap-1.5">
              {allVillages.map((v: any) => {
                const isChecked = formData.village_ids.includes(v.village_id);
                return (
                  <label
                    key={v.village_id}
                    className={`flex items-center gap-1.5 p-1 rounded cursor-pointer text-[11px] ${isChecked ? 'bg-emerald-50 text-emerald-900 font-medium' : 'hover:bg-slate-50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleVillage(v.village_id)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="truncate">{v.name_gu || transliterateToGujarati(v.name_en)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white pb-1 z-10">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              ઝુંબેશ બનાવો
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Detailed Campaign Monitoring Modal */}
      <Modal
        isOpen={isMonitoringModalOpen}
        onClose={() => setIsMonitoringModalOpen(false)}
        title={`તાલુકા ઝુંબેશ મોનિટરિંગ: ${selectedCampaignForMonitoring?.name || selectedCampaignForMonitoring?.code || ''}`}
        maxWidth="lg"
      >
        {isLoadingMonitoring ? (
          <StateView state="loading" message="ઝુંબેશ મોનિટરિંગ ડેટા લોડ થઈ રહ્યો છે..." />
        ) : !monitoringData ? (
          <StateView state="error" title="ડેટા મળ્યો નથી" message="આ ઝુંબેશ માટે મોનિટરિંગ માહિતી ઉપલબ્ધ નથી." />
        ) : (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1 pr-2 text-xs font-body">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] text-blue-700 font-medium">આયોજિત લક્ષ્યાંક</div>
                <div className="text-lg font-bold text-blue-900 font-mono mt-0.5">
                  {selectedCampaignForMonitoring?.target_animals_count || '-'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                <div className="text-[11px] text-purple-700 font-medium">વાસ્તવિક પાત્ર પશુઓ</div>
                <div className="text-lg font-bold text-purple-900 font-mono mt-0.5">
                  {monitoringData.actual_eligible_count}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] text-emerald-700 font-medium">રસીકરણ થયેલ</div>
                <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5">
                  {monitoringData.total_vaccinated_count}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[11px] text-amber-700 font-medium">બાકી પશુઓ</div>
                <div className="text-lg font-bold text-amber-900 font-mono mt-0.5">
                  {monitoringData.total_remaining_count}
                </div>
              </div>
            </div>

            {/* Campaign Village Lifecycle & Verification KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">કુલ ગામો</span>
                <span className="text-sm font-bold text-slate-800 font-mono block mt-0.5">{monitoringData.villages.length}</span>
              </div>
              <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200">
                <span className="text-[10px] text-blue-700 font-semibold block">સોંપાયેલ ગામો</span>
                <span className="text-sm font-bold text-blue-800 font-mono block mt-0.5">
                  {monitoringData.assigned_villages_count ?? monitoringData.villages.filter((v) => v.vo_acceptance_status === 'ACCEPTED').length}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-200">
                <span className="text-[10px] text-indigo-700 font-semibold block">ચાલુ કામગીરી</span>
                <span className="text-sm font-bold text-indigo-800 font-mono block mt-0.5">
                  {monitoringData.in_progress_villages_count ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200">
                <span className="text-[10px] text-amber-700 font-semibold block">ચકાસણી પેન્ડિંગ</span>
                <span className="text-sm font-bold text-amber-800 font-mono block mt-0.5">
                  {monitoringData.submitted_villages_count ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-semibold block">પ્રમાણિત પૂર્ણ</span>
                <span className="text-sm font-bold text-emerald-800 font-mono block mt-0.5">
                  {monitoringData.verified_villages_count ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-red-50/70 border border-red-200">
                <span className="text-[10px] text-red-700 font-semibold block">સુધારણા જરૂરી</span>
                <span className="text-sm font-bold text-red-800 font-mono block mt-0.5">
                  {monitoringData.rejected_villages_count ?? 0}
                </span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-800 mb-1.5">
                <span>એકંદર પૂર્ણતા દર</span>
                <span className="font-mono text-emerald-700 font-bold">{monitoringData.overall_completion_percentage}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, monitoringData.overall_completion_percentage)}%` }}
                />
              </div>
            </div>

            {/* Village-Wise Breakdown Table */}
            <div>
              <h5 className="text-xs font-bold text-slate-800 mb-2">
                ગામ-વાર સ્ટાફ સ્થિતિ અને રસીકરણ પ્રગતિ ({monitoringData.villages.length} ગામો)
              </h5>

              <div className="space-y-2">
                {monitoringData.villages.map((v) => {
                  const verifBadge =
                    v.verification_status === 'VERIFIED_COMPLETED' ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                        ✓ પ્રમાણિત (મંજૂર)
                      </span>
                    ) : v.verification_status === 'SUBMITTED_FOR_VERIFICATION' ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                        ⏳ ચકાસણી પેન્ડિંગ
                      </span>
                    ) : v.verification_status === 'REJECTED' ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold border border-red-300">
                        ✕ સુધારણા જરૂરી
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {v.vaccinated_count > 0 ? 'ચાલુ છે' : 'સોંપાયેલ'}
                      </span>
                    );

                  return (
                    <div key={v.village_id} className="p-3 rounded-xl border bg-white shadow-2xs space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b pb-2">
                        <div>
                          <div className="font-bold text-xs text-slate-900">
                            {v.village_name_gu} ({v.village_name_en || v.village_code})
                          </div>
                          <div className="text-[10px] text-slate-500">
                            તાલુકો: {v.taluka_name || '-'} | કોડ: {v.village_code}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {verifBadge}
                          <button
                            type="button"
                            onClick={() => handleOpenVerificationReview(v)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold text-emerald-800 shadow-2xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>ચકાસણી સમીક્ષા</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTahoAssignStaff(v)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3 text-[#135D43]" />
                            <span>+ સ્ટાફ સોંપો</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block">વેટરનરી અધિકારી (VO)</span>
                          <span className="font-semibold text-slate-800">
                            {v.assigned_vo ? v.assigned_vo.full_name : 'નિયુક્ત નથી'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">પાત્ર / રસીકરણ</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {v.eligible_count} / {v.vaccinated_count}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">બાકી પશુઓ</span>
                          <span className="font-mono font-semibold text-amber-700">{v.remaining_count}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">પૂર્ણતા</span>
                          <span className="font-mono font-bold text-emerald-700">{v.completion_percentage}%</span>
                        </div>
                      </div>

                      {v.assigned_fws && v.assigned_fws.length > 0 && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            સોંપાયેલ ક્ષેત્રીય કાર્યકરો:{' '}
                            <strong>{v.assigned_fws.map((f: any) => f.full_name).join(', ')}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsMonitoringModalOpen(false)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 5. Assign Staff Modal */}
      <Modal
        isOpen={isAssignStaffModalOpen}
        onClose={() => setIsAssignStaffModalOpen(false)}
        title={`સ્ટાફ સોંપણી: ${assignTargetVillage?.village_name || ''}`}
      >
        <form onSubmit={handleTahoSubmitAssignStaff} className="space-y-4 text-xs font-body">
          <div className="p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] space-y-1 text-slate-700 font-medium">
            <div>ઝુંબેશ: <strong className="text-[#0F172A]">{selectedCampaignForMonitoring?.name || selectedCampaignForMonitoring?.code}</strong></div>
            <div>લક્ષિત ગામ: <strong className="text-[#0F172A]">{assignTargetVillage?.village_name}</strong></div>
          </div>

          <FormField label="સ્ટાફ / કાર્યકર પસંદ કરો" required>
            {isLoadingStaffList ? (
              <p className="text-xs text-slate-500 py-2">સ્ટાફ યાદી લોડ થઈ રહી છે...</p>
            ) : (
              <select
                value={selectedStaffUserId}
                onChange={(e) => setSelectedStaffUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-white font-medium"
              >
                {availableStaffList.length === 0 ? (
                  <option value="">કોઈ સક્રિય સ્ટાફ ઉપલબ્ધ નથી</option>
                ) : (
                  availableStaffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} {st.username ? `(${st.username})` : ''}
                    </option>
                  ))
                )}
              </select>
            )}
          </FormField>

          {/* Multi-Village Selection */}
          {monitoringData && monitoringData.villages.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0F172A] block">
                લક્ષ્યાંકિત ગામો પસંદ કરો (બહુવિધ ગામ સોંપણી):
              </label>
              <div className="p-3 bg-slate-50 border rounded-lg max-h-40 overflow-y-auto space-y-1.5 text-xs">
                {monitoringData.villages.map((v) => (
                  <label key={v.village_id} className="flex items-center gap-2 cursor-pointer font-medium hover:text-[#135D43]">
                    <input
                      type="checkbox"
                      checked={selectedMultiAssignVillageIds.includes(v.village_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMultiAssignVillageIds((prev) => [...prev, v.village_id]);
                        } else {
                          setSelectedMultiAssignVillageIds((prev) => prev.filter((id) => id !== v.village_id));
                        }
                      }}
                      className="rounded text-[#135D43] focus:ring-[#135D43]"
                    />
                    <span>{v.village_name_gu} ({v.village_code})</span>
                  </label>
                ))}
              </div>
              <span className="text-[11px] text-[#64748B]">
                {selectedMultiAssignVillageIds.length} ગામો પસંદ કરેલ છે
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAssignStaffModalOpen(false)}>
              રદ કરો
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isSubmittingStaffAssign}
              disabled={!selectedStaffUserId}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              સોંપણી કન્ફર્મ કરો
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. Review & Verify Village Campaign Completion Modal */}
      <Modal
        isOpen={isVerificationReviewModalOpen}
        onClose={() => setIsVerificationReviewModalOpen(false)}
        title={`કામગીરી ચકાસણી સમીક્ષા: ${reviewVillageItem?.village_name_gu || ''}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs font-body">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1.5">
            <div className="flex justify-between items-center">
              <div>ગામ: <strong className="text-[#135D43] text-sm">{reviewVillageItem?.village_name_gu}</strong> ({reviewVillageItem?.village_code})</div>
              <div>તાલુકો: <strong>{reviewVillageItem?.taluka_name || '-'}</strong></div>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <div>VO: <strong>{reviewVillageItem?.assigned_vo?.full_name || 'નિયુક્ત નથી'}</strong></div>
              <div>FW: <strong>{(reviewVillageItem?.assigned_fws || []).map((f: any) => f.full_name).join(', ') || 'નિયુક્ત નથી'}</strong></div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-[10px] text-blue-700 block">પાત્ર પશુઓ</span>
              <strong className="text-blue-900 font-mono text-sm">{reviewVillageItem?.eligible_count || 0}</strong>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
              <span className="text-[10px] text-emerald-700 block">રસીકરણ થયેલ</span>
              <strong className="text-emerald-900 font-mono text-sm">{reviewVillageItem?.vaccinated_count || 0}</strong>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="text-[10px] text-amber-700 block">બાકી પશુઓ</span>
              <strong className="text-amber-900 font-mono text-sm">{reviewVillageItem?.remaining_count || 0}</strong>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] text-indigo-700 block">પૂર્ણતા %</span>
              <strong className="text-indigo-900 font-mono text-sm">{reviewVillageItem?.completion_percentage || 0}%</strong>
            </div>
          </div>

          {reviewVillageItem?.completion_notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700 block mb-1">ક્ષેત્રીય સ્ટાફ પૂર્ણતા નોંધ:</span>
              <p className="text-slate-800 leading-relaxed">{reviewVillageItem.completion_notes}</p>
            </div>
          )}

          {reviewVillageItem?.evidence_photo_urls && reviewVillageItem.evidence_photo_urls.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 block">પુરાવા ફોટા ({reviewVillageItem.evidence_photo_urls.length}):</span>
              <div className="flex flex-wrap gap-2">
                {reviewVillageItem.evidence_photo_urls.map((url: string, idx: number) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#135D43] underline font-mono bg-white px-2.5 py-1 rounded border hover:bg-emerald-50"
                  >
                    ફોટો #{idx + 1} જુઓ ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          <FormField label="ચકાસણી નોંધ (Verification Notes)">
            <textarea
              rows={2}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="દા.ત. તાલુકા કક્ષાએ ક્ષેત્રીય કામગીરી પ્રમાણિત કરી મંજૂર કરવામાં આવે છે..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <FormField label="અસ્વીકાર અથવા સુધારણા કારણ (જો અસ્વીકાર કરવો હોય તો)">
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="દા.ત. કામગીરી અધૂરી છે, ફરીથી કેમ્પ આયોજિત કરો..."
              className="w-full px-3 py-2 text-xs border rounded-lg border-red-200 bg-red-50/30"
            />
          </FormField>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsVerificationReviewModalOpen(false)}
            >
              બંધ કરો
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleReviewDecision('REOPEN')}
                isLoading={isReviewSubmitting}
                className="text-slate-700"
              >
                પુનઃ ખોલો (Reopen)
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={() => handleReviewDecision('REJECT')}
                isLoading={isReviewSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                સુધારણા માટે મોકલો (Reject)
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={() => handleReviewDecision('APPROVE')}
                isLoading={isReviewSubmitting}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                મંજૂર કરો (Approve & Verify)
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
