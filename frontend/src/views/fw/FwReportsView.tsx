import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  fwService,
  type FWVaccinationItem,
  type FWAnimalItem,
  type FWVillageItem,
} from '../../services/fwService';
import { offlineDb } from '../../db/offlineDb';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  Search,
  RotateCcw,
  Syringe,
  PawPrint,
  Activity,
  MapPin,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  Layers,
  TrendingUp,
} from 'lucide-react';

const sanitizeCsvCell = (val: any): string => {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  // Formula injection defense: prefix with single quote if starts with dangerous chars
  if (/^[=+@\-\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય',
  BUFFALO: 'ભેંસ',
  GOAT: 'બકરી',
  SHEEP: 'ઘેટું',
  OTHER: 'અન્ય',
};

export const FwReportsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();

  const [activeTab, setActiveTab] = useState<'VACCINATIONS' | 'ANIMALS' | 'DISEASES' | 'VILLAGES'>('VACCINATIONS');
  const [villages, setVillages] = useState<FWVillageItem[]>([]);
  const [vaccinations, setVaccinations] = useState<FWVaccinationItem[]>([]);
  const [animals, setAnimals] = useState<FWAnimalItem[]>([]);
  const [diseaseReports, setDiseaseReports] = useState<any[]>([]);
  const [queuedEventsCount, setQueuedEventsCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVillageFilter, setSelectedVillageFilter] = useState<string>('');

  // Load all initial report data
  const loadReportsData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [vList, vaxList, reportsList, dbEvents] = await Promise.all([
        fwService.listAssignedVillages(apiBaseUrl).catch(() => []),
        fwService.listVaccinations(apiBaseUrl).catch(() => []),
        fwService.listMyDiseaseReports(apiBaseUrl).catch(() => []),
        offlineDb.queued_events.count().catch(() => 0),
      ]);

      setVillages(vList);
      setVaccinations(vaxList);
      setDiseaseReports(reportsList);
      setQueuedEventsCount(dbEvents);

      // Fetch animals for assigned villages
      const allAnimals: FWAnimalItem[] = [];
      for (const v of vList.slice(0, 5)) {
        try {
          const vAnimals = await fwService.listAnimals(apiBaseUrl, v.id);
          allAnimals.push(...vAnimals);
        } catch {
          // Continue
        }
      }
      setAnimals(allAnimals);
    } catch (e) {
      console.warn('Failed to load FW reports data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportsData();
  }, [apiBaseUrl]);

  // Village lookup map
  const villageMap = useMemo(() => {
    const map = new Map<string, string>();
    villages.forEach((v) => map.set(v.id, v.name_gu));
    return map;
  }, [villages]);

  // Aggregate KPI metrics
  const kpiData = useMemo(() => {
    return {
      totalVaccinations: vaccinations.length,
      totalAnimals: animals.length,
      totalDiseases: diseaseReports.length,
      totalVillages: villages.length,
      queuedEvents: queuedEventsCount,
    };
  }, [vaccinations, animals, diseaseReports, villages, queuedEventsCount]);

  // Filtered lists
  const filteredVaccinations = useMemo(() => {
    let list = vaccinations;
    if (selectedVillageFilter) {
      list = list.filter((v) => v.village_id === selectedVillageFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (v) =>
          (v.animal_id && v.animal_id.toLowerCase().includes(q)) ||
          (v.programme_code && v.programme_code.toLowerCase().includes(q)) ||
          (v.batch_number && v.batch_number.toLowerCase().includes(q))
      );
    }
    return list;
  }, [vaccinations, selectedVillageFilter, searchQuery]);

  const filteredAnimals = useMemo(() => {
    let list = animals;
    if (selectedVillageFilter) {
      list = list.filter((a) => a.village_id === selectedVillageFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.animal_code && a.animal_code.toLowerCase().includes(q)) ||
          (a.species_code && a.species_code.toLowerCase().includes(q))
      );
    }
    return list;
  }, [animals, selectedVillageFilter, searchQuery]);

  const filteredDiseases = useMemo(() => {
    let list = diseaseReports;
    if (selectedVillageFilter) {
      list = list.filter((d) => d.village_id === selectedVillageFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          (d.disease_code && d.disease_code.toLowerCase().includes(q)) ||
          (d.report_no && d.report_no.toLowerCase().includes(q))
      );
    }
    return list;
  }, [diseaseReports, selectedVillageFilter, searchQuery]);

  // CSV Export with formula injection protection
  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `FW_Report_${activeTab}_${new Date().toISOString().substring(0, 10)}.csv`;

    if (activeTab === 'VACCINATIONS') {
      headers = ['ક્રમ', 'તારીખ', 'પશુ આઈડી', 'ગામ', 'રસી કાર્યક્રમ', 'બેચ નંબર', 'કામગીરી કર્તા'];
      rows = filteredVaccinations.map((v, i) => [
        String(i + 1),
        v.event_date || '',
        v.animal_id || '',
        villageMap.get(v.village_id) || v.village_id,
        v.programme_code || '',
        v.batch_number || 'N/A',
        v.performed_by || '',
      ]);
    } else if (activeTab === 'ANIMALS') {
      headers = ['ક્રમ', 'નોંધણી તારીખ', 'પશુ કોડ', 'પ્રજાતિ', 'જાતિ', 'ગામ', 'નોંધણી સ્થિતિ'];
      rows = filteredAnimals.map((a, i) => [
        String(i + 1),
        a.created_at ? a.created_at.substring(0, 10) : '',
        a.animal_code || a.id,
        SPECIES_NAMES_GU[a.species_code] || a.species_code,
        a.sex === 'F' ? 'માદા' : 'નર',
        villageMap.get(a.village_id) || a.village_id,
        a.registration_status || 'VERIFIED',
      ]);
    } else if (activeTab === 'DISEASES') {
      headers = ['ક્રમ', 'તારીખ', 'અહેવાલ નંબર', 'શંકાસ્પદ રોગ', 'ગામ', 'લક્ષણો', 'સમીક્ષા સ્થિતિ'];
      rows = filteredDiseases.map((d, i) => [
        String(i + 1),
        d.reported_at ? d.reported_at.substring(0, 10) : '',
        d.report_no || d.id,
        d.disease_code || 'SUSPECTED',
        villageMap.get(d.village_id) || d.village_id,
        Array.isArray(d.symptoms) ? d.symptoms.join('; ') : '',
        d.review_status || 'PENDING',
      ]);
    } else {
      headers = ['ક્રમ', 'ગામનું નામ', 'ગામ કોડ', 'સોંપણી સ્થિતિ'];
      rows = villages.map((v, i) => [
        String(i + 1),
        v.name_gu,
        v.code,
        v.active ? 'સક્રિય' : 'નિષ્ક્રિય',
      ]);
    }

    const csvContent =
      '\uFEFF' +
      [
        headers.map(sanitizeCsvCell).join(','),
        ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-body text-[#172033] animate-fade-in">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F3EF] text-[#176B5B] flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#0F172A] font-heading flex items-center gap-2">
              ક્ષેત્રીય કામગીરી અહેવાલો (FW Activity Reports)
            </h1>
            <p className="text-xs text-[#64748B]">
              વ્યક્તિગત રસીકરણ, પ્રાથમિક પશુ નોંધણી, શંકાસ્પદ રોગ સર્વેલન્સ અને ગામવાર પ્રગતિનું પૃથ્થકરણ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/fw/analytics')}
            leftIcon={<TrendingUp className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            ઇન્ફરન્સ ડેશબોર્ડ (Live Analytics)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadReportsData(true)}
            isLoading={isRefreshing}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#176B5B]" />}
            className="text-xs"
          >
            તાજું કરો
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="text-xs bg-[#176B5B] hover:bg-[#135D43]"
          >
            CSV ડાઉનલોડ
          </Button>
        </div>
      </div>

      {/* 2. 4 Standard ANIVERA KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              કુલ રસીકરણ
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.totalVaccinations}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
              નોંધાયેલ ડોઝ
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#176B5B] flex items-center justify-center">
            <Syringe className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              નોંધાયેલ પશુઓ
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.totalAnimals}
            </p>
            <p className="text-[10px] text-[#64748B] mt-0.5">
              પ્રાથમિક રજીસ્ટ્રેશન
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <PawPrint className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              શંકાસ્પદ રોગ અહેવાલો
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.totalDiseases}
            </p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">
              વેટરનરી સમીક્ષા હેઠળ
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              સોંપાયેલ ગામો
            </p>
            <p className="text-2xl font-black text-[#0F172A] mt-1 font-heading">
              {kpiData.totalVillages}
            </p>
            <p className="text-[10px] text-teal-600 font-medium mt-0.5">
              {kpiData.queuedEvents > 0 ? `${kpiData.queuedEvents} ઑફલાઇન કતાર` : 'સંપૂર્ણ સિંક'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-[#176B5B] flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Report Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('VACCINATIONS')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'VACCINATIONS'
                ? 'border-[#176B5B] text-[#176B5B] bg-[#F7FAF9]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Syringe className="w-4 h-4" />
            રસીકરણ હિસ્ટ્રી ({vaccinations.length})
          </button>
          <button
            onClick={() => setActiveTab('ANIMALS')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'ANIMALS'
                ? 'border-[#176B5B] text-[#176B5B] bg-[#F7FAF9]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <PawPrint className="w-4 h-4" />
            પશુ નોંધણી રજિસ્ટર ({animals.length})
          </button>
          <button
            onClick={() => setActiveTab('DISEASES')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'DISEASES'
                ? 'border-[#176B5B] text-[#176B5B] bg-[#F7FAF9]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Activity className="w-4 h-4" />
            શંકાસ્પદ રોગ અહેવાલો ({diseaseReports.length})
          </button>
          <button
            onClick={() => setActiveTab('VILLAGES')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'VILLAGES'
                ? 'border-[#176B5B] text-[#176B5B] bg-[#F7FAF9]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            ગામવાર સારાંશ ({villages.length})
          </button>
        </div>

        {/* Filters bar */}
        <div className="p-3 sm:p-4 bg-[#F8FAFC] border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="શોધો (કોડ, રોગ, બેચ નંબર)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#176B5B] outline-none bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedVillageFilter}
              onChange={(e) => setSelectedVillageFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#176B5B] text-[#0F172A]"
            >
              <option value="">તમામ ગામો (All Villages)</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name_gu} ({v.name_en})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Content Tables */}
        <div className="p-4 overflow-x-auto">
          {isLoading ? (
            <div className="py-12">
              <StateView state="loading" title="અહેવાલ ડેટા લોડ થઈ રહ્યો છે..." />
            </div>
          ) : (
            <>
              {/* TAB 1: VACCINATIONS */}
              {activeTab === 'VACCINATIONS' && (
                filteredVaccinations.length === 0 ? (
                  <div className="py-10 text-center">
                    <StateView state="empty" title="કોઈ રસીકરણ રેકોર્ડ મળ્યો નથી" />
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-[#0F172A] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-[#64748B] font-semibold">
                        <th className="py-2.5 px-3">ક્રમ</th>
                        <th className="py-2.5 px-3">તારીખ</th>
                        <th className="py-2.5 px-3">પશુ આઈડી</th>
                        <th className="py-2.5 px-3">ગામ</th>
                        <th className="py-2.5 px-3">કાર્યક્રમ (રસી)</th>
                        <th className="py-2.5 px-3">બેચ નંબર</th>
                        <th className="py-2.5 px-3">કામગીરી કર્તા</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredVaccinations.map((v, i) => (
                        <tr key={v.event_id || i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 text-[#64748B]">{i + 1}</td>
                          <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                            {v.event_date || 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-800 font-semibold">
                            {v.animal_id}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            {villageMap.get(v.village_id) || v.village_id}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#176B5B] border border-emerald-200">
                              {v.programme_code}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {v.batch_number || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {v.performed_by || session?.user?.fullName || 'FW સ્ટાફ'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* TAB 2: ANIMALS */}
              {activeTab === 'ANIMALS' && (
                filteredAnimals.length === 0 ? (
                  <div className="py-10 text-center">
                    <StateView state="empty" title="કોઈ પશુ નોંધણી રેકોર્ડ મળ્યો નથી" />
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-[#0F172A] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-[#64748B] font-semibold">
                        <th className="py-2.5 px-3">ક્રમ</th>
                        <th className="py-2.5 px-3">તારીખ</th>
                        <th className="py-2.5 px-3">પશુ કોડ / ટેગ</th>
                        <th className="py-2.5 px-3">પ્રજાતિ</th>
                        <th className="py-2.5 px-3">જાતિ</th>
                        <th className="py-2.5 px-3">ગામ</th>
                        <th className="py-2.5 px-3">સ્થિતિ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAnimals.map((a, i) => (
                        <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 text-[#64748B]">{i + 1}</td>
                          <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                            {a.created_at ? a.created_at.substring(0, 10) : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#176B5B]">
                            {a.animal_code || a.id}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {SPECIES_NAMES_GU[a.species_code] || a.species_code}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {a.sex === 'F' ? 'માદા (F)' : a.sex === 'M' ? 'નર (M)' : 'અજ્ઞાત'}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            {villageMap.get(a.village_id) || a.village_id}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#176B5B] border border-emerald-200">
                              {a.registration_status || 'VERIFIED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* TAB 3: DISEASES */}
              {activeTab === 'DISEASES' && (
                filteredDiseases.length === 0 ? (
                  <div className="py-10 text-center">
                    <StateView state="empty" title="કોઈ શંકાસ્પદ રોગ અહેવાલ મળ્યો નથી" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        સૂચના: ક્ષેત્રીય કાર્યકર (FW) તરીકે આપ માત્ર શંકાસ્પદ લક્ષણો અને પુરાવા ફોટા નોંધો છો. સત્તાવાર રોગ પુષ્ટિ ફક્ત અધિકૃત વેટરનરી અધિકારી (VO) દ્વારા જ માન્ય થાય છે.
                      </span>
                    </div>

                    <table className="w-full text-left text-xs text-[#0F172A] border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-[#64748B] font-semibold">
                          <th className="py-2.5 px-3">ક્રમ</th>
                          <th className="py-2.5 px-3">તારીખ</th>
                          <th className="py-2.5 px-3">અહેવાલ આઈડી</th>
                          <th className="py-2.5 px-3">શંકાસ્પદ રોગ</th>
                          <th className="py-2.5 px-3">ગામ</th>
                          <th className="py-2.5 px-3">લક્ષણો</th>
                          <th className="py-2.5 px-3">સમીક્ષા સ્થિતિ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredDiseases.map((d, i) => (
                          <tr key={d.id || i} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-[#64748B]">{i + 1}</td>
                            <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                              {d.reported_at ? d.reported_at.substring(0, 10) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {d.report_no || d.id?.substring(0, 8)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-red-700">
                              {d.disease_code}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {villageMap.get(d.village_id) || d.village_id}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                              {Array.isArray(d.symptoms) ? d.symptoms.join(', ') : '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {d.review_status || 'PENDING_REVIEW'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* TAB 4: VILLAGES */}
              {activeTab === 'VILLAGES' && (
                <table className="w-full text-left text-xs text-[#0F172A] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-[#64748B] font-semibold">
                      <th className="py-2.5 px-3">ક્રમ</th>
                      <th className="py-2.5 px-3">ગામનું નામ</th>
                      <th className="py-2.5 px-3">ગામ કોડ</th>
                      <th className="py-2.5 px-3">સેન્સસ કોડ</th>
                      <th className="py-2.5 px-3">સ્થિતિ</th>
                      <th className="py-2.5 px-3 text-right">કાર્યવાહી</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {villages.map((v, i) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-[#64748B]">{i + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                          {v.name_gu} <span className="font-normal text-slate-400">({v.name_en})</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{v.code}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{v.census_code || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#176B5B] border border-emerald-200">
                            સક્રિય
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              localStorage.setItem('fw_active_village_id', v.id);
                              navigate('/fw/animals');
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-[#176B5B] hover:bg-emerald-100 transition-colors"
                          >
                            પશુધન જુઓ →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
