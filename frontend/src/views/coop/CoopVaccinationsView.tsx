import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from '../../components/common/KpiCard';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { coopService, type CoopVaccinationItem } from '../../services/coopService';
import {
  healthWorkflowService,
  type CooperativeScheduleSummary,
  type RecurringSchedulePayload,
  type ScheduleEligibilityPreview,
} from '../../services/healthWorkflowService';
import {
  Syringe,
  Download,
  RotateCcw,
  Tag,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight,
  User,
  PawPrint,
  Plus,
  AlertTriangle,
  X,
  Bell,
} from 'lucide-react';

const VACCINE_CATALOG = [
  { code: 'FMD', name: 'ખરવા-મોવાસા (Foot and Mouth Disease / FMD Vaccine)', defaultIntervalMonths: 6, purpose: 'ખરવા-મોવાસા રોગ સામે રોગપ્રતિકારકતા' },
  { code: 'HS', name: 'ગળસૂંઠો (Hemorrhagic Septicemia / HS Oil Adjuvant Vaccine)', defaultIntervalMonths: 12, purpose: 'ચોમાસા પહેલા ગળસૂંઠાથી રક્ષણ' },
  { code: 'BQ', name: 'ગાંઠિયો તાવ (Black Quarter / BQ Vaccine)', defaultIntervalMonths: 12, purpose: 'ચોમાસા પૂર્વે ગાંઠિયા તાવ સામે રક્ષણ' },
  { code: 'BRUCELLA', name: 'બ્રુસેલોસિસ (Brucella Abortus S19 Calfhood Vaccine)', defaultIntervalMonths: 12, purpose: '૪-૮ માસની વાછરડીઓમાં બ્રુસેલોસિસ નિયંત્રણ' },
  { code: 'LSD', name: 'લમ્પી સ્કીન ડિસીઝ (Goat Pox / LSD Heterologous Vaccine)', defaultIntervalMonths: 12, purpose: 'લમ્પી ચામડીના રોગ સામે સુરક્ષા' },
  { code: 'PPR', name: 'પીપીઆર (PPR Vaccine for Sheep & Goat)', defaultIntervalMonths: 36, purpose: 'ઘેટાં-બકરાંમાં પીપીઆર તાવનું નિયંત્રણ' },
];

export const CoopVaccinationsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [activeTab, setActiveTab] = useState<'SCHEDULES' | 'TELEMETRY'>('SCHEDULES');

  // Telemetry state
  const [records, setRecords] = useState<CoopVaccinationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cooperative Schedules state
  const [schedules, setSchedules] = useState<CooperativeScheduleSummary[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState<boolean>(true);

  // Create Schedule Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [scheduleName, setScheduleName] = useState<string>('');
  const [selectedVaccineCode, setSelectedVaccineCode] = useState<string>('FMD');
  const [recurrenceIntervalMonths, setRecurrenceIntervalMonths] = useState<number>(6);
  const [purpose, setPurpose] = useState<string>('ખરવા-મોવાસા રોગ સામે નિયમિત રક્ષણ');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [autoSubmitTaho, setAutoSubmitTaho] = useState<boolean>(true);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState<boolean>(false);

  // Eligibility Preview state
  const [eligibility, setEligibility] = useState<ScheduleEligibilityPreview | null>(null);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState<boolean>(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setIsLoadingSchedules(true);
    setErrorMsg(null);
    try {
      const [vaxData, schedData] = await Promise.all([
        coopService.listVaccinations(apiBaseUrl).catch(() => []),
        healthWorkflowService.listCooperativeSchedules(apiBaseUrl).catch(() => []),
      ]);
      setRecords(vaxData || []);
      setSchedules(schedData || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'ડેટા લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
      setIsLoadingSchedules(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  // Load eligibility preview when vaccine changes in create modal
  useEffect(() => {
    if (!isCreateModalOpen) return;
    const fetchEligibility = async () => {
      setIsLoadingEligibility(true);
      try {
        const prev = await healthWorkflowService.previewScheduleEligibility(apiBaseUrl, selectedVaccineCode);
        setEligibility(prev);
      } catch (err) {
        console.warn('Eligibility preview warning:', err);
      } finally {
        setIsLoadingEligibility(false);
      }
    };
    fetchEligibility();
  }, [apiBaseUrl, isCreateModalOpen, selectedVaccineCode]);

  const handleVaccineChange = (vCode: string) => {
    setSelectedVaccineCode(vCode);
    const found = VACCINE_CATALOG.find((v) => v.code === vCode);
    if (found) {
      setRecurrenceIntervalMonths(found.defaultIntervalMonths);
      setPurpose(found.purpose);
    }
  };

  const handleCreateScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleName.trim()) {
      setNotification({ type: 'error', message: 'કૃપા કરીને શેડ્યૂલનું નામ દાખલ કરો.' });
      return;
    }

    setIsSubmittingSchedule(true);
    try {
      const selectedVaccine = VACCINE_CATALOG.find((v) => v.code === selectedVaccineCode);
      const payload: RecurringSchedulePayload = {
        schedule_name: scheduleName.trim(),
        vaccine_code: selectedVaccineCode,
        vaccine_name: selectedVaccine?.name || selectedVaccineCode,
        disease_prevention_purpose: purpose.trim() || undefined,
        recurrence_interval_months: recurrenceIntervalMonths,
        description: description.trim() || undefined,
        target_start_date: startDate || undefined,
      };

      const created = await healthWorkflowService.createCooperativeSchedule(apiBaseUrl, payload);
      const newScheduleId = created.id || created.schedule_id;

      if (autoSubmitTaho && newScheduleId) {
        await healthWorkflowService.submitScheduleToTaho(apiBaseUrl, newScheduleId);
        setNotification({
          type: 'success',
          message: `રિકરિંગ શેડ્યૂલ "${scheduleName}" સફળતાપૂર્વક તૈયાર કરી તાલુકા પશુપાલન અધિકારી (TAHO) ને મંજૂરી માટે મોકલી દેવાયો છે!`,
        });
      } else {
        setNotification({
          type: 'success',
          message: `રિકરિંગ શેડ્યૂલ "${scheduleName}" સફળતાપૂર્વક સાચવવામાં આવ્યો છે.`,
        });
      }

      setIsCreateModalOpen(false);
      setScheduleName('');
      setDescription('');
      loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'શેડ્યૂલ બનાવવામાં નિષ્ફળતા મળી.',
      });
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleSubmitExistingToTaho = async (scheduleId: string, sName: string) => {
    try {
      await healthWorkflowService.submitScheduleToTaho(apiBaseUrl, scheduleId);
      setNotification({
        type: 'success',
        message: `શેડ્યૂલ "${sName}" TAHO સમીક્ષા માટે સફળતાપૂર્વક સબમિટ થયો!`,
      });
      loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'TAHO સબમિશન નિષ્ફળ.',
      });
    }
  };

  // Telemetry filtering
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      const tag = (r.bharat_pashudhan_tag || '').toLowerCase();
      const code = (r.animal_code || '').toLowerCase();
      const farmer = (r.farmer_name || '').toLowerCase();
      const vax = (r.vaccine_name || '').toLowerCase();
      const dis = (r.disease_name || '').toLowerCase();
      const vil = (r.village_name || '').toLowerCase();
      return tag.includes(q) || code.includes(q) || farmer.includes(q) || vax.includes(q) || dis.includes(q) || vil.includes(q);
    });
  }, [records, searchQuery]);

  const activeSchedulesCount = schedules.filter((s) => s.status === 'APPROVED_ACTIVE').length;
  const pendingSchedulesCount = schedules.filter((s) => s.status === 'SUBMITTED').length;
  const totalEnrolledAnimals = schedules.reduce((sum, s) => sum + (s.enrolled_animals_count || 0), 0);

  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = ['Date', 'Animal Code', 'Bharat Pashudhan Tag', 'Species', 'Farmer Name', 'Village', 'Vaccine', 'Disease', 'Dose No', 'Batch', 'Vaccinator'];
    const rows = records.map((r) => [
      new Date(r.administered_at).toLocaleDateString('gu-IN'),
      r.animal_code,
      r.bharat_pashudhan_tag || 'N/A',
      r.species,
      `"${r.farmer_name}"`,
      `"${r.village_name}"`,
      `"${r.vaccine_name}"`,
      `"${r.disease_name}"`,
      r.dose_number,
      r.batch_number || 'N/A',
      `"${r.vaccinator_designation}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Coop_Vaccination_Telemetry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-4 animate-fade-in pb-12 font-body text-[#172033]">
      {/* 1. BREADCRUMBS & TOP PAGE HEADER */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>કામગીરી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>ડેરી સહકારી મંડળી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">
            રિકરિંગ રસીકરણ સમયપત્રક & ટેલિમેટ્રી
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              ડેરી રિકરિંગ રસીકરણ & ટેલિમેટ્રી
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>૧૫-દિવસ ઓટોમેટિક રીમાઇન્ડર એન્જિન</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />}
            >
              તાજું કરો
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4 text-white" />}
            >
              નવું રિકરિંગ શેડ્યૂલ પ્રસ્તાવિત કરો
            </Button>
          </div>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. GOVERNANCE BANNER */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                ડેરી સહકારી રિકરિંગ રસીકરણ નિયમો & ગવર્નન્સ
              </span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                TAHO મંજૂરી ફરજિયાત
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              ડેરી મંડળી પ્રસ્તાવિત રસીકરણ શેડ્યૂલ તૈયાર કરી શકે છે, પરંતુ તે તાલુકા પશુપાલન અધિકારી (TAHO) દ્વારા મંજૂર થયા બાદ જ સક્રિય થશે. રસી અપાયા પછી આગળનું સાયકલ આપમેળે ગણાશે અને ખેડૂતને ૧૫ દિવસ અગાઉ સૂચના જશે.
            </p>
          </div>
        </div>
      </div>

      {/* 3. 5 KPI CARDS IN ONE ROW (Matching Existing Style) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ રિકરિંગ શેડ્યૂલ"
          value={isLoadingSchedules ? '...' : String(schedules.length)}
          subtext="પ્રસ્તાવિત અને સક્રિય"
          icon={<Clock className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="સક્રિય શેડ્યૂલ (Active)"
          value={isLoadingSchedules ? '...' : String(activeSchedulesCount)}
          valueColor="text-emerald-700"
          subtext="TAHO મંજૂર સાયકલ"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="મંજૂરી માટે બાકી"
          value={isLoadingSchedules ? '...' : String(pendingSchedulesCount)}
          valueColor="text-amber-700"
          subtext="TAHO ડેસ્ક પર પેન્ડિંગ"
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
        />

        <KpiCard
          label="નોંધાયેલ સભાસદ પશુધન"
          value={isLoadingSchedules ? '...' : String(totalEnrolledAnimals)}
          subtext="શેડ્યૂલ હેઠળ આવરી લેવાયેલ"
          icon={<PawPrint className="w-4 h-4 text-[#135D43]" />}
          iconVariant="teal"
          onClick={() => navigate('/coop/animals')}
        />

        <KpiCard
          label="૧૫-દિવસ રીમાઇન્ડર"
          value="ઓટો-એક્ટિવ"
          subtext="ખેડૂત & ડેરી એલર્ટ્સ"
          icon={<Bell className="w-4 h-4 text-sky-600" />}
          iconVariant="blue"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-3 rounded-xl border">
        <button
          onClick={() => setActiveTab('SCHEDULES')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'SCHEDULES'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>રિકરિંગ રસીકરણ સમયપત્રક ({schedules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('TELEMETRY')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'TELEMETRY'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Syringe className="w-4 h-4" />
          <span>રસીકરણ ટેલિમેટ્રી ઇતિહાસ ({records.length})</span>
        </button>
      </div>

      {/* TAB 1: RECURRING SCHEDULES */}
      {activeTab === 'SCHEDULES' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden space-y-0">
          <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 flex items-center justify-center text-[#176B5B] shrink-0 shadow-2xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                    સહકારી રિકરિંગ રસીકરણ શેડ્યૂલ યાદી
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#135D43]">
                    {schedules.length} શેડ્યૂલ
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  મંડળીના સભાસદ પશુઓ માટે વાર્ષિક/અર્ધવાર્ષિક રસીકરણ ચક્ર અને ૧૫ દિવસ અગાઉના રીમાઇન્ડર્સ
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4 text-white" />}
            >
              + નવું શેડ્યૂલ બનાવો
            </Button>
          </div>

          {isLoadingSchedules ? (
            <StateView state="loading" title="શેડ્યૂલ લોડ થઈ રહ્યા છે..." />
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">કોઈ રિકરિંગ રસીકરણ શેડ્યૂલ ઉપલબ્ધ નથી.</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                તમારી ડેરી મંડળીના સભાસદ પશુધન માટે FMD, HS, BQ કે Brucellosis રસીકરણ માટે નવું રિકરિંગ શેડ્યૂલ પ્રસ્તાવિત કરો.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                પ્રથમ શેડ્યૂલ પ્રસ્તાવિત કરો
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">શેડ્યૂલ નામ</th>
                    <th className="py-2.5 px-3">રસી & હેતુ</th>
                    <th className="py-2.5 px-3">રિકરિંગ આવર્તન</th>
                    <th className="py-2.5 px-3">નોંધાયેલ પશુધન</th>
                    <th className="py-2.5 px-3">TAHO મંજૂરી સ્થિતિ</th>
                    <th className="py-2.5 px-3">તારીખ</th>
                    <th className="py-2.5 px-3 text-right">કાર્યવાહી</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {schedules.map((s) => {
                    const isDraft = s.status === 'DRAFT';
                    const sId = s.id || s.schedule_id || '';
                    return (
                      <tr key={sId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <div>{s.schedule_name}</div>
                          {s.description && <div className="text-[10px] text-slate-500 font-normal">{s.description}</div>}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold text-emerald-800">{s.vaccine_name}</span>
                          <div className="text-[10px] text-slate-500">{s.disease_prevention_purpose}</div>
                        </td>

                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {s.recurrence_interval_months
                            ? `દર ${s.recurrence_interval_months} મહિને (${s.recurrence_interval_months === 6 ? 'અર્ધવાર્ષિક' : 'વાર્ષિક'})`
                            : `${s.custom_recurrence_value} ${s.custom_recurrence_unit}`}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {s.enrolled_animals_count} પશુઓ
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === 'APPROVED_ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.status === 'SUBMITTED'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : s.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.status === 'APPROVED_ACTIVE'
                              ? 'સક્રિય (TAHO મંજૂર)'
                              : s.status === 'SUBMITTED'
                              ? 'TAHO મંજૂરી માટે મોકલેલ'
                              : s.status === 'REJECTED'
                              ? 'નકારાયેલ'
                              : 'ડ્રાફ્ટ'}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                          {new Date(s.created_at).toLocaleDateString('gu-IN')}
                        </td>

                        <td className="py-3 px-3 text-right">
                          {isDraft && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSubmitExistingToTaho(sId, s.schedule_name)}
                            >
                              TAHO ને સબમિટ કરો
                            </Button>
                          )}
                          {!isDraft && (
                            <span className="text-[10px] font-medium text-slate-400">
                              {s.status === 'APPROVED_ACTIVE' ? 'સક્રિય ચક્ર ચાલુ છે' : 'ચકાસણી હેઠળ'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VACCINATIONS TELEMETRY (EXISTING) */}
      {activeTab === 'TELEMETRY' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 flex items-center justify-center text-[#176B5B] shrink-0 shadow-2xs">
                <Syringe className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                    રસીકરણ ટેલિમેટ્રી ઇતિહાસ
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#135D43]">
                    {filteredRecords.length} ઇવેન્ટ્સ
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  સભાસદ પશુધનને અપાયેલી રસી, બેચ નંબર અને સરકારી રસીકરણ સહાયકની વિગત
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ટેગ, પશુ કોડ, રસી અથવા ખેડૂત..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                CSV
              </Button>
            </div>
          </div>

          {isLoading ? (
            <StateView state="loading" title="રસીકરણ ટેલિમેટ્રી લોડ થઈ રહી છે..." />
          ) : errorMsg ? (
            <StateView state="error" title="ડેટા લોડ કરવામાં ક્ષતિ" description={errorMsg} />
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Syringe className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">કોઈ રસીકરણ રેકોર્ડ મળ્યો નથી.</p>
              <p className="text-xs text-slate-400">શોધ શબ્દો બદલીને ફરી તપાસ કરો.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">તારીખ</th>
                    <th className="py-2.5 px-3">પશુ અને ટેગ</th>
                    <th className="py-2.5 px-3">માલિક પશુપાલક</th>
                    <th className="py-2.5 px-3">ગામ</th>
                    <th className="py-2.5 px-3">રસીનું નામ</th>
                    <th className="py-2.5 px-3">લક્ષિત રોગ</th>
                    <th className="py-2.5 px-3">ડોઝ અને બેચ</th>
                    <th className="py-2.5 px-3 text-right">સ્થિતિ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {new Date(r.administered_at).toLocaleDateString('gu-IN')}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#135D43] font-mono flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[#135D43]" />
                          {r.bharat_pashudhan_tag || r.animal_code}
                        </div>
                        <div className="text-[10px] text-slate-400">{r.species}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {r.farmer_name}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#135D43]" />
                          {r.village_name}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{r.vaccine_name}</td>
                      <td className="py-3 px-3 text-slate-600">{r.disease_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] mr-1">#{r.dose_number}</span>
                        <span className="text-[10px] text-slate-400">{r.batch_number || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ચકાસાયેલ
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE RECURRING SCHEDULE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs font-body animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-200 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    નવું રિકરિંગ રસીકરણ સમયપત્રક પ્રસ્તાવિત કરો
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    મંડળીના સભાસદોના પશુધન માટે સાયકલ નિર્ધારિત કરો • TAHO મંજૂરી બાદ ૧૫-દિવસ અગાઉ સૂચના શરૂ થશે
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mandatory TAHO rule highlight */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>સત્તાવાર નિયમ:</strong> ડેરી સહકારી મંડળી દ્વારા બનાવેલ રિકરિંગ શેડ્યૂલ સીધું સક્રિય થતું નથી; તે તાલુકા પશુપાલન અધિકારી (TAHO) ની ચકાસણી અને મંજૂરી બાદ જ અમલમાં આવશે.
              </div>
            </div>

            <form onSubmit={handleCreateScheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ૧. શેડ્યૂલનું નામ (Schedule Name) *
                </label>
                <input
                  type="text"
                  required
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  placeholder="દા.ત. બોટાદ ડેરી મંડળી - FMD અર્ધવાર્ષિક સુરક્ષા સાયકલ ૨૦૨૬"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ૨. રસી કેટલોગ પસંદ કરો (Vaccine) *
                  </label>
                  <select
                    value={selectedVaccineCode}
                    onChange={(e) => handleVaccineChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  >
                    {VACCINE_CATALOG.map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ૩. રિકરિંગ આવર્તન (Recurrence Interval) *
                  </label>
                  <select
                    value={recurrenceIntervalMonths}
                    onChange={(e) => setRecurrenceIntervalMonths(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  >
                    <option value={3}>દર ૩ મહિને (ત્રિમાસિક / Quarterly)</option>
                    <option value={6}>દર ૬ મહિને (અર્ધવાર્ષિક / Bi-Annual - ભલામણ કરેલ)</option>
                    <option value={12}>દર ૧૨ મહિને (વાર્ષિક / Annual)</option>
                    <option value={24}>દર ૨૪ મહિને (દ્વિવાર્ષિક)</option>
                    <option value={36}>દર ૩૬ મહિને (૩ વર્ષે)</option>
                  </select>
                </div>
              </div>

              {/* Real-Time Animal Eligibility Preview Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    પાત્ર પશુધન પૂર્વાવલોકન (Eligibility Preview)
                  </span>
                  {isLoadingEligibility && (
                    <span className="text-[11px] text-slate-500">ગણતરી ચાલુ છે...</span>
                  )}
                </div>

                {eligibility && (
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">સંલગ્ન કુલ પશુઓ</span>
                      <span className="text-base font-bold text-slate-800">{eligibility.total_linked_animals}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 block">આ રસી માટે પાત્ર</span>
                      <span className="text-base font-bold text-emerald-800">{eligibility.eligible_animals_count}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-200">
                      <span className="text-[10px] text-blue-700 block">અગાઉથી સુરક્ષિત</span>
                      <span className="text-base font-bold text-blue-800">{eligibility.already_covered_count}</span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  * પસંદ કરેલ રસી માટે પાત્ર તમામ સભાસદ પશુઓ આ શેડ્યૂલમાં આપમેળે નોંધાઈ જશે.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ૪. લક્ષ્યાંકિત શરૂઆત તારીખ
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    રોગ નિવારણ હેતુ
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="હેતુ..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  વધારાની વિગત / વર્ણન
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="મંડળીના નિયમો અથવા વિશેષ નોંધ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-950 block">તાત્કાલિક TAHO સમીક્ષા માટે સબમિટ કરો</span>
                  <span className="text-[11px] text-emerald-800">
                    આ વિકલ્પ પસંદ કરવાથી શેડ્યૂલ બનતાની સાથે જ TAHO ના મંજૂરી ડેસ્ક પર પહોંચી જશે
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSubmitTaho}
                  onChange={(e) => setAutoSubmitTaho(e.target.checked)}
                  className="w-4 h-4 text-[#135D43] rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  રદ કરો
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingSchedule}>
                  શેડ્યૂલ પ્રસ્તાવિત કરો (Submit Schedule)
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
