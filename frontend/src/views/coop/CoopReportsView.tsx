import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from '../../components/common/KpiCard';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { coopService } from '../../services/coopService';
import {
  BarChart3,
  Download,
  Printer,
  FileSpreadsheet,
  Users,
  PawPrint,
  Syringe,
  MapPin,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export const CoopReportsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [activeReportTab, setActiveReportTab] = useState<'farmers' | 'animals' | 'vaccinations' | 'coverage'>('farmers');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadReport = async (reportType: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await coopService.getReports(apiBaseUrl, reportType);
      setReportData(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'રિપોર્ટ ડેટા લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport(activeReportTab);
  }, [activeReportTab, apiBaseUrl]);

  // Export CSV
  const handleExportCsv = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      alert('નિકાસ માટે કોઈ ડેટા ઉપલબ્ધ નથી.');
      return;
    }

    const rows = reportData.rows;
    const keys = Object.keys(rows[0]);
    const headerRow = keys.join(',');
    const dataRows = rows.map((r: any) =>
      keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );

    const csvString = '\uFEFF' + [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeReportTab}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const handleExportJson = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeReportTab}_report_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-4 animate-fade-in pb-12 font-body text-[#172033]">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER                                       */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5 print:hidden">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>કામગીરી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>ડેરી સહકારી મંડળી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">
            રિપોર્ટ્સ અને નિકાસ (Reports & Analytics)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              સહકારી મંડળી રિપોર્ટ્સ અને ડેટા નિકાસ
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>સત્તાવાર ઓડિટ રિપોર્ટ્સ સક્રિય</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadReport(activeReportTab)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />
              <span>તાજું કરો</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>CSV ડાઉનલોડ</span>
            </button>

            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              <span>JSON નિકાસ</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>પ્રિન્ટ રિપોર્ટ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. GOVERNANCE BANNER                                                   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                સત્તાવાર ઓડિટ અને ડેટા નિકાસ અધિકારક્ષેત્ર
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                ઓડિટ પ્રમાણીકરણ
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              મંડળી સભાસદો, પશુધન રજીસ્ટર, રસીકરણ હિસાબ અને ગામવાર કવરેજનો સત્તાવાર ઓડિટ રિપોર્ટ. ડેટા તાજો રાખવા નિયમિત નિકાસ કરો.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/overview')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>મુખ્ય ડેશબોર્ડ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 print:hidden">
        <KpiCard
          label="કુલ સભાસદ ખેડૂતો"
          value={isLoading ? '...' : String(reportData?.kpis?.total_member_farmers ?? 0)}
          subtext="નોંધાયેલ સભ્યો"
          icon={<Users className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          onClick={() => setActiveReportTab('farmers')}
        />

        <KpiCard
          label="કુલ સંલગ્ન પશુધન"
          value={isLoading ? '...' : String(reportData?.kpis?.total_animals ?? 0)}
          valueColor="text-[#176B5B]"
          subtext="નોંધાયેલ પશુધન"
          icon={<PawPrint className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          onClick={() => setActiveReportTab('animals')}
        />

        <KpiCard
          label="સંપૂર્ણ રસીકૃત પશુઓ"
          value={isLoading ? '...' : String(reportData?.kpis?.fully_vaccinated_animals ?? 0)}
          valueColor="text-[#176B5B]"
          subtext="સુરક્ષિત પશુધન"
          icon={<Syringe className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          onClick={() => setActiveReportTab('vaccinations')}
        />

        <KpiCard
          label="એકંદર કવરેજ દર"
          value={isLoading ? '...' : `${reportData?.kpis?.overall_coverage_pct ?? 0}%`}
          valueColor="text-[#135D43]"
          subtext="સિદ્ધિ ટકાવારી"
          icon={<TrendingUp className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          badgeText="પ્રમાણિત"
          badgeVariant="emerald"
          onClick={() => setActiveReportTab('coverage')}
        />

        <KpiCard
          label="નિકાસ ફોર્મેટ્સ"
          value="3 ફોર્મેટ"
          valueColor="text-amber-700"
          subtext="CSV, JSON અને પ્રિન્ટ"
          icon={<FileSpreadsheet className="w-4 h-4 text-amber-600" />}
          iconVariant="amber"
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. REPORT NAVIGATION TABS & REPORT CONTAINER                           */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Section Header with Tabs */}
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC] print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 text-[#176B5B] flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base font-heading">
                વિગતવાર ઓડિટ રિપોર્ટ્સ
              </h3>
              <p className="text-xs text-slate-500">
                નીચેનામાંથી રિપોર્ટ પ્રકાર પસંદ કરી તરત જુઓ અથવા નિકાસ કરો
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveReportTab('farmers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeReportTab === 'farmers'
                  ? 'bg-[#135D43] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              સભાસદ ખેડૂત યાદી
            </button>

            <button
              onClick={() => setActiveReportTab('animals')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeReportTab === 'animals'
                  ? 'bg-[#135D43] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <PawPrint className="w-3.5 h-3.5" />
              સંલગ્ન પશુધન
            </button>

            <button
              onClick={() => setActiveReportTab('vaccinations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeReportTab === 'vaccinations'
                  ? 'bg-[#135D43] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Syringe className="w-3.5 h-3.5" />
              રસીકરણ યાદી
            </button>

            <button
              onClick={() => setActiveReportTab('coverage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeReportTab === 'coverage'
                  ? 'bg-[#135D43] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              ગામ કવરેજ સારાંશ
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Print Letterhead Header */}
          <div className="border-b-2 border-[#135D43] pb-3 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-[#135D43] font-heading">
                {reportData?.title || 'ડેરી સહકારી મંડળી સત્તાવાર રિપોર્ટ'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                મંડળી: <strong className="text-slate-800">{reportData?.cooperative || 'સહકારી મંડળી'}</strong> • તારીખ: {new Date().toLocaleDateString('gu-IN')}
              </p>
            </div>
            <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-semibold border border-slate-200 print:hidden">
              સત્તાવાર ઓડિટ રિપોર્ટ
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {errorMsg}
            </div>
          )}

          {isLoading ? (
            <StateView state="loading" message="રિપોર્ટ તૈયાર થઈ રહ્યો છે..." />
          ) : activeReportTab === 'coverage' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">કુલ સભાસદો</span>
                  <strong className="text-lg text-slate-900 font-heading">{reportData?.kpis?.total_member_farmers || 0}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">કુલ પશુધન</span>
                  <strong className="text-lg text-slate-900 font-heading">{reportData?.kpis?.total_animals || 0}</strong>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 block text-[10px]">રસીકૃત પશુઓ</span>
                  <strong className="text-lg text-emerald-800 font-heading">{reportData?.kpis?.fully_vaccinated_animals || 0}</strong>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-blue-700 block text-[10px]">એકંદર કવરેજ</span>
                  <strong className="text-lg text-blue-800 font-heading">{reportData?.kpis?.overall_coverage_pct || 0}%</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] font-semibold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3">ગામનું નામ</th>
                      <th className="p-3">સભાસદ ખેડૂતો</th>
                      <th className="p-3">કુલ પશુધન</th>
                      <th className="p-3">રસીકરણ કવરેજ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData?.charts?.village_coverage?.map((vc: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{vc.village}</td>
                        <td className="p-3 font-semibold text-blue-700">{reportData?.charts?.village_farmers?.[i]?.farmers || 0}</td>
                        <td className="p-3 font-semibold text-slate-800">{reportData?.charts?.village_livestock?.[i]?.animals || 0}</td>
                        <td className="p-3 font-bold text-emerald-700">{vc.coverage_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : reportData?.rows && reportData.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    {Object.keys(reportData.rows[0]).map((k) => (
                      <th key={k} className="p-2.5 capitalize">
                        {k.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {Object.values(row).map((val: any, valIdx: number) => (
                        <td key={valIdx} className="p-2.5 truncate max-w-[200px]">
                          {val === null || val === undefined ? '—' : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">રિપોર્ટ માટે કોઈ ડેટા ઉપલબ્ધ નથી.</div>
          )}

          {/* Print Footer */}
          <div className="pt-6 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between items-center print:block">
            <span>જનરેટ કરેલ: {new Date().toLocaleString('gu-IN')} • ANIVERA પશુરક્ષક પ્લેટફોર્મ</span>
            <span className="print:hidden">સરકારી પશુપાલન વિભાગ, ગુજરાત સરકાર</span>
          </div>
        </div>
      </div>
    </div>
  );
};
