import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { healthWorkflowService, type CooperativeScheduleSummary } from '../../services/healthWorkflowService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  Syringe,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  CheckCircle2,
  Clock,
  PawPrint,
  ChevronLeft,
  ChevronRight,
  Building2,
  ShieldCheck,
  AlertTriangle,
  X,
  FileCheck,
  Bell,
  Users,
} from 'lucide-react';

export const TahoVaccinationsView: React.FC = () => {
  const { apiBaseUrl } = useAuth();

  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'COOP_SCHEDULES'>('COOP_SCHEDULES');

  // Telemetry state
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, total_pages: 1 });
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Coop Recurring Schedules state
  const [coopSchedules, setCoopSchedules] = useState<CooperativeScheduleSummary[]>([]);
  const [selectedScheduleForReview, setSelectedScheduleForReview] = useState<CooperativeScheduleSummary | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'NEEDS_REVISION'>('APPROVED');
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [approvedStartDate, setApprovedStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isDeciding, setIsDeciding] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async (page = 1) => {
    setIsLoading(true);
    setNotification(null);
    try {
      const [vaxRes, hier, scheds] = await Promise.all([
        adminService.listTahoVaccinations(apiBaseUrl, {
          village_id: selectedVillageId || undefined,
          page,
          page_size: 15,
        }).catch(() => ({ items: [], total: 0, page: 1, total_pages: 1 })),
        adminService.getTahoHierarchy(apiBaseUrl).catch(() => null),
        healthWorkflowService.listTahoSchedules(apiBaseUrl).catch(() => []),
      ]);
      setData(vaxRes);
      setCurrentPage(page);
      setHierarchy(hier);
      setCoopSchedules(scheds);
    } catch (err: any) {
      console.warn('Vaccinations load note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [apiBaseUrl, selectedVillageId]);

  const allVillages = hierarchy?.villages || [];
  const pendingApprovalCount = coopSchedules.filter((s) => s.status === 'SUBMITTED').length;

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleForReview) return;

    const schedId = selectedScheduleForReview.id || selectedScheduleForReview.schedule_id || '';
    setIsDeciding(true);
    try {
      await healthWorkflowService.decideTahoSchedule(apiBaseUrl, schedId, {
        decision,
        review_notes: decisionNotes.trim() || undefined,
        approved_start_date: decision === 'APPROVED' ? approvedStartDate : undefined,
      });

      setNotification({
        type: 'success',
        message:
          decision === 'APPROVED'
            ? `ડેરી સહકારી રિકરિંગ શેડ્યૂલ "${selectedScheduleForReview.schedule_name}" સફળતાપૂર્વક મંજૂર અને સક્રિય કરવામાં આવ્યો છે! પશુઓ માટે ૧૫ દિવસ પહેલા ઓટોમેટિક રીમાઇન્ડર સાયકલ સેટ થઈ ગઈ છે.`
            : `શેડ્યૂલ "${selectedScheduleForReview.schedule_name}" પર નિર્ણય નોંધાયો છે.`,
      });
      setSelectedScheduleForReview(null);
      loadData(currentPage);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'શેડ્યૂલ મંજૂરી પ્રક્રિયામાં ક્ષતિ આવી.',
      });
    } finally {
      setIsDeciding(false);
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
        <span className="text-[#0F172A] font-medium">રસીકરણ વ્યવસ્થાપન અને સહકારી શેડ્યૂલ્સ</span>
      </div>

      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Syringe className="w-5 h-5 text-emerald-700" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              તાલુકા રસીકરણ વ્યવસ્થાપન & સહકારી શેડ્યૂલ મંજૂરી (TAHO)
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {data.total || 0} પૂર્ણ રેકોર્ડ્સ • {coopSchedules.length} સહકારી શેડ્યૂલ્સ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ડેરી સહકારી મંડળીઓના રિકરિંગ રસીકરણ સમયપત્રકની સમીક્ષા/મંજૂરી અને રીઅલ-ટાઇમ રસીકરણ ટેલિમેટ્રી
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(currentPage)} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-3 rounded-xl border">
        <button
          onClick={() => setActiveTab('COOP_SCHEDULES')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'COOP_SCHEDULES'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>ડેરી સહકારી રિકરિંગ શેડ્યૂલ મંજૂરી ({coopSchedules.length})</span>
          {pendingApprovalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              {pendingApprovalCount} મંજૂરી બાકી
            </span>
          )}
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
          <span>રસીકરણ હિસ્ટ્રી & ટેલિમેટ્રી ({data.total || 0})</span>
        </button>
      </div>

      {/* TAB 1: COOP RECURRING SCHEDULES APPROVAL */}
      {activeTab === 'COOP_SCHEDULES' && (
        <div className="space-y-3">
          <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-xs font-bold text-emerald-950">
                  ડેરી સહકારી મંડળી રિકરિંગ રસીકરણ મંજૂરી ડેસ્ક
                </h3>
                <p className="text-[11px] text-emerald-800">
                  મંડળી દ્વારા પ્રસ્તાવિત રસીકરણ સાયકલ (FMD, HS, BQ વગેરે) ની TAHO મંજૂરી આપો. મંજૂરી મળતાં જ પશુના વ્યક્તિગત રસીકરણ ઇતિહાસ આધારે ૧૫ દિવસ અગાઉના ઓટોમેટિક રીમાઇન્ડર શરૂ થશે.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
              {coopSchedules.length} કુલ શેડ્યૂલ
            </span>
          </div>

          <Card noPadding className="overflow-hidden border border-slate-200 shadow-xs">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">શેડ્યૂલ લોડ થઈ રહ્યા છે...</div>
            ) : coopSchedules.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs text-slate-500">હજુ સુધી કોઈ ડેરી સહકારી મંડળીએ રિકરિંગ શેડ્યૂલ સબમિટ કર્યું નથી.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">શેડ્યૂલ નામ & મંડળી</th>
                      <th className="p-3">રસી & હેતુ</th>
                      <th className="p-3">રિકરિંગ આવર્તન</th>
                      <th className="p-3">નોંધાયેલ પશુધન</th>
                      <th className="p-3">સ્થિતિ</th>
                      <th className="p-3">સબમિશન તારીખ</th>
                      <th className="p-3 text-right">કાર્યવાહી</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {coopSchedules.map((s) => {
                      const isPending = s.status === 'SUBMITTED';
                      const sId = s.id || s.schedule_id || '';
                      return (
                        <tr key={sId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{s.schedule_name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{s.cooperative_name || 'સહકારી મંડળી'}</span>
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-emerald-800">{s.vaccine_name}</div>
                            <div className="text-[10px] text-slate-500">{s.disease_prevention_purpose || s.vaccine_code}</div>
                          </td>

                          <td className="p-3 font-semibold text-slate-700">
                            {s.recurrence_interval_months
                              ? `${s.recurrence_interval_months} મહિના (દર ${s.recurrence_interval_months === 6 ? 'અર્ધવાર્ષિક' : s.recurrence_interval_months === 12 ? 'વાર્ષિક' : `${s.recurrence_interval_months} માસે`})`
                              : `${s.custom_recurrence_value} ${s.custom_recurrence_unit}`}
                          </td>

                          <td className="p-3">
                            <span className="font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                              {s.enrolled_animals_count} પશુઓ
                            </span>
                          </td>

                          <td className="p-3">
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
                                ? 'મંજૂર & સક્રિય'
                                : s.status === 'SUBMITTED'
                                ? 'મંજૂરી માટે બાકી'
                                : s.status === 'REJECTED'
                                ? 'નકારાયેલ'
                                : s.status}
                            </span>
                          </td>

                          <td className="p-3 text-slate-600 font-mono text-[11px]">
                            {new Date(s.created_at).toLocaleDateString('gu-IN')}
                          </td>

                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant={isPending ? 'primary' : 'outline'}
                              onClick={() => {
                                setSelectedScheduleForReview(s);
                                setDecision(isPending ? 'APPROVED' : 'APPROVED');
                                setDecisionNotes(s.review_notes || '');
                              }}
                            >
                              {isPending ? 'સમીક્ષા & નિર્ણય' : 'વિગતો જુઓ'}
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

      {/* TAB 2: TELEMETRY (EXISTING) */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">ગામ પસંદ કરો:</label>
              <select
                value={selectedVillageId}
                onChange={(e) => setSelectedVillageId(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
              >
                <option value="">તમામ ગામો (All Villages)</option>
                {allVillages.map((v: any) => (
                  <option key={v.village_id} value={v.village_id}>
                    {v.name_gu || transliterateToGujarati(v.name_en)} ({v.name_en})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              પેજ {data.page || 1} / {data.total_pages || 1} • કુલ: {data.total || 0}
            </div>
          </div>

          <Card noPadding className="overflow-hidden border border-slate-200 shadow-xs">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">રસીકરણ ડેટા લોડ થઈ રહ્યો છે...</div>
            ) : data.items.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Syringe className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">પસંદ કરેલ માપદંડ માટે કોઈ રસીકરણ રેકોર્ડ મળ્યો નથી.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">પશુ ટેગ આઈડી</th>
                      <th className="p-3">પ્રજાતિ</th>
                      <th className="p-3">પશુપાલક / ખેડૂત</th>
                      <th className="p-3">ગામ</th>
                      <th className="p-3">રસીકરણ કર્મી</th>
                      <th className="p-3">તારીખ</th>
                      <th className="p-3">ચકાસણી સ્થિતિ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((ev: any) => (
                      <tr key={ev.event_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {ev.animal_code}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700 capitalize">{ev.species_code}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{ev.farmer_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{ev.farmer_mobile}</div>
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {ev.village_name_gu || transliterateToGujarati(ev.village_name_en)}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-slate-800">{ev.performed_by_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {ev.performed_by_role === 'VET_OFFICER' ? 'VO' : 'Field Worker'}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-700">{ev.event_date || '-'}</td>
                        <td className="p-3">
                          <StatusChip
                            status={ev.review_status === 'VERIFIED' ? 'ACTIVE' : 'PENDING'}
                            label={ev.review_status === 'VERIFIED' ? 'પ્રમાણિત' : 'પ્રક્રિયામાં'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.total_pages > 1 && (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => loadData(currentPage - 1)}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  પાછલું
                </Button>
                <span className="text-slate-600 font-medium font-mono">
                  પેજ {currentPage} / {data.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= data.total_pages}
                  onClick={() => loadData(currentPage + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  આગલું
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL: DECIDE COOP SCHEDULE */}
      {selectedScheduleForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-body animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    સહકારી રિકરિંગ શેડ્યૂલ મંજૂરી (TAHO Approval)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedScheduleForReview.schedule_name} • {selectedScheduleForReview.cooperative_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedScheduleForReview(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Schedule Details Preview */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px]">રસી & રોગ નિવારણ:</span>
                  <span className="font-bold text-emerald-800">
                    {selectedScheduleForReview.vaccine_name} ({selectedScheduleForReview.disease_prevention_purpose})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">આવર્તન ગાળો (Interval):</span>
                  <span className="font-bold text-slate-800">
                    {selectedScheduleForReview.recurrence_interval_months
                      ? `દર ${selectedScheduleForReview.recurrence_interval_months} મહિને (${selectedScheduleForReview.recurrence_interval_months === 6 ? 'અર્ધવાર્ષિક' : 'વાર્ષિક'})`
                      : `${selectedScheduleForReview.custom_recurrence_value} ${selectedScheduleForReview.custom_recurrence_unit}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">નોંધાયેલ સભાસદ પશુઓ:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {selectedScheduleForReview.enrolled_animals_count} પશુધન
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">૧૫-દિવસ રીમાઇન્ડર એન્જિન:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5" /> ઓટોમેટિક સક્રિય થશે
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleDecisionSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  TAHO નિર્ણય (Decision) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('APPROVED')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                      decision === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    મંજૂર કરો (Approve)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('NEEDS_REVISION')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                      decision === 'NEEDS_REVISION'
                        ? 'bg-amber-50 text-amber-800 border-amber-500 ring-2 ring-amber-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ફેરફાર સૂચવો (Revision)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('REJECTED')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                      decision === 'REJECTED'
                        ? 'bg-red-50 text-red-800 border-red-500 ring-2 ring-red-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    નકારો (Reject)
                  </button>
                </div>
              </div>

              {decision === 'APPROVED' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    મંજૂર અમલવારી શરૂ તારીખ (Approved Start Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={approvedStartDate}
                    onChange={(e) => setApprovedStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  સમીક્ષા નોંધ / મંડળી માટે સૂચનાઓ (Review Notes)
                </label>
                <textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="મંડળી સ્ટાફ અને વેટરનરી ટીમ માટે માર્ગદર્શન લખો..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" type="button" onClick={() => setSelectedScheduleForReview(null)}>
                  રદ કરો
                </Button>
                <Button
                  variant={decision === 'APPROVED' ? 'primary' : decision === 'REJECTED' ? 'danger' : 'outline'}
                  size="sm"
                  type="submit"
                  isLoading={isDeciding}
                >
                  નિર્ણય સબમિટ કરો (Submit Decision)
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
