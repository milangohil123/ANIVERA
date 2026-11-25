import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField } from '../../components/common/FormField';
import { StateView } from '../../components/common/StateView';
import {
  masterService,
  SpeciesItem,
  DiseaseItem,
  VaccineItem,
  DiseaseVaccineMappingItem,
  MasterOverview,
} from '../../services/masterService';
import {
  Layers,
  Database,
  Activity,
  Syringe,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Edit2,
  Trash2,
  RefreshCw,
  Filter,
  Check,
  X,
  Tag,
  Info,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const AdminMasterManagementView: React.FC = () => {
  const { apiBaseUrl } = useAuth();

  const [activeTab, setActiveTab] = useState<'SPECIES' | 'DISEASES' | 'VACCINES' | 'MAPPING'>('SPECIES');
  const [overview, setOverview] = useState<MasterOverview | null>(null);
  const [speciesList, setSpeciesList] = useState<SpeciesItem[]>([]);
  const [diseasesList, setDiseasesList] = useState<DiseaseItem[]>([]);
  const [vaccinesList, setVaccinesList] = useState<VaccineItem[]>([]);
  const [mappingList, setMappingList] = useState<DiseaseVaccineMappingItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Searches & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>('ALL');
  const [selectedDiseaseFilter, setSelectedDiseaseFilter] = useState<string>('ALL');
  const [selectedVerificationFilter, setSelectedVerificationFilter] = useState<string>('ALL');

  // Modals state
  const [isSpeciesModalOpen, setIsSpeciesModalOpen] = useState<boolean>(false);
  const [editingSpecies, setEditingSpecies] = useState<SpeciesItem | null>(null);
  const [speciesForm, setSpeciesForm] = useState({
    code: '',
    name_gu: '',
    name_en: '',
    name_hi: '',
    description: '',
    active: true,
  });

  const [isDiseaseModalOpen, setIsDiseaseModalOpen] = useState<boolean>(false);
  const [editingDisease, setEditingDisease] = useState<DiseaseItem | null>(null);
  const [diseaseForm, setDiseaseForm] = useState({
    code: '',
    name_en: '',
    name_gu: '',
    name_hi: '',
    description: '',
    applicable_species: [] as string[],
    color: '#DC2626',
    severity: 'HIGH',
    active: true,
  });

  const [isVaccineModalOpen, setIsVaccineModalOpen] = useState<boolean>(false);
  const [editingVaccine, setEditingVaccine] = useState<VaccineItem | null>(null);
  const [vaccineForm, setVaccineForm] = useState({
    code: '',
    name_en: '',
    name_gu: '',
    disease_code: '',
    applicable_species: [] as string[],
    administration_route: 'S/C',
    standard_dosage: '2 ml',
    schedule_interval: 'Bi-annual (Every 6 Months)',
    verification_status: 'VERIFIED' as 'VERIFIED' | 'PENDING_VERIFICATION',
    verified_source: 'ICAR / DAHD Guidelines',
    description: '',
    active: true,
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load initial data
  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [ov, sp, dis, vac, map] = await Promise.all([
        masterService.getOverview(apiBaseUrl).catch(() => null),
        masterService.listSpecies(apiBaseUrl),
        masterService.listDiseases(apiBaseUrl),
        masterService.listVaccines(apiBaseUrl),
        masterService.getMapping(apiBaseUrl),
      ]);
      setOverview(ov);
      setSpeciesList(sp);
      setDiseasesList(dis);
      setVaccinesList(vac);
      setMappingList(map);
    } catch (err: any) {
      setErrorMsg(err.message || 'માસ્ટર ડેટા લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  // Flash message helper
  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // -------------------------------------------------------------------------
  // Species Handlers
  // -------------------------------------------------------------------------
  const handleOpenAddSpecies = () => {
    setEditingSpecies(null);
    setSpeciesForm({
      code: '',
      name_gu: '',
      name_en: '',
      name_hi: '',
      description: '',
      active: true,
    });
    setIsSpeciesModalOpen(true);
  };

  const handleOpenEditSpecies = (sp: SpeciesItem) => {
    setEditingSpecies(sp);
    setSpeciesForm({
      code: sp.code,
      name_gu: sp.name_gu,
      name_en: sp.name_en,
      name_hi: sp.name_hi || '',
      description: sp.description || '',
      active: sp.active,
    });
    setIsSpeciesModalOpen(true);
  };

  const handleSaveSpecies = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingSpecies) {
        await masterService.updateSpecies(apiBaseUrl, editingSpecies.code, {
          name_gu: speciesForm.name_gu,
          name_en: speciesForm.name_en,
          name_hi: speciesForm.name_hi,
          description: speciesForm.description,
          active: speciesForm.active,
        });
        showToast(`પ્રજાતિ '${editingSpecies.code}' સફળતાપૂર્વક અપડેટ થઈ.`);
      } else {
        await masterService.createSpecies(apiBaseUrl, speciesForm);
        showToast(`નવી પ્રજાતિ '${speciesForm.code}' ઉમેરાઈ.`);
      }
      setIsSpeciesModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'પ્રજાતિ સેવ કરવામાં નિષ્ફળ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSpecies = async (code: string) => {
    try {
      await masterService.toggleSpeciesActive(apiBaseUrl, code);
      showToast(`પ્રજાતિ '${code}' ની સક્રિયતા સ્થિતિ બદલાઈ.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    }
  };

  const handleDeleteSpecies = async (code: string) => {
    if (!window.confirm(`શું તમે ખરેખર પ્રજાતિ '${code}' કાઢી નાખવા અથવા સંગ્રહિત કરવા માંગો છો?`)) return;
    try {
      const res = await masterService.deleteSpecies(apiBaseUrl, code);
      showToast(res.message);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'પ્રજાતિ કાઢી નાખવામાં નિષ્ફળ');
    }
  };

  // -------------------------------------------------------------------------
  // Disease Handlers
  // -------------------------------------------------------------------------
  const handleOpenAddDisease = () => {
    setEditingDisease(null);
    setDiseaseForm({
      code: '',
      name_en: '',
      name_gu: '',
      name_hi: '',
      description: '',
      applicable_species: ['CATTLE', 'BUFFALO'],
      color: '#DC2626',
      severity: 'HIGH',
      active: true,
    });
    setIsDiseaseModalOpen(true);
  };

  const handleOpenEditDisease = (d: DiseaseItem) => {
    setEditingDisease(d);
    setDiseaseForm({
      code: d.code,
      name_en: d.name_en,
      name_gu: d.name_gu,
      name_hi: d.name_hi || '',
      description: d.description || '',
      applicable_species: d.applicable_species || [],
      color: d.color || '#DC2626',
      severity: d.severity || 'HIGH',
      active: d.active,
    });
    setIsDiseaseModalOpen(true);
  };

  const handleSaveDisease = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingDisease) {
        await masterService.updateDisease(apiBaseUrl, editingDisease.code, {
          name_en: diseaseForm.name_en,
          name_gu: diseaseForm.name_gu,
          name_hi: diseaseForm.name_hi,
          description: diseaseForm.description,
          applicable_species: diseaseForm.applicable_species,
          color: diseaseForm.color,
          severity: diseaseForm.severity,
          active: diseaseForm.active,
        });
        showToast(`રોગ '${editingDisease.code}' સફળતાપૂર્વક અપડેટ થયો.`);
      } else {
        await masterService.createDisease(apiBaseUrl, diseaseForm);
        showToast(`નવો રોગ '${diseaseForm.code}' ઉમેરાયો.`);
      }
      setIsDiseaseModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'રોગ સેવ કરવામાં નિષ્ફળ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDisease = async (code: string) => {
    try {
      await masterService.toggleDiseaseActive(apiBaseUrl, code);
      showToast(`રોગ '${code}' ની સક્રિયતા સ્થિતિ બદલાઈ.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    }
  };

  const handleDeleteDisease = async (code: string) => {
    if (!window.confirm(`શું તમે રોગ '${code}' કાઢી નાખવા અથવા સંગ્રહિત કરવા માંગો છો?`)) return;
    try {
      const res = await masterService.deleteDisease(apiBaseUrl, code);
      showToast(res.message);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'રોગ કાઢી નાખવામાં નિષ્ફળ');
    }
  };

  // -------------------------------------------------------------------------
  // Vaccine Handlers
  // -------------------------------------------------------------------------
  const handleOpenAddVaccine = () => {
    setEditingVaccine(null);
    setVaccineForm({
      code: `VAC-${(diseasesList[0]?.code || 'FMD')}-0${vaccinesList.length + 1}`,
      name_en: '',
      name_gu: '',
      disease_code: diseasesList[0]?.code || 'FMD',
      applicable_species: ['CATTLE', 'BUFFALO'],
      administration_route: 'S/C',
      standard_dosage: '2 ml',
      schedule_interval: 'Bi-annual (Every 6 Months)',
      verification_status: 'VERIFIED',
      verified_source: 'ICAR / DAHD Guidelines',
      description: '',
      active: true,
    });
    setIsVaccineModalOpen(true);
  };

  const handleOpenEditVaccine = (v: VaccineItem) => {
    setEditingVaccine(v);
    setVaccineForm({
      code: v.code,
      name_en: v.name_en,
      name_gu: v.name_gu,
      disease_code: v.disease_code,
      applicable_species: v.applicable_species || [],
      administration_route: v.administration_route || 'S/C',
      standard_dosage: v.standard_dosage || '2 ml',
      schedule_interval: v.schedule_interval || '',
      verification_status: v.verification_status,
      verified_source: v.verified_source || '',
      description: v.description || '',
      active: v.active,
    });
    setIsVaccineModalOpen(true);
  };

  const handleSaveVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingVaccine) {
        await masterService.updateVaccine(apiBaseUrl, editingVaccine.id, vaccineForm);
        showToast(`રસી '${editingVaccine.name_gu}' સફળતાપૂર્વક અપડેટ થઈ.`);
      } else {
        await masterService.createVaccine(apiBaseUrl, vaccineForm);
        showToast(`નવી રસી '${vaccineForm.name_gu}' ઉમેરાઈ.`);
      }
      setIsVaccineModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'રસી સેવ કરવામાં નિષ્ફળ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVaccine = async (id: string) => {
    try {
      await masterService.toggleVaccineActive(apiBaseUrl, id);
      showToast('રસીની સક્રિયતા સ્થિતિ બદલાઈ.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    }
  };

  const handleToggleVaccineVerification = async (v: VaccineItem) => {
    const nextStatus = v.verification_status === 'VERIFIED' ? 'PENDING_VERIFICATION' : 'VERIFIED';
    try {
      await masterService.setVaccineVerification(
        apiBaseUrl,
        v.id,
        nextStatus,
        nextStatus === 'VERIFIED' ? 'DAHD / ICAR Guidelines' : 'Manual Entry'
      );
      showToast(`ચકાસણી સ્થિતિ: ${nextStatus === 'VERIFIED' ? 'પ્રમાણિત (Verified)' : 'ચકાસણી બાકી (Pending)'}`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'ચકાસણી સ્થિતિ બદલવામાં નિષ્ફળ');
    }
  };

  const handleDeleteVaccine = async (id: string) => {
    if (!window.confirm('શું તમે આ રસી માસ્ટરને સંગ્રહિત/નિષ્ક્રિય કરવા માંગો છો?')) return;
    try {
      const res = await masterService.deleteVaccine(apiBaseUrl, id);
      showToast(res.message);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'રસી કાઢી નાખવામાં નિષ્ફળ');
    }
  };

  // -------------------------------------------------------------------------
  // Filtered Lists
  // -------------------------------------------------------------------------
  const filteredSpecies = useMemo(() => {
    return speciesList.filter((s) => {
      const matchSearch =
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name_gu.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.name_hi && s.name_hi.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [speciesList, searchQuery]);

  const filteredDiseases = useMemo(() => {
    return diseasesList.filter((d) => {
      const matchSearch =
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.name_gu.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.name_hi && d.name_hi.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchSpecies =
        selectedSpeciesFilter === 'ALL' ||
        (d.applicable_species || []).includes(selectedSpeciesFilter);
      return matchSearch && matchSpecies;
    });
  }, [diseasesList, searchQuery, selectedSpeciesFilter]);

  const filteredVaccines = useMemo(() => {
    return vaccinesList.filter((v) => {
      const matchSearch =
        v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.name_gu.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.disease_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDisease =
        selectedDiseaseFilter === 'ALL' || v.disease_code === selectedDiseaseFilter;
      const matchSpecies =
        selectedSpeciesFilter === 'ALL' ||
        (v.applicable_species || []).includes(selectedSpeciesFilter);
      const matchVerification =
        selectedVerificationFilter === 'ALL' ||
        v.verification_status === selectedVerificationFilter;
      return matchSearch && matchDisease && matchSpecies && matchVerification;
    });
  }, [vaccinesList, searchQuery, selectedDiseaseFilter, selectedSpeciesFilter, selectedVerificationFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0d402e] to-[#135D43] text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
              Admin Master Control
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> DAHD / ICAR Verified Standard
            </span>
          </div>
          <h1 className="text-2xl font-bold font-heading">
            પશુ, રોગ અને રસી માસ્ટર સંચાલન (Master Data)
          </h1>
          <p className="text-sm text-emerald-100 font-body mt-1 max-w-2xl">
            પ્રજાતિઓ, પશુરોગો, સરકારી પ્રમાણિત રસીઓ, ડોઝ માર્ગદર્શિકા અને ઝુંબેશ સેટઅપનું કેન્દ્રીય પ્રમાણિક સંચાલન.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-4 h-4 text-emerald-100" />}
            className="border-emerald-400/40 text-white hover:bg-emerald-700/50"
          >
            રીફ્રેશ
          </Button>

          {activeTab === 'SPECIES' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddSpecies}
              leftIcon={<Plus className="w-4 h-4" />}
              className="bg-emerald-500 hover:bg-emerald-600 border-none text-slate-900 font-bold"
            >
              નવી પ્રજાતિ
            </Button>
          )}

          {activeTab === 'DISEASES' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddDisease}
              leftIcon={<Plus className="w-4 h-4" />}
              className="bg-emerald-500 hover:bg-emerald-600 border-none text-slate-900 font-bold"
            >
              નવો રોગ
            </Button>
          )}

          {activeTab === 'VACCINES' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddVaccine}
              leftIcon={<Plus className="w-4 h-4" />}
              className="bg-emerald-500 hover:bg-emerald-600 border-none text-slate-900 font-bold"
            >
              નવી રસી
            </Button>
          )}
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">પશુ પ્રજાતિઓ</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{overview?.total_species || speciesList.length}</span>
            <span className="text-xs text-emerald-600 font-medium">({overview?.active_species || speciesList.filter(s => s.active).length} સક્રિય)</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">નોંધાયેલા રોગો</span>
            <div className="p-2 rounded-lg bg-red-50 text-red-700">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{overview?.total_diseases || diseasesList.length}</span>
            <span className="text-xs text-red-600 font-medium">({overview?.active_diseases || diseasesList.filter(d => d.active).length} સક્રિય)</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">પ્રમાણિત રસીઓ</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Syringe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-900">{overview?.verified_vaccines || vaccinesList.filter(v => v.verification_status === 'VERIFIED').length}</span>
            <span className="text-xs text-slate-500 font-medium">/ {overview?.total_vaccines || vaccinesList.length} કુલ</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ચકાસણી બાકી</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-900">{overview?.pending_vaccines || vaccinesList.filter(v => v.verification_status !== 'VERIFIED').length}</span>
            <span className="text-xs text-amber-600 font-medium">કસ્ટમ / મેન્યુઅલ</span>
          </div>
        </Card>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex space-x-1 sm:space-x-4">
          <button
            onClick={() => { setActiveTab('SPECIES'); setSearchQuery(''); }}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'SPECIES'
                ? 'border-[#135D43] text-[#135D43]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. પશુ પ્રજાતિઓ (Species)
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-mono">
              {speciesList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('DISEASES'); setSearchQuery(''); }}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'DISEASES'
                ? 'border-[#135D43] text-[#135D43]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            2. રોગ માસ્ટર (Diseases)
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-mono">
              {diseasesList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('VACCINES'); setSearchQuery(''); }}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'VACCINES'
                ? 'border-[#135D43] text-[#135D43]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Syringe className="w-4 h-4" />
            3. રસી માસ્ટર (Vaccines)
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-mono">
              {vaccinesList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('MAPPING'); setSearchQuery(''); }}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'MAPPING'
                ? 'border-[#135D43] text-[#135D43]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            4. રોગ-રસી મેપિંગ (Mapping)
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-64 pb-2">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="કોડ અથવા નામથી શોધો..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#135D43]"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TAB 1: SPECIES MANAGEMENT                                          */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'SPECIES' && (
        <Card className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-heading">પશુ પ્રજાતિ માસ્ટર યાદી (Animal Species)</h2>
              <p className="text-xs text-slate-500">સિસ્ટમમાં નોંધાયેલ તમામ પશુ કેટેગરી અને બહુભાષી નામો</p>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              કુલ: <strong className="text-slate-800">{filteredSpecies.length}</strong> પ્રજાતિઓ
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">કોડ (Code)</th>
                  <th className="py-3 px-4">ગુજરાતી નામ</th>
                  <th className="py-3 px-4">અંગ્રેજી નામ</th>
                  <th className="py-3 px-4">હિન્દી નામ</th>
                  <th className="py-3 px-4">વિગત</th>
                  <th className="py-3 px-4 text-center">નોંધાયેલ પશુઓ</th>
                  <th className="py-3 px-4 text-center">સ્થિતિ</th>
                  <th className="py-3 px-4 text-right">ક્રિયાઓ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSpecies.map((sp) => (
                  <tr key={sp.code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#135D43]">{sp.code}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{sp.name_gu}</td>
                    <td className="py-3 px-4 text-slate-700">{sp.name_en}</td>
                    <td className="py-3 px-4 text-slate-600">{sp.name_hi || '-'}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{sp.description || '-'}</td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {sp.usage_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleSpecies(sp.code)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          sp.active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {sp.active ? 'સક્રિય (Active)' : 'નિષ્ક્રિય (Inactive)'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditSpecies(sp)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5 text-slate-600" />}
                      >
                        સુધારો
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSpecies(sp.code)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        કાઢો / આર્કાઇવ
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredSpecies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      કોઈ પ્રજાતિ મળી નથી.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 2: DISEASE MANAGEMENT                                          */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'DISEASES' && (
        <Card className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-heading">રોગ માસ્ટર રજીસ્ટર (Disease Masters)</h2>
              <p className="text-xs text-slate-500">રાષ્ટ્રીય તથા રાજ્ય સ્તરે નિયંત્રિત ચેપી રોગો અને સંલગ્ન પ્રજાતિઓ</p>
            </div>

            {/* Species filter for diseases */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">પ્રજાતિ ફિલ્ટર:</span>
              <select
                value={selectedSpeciesFilter}
                onChange={(e) => setSelectedSpeciesFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value="ALL">તમામ પ્રજાતિઓ (All)</option>
                {speciesList.map((s) => (
                  <option key={s.code} value={s.code}>{s.name_gu} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">કોડ</th>
                  <th className="py-3 px-4">રોગનું નામ (ગુજરાતી / અંગ્રેજી / હિન્દી)</th>
                  <th className="py-3 px-4">લાગુ પ્રજાતિઓ (Applicable)</th>
                  <th className="py-3 px-4 text-center">ગંભીરતા / ટેગ</th>
                  <th className="py-3 px-4 text-center">રસીઓ</th>
                  <th className="py-3 px-4 text-center">અહેવાલો</th>
                  <th className="py-3 px-4 text-center">સ્થિતિ</th>
                  <th className="py-3 px-4 text-right">ક્રિયાઓ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDiseases.map((d) => (
                  <tr key={d.code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#135D43]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color || '#DC2626' }} />
                        {d.code}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{d.name_gu}</div>
                      <div className="text-[11px] text-slate-600">{d.name_en}</div>
                      {d.name_hi && <div className="text-[10px] text-slate-400">({d.name_hi})</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(d.applicable_species || []).map((sp) => (
                          <span key={sp} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {sp}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.severity === 'HIGH'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {d.severity || 'HIGH'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold border border-blue-200">
                        {d.vaccines_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {d.reports_count}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleDisease(d.code)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          d.active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {d.active ? 'સક્રિય' : 'નિષ્ક્રિય'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDisease(d)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5 text-slate-600" />}
                      >
                        સુધારો
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDisease(d.code)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        કાઢો / આર્કાઇવ
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredDiseases.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      કોઈ રોગ મળ્યો નથી.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 3: VACCINES MANAGEMENT                                         */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'VACCINES' && (
        <Card className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-heading">રસી માસ્ટર રજીસ્ટર (Vaccine Formulary)</h2>
              <p className="text-xs text-slate-500">ICAR / DAHD માન્ય રસીઓ, ડોઝ, વહીવટી માર્ગ અને આવર્તન માસ્ટર</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedDiseaseFilter}
                onChange={(e) => setSelectedDiseaseFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value="ALL">તમામ રોગો (All Diseases)</option>
                {diseasesList.map((d) => (
                  <option key={d.code} value={d.code}>{d.name_gu} ({d.code})</option>
                ))}
              </select>

              <select
                value={selectedVerificationFilter}
                onChange={(e) => setSelectedVerificationFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value="ALL">તમામ સ્થિતિ (All Status)</option>
                <option value="VERIFIED">પ્રમાણિત (Verified)</option>
                <option value="PENDING_VERIFICATION">ચકાસણી બાકી (Pending)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">કોડ</th>
                  <th className="py-3 px-4">રસીનું નામ (ગુજરાતી / અંગ્રેજી)</th>
                  <th className="py-3 px-4">રોગ (Disease)</th>
                  <th className="py-3 px-4">માર્ગ / ડોઝ</th>
                  <th className="py-3 px-4">રસીકરણ આવર્તન (Schedule)</th>
                  <th className="py-3 px-4 text-center">પ્રમાણીકરણ સ્થિતિ</th>
                  <th className="py-3 px-4 text-center">સ્થિતિ</th>
                  <th className="py-3 px-4 text-right">ક્રિયાઓ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVaccines.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#135D43]">{v.code}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{v.name_gu}</div>
                      <div className="text-[11px] text-slate-600">{v.name_en}</div>
                      {v.verified_source && (
                        <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                          સ્ત્રોત: {v.verified_source}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {v.disease_code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-800">{v.standard_dosage || '2 ml'}</div>
                      <div className="text-[11px] text-slate-500">{v.administration_route || 'S/C'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {v.schedule_interval || 'વાર્ષિક'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleVaccineVerification(v)}
                        title="ક્લિક કરીને પ્રમાણીકરણ સ્થિતિ બદલો"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                          v.verification_status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        {v.verification_status === 'VERIFIED' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Verified
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Pending Verification
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleVaccine(v.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          v.active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {v.active ? 'સક્રિય' : 'નિષ્ક્રિય'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditVaccine(v)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5 text-slate-600" />}
                      >
                        સુધારો
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteVaccine(v.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        આર્કાઇવ
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredVaccines.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      કોઈ રસી માસ્ટર મળ્યો નથી.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 4: DISEASE-VACCINE MAPPING HIERARCHY                           */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'MAPPING' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-[#135D43] shrink-0" />
              <div className="text-xs">
                <strong className="text-[#135D43] text-sm block">રોગ-પ્રજાતિ-રસી સંકલન માસ્ટર ચાર્ટ</strong>
                ઝુંબેશ રચના (Campaign Creation) અને આરોગ્ય સારવાર કેસમાં આ ડેટાબેઝના આધારે માન્ય રસીઓ આપમેળે સૂચવવામાં આવે છે.
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-lg border border-emerald-300 text-[#135D43]">
              DAHD / ICAR 100% સંરેખિત
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mappingList.map((item) => (
              <Card key={item.disease_code} className="p-4 border border-slate-200 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color || '#DC2626' }} />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm font-heading">{item.disease_name_gu}</h3>
                      <span className="text-[11px] text-slate-500 font-mono">({item.disease_code}) — {item.disease_name_en}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    item.severity === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {item.severity}
                  </span>
                </div>

                <div className="mt-2.5">
                  <span className="text-[11px] text-slate-500 font-medium block mb-1">લાગુ પડતી પ્રજાતિઓ:</span>
                  <div className="flex flex-wrap gap-1">
                    {item.applicable_species.map((sp) => (
                      <span key={sp} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono border border-slate-200">
                        {sp}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700 block mb-2">
                    ઉપલબ્ધ માન્ય રસીઓ ({item.vaccines.length}):
                  </span>
                  {item.vaccines.length > 0 ? (
                    <div className="space-y-2">
                      {item.vaccines.map((v) => (
                        <div key={v.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{v.name_gu}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              v.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {v.verification_status === 'VERIFIED' ? 'Verified' : 'Pending'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono mt-0.5">{v.code}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-600">
                            <span>ડોઝ: <strong className="text-slate-800">{v.standard_dosage}</strong></span>
                            <span>માર્ગ: <strong className="text-slate-800">{v.administration_route}</strong></span>
                            <span>આવર્તન: <strong className="text-slate-800">{v.schedule_interval}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                      હજુ સુધી કોઈ રસી લિંક થયેલ નથી.
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: ADD / EDIT SPECIES                                         */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isSpeciesModalOpen}
        onClose={() => setIsSpeciesModalOpen(false)}
        title={editingSpecies ? `પ્રજાતિ સુધારો: ${editingSpecies.code}` : 'નવી પશુ પ્રજાતિ ઉમેરો'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveSpecies} className="space-y-4 text-xs font-body">
          <FormField label="પ્રજાતિ કોડ (Unique Species Code)" required>
            <input
              type="text"
              required
              disabled={!!editingSpecies}
              value={speciesForm.code}
              onChange={(e) => setSpeciesForm({ ...speciesForm, code: e.target.value.toUpperCase() })}
              placeholder="દા.ત. CATTLE, BUFFALO, GOAT, SHEEP"
              className="w-full px-3 py-2 border rounded-lg uppercase font-mono text-xs disabled:bg-slate-100"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="ગુજરાતી નામ" required>
              <input
                type="text"
                required
                value={speciesForm.name_gu}
                onChange={(e) => setSpeciesForm({ ...speciesForm, name_gu: e.target.value })}
                placeholder="દા.ત. ગાય"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
            <FormField label="અંગ્રેજી નામ" required>
              <input
                type="text"
                required
                value={speciesForm.name_en}
                onChange={(e) => setSpeciesForm({ ...speciesForm, name_en: e.target.value })}
                placeholder="e.g. Cow / Cattle"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
          </div>

          <FormField label="હિન્દી નામ (વૈકલ્પિક)">
            <input
              type="text"
              value={speciesForm.name_hi}
              onChange={(e) => setSpeciesForm({ ...speciesForm, name_hi: e.target.value })}
              placeholder="દા.ત. गाय"
              className="w-full px-3 py-2 border rounded-lg text-xs"
            />
          </FormField>

          <FormField label="વિગત / વર્ણન">
            <textarea
              rows={2}
              value={speciesForm.description}
              onChange={(e) => setSpeciesForm({ ...speciesForm, description: e.target.value })}
              placeholder="પ્રજાતિ અંગે ટૂંકી માહિતી..."
              className="w-full px-3 py-2 border rounded-lg text-xs"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="sp_active"
              checked={speciesForm.active}
              onChange={(e) => setSpeciesForm({ ...speciesForm, active: e.target.checked })}
              className="rounded text-[#135D43] focus:ring-[#135D43]"
            />
            <label htmlFor="sp_active" className="text-xs font-semibold text-slate-700">
              સક્રિય રાખો (Active in System)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsSpeciesModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              સેવ કરો
            </Button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: ADD / EDIT DISEASE                                         */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isDiseaseModalOpen}
        onClose={() => setIsDiseaseModalOpen(false)}
        title={editingDisease ? `રોગ સુધારો: ${editingDisease.code}` : 'નવો રોગ માસ્ટર ઉમેરો'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveDisease} className="space-y-4 text-xs font-body">
          <FormField label="રોગ કોડ (Disease Code)" required>
            <input
              type="text"
              required
              disabled={!!editingDisease}
              value={diseaseForm.code}
              onChange={(e) => setDiseaseForm({ ...diseaseForm, code: e.target.value.toUpperCase() })}
              placeholder="દા.ત. FMD, LSD, PPR, HS, BQ"
              className="w-full px-3 py-2 border rounded-lg uppercase font-mono text-xs disabled:bg-slate-100"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="ગુજરાતી નામ" required>
              <input
                type="text"
                required
                value={diseaseForm.name_gu}
                onChange={(e) => setDiseaseForm({ ...diseaseForm, name_gu: e.target.value })}
                placeholder="દા.ત. ખરવા-મોવાસા (FMD)"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
            <FormField label="અંગ્રેજી નામ" required>
              <input
                type="text"
                required
                value={diseaseForm.name_en}
                onChange={(e) => setDiseaseForm({ ...diseaseForm, name_en: e.target.value })}
                placeholder="e.g. Foot and Mouth Disease"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
          </div>

          <FormField label="હિન્દી નામ (વૈકલ્પિક)">
            <input
              type="text"
              value={diseaseForm.name_hi}
              onChange={(e) => setDiseaseForm({ ...diseaseForm, name_hi: e.target.value })}
              placeholder="દા.ત. खुरपका-मुंहपका"
              className="w-full px-3 py-2 border rounded-lg text-xs"
            />
          </FormField>

          <FormField label="લાગુ પડતી પશુ પ્રજાતિઓ (Applicable Species)" required>
            <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 border rounded-lg">
              {speciesList.map((s) => (
                <label key={s.code} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={diseaseForm.applicable_species.includes(s.code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDiseaseForm({
                          ...diseaseForm,
                          applicable_species: [...diseaseForm.applicable_species, s.code],
                        });
                      } else {
                        setDiseaseForm({
                          ...diseaseForm,
                          applicable_species: diseaseForm.applicable_species.filter((x) => x !== s.code),
                        });
                      }
                    }}
                    className="rounded text-[#135D43] focus:ring-[#135D43]"
                  />
                  <span>{s.name_gu} ({s.code})</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="ગંભીરતા (Severity Level)">
              <select
                value={diseaseForm.severity}
                onChange={(e) => setDiseaseForm({ ...diseaseForm, severity: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs"
              >
                <option value="HIGH">અતિ ગંભીર (HIGH)</option>
                <option value="MEDIUM">મધ્યમ (MEDIUM)</option>
                <option value="LOW">ઓછી (LOW)</option>
              </select>
            </FormField>

            <FormField label="ટેગ કલર (Color Indicator)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={diseaseForm.color}
                  onChange={(e) => setDiseaseForm({ ...diseaseForm, color: e.target.value })}
                  className="w-10 h-8 p-0 border rounded cursor-pointer"
                />
                <span className="font-mono text-xs text-slate-600">{diseaseForm.color}</span>
              </div>
            </FormField>
          </div>

          <FormField label="રોગ લક્ષણો / વર્ણન">
            <textarea
              rows={2}
              value={diseaseForm.description}
              onChange={(e) => setDiseaseForm({ ...diseaseForm, description: e.target.value })}
              placeholder="રોગ વિશે વિગતવાર વર્ણન..."
              className="w-full px-3 py-2 border rounded-lg text-xs"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="dis_active"
              checked={diseaseForm.active}
              onChange={(e) => setDiseaseForm({ ...diseaseForm, active: e.target.checked })}
              className="rounded text-[#135D43] focus:ring-[#135D43]"
            />
            <label htmlFor="dis_active" className="text-xs font-semibold text-slate-700">
              સક્રિય રાખો (Active)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsDiseaseModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              સેવ કરો
            </Button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: ADD / EDIT VACCINE                                         */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isVaccineModalOpen}
        onClose={() => setIsVaccineModalOpen(false)}
        title={editingVaccine ? `રસી સુધારો: ${editingVaccine.name_gu}` : 'નવી રસી માસ્ટર ઉમેરો'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveVaccine} className="space-y-4 text-xs font-body">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="રસી કોડ (Vaccine Code)" required>
              <input
                type="text"
                required
                disabled={!!editingVaccine}
                value={vaccineForm.code}
                onChange={(e) => setVaccineForm({ ...vaccineForm, code: e.target.value.toUpperCase() })}
                placeholder="દા.ત. VAC-FMD-01"
                className="w-full px-3 py-2 border rounded-lg uppercase font-mono text-xs disabled:bg-slate-100"
              />
            </FormField>

            <FormField label="લક્ષિત રોગ (Target Disease)" required>
              <select
                required
                value={vaccineForm.disease_code}
                onChange={(e) => setVaccineForm({ ...vaccineForm, disease_code: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs"
              >
                {diseasesList.map((d) => (
                  <option key={d.code} value={d.code}>{d.name_gu} ({d.code})</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="ગુજરાતી નામ" required>
              <input
                type="text"
                required
                value={vaccineForm.name_gu}
                onChange={(e) => setVaccineForm({ ...vaccineForm, name_gu: e.target.value })}
                placeholder="દા.ત. FMD તેલ આધારિત નિષ્ક્રિય રસી"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
            <FormField label="અંગ્રેજી વૈજ્ઞાનિક / બ્રાન્ડ નામ" required>
              <input
                type="text"
                required
                value={vaccineForm.name_en}
                onChange={(e) => setVaccineForm({ ...vaccineForm, name_en: e.target.value })}
                placeholder="e.g. Inactivated Trivalent Oil Adjuvant"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="માર્ગ (Route)">
              <select
                value={vaccineForm.administration_route}
                onChange={(e) => setVaccineForm({ ...vaccineForm, administration_route: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs"
              >
                <option value="S/C">S/C (ચામડી નીચે - Subcutaneous)</option>
                <option value="I/M">I/M (સ્નાયુમાં - Intramuscular)</option>
                <option value="Oral">Oral (મોં વાટે)</option>
                <option value="Intranasal">Intranasal (નાક વાટે)</option>
              </select>
            </FormField>

            <FormField label="સ્ટાન્ડર્ડ ડોઝ">
              <input
                type="text"
                value={vaccineForm.standard_dosage}
                onChange={(e) => setVaccineForm({ ...vaccineForm, standard_dosage: e.target.value })}
                placeholder="દા.ત. 2 ml"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>

            <FormField label="આવર્તન (Interval)">
              <input
                type="text"
                value={vaccineForm.schedule_interval}
                onChange={(e) => setVaccineForm({ ...vaccineForm, schedule_interval: e.target.value })}
                placeholder="દા.ત. 6 માસ / વાર્ષિક"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
          </div>

          <FormField label="લાગુ પડતી પશુ પ્રજાતિઓ">
            <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 border rounded-lg">
              {speciesList.map((s) => (
                <label key={s.code} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={vaccineForm.applicable_species.includes(s.code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVaccineForm({
                          ...vaccineForm,
                          applicable_species: [...vaccineForm.applicable_species, s.code],
                        });
                      } else {
                        setVaccineForm({
                          ...vaccineForm,
                          applicable_species: vaccineForm.applicable_species.filter((x) => x !== s.code),
                        });
                      }
                    }}
                    className="rounded text-[#135D43] focus:ring-[#135D43]"
                  />
                  <span>{s.name_gu} ({s.code})</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="ચકાસણી સ્થિતિ (Verification Status)">
              <select
                value={vaccineForm.verification_status}
                onChange={(e) => setVaccineForm({ ...vaccineForm, verification_status: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg text-xs font-semibold"
              >
                <option value="VERIFIED">VERIFIED (DAHD / ICAR પ્રમાણિત)</option>
                <option value="PENDING_VERIFICATION">PENDING_VERIFICATION (ચકાસણી બાકી)</option>
              </select>
            </FormField>

            <FormField label="પ્રમાણીકરણ સ્ત્રોત (Source Reference)">
              <input
                type="text"
                value={vaccineForm.verified_source}
                onChange={(e) => setVaccineForm({ ...vaccineForm, verified_source: e.target.value })}
                placeholder="દા.ત. ICAR-IVRI / DAHD Guidelines"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </FormField>
          </div>

          <FormField label="વધારાની નોંધ">
            <textarea
              rows={2}
              value={vaccineForm.description}
              onChange={(e) => setVaccineForm({ ...vaccineForm, description: e.target.value })}
              placeholder="રસી સ્ટોરેજ, તાપમાન અથવા સાવચેતી..."
              className="w-full px-3 py-2 border rounded-lg text-xs"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="vac_active"
              checked={vaccineForm.active}
              onChange={(e) => setVaccineForm({ ...vaccineForm, active: e.target.checked })}
              className="rounded text-[#135D43] focus:ring-[#135D43]"
            />
            <label htmlFor="vac_active" className="text-xs font-semibold text-slate-700">
              સક્રિય રાખો (Active)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsVaccineModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              સેવ કરો
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
