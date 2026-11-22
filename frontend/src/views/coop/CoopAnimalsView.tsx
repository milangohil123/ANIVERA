import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from '../../components/common/KpiCard';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { coopService, type CoopAnimalItem } from '../../services/coopService';
import {
  PawPrint,
  Search,
  Download,
  RotateCcw,
  Tag,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Syringe,
  MapPin,
  ChevronRight,
  ArrowRight,
  Filter,
  User,
} from 'lucide-react';

export const CoopAnimalsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [animals, setAnimals] = useState<CoopAnimalItem[]>([]);
  const [speciesFilter, setSpeciesFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected animal detail modal
  const [selectedAnimal, setSelectedAnimal] = useState<CoopAnimalItem | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await coopService.listMemberAnimals(apiBaseUrl, {
        species: speciesFilter || undefined,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setAnimals(data);
    } catch {
      setAnimals([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, speciesFilter, statusFilter]);

  const filteredAnimals = useMemo(() => {
    if (!searchQuery.trim()) return animals;
    const q = searchQuery.toLowerCase();
    return animals.filter((a) => {
      const code = (a.animal_code || '').toLowerCase();
      const tag = (a.bharat_pashudhan_tag || '').toLowerCase();
      const owner = (a.farmer_name || '').toLowerCase();
      const vil = (a.village_name || '').toLowerCase();
      const sp = (a.species || '').toLowerCase();
      return code.includes(q) || tag.includes(q) || owner.includes(q) || vil.includes(q) || sp.includes(q);
    });
  }, [animals, searchQuery]);

  // Aggregate metrics
  const totalCount = animals.length;
  const coveredCount = animals.filter((a) => a.vaccination_status === 'COVERED').length;
  const pendingCount = animals.filter((a) => a.vaccination_status === 'PENDING').length;
  const overdueCount = animals.filter((a) => a.vaccination_status === 'OVERDUE').length;
  const coveragePct = totalCount > 0 ? ((coveredCount / totalCount) * 100).toFixed(1) : '0';
  const uniqueVillages = new Set(animals.map((a) => a.village_name).filter(Boolean)).size;

  // Export CSV
  const handleExportCsv = () => {
    if (animals.length === 0) return;
    const headers = ['Animal Code', 'Bharat Pashudhan Tag', 'Species', 'Breed', 'Sex', 'Farmer Name', 'Village', 'Status', 'Last Vaccinated', 'Next Due Date'];
    const rows = animals.map((a) => [
      a.animal_code,
      a.bharat_pashudhan_tag || 'N/A',
      a.species,
      a.breed || 'N/A',
      a.sex,
      `"${a.farmer_name}"`,
      `"${a.village_name}"`,
      a.vaccination_status,
      a.last_vaccinated_at ? new Date(a.last_vaccinated_at).toLocaleDateString('gu-IN') : 'Never',
      a.next_due_date || 'N/A',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Coop_Member_Livestock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COVERED':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-semibold text-[10px]">સંપૂર્ણ રસીકૃત (Covered)</span>;
      case 'PARTIAL':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-semibold text-[10px]">આંશિક (Partial)</span>;
      case 'OVERDUE':
        return <span className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded-full font-semibold text-[10px]">મુદતવીતી (Overdue)</span>;
      default:
        return <span className="px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-full font-semibold text-[10px]">બાકી (Pending)</span>;
    }
  };

  if (isLoading && animals.length === 0) {
    return <StateView state="loading" message="સંલગ્ન પશુધન રજીસ્ટર લોડ થઈ રહ્યું છે..." />;
  }

  return (
    <div className="w-full space-y-4 animate-fade-in pb-12 font-body text-[#172033]">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP PAGE HEADER                                       */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <span>કામગીરી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>ડેરી સહકારી મંડળી</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[#0F172A] font-medium">
            સંલગ્ન પશુધન રજીસ્ટર • {animals.length} પશુઓ
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              સંલગ્ન પશુધન રજીસ્ટર
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>પશુધન રજીસ્ટ્રી સક્રિય</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />
              <span>તાજું કરો</span>
            </button>

            <button
              onClick={() => navigate('/coop/maps')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#E8EEFC] text-xs font-semibold text-[#135D43] hover:bg-[#D8E4FA] shadow-xs transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
              <span>GIS ભૌગોલિક નકશો</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>CSV નિકાસ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. GOVERNANCE BANNER                                                   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-[#E8EEFC] border border-[#BFDBFE] rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 font-heading">
                સત્તાવાર સભાસદ પશુધન રજીસ્ટ્રી
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                ૧૨-અંક ભારત પશુધન ટેગ ટ્રેકિંગ
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              કુલ નોંધાયેલ પશુધન: {totalCount} • સંપૂર્ણ રસીકૃત: {coveredCount} ({coveragePct}%) • બાકી/મુદતવીતી: {pendingCount + overdueCount} • સંલગ્ન ગામો: {uniqueVillages}.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/vaccinations')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>રસીકરણ સ્થિતિ જુઓ</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ નોંધાયેલ પશુધન"
          value={isLoading ? '...' : String(totalCount)}
          subtext={`${uniqueVillages} ગામોમાં ફેલાયેલ`}
          icon={<PawPrint className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="સંપૂર્ણ રસીકૃત (Covered)"
          value={isLoading ? '...' : String(coveredCount)}
          valueColor="text-emerald-700"
          subtext="બંને ડોઝ સુરક્ષિત"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          iconVariant="emerald"
          onClick={() => setStatusFilter('COVERED')}
        />

        <KpiCard
          label="રસીકરણ કવરેજ દર"
          value={isLoading ? '...' : `${coveragePct}%`}
          valueColor="text-[#176B5B]"
          subtext={`${coveredCount} / ${totalCount} રસીકૃત`}
          icon={<Syringe className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          onClick={() => navigate('/coop/vaccinations')}
        />

        <KpiCard
          label="બાકી / મુદતવીતી"
          value={isLoading ? '...' : String(pendingCount + overdueCount)}
          valueColor="text-[#DC2626]"
          subtext="કતાર જુઓ →"
          badgeText={`${overdueCount} મુદતવીતી`}
          badgeVariant={overdueCount > 0 ? 'red' : 'slate'}
          icon={<Clock className="w-4 h-4 text-red-600" />}
          iconVariant="red"
          onClick={() => setStatusFilter('OVERDUE')}
        />

        <KpiCard
          label="સંકળાયેલા ગામો"
          value={isLoading ? '...' : String(uniqueVillages)}
          subtext="કાર્યક્ષેત્ર વિસ્તાર"
          icon={<MapPin className="w-4 h-4 text-[#135D43]" />}
          iconVariant="teal"
          onClick={() => navigate('/coop/maps')}
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. LIVESTOCK REGISTER TABLE WITH SECTION HEADER & FILTERS               */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 flex items-center justify-center text-[#176B5B] shrink-0 shadow-2xs">
              <PawPrint className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                  સંલગ્ન પશુધન રજીસ્ટર
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#135D43]">
                  {filteredAnimals.length} પશુઓ
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                સભાસદ પશુપાલકોના માલિકીના પશુઓની ૧૨-અંક ટેગ અને રસીકરણ સ્થિતિ
              </p>
            </div>
          </div>

          {/* Operational Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Species Filter */}
            <select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="p-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#135D43]"
            >
              <option value="">તમામ પ્રજાતિ (All Species)</option>
              <option value="CATTLE">ગાય (Cattle)</option>
              <option value="BUFFALO">ભેંસ (Buffalo)</option>
              <option value="GOAT">બકરી (Goat)</option>
              <option value="SHEEP">ઘેટાં (Sheep)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#135D43]"
            >
              <option value="">તમામ સ્થિતિ (All Status)</option>
              <option value="COVERED">સંપૂર્ણ રસીકૃત (Covered)</option>
              <option value="PARTIAL">આંશિક (Partial)</option>
              <option value="PENDING">બાકી (Pending)</option>
              <option value="OVERDUE">મુદતવીતી (Overdue)</option>
            </select>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="ટેગ, કોડ, ખેડૂત અથવા ગામ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#135D43]"
              />
            </div>
          </div>
        </div>

        {filteredAnimals.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <PawPrint className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">કોઈ પશુધન મળ્યું નથી.</p>
            <p className="text-xs text-slate-400">શોધ અથવા ફિલ્ટર્સ બદલીને ફરી પ્રયાસ કરો.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">ભારત પશુધન ટેગ</th>
                  <th className="py-2.5 px-3">પશુ કોડ</th>
                  <th className="py-2.5 px-3">પ્રજાતિ અને જાતિ</th>
                  <th className="py-2.5 px-3">માલિક ખેડૂત</th>
                  <th className="py-2.5 px-3">ગામ</th>
                  <th className="py-2.5 px-3 text-center">રસીકરણ સ્થિતિ</th>
                  <th className="py-2.5 px-3">છેલ્લું રસીકરણ</th>
                  <th className="py-2.5 px-3 text-right">કાર્યવાહી</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredAnimals.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#135D43]">
                      {a.bharat_pashudhan_tag ? (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[#135D43]" />
                          {a.bharat_pashudhan_tag}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">ટેગ વિના</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 font-medium">
                      {a.animal_code}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#0F172A]">{a.species}</div>
                      <div className="text-[10px] text-slate-400">{a.breed || 'દેશી'} • {a.sex === 'FEMALE' ? 'માદા' : 'નર'}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {a.farmer_name}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#135D43]" />
                        {a.village_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {getStatusBadge(a.vaccination_status)}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {a.last_vaccinated_at ? (
                        <span>{new Date(a.last_vaccinated_at).toLocaleDateString('gu-IN')}</span>
                      ) : (
                        <span className="text-slate-400">ક્યારેય નહીં</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedAnimal(a)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#E8EEFC] text-[#0284C7] hover:bg-[#D8E4FA] inline-flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        વિગત
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Animal Detail Modal */}
      {selectedAnimal && (
        <Modal
          isOpen={!!selectedAnimal}
          onClose={() => setSelectedAnimal(null)}
          title={`પશુ વિગત — ${selectedAnimal.animal_code}`}
        >
          <div className="space-y-4 text-xs font-body">
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">ભારત પશુધન ૧૨-અંક ટેગ</span>
                <span className="text-sm font-bold font-mono text-[#135D43]">
                  {selectedAnimal.bharat_pashudhan_tag || 'ટેગ ઉપલબ્ધ નથી'}
                </span>
              </div>
              <div>{getStatusBadge(selectedAnimal.vaccination_status)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">પ્રજાતિ</span>
                <span className="font-bold text-slate-900">{selectedAnimal.species}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">જાતિ (Breed)</span>
                <span className="font-bold text-slate-900">{selectedAnimal.breed || 'દેશી'}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">માલિક પશુપાલક</span>
                <span className="font-bold text-slate-900">{selectedAnimal.farmer_name}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">ગામ</span>
                <span className="font-bold text-slate-900">{selectedAnimal.village_name}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">છેલ્લું રસીકરણ તારીખ</span>
                <span className="font-bold text-slate-900 font-mono">
                  {selectedAnimal.last_vaccinated_at
                    ? new Date(selectedAnimal.last_vaccinated_at).toLocaleDateString('gu-IN')
                    : 'ક્યારેય નહીં'}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">આગામી રસીકરણ મુદત</span>
                <span className="font-bold text-amber-700 font-mono">
                  {selectedAnimal.next_due_date || 'બાકી નથી'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedAnimal(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
