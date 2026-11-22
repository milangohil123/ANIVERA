import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import { voService } from '../../services/voService';
import {
  PawPrint,
  RotateCcw,
  MapPin,
  Search,
  Plus,
  Filter,
  Syringe,
  Activity,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronRight,
  ShieldCheck,
  User,
  QrCode,
  Tag,
  Clock,
} from 'lucide-react';

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય (Cattle)',
  BUFFALO: 'ભેંસ (Buffalo)',
  GOAT: 'બકરી (Goat)',
  SHEEP: 'ઘેટું (Sheep)',
  OTHER: 'અન્ય',
};

interface AnimalItem {
  id: string;
  animal_code?: string;
  village_id: string;
  farmer_id: string;
  species_code: string;
  breed_id?: string | null;
  gender: string;
  status: string;
  external_tag?: string | null;
  registration_status?: string;
  created_at: string;
}

export const VoAnimalsView: React.FC = () => {
  const { apiBaseUrl, session } = useAuth();
  const [animals, setAnimals] = useState<AnimalItem[]>([]);
  const [villages, setVillages] = useState<Array<{ id: string; name_gu: string; name_en: string; code: string }>>([]);
  const [farmers, setFarmers] = useState<Array<{ id: string; full_name: string; farmer_code?: string; village_id: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('');

  // Animal Detail Modal
  const [selectedAnimalDetail, setSelectedAnimalDetail] = useState<any | null>(null);
  const [animalHistory, setAnimalHistory] = useState<any | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'INFO' | 'VAX_HISTORY' | 'DISEASE_HISTORY'>('INFO');

  // VO Fallback Registration Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regSpecies, setRegSpecies] = useState('CATTLE');
  const [regSex, setRegSex] = useState('F');
  const [regAgeMonths, setRegAgeMonths] = useState<number>(24);
  const [regVillageId, setRegVillageId] = useState('');
  const [regFarmerId, setRegFarmerId] = useState('');
  const [regTag, setRegTag] = useState('');
  const [regUnavailReason, setRegUnavailReason] = useState('ક્ષેત્રીય કાર્યકર રજા પર છે અથવા અપ્રાપ્ય છે.');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const token = session?.accessToken || '';
      const [anmRes, vList, fList] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/animals?limit=150`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }).then((r) => (r.ok ? r.json() : [])),
        voService.listVillages(apiBaseUrl).catch(() => []),
        voService.listFarmers(apiBaseUrl, { limit: 150 }).catch(() => []),
      ]);

      setAnimals(Array.isArray(anmRes) ? anmRes : []);
      setVillages(vList);
      setFarmers(fList);

      if (vList.length > 0 && !regVillageId) {
        setRegVillageId(vList[0].id);
      }
    } catch (e: any) {
      console.warn('Animals load error:', e);
      setNotice({ type: 'error', message: 'પશુ ડેટા લોડ કરવામાં નિષ્ફળ.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const villageMap = useMemo(() => {
    const map = new Map<string, string>();
    villages.forEach((v) => map.set(v.id, v.name_gu || v.name_en));
    return map;
  }, [villages]);

  const farmerMap = useMemo(() => {
    const map = new Map<string, string>();
    farmers.forEach((f) => map.set(f.id, f.full_name));
    return map;
  }, [farmers]);

  const filteredAnimals = useMemo(() => {
    return animals.filter((a) => {
      if (selectedVillageId && a.village_id !== selectedVillageId) return false;
      if (selectedSpecies && a.species_code !== selectedSpecies) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      return (
        a.id.toLowerCase().includes(q) ||
        (a.external_tag && a.external_tag.toLowerCase().includes(q)) ||
        (a.animal_code && a.animal_code.toLowerCase().includes(q))
      );
    });
  }, [animals, selectedVillageId, selectedSpecies, searchQuery]);

  const handleOpenAnimalDetail = async (animal: AnimalItem) => {
    setSelectedAnimalDetail(animal);
    setActiveProfileTab('INFO');
    setIsLoadingHistory(true);
    try {
      const historyData = await voService.getAnimalHistory(apiBaseUrl, animal.id).catch(() => null);
      setAnimalHistory(historyData);
    } catch {
      setAnimalHistory(null);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRegisterAnimalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regVillageId || !regFarmerId || !regSpecies) {
      alert('કૃપા કરીને ગામ, માલિક પશુપાલક અને જાતિ પસંદ કરો.');
      return;
    }

    if (regTag.trim() && !/^\d{12}$/.test(regTag.trim())) {
      alert('ભારત પશુધન કાનનો ટેગ બરાબર ૧૨ અંકનો હોવો જોઈએ.');
      return;
    }

    setIsSubmittingReg(true);
    try {
      await voService.registerAnimal(apiBaseUrl, {
        species_code: regSpecies,
        sex: regSex,
        age_months_estimate: Number(regAgeMonths) || 24,
        farmer_id: regFarmerId,
        village_id: regVillageId,
        bharat_pashudhan_tag: regTag.trim() || undefined,
        tag_value: regTag.trim() || undefined,
        tag_identification_method: regTag.trim() ? 'EXISTING_BARCODE' : undefined,
      });

      setNotice({ type: 'success', message: 'પશુ સફળતાપૂર્વક નોંધાયું!' });
      setIsRegisterModalOpen(false);
      setRegTag('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'પશુ નોંધણી નિષ્ફળ થઈ. (નોંધ: VO Fallback માટે FW અપ્રાપ્યતા જરૂરી છે)');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // KPI calculations
  const totalCount = animals.length;
  const cattleCount = animals.filter((a) => a.species_code === 'CATTLE').length;
  const buffaloCount = animals.filter((a) => a.species_code === 'BUFFALO').length;
  const smallRuminants = animals.filter((a) => a.species_code === 'GOAT' || a.species_code === 'SHEEP').length;

  const columns: Column<AnimalItem>[] = [
    {
      key: 'id',
      header: 'પશુ ટેગ / ઓળખ આઈડી',
      render: (row) => (
        <div>
          <div className="font-mono font-bold text-[#0F172A] text-xs">
            {row.external_tag || row.animal_code || row.id.substring(0, 8)}
          </div>
          {row.external_tag && (
            <div className="text-[10px] text-[#135D43] font-mono flex items-center gap-1 mt-0.5">
              <Tag className="w-2.5 h-2.5" />
              <span>૧૨-અંક ટેગ: {row.external_tag}</span>
            </div>
          )}
          <div className="text-[9px] text-slate-400 font-mono">UUID: {row.id.substring(0, 8)}...</div>
        </div>
      ),
    },
    {
      key: 'species',
      header: 'જાતિ અને લિંગ',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <PawPrint className="w-3 h-3 text-emerald-600" />
          <span>{SPECIES_NAMES_GU[row.species_code] || row.species_code}</span>
          <span className="text-emerald-600">({row.gender === 'FEMALE' ? 'માદા' : 'નર'})</span>
        </span>
      ),
    },
    {
      key: 'village',
      header: 'ગામ',
      render: (row) => (
        <div className="flex items-center gap-1 text-xs text-slate-800 font-medium">
          <MapPin className="w-3.5 h-3.5 text-[#135D43] shrink-0" />
          <span>{villageMap.get(row.village_id) || 'સોંપાયેલ ગામ'}</span>
        </div>
      ),
    },
    {
      key: 'farmer',
      header: 'માલિક પશુપાલક',
      render: (row) => (
        <div className="text-xs text-slate-700">
          <div className="font-semibold text-slate-900">{farmerMap.get(row.farmer_id) || 'નોંધાયેલ ખેડૂત'}</div>
          <div className="text-[10px] text-slate-400 font-mono">ID: {row.farmer_id.substring(0, 8)}...</div>
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
          onClick={() => handleOpenAnimalDetail(row)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#135D43] shadow-2xs transition-colors"
        >
          <span>વિગતવાર પ્રોફાઇલ</span>
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
            <PawPrint className="w-5 h-5 text-[#135D43]" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              અધિકૃત પશુ રજિસ્ટ્રી અને ચકાસણી (Animal Registry)
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {totalCount} કુલ પશુઓ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            સોંપાયેલા ગામડાંઓમાં નોંધાયેલ પશુઓની ઓળખ, ૧૨-અંક ટેગ, રસીકરણ ઇતિહાસ અને આરોગ્ય સારવાર
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
            onClick={() => setIsRegisterModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            + પશુ નોંધણી (VO Fallback)
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
          label="કુલ નોંધાયેલ પશુધન"
          value={isLoading ? '...' : totalCount}
          subtext="તમારા અધિકૃત ગામડાં"
          icon={<PawPrint className="w-4 h-4 text-[#135D43]" />}
          iconVariant="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="ગાય (Cattle)"
          value={isLoading ? '...' : cattleCount}
          valueColor="text-[#135D43]"
          subtext="મોટા પશુધન"
          icon={<PawPrint className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
        <KpiCard
          label="ભેંસ (Buffalo)"
          value={isLoading ? '...' : buffaloCount}
          valueColor="text-[#0284C7]"
          subtext="મોટા પશુધન"
          icon={<PawPrint className="w-4 h-4 text-[#0284C7]" />}
          iconVariant="secondary"
          isLoading={isLoading}
        />
        <KpiCard
          label="બકરી / ઘેટાં"
          value={isLoading ? '...' : smallRuminants}
          valueColor="text-amber-700"
          subtext="નાના પશુઓ"
          icon={<PawPrint className="w-4 h-4 text-amber-700" />}
          iconVariant="amber"
          isLoading={isLoading}
        />
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="પશુ ID, ૧૨-અંક ટેગ અથવા કોડ શોધો..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#135D43] bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#135D43]"
          >
            <option value="">-- તમામ જાતિઓ --</option>
            <option value="CATTLE">ગાય (Cattle)</option>
            <option value="BUFFALO">ભેંસ (Buffalo)</option>
            <option value="GOAT">બકરી (Goat)</option>
            <option value="SHEEP">ઘેટું (Sheep)</option>
          </select>

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

      {/* 4. Animals Table */}
      {isLoading ? (
        <StateView state="loading" message="પશુ ડેટા લોડ થઈ રહ્યો છે..." />
      ) : filteredAnimals.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ પશુ મળ્યા નથી"
          message="પસંદ કરેલ ફિલ્ટરમાં કોઈ નોંધાયેલા પશુ ઉપલબ્ધ નથી."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <DataTable data={filteredAnimals} columns={columns} keyExtractor={(a) => a.id} />
        </div>
      )}

      {/* 5. Animal Detailed Profile & History Modal */}
      {selectedAnimalDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAnimalDetail(null)}
          title={`પશુ પ્રોફાઇલ: ${selectedAnimalDetail.external_tag || selectedAnimalDetail.animal_code || selectedAnimalDetail.id.substring(0, 8)}`}
        >
          <div className="space-y-4">
            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 gap-2 pb-2">
              <button
                type="button"
                onClick={() => setActiveProfileTab('INFO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeProfileTab === 'INFO'
                    ? 'bg-[#135D43] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <PawPrint className="w-3.5 h-3.5" />
                પશુ ઓળખ અને વિગત
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('VAX_HISTORY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeProfileTab === 'VAX_HISTORY'
                    ? 'bg-[#135D43] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Syringe className="w-3.5 h-3.5" />
                રસીકરણ ઇતિહાસ ({animalHistory?.total_vaccinations || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('DISEASE_HISTORY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeProfileTab === 'DISEASE_HISTORY'
                    ? 'bg-[#135D43] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                રોગ અને સારવાર ({animalHistory?.total_disease_reports || 0})
              </button>
            </div>

            {/* TAB 1: General Info */}
            {activeProfileTab === 'INFO' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      {SPECIES_NAMES_GU[selectedAnimalDetail.species_code] || selectedAnimalDetail.species_code}
                    </span>
                    <StatusChip
                      variant={selectedAnimalDetail.status === 'ACTIVE' ? 'success' : 'neutral'}
                      label={selectedAnimalDetail.status === 'ACTIVE' ? 'સક્રિય' : selectedAnimalDetail.status}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400">૧૨-અંક ટેગ:</span>{' '}
                      <strong className="text-slate-900 font-mono">
                        {selectedAnimalDetail.external_tag || 'નોંધાયેલ નથી'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">લિંગ:</span>{' '}
                      <strong className="text-slate-900">
                        {selectedAnimalDetail.gender === 'FEMALE' ? 'માદા (Female)' : 'નર (Male)'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">ગામ:</span>{' '}
                      <strong className="text-slate-900">
                        {villageMap.get(selectedAnimalDetail.village_id) || 'સોંપાયેલ ગામ'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">માલિક પશુપાલક:</span>{' '}
                      <strong className="text-slate-900">
                        {farmerMap.get(selectedAnimalDetail.farmer_id) || 'નોંધાયેલ ખેડૂત'}
                      </strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">આંતરિક ID:</span>{' '}
                      <span className="text-slate-700 font-mono text-[11px]">{selectedAnimalDetail.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Vaccination History */}
            {activeProfileTab === 'VAX_HISTORY' && (
              <div className="space-y-3 text-xs max-h-72 overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="py-6 text-center text-slate-500">
                    <RotateCcw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#135D43]" />
                    <span>રસીકરણ ઇતિહાસ લોડ થઈ રહ્યો છે...</span>
                  </div>
                ) : !animalHistory || animalHistory.vaccinations.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                    આ પશુ માટે કોઈ રસીકરણ ઇતિહાસ મળ્યો નથી.
                  </div>
                ) : (
                  animalHistory.vaccinations.map((v: any) => (
                    <div
                      key={v.event_id}
                      className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">
                          {v.programme_name_gu || v.programme_code}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          તારીખ: {v.vaccination_date || v.event_date}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>સંચાલક: {v.administered_by_name || 'અધિકૃત કાર્યકર'}</span>
                        {v.batch_number && <span className="font-mono">બેચ: {v.batch_number}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: Disease & Clinical History */}
            {activeProfileTab === 'DISEASE_HISTORY' && (
              <div className="space-y-3 text-xs max-h-72 overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="py-6 text-center text-slate-500">
                    <RotateCcw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#135D43]" />
                    <span>રોગ ઇતિહાસ લોડ થઈ રહ્યો છે...</span>
                  </div>
                ) : !animalHistory || animalHistory.disease_reports.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                    આ પશુ માટે કોઈ શંકાસ્પદ રોગ કે સારવાર અહેવાલ નથી.
                  </div>
                ) : (
                  animalHistory.disease_reports.map((dr: any) => (
                    <div
                      key={dr.report_id}
                      className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900 text-xs">
                          {dr.disease_name_gu || dr.disease_code}
                        </span>
                        <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          સ્થિતિ: {dr.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700">
                        {dr.observation_text || (dr.symptoms && dr.symptoms.length > 0 ? `લક્ષણો: ${dr.symptoms.join(', ')}` : 'તપાસ નોંધાયેલ')}
                      </p>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-amber-100 flex items-center justify-between">
                        <span>અહેવાલ તારીખ: {dr.report_date}</span>
                        <span>અહેવાલકર્તા: {dr.reported_by_name || '-'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedAnimalDetail(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Assisted Animal Registration Modal (VO Fallback) */}
      {isRegisterModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRegisterModalOpen(false)}
          title="નવી પશુ નોંધણી (VO Fallback Registration)"
        >
          <form onSubmit={handleRegisterAnimalSubmit} className="space-y-3.5 text-xs">
            {/* Prerequisite Alert Banner */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>VO પશુ નોંધણી પૂર્વશરત (DEC-008 & FR-ANM-10)</span>
              </div>
              <p className="text-[11px] text-amber-800">
                ક્ષેત્રીય કાર્યકર (FW) મુખ્ય રજિસ્ટ્રાર છે. વેટરનરી અધિકારી (VO) ત્યારે જ પશુ નોંધણી કરી શકે છે જ્યારે FW અપ્રાપ્ય હોય અને તેનું કારણ નોંધાયેલ હોય.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">પશુ જાતિ (Species) *</label>
                <select
                  required
                  value={regSpecies}
                  onChange={(e) => setRegSpecies(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
                >
                  <option value="CATTLE">ગાય (Cattle)</option>
                  <option value="BUFFALO">ભેંસ (Buffalo)</option>
                  <option value="GOAT">બકરી (Goat)</option>
                  <option value="SHEEP">ઘેટું (Sheep)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">લિંગ (Sex) *</label>
                <select
                  required
                  value={regSex}
                  onChange={(e) => setRegSex(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
                >
                  <option value="F">માદા (Female)</option>
                  <option value="M">નર (Male)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ગામ પસંદ કરો *</label>
                <select
                  required
                  value={regVillageId}
                  onChange={(e) => setRegVillageId(e.target.value)}
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">માલિક પશુપાલક પસંદ કરો *</label>
                <select
                  required
                  value={regFarmerId}
                  onChange={(e) => setRegFarmerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
                >
                  <option value="">-- ખેડૂત પસંદ કરો --</option>
                  {farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.full_name} ({f.farmer_code || f.id.substring(0, 6)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ભારત પશુધન ૧૨-અંક કાનનો ટેગ (Tag)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={regTag}
                  onChange={(e) => setRegTag(e.target.value)}
                  placeholder="દા.ત. 100234567890"
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43] font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">અંદાજિત ઉંમર (મહિનામાં)</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={regAgeMonths}
                  onChange={(e) => setRegAgeMonths(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                FW અપ્રાપ્યતાનું કારણ (Mandatory Reason) *
              </label>
              <textarea
                required
                rows={2}
                value={regUnavailReason}
                onChange={(e) => setRegUnavailReason(e.target.value)}
                placeholder="દા.ત. ક્ષેત્રીય કાર્યકર રજા પર હોવાથી તાત્કાલિક નોંધણી જરૂરી."
                className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#135D43] resize-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsRegisterModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingReg}>
                નોંધણી સાચવો
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
