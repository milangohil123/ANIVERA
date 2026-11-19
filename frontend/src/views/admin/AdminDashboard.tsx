import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  technicalService,
  type TechnicalOverview,
  type SystemHealthResponse,
} from '../../services/technicalService';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import {
  ArrowRight,
  Database,
  FileText,
  Smartphone,
  Users,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Cpu,
  History,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [overview, setOverview] = useState<TechnicalOverview | null>(null);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [ov, hl] = await Promise.all([
        technicalService.getOverview(apiBaseUrl),
        technicalService.getHealth(apiBaseUrl),
      ]);
      setOverview(ov);
      setHealth(hl);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  return (
    <div className="w-full space-y-4 pb-12 font-body text-[#172033] animate-fade-in">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER (Exact Match Reference Image 2)        */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>Operations</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>System Administration</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">Core Security & Telemetry</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              ટેકનિકલ સિસ્ટમ એડમિનિસ્ટ્રેશન (SYS_ADMIN)
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>{health?.status || 'HEALTHY'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />
              <span>તાજું કરો (Refresh)</span>
            </button>

            <button
              onClick={() => navigate('/admin/audit-logs')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#E8EEFC] text-xs font-semibold text-[#135D43] hover:bg-[#D8E4FA] shadow-xs transition-colors"
            >
              <History className="w-3.5 h-3.5 text-[#135D43]" />
              <span>સુરક્ષા ઓડિટ લોગ</span>
            </button>

            <button
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <span>+ વપરાશકર્તા સંચાલન</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. SANDBOX / SCOPE NOTICE BANNER (Reference Image 2 Style)               */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                ટેકનિકલ સુરક્ષા નીતિ (Technical Scope Only)
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                SYS_ADMIN
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              SYS_ADMIN ફક્ત વપરાશકર્તા એકાઉન્ટ સ્થિતિ, ક્ષેત્રીય ઉપકરણ પ્રમાણીકરણ, સિસ્ટમ હેલ્થ અને અફર ઓડિટ લોગ માટે જ અધિકૃત છે.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/admin/system-health')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>સિસ્ટમ ડાયગ્નોસ્ટિક્સ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {isLoading ? (
        <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
      ) : errorMsg ? (
        <StateView state="error" message={errorMsg} onRetry={loadData} />
      ) : (
        <>
          {/* ------------------------------------------------------------------ */}
          {/* 3. 5 KPI CARDS IN ONE ROW (Exact Match Reference Image 2)           */}
          {/* ------------------------------------------------------------------ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="કુલ એકાઉન્ટ્સ"
              value={overview?.total_users || 0}
              subtext={`${overview?.active_users || 0} સક્રિય વપરાશકર્તાઓ`}
              icon={<Users className="w-4 h-4 text-[#176B5B]" />}
              iconVariant="emerald"
              onClick={() => navigate('/admin/users')}
            />

            <KpiCard
              label="નોંધાયેલ ઉપકરણો"
              value={overview?.total_devices || 0}
              valueColor="text-[#0284C7]"
              subtext={`${overview?.active_devices || 0} સક્રિય ક્ષેત્રીય ડિવાઇસ`}
              icon={<Smartphone className="w-4 h-4 text-[#0284C7]" />}
              iconVariant="blue"
              onClick={() => navigate('/admin/devices')}
            />

            <KpiCard
              label="ઓડિટ ઇવેન્ટ્સ"
              value={overview?.total_audit_events || 0}
              subtext="અફર સુરક્ષા લોગ્સ"
              icon={<History className="w-4 h-4 text-amber-700" />}
              iconVariant="amber"
              onClick={() => navigate('/admin/audit-logs')}
            />

            <KpiCard
              label="ડેટાબેઝ સ્થિતિ"
              value={health?.database?.connected !== false ? 'ONLINE' : 'DEGRADED'}
              valueColor="text-[#135D43]"
              subtext="PostgreSQL 16 સક્રિય • <20ms"
              subtextIcon={<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
              icon={<Database className="w-4 h-4 text-[#135D43]" />}
              iconVariant="emerald"
              onClick={() => navigate('/admin/system-health')}
            />
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 4. TECHNICAL MODULES CARDS (White Cards, Border, Soft Shadows)      */}
          {/* ------------------------------------------------------------------ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div
              onClick={() => navigate('/admin/users')}
              className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs cursor-pointer hover:border-[#135D43]/50 hover:shadow-sm transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#135D43] border border-emerald-100 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-heading">વપરાશકર્તા યાદી અને સ્થિતિ</h4>
                  <p className="text-xs text-[#64748B]">સિસ્ટમ સ્ટાફ અને ખેડૂત એકાઉન્ટ સ્થિતિ</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#135D43] transition-colors" />
            </div>

            <div
              onClick={() => navigate('/admin/devices')}
              className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs cursor-pointer hover:border-[#0284C7]/50 hover:shadow-sm transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0284C7] border border-sky-100 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-heading">ક્ષેત્રીય ઉપકરણો (Devices)</h4>
                  <p className="text-xs text-[#64748B]">ઓફલાઇન સિન્ક અને ઉપકરણ રજીસ્ટ્રેશન</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0284C7] transition-colors" />
            </div>

            <div
              onClick={() => navigate('/admin/audit-logs')}
              className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-heading">સુરક્ષા ઓડિટ લોગ</h4>
                  <p className="text-xs text-[#64748B]">લોગિન, પરવાનગી ચકાસણી અને સિસ્ટમ એક્શન્સ</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-700 transition-colors" />
            </div>

            <div
              onClick={() => navigate('/admin/system-health')}
              className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-heading">સિસ્ટમ હેલ્થ નિદાન</h4>
                  <p className="text-xs text-[#64748B]">API અને ડેટાબેઝ જોડાણ વિશ્લેષણ</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition-colors" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
