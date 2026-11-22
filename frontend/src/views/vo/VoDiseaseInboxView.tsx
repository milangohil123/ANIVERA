import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { AttachmentViewer } from '../../components/AttachmentViewer';
import { useAuth } from '../../context/AuthContext';
import { voService, type VODiseaseReport } from '../../services/voService';
import { healthWorkflowService, type FarmerReportItem, type CaseTreatmentPayload } from '../../services/healthWorkflowService';
import {
  Activity,
  RotateCcw,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Send,
  Camera,
  Stethoscope,
  UserCheck,
  MapPin,
  Plus,
  Trash2,
  X,
  Clock,
  PawPrint,
} from 'lucide-react';

const COMMON_DIAGNOSES = [
  'ખરવા-મોવાસા (Foot and Mouth Disease / FMD)',
  'ગળસૂંઠો (Hemorrhagic Septicemia / HS)',
  'ગાંઠિયો તાવ (Black Quarter / BQ)',
  'લમ્પી ચામડીનો રોગ (Lumpy Skin Disease / LSD)',
  'બ્રુસેલોસિસ (Brucellosis)',
  'આંચળનો સોજો / મસ્ટાઇટિસ (Mastitis)',
  'સામાન્ય તાવ / ન્યુમોનિયા (Pneumonia / Pyrexia)',
  'આફરો / કબજિયાત (Bloat / Indigestion)',
  'અન્ય ક્લિનિકલ રોગ (Other Condition)',
];

export const VoDiseaseInboxView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('id');

  const { apiBaseUrl, session, hasPermission } = useAuth();
  const canConfirmDisease = hasPermission('disease.confirm');

  // Top Page Tabs
  const [pageTab, setPageTab] = useState<'ASSIGNED_CASES' | 'INBOX'>('ASSIGNED_CASES');

  // Assigned Cases state
  const [assignedCases, setAssignedCases] = useState<FarmerReportItem[]>([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState<boolean>(true);

  // Treatment Modal state
  const [selectedCaseForTreatment, setSelectedCaseForTreatment] = useState<FarmerReportItem | null>(null);
  const [visitDateTime, setVisitDateTime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [clinicalObservations, setClinicalObservations] = useState<string>('');
  const [diagnosedDisease, setDiagnosedDisease] = useState<string>('ખરવા-મોવાસા (Foot and Mouth Disease / FMD)');
  const [treatmentProcedure, setTreatmentProcedure] = useState<string>('');
  const [treatmentNotes, setTreatmentNotes] = useState<string>('');
  const [nextVisitDate, setNextVisitDate] = useState<string>('');
  const [medicines, setMedicines] = useState<{ drug_name: string; dosage: string; route?: string }[]>([
    { drug_name: '', dosage: '', route: 'IM' },
  ]);
  const [treatmentPhotos, setTreatmentPhotos] = useState<string[]>([]);
  const [treatmentCoords, setTreatmentCoords] = useState<{ lat?: number; lng?: number } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [isSubmittingTreatment, setIsSubmittingTreatment] = useState<boolean>(false);

  // Legacy Inbox reports
  const [reports, setReports] = useState<VODiseaseReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [diseaseFilter, setDiseaseFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selected Detail & Review Modal
  const [selectedReport, setSelectedReport] = useState<VODiseaseReport | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'DETAILS' | 'PHOTOS'>('DETAILS');

  // Review Form State
  const [reviewType, setReviewType] = useState('FIELD_INVESTIGATION');
  const [assessment, setAssessment] = useState('SUSPECTED');
  const [reviewBasis, setReviewBasis] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Decision Form State (gated by disease.confirm)
  const [decisionAction, setDecisionAction] = useState<'CONFIRM' | 'DISPROVE' | 'INSUFFICIENT'>('CONFIRM');
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const loadAllData = async () => {
    setIsLoading(true);
    setIsLoadingAssigned(true);
    setNotice(null);
    try {
      const [cases, data] = await Promise.all([
        healthWorkflowService.listAssignedCases(apiBaseUrl).catch(() => []),
        voService.listReports(apiBaseUrl, {
          status: statusFilter || undefined,
          disease_code: diseaseFilter || undefined,
        }).catch(() => []),
      ]);
      setAssignedCases(cases || []);
      setReports(data || []);

      if (preselectedId) {
        const found = data.find((r) => r.report_id === preselectedId);
        if (found) setSelectedReport(found);
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રોગ અહેવાલો મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
      setIsLoadingAssigned(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [apiBaseUrl, statusFilter, diseaseFilter]);

  const totalCount = reports.length;
  const suspectedCount = reports.filter((r) => r.status === 'SUSPECTED').length;
  const underReviewCount = reports.filter((r) => r.status === 'UNDER_REVIEW').length;
  const confirmedCount = reports.filter((r) => r.status === 'CONFIRMED').length;

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setNotice({ type: 'error', message: 'GPS સપોર્ટ ઉપલબ્ધ નથી.' });
      return;
    }
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTreatmentCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setIsCapturingGps(false);
      },
      () => {
        setIsCapturingGps(false);
        setNotice({ type: 'error', message: 'GPS લોકેશન મેળવવામાં ક્ષતિ થઈ.' });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        if (uploadEvt.target?.result) {
          setTreatmentPhotos((prev) => [...prev, uploadEvt.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const addMedicine = () => {
    setMedicines((prev) => [...prev, { drug_name: '', dosage: '', route: 'IM' }]);
  };

  const updateMedicine = (index: number, field: string, val: string) => {
    setMedicines((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: val } : m))
    );
  };

  const removeMedicine = (index: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTreatmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForTreatment) return;

    if (!clinicalObservations.trim()) {
      setNotice({ type: 'error', message: 'ક્લિનિકલ નિરીક્ષણો અને લક્ષણો દાખલ કરવા જરૂરી છે.' });
      return;
    }

    setIsSubmittingTreatment(true);
    try {
      const validMeds = medicines.filter((m) => m.drug_name.trim());
      const payload: CaseTreatmentPayload = {
        visit_date: visitDateTime,
        observations: clinicalObservations.trim(),
        diagnosed_disease: diagnosedDisease,
        treatment_procedure: treatmentProcedure.trim() || undefined,
        medicines_administered: validMeds,
        treatment_notes: treatmentNotes.trim() || undefined,
        next_visit_date: nextVisitDate || undefined,
        before_photos: treatmentPhotos.slice(0, 2),
        after_photos: treatmentPhotos.slice(2),
        latitude: treatmentCoords?.lat,
        longitude: treatmentCoords?.lng,
      };

      await healthWorkflowService.recordCaseTreatment(
        apiBaseUrl,
        selectedCaseForTreatment.report_id,
        payload
      );

      setNotice({
        type: 'success',
        message: `કેસ #${selectedCaseForTreatment.report_no || selectedCaseForTreatment.report_id.slice(0, 8)} ની સારવાર સફળતાપૂર્વક નોંધાઈ છે! હવે તે TAHO ચકાસણી હેઠળ મોકલાયેલ છે.`,
      });
      setSelectedCaseForTreatment(null);
      loadAllData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err?.message || 'સારવાર રેકોર્ડ કરવામાં ક્ષતિ આવી.',
      });
    } finally {
      setIsSubmittingTreatment(false);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    if (!reviewBasis.trim()) {
      setNotice({ type: 'error', message: 'ક્લિનિકલ સમીક્ષા નોંધ અને તારણો લખવા જરૂરી છે.' });
      return;
    }

    setIsSubmittingReview(true);
    try {
      await voService.addReview(apiBaseUrl, selectedReport.report_id, {
        review_type: reviewType,
        assessment,
        basis: reviewBasis.trim(),
      });
      setNotice({ type: 'success', message: 'ક્લિનિકલ સમીક્ષા સફળતાપૂર્વક નોંધાઈ.' });
      setReviewBasis('');
      const refreshed = await voService.getReport(apiBaseUrl, selectedReport.report_id);
      setSelectedReport(refreshed);
      await loadAllData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'સમીક્ષા નોંધવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDecideReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    if (!decisionReason.trim()) {
      setNotice({ type: 'error', message: 'નિર્ણય માટેનું અધિકૃત કારણ / ક્લિનિકલ પુરાવો આપવો ફરજિયાત છે.' });
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const payload: any = { action: decisionAction };
      if (decisionAction === 'CONFIRM') {
        payload.confirmation_basis = decisionReason.trim();
      } else if (decisionAction === 'DISPROVE') {
        payload.not_confirmed_reason = decisionReason.trim();
      }

      await voService.decideReport(apiBaseUrl, selectedReport.report_id, payload);
      setNotice({ type: 'success', message: 'રોગ અહેવાલ પર સત્તાવાર નિર્ણય સફળતાપૂર્વક લેવાયો.' });
      setSelectedReport(null);
      await loadAllData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'નિર્ણય લેવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const columns: Column<VODiseaseReport>[] = [
    {
      key: 'report_no',
      header: 'અહેવાલ ક્રમાંક',
      render: (row) => (
        <div className="font-mono text-xs font-bold text-[#1E293B]">
          {row.report_no || row.report_id.substring(0, 8)}
        </div>
      ),
    },
    {
      key: 'disease_code',
      header: 'શંકાસ્પદ રોગ',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
          <Activity className="w-3 h-3 text-amber-700" />
          {row.disease_code}
        </span>
      ),
    },
    {
      key: 'animal',
      header: 'પશુ વિગત',
      render: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-[#1E293B]">{row.species_code}</div>
          <div className="text-[#64748B] font-mono text-[11px]">{row.animal_tag || row.animal_id}</div>
        </div>
      ),
    },
    {
      key: 'report_date',
      header: 'અહેવાલ તારીખ',
      render: (row) => (
        <div className="text-xs text-[#64748B] flex items-center gap-1 font-mono">
          <Calendar className="w-3 h-3 text-[#94A3B8]" />
          <span>{row.report_date}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => (
        <StatusChip
          status={row.status === 'CONFIRMED' ? 'SUCCESS' : row.status === 'SUSPECTED' ? 'WARNING' : 'PENDING'}
          text={row.status}
        />
      ),
    },
    {
      key: 'actions',
      header: 'કાર્યવાહી',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedReport(row);
            setActiveDetailTab('DETAILS');
          }}
        >
          સમીક્ષા / વિગત
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-[#135D43]" />
            વેટરનરી ઓફિસર ક્લિનિકલ સારવાર & રોગ સમીક્ષા
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            TAHO દ્વારા સોંપાયેલા કેસોની સ્થળ પર તપાસ, દવાઓ, સારવાર નોંધણી અને રોગ દેખરેખ ઇનબોક્સ
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllData} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
          તાજું કરો
        </Button>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-3 rounded-xl border">
        <button
          onClick={() => setPageTab('ASSIGNED_CASES')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            pageTab === 'ASSIGNED_CASES'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>મને સોંપાયેલ સ્વાસ્થ્ય કેસો ({assignedCases.length})</span>
          {assignedCases.filter((c) => c.treatment_status === 'ASSIGNED').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setPageTab('INBOX')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            pageTab === 'INBOX'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>રોગ સર્વેલન્સ ઇનબોક્સ & અહેવાલો ({reports.length})</span>
        </button>
      </div>

      {/* TAB 1: ASSIGNED CASES */}
      {pageTab === 'ASSIGNED_CASES' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950">
            <div className="flex items-center gap-2.5">
              <Stethoscope className="w-5 h-5 text-emerald-700" />
              <div>
                <span className="font-bold block">ક્લિનિકલ મુલાકાત અને સારવાર નોંધણી ડેસ્ક</span>
                <span className="text-[11px] text-emerald-800">
                  તાલુકા અધિકારી (TAHO) તરફથી તમને સોંપાયેલ કેસોની મુલાકાત લો, દવાઓ આપો અને સારવાર રેકોર્ડ સબમિટ કરો.
                </span>
              </div>
            </div>
            <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-300">
              {assignedCases.length} કેસો
            </span>
          </div>

          {isLoadingAssigned ? (
            <StateView state="loading" title="સોંપાયેલ કેસો લોડ થઈ રહ્યા છે..." />
          ) : assignedCases.length === 0 ? (
            <StateView
              state="empty"
              title="કોઈ સોંપાયેલ કેસ નથી"
              message="હાલમાં તમારા નામે કોઈ સ્વાસ્થ્ય કેસ સોંપાયેલ નથી."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {assignedCases.map((c) => {
                const isTreated = ['TREATED_PENDING_VERIFICATION', 'VERIFIED_CLOSED'].includes(c.treatment_status);
                return (
                  <div
                    key={c.report_id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                              {c.report_no || c.report_id.slice(0, 8)}
                            </span>
                            <span className="font-bold text-xs text-slate-800">
                              {c.is_unknown_disease
                                ? `અજ્ઞાત સ્વાસ્થ્ય સ્થિતિ ${c.custom_disease_name ? `(${c.custom_disease_name})` : ''}`
                                : c.custom_disease_name || c.disease_code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                            ગામ: {c.village_name_gu || c.village_id} • તારીખ: {new Date(c.report_date).toLocaleDateString('gu-IN')}
                          </p>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.urgency === 'EMERGENCY'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : c.urgency === 'URGENT'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.urgency}
                        </span>
                      </div>

                      <div className="mt-2 text-xs space-y-1 text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-500">પશુ & ખેડૂત:</span>
                          <span className="font-semibold text-slate-900">
                            {c.animal_name || 'પશુ'} {c.animal_tag_id ? `(ટેગ: ${c.animal_tag_id})` : ''} • {c.farmer_name}
                          </span>
                        </div>
                        {c.symptoms && c.symptoms.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">ફરિયાદ / લક્ષણ:</span>
                            <span className="font-medium text-slate-800 text-right line-clamp-1">
                              {c.symptoms.join(', ')}
                            </span>
                          </div>
                        )}
                        {c.photo_urls && c.photo_urls.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-800">
                            <Camera className="w-3.5 h-3.5" />
                            <span>ખેડૂત દ્વારા {c.photo_urls.length} ફોટા અપલોડ થયેલ છે</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          c.treatment_status === 'VERIFIED_CLOSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.treatment_status === 'TREATED_PENDING_VERIFICATION'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.treatment_status === 'VERIFIED_CLOSED'
                          ? 'ચકાસાયેલ અને બંધ'
                          : c.treatment_status === 'TREATED_PENDING_VERIFICATION'
                          ? 'સારવાર નોંધાઈ - TAHO ચકાસણી બાકી'
                          : 'સારવાર બાકી'}
                      </span>

                      {!isTreated && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setSelectedCaseForTreatment(c);
                            setClinicalObservations('');
                            setTreatmentProcedure('');
                            setTreatmentNotes('');
                            setMedicines([{ drug_name: '', dosage: '', route: 'IM' }]);
                            setTreatmentPhotos([]);
                            setTreatmentCoords(null);
                          }}
                        >
                          <Stethoscope className="w-3.5 h-3.5 mr-1" />
                          સારવાર નોંધો
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INBOX & EARLY WARNING (EXISTING) */}
      {pageTab === 'INBOX' && (
        <div className="space-y-4">
          {/* KPI Overview Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <KpiCard
              label="કુલ રોગ અહેવાલો"
              value={isLoading ? '...' : totalCount}
              subtext="તમારા અધિકૃત ગામડાં"
              icon={<FileText className="w-3.5 h-3.5" />}
              iconVariant="primary"
              isLoading={isLoading}
            />
            <KpiCard
              label="શંકાસ્પદ કેસ"
              value={isLoading ? '...' : suspectedCount}
              valueColor="text-amber-700"
              subtext="પ્રાથમિક મૂલ્યાંકન બાકી"
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              iconVariant="amber"
              isLoading={isLoading}
            />
            <KpiCard
              label="સમીક્ષા હેઠળ"
              value={isLoading ? '...' : underReviewCount}
              valueColor="text-blue-700"
              subtext="ક્ષેત્રીય તપાસ ચાલુ"
              icon={<Activity className="w-3.5 h-3.5" />}
              iconVariant="blue"
              isLoading={isLoading}
            />
            <KpiCard
              label="પુષ્ટિ થયેલ રોગચાળો"
              value={isLoading ? '...' : confirmedCount}
              valueColor="text-red-700"
              subtext="ક્લિનિકલ પુષ્ટિ થયેલ"
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
              iconVariant="rose"
              isLoading={isLoading}
            />
          </div>

          {/* Filters Bar */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg bg-white"
            >
              <option value="">બધી સ્થિતિ</option>
              <option value="SUSPECTED">શંકાસ્પદ</option>
              <option value="UNDER_REVIEW">સમીક્ષા હેઠળ</option>
              <option value="CONFIRMED">પુષ્ટિ થયેલ</option>
              <option value="NOT_CONFIRMED">નકારાયેલ</option>
            </select>

            <select
              value={diseaseFilter}
              onChange={(e) => setDiseaseFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg bg-white"
            >
              <option value="">બધા રોગો</option>
              <option value="FMD">FMD (ખરવા-મોવાસા)</option>
              <option value="HS">HS (ગળસૂંઠો)</option>
              <option value="BQ">BQ (ગાઠીયો તાવ)</option>
              <option value="BRUCELLOSIS">Brucellosis (બ્રુસેલોસિસ)</option>
              <option value="PPR">PPR (પીપીઆર)</option>
            </select>
          </div>

          {/* Reports Table */}
          {isLoading ? (
            <StateView state="loading" title="રોગ અહેવાલો લોડ થઈ રહ્યા છે..." />
          ) : reports.length === 0 ? (
            <StateView
              state="empty"
              title="કોઈ રોગ અહેવાલ મળ્યો નથી"
              message="તમારા સોંપાયેલા ગામડાં માટે પસંદ કરેલ ફિલ્ટરમાં કોઈ અહેવાલ ઉપલબ્ધ નથી."
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
              <DataTable data={reports} columns={columns} keyExtractor={(r) => r.report_id} />
            </div>
          )}
        </div>
      )}

      {/* MODAL: RECORD CLINICAL TREATMENT */}
      {selectedCaseForTreatment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs font-body animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-200 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    ક્લિનિકલ પરીક્ષણ & સારવાર નોંધણી (Case #{selectedCaseForTreatment.report_no || selectedCaseForTreatment.report_id.slice(0, 8)})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedCaseForTreatment.animal_name || 'પશુ'} • {selectedCaseForTreatment.farmer_name} ({selectedCaseForTreatment.village_name_gu})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCaseForTreatment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTreatmentSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    મુલાકાત તારીખ અને સમય *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={visitDateTime}
                    onChange={(e) => setVisitDateTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ક્લિનિકલ નિદાન (Official Diagnosis) *
                  </label>
                  <select
                    value={diagnosedDisease}
                    onChange={(e) => setDiagnosedDisease(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  >
                    {COMMON_DIAGNOSES.map((d, i) => (
                      <option key={i} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ક્લિનિકલ નિરીક્ષણો / શારીરિક તપાસ (Physical Examination & Symptoms) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={clinicalObservations}
                  onChange={(e) => setClinicalObservations(e.target.value)}
                  placeholder="શરીરનું તાપમાન (°F), નાડી, શ્વાસ, ચાંદાની સ્થિતિ, સોજો કે અન્ય ચિહ્નો..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  સારવાર પ્રક્રિયા (Treatment Procedure Performed)
                </label>
                <input
                  type="text"
                  value={treatmentProcedure}
                  onChange={(e) => setTreatmentProcedure(e.target.value)}
                  placeholder="દા.ત. ઘા સાફ કર્યા, એન્ટિસેપ્ટિક ડ્રેસિંગ, સેલાઇન ડ્રિપ ચઢાવી..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              {/* Medicines Administered */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    આપેલી દવાઓ (Medicines Administered)
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedicine} className="text-[11px] py-1">
                    <Plus className="w-3 h-3 mr-1" /> દવા ઉમેરો
                  </Button>
                </div>

                {medicines.map((med, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="દવાનું નામ (દા.ત. Oxytetracycline / Meloxicam)"
                      value={med.drug_name}
                      onChange={(e) => updateMedicine(idx, 'drug_name', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="માત્રા (15 ml)"
                      value={med.dosage}
                      onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)}
                      className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <select
                      value={med.route}
                      onChange={(e) => updateMedicine(idx, 'route', e.target.value)}
                      className="w-20 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      <option value="IM">IM</option>
                      <option value="SC">SC</option>
                      <option value="IV">IV</option>
                      <option value="Oral">Oral</option>
                    </select>
                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Photos & GPS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    સારવાર સ્થળના ફોટા (Before & After Photos)
                  </label>
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-xl border border-dashed border-slate-300 hover:bg-slate-100 cursor-pointer text-xs font-medium">
                    <Camera className="w-4 h-4 text-slate-600" />
                    <span>કેમેરા / ફોટો પસંદ કરો</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {treatmentPhotos.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {treatmentPhotos.map((p, i) => (
                        <img key={i} src={p} alt="t" className="w-12 h-12 rounded object-cover border" />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    સ્થળ GPS લોકેશન
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCaptureLocation}
                      isLoading={isCapturingGps}
                      className="text-xs"
                    >
                      <MapPin className="w-3.5 h-3.5 mr-1 text-[#135D43]" />
                      {treatmentCoords ? 'GPS ફરી મેળવો' : 'GPS લોકેશન લો'}
                    </Button>
                    {treatmentCoords && (
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        {treatmentCoords.lat}, {treatmentCoords.lng}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ખેડૂતને સૂચના / નોંધ (Farmer Advice)
                </label>
                <input
                  type="text"
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                  placeholder="દા.ત. ૩ દિવસ દૂધ ઉકાળીને વાપરવું, ઠંડા પાણીથી સ્પોન્જિંગ કરવું..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" type="button" onClick={() => setSelectedCaseForTreatment(null)}>
                  રદ કરો
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingTreatment}>
                  સારવાર રેકોર્ડ સબમિટ કરો (Submit for Verification)
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEGACY REPORT REVIEW MODAL */}
      {selectedReport && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReport(null)}
          title={`રોગ અહેવાલ સમીક્ષા: ${selectedReport.report_no || selectedReport.report_id.substring(0, 8)}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-[#1E293B] space-y-1">
              <div><strong>રોગ:</strong> {selectedReport.disease_code}</div>
              <div><strong>તારીખ:</strong> {selectedReport.report_date}</div>
              <div><strong>લક્ષણો:</strong> {selectedReport.symptoms?.join(', ')}</div>
            </div>

            <form onSubmit={handleAddReview} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">ક્લિનિકલ નોંધ</label>
                <textarea
                  rows={2}
                  required
                  value={reviewBasis}
                  onChange={(e) => setReviewBasis(e.target.value)}
                  placeholder="તારણો લખો..."
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setSelectedReport(null)}>
                  બંધ કરો
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingReview}>
                  સમીક્ષા સાચવો
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
