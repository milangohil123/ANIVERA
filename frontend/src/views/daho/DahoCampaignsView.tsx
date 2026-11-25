import React, { useEffect, useState, useMemo } from 'react';
import { z } from 'zod';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import {
  dahoOpsService,
  type CampaignItem,
  type CampaignCreationMeta,
  type CampaignMonitoringData,
  type VillageWithVO,
  type TalukaOption,
} from '../../services/dahoOpsService';
import { adminService } from '../../services/adminService';
import { masterService, type DiseaseItem, type VaccineItem } from '../../services/masterService';
import {
  Plus,
  RotateCcw,
  Megaphone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Search,
  Eye,
  Users,
  Building,
  Clock,
  UserPlus,
} from 'lucide-react';

const campaignSchema = z.object({
  code: z.string().trim().min(3, 'કોડ ઓછામાં ઓછો ૩ અક્ષરનો હોવો જોઈએ').max(50),
  name_gu: z.string().trim().min(2, 'ગુજરાતી નામ જરૂરી છે'),
  name_en: z.string().trim().optional(),
  disease_code: z.string().min(2, 'માન્ય રોગ પસંદ કરો'),
  start_date: z.string().min(1, 'શરૂઆત તારીખ જરૂરી છે'),
  end_date: z.string().min(1, 'સમાપ્તિ તારીખ જરૂરી છે'),
  target_animals_count: z.number().min(1, 'લક્ષ્યાંક પશુ સંખ્યા ૧ કે તેથી વધુ હોવી જોઈએ'),
});

const DEFAULT_SPECIES = [
  { code: 'CATTLE', name_gu: 'ગાય (Cow)', name_en: 'Cow' },
  { code: 'BUFFALO', name_gu: 'ભેંસ (Buffalo)', name_en: 'Buffalo' },
  { code: 'GOAT', name_gu: 'બકરી (Goat)', name_en: 'Goat' },
  { code: 'SHEEP', name_gu: 'ઘેટાં (Sheep)', name_en: 'Sheep' },
  { code: 'HORSE', name_gu: 'ઘોડો (Horse)', name_en: 'Horse' },
  { code: 'CAMEL', name_gu: 'ઊંટ (Camel)', name_en: 'Camel' },
];

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

export const DahoCampaignsView: React.FC = () => {
  const { apiBaseUrl } = useAuth();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Creation Metadata (initialized with defaults so species/villages are never empty)
  const [creationMeta, setCreationMeta] = useState<CampaignCreationMeta>({
    species: DEFAULT_SPECIES,
    talukas: [],
    villages: [],
    default_programmes: ['FMD', 'HS', 'BQ', 'BRUCELLOSIS', 'PPR'],
  });

  // Form State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState('');
  const [nameGu, setNameGu] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [diseaseCode, setDiseaseCode] = useState<string>('FMD');
  const [masterDiseases, setMasterDiseases] = useState<DiseaseItem[]>([]);
  const [masterVaccines, setMasterVaccines] = useState<VaccineItem[]>([]);
  const [selectedVaccineCode, setSelectedVaccineCode] = useState<string>('');
  const [customVaccineName, setCustomVaccineName] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetCount, setTargetCount] = useState<string>('500');
  const [notes, setNotes] = useState('');

  // Animal Category (Species) Selection - Default select Cow & Buffalo
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(['CATTLE', 'BUFFALO']);
  const [speciesSearch, setSpeciesSearch] = useState('');

  // Target Village Selection
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
  const [villageSearch, setVillageSearch] = useState('');
  const [selectedTalukaFilter, setSelectedTalukaFilter] = useState('');

  // Monitoring Drill-down Modal State
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);
  const [selectedCampaignForMonitoring, setSelectedCampaignForMonitoring] = useState<CampaignItem | null>(null);
  const [monitoringData, setMonitoringData] = useState<CampaignMonitoringData | null>(null);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);

  // DAHO Staff Assignment Modal State
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

  const loadCampaigns = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const data = await dahoOpsService.listCampaigns(apiBaseUrl);
      setCampaigns(data);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ઝુંબેશ માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCreationMeta = async () => {
    try {
      const [metaResult, adminVillagesResult, adminTalukasResult, masterDiseasesResult, masterSpeciesResult] = await Promise.allSettled([
        dahoOpsService.getCreationMeta(apiBaseUrl),
        adminService.listVillages(apiBaseUrl),
        adminService.listTalukas(apiBaseUrl),
        masterService.listDiseases(apiBaseUrl, true),
        masterService.listSpecies(apiBaseUrl, true),
      ]);

      if (masterDiseasesResult.status === 'fulfilled' && masterDiseasesResult.value.length > 0) {
        setMasterDiseases(masterDiseasesResult.value);
        if (!diseaseCode) {
          setDiseaseCode(masterDiseasesResult.value[0].code);
        }
      }

      let activeSpecies = DEFAULT_SPECIES;
      if (masterSpeciesResult.status === 'fulfilled' && masterSpeciesResult.value.length > 0) {
        activeSpecies = masterSpeciesResult.value.map((s) => ({
          code: s.code,
          name_gu: s.name_gu,
          name_en: s.name_en,
        }));
      }

      const baseMeta =
        metaResult.status === 'fulfilled' && metaResult.value && Array.isArray(metaResult.value.species)
          ? metaResult.value
          : { species: activeSpecies, talukas: [], villages: [], default_programmes: [] };

      const species = activeSpecies.length > 0 ? activeSpecies : (baseMeta.species || DEFAULT_SPECIES);

      // Villages Map
      const villagesMap = new Map<string, VillageWithVO>();
      if (Array.isArray(baseMeta.villages)) {
        for (const v of baseMeta.villages) {
          if (v && v.id) villagesMap.set(v.id, v);
        }
      }

      // Merge master data villages from adminService (e.g. BOTAD, nklmnn, POTAD, GADHDA)
      if (adminVillagesResult.status === 'fulfilled' && Array.isArray(adminVillagesResult.value)) {
        for (const mv of adminVillagesResult.value) {
          if (mv && mv.id && !villagesMap.has(mv.id)) {
            villagesMap.set(mv.id, {
              id: mv.id,
              code: mv.code,
              name_gu: mv.name_gu || mv.name_en || mv.code,
              name_en: mv.name_en || mv.code,
              taluka_id: mv.taluka_id,
              taluka_name_gu: (mv as any).taluka_name_gu || null,
              taluka_name_en: (mv as any).taluka_name_en || null,
              assigned_vo: null,
            });
          }
        }
      }

      // Talukas Map
      const talukasMap = new Map<string, TalukaOption>();
      if (Array.isArray(baseMeta.talukas)) {
        for (const t of baseMeta.talukas) {
          if (t && t.id) talukasMap.set(t.id, t);
        }
      }
      if (adminTalukasResult.status === 'fulfilled' && Array.isArray(adminTalukasResult.value)) {
        for (const mt of adminTalukasResult.value) {
          if (mt && mt.id && !talukasMap.has(mt.id)) {
            talukasMap.set(mt.id, {
              id: mt.id,
              code: mt.code,
              name_gu: mt.name_gu || mt.name_en || mt.code,
              name_en: mt.name_en || mt.code,
            });
          }
        }
      }

      const mergedVillages = Array.from(villagesMap.values());
      const mergedTalukas = Array.from(talukasMap.values());

      setCreationMeta({
        species,
        talukas: mergedTalukas,
        villages: mergedVillages,
        default_programmes: baseMeta.default_programmes || ['FMD', 'HS', 'BQ', 'BRUCELLOSIS', 'PPR'],
      });

      // Default select CATTLE and BUFFALO if nothing selected yet
      if (selectedSpecies.length === 0 && species.length > 0) {
        const defaultSelected = species
          .filter((s) => ['CATTLE', 'BUFFALO'].includes(s.code))
          .map((s) => s.code);
        setSelectedSpecies(defaultSelected.length > 0 ? defaultSelected : [species[0].code]);
      }
    } catch (err) {
      console.warn('Could not load campaign creation meta:', err);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadCreationMeta();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (diseaseCode) {
      masterService
        .listVaccines(apiBaseUrl, { activeOnly: true, diseaseCode })
        .then((vacs) => {
          setMasterVaccines(vacs);
          if (vacs.length > 0) {
            setSelectedVaccineCode(vacs[0].code);
          } else {
            setSelectedVaccineCode('OTHER');
          }
        })
        .catch(() => setMasterVaccines([]));
    }
  }, [diseaseCode, apiBaseUrl]);

  const compatibleVaccines = useMemo(() => {
    if (!selectedSpecies || selectedSpecies.length === 0) return masterVaccines;
    const filtered = masterVaccines.filter(
      (v) =>
        !v.applicable_species ||
        v.applicable_species.length === 0 ||
        v.applicable_species.some((sp) => selectedSpecies.includes(sp))
    );
    return filtered.length > 0 ? filtered : masterVaccines;
  }, [masterVaccines, selectedSpecies]);

  const handleOpenCreateModal = () => {
    setIsModalOpen(true);
    setFormErrors({});
    loadCreationMeta();
  };

  // Species Helpers
  const handleToggleSpecies = (sCode: string) => {
    setSelectedSpecies((prev) =>
      prev.includes(sCode) ? prev.filter((c) => c !== sCode) : [...prev, sCode]
    );
  };

  const handleSelectAllSpecies = () => {
    if (!creationMeta) return;
    setSelectedSpecies(creationMeta.species.map((s) => s.code));
  };

  const handleClearSpecies = () => {
    setSelectedSpecies([]);
  };

  // Village Helpers
  const handleToggleVillage = (vId: string) => {
    setSelectedVillages((prev) =>
      prev.includes(vId) ? prev.filter((id) => id !== vId) : [...prev, vId]
    );
  };

  const handleSelectAllVillages = () => {
    if (!creationMeta) return;
    setSelectedVillages((creationMeta.villages || []).map((v) => v.id));
  };

  const handleSelectAllInTaluka = () => {
    if (!creationMeta) return;
    const filtered = creationMeta.villages.filter(
      (v) => !selectedTalukaFilter || v.taluka_id === selectedTalukaFilter
    );
    const newIds = new Set([...selectedVillages, ...filtered.map((v) => v.id)]);
    setSelectedVillages(Array.from(newIds));
  };

  const handleClearVillages = () => {
    setSelectedVillages([]);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const val = campaignSchema.safeParse({
      code,
      name_gu: nameGu,
      name_en: nameEn || undefined,
      disease_code: diseaseCode,
      start_date: startDate,
      end_date: endDate,
      target_animals_count: targetCount ? Number(targetCount) : undefined,
    });

    if (!val.success) {
      const errMap: Record<string, string> = {};
      val.error.errors.forEach((err) => {
        if (err.path[0]) errMap[String(err.path[0])] = err.message;
      });
      setFormErrors(errMap);
      return;
    }

    if (selectedSpecies.length === 0) {
      setFormErrors((prev) => ({
        ...prev,
        species: 'ઓછામાં ઓછી એક પશુ કેટેગરી પસંદ કરવી ફરજિયાત છે.',
      }));
      return;
    }

    if (selectedVillages.length === 0) {
      setFormErrors((prev) => ({
        ...prev,
        villages: 'ઓછામાં ઓછું એક લક્ષિત ગામ પસંદ કરવું ફરજિયાત છે.',
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const displayName = nameGu.trim() + (nameEn.trim() ? ` (${nameEn.trim()})` : '');
      const selectedVacObj = masterVaccines.find((v) => v.code === selectedVaccineCode);
      const isCustom = selectedVaccineCode === 'OTHER' || !selectedVacObj;
      const finalVaccineName = isCustom ? customVaccineName.trim() : (selectedVacObj?.name_gu || selectedVacObj?.name_en || '');

      await dahoOpsService.createCampaign(apiBaseUrl, {
        code: code.trim(),
        name: displayName,
        disease_code: diseaseCode,
        vaccine_code: isCustom ? 'CUSTOM' : selectedVaccineCode,
        vaccine_name: finalVaccineName || undefined,
        custom_vaccine_name: isCustom ? customVaccineName.trim() : undefined,
        is_custom_vaccine: isCustom,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        target_animals_count: targetCount ? Number(targetCount) : undefined,
        village_ids: selectedVillages,
        species_codes: selectedSpecies,
        notes: notes.trim() || undefined,
      });

      setNotice({
        type: 'success',
        message: 'નવી રસીકરણ ઝુંબેશ સફળતાપૂર્વક શરૂ થઈ. સંબંધિત વેટરનરી અધિકારીઓ (VO) ને સૂચના મોકલાઈ ગઈ છે.',
      });
      setIsModalOpen(false);
      setCode('');
      setNameGu('');
      setNameEn('');
      setNotes('');
      setSelectedVillages([]);
      await loadCampaigns();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ઝુંબેશ બનાવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenMonitoring = async (campaign: CampaignItem) => {
    setSelectedCampaignForMonitoring(campaign);
    setIsMonitoringModalOpen(true);
    setIsLoadingMonitoring(true);
    try {
      const data = await dahoOpsService.getCampaignMonitoring(apiBaseUrl, campaign.id);
      setMonitoringData(data);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'મોનિટરિંગ ડેટા મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoadingMonitoring(false);
    }
  };

  const handleOpenDahoAssignStaff = async (villageItem: { village_id: string; village_name_gu?: string; village_name_en?: string; village_code?: string }) => {
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
        adminService.listVeterinaryOfficers(apiBaseUrl).catch(() => []),
        adminService.listFieldWorkers(apiBaseUrl).catch(() => []),
      ]);
      const combined: Array<{ id: string; full_name: string; username?: string | null; role?: string }> = [
        ...voList.map((v) => ({ id: v.id, full_name: `ડૉ. ${v.full_name || v.username || 'અજ્ઞાત'} (VO)`, username: v.username ?? '', role: 'VET_OFFICER' })),
        ...fwList.map((f) => ({ id: f.id, full_name: `${f.full_name || f.username || 'અજ્ઞાત'} (FW)`, username: f.username ?? '', role: 'FIELD_WORKER' })),
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

  const handleDahoSubmitAssignStaff = async (e: React.FormEvent) => {
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
      setNotice({
        type: 'success',
        message: `સ્ટાફ સફળતાપૂર્વક ${selectedMultiAssignVillageIds.length} ગામો માટે નિયુક્ત થયો અને સંબંધિત વપરાશકર્તાને સૂચના મોકલાઈ ગઈ.`,
      });
      setIsAssignStaffModalOpen(false);
      // Reload monitoring data
      const updated = await dahoOpsService.getCampaignMonitoring(apiBaseUrl, selectedCampaignForMonitoring.id);
      setMonitoringData(updated);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'સ્ટાફ સોંપવામાં નિષ્ફળ.',
      });
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

      setNotice({
        type: 'success',
        message:
          decision === 'APPROVE'
            ? `ગામ ${reviewVillageItem.village_name_gu} ની કામગીરી પ્રમાણિત અને મંજૂર થઈ.`
            : decision === 'REJECT'
            ? `ગામ ${reviewVillageItem.village_name_gu} ની કામગીરી સુધારણા માટે પરત મોકલાઈ.`
            : `ગામ ${reviewVillageItem.village_name_gu} ની કામગીરી પુનઃ ખોલવામાં આવી.`,
      });
      setIsVerificationReviewModalOpen(false);
      const updated = await dahoOpsService.getCampaignMonitoring(apiBaseUrl, selectedCampaignForMonitoring.id);
      setMonitoringData(updated);
    } catch (err: any) {
      alert(err?.message || 'ચકાસણી નિર્ણય નિષ્ફળ.');
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  // Filtered views
  const filteredSpecies = (creationMeta?.species || []).filter((s) => {
    if (!speciesSearch.trim()) return true;
    const q = speciesSearch.toLowerCase();
    return s.name_gu.toLowerCase().includes(q) || s.name_en.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  const filteredVillages = (creationMeta?.villages || []).filter((v) => {
    if (selectedTalukaFilter && v.taluka_id !== selectedTalukaFilter) return false;
    if (!villageSearch.trim()) return true;
    const q = villageSearch.trim().toLowerCase();
    return (
      (v.name_gu && v.name_gu.toLowerCase().includes(q)) ||
      (v.name_en && v.name_en.toLowerCase().includes(q)) ||
      (v.code && v.code.toLowerCase().includes(q)) ||
      (v.taluka_name_gu && v.taluka_name_gu.toLowerCase().includes(q)) ||
      (v.taluka_name_en && v.taluka_name_en.toLowerCase().includes(q))
    );
  });

  const selectedVillageDetails = (creationMeta?.villages || []).filter((v) =>
    selectedVillages.includes(v.id)
  );

  const columns: Column<CampaignItem>[] = [
    {
      key: 'name',
      header: 'ઝુંબેશ કોડ / નામ',
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1E293B]">{localizeCampaignName(row.name || row.name_gu || '')}</div>
          <div className="text-xs text-[#64748B] font-mono">{row.code}</div>
        </div>
      ),
    },
    {
      key: 'disease',
      header: 'રોગ લક્ષ્યાંક',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {row.disease_code || 'FMD / સામાન્ય'}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'સમયગાળો',
      render: (row) => (
        <div className="text-xs text-[#1E293B] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <span>{row.start_date || '-'} થી {row.end_date || '-'}</span>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'લક્ષ્યાંક પશુઓ',
      render: (row) => (
        <span className="font-semibold text-emerald-800">
          {row.target_animals_count ? `${row.target_animals_count} પશુઓ` : 'નિયત નથી'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => {
        const variant =
          row.status === 'ACTIVE'
            ? 'success'
            : row.status === 'DRAFT'
            ? 'warning'
            : row.status === 'CLOSED'
            ? 'neutral'
            : 'error';
        const labelMap: Record<string, string> = {
          ACTIVE: 'સક્રિય',
          DRAFT: 'ડ્રાફ્ટ',
          CLOSED: 'પૂર્ણ',
          CANCELLED: 'રદ',
        };
        return <StatusChip variant={variant} label={labelMap[row.status] || row.status} />;
      },
    },
    {
      key: 'actions',
      header: 'ક્રિયાઓ',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenMonitoring(row);
            }}
            leftIcon={<Eye className="w-3.5 h-3.5 text-[#135D43]" />}
          >
            મોનિટરિંગ
          </Button>

          {row.status === 'DRAFT' && (
            <Button
              variant="primary"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await dahoOpsService.activateCampaign(apiBaseUrl, row.id, {
                    start_date: row.start_date || new Date().toISOString().substring(0, 10),
                    end_date: row.end_date || undefined,
                  });
                  setNotice({
                    type: 'success',
                    message: `ઝુંબેશ ${row.name || row.code} સફળતાપૂર્વક સક્રિય થઈ.`,
                  });
                  await loadCampaigns();
                } catch (err: any) {
                  setNotice({
                    type: 'error',
                    message: err?.message || 'ઝુંબેશ સક્રિય કરવામાં નિષ્ફળ.',
                  });
                }
              }}
              leftIcon={<CheckCircle2 className="w-3 h-3" />}
            >
              સક્રિય કરો
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#135D43]" />
            રસીકરણ ઝુંબેશ (Vaccination Campaigns)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            જિલ્લા કક્ષાએ અધિકૃત રસીકરણ ઝુંબેશનું સંચાલન, સમયગાળો, ગામ-દીઠ VO સોંપણી અને લક્ષ્યાંક નિયંત્રણ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCampaigns} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            તાજું કરો
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            + નવી ઝુંબેશ
          </Button>
        </div>
      </div>

      {notice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Summary KPI Cards Grid — Unified Linear Style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <KpiCard
          label="કુલ ઝુંબેશો"
          value={isLoading ? '...' : campaigns.length}
          subtext="નોંધાયેલ તમામ રસીકરણ ઝુંબેશ"
          icon={<Megaphone className="w-3.5 h-3.5" />}
          iconVariant="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="સક્રિય ઝુંબેશો"
          value={isLoading ? '...' : campaigns.filter((c) => c.status === 'ACTIVE').length}
          subtext="હાલમાં ક્ષેત્રમાં ચાલુ ઝુંબેશ"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
        <KpiCard
          label="ડ્રાફ્ટ / આયોજિત"
          value={isLoading ? '...' : campaigns.filter((c) => c.status === 'DRAFT').length}
          subtext="સક્રિય કરવાની બાકી ઝુંબેશ"
          icon={<Clock className="w-3.5 h-3.5" />}
          iconVariant="amber"
          isLoading={isLoading}
        />
      </div>

      {isLoading ? (
        <StateView state="loading" message="ઝુંબેશ માહિતી લોડ થઈ રહી છે..." />
      ) : campaigns.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ રસીકરણ ઝુંબેશ નોંધાયેલ નથી"
          message="આ જિલ્લામાં હાલમાં કોઈ સક્રિય ઝુંબેશ નથી. નવી ઝુંબેશ શરૂ કરવા ઉપરનું બટન દબાવો."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable data={campaigns} columns={columns} keyExtractor={(c) => c.id} />
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 1. Create Campaign Modal with Animal Categories & Village Selection    */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="નવી રસીકરણ ઝુંબેશ પ્રારંભ કરો"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCampaign} className="space-y-5 max-h-[80vh] overflow-y-auto px-1 pr-2">
          {/* Step 1: Basic Campaign Details */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              ૧. ઝુંબેશની પ્રાથમિક વિગત (Basic Details)
            </h4>

            <FormField label="ઝુંબેશ કોડ" required error={formErrors.code}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="દા.ત. FMD-BOTAD-2026-R1"
                className="w-full px-3 py-2 text-sm border rounded-lg uppercase font-mono bg-white"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="ગુજરાતી નામ" required error={formErrors.name_gu}>
                <input
                  type="text"
                  value={nameGu}
                  onChange={(e) => setNameGu(e.target.value)}
                  placeholder="દા.ત. ખરવા-મોવાસા રાઉન્ડ ૧"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                />
              </FormField>
              <FormField label="અંગ્રેજી નામ (વૈકલ્પિક)" error={formErrors.name_en}>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="FMD Round 1"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="રોગ પસંદ કરો (Select Disease)" required error={formErrors.disease_code}>
                <select
                  value={diseaseCode}
                  onChange={(e) => setDiseaseCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
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
              </FormField>

              <FormField label="આયોજિત લક્ષ્યાંક પશુ સંખ્યા (Planned Target)" required error={formErrors.target_animals_count}>
                <input
                  type="number"
                  value={targetCount}
                  onChange={(e) => setTargetCount(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white font-mono"
                />
              </FormField>
            </div>

            {/* Vaccine Selection (Linked to Master + Custom Manual Fallback) */}
            <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200/80 space-y-2">
              <FormField label="રસી પસંદ કરો (Vaccine Formulary / Brand)" required>
                <select
                  value={selectedVaccineCode}
                  onChange={(e) => setSelectedVaccineCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white font-medium"
                >
                  {compatibleVaccines.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.verification_status === 'VERIFIED' ? '✓ [Verified] ' : '[Pending] '}
                      {v.name_gu} — {v.standard_dosage || '2ml'} ({v.administration_route || 'S/C'})
                    </option>
                  ))}
                  <option value="OTHER">+ અન્ય / જાતે દાખલ કરો (Enter Manually / Custom)</option>
                </select>
              </FormField>

              {selectedVaccineCode === 'OTHER' && (
                <div className="space-y-1.5 pt-1">
                  <FormField label="કસ્ટમ રસીનું નામ (Custom Vaccine Name)" required>
                    <input
                      type="text"
                      required
                      value={customVaccineName}
                      onChange={(e) => setCustomVaccineName(e.target.value)}
                      placeholder="દા.ત. ખાસ ઇમરજન્સી રસી બેચ #૧૨..."
                      className="w-full px-3 py-2 text-xs border rounded-lg bg-white border-amber-300 focus:ring-amber-500"
                    />
                  </FormField>
                  <p className="text-[11px] text-amber-800">
                    * આ રસી માત્ર આ ઝુંબેશ માટે સાચવવામાં આવશે અને વેટરનરી માસ્ટર ડેટાબેઝને દૂષિત કરશે નહીં.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="શરૂઆત તારીખ" required error={formErrors.start_date}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                />
              </FormField>
              <FormField label="સમાપ્તિ તારીખ" required error={formErrors.end_date}>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                />
              </FormField>
            </div>

            <FormField label="વધારાની વિગત / નોંધ">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="ઝુંબેશ અંગે ખાસ સૂચનાઓ..."
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
              />
            </FormField>
          </div>

          {/* Step 2: Animal Category Selection */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  ૨. પશુની કેટેગરી (Animal Category Selection) *
                </h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  આ ઝુંબેશ હેઠળ કયા પશુઓ પાત્ર રહેશે તે પસંદ કરો.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSpecies}
                  className="text-xs font-semibold text-emerald-800 hover:underline bg-white px-2 py-1 rounded border border-emerald-200"
                >
                  તમામ પસંદ કરો (Select All)
                </button>
                <button
                  type="button"
                  onClick={handleClearSpecies}
                  className="text-xs font-semibold text-slate-600 hover:underline bg-white px-2 py-1 rounded border border-slate-200"
                >
                  સાફ કરો (Clear)
                </button>
              </div>
            </div>

            {formErrors.species && (
              <p className="text-xs text-red-600 font-semibold">{formErrors.species}</p>
            )}

            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={speciesSearch}
                  onChange={(e) => setSpeciesSearch(e.target.value)}
                  placeholder="કેટેગરી શોધો (ગાય, ભેંસ, બકરી...)"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-white"
                />
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                પસંદ કરેલ: {selectedSpecies.length} / {creationMeta?.species?.length || 0}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {filteredSpecies.map((s) => {
                const isChecked = selectedSpecies.includes(s.code);
                return (
                  <label
                    key={s.code}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-emerald-100/70 border-emerald-400 text-emerald-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSpecies(s.code)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <div>{s.name_gu}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{s.name_en}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Step 3: Target Village Selection */}
          <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  ૩. લક્ષિત ગામોની પસંદગી (Target Village Selection) *
                </h4>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  ઝુંબેશ હેઠળ આવરી લેવાના ગામો પસંદ કરો. સંબંધિત વેટરનરી અધિકારી આપમેળે નિયુક્ત થશે.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllVillages}
                  className="text-xs font-semibold text-blue-800 hover:underline bg-white px-2 py-1 rounded border border-blue-200"
                >
                  તમામ ગામ પસંદ કરો (Select All)
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllInTaluka}
                  className="text-xs font-semibold text-blue-800 hover:underline bg-white px-2 py-1 rounded border border-blue-200"
                >
                  આ તાલુકાના તમામ (In Taluka)
                </button>
                <button
                  type="button"
                  onClick={handleClearVillages}
                  className="text-xs font-semibold text-slate-600 hover:underline bg-white px-2 py-1 rounded border border-slate-200"
                >
                  સાફ કરો (Clear)
                </button>
              </div>
            </div>

            {formErrors.villages && (
              <p className="text-xs text-red-600 font-semibold">{formErrors.villages}</p>
            )}

            {/* Quick Dropdown Selector from Master Data */}
            <div className="bg-white p-2.5 rounded-lg border border-blue-200 shadow-xs">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                માસ્ટર ડેટા ગામ ડ્રોપડાઉન (Select Village from Master Data Dropdown):
              </label>
              <select
                value=""
                onChange={(e) => {
                  const vId = e.target.value;
                  if (vId) {
                    handleToggleVillage(vId);
                  }
                }}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white shadow-xs focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- માસ્ટર ડેટામાંથી ગામ પસંદ કરો (ડ્રોપડાઉન યાદી) --</option>
                {(creationMeta?.villages || []).map((v) => {
                  const isSel = selectedVillages.includes(v.id);
                  return (
                    <option key={v.id} value={v.id}>
                      {isSel ? '✓ [પસંદ કરેલ] ' : '+ '} {v.name_gu} {v.name_en && v.name_en !== v.name_gu ? `(${v.name_en})` : ''} [કોડ: {v.code}] {v.assigned_vo ? `— VO: ${v.assigned_vo.full_name}` : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                ઉપરના ડ્રોપડાઉનમાંથી ગામ પસંદ કરીને ઉમેરો અથવા નીચેની યાદીમાંથી ચેકબોક્સ દ્વારા પસંદ કરો.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={villageSearch}
                  onChange={(e) => setVillageSearch(e.target.value)}
                  placeholder="ગામનું નામ અથવા કોડ શોધો..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTalukaFilter}
                  onChange={(e) => setSelectedTalukaFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white"
                >
                  <option value="">-- તમામ તાલુકા (All Talukas) --</option>
                  {(creationMeta?.talukas || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name_gu} ({t.name_en || t.code})
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                  પસંદ કરેલ: {selectedVillages.length}
                </span>
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1.5 border rounded-lg bg-white p-2">
              {filteredVillages.length === 0 ? (
                <p className="text-xs text-slate-400 p-2 text-center">કોઈ ગામ મળ્યું નથી.</p>
              ) : (
                filteredVillages.map((v) => {
                  const isChecked = selectedVillages.includes(v.id);
                  return (
                    <div
                      key={v.id}
                      onClick={() => handleToggleVillage(v.id)}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-blue-50 border-blue-400 text-blue-950 font-semibold'
                          : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleVillage(v.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div>
                          <div className="font-semibold">
                            {v.name_gu} {v.name_en && v.name_en !== v.name_gu ? `(${v.name_en})` : ''}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            કોડ: {v.code} | તાલુકો: {v.taluka_name_gu || '-'}
                          </div>
                        </div>
                      </div>

                      <div>
                        {v.assigned_vo ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                            VO: {v.assigned_vo.full_name}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                            કોઈ VO નથી (Unassigned)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Step 4: Preview of Selected Villages & VO Assignment */}
          {selectedVillageDetails.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
              <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-600" />
                પસંદ કરેલ ગામો અને વેટરનરી અધિકારી પૂર્વાવલોકન ({selectedVillageDetails.length} ગામ)
              </h5>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {selectedVillageDetails.map((v) => (
                  <div key={v.id} className="text-xs bg-white p-2 rounded border flex justify-between items-center">
                    <span className="font-semibold text-slate-800">
                      {v.name_gu} ({v.taluka_name_gu || v.code})
                    </span>
                    <span>
                      {v.assigned_vo ? (
                        <span className="text-emerald-700 font-medium">
                          ડૉ. {v.assigned_vo.full_name} ({v.assigned_vo.username || 'VO'})
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">બિન-સોંપાયેલ (DAHO સમીક્ષા કરશે)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              ઝુંબેશ બનાવો અને VO ને સોંપણી મોકલો
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. Detailed Campaign Monitoring Drill-Down Modal                       */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={isMonitoringModalOpen}
        onClose={() => setIsMonitoringModalOpen(false)}
        title={`ઝુંબેશ મોનિટરિંગ: ${selectedCampaignForMonitoring?.name || selectedCampaignForMonitoring?.code || ''}`}
        maxWidth="lg"
      >
        {isLoadingMonitoring ? (
          <StateView state="loading" message="ઝુંબેશ મોનિટરિંગ ડેટા લોડ થઈ રહ્યો છે..." />
        ) : !monitoringData ? (
          <StateView state="error" title="ડેટા મળ્યો નથી" message="આ ઝુંબેશ માટે મોનિટરિંગ માહિતી ઉપલબ્ધ નથી." />
        ) : (
          <div className="space-y-5 max-h-[80vh] overflow-y-auto px-1 pr-2">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-800 mb-1.5">
                <span>એકંદર પૂર્ણતા દર (Overall Completion)</span>
                <span className="font-mono text-emerald-700 font-bold">{monitoringData.overall_completion_percentage}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, monitoringData.overall_completion_percentage)}%` }}
                />
              </div>
            </div>

            {/* Village-Wise Breakdown Table */}
            <div>
              <h5 className="text-xs font-bold text-slate-800 mb-2">
                ગામ-વાર વેટરનરી અધિકારી સ્થિતિ અને રસીકરણ પ્રગતિ ({monitoringData.villages.length} ગામો)
              </h5>

              <div className="space-y-2">
                {monitoringData.villages.length === 0 ? (
                  <p className="text-xs text-slate-400">આ ઝુંબેશ હેઠળ કોઈ ગામ જોડાયેલ નથી.</p>
                ) : (
                  monitoringData.villages.map((v) => {
                    const statusBadge =
                      v.vo_acceptance_status === 'ACCEPTED' ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          ✓ સ્વીકૃત (Accepted)
                        </span>
                      ) : v.vo_acceptance_status === 'REJECTED' ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                          ✕ અસ્વીકૃત (Rejected)
                        </span>
                      ) : v.vo_acceptance_status === 'UNASSIGNED' ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          બિન-સોંપાયેલ
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          ⏳ પ્રતીક્ષામાં (Pending)
                        </span>
                      );

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
                            {statusBadge}
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
                              onClick={() => handleOpenDahoAssignStaff(v)}
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

                        {v.rejection_reason && (
                          <div className="p-2 rounded-lg bg-red-50 text-[11px] text-red-700 border border-red-200">
                            <strong>અસ્વીકાર કારણ:</strong> {v.rejection_reason}
                          </div>
                        )}

                        {v.assigned_fws && v.assigned_fws.length > 0 && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              સોંપાયેલ ક્ષેત્રીય કાર્યકરો:{' '}
                              <strong>{v.assigned_fws.map((f) => f.full_name).join(', ')}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setIsMonitoringModalOpen(false)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. Assign Staff to Campaign Village Modal (DAHO Direct Assignment)     */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={isAssignStaffModalOpen}
        onClose={() => setIsAssignStaffModalOpen(false)}
        title={`સ્ટાફ સોંપણી: ${assignTargetVillage?.village_name || ''}`}
      >
        <form onSubmit={handleDahoSubmitAssignStaff} className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs space-y-1.5 text-slate-700 font-medium">
            <div>
              ઝુંબેશ: <strong className="text-[#0F172A]">{selectedCampaignForMonitoring?.name || selectedCampaignForMonitoring?.code}</strong>
            </div>
            <div>
              લક્ષિત ગામ: <strong className="text-[#0F172A]">{assignTargetVillage?.village_name}</strong>
            </div>
            <p className="text-[11px] text-[#64748B] pt-0.5">
              પસંદ કરેલ વેટરનરી અધિકારી (VO) અથવા ક્ષેત્રીય કાર્યકર (FW) ને આ ઝુંબેશ હેઠળ ગામ સોંપાશે અને તેમના ડેશબોર્ડ પર તાત્કાલિક દેખાશે.
            </p>
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
            <Button variant="outline" type="button" onClick={() => setIsAssignStaffModalOpen(false)}>
              રદ કરો
            </Button>
            <Button
              variant="primary"
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

      {/* ---------------------------------------------------------------------- */}
      {/* 4. Review & Verify Village Campaign Completion Modal                   */}
      {/* ---------------------------------------------------------------------- */}
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

          {/* Stats recap */}
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

          {/* Field notes */}
          {reviewVillageItem?.completion_notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700 block mb-1">ક્ષેત્રીય કાર્યકર / VO પૂર્ણતા નોંધ:</span>
              <p className="text-slate-800 leading-relaxed">{reviewVillageItem.completion_notes}</p>
            </div>
          )}

          {/* Evidence photos */}
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

          {/* Verification Notes */}
          <FormField label="ચકાસણી નોંધ (Verification Notes)">
            <textarea
              rows={2}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="દા.ત. ક્ષેત્રીય કામગીરી ચકાસી સંતોષકારક જણાતાં પૂર્ણતા પ્રમાણપત્ર મંજૂર કરવામાં આવે છે..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          {/* Rejection / Rework Reason */}
          <FormField label="અસ્વીકાર અથવા સુધારણા કારણ (જો અસ્વીકાર કરવો હોય તો)">
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="દા.ત. ૨૦% પશુઓ હજી બાકી છે / નોંધાયેલ રસીકરણ ડેટામાં તફાવત છે..."
              className="w-full px-3 py-2 text-xs border rounded-lg border-red-200 bg-red-50/30"
            />
          </FormField>

          {/* Action buttons */}
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
