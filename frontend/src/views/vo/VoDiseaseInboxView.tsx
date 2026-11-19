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
} from 'lucide-react';

export const VoDiseaseInboxView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('id');

  const { apiBaseUrl, session, hasPermission } = useAuth();
  const canConfirmDisease = hasPermission('disease.confirm');
  const authToken = session?.accessToken || '';

  const [reports, setReports] = useState<VODiseaseReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [diseaseFilter, setDiseaseFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selected Detail & Review Modal
  const [selectedReport, setSelectedReport] = useState<VODiseaseReport | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'DETAILS' | 'PHOTOS' | 'REVIEW_LOG'>('DETAILS');

  // Review Form State
  const [reviewType, setReviewType] = useState('FIELD_INVESTIGATION');
  const [assessment, setAssessment] = useState('SUSPECTED');
  const [reviewBasis, setReviewBasis] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Decision Form State (gated by disease.confirm)
  const [decisionAction, setDecisionAction] = useState<'CONFIRM' | 'DISPROVE' | 'INSUFFICIENT'>('CONFIRM');
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const loadReports = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const data = await voService.listReports(apiBaseUrl, {
        status: statusFilter || undefined,
        disease_code: diseaseFilter || undefined,
      });
      setReports(data);

      if (preselectedId) {
        const found = data.find((r) => r.report_id === preselectedId);
        if (found) setSelectedReport(found);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રોગ અહેવાલો મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [apiBaseUrl, statusFilter, diseaseFilter]);

  const totalCount = reports.length;
  const suspectedCount = reports.filter((r) => r.status === 'SUSPECTED').length;
  const underReviewCount = reports.filter((r) => r.status === 'UNDER_REVIEW').length;
  const confirmedCount = reports.filter((r) => r.status === 'CONFIRMED').length;

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
      // Reload detail
      const refreshed = await voService.getReport(apiBaseUrl, selectedReport.report_id);
      setSelectedReport(refreshed);
      await loadReports();
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

      const updated = await voService.decideReport(apiBaseUrl, selectedReport.report_id, payload);
      setNotice({
        type: 'success',
        message:
          decisionAction === 'CONFIRM'
            ? 'રોગ કેસની પુષ્ટિ સફળતાપૂર્વક નોંધાઈ.'
            : 'રોગ કેસ નકારવાનો નિર્ણય સફળતાપૂર્વક નોંધાયો.',
      });
      setSelectedReport(updated);
      setDecisionReason('');
      await loadReports();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'નિર્ણય સબમિટ કરવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const columns: Column<VODiseaseReport>[] = [
    {
      key: 'report_no',
      header: 'અહેવાલ નંબર / સ્ત્રોત',
      render: (row) => (
        <div>
          <div className="font-mono font-semibold text-[#1E293B]">
            {row.report_no || row.report_id.substring(0, 8)}
          </div>
          <div className="text-xs text-[#64748B]">સ્ત્રોત: {row.report_source}</div>
        </div>
      ),
    },
    {
      key: 'disease',
      header: 'શંકાસ્પદ રોગ',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {row.disease_code}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'તારીખ',
      render: (row) => (
        <div className="text-xs text-[#1E293B] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <span>{row.report_date}</span>
        </div>
      ),
    },
    {
      key: 'symptoms',
      header: 'નોંધાયેલા લક્ષણો',
      render: (row) => (
        <div className="text-xs text-[#64748B] max-w-xs truncate">
          {row.symptoms.length > 0 ? row.symptoms.join(', ') : 'કોઈ નહીં'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => {
        const variant =
          row.status === 'CONFIRMED'
            ? 'error'
            : row.status === 'SUSPECTED' || row.status === 'UNDER_REVIEW'
            ? 'warning'
            : 'neutral';
        const labelMap: Record<string, string> = {
          SUBMITTED: 'નોંધાયેલ',
          UNDER_REVIEW: 'સમીક્ષા હેઠળ',
          SUSPECTED: 'શંકાસ્પદ',
          CONFIRMED: 'પુષ્ટિ થયેલ',
          NOT_CONFIRMED: 'નકારાયેલ',
        };
        return <StatusChip variant={variant} label={labelMap[row.status] || row.status} />;
      },
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#135D43]" />
            રોગ દેખરેખ અને સમીક્ષા ઇનબોક્સ
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            તમારા અધિકૃત ગામડાઓમાંથી મળેલા પશુ રોગ અહેવાલોની ચકાસણી, ક્લિનિકલ નોંધ અને પુષ્ટિ.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReports} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
          તાજું કરો
        </Button>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{notice.message}</span>
        </div>
      )}

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
      <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <span>ફિલ્ટર:</span>
        </div>

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
        <StateView state="loading" message="રોગ અહેવાલો લોડ થઈ રહ્યા છે..." />
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

      {/* Review & Decision Modal */}
      {selectedReport && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReport(null)}
          title={`રોગ અહેવાલ સમીક્ષા: ${selectedReport.report_no || selectedReport.report_id.substring(0, 8)}`}
        >
          <div className="space-y-5">
            {/* Modal Tabs */}
            <div className="flex border-b border-[#E2E8F0] gap-2 pb-2">
              <button
                onClick={() => setActiveDetailTab('DETAILS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  activeDetailTab === 'DETAILS' ? 'bg-[#135D43] text-white' : 'text-[#64748B] hover:bg-gray-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                કેસ વિગત
              </button>
              <button
                onClick={() => setActiveDetailTab('PHOTOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  activeDetailTab === 'PHOTOS' ? 'bg-[#135D43] text-white' : 'text-[#64748B] hover:bg-gray-100'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                ફોટો પુરાવા
              </button>
            </div>

            {activeDetailTab === 'DETAILS' ? (
              <div className="space-y-4">
                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-xs text-[#1E293B]">
                  <div>
                    <span className="text-[#64748B]">રોગ લક્ષ્યાંક:</span>{' '}
                    <span className="font-bold text-amber-800">{selectedReport.disease_code}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">તારીખ:</span> {selectedReport.report_date}
                  </div>
                  <div>
                    <span className="text-[#64748B]">ગામ UUID:</span>{' '}
                    <span className="font-mono">{selectedReport.village_id.substring(0, 8)}...</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">પશુ ID:</span>{' '}
                    <span className="font-mono">{selectedReport.animal_id ? selectedReport.animal_id.substring(0, 8) : 'અનિયત'}</span>
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-[#64748B] uppercase mb-1">નોંધાયેલા લક્ષણો</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedReport.symptoms.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedReport.observation_text && (
                  <div>
                    <h5 className="text-xs font-bold text-[#64748B] uppercase mb-1">ક્ષેત્રીય અવલોકન નોંધ</h5>
                    <p className="text-xs bg-white p-3 rounded-xl border border-gray-200 text-[#1E293B]">
                      {selectedReport.observation_text}
                    </p>
                  </div>
                )}

                {/* Section 1: Add Investigation Review Notes */}
                <div className="border-t border-[#E2E8F0] pt-4">
                  <h4 className="text-sm font-bold text-[#1E293B] mb-2 flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-[#135D43]" />
                    ક્લિનિકલ તપાસ / સમીક્ષા નોંધ ઉમેરો
                  </h4>
                  <form onSubmit={handleAddReview} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="તપાસનો પ્રકાર">
                        <select
                          value={reviewType}
                          onChange={(e) => setReviewType(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white"
                        >
                          <option value="FIELD_INVESTIGATION">ક્ષેત્રીય તપાસ</option>
                          <option value="INITIAL_REVIEW">પ્રારંભિક સમીક્ષા</option>
                          <option value="VETERINARY_EXAMINATION">પશુ ચિકિત્સા પરીક્ષણ</option>
                          <option value="SECOND_OPINION">બીજો અભિપ્રાય</option>
                        </select>
                      </FormField>

                      <FormField label="ક્લિનિકલ તારણ">
                        <select
                          value={assessment}
                          onChange={(e) => setAssessment(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white"
                        >
                          <option value="SUSPECTED">શંકાસ્પદ</option>
                          <option value="NEEDS_MORE_INFORMATION">વધુ વિગત જરૂરી</option>
                          <option value="INSUFFICIENT_INFORMATION">અપૂરતી માહિતી</option>
                          <option value="NO_OPINION">કોઈ અભિપ્રાય નહીં</option>
                        </select>
                      </FormField>
                    </div>

                    <FormField label="સમીક્ષા નોંધ અને તારણો" required>
                      <textarea
                        value={reviewBasis}
                        onChange={(e) => setReviewBasis(e.target.value)}
                        rows={2}
                        placeholder="ક્લિનિકલ અવલોકન, લેબોરેટરી સેમ્પલિંગ અથવા સારવાર સૂચન લખો..."
                        className="w-full px-3 py-2 text-xs border rounded-lg"
                      />
                    </FormField>

                    <Button variant="outline" size="sm" type="submit" isLoading={isSubmittingReview}>
                      સમીક્ષા સાચવો
                    </Button>
                  </form>
                </div>

                {/* Section 2: Confirmation / Decision (Gated by disease.confirm) */}
                <div className="border-t border-[#E2E8F0] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#135D43]" />
                      અધિકૃત રોગ પુષ્ટિ / નકારવાનો નિર્ણય
                    </h4>
                    {canConfirmDisease ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        સત્તાવાર પરવાનગી સક્રિય
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        માત્ર વાંચવાની પરવાનગી
                      </span>
                    )}
                  </div>

                  {!canConfirmDisease ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      તમારા ખાતામાં <span className="font-mono font-semibold">disease.confirm</span> પરવાનગી નથી.
                      તમે ક્લિનિકલ નોંધ ઉમેરી શકો છો, પરંતુ સત્તાવાર રોગ પુષ્ટિ માત્ર અધિકૃત વેટરનરી અધિકારી કરી શકે છે.
                    </div>
                  ) : (
                    <form onSubmit={handleDecideReport} className="space-y-3 bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setDecisionAction('CONFIRM')}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            decisionAction === 'CONFIRM'
                              ? 'bg-red-700 text-white border-red-700'
                              : 'bg-white text-gray-700 border-gray-300'
                          }`}
                        >
                          રોગ પુષ્ટિ કરો
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionAction('DISPROVE')}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            decisionAction === 'DISPROVE'
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-gray-700 border-gray-300'
                          }`}
                        >
                          રોગ અસ્વીકાર / નકારો
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionAction('INSUFFICIENT')}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            decisionAction === 'INSUFFICIENT'
                              ? 'bg-gray-700 text-white border-gray-700'
                              : 'bg-white text-gray-700 border-gray-300'
                          }`}
                        >
                          અનિર્ણિત / વધુ વિગત બાકી
                        </button>
                      </div>

                      <FormField
                        label={
                          decisionAction === 'CONFIRM'
                            ? 'પુષ્ટિનો આધાર (લેબ ટેસ્ટ / ક્લિનિકલ ચિહ્નો)'
                            : decisionAction === 'DISPROVE'
                            ? 'રોગ નકારવાનું કારણ'
                            : 'અનિર્ણિત રાખવાનું કારણ'
                        }
                        required
                      >
                        <textarea
                          value={decisionReason}
                          onChange={(e) => setDecisionReason(e.target.value)}
                          rows={2}
                          placeholder="સરકારી રેકોર્ડ અને રોગ ફેલાવો અટકાવવા માટે વિગતવાર કારણ દાખલ કરો..."
                          className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                        />
                      </FormField>

                      <Button
                        variant={decisionAction === 'CONFIRM' ? 'danger' : 'primary'}
                        size="sm"
                        type="submit"
                        isLoading={isSubmittingDecision}
                      >
                        અંતિમ નિર્ણય સાચવો
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              /* PHOTOS TAB VIA ATTACHMENTVIEWER */
              <div className="py-2">
                <AttachmentViewer
                  reportId={selectedReport.report_id}
                  apiBaseUrl={apiBaseUrl}
                  authToken={authToken}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

