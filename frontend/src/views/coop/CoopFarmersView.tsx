import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from '../../components/common/KpiCard';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { Modal } from '../../components/common/Modal';
import {
  coopService,
  type CoopMemberFarmerItem,
} from '../../services/coopService';
import {
  Users,
  Search,
  Plus,
  CheckCircle2,
  Download,
  PawPrint,
  Syringe,
  Clock,
  RotateCcw,
  MapPin,
  ChevronRight,
  ArrowRight,
  Trash2,
  Building2,
  Phone,
} from 'lucide-react';

export const CoopFarmersView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();

  const [members, setMembers] = useState<CoopMemberFarmerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Link Farmer Modal
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [availableFarmers, setAvailableFarmers] = useState<any[]>([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const [memberNo, setMemberNo] = useState<string>('');
  const [joinDate, setJoinDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmittingLink, setIsSubmittingLink] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await coopService.listMemberFarmers(apiBaseUrl);
      setMembers(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'સભાસદ ખેડૂત યાદી લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  // Filter members
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter((m) => {
      const name = (m.full_name_gu || '').toLowerCase() + (m.full_name_en || '').toLowerCase();
      const code = (m.farmer_code || '').toLowerCase();
      const mobile = (m.mobile_e164 || '').toLowerCase();
      const mbr = (m.member_no || '').toLowerCase();
      const vil = (m.village_name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || mobile.includes(q) || mbr.includes(q) || vil.includes(q);
    });
  }, [members, searchQuery]);

  // Aggregate metrics
  const totalAnimals = useMemo(() => members.reduce((sum, m) => sum + (m.total_animals || 0), 0), [members]);
  const totalVaccinated = useMemo(() => members.reduce((sum, m) => sum + (m.vaccinated_animals || 0), 0), [members]);
  const avgCoverage = totalAnimals > 0 ? ((totalVaccinated / totalAnimals) * 100).toFixed(1) : '0';
  const uniqueVillages = useMemo(() => new Set(members.map((m) => m.village_id).filter(Boolean)).size, [members]);

  // Open Link Modal & fetch eligible registered farmers
  const handleOpenLinkModal = async () => {
    setSelectedFarmerId('');
    setMemberNo(`MBR-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsLinkModalOpen(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/farmers?limit=100`, {
        headers: { Authorization: `Bearer ${session?.accessToken || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableFarmers(data || []);
      }
    } catch {
      setAvailableFarmers([]);
    }
  };

  // Submit Link
  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmerId) return;

    setIsSubmittingLink(true);
    try {
      await coopService.linkMemberFarmer(apiBaseUrl, selectedFarmerId, memberNo || undefined, joinDate);
      setSuccessMsg('ખેડૂતને મંડળીના સભાસદ તરીકે સફળતાપૂર્વક જોડવામાં આવ્યા.');
      setIsLinkModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'સભાસદ ઉમેરવામાં નિષ્ફળ');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // Unlink member
  const handleUnlink = async (farmerId: string, farmerName: string) => {
    if (!window.confirm(`શું તમે ખરેખર સભાસદ '${farmerName}' નું સભ્યપદ રદ કરવા માંગો છો?`)) return;

    try {
      await coopService.unlinkMemberFarmer(apiBaseUrl, farmerId);
      setSuccessMsg(`સભાસદ '${farmerName}' ને મંડળીમાંથી દૂર કરવામાં આવ્યા.`);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'સભાસદ દૂર કરવામાં નિષ્ફળ');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (members.length === 0) return;
    const headers = ['Member No', 'Farmer Code', 'Farmer Name (GU)', 'Mobile', 'Village', 'Total Animals', 'Vaccinated', 'Coverage %'];
    const rows = members.map((m) => [
      m.member_no || '',
      m.farmer_code,
      `"${m.full_name_gu}"`,
      m.mobile_e164 || '',
      `"${m.village_name}"`,
      m.total_animals,
      m.vaccinated_animals,
      `${m.coverage_percent}%`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Coop_Member_Farmers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && members.length === 0) {
    return <StateView state="loading" message="સભાસદ ખેડૂત યાદી લોડ થઈ રહી છે..." />;
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
            સભાસદ પશુપાલકો ડિરેક્ટરી • {members.length} નોંધાયેલ
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-heading tracking-tight">
              સભાસદ પશુપાલકો ડિરેક્ટરી
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#135D43]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>સહકારી સભાસદ રજીસ્ટ્રી સક્રિય</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>CSV નિકાસ</span>
            </button>

            <button
              onClick={handleOpenLinkModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#135D43] text-white text-xs font-semibold hover:bg-[#0F4C37] shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ નવો સભાસદ લિંક કરો</span>
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
                સત્તાવાર સભાસદ પશુપાલક રજીસ્ટ્રી
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white text-slate-700 border border-[#CBD5E1]">
                સહકારી સભાસદ વ્યવસ્થાપન
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              કુલ સભાસદો: {members.length} • સંલગ્ન પશુધન: {totalAnimals} • સરેરાશ કવરેજ: {avgCoverage}% • કાર્યક્ષેત્ર ગામો: {uniqueVillages}. તમામ સભાસદોનું પશુધન રસીકરણ મોનિટરિંગ હેઠળ છે.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/coop/animals')}
          className="text-xs font-semibold text-[#0284C7] hover:underline shrink-0 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>સંલગ્ન પશુધન રજીસ્ટર</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. 5 KPI CARDS IN ONE ROW (Exact DAHO Layout)                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="કુલ સભાસદ ખેડૂતો"
          value={isLoading ? '...' : String(members.length)}
          subtext={`${uniqueVillages} ગામોમાં ફેલાયેલ`}
          icon={<Users className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
        />

        <KpiCard
          label="કુલ સંલગ્ન પશુધન"
          value={isLoading ? '...' : String(totalAnimals)}
          valueColor="text-[#176B5B]"
          subtext={`સરેરાશ ${members.length > 0 ? (totalAnimals / members.length).toFixed(1) : 0} પશુ / ખેડૂત`}
          icon={<PawPrint className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          onClick={() => navigate('/coop/animals')}
        />

        <KpiCard
          label="રસીકરણ કવરેજ દર"
          value={isLoading ? '...' : `${avgCoverage}%`}
          valueColor="text-[#176B5B]"
          subtext={`${totalVaccinated} / ${totalAnimals} સુરક્ષિત`}
          icon={<Syringe className="w-4 h-4 text-[#176B5B]" />}
          iconVariant="emerald"
          onClick={() => navigate('/coop/vaccinations')}
        />

        <KpiCard
          label="બાકી રસીકરણ પશુઓ"
          value={isLoading ? '...' : String(Math.max(0, totalAnimals - totalVaccinated))}
          valueColor="text-[#DC2626]"
          subtext="કતાર જુઓ →"
          badgeText={`${Math.max(0, totalAnimals - totalVaccinated)} બાકી`}
          badgeVariant={totalAnimals - totalVaccinated > 0 ? 'red' : 'slate'}
          icon={<Clock className="w-4 h-4 text-red-600" />}
          iconVariant="red"
          onClick={() => navigate('/coop/vaccinations')}
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

      {/* Success / Error Alerts */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
          <p>{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. MEMBERS TABLE SECTION WITH UNIFORM SECTION HEADER                    */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] border border-[#176B5B]/20 flex items-center justify-center text-[#176B5B] shrink-0 shadow-2xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                  સભાસદોની સત્તાવાર યાદી
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#135D43]">
                  {filteredMembers.length} સભાસદો
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                મંડળી હેઠળ નોંધાયેલ સભાસદ ખેડૂતો અને તેમની પશુધન વિગત
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="નામ, સભ્ય નં, મોબાઇલ, કોડ વડે શોધો..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#135D43]"
              />
            </div>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-medium text-slate-700">કોઈ સભાસદ ખેડૂત મળ્યા નથી.</p>
            <p className="text-xs text-slate-400">
              તમે '+ નવો સભાસદ લિંક કરો' બટન પર ક્લિક કરીને ગામના ખેડૂતને મંડળીમાં જોડી શકો છો.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">સભ્ય નંબર</th>
                  <th className="py-2.5 px-3">ખેડૂતનું નામ</th>
                  <th className="py-2.5 px-3">મોબાઇલ</th>
                  <th className="py-2.5 px-3">ગામ</th>
                  <th className="py-2.5 px-3 text-center">કુલ પશુઓ</th>
                  <th className="py-2.5 px-3 text-center">રસીકરણ થયેલ</th>
                  <th className="py-2.5 px-3">કવરેજ ટકાવારી</th>
                  <th className="py-2.5 px-3 text-right">કાર્યવાહી</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredMembers.map((m) => (
                  <tr key={m.farmer_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#135D43]">
                      {m.member_no || '-'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#0F172A]">{m.full_name_gu || m.full_name_en}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.farmer_code}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {m.mobile_e164 ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {m.mobile_e164}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#135D43]" />
                        {m.village_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900 font-mono">
                      {m.total_animals}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700 font-mono">
                      {m.vaccinated_animals}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              m.coverage_percent >= 80
                                ? 'bg-emerald-600'
                                : m.coverage_percent >= 50
                                ? 'bg-amber-500'
                                : 'bg-orange-500'
                            }`}
                            style={{ width: `${Math.min(100, m.coverage_percent)}%` }}
                          />
                        </div>
                        <span className="font-bold font-mono text-[11px] text-[#0F172A]">
                          {m.coverage_percent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/coop/animals?search=${m.farmer_code}`)}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#E8EEFC] text-[#0284C7] hover:bg-[#D8E4FA] transition-colors"
                        >
                          પશુઓ જુઓ
                        </button>
                        <button
                          onClick={() => handleUnlink(m.farmer_id, m.full_name_gu)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="સભ્યપદ રદ કરો"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link Farmer Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="નવા ખેડૂતને મંડળીના સભાસદ તરીકે જોડો"
      >
        <form onSubmit={handleLinkSubmit} className="space-y-4 text-xs font-body">
          <p className="text-slate-600 text-xs leading-relaxed">
            કાર્યક્ષેત્ર હેઠળના નોંધાયેલ ખેડૂતને ડેરી સહકારી મંડળીના સભાસદ તરીકે લિંક કરો જેથી તેમના પશુધનનું રસીકરણ મોનિટરિંગ મંડળી ડેશબોર્ડમાં સામેલ થઈ શકે.
          </p>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              નોંધાયેલ ખેડૂત પસંદ કરો <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selectedFarmerId}
              onChange={(e) => setSelectedFarmerId(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#135D43]"
            >
              <option value="">-- ખેડૂત પસંદ કરો --</option>
              {availableFarmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name} ({f.farmer_code}) - {f.village_name || 'ગામ'} ({f.mobile_e164 || 'મોબાઇલ નથી'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                સભાસદ નંબર (Member ID)
              </label>
              <input
                type="text"
                value={memberNo}
                onChange={(e) => setMemberNo(e.target.value)}
                placeholder="દા.ત. MBR-1001"
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#135D43]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                જોડાયા તારીખ
              </label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#135D43]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLinkModalOpen(false)}
            >
              રદ કરો
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingLink}
              className="bg-[#135D43] text-white"
            >
              સભાસદ લિંક કરો
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
