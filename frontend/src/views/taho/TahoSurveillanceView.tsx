import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { healthWorkflowService, type FarmerReportItem } from '../../services/healthWorkflowService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  Activity,
  AlertTriangle,
  ShieldAlert,
  Search,
  RotateCcw,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
  Stethoscope,
  ShieldCheck,
  X,
  FileText,
  AlertCircle,
  Camera,
  MapPin,
  Send,
  ChevronRight,
} from 'lucide-react';

export const TahoSurveillanceView: React.FC = () => {
  const { apiBaseUrl, selectedTalukaId } = useAuth();

  const [activeTab, setActiveTab] = useState<'SURVEILLANCE' | 'CASES' | 'VERIFICATION'>('CASES');

  // Surveillance data
  const [reports, setReports] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');
  const [diseaseFilter, setDiseaseFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Health Cases & Assignment data
  const [cases, setCases] = useState<FarmerReportItem[]>([]);
  const [vos, setVos] = useState<any[]>([]);
  const [fws, setFws] = useState<any[]>([]);
  const [caseFilterStatus, setCaseFilterStatus] = useState<string>('');
  const [caseFilterUrgency, setCaseFilterUrgency] = useState<string>('');

  // Modals
  const [selectedCaseForAssign, setSelectedCaseForAssign] = useState<FarmerReportItem | null>(null);
  const [assignRole, setAssignRole] = useState<'VO' | 'FW' | 'BOTH'>('BOTH');
  const [selectedVoId, setSelectedVoId] = useState<string>('');
  const [selectedFwId, setSelectedFwId] = useState<string>('');
  const [assignPriority, setAssignPriority] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('URGENT');
  const [assignInstructions, setAssignInstructions] = useState<string>('');
  const [plannedVisitDate, setPlannedVisitDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Verification Modal
  const [selectedCaseForVerify, setSelectedCaseForVerify] = useState<FarmerReportItem | null>(null);
  const [verifyDecision, setVerifyDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [followupInstructions, setFollowupInstructions] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setNotification(null);
    try {
      const [repList, alertList, hier, caseList, voList, fwList, clusterList] = await Promise.all([
        adminService.listTahoSurveillance(apiBaseUrl, {
          taluka_id: selectedTalukaId || undefined,
          village_id: selectedVillageId || undefined,
          disease_code: diseaseFilter || undefined,
          status: statusFilter || undefined,
        }).catch(() => []),
        adminService.listTahoDiseaseAlerts(apiBaseUrl, selectedTalukaId || undefined).catch(() => []),
        adminService.getTahoHierarchy(apiBaseUrl, selectedTalukaId || undefined).catch(() => null),
        healthWorkflowService.listTahoCases(apiBaseUrl, {
          taluka_id: selectedTalukaId || undefined,
          status_filter: caseFilterStatus || undefined,
          urgency: caseFilterUrgency || undefined,
          village_id: selectedVillageId || undefined,
        }).catch(() => []),
        adminService.listTahoVos(apiBaseUrl, selectedTalukaId || undefined).catch(() => []),
        adminService.listTahoFws(apiBaseUrl, selectedTalukaId || undefined).catch(() => []),
        healthWorkflowService.getDiseaseClusters(apiBaseUrl).catch(() => []),
      ]);
      setReports(repList || []);
      setAlerts(alertList || []);
      setHierarchy(hier);
      setCases(caseList || []);
      setVos(voList || []);
      setFws(fwList || []);
      setClusters(clusterList || []);
    } catch (err: any) {
      console.warn('Surveillance load note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, selectedVillageId, diseaseFilter, statusFilter, caseFilterStatus, caseFilterUrgency, selectedTalukaId]);

  const allVillages = hierarchy?.villages || [];

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForAssign) return;

    if (!selectedVoId) {
      setNotification({ type: 'error', message: 'કૃપા કરીને અધિકૃત વેટરનરી અધિકારી (VO) પસંદ કરો.' });
      return;
    }

    setIsAssigning(true);
    try {
      await healthWorkflowService.assignTahoCase(apiBaseUrl, selectedCaseForAssign.report_id, {
        assigned_to_role: 'VO',
        assigned_vo_id: selectedVoId,
        priority: assignPriority,
        instructions: assignInstructions.trim() || undefined,
        planned_visit_date: plannedVisitDate || undefined,
      });

      setNotification({
        type: 'success',
        message: `કેસ #${selectedCaseForAssign.report_no || selectedCaseForAssign.report_id.slice(0, 8)} સફળતાપૂર્વક વેટરનરી ઓફિસર (VO) ને સોંપાયો છે!`,
      });
      setSelectedCaseForAssign(null);
      loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'કેસ સોંપવામાં નિષ્ફળતા મળી.',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForVerify) return;

    if (verifyDecision === 'REJECTED' && !rejectionReason.trim()) {
      setModalError('પુનઃતપાસ / અસ્વીકાર માટે સ્પષ્ટ કારણ દાખલ કરવું ફરજિયાત છે.');
      setNotification({ type: 'error', message: 'પુનઃતપાસ / અસ્વીકાર માટે સ્પષ્ટ કારણ દાખલ કરવું ફરજિયાત છે.' });
      return;
    }

    setModalError(null);
    setIsVerifying(true);
    try {
      await healthWorkflowService.verifyTahoTreatment(apiBaseUrl, selectedCaseForVerify.report_id, {
        action: verifyDecision,
        decision: verifyDecision,
        verification_notes: verifyDecision === 'APPROVED' ? 'સંપૂર્ણ ચકાસાયેલ અને મંજૂર' : undefined,
        rejection_reason: verifyDecision === 'REJECTED' ? rejectionReason.trim() : undefined,
        followup_instructions: followupInstructions.trim() || undefined,
      });

      setNotification({
        type: 'success',
        message:
          verifyDecision === 'APPROVED'
            ? `કેસ #${selectedCaseForVerify.report_no || selectedCaseForVerify.report_id.slice(0, 8)} સફળતાપૂર્વક ચકાસાયેલ અને બંધ (Closed) કરવામાં આવ્યો છે.`
            : `કેસ #${selectedCaseForVerify.report_no || selectedCaseForVerify.report_id.slice(0, 8)} પુનઃતપાસ માટે સ્ટાફને પાછો મોકલાયો છે.`,
      });
      setSelectedCaseForVerify(null);
      await loadData();
    } catch (err: any) {
      const errorMsg = err?.message || 'સારવાર ચકાસણી સબમિટ કરવામાં નિષ્ફળતા મળી.';
      setModalError(errorMsg);
      setNotification({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const verificationCases = cases.filter((c) => c.treatment_status === 'TREATED_PENDING_VERIFICATION');

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 0. Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
        <span>નોંધ અને સાધનો</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span>તાલુકા પશુપાલન અધિકારી (TAHO)</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-[#0F172A] font-medium">રોગ સર્વેલન્સ અને કેસ વ્યવસ્થાપન</span>
      </div>

      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              તાલુકા પશુ આરોગ્ય કેસ વ્યવસ્થાપન & રોગ સર્વેલન્સ (TAHO Portal)
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 font-bold">
              {cases.length} કેસો • {verificationCases.length} ચકાસણી બાકી
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ખેડૂત દ્વારા નોંધાયેલ કેસોનું VO/FW ને સોંપણી, સારવાર ચકાસણી (Approval/Rejection) અને અર્લી વોર્નિંગ ક્લસ્ટર
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-3 rounded-xl border">
        <button
          onClick={() => setActiveTab('CASES')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'CASES'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>કેસ વ્યવસ્થાપન & સ્ટાફ સોંપણી ({cases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('VERIFICATION')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'VERIFICATION'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>સારવાર ચકાસણી / મંજૂરી ({verificationCases.length})</span>
          {verificationCases.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('SURVEILLANCE')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'SURVEILLANCE'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>અર્લી વોર્નિંગ ક્લસ્ટર & જૂના અહેવાલો ({alerts.length})</span>
        </button>
      </div>

      {/* TAB 1: CASES MANAGEMENT & ASSIGNMENT */}
      {activeTab === 'CASES' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <select
              value={caseFilterStatus}
              onChange={(e) => setCaseFilterStatus(e.target.value)}
              className="p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#135D43] bg-white font-medium"
            >
              <option value="">તમામ સ્થિતિ (All Case Statuses)</option>
              <option value="PENDING_ASSIGNMENT">સોંપણી બાકી (Pending Assignment)</option>
              <option value="ASSIGNED">સોંપાયેલ (Assigned to Staff)</option>
              <option value="UNDER_TREATMENT">તપાસ/સારવાર હેઠળ (Under Treatment)</option>
              <option value="TREATED_PENDING_VERIFICATION">સારવાર પૂર્ણ - ચકાસણી બાકી</option>
              <option value="VERIFIED_CLOSED">ચકાસાયેલ અને બંધ (Verified & Closed)</option>
            </select>

            <select
              value={caseFilterUrgency}
              onChange={(e) => setCaseFilterUrgency(e.target.value)}
              className="p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#135D43] bg-white font-medium"
            >
              <option value="">તમામ તાત્કાલિકતા (All Urgencies)</option>
              <option value="EMERGENCY">ઇમરજન્સી (Emergency)</option>
              <option value="URGENT">જરૂરી (Urgent)</option>
              <option value="NORMAL">સામાન્ય (Normal)</option>
            </select>

            <select
              value={selectedVillageId}
              onChange={(e) => setSelectedVillageId(e.target.value)}
              className="p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#135D43] bg-white font-medium"
            >
              <option value="">તમામ ગામો (All Villages)</option>
              {allVillages.map((v: any) => (
                <option key={v.village_id} value={v.village_id}>
                  {v.name_gu || transliterateToGujarati(v.name_en)}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <Card noPadding className="overflow-hidden border border-slate-200 shadow-xs">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">કેસ ડેટા લોડ થઈ રહ્યો છે...</div>
            ) : cases.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs text-slate-500">કોઈ સક્રિય સ્વાસ્થ્ય કેસ નોંધાયેલ નથી.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">કેસ ક્રમાંક & તારીખ</th>
                      <th className="p-3">રોગ / સમસ્યા</th>
                      <th className="p-3">ખેડૂત & પશુ</th>
                      <th className="p-3">ગામ</th>
                      <th className="p-3">તાત્કાલિકતા</th>
                      <th className="p-3">સોંપાયેલ સ્ટાફ</th>
                      <th className="p-3">સ્થિતિ</th>
                      <th className="p-3 text-right">કાર્યવાહી</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cases.map((c) => {
                      const isUnassigned = c.treatment_status === 'PENDING_ASSIGNMENT' || !c.assigned_vo_name && !c.assigned_fw_name;
                      return (
                        <tr key={c.report_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded block w-fit">
                              {c.report_no || c.report_id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(c.report_date).toLocaleDateString('gu-IN')}
                            </span>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-slate-900">
                              {c.is_unknown_disease
                                ? `અજ્ઞાત સ્વાસ્થ્ય સમસ્યા ${c.custom_disease_name ? `(${c.custom_disease_name})` : ''}`
                                : c.custom_disease_name || c.disease_code}
                            </div>
                            {c.symptoms && c.symptoms.length > 0 && (
                              <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                {c.symptoms.join(', ')}
                              </p>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-slate-800">{c.farmer_name || 'અજ્ઞાત ખેડૂત'}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {c.animal_name || c.animal_code || 'પશુ'} {c.animal_tag_id ? `(ટેગ: ${c.animal_tag_id})` : ''}
                            </div>
                          </td>

                          <td className="p-3 font-semibold text-slate-800">
                            {c.village_name_gu || c.village_id}
                          </td>

                          <td className="p-3">
                            {c.urgency === 'EMERGENCY' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                                ઇમરજન્સી
                              </span>
                            ) : c.urgency === 'URGENT' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                જરૂરી
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                સામાન્ય
                              </span>
                            )}
                          </td>

                          <td className="p-3">
                            {c.assigned_vo_name ? (
                              <div className="text-[11px] font-semibold text-slate-800">
                                <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  VO: {c.assigned_vo_name}
                                </span>
                              </div>
                            ) : c.is_assignment_overdue || c.is_escalated_to_daho ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-800 font-bold bg-red-100 px-2 py-0.5 rounded border border-red-300">
                                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                ૨૪ કલાક મુદત ઓળંગી (DAHO Escalated)
                              </span>
                            ) : c.hours_remaining_for_assignment !== undefined ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                VO સોંપણી બાકી • {Math.max(0, Math.round(c.hours_remaining_for_assignment))} કલાક બાકી
                              </span>
                            ) : (
                              <span className="text-[11px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                VO સોંપણી બાકી
                              </span>
                            )}
                          </td>

                          <td className="p-3">
                            {(() => {
                              const st = c.treatment_status;
                              if (st === 'VERIFIED_COMPLETED' || st === 'VERIFIED_CLOSED') {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ચકાસાયેલ & પૂર્ણ
                                  </span>
                                );
                              }
                              if (st === 'TREATED_PENDING_VERIFICATION') {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    સારવાર પૂર્ણ – ચકાસણી બાકી
                                  </span>
                                );
                              }
                              if (st === 'ASSIGNED' || st === 'UNDER_INVESTIGATION' || st === 'UNDER_REVIEW') {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                    VO તપાસ હેઠળ
                                  </span>
                                );
                              }
                              if (st === 'REJECTED_RETURNED_TO_VO') {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    પુનઃતપાસ માટે પરત
                                  </span>
                                );
                              }
                              return (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  VO સોંપણી બાકી
                                </span>
                              );
                            })()}
                          </td>

                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant={isUnassigned ? 'primary' : 'outline'}
                              onClick={() => {
                                setSelectedCaseForAssign(c);
                                setSelectedVoId(c.assigned_vo_name ? (vos.find(v => v.full_name === c.assigned_vo_name)?.id || '') : '');
                                setSelectedFwId(c.assigned_fw_name ? (fws.find(f => f.full_name === c.assigned_fw_name)?.id || '') : '');
                              }}
                            >
                              {isUnassigned ? 'કેસ સોંપો' : 'સોંપણી બદલો'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: TREATMENT VERIFICATION */}
      {activeTab === 'VERIFICATION' && (
        <div className="space-y-3">
          <div className="bg-purple-50/70 border border-purple-200 p-3.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-purple-700" />
              <div>
                <h3 className="text-xs font-bold text-purple-900">
                  વેટરનરી સારવાર ચકાસણી ડેસ્ક (TAHO Treatment Verification)
                </h3>
                <p className="text-[11px] text-purple-700">
                  ફિલ્ડ સ્ટાફ (VO/FW) દ્વારા પૂર્ણ કરેલ ક્લિનિકલ સારવાર, દવાઓ અને ફોટાઓની ચકાસણી કરો અને કેસ બંધ કરો અથવા પુનઃતપાસ સોંપો
                </p>
              </div>
            </div>
            <span className="font-bold text-xs bg-purple-200 text-purple-900 px-2.5 py-1 rounded-lg">
              {verificationCases.length} કેસો ચકાસણી હેઠળ
            </span>
          </div>

          <Card noPadding className="overflow-hidden border border-slate-200 shadow-xs">
            {verificationCases.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs text-slate-500">હાલ કોઈ કેસ ચકાસણી માટે પેન્ડિંગ નથી. તમામ સારવાર ચકાસાયેલ છે.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">કેસ ક્રમાંક</th>
                      <th className="p-3">પશુ & ખેડૂત</th>
                      <th className="p-3">ગામ</th>
                      <th className="p-3">સારવાર કરનાર સ્ટાફ</th>
                      <th className="p-3">ક્લિનિકલ તારણો</th>
                      <th className="p-3">ફોટા</th>
                      <th className="p-3 text-right">ચકાસણી કાર્યવાહી</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {verificationCases.map((c) => (
                      <tr key={c.report_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {c.report_no || c.report_id.slice(0, 8)}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{c.animal_name || c.animal_code || 'પશુ'}</div>
                          <div className="text-[11px] text-slate-500">{c.farmer_name}</div>
                        </td>
                        <td className="p-3 font-semibold text-slate-800">
                          {c.village_name_gu || c.village_id}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{c.assigned_vo_name || 'VO'}</div>
                          {c.assigned_fw_name && <div className="text-[10px] text-slate-500">{c.assigned_fw_name}</div>}
                        </td>
                        <td className="p-3 max-w-xs">
                          <p className="line-clamp-2 text-slate-700 italic">
                            {c.observation_text || 'ક્લિનિકલ સારવાર પૂર્ણ કરાઈ.'}
                          </p>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                            <Camera className="w-3 h-3" />
                            {c.photo_urls?.length || 0}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setSelectedCaseForVerify(c);
                              setVerifyDecision('APPROVED');
                              setRejectionReason('');
                              setFollowupInstructions('');
                              setModalError(null);
                            }}
                          >
                            સમીક્ષા & ચકાસણી
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: EARLY WARNING & SURVEILLANCE */}
      {activeTab === 'SURVEILLANCE' && (
        <div className="space-y-4">
          {/* Data-Driven Disease Clusters / Suspected Outbreak Alerts */}
          {clusters.length > 0 && (
            <div className="p-4 bg-red-50/70 rounded-2xl border-2 border-red-300 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                </span>
                <span>સંભવિત રોગ ક્લસ્ટર / શંકાસ્પદ આઉટબ્રેક એલર્ટ (Potential Disease Cluster Alert)</span>
              </div>
              <p className="text-xs text-red-700">
                છેલ્લા ૧૪ દિવસમાં નજીકના ગામોમાં ૨ કે તેથી વધુ કેસો નોંધાતા સિસ્ટમ દ્વારા ચેતવણી જારી કરાયેલ છે.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {clusters.map((cl, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-red-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm font-heading">{cl.disease_name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                          {cl.disease_code}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">
                        {cl.case_count} કેસો
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <strong>અસરગ્રસ્ત ગામો:</strong> {cl.village_names?.join(', ') || 'ગામો'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between border-t border-slate-100 pt-1.5">
                      <span>તારીખ ગાળો: {cl.first_report_date} થી {cl.latest_report_date}</span>
                      <span className="text-red-700 font-bold">વિસ્તાર ત્રિજ્યા: {cl.radius_km} km</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Early Warning Alerts */}
          {alerts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts.map((alt) => {
                const isCrit = alt.severity === 'CRITICAL';
                return (
                  <div
                    key={alt.alert_id}
                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-2 ${
                      isCrit ? 'bg-red-50/80 border-red-300 text-red-950' : 'bg-amber-50/80 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm font-heading">{alt.disease_name_gu}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-bold">
                            {alt.disease_code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5">
                          ગામ: <strong>{alt.village_name_gu || transliterateToGujarati(alt.village_name_en)}</strong> • {alt.report_count} શંકાસ્પદ કેસો
                        </p>
                      </div>

                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isCrit ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {alt.severity}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-800 bg-white/70 p-2 rounded border border-current/20">
                      <strong>ભલામણ કરેલ પગલાં:</strong> {alt.recommended_action}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Surveillance Table */}
          <Card noPadding className="overflow-hidden border border-slate-200 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="p-3">રિપોર્ટ ક્રમાંક & રોગ</th>
                    <th className="p-3">પશુ & ખેડૂત</th>
                    <th className="p-3">ગામ</th>
                    <th className="p-3">તારીખ</th>
                    <th className="p-3">લક્ષણો & નિરીક્ષણ</th>
                    <th className="p-3">સ્થિતિ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((dr: any) => (
                    <tr key={dr.report_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{dr.disease_code}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{dr.report_no}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-800 text-[11px]">{dr.animal_code}</div>
                        <div className="text-slate-600 text-[11px]">{dr.farmer_name}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {dr.village_name_gu || transliterateToGujarati(dr.village_name_en)}
                      </td>
                      <td className="p-3 font-mono text-slate-700">{dr.report_date || '-'}</td>
                      <td className="p-3 max-w-xs">{dr.observation_text || '-'}</td>
                      <td className="p-3">
                        <StatusChip
                          status={dr.status === 'CONFIRMED' ? 'ACTIVE' : 'PENDING'}
                          label={dr.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: ASSIGN CASE */}
      {selectedCaseForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-body animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-200 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    કેસ સોંપણી (Assign Health Case #{selectedCaseForAssign.report_no || selectedCaseForAssign.report_id.slice(0, 8)})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    અધિકૃત વેટરનરી ઓફિસર (VO) ને ક્લિનિકલ તપાસ અને સારવાર માટે સોંપો
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCaseForAssign(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Case Overview Preview */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">રોગ / સમસ્યા:</span>
                <span className="font-bold text-slate-800">
                  {selectedCaseForAssign.is_unknown_disease
                    ? `અજ્ઞાત સમસ્યા (${selectedCaseForAssign.custom_disease_name || ''})`
                    : selectedCaseForAssign.custom_disease_name || selectedCaseForAssign.disease_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">પશુ અને ખેડૂત:</span>
                <span className="font-semibold text-slate-800">
                  {selectedCaseForAssign.animal_name || 'પશુ'} • {selectedCaseForAssign.farmer_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ગામ:</span>
                <span className="font-semibold text-slate-800">{selectedCaseForAssign.village_name_gu}</span>
              </div>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-3.5 text-xs">
              {/* Authorized VO Selector (VO Only) */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  અધિકૃત વેટરનરી અધિકારી પસંદ કરો (Select Authorized Veterinary Officer) *
                </label>
                <select
                  value={selectedVoId}
                  onChange={(e) => setSelectedVoId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                >
                  <option value="">-- વેટરનરી અધિકારી (VO) પસંદ કરો --</option>
                  {vos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name} ({v.designation || 'VO'}) {v.mobile_e164 ? `• ${v.mobile_e164}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  * રોગ સર્વેલન્સ અને સારવાર કેસ નિયમ મુજબ માત્ર અધિકૃત વેટરનરી અધિકારી (VO) ને જ સોંપવામાં આવે છે.
                </p>
              </div>

              {/* Priority & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    પ્રાથમિકતા (Priority) *
                  </label>
                  <select
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  >
                    <option value="NORMAL">સામાન્ય (Normal)</option>
                    <option value="URGENT">જરૂરી (Urgent)</option>
                    <option value="EMERGENCY">ઇમરજન્સી (Emergency)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    આયોજિત મુલાકાત તારીખ (Planned Visit)
                  </label>
                  <input
                    type="date"
                    value={plannedVisitDate}
                    onChange={(e) => setPlannedVisitDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  વિશેષ સૂચનાઓ / માર્ગદર્શન (Field Instructions)
                </label>
                <textarea
                  rows={3}
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  placeholder="દા.ત. સેમ્પલ કલેક્શન કરો, અલગ રાખો, તાત્કાલિક એન્ટિબાયોટિક સારવાર આપો..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" type="button" onClick={() => setSelectedCaseForAssign(null)}>
                  રદ કરો
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isAssigning}>
                  સોંપણી મંજૂર કરો (Confirm Assignment)
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VERIFY TREATMENT */}
      {selectedCaseForVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-body animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    સારવાર સમીક્ષા & ચકાસણી (Verify Treatment #{selectedCaseForVerify.report_no || selectedCaseForVerify.report_id.slice(0, 8)})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    વેટરનરી સ્ટાફ દ્વારા નોંધાયેલ ક્લિનિકલ તારણો અને સારવારની TAHO સ્તરે અંતિમ ચકાસણી
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCaseForVerify(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clinical Treatment Data Preview */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">પશુ અને ખેડૂત</span>
                  <span className="font-bold text-slate-900">
                    {selectedCaseForVerify.animal_name || 'પશુ'} • {selectedCaseForVerify.farmer_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ગામ</span>
                  <span className="font-bold text-slate-900">{selectedCaseForVerify.village_name_gu}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">મૂળ ફરિયાદ / લક્ષણો:</span>
                <span className="font-medium text-slate-800">
                  {selectedCaseForVerify.symptoms?.join(', ') || 'લક્ષણો નોંધાયેલ નથી'}
                </span>
              </div>

              {/* Detailed VO Clinical Report */}
              {selectedCaseForVerify.treatment_record ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-[#135D43] text-xs flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <Activity className="w-3.5 h-3.5 text-[#135D43]" />
                    <span>વેટરનરી અધિકારી (VO) ક્લિનિકલ સારવાર અહેવાલ</span>
                  </div>

                  {selectedCaseForVerify.treatment_record.diagnosis && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">ક્લિનિકલ નિદાન (Clinical Diagnosis):</span>
                      <span className="font-bold text-slate-900">{selectedCaseForVerify.treatment_record.diagnosis}</span>
                    </div>
                  )}

                  {selectedCaseForVerify.treatment_record.observations && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">શારીરિક તપાસ તારણો (Observations):</span>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded text-xs">{selectedCaseForVerify.treatment_record.observations}</p>
                    </div>
                  )}

                  {selectedCaseForVerify.treatment_record.treatment_text && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">આપેલ સારવાર પદ્ધતિ (Treatment Procedure):</span>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded text-xs">{selectedCaseForVerify.treatment_record.treatment_text}</p>
                    </div>
                  )}

                  {selectedCaseForVerify.treatment_record.medicine_administered && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">આપેલ દવાઓ અને ડોઝ (Medicines Administered):</span>
                      <span className="font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                        {selectedCaseForVerify.treatment_record.medicine_administered}
                        {selectedCaseForVerify.treatment_record.dosage_details ? ` • ${selectedCaseForVerify.treatment_record.dosage_details}` : ''}
                      </span>
                    </div>
                  )}

                  {selectedCaseForVerify.treatment_record.treatment_notes && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">અતિરિક્ત નોંધ:</span>
                      <p className="text-slate-600 italic text-[11px]">{selectedCaseForVerify.treatment_record.treatment_notes}</p>
                    </div>
                  )}

                  {selectedCaseForVerify.treatment_record.follow_up_instructions && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">ખેડૂત માટે ફોલો-અપ સૂચનાઓ:</span>
                      <p className="text-amber-800 bg-amber-50 p-2 rounded text-[11px] border border-amber-200">{selectedCaseForVerify.treatment_record.follow_up_instructions}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <span className="text-slate-500 block text-[10px]">વેટરનરી તપાસ & સારવાર નોંધ:</span>
                  <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                    {selectedCaseForVerify.observation_text || 'ક્લિનિકલ તપાસ સફળતાપૂર્વક પૂર્ણ.'}
                  </p>
                </div>
              )}

              {/* Photos from Report or Treatment Evidence */}
              {(() => {
                const photos = [
                  ...(selectedCaseForVerify.treatment_record?.evidence_photos || []),
                  ...(selectedCaseForVerify.photo_urls || [])
                ];
                const uniquePhotos = Array.from(new Set(photos));
                if (uniquePhotos.length === 0) return null;

                return (
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1 font-bold">
                      ક્લિનિકલ સારવાર ફોટો પુરાવા (Treatment Evidence Photos - {uniquePhotos.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {uniquePhotos.map((p, idx) => {
                        const photoSrc = p.startsWith('http') || p.startsWith('data:') ? p : `${apiBaseUrl}${p.startsWith('/') ? '' : '/'}${p}`;
                        return (
                          <a key={idx} href={photoSrc} target="_blank" rel="noreferrer" className="block group">
                            <img
                              src={photoSrc}
                              alt={`Evidence photo ${idx + 1}`}
                              className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-400 shadow-sm group-hover:scale-105 transition-transform"
                            />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ચકાસણી નિર્ણય (TAHO Decision) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyDecision('APPROVED')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      verifyDecision === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ચકાસો અને કેસ બંધ કરો (Approve & Close)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifyDecision('REJECTED')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      verifyDecision === 'REJECTED'
                        ? 'bg-red-50 text-red-800 border-red-500 ring-2 ring-red-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>પુનઃતપાસ / અસ્વીકાર (Send for Re-visit)</span>
                  </button>
                </div>
              </div>

              {verifyDecision === 'REJECTED' && (
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-2 animate-fade-in">
                  <div>
                    <label className="block font-bold text-red-900 mb-1">
                      અસ્વીકાર / પુનઃતપાસનું સ્પષ્ટ કારણ (Mandatory Reason) *
                    </label>
                    <input
                      type="text"
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="દા.ત. દવાઓની માત્રા અધૂરી છે, બીજો ડોઝ જરૂરી છે, લક્ષણો હજુ ચાલુ છે..."
                      className="w-full px-3 py-2 rounded-xl border border-red-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-red-900 mb-1">
                      ફિલ્ડ સ્ટાફ માટે ફોલો-અપ સૂચનાઓ (Follow-up Instructions)
                    </label>
                    <textarea
                      rows={2}
                      value={followupInstructions}
                      onChange={(e) => setFollowupInstructions(e.target.value)}
                      placeholder="ફરી મુલાકાત લઈ લોહીનું સેમ્પલ લો અને તાપમાન માપો..."
                      className="w-full px-3 py-2 rounded-xl border border-red-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              )}

              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" type="button" onClick={() => setSelectedCaseForVerify(null)}>
                  રદ કરો
                </Button>
                <Button
                  variant={verifyDecision === 'APPROVED' ? 'primary' : 'danger'}
                  size="sm"
                  type="submit"
                  onClick={(e) => handleVerifySubmit(e)}
                  isLoading={isVerifying}
                >
                  {verifyDecision === 'APPROVED' ? 'ચકાસણી મંજૂર કરો' : 'પુનઃતપાસ સોંપો'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
