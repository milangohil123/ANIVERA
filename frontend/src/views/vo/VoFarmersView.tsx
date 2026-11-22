import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import { voService } from '../../services/voService';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  Users,
  Search,
  RotateCcw,
  Plus,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  PawPrint,
  ShieldCheck,
  Calendar,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface FarmerItem {
  id: string;
  farmer_code?: string;
  full_name: string;
  mobile_e164?: string;
  village_id: string;
  status: string;
  created_at: string;
  animal_count?: number;
}

export const VoFarmersView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [farmers, setFarmers] = useState<FarmerItem[]>([]);
  const [villages, setVillages] = useState<Array<{ id: string; name_gu: string; name_en: string; code: string }>>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detail Modal
  const [selectedFarmer, setSelectedFarmer] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Assisted Registration Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    mobile_e164: '',
    village_id: '',
    address: '',
    preferred_language: 'gu',
    outreach_opt_in: true,
  });
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const [fData, vData] = await Promise.all([
        voService.listFarmers(apiBaseUrl, {
          village_id: selectedVillageId || undefined,
          search: searchQuery || undefined,
          limit: 100,
        }).catch(() => []),
        voService.listVillages(apiBaseUrl).catch(() => []),
      ]);
      setFarmers(fData);
      setVillages(vData);
      if (vData.length > 0 && !registerForm.village_id) {
        setRegisterForm((prev) => ({ ...prev, village_id: vData[0].id }));
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'પશુપાલકોની માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, selectedVillageId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleViewFarmer = async (farmer: FarmerItem) => {
    setIsLoadingDetail(true);
    try {
      const detail = await voService.getFarmer(apiBaseUrl, farmer.id);
      setSelectedFarmer(detail);
    } catch (e: any) {
      alert(e.message || 'ખેડૂત વિગત મેળવવામાં ભૂલ આવી.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.full_name.trim() || !registerForm.village_id || !registerForm.mobile_e164.trim()) {
      alert('કૃપા કરીને નામ, મોબાઇલ અને ગામ પસંદ કરો.');
      return;
    }

    setIsSubmittingRegister(true);
    try {
      let cleanMobile = registerForm.mobile_e164.trim();
      if (!cleanMobile.startsWith('+')) {
        cleanMobile = cleanMobile.startsWith('91') ? `+${cleanMobile}` : `+91${cleanMobile}`;
      }

      await voService.registerFarmer(apiBaseUrl, {
        full_name: registerForm.full_name.trim(),
        mobile_e164: cleanMobile,
        village_id: registerForm.village_id,
        address: registerForm.address.trim() || undefined,
        preferred_language: 'gu',
        outreach_opt_in: registerForm.outreach_opt_in,
      });

      setNotice({ type: 'success', message: 'પશુપાલકની નવી નોંધણી સફળતાપૂર્વક પૂર્ણ થઈ!' });
      setIsRegisterOpen(false);
      setRegisterForm({
        full_name: '',
        mobile_e164: '',
        village_id: villages.length > 0 ? villages[0].id : '',
        address: '',
        preferred_language: 'gu',
        outreach_opt_in: true,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'ખેડૂત નોંધણી નિષ્ફળ થઈ.');
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  const villageMap = useMemo(() => {
    const map = new Map<string, string>();
    villages.forEach((v) => map.set(v.id, v.name_gu || v.name_en));
    return map;
  }, [villages]);

  const totalCount = farmers.length;
  const activeCount = farmers.filter((f) => f.status === 'ACTIVE').length;
  const withMobileCount = farmers.filter((f) => !!f.mobile_e164).length;

  const columns: Column<FarmerItem>[] = [
    {
      key: 'farmer_info',
      header: 'પશુપાલકનું નામ અને કોડ',
      render: (row) => (
        <div>
          <div className="font-bold text-[#0F172A] text-xs">
            {transliterateToGujarati(row.full_name)}
            <span className="text-[11px] text-slate-400 font-normal ml-1">({row.full_name})</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            કોડ: {row.farmer_code || row.id.substring(0, 8)}
          </div>
        </div>
      ),
    },
    {
      key: 'village',
      header: 'ગામ',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[#0F172A]">
          <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
          <span>{villageMap.get(row.village_id) || 'સોંપાયેલ ગામ'}</span>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'સંપર્ક નંબર',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-mono">
          <Phone className="w-3 h-3 text-slate-400" />
          <span>{row.mobile_e164 || '-'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => (
        <StatusChip
          variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}
          label={row.status === 'ACTIVE' ? 'સક્રિય' : row.status}
        />
      ),
    },
    {
      key: 'actions',
      header: 'કાર્યવાહી',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleViewFarmer(row)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#135D43] shadow-2xs transition-colors"
        >
          <span>પ્રોફાઇલ જુઓ</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#135D43]" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              અધિકૃત પશુપાલક ડિરેક્ટરી (Farmer Directory)
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {totalCount} નોંધાયેલ ખેડૂતો
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            તમારા સોંપાયેલા ગામોના નોંધાયેલ પશુપાલકો, માલિકીનું પશુધન અને સંપર્ક માહિતીનું સંચાલન
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            રીફ્રેશ
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRegisterOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            + સહાયક ખેડૂત નોંધણી
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="કુલ નોંધાયેલ પશુપાલકો"
          value={isLoading ? '...' : totalCount}
          subtext="તમારા અધિકૃત ગામડાં"
          icon={<Users className="w-4 h-4 text-[#135D43]" />}
          iconVariant="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="સક્રિય પ્રોફાઇલ"
          value={isLoading ? '...' : activeCount}
          valueColor="text-[#135D43]"
          subtext="સક્રિય ખાતા સ્થિતિ"
          icon={<CheckCircle2 className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
        <KpiCard
          label="મોબાઇલ લિંક્ડ"
          value={isLoading ? '...' : withMobileCount}
          valueColor="text-[#0284C7]"
          subtext="સંચાર અને OTP સુવિધા"
          icon={<Phone className="w-4 h-4 text-[#0284C7]" />}
          iconVariant="secondary"
          isLoading={isLoading}
        />
        <KpiCard
          label="અધિકૃત ગામો"
          value={villages.length}
          subtext="કાર્યક્ષેત્ર હેઠળના ગામડાં"
          icon={<MapPin className="w-4 h-4 text-slate-700" />}
          iconVariant="neutral"
          isLoading={isLoading}
        />
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="નામ, ખેડૂત કોડ કે મોબાઇલ નંબર શોધો..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#135D43] bg-slate-50 focus:bg-white"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedVillageId}
            onChange={(e) => setSelectedVillageId(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
          >
            <option value="">-- તમામ સોંપાયેલ ગામડાં --</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name_gu} ({v.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Table */}
      {isLoading ? (
        <StateView state="loading" message="પશુપાલકોની માહિતી લોડ થઈ રહી છે..." />
      ) : farmers.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ પશુપાલક મળ્યા નથી"
          message="પસંદ કરેલ ફિલ્ટરમાં કોઈ નોંધાયેલા પશુપાલક ઉપલબ્ધ નથી."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <DataTable data={farmers} columns={columns} keyExtractor={(f) => f.id} />
        </div>
      )}

      {/* 5. Farmer Detail Modal */}
      {selectedFarmer && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedFarmer(null)}
          title={`પશુપાલક પ્રોફાઇલ: ${selectedFarmer.full_name}`}
        >
          <div className="space-y-4">
            {/* Top Identity Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">
                  {transliterateToGujarati(selectedFarmer.full_name)}
                </span>
                <StatusChip
                  variant={selectedFarmer.status === 'ACTIVE' ? 'success' : 'neutral'}
                  label={selectedFarmer.status === 'ACTIVE' ? 'સક્રિય' : selectedFarmer.status}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                <div>
                  <span className="text-slate-400">ખેડૂત કોડ:</span>{' '}
                  <strong className="text-slate-800 font-mono">{selectedFarmer.farmer_code || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">મોબાઇલ:</span>{' '}
                  <strong className="text-slate-800 font-mono">{selectedFarmer.mobile_e164 || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">ગામ:</span>{' '}
                  <strong className="text-slate-800">{villageMap.get(selectedFarmer.village_id) || selectedFarmer.village_name || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">નોંધણી તારીખ:</span>{' '}
                  <strong className="text-slate-800 font-mono">
                    {selectedFarmer.created_at ? new Date(selectedFarmer.created_at).toLocaleDateString('gu-IN') : '-'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Registered Livestock Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <PawPrint className="w-3.5 h-3.5 text-[#135D43]" />
                  <span>નોંધાયેલ પશુધન ({selectedFarmer.animals ? selectedFarmer.animals.length : 0})</span>
                </h4>
              </div>

              {selectedFarmer.animals && selectedFarmer.animals.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedFarmer.animals.map((anm: any) => (
                    <div
                      key={anm.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900 font-mono">
                          {anm.animal_code || anm.id.substring(0, 8)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          જાતિ: {anm.species_code} • લિંગ: {anm.gender === 'FEMALE' ? 'માદા' : 'નર'}
                          {anm.tag_value && <span className="font-mono text-[#135D43] ml-1">ટેગ: {anm.tag_value}</span>}
                        </div>
                      </div>
                      <StatusChip
                        variant={anm.status === 'ACTIVE' ? 'success' : 'neutral'}
                        label={anm.status === 'ACTIVE' ? 'સક્રિય' : anm.status}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  આ પશુપાલક હેઠળ હજુ કોઈ પશુ નોંધાયેલ નથી.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedFarmer(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Assisted Registration Modal */}
      {isRegisterOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRegisterOpen(false)}
          title="નવી સહાયક પશુપાલક નોંધણી (VO Assisted Farmer Registration)"
        >
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                પશુપાલકનું પૂરું નામ (Full Name) *
              </label>
              <input
                type="text"
                required
                value={registerForm.full_name}
                onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                placeholder="દા.ત. રમેશભાઈ ગોપાલભાઈ પટેલ"
                className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  મોબાઇલ નંબર (Mobile) *
                </label>
                <input
                  type="tel"
                  required
                  value={registerForm.mobile_e164}
                  onChange={(e) => setRegisterForm({ ...registerForm, mobile_e164: e.target.value })}
                  placeholder="દા.ત. 9876543210"
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ગામ પસંદ કરો (Village) *
                </label>
                <select
                  required
                  value={registerForm.village_id}
                  onChange={(e) => setRegisterForm({ ...registerForm, village_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
                >
                  <option value="">-- ગામ પસંદ કરો --</option>
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name_gu} ({v.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                સરનામું / વાસ (Address / Area)
              </label>
              <input
                type="text"
                value={registerForm.address}
                onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                placeholder="દા.ત. પટેલ વાસ, મંદિર પાસે"
                className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="outreach_consent"
                checked={registerForm.outreach_opt_in}
                onChange={(e) => setRegisterForm({ ...registerForm, outreach_opt_in: e.target.checked })}
                className="w-4 h-4 text-[#135D43] rounded border-slate-300 focus:ring-[#135D43]"
              />
              <label htmlFor="outreach_consent" className="text-[11px] text-slate-600">
                પશુપાલકે રસીકરણ રીમાઇન્ડર અને આરોગ્ય સંદેશાઓ મેળવવા માટે સંમતિ આપી છે (Lawful Outreach Consent).
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsRegisterOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingRegister}>
                નોંધણી સાચવો
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
