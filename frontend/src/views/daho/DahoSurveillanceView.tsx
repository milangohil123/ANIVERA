import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { Modal } from '../../components/common/Modal';
import { FormField } from '../../components/common/FormField';
import { useAuth } from '../../context/AuthContext';
import { adminService, type VillageItem } from '../../services/adminService';
import { dahoOpsService, type DiseaseReportItem } from '../../services/dahoOpsService';
import {
  Activity,
  RotateCcw,
  AlertTriangle,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Check,
} from 'lucide-react';

export const DahoSurveillanceView: React.FC = () => {
  const { apiBaseUrl, scope, profile } = useAuth();
  const assignedDistrictId = scope?.assigned_districts?.[0] || profile?.assigned_districts?.[0];

  const [reports, setReports] = useState<DiseaseReportItem[]>([]);
  const [villages, setVillages] = useState<VillageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detail & Decision Modal State
  const [selectedReport, setSelectedReport] = useState<DiseaseReportItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'CONFIRM' | 'DISPROVE' | 'INSUFFICIENT'>('CONFIRM');
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const loadReports = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const [data, vilList] = await Promise.all([
        dahoOpsService.listDiseaseReports(apiBaseUrl),
        assignedDistrictId ? adminService.listVillages(apiBaseUrl, assignedDistrictId) : Promise.resolve([]),
      ]);
      setReports(data || []);
      setVillages(vilList || []);
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
  }, [apiBaseUrl, assignedDistrictId]);

  const getVillageName = (vId?: string | null) => {
    if (!vId) return 'અજ્ઞાત ગામ';
    const v = villages.find((item) => item.id === vId);
    if (v) return `${v.name_gu || v.name_en} (${v.name_en || v.name_gu})`;
    return String(vId).slice(0, 8);
  };

  const totalCount = reports.length;
  const suspectedCount = reports.filter((r) =>
    ['SUSPECTED', 'SUBMITTED', 'UNCONFIRMED', 'UNDER_REVIEW'].includes(r.status)
  ).length;
  const confirmedCount = reports.filter((r) => r.status === 'CONFIRMED').length;
  const rejectedCount = reports.filter((r) =>
    ['REJECTED', 'NOT_CONFIRMED', 'DISPROVED'].includes(r.status)
  ).length;

  const handleOpenDetailModal = (report: DiseaseReportItem) => {
    setSelectedReport(report);
    setDecisionAction('CONFIRM');
    setDecisionReason('');
    setIsDetailModalOpen(true);
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    const targetId = selectedReport.report_id || selectedReport.id;
    if (!targetId) return;

    if ((decisionAction === 'CONFIRM' || decisionAction === 'DISPROVE') && !decisionReason.trim()) {
      setNotice({
        type: 'error',
        message: 'નિર્ણય માટે અધિકૃત તબીબી આધાર અથવા કારણ લખવું ફરજિયાત છે.',
      });
      return;
    }

    setIsSubmittingDecision(true);
    try {
      await dahoOpsService.decideDiseaseReport(apiBaseUrl, targetId, {
        action: decisionAction,
        confirmation_basis: decisionAction === 'CONFIRM' ? decisionReason.trim() : undefined,
        not_confirmed_reason: decisionAction === 'DISPROVE' ? decisionReason.trim() : undefined,
      });

      setNotice({
        type: 'success',
        message: `રોગ અહેવાલ ${selectedReport.report_no || targetId.substring(0, 8)} પર નિર્ણય સફળતાપૂર્વક નોંધાયો.`,
      });
      setIsDetailModalOpen(false);
      await loadReports();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'નિર્ણય નોંધવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const columns: Column<DiseaseReportItem>[] = [
    {
      key: 'report_no',
      header: 'અહેવાલ નંબર',
      render: (row) => {
        const idVal = row.report_no || row.report_id || row.id || '';
        const displayNo = row.report_no || (idVal ? `REP-${String(idVal).substring(0, 8).toUpperCase()}` : 'અહેવાલ');
        return (
          <div className="font-mono font-semibold text-[#1E293B]">
            {displayNo}
          </div>
        );
      },
    },
    {
      key: 'disease',
      header: 'શંકાસ્પદ રોગ',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {row.disease_code || 'અજ્ઞાત'}
        </span>
      ),
    },
    {
      key: 'village',
      header: 'ગામ',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[#1E293B]">
          <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
          <span>{getVillageName(row.village_id)}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'તારીખ',
      render: (row) => {
        const dateVal = row.received_at || row.report_date;
        return (
          <div className="text-xs text-[#64748B] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateVal ? new Date(dateVal).toLocaleDateString('gu-IN') : '-'}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'સમીક્ષા સ્થિતિ',
      render: (row) => {
        const isConfirmed = row.status === 'CONFIRMED';
        const isSuspected = ['SUSPECTED', 'SUBMITTED', 'UNCONFIRMED', 'UNDER_REVIEW'].includes(row.status);
        const variant = isConfirmed ? 'error' : isSuspected ? 'warning' : 'neutral';
        const labelMap: Record<string, string> = {
          SUBMITTED: 'નવી નોંધણી (સમીક્ષા બાકી)',
          SUSPECTED: 'શંકાસ્પદ (તપાસ બાકી)',
          UNCONFIRMED: 'અનકન્ફર્મ્ડ (તપાસ બાકી)',
          UNDER_REVIEW: 'તપાસ હેઠળ',
          CONFIRMED: 'પુષ્ટિ થયેલ (Confirmed)',
          REJECTED: 'નકારાયેલ (Rejected)',
          NOT_CONFIRMED: 'પુષ્ટિ થયેલ નથી',
          DISPROVED: 'ખોટો કેસ (Disproved)',
          INSUFFICIENT_EVIDENCE: 'અપૂરતા પુરાવા',
        };
        return <StatusChip variant={variant} label={labelMap[row.status] || row.status || 'બાકી'} />;
      },
    },
    {
      key: 'actions',
      header: 'કાર્યવાહી',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenDetailModal(row)}
          leftIcon={<Eye className="w-3 h-3" />}
        >
          વિગત જુઓ
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#135D43]" />
            રોગ દેખરેખ અને પૂર્વ ચેતવણી (Disease Surveillance & Early Warning)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            જિલ્લાના ક્ષેત્રીય કાર્યકરો અને પશુપાલકો દ્વારા નોંધાયેલ રોગ અહેવાલો, લક્ષણો અને વિભાગીય પુષ્ટિ નિર્ણય.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadReports}
          isLoading={isLoading}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
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
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* KPI Overview Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <KpiCard
          label="કુલ અહેવાલો"
          value={isLoading ? '...' : totalCount}
          subtext="બોટાદ જિલ્લો"
          icon={<FileText className="w-3.5 h-3.5" />}
          iconVariant="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="શંકાસ્પદ કેસ"
          value={isLoading ? '...' : suspectedCount}
          valueColor="text-amber-700"
          subtext="ક્લિનિકલ સમીક્ષા / નિર્ણય બાકી"
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          iconVariant="amber"
          isLoading={isLoading}
        />
        <KpiCard
          label="પુષ્ટિ થયેલ કેસ"
          value={isLoading ? '...' : confirmedCount}
          valueColor="text-red-700"
          subtext="વિભાગીય પુષ્ટિ થયેલ રોગચાળો"
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          iconVariant="rose"
          isLoading={isLoading}
        />
        <KpiCard
          label="નકારાયેલ / સલામત"
          value={isLoading ? '...' : rejectedCount}
          valueColor="text-emerald-700"
          subtext="નેગેટિવ તારણો"
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
      </div>

      {isLoading ? (
        <StateView state="loading" message="રોગ અહેવાલો લોડ થઈ રહ્યા છે..." />
      ) : reports.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ રોગ અહેવાલ નોંધાયેલ નથી"
          message="આ જિલ્લામાં હાલમાં કોઈ સક્રિય રોગ અહેવાલ બાકી નથી."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable
            data={reports}
            columns={columns}
            keyExtractor={(r) => r.id || r.report_id || String(Math.random())}
          />
        </div>
      )}

      {/* Detail & Decision Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`રોગ અહેવાલ વિગત: ${selectedReport?.report_no || (selectedReport ? String(selectedReport.report_id || selectedReport.id || '').slice(0, 8) : '')}`}
        maxWidth="lg"
      >
        {selectedReport && (
          <div className="space-y-4 text-xs">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">શંકાસ્પદ રોગ</span>
                <span className="font-bold text-amber-700 text-sm">{selectedReport.disease_code}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">ગામ</span>
                <span className="font-semibold text-slate-800">{getVillageName(selectedReport.village_id)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">નોંધાયા તારીખ</span>
                <span className="font-semibold text-slate-800">
                  {selectedReport.received_at
                    ? new Date(selectedReport.received_at).toLocaleDateString('gu-IN')
                    : selectedReport.report_date || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">સ્ત્રોત (Source)</span>
                <span className="font-medium text-slate-700">{selectedReport.report_source || 'FARMER_APP'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">હાલની સ્થિતિ</span>
                <span className="font-bold text-slate-800">{selectedReport.status}</span>
              </div>
            </div>

            {/* Observed Symptoms */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1">નોંધાયેલ લક્ષણો (Symptoms):</span>
              {selectedReport.symptoms && selectedReport.symptoms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedReport.symptoms.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">કોઈ વિશેષ લક્ષણ ટેગ નોંધાયેલ નથી</p>
              )}
            </div>

            {/* Observation narrative */}
            {selectedReport.observation_text && (
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 block mb-0.5">અવલોકન / નોંધ (Notes):</span>
                <p className="text-slate-600 leading-relaxed">{selectedReport.observation_text}</p>
              </div>
            )}

            {/* Existing confirmation detail if already decided */}
            {selectedReport.status === 'CONFIRMED' && selectedReport.confirmation_basis && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900">
                <span className="font-bold block text-xs">✓ રોગ પુષ્ટિ થયેલ (Confirmed Basis):</span>
                <p className="text-xs mt-0.5">{selectedReport.confirmation_basis}</p>
              </div>
            )}
            {selectedReport.status === 'NOT_CONFIRMED' && selectedReport.not_confirmed_reason && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                <span className="font-bold block text-xs">✓ નકારાયેલ કારણ (Disproved Reason):</span>
                <p className="text-xs mt-0.5">{selectedReport.not_confirmed_reason}</p>
              </div>
            )}

            {/* DAHO Departmental Decision Section */}
            {selectedReport.status !== 'CONFIRMED' && selectedReport.status !== 'NOT_CONFIRMED' && (
              <form onSubmit={handleDecisionSubmit} className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5 text-xs text-[#135D43] font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>DAHO વિભાગીય સમીક્ષા & સત્તાવાર નિર્ણય</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisionAction('CONFIRM')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors ${
                      decisionAction === 'CONFIRM'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    રોગ પુષ્ટિ કરો (Confirm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('DISPROVE')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors ${
                      decisionAction === 'DISPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    કેસ નકારો (Disprove)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('INSUFFICIENT')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors ${
                      decisionAction === 'INSUFFICIENT'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    અપૂરતા પુરાવા (Insufficient)
                  </button>
                </div>

                <FormField
                  label={
                    decisionAction === 'CONFIRM'
                      ? 'પુષ્ટિ કરવાનો તબીબી/લેબ આધાર (Confirmation Basis) *'
                      : decisionAction === 'DISPROVE'
                      ? 'કેસ નકારવાનું કારણ (Reason for Disproval) *'
                      : 'અપૂરતા પુરાવાની વિગત (વૈકલ્પિક)'
                  }
                  required={decisionAction !== 'INSUFFICIENT'}
                >
                  <textarea
                    rows={2}
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder={
                      decisionAction === 'CONFIRM'
                        ? 'ઉદા. ક્લિનિકલ ચકાસણી અને સેમ્પલ રિપોર્ટ દ્વારા FMD પુષ્ટિ થયેલ...'
                        : 'ઉદા. તપાસ દરમિયાન સામાન્ય તાવ જણાયો, કોઈ સંક્રામક લક્ષણો નથી...'
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#135D43]"
                  />
                </FormField>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" type="button" onClick={() => setIsDetailModalOpen(false)}>
                    બંધ કરો
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    isLoading={isSubmittingDecision}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    નિર્ણય સબમિટ કરો
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
