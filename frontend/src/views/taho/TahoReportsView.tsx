import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  BarChart3,
  Download,
  Printer,
  FileSpreadsheet,
  FileCode,
  RotateCcw,
  Layers,
  Users,
  Syringe,
  Activity,
} from 'lucide-react';

export const TahoReportsView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [overview, setOverview] = useState<any | null>(null);
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ov, hier] = await Promise.all([
        adminService.getTahoOverview(apiBaseUrl),
        adminService.getTahoHierarchy(apiBaseUrl).catch(() => null),
      ]);
      setOverview(ov);
      setHierarchy(hier);
    } catch (err: any) {
      console.warn('Reports load note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const exportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert('નિકાસ માટે કોઈ ડેટા નથી.');
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = row[h] === null || row[h] === undefined ? '' : String(row[h]).replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const talukaName = overview?.taluka_name_gu || overview?.taluka_name_en || 'Taluka';
  const villageList = hierarchy?.villages || [];
  const villageCoverage = overview?.charts?.village_coverage || [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in print:p-0">
      {/* 1. Header Toolbar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              તાલુકા રિપોર્ટ્સ & પૃથ્થકરણ (Reports & Analytics Center)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            તાલુકા વહીવટી ડેટા, ગામ કવરેજ, રોગ સર્વેલન્સ અને સ્ટાફ કામગીરીના નિકાસ યોગ્ય અહેવાલો
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-3.5 h-3.5" />}>
            પ્રિન્ટ / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {/* 2. Export Actions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
            <FileSpreadsheet className="w-4 h-4" />
            <span>ગામ કવરેજ રિપોર્ટ (CSV)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            તાલુકાના તમામ ગામોના લક્ષ્યાંકિત પશુઓ, પૂર્ણ રસીકરણ અને કવરેજ ટકાવારીની CSV ફાઇલ ડાઉનલોડ કરો.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(villageCoverage, `TAHO_${overview?.taluka_code}_Village_Coverage`)}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="w-full text-xs"
          >
            CSV ડાઉનલોડ
          </Button>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sky-800 font-bold text-xs">
            <FileCode className="w-4 h-4" />
            <span>સંપૂર્ણ ડેટાસેટ (JSON)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            તાલુકા વિહંગાવલોકન, તમામ ૧૧ KPIs, ચાર્ટ્સ અને ગામ માળખાનો સંપૂર્ણ JSON ડેટા મેળવો.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportJSON({ overview, hierarchy }, `TAHO_${overview?.taluka_code}_Full_Data`)}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="w-full text-xs"
          >
            JSON ડાઉનલોડ
          </Button>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-purple-800 font-bold text-xs">
            <Printer className="w-4 h-4" />
            <span>સરકારી દસ્તાવેજ પ્રિન્ટ</span>
          </div>
          <p className="text-[11px] text-slate-500">
            અધિકૃત મિટિંગ્સ અને જિલ્લા પંચાયત સમીક્ષા માટે સત્તાવાર પ્રિન્ટ અથવા PDF નકલ જનરેટ કરો.
          </p>
          <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-3.5 h-3.5" />} className="w-full text-xs">
            હવે પ્રિન્ટ કરો
          </Button>
        </Card>
      </div>

      {/* 3. Printable Operational Report Sheet */}
      <Card className="p-6 bg-white border border-slate-200 shadow-xs space-y-6">
        {/* Government Header */}
        <div className="text-center border-b border-slate-200 pb-4 space-y-1">
          <div className="text-sm font-bold text-slate-900 tracking-wider">પશુપાલન નિયામકની કચેરી, ગુજરાત સરકાર</div>
          <h2 className="text-lg font-bold font-heading text-emerald-800">
            {talukaName} તાલુકા પશુપાલન વહીવટી પ્રગતિ અહેવાલ
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            જિલ્લો: {overview?.district_name_gu || overview?.district_name_en} • તાલુકા કોડ: {overview?.taluka_code} • તારીખ: {new Date().toLocaleDateString('gu-IN')}
          </p>
        </div>

        {/* Operational Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] text-slate-500 block">કુલ ગામો</span>
            <span className="text-lg font-bold text-slate-900 font-heading">{overview?.total_villages || 0}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] text-slate-500 block">કુલ પશુધન</span>
            <span className="text-lg font-bold text-slate-900 font-heading">{overview?.total_animals || 0}</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
            <span className="text-[11px] text-emerald-800 block">પૂર્ણ રસીકરણ</span>
            <span className="text-lg font-bold text-emerald-700 font-heading">{overview?.total_vaccinations || 0}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] text-slate-500 block">સરેરાશ કવરેજ</span>
            <span className="text-lg font-bold text-emerald-700 font-heading">
              {overview?.kpis?.overall_coverage_pct || 0}%
            </span>
          </div>
        </div>

        {/* Village Coverage Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            ગામ મુજબ રસીકરણ કવરેજ વિગત
          </h3>
          <table className="w-full text-left text-xs border border-slate-200 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                <th className="p-2 border border-slate-200">ક્રમ</th>
                <th className="p-2 border border-slate-200">ગામનું નામ</th>
                <th className="p-2 border border-slate-200 text-right">લક્ષ્યાંકિત પશુઓ</th>
                <th className="p-2 border border-slate-200 text-right">પૂર્ણ ડોઝ</th>
                <th className="p-2 border border-slate-200 text-right">કવરેજ (%)</th>
              </tr>
            </thead>
            <tbody>
              {villageCoverage.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">
                    હજુ સુધી રસીકરણ ડેટા ઉપલબ્ધ નથી.
                  </td>
                </tr>
              ) : (
                villageCoverage.map((vc: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 border border-slate-200 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-2 border border-slate-200 font-medium">
                      {vc.village_name_gu || transliterateToGujarati(vc.village_name_en)} ({vc.village_name_en})
                    </td>
                    <td className="p-2 border border-slate-200 font-mono text-right">{vc.target_animals}</td>
                    <td className="p-2 border border-slate-200 font-mono text-right font-bold text-emerald-700">
                      {vc.vaccinated_count}
                    </td>
                    <td className="p-2 border border-slate-200 font-mono text-right font-bold">
                      {vc.coverage_pct}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Officer Signature Block for Print */}
        <div className="pt-12 flex justify-between items-end text-xs text-slate-600">
          <div>
            <p>તૈયાર કરનાર: ANIVERA પોર્ટલ સિસ્ટમ</p>
            <p className="font-mono text-[10px]">જનરેટ તારીખ: {new Date().toISOString()}</p>
          </div>
          <div className="text-center space-y-1">
            <div className="w-48 border-b border-slate-400 pb-8" />
            <p className="font-bold text-slate-900">તાલુકા પશુપાલન અધિકારી (TAHO)</p>
            <p className="text-[11px] text-slate-500">{talukaName} તાલુકો</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
