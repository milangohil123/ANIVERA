import React, { useEffect, useState, useMemo } from 'react';
import { z } from 'zod';
import { Button } from '../../components/common/Button';
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
import { adminService, type DistrictItem } from '../../services/adminService';
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
  Globe,
  Filter,
  Layers,
  Sparkles,
  MapPin,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
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

export const AdminCampaignsView: React.FC = () => {
  const { apiBaseUrl } = useAuth();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Geographic Master Data
  const [allDistricts, setAllDistricts] = useState<DistrictItem[]>([]);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [districtSearch, setDistrictSearch] = useState('');

  // Creation Metadata
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
  const [targetCount, setTargetCount] = useState<string>('10000');
  const [notes, setNotes] = useState('');

  // Animal Category (Species) Selection
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(['CATTLE', 'BUFFALO']);

  // Animal Age Eligibility (in months)
  const [minAgeMonths, setMinAgeMonths] = useState<string>('6');
  const [maxAgeMonths, setMaxAgeMonths] = useState<string>('36');
  const [enableAgeFilter, setEnableAgeFilter] = useState<boolean>(true);

  // Vaccination Frequency & Schedule
  const [isRecurringSchedule, setIsRecurringSchedule] = useState<boolean>(true);
  const [intervalMonths, setIntervalMonths] = useState<string>('6');

  // Village Selection Customization
  const [villageScopeMode, setVillageScopeMode] = useState<'ALL_VILLAGES' | 'CUSTOM_VILLAGES'>('ALL_VILLAGES');
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
  const [villageSearch, setVillageSearch] = useState('');
  const [selectedTalukaFilter, setSelectedTalukaFilter] = useState('');

  // Search & Filter in Campaigns List
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Monitoring Drill-down Modal State
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);
  const [selectedCampaignForMonitoring, setSelectedCampaignForMonitoring] = useState<CampaignItem | null>(null);
  const [monitoringData, setMonitoringData] = useState<CampaignMonitoringData | null>(null);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);

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

  const loadDistrictsAndMeta = async () => {
    try {
      const [distResult, metaResult, disResult] = await Promise.allSettled([
        adminService.listDistricts(apiBaseUrl),
        dahoOpsService.getCreationMeta(apiBaseUrl),
        masterService.listDiseases(apiBaseUrl, { activeOnly: true }),
      ]);

      if (distResult.status === 'fulfilled' && Array.isArray(distResult.value)) {
        setAllDistricts(distResult.value);
        // Default select all 34 districts
        if (selectedDistrictIds.length === 0) {
          setSelectedDistrictIds(distResult.value.map((d) => d.id));
        }
      }

      if (disResult.status === 'fulfilled' && Array.isArray(disResult.value)) {
        setMasterDiseases(disResult.value);
      }

      if (metaResult.status === 'fulfilled' && metaResult.value) {
        setCreationMeta((prev) => ({
          ...prev,
          species: metaResult.value.species?.length ? metaResult.value.species : DEFAULT_SPECIES,
          talukas: metaResult.value.talukas || [],
          villages: metaResult.value.villages || [],
          default_programmes: metaResult.value.default_programmes || ['FMD', 'HS', 'BQ', 'BRUCELLOSIS', 'PPR'],
        }));
      }
    } catch (err) {
      console.warn('Error loading districts or creation metadata:', err);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadDistrictsAndMeta();
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

  const handleOpenCreateModal = () => {
    setIsModalOpen(true);
    setFormErrors({});
    if (allDistricts.length > 0 && selectedDistrictIds.length === 0) {
      setSelectedDistrictIds(allDistricts.map((d) => d.id));
    }
  };

  const generateAutoCode = () => {
    const year = new Date().getFullYear();
    const dCode = diseaseCode || 'STATE';
    const rand = Math.floor(100 + Math.random() * 900);
    setCode(`CAMP-GUJ-${year}-${dCode}-${rand}`);
  };

  // District Selection Handlers
  const handleToggleDistrict = (distId: string) => {
    setSelectedDistrictIds((prev) =>
      prev.includes(distId) ? prev.filter((id) => id !== distId) : [...prev, distId]
    );
  };

  const handleSelectAllDistricts = () => {
    setSelectedDistrictIds(allDistricts.map((d) => d.id));
  };

  const handleDeselectAllDistricts = () => {
    setSelectedDistrictIds([]);
  };

  const filteredDistricts = useMemo(() => {
    if (!districtSearch.trim()) return allDistricts;
    const q = districtSearch.toLowerCase();
    return allDistricts.filter(
      (d) =>
        d.name_gu.toLowerCase().includes(q) ||
        d.name_en.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q)
    );
  }, [allDistricts, districtSearch]);

  // Species Selection Handlers
  const handleToggleSpecies = (sCode: string) => {
    setSelectedSpecies((prev) =>
      prev.includes(sCode) ? prev.filter((c) => c !== sCode) : [...prev, sCode]
    );
  };

  const handleSelectAllSpecies = () => {
    setSelectedSpecies((creationMeta.species || DEFAULT_SPECIES).map((s) => s.code));
  };

  const handleDeselectAllSpecies = () => {
    setSelectedSpecies([]);
  };

  // Village Selection Handlers (for Customization)
  const availableVillages = useMemo(() => {
    if (!creationMeta.villages) return [];
    // Only villages belonging to selected districts
    let vList = creationMeta.villages;
    if (selectedDistrictIds.length > 0) {
      vList = vList.filter((v: any) => !v.district_id || selectedDistrictIds.includes(v.district_id));
    }
    if (selectedTalukaFilter) {
      vList = vList.filter((v) => v.taluka_id === selectedTalukaFilter);
    }
    if (villageSearch.trim()) {
      const q = villageSearch.toLowerCase();
      vList = vList.filter(
        (v) =>
          v.name_gu.toLowerCase().includes(q) ||
          v.name_en.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q)
      );
    }
    return vList;
  }, [creationMeta.villages, selectedDistrictIds, selectedTalukaFilter, villageSearch]);

  const handleToggleVillage = (vId: string) => {
    setSelectedVillages((prev) =>
      prev.includes(vId) ? prev.filter((id) => id !== vId) : [...prev, vId]
    );
  };

  const handleSelectAllVillagesInScope = () => {
    const newIds = new Set([...selectedVillages, ...availableVillages.map((v) => v.id)]);
    setSelectedVillages(Array.from(newIds));
  };

  const handleDeselectAllVillages = () => {
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

    if (new Date(endDate) < new Date(startDate)) {
      setFormErrors((prev) => ({
        ...prev,
        end_date: 'સમાપ્તિ તારીખ શરૂઆત તારીખ કરતાં પહેલાં હોઈ શકતી નથી',
      }));
      return;
    }

    if (selectedDistrictIds.length === 0) {
      setFormErrors((prev) => ({
        ...prev,
        district_ids: 'ઓછામાં ઓછો એક જિલ્લો પસંદ કરવો ફરજિયાત છે.',
      }));
      return;
    }

    if (selectedSpecies.length === 0) {
      setFormErrors((prev) => ({
        ...prev,
        species_codes: 'ઓછામાં ઓછી એક પશુ કેટેગરી પસંદ કરવી ફરજિયાત છે.',
      }));
      return;
    }

    let minAgeVal: number | undefined = undefined;
    let maxAgeVal: number | undefined = undefined;
    if (enableAgeFilter) {
      minAgeVal = minAgeMonths ? parseInt(minAgeMonths, 10) : undefined;
      maxAgeVal = maxAgeMonths ? parseInt(maxAgeMonths, 10) : undefined;
      if (minAgeVal !== undefined && maxAgeVal !== undefined && maxAgeVal < minAgeVal) {
        setFormErrors((prev) => ({
          ...prev,
          max_age_months: 'મહત્તમ ઉંમર લઘુત્તમ ઉંમર કરતાં ઓછી હોઈ શકતી નથી.',
        }));
        return;
      }
    }

    const selectedVac = masterVaccines.find((v) => v.code === selectedVaccineCode);
    const isCustom = selectedVaccineCode === 'OTHER' || !selectedVac;

    try {
      setIsSubmitting(true);
      await dahoOpsService.createCampaign(apiBaseUrl, {
        code,
        name: nameGu,
        disease_code: diseaseCode,
        vaccine_code: isCustom ? undefined : selectedVaccineCode,
        vaccine_name: isCustom ? customVaccineName : selectedVac?.name_gu || selectedVac?.name_en,
        custom_vaccine_name: isCustom ? customVaccineName : undefined,
        is_custom_vaccine: isCustom,
        start_date: startDate,
        end_date: endDate,
        target_animals_count: targetCount ? Number(targetCount) : undefined,
        district_ids: selectedDistrictIds,
        scope_type: 'STATEWIDE',
        min_age_months: minAgeVal,
        max_age_months: maxAgeVal,
        village_ids: villageScopeMode === 'CUSTOM_VILLAGES' ? selectedVillages : [],
        species_codes: selectedSpecies,
        interval_months: isRecurringSchedule && intervalMonths ? parseInt(intervalMonths, 10) : undefined,
        is_recurring_schedule: isRecurringSchedule,
        notes: notes.trim() || undefined,
        programmes: selectedSpecies.map((sc) => ({
          species_code: sc,
          programme_code: diseaseCode,
        })),
      });

      setNotice({
        type: 'success',
        message: `રાજ્યવ્યાપી રસીકરણ ઝુંબેશ '${nameGu}' સફળતાપૂર્વક તૈયાર કરવામાં આવી અને તમામ ${selectedDistrictIds.length} જિલ્લાઓમાં પ્રસિદ્ધ કરાઈ.`,
      });
      setIsModalOpen(false);
      resetForm();
      loadCampaigns();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રાજ્યવ્યાપી ઝુંબેશ બનાવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCode('');
    setNameGu('');
    setNameEn('');
    setDiseaseCode('FMD');
    setSelectedVaccineCode('');
    setCustomVaccineName('');
    setStartDate('');
    setEndDate('');
    setTargetCount('10000');
    setNotes('');
    setSelectedSpecies(['CATTLE', 'BUFFALO']);
    setMinAgeMonths('6');
    setMaxAgeMonths('36');
    setEnableAgeFilter(true);
    setVillageScopeMode('ALL_VILLAGES');
    setSelectedVillages([]);
    setSelectedTalukaFilter('');
    setFormErrors({});
  };

  const handleOpenMonitoring = async (camp: CampaignItem) => {
    setSelectedCampaignForMonitoring(camp);
    setIsMonitoringModalOpen(true);
    setIsLoadingMonitoring(true);
    try {
      const data = await dahoOpsService.getCampaignMonitoring(apiBaseUrl, camp.id);
      setMonitoringData(data);
    } catch (err) {
      console.warn('Error fetching campaign monitoring data:', err);
    } finally {
      setIsLoadingMonitoring(false);
    }
  };

  // KPIs
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE').length;
  const closedCampaigns = campaigns.filter((c) => c.status === 'CLOSED').length;
  const avgCoverage = useMemo(() => {
    const withCov = campaigns.filter((c) => typeof c.coverage_pct === 'number');
    if (withCov.length === 0) return 0;
    const sum = withCov.reduce((acc, c) => acc + (c.coverage_pct || 0), 0);
    return Math.round((sum / withCov.length) * 10) / 10;
  }, [campaigns]);

  // Filtered campaigns for display
  const displayCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesCode = c.code.toLowerCase().includes(q);
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesDisease = (c.disease_name || c.disease_code || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesDisease) return false;
      }
      return true;
    });
  }, [campaigns, statusFilter, searchFilter]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                રાજ્યવ્યાપી રસીકરણ ઝુંબેશો (Statewide Vaccination Campaigns)
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                રાજ્ય કક્ષાના સામૂહિક રસીકરણ અભિયાનોનું આયોજન, લક્ષ્યાંક નિર્ધારણ અને તમામ ૩૪ જિલ્લાઓમાં પ્રગતિ મોનિટરિંગ
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadCampaigns}
            icon={<RotateCcw className="w-4 h-4" />}
            disabled={isLoading}
          >
            રીફ્રેશ
          </Button>
          <Button
            variant="primary"
            onClick={handleOpenCreateModal}
            icon={<Plus className="w-4 h-4" />}
            className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
          >
            + નવી રાજ્યવ્યાપી ઝુંબેશ શરૂ કરો
          </Button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-xs underline hover:opacity-80"
          >
            બંધ કરો
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="કુલ ઝુંબેશો (Total Campaigns)"
          value={totalCampaigns}
          icon={<Megaphone className="w-5 h-5 text-emerald-700" />}
          changeLabel="રાજ્ય કક્ષાએ રેકોર્ડ થયેલ"
        />
        <KpiCard
          title="સક્રિય ઝુંબેશો (Active Drives)"
          value={activeCampaigns}
          icon={<CheckCircle2 className="w-5 h-5 text-teal-600" />}
          changeLabel="હાલ પ્રગતિમાં"
        />
        <KpiCard
          title="સરેરાશ કવરેજ દર (Statewide Coverage)"
          value={`${avgCoverage}%`}
          icon={<Globe className="w-5 h-5 text-blue-600" />}
          changeLabel="તમામ જિલ્લાઓનો એકંદર દર"
        />
        <KpiCard
          title="સંપૂર્ણ થયેલ ઝુંબેશો (Concluded)"
          value={closedCampaigns}
          icon={<Clock className="w-5 h-5 text-slate-600" />}
          changeLabel="સફળતાપૂર્વક પૂર્ણ"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-gray-500 uppercase">સ્થિતિ:</span>
          {(['ALL', 'ACTIVE', 'DRAFT', 'CLOSED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'ALL' && 'તમામ'}
              {st === 'ACTIVE' && 'સક્રિય (Active)'}
              {st === 'DRAFT' && 'ડ્રાફ્ટ (Draft)'}
              {st === 'CLOSED' && 'સંપૂર્ણ (Closed)'}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="કોડ અથવા નામથી શોધો..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mb-3" />
          <p className="text-sm text-gray-500">ઝુંબેશ ડેટા લોડ થઈ રહ્યો છે...</p>
        </div>
      ) : displayCampaigns.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">કોઈ ઝુંબેશ મળી નથી</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            હાલમાં કોઈ રાજ્યવ્યાપી રસીકરણ ઝુંબેશ સક્રિય નથી. ઉપરના બટન પર ક્લિક કરીને નવી રાજ્યવ્યાપી ઝુંબેશ શરૂ કરો.
          </p>
          <Button
            variant="primary"
            onClick={handleOpenCreateModal}
            icon={<Plus className="w-4 h-4" />}
            className="mt-4 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            નવી ઝુંબેશ શરૂ કરો
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayCampaigns.map((camp) => {
            const cov = typeof camp.coverage_pct === 'number' ? camp.coverage_pct : 0;
            const isStatewide = camp.scope_type === 'STATEWIDE' || !camp.district_id;
            return (
              <div
                key={camp.id}
                className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {camp.code}
                        </span>
                        <StatusChip status={camp.status} />
                        {isStatewide && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Globe className="w-3 h-3 text-emerald-600" /> રાજ્યવ્યાપી (Statewide)
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-gray-900 line-clamp-2">
                        {camp.name}
                      </h3>
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">લક્ષિત રોગ:</span>
                      <span className="font-semibold text-gray-800">
                        {camp.disease_name || camp.disease_code || 'FMD'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">પાત્ર પશુઓ:</span>
                      <span className="font-semibold text-gray-800">
                        {camp.target_species || 'ગાય / ભેંસ'}
                      </span>
                    </div>

                    {(camp.min_age_months !== null && camp.min_age_months !== undefined ||
                      camp.max_age_months !== null && camp.max_age_months !== undefined) && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">પાત્ર વય મર્યાદા:</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {camp.min_age_months ?? 0} થી {camp.max_age_months ?? 'કોઈ મર્યાદા નહિ'} મહિના
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">સમયગાળો:</span>
                      <span className="font-mono text-[11px] text-gray-700">
                        {camp.start_date || 'અનિર્ણિત'} થી {camp.end_date || 'અનિર્ણિત'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">લક્ષિત પશુધન:</span>
                      <span className="font-semibold text-gray-800">
                        {camp.target_animals_count?.toLocaleString() || 'પ્રક્રિયામાં'} ડોઝ
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-500 font-medium">કવરેજ પ્રગતિ:</span>
                      <span className="font-bold text-emerald-700">{cov}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, cov))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100">
                  <Button
                    variant="outline"
                    className="w-full text-xs font-semibold py-2 justify-center border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
                    icon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenMonitoring(camp)}
                  >
                    મોનિટરિંગ અને વિગતો
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Admin Statewide Campaign Creation Modal                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="નવી રાજ્યવ્યાપી રસીકરણ ઝુંબેશ શરૂ કરો (Create Statewide Campaign)"
        size="xl"
      >
        <form onSubmit={handleCreateCampaign} className="space-y-6">
          {/* Header Notice */}
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900 leading-relaxed">
            <Globe className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">રાજ્ય કક્ષાની સીધી ઝુંબેશ નીતિ (Statewide Campaign Architecture)</p>
              <p className="mt-0.5 text-emerald-800">
                Admin દ્વારા નિર્મિત ઝુંબેશ સમગ્ર રાજ્યમાં આપમેળે <strong>Admin → DAHO → TAHO → VO/FW → Eligible Farmers / Cooperatives</strong> ના અધિકારક્ષેત્રમાં વહેંચાશે. સંબંધિત અધિકારીઓ અને માત્ર પાત્ર પશુપાલકોને જ સૂચના મળશે.
              </p>
            </div>
          </div>

          {/* Section 1: Campaign Reference & Naming */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
              <Megaphone className="w-4 h-4 text-emerald-700" /> ૧. ઝુંબેશ ઓળખ અને મૂળભૂત વિગતો
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <FormField label="ઝુંબેશ કોડ *" error={formErrors.code}>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CAMP-GUJ-2026-FMD-01"
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={generateAutoCode}
                      className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg font-medium shrink-0"
                      title="ઓટો-જનરેટ કોડ"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField label="ઝુંબેશનું નામ (ગુજરાતી) *" error={formErrors.name_gu}>
                  <input
                    type="text"
                    value={nameGu}
                    onChange={(e) => setNameGu(e.target.value)}
                    placeholder="e.g. રાજ્યવ્યાપી ખરવા-મોવાસા (FMD) સામૂહિક રસીકરણ અભિયાન - રાઉન્ડ ૧"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </FormField>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="English Name (Optional)">
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Statewide FMD Saturation Drive"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </FormField>

              <FormField label="લક્ષિત રોગ (Target Disease) *" error={formErrors.disease_code}>
                <select
                  value={diseaseCode}
                  onChange={(e) => setDiseaseCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  {masterDiseases.length > 0 ? (
                    masterDiseases.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name_gu} ({d.code})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="FMD">FMD (ખુરપકા-મોંહપકા)</option>
                      <option value="HS">HS (ગળસૂંઠો)</option>
                      <option value="BQ">BQ (ગાઠીયો તાવ)</option>
                      <option value="BRUCELLOSIS">બ્રુસેલોસિસ (Brucellosis)</option>
                      <option value="PPR">PPR (બકરી પ્લેગ)</option>
                      <option value="LSD">LSD (લમ્પી સ્કીન ડીસીઝ)</option>
                    </>
                  )}
                </select>
              </FormField>

              <FormField label="રસી પસંદગી (Vaccine Master)">
                <select
                  value={selectedVaccineCode}
                  onChange={(e) => setSelectedVaccineCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  {masterVaccines.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.name_gu || v.name_en} ({v.code})
                    </option>
                  ))}
                  <option value="OTHER">+ અન્ય / કસ્ટમ રસી દાખલ કરો</option>
                </select>
              </FormField>
            </div>

            {selectedVaccineCode === 'OTHER' && (
              <FormField label="કસ્ટમ રસીનું નામ (Custom Vaccine Display Name)">
                <input
                  type="text"
                  value={customVaccineName}
                  onChange={(e) => setCustomVaccineName(e.target.value)}
                  placeholder="e.g. રસીનું પ્રમાણિત નામ અથવા બેચ ઓળખ"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </FormField>
            )}
          </div>

          {/* Section 2: Animal Species Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" /> ૨. પાત્ર પશુ કેટેગરી (Animal Species Eligibility) *
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSpecies}
                  className="text-[11px] text-emerald-700 font-semibold hover:underline"
                >
                  તમામ પસંદ કરો (Select All)
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllSpecies}
                  className="text-[11px] text-gray-500 font-semibold hover:underline"
                >
                  પસંદગી રદ કરો (Deselect All)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {(creationMeta.species || DEFAULT_SPECIES).map((sp) => {
                const isChecked = selectedSpecies.includes(sp.code);
                return (
                  <label
                    key={sp.code}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSpecies(sp.code)}
                      className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-600 w-3.5 h-3.5"
                    />
                    <span>{sp.name_gu}</span>
                  </label>
                );
              })}
            </div>
            {formErrors.species_codes && (
              <p className="text-xs text-rose-600 font-medium">{formErrors.species_codes}</p>
            )}
          </div>

          {/* Section 3: Animal Age Eligibility (in Months) */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-700" /> ૩. પશુ વય મર્યાદા પાત્રતા (Animal Age Eligibility)
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  જે પશુઓની જન્મ તારીખ અથવા ઉંમર નોંધાયેલ નથી, તેઓ આપમેળે બાકાત રહેશે.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAgeFilter}
                  onChange={(e) => setEnableAgeFilter(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
                />
                વય મર્યાદા સક્રિય કરો
              </label>
            </div>

            {enableAgeFilter && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 pt-2 border-t border-gray-200">
                <FormField
                  label="લઘુત્તમ ઉંમર (મહિના / Months)"
                  error={formErrors.min_age_months}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={minAgeMonths}
                      onChange={(e) => setMinAgeMonths(e.target.value)}
                      placeholder="e.g. 6"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                    <span className="text-xs text-gray-500 shrink-0 font-medium">મહિના (Mo)</span>
                  </div>
                </FormField>

                <FormField
                  label="મહત્તમ ઉંમર (મહિના / Months)"
                  error={formErrors.max_age_months}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={maxAgeMonths}
                      onChange={(e) => setMaxAgeMonths(e.target.value)}
                      placeholder="e.g. 36"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                    <span className="text-xs text-gray-500 shrink-0 font-medium">મહિના (Mo)</span>
                  </div>
                </FormField>
              </div>
            )}
          </div>

          {/* Section 3.5: Vaccination Frequency & Schedule */}
          <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5 font-heading">
                  <RotateCcw className="w-4 h-4 text-[#135D43]" /> ૩.૫. રસીકરણ આવર્તન અને શેડ્યૂલ (Vaccination Frequency & Interval)
                </h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  શેડ્યૂલ આધારિત રસીકરણમાં પ્રાણીના છેલ્લા રસીકરણ મુજબ આપમેળે આગામી ડોઝની તારીખ (Next Due Date) ગણાશે.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurringSchedule}
                  onChange={(e) => setIsRecurringSchedule(e.target.checked)}
                  className="rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                />
                શેડ્યૂલ-આધારિત પુનરાવર્તન સક્રિય
              </label>
            </div>

            {isRecurringSchedule && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 pt-2 border-t border-emerald-200/70">
                <FormField label="રસીકરણ આવર્તન અંતરાલ (Interval) *">
                  <select
                    value={intervalMonths}
                    onChange={(e) => setIntervalMonths(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-medium text-emerald-950"
                  >
                    <option value="6">દર ૬ મહિને (Every 6 Months - Bi-annual / FMD/HS/BQ સ્ટાન્ડર્ડ)</option>
                    <option value="12">દર ૧૨ મહિને (Every 12 Months - Annual / વાર્ષિક રસીકરણ)</option>
                    <option value="3">દર ૩ મહિને (Every 3 Months - Quarterly / ત્રિમાસિક)</option>
                    <option value="24">દર ૨૪ મહિને (Every 2 Years / ૨ વર્ષ)</option>
                    <option value="36">દર ૩૬ મહિને (Every 3 Years / PPR સ્ટાન્ડર્ડ)</option>
                  </select>
                </FormField>

                <div className="bg-white p-3 rounded-lg border border-emerald-200 flex flex-col justify-center">
                  <span className="text-[10px] text-emerald-700 font-semibold uppercase">શેડ્યૂલ ગણતરી પૂર્વાવલોકન</span>
                  <p className="text-xs font-bold text-emerald-950 mt-0.5">
                    આગામી ડોઝ: રસીકરણ તારીખ + {intervalMonths} મહિના
                  </p>
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    ખેડૂત અને વેટરનરી અધિકારીને મુદતના ૧૫ દિવસ પૂર્વે આપમેળે રિમાઇન્ડર મોકલાશે.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: District Selection (All 34 Gujarat Districts) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-1.5">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-700" /> ૪. લક્ષિત જિલ્લા પસંદગી (Target Districts) *
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {selectedDistrictIds.length} / {allDistricts.length} પસંદિત
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllDistricts}
                  className="text-[11px] text-emerald-700 font-semibold hover:underline"
                >
                  તમામ ૩૪ જિલ્લા પસંદ કરો (Select All)
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllDistricts}
                  className="text-[11px] text-gray-500 font-semibold hover:underline"
                >
                  પસંદગી રદ કરો (Deselect All)
                </button>
              </div>
            </div>

            {/* Quick District Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="જિલ્લો શોધો (Search District by Name or Code)..."
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* District Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border border-gray-200 rounded-xl bg-gray-50">
              {filteredDistricts.map((d) => {
                const isSelected = selectedDistrictIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleDistrict(d.id)}
                      className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-600 w-3.5 h-3.5"
                    />
                    <span className="truncate">{d.name_gu}</span>
                  </label>
                );
              })}
            </div>
            {formErrors.district_ids && (
              <p className="text-xs text-rose-600 font-medium">{formErrors.district_ids}</p>
            )}
          </div>

          {/* Section 5: Village Scope Customization */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-emerald-700" /> ૫. ગ્રામીણ કક્ષા નિર્ધારણ (Village-Level Customization)
            </h4>

            <div className="flex flex-col sm:flex-row gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="village_scope_mode"
                  checked={villageScopeMode === 'ALL_VILLAGES'}
                  onChange={() => setVillageScopeMode('ALL_VILLAGES')}
                  className="text-emerald-700 focus:ring-emerald-600"
                />
                પસંદ કરેલા જિલ્લાઓના તમામ ગામો (All Villages in Selected Districts - Recommended)
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="village_scope_mode"
                  checked={villageScopeMode === 'CUSTOM_VILLAGES'}
                  onChange={() => setVillageScopeMode('CUSTOM_VILLAGES')}
                  className="text-emerald-700 focus:ring-emerald-600"
                />
                ચોક્કસ ગામો કસ્ટમાઇઝ કરો (Customize Specific Villages)
              </label>
            </div>

            {villageScopeMode === 'CUSTOM_VILLAGES' && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 justify-between">
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      placeholder="ગામ શોધો..."
                      value={villageSearch}
                      onChange={(e) => setVillageSearch(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 w-full sm:w-60 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                    <select
                      value={selectedTalukaFilter}
                      onChange={(e) => setSelectedTalukaFilter(e.target.value)}
                      className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    >
                      <option value="">તમામ તાલુકા</option>
                      {creationMeta.talukas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name_gu}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={handleSelectAllVillagesInScope}
                      className="text-xs text-emerald-700 font-semibold hover:underline"
                    >
                      તમામ ઉમેરો ({availableVillages.length})
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllVillages}
                      className="text-xs text-gray-500 font-semibold hover:underline"
                    >
                      પસંદગી રદ કરો
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                  {availableVillages.map((v) => {
                    const isSelected = selectedVillages.includes(v.id);
                    return (
                      <label
                        key={v.id}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-xs cursor-pointer border ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                            : 'border-transparent hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleVillage(v.id)}
                          className="rounded text-emerald-700 w-3 h-3"
                        />
                        <span className="truncate">{v.name_gu}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="text-[11px] text-gray-500">
                  કુલ {selectedVillages.length} ગામો વ્યક્તિગત રીતે પસંદ કરેલા છે.
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Campaign Dates & Target Animals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="શરૂઆત તારીખ (Start Date) *" error={formErrors.start_date}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </FormField>

            <FormField label="સમાપ્તિ તારીખ (End Date) *" error={formErrors.end_date}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </FormField>

            <FormField label="અંદાજિત લક્ષ્યાંક પશુધન (Target Count) *" error={formErrors.target_animals_count}>
              <input
                type="number"
                min="1"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </FormField>
          </div>

          {/* Section 7: Guidelines / Notes */}
          <FormField label="વહીવટી માર્ગદર્શિકા / સૂચનાઓ (Administrative Guidelines & Notes)">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. તમામ DAHO અને TAHO અધિકારીઓએ પોતાના કાર્યક્ષેત્રના ગામોમાં સ્ટાફ ફાળવણી કરવી..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </FormField>

          {/* Scope Review Card */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" /> ઝુંબેશ પ્રસિદ્ધિ સારાંશ (Review Summary):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-gray-500">જિલ્લા વ્યાપ:</span>{' '}
                <strong>{selectedDistrictIds.length} જિલ્લાઓ</strong>
              </div>
              <div>
                <span className="text-gray-500">પાત્ર પશુઓ:</span>{' '}
                <strong>{selectedSpecies.join(', ')}</strong>
              </div>
              <div>
                <span className="text-gray-500">વય મર્યાદા:</span>{' '}
                <strong>{enableAgeFilter ? `${minAgeMonths}-${maxAgeMonths} મહિના` : 'તમામ ઉંમર'}</strong>
              </div>
              <div>
                <span className="text-gray-500">ગામ વ્યાપ:</span>{' '}
                <strong>{villageScopeMode === 'ALL_VILLAGES' ? 'સમગ્ર જિલ્લાઓ' : `${selectedVillages.length} ગામો`}</strong>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              રદ કરો
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
            >
              {isSubmitting ? 'પ્રસિદ્ધ થઈ રહી છે...' : 'રાજ્યવ્યાપી ઝુંબેશ પ્રસિદ્ધ કરો (Publish Campaign)'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* Campaign Monitoring Drilldown Modal                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isMonitoringModalOpen}
        onClose={() => setIsMonitoringModalOpen(false)}
        title={`ઝુંબેશ મોનિટરિંગ: ${selectedCampaignForMonitoring?.name || ''} (${selectedCampaignForMonitoring?.code || ''})`}
        size="xl"
      >
        {isLoadingMonitoring ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mb-2" />
            <p className="text-xs text-gray-500">મોનિટરિંગ ડેટા લોડ થઈ રહ્યો છે...</p>
          </div>
        ) : !monitoringData ? (
          <div className="p-8 text-center text-xs text-gray-500">
            કોઈ મોનિટરિંગ માહિતી ઉપલબ્ધ નથી.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Completion Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-xs text-gray-500">કુલ પાત્ર પશુધન:</span>
                <p className="text-base font-bold text-gray-900 mt-0.5">
                  {monitoringData.actual_eligible_count?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">રસીકરણ થયેલ:</span>
                <p className="text-base font-bold text-emerald-700 mt-0.5">
                  {monitoringData.total_vaccinated_count?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">બાકી પશુધન:</span>
                <p className="text-base font-bold text-amber-600 mt-0.5">
                  {monitoringData.total_remaining_count?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">એકંદર પૂર્ણતા દર:</span>
                <p className="text-base font-bold text-emerald-700 mt-0.5">
                  {monitoringData.overall_completion_percentage}%
                </p>
              </div>
            </div>

            {/* Village Details Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                ગામ-વાર સ્ટાફ સ્થિતિ અને રસીકરણ પ્રગતિ ({monitoringData.villages?.length || 0} ગામો)
              </h4>
              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {monitoringData.villages?.map((v) => (
                  <div key={v.village_id} className="p-3 bg-white hover:bg-gray-50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900">{v.village_name_gu} ({v.village_name_en})</p>
                      <p className="text-[11px] text-gray-500">
                        તાલુકો: {v.taluka_name || 'લાગુ નથી'} | કોડ: {v.village_code}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        વેટરનરી અધિકારી (VO): {v.assigned_vo?.full_name || 'સોંપાયેલ નથી'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800">
                        {v.vaccinated_count} / {v.eligible_count}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        {v.completion_percentage}% પૂર્ણ
                      </div>
                      <div className="text-[10px] text-gray-400">
                        બાકી: {v.remaining_count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <Button variant="outline" onClick={() => setIsMonitoringModalOpen(false)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
