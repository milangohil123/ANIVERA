import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  fwService,
  type FWAnimalItem,
  type FWCampOption,
  type FWCampaignOption,
  type FWVaccinationItem,
  type FWVillageItem,
} from '../../services/fwService';
import {
  HeartPulse,
  RotateCcw,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Stethoscope,
} from 'lucide-react';

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય',
  BUFFALO: 'ભેંસ',
  GOAT: 'બકરી',
  SHEEP: 'ઘેટું',
  OTHER: 'અન્ય',
};

export const FwVaccinationsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const preloadedAnimal = (location.state as any)?.preloadedAnimal;

  const preselectedAnimalId = searchParams.get('animal_id');
  const paramVillageId = searchParams.get('village_id');

  const { apiBaseUrl, scope, hasPermission, deviceInfo } = useAuth();
  const isVaccinator = Boolean(scope?.is_approved_vaccinator || hasPermission('vaccination.record'));

  const [villages, setVillages] = useState<FWVillageItem[]>([]);
  const [activeVillageId, setActiveVillageId] = useState<string>(() => {
    return preloadedAnimal?.village_id || paramVillageId || localStorage.getItem('fw_active_village_id') || '';
  });

  const [animals, setAnimals] = useState<FWAnimalItem[]>(() => {
    if (preloadedAnimal) {
      return [
        {
          id: preloadedAnimal.id,
          animal_code: preloadedAnimal.animal_code,
          species_code: preloadedAnimal.species_code,
          sex: preloadedAnimal.sex || 'F',
          farmer_id: preloadedAnimal.farmer_id || '',
          village_id: preloadedAnimal.village_id || '',
          registration_status: preloadedAnimal.registration_status || 'VERIFIED',
          status: 'ACTIVE',
          created_at: '',
        },
      ];
    }
    return [];
  });
  const [vaccinations, setVaccinations] = useState<FWVaccinationItem[]>([]);
  const [campaigns, setCampaigns] = useState<FWCampaignOption[]>([]);
  const [camps, setCamps] = useState<FWCampOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isVaxModalOpen, setIsVaxModalOpen] = useState(() => Boolean(preselectedAnimalId || preloadedAnimal));
  const [isTreatModalOpen, setIsTreatModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vaccination Form State
  const [vaxAnimalId, setVaxAnimalId] = useState(() => preloadedAnimal?.id || preselectedAnimalId || '');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedCampId, setSelectedCampId] = useState('');
  const [programmeCode, setProgrammeCode] = useState('FMD');
  const [vaxDate, setVaxDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [batchNumber, setBatchNumber] = useState('');
  const [vaxRemarks, setVaxRemarks] = useState('');

  // Treatment Form State
  const [treatAnimalId, setTreatAnimalId] = useState(() => preloadedAnimal?.id || preselectedAnimalId || '');
  const [treatDate, setTreatDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [treatmentText, setTreatmentText] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [medicineText, setMedicineText] = useState('');

  useEffect(() => {
    if (preselectedAnimalId || preloadedAnimal) {
      setIsVaxModalOpen(true);
      if (preloadedAnimal?.id || preselectedAnimalId) {
        setVaxAnimalId(preloadedAnimal?.id || preselectedAnimalId);
        setTreatAnimalId(preloadedAnimal?.id || preselectedAnimalId);
      }
      if (preloadedAnimal?.village_id || paramVillageId) {
        setActiveVillageId(preloadedAnimal?.village_id || paramVillageId);
      }
    }
  }, [preselectedAnimalId, preloadedAnimal, paramVillageId]);

  // Load Villages & Animals
  useEffect(() => {
    let isMounted = true;
    const fetchVillages = async () => {
      try {
        const list = await fwService.listAssignedVillages(apiBaseUrl);
        if (isMounted) {
          setVillages(list);
          if (list.length > 0) {
            const saved = localStorage.getItem('fw_active_village_id');
            const valid = list.some((v) => v.id === saved);
            const chosen = valid && saved ? saved : list[0].id;
            setActiveVillageId(chosen);
            localStorage.setItem('fw_active_village_id', chosen);
          }
        }
      } catch (e) {
        console.warn('Failed to load villages in VaccinationsView:', e);
      }
    };
    fetchVillages();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // Load Animals, Vaccinations, Campaigns & Camps
  const loadData = async () => {
    if (!activeVillageId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotice(null);
    try {
      const [animList, vaxList, campns, campList] = await Promise.all([
        fwService.listAnimals(apiBaseUrl, activeVillageId),
        fwService.listVaccinations(apiBaseUrl),
        fwService.listActiveCampaigns(apiBaseUrl).catch(() => []),
        fwService.listVillageCamps(apiBaseUrl, activeVillageId).catch(() => []),
      ]);
      setAnimals((prev) => {
        const existing = new Set(animList.map((a) => a.id));
        const preserved = prev.filter((p) => !existing.has(p.id));
        return [...animList, ...preserved];
      });
      setVaccinations(vaxList);
      setCampaigns(campns);
      setCamps(campList);
      if (animList.length > 0 && !vaxAnimalId) {
        setVaxAnimalId(animList[0].id);
        setTreatAnimalId(animList[0].id);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeVillageId, apiBaseUrl]);

  // Handle Vaccination Record
  const handleRecordVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaxAnimalId) {
      setNotice({ type: 'error', message: 'કૃપા કરીને પશુ પસંદ કરો.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fwService.recordVaccination(
        apiBaseUrl,
        {
          animal_id: vaxAnimalId,
          village_id: activeVillageId,
          programme_code: programmeCode,
          event_date: vaxDate,
          batch_number: batchNumber.trim() || undefined,
          remarks: vaxRemarks.trim() || undefined,
          campaign_id: selectedCampaignId || undefined,
          camp_id: selectedCampId || undefined,
        },
        deviceInfo
      );

      if (res.isOffline) {
        setNotice({
          type: 'success',
          message: `રસીકરણ ઑફલાઇન કતારમાં નોંધાયું (ઇવેન્ટ ID: ${res.eventId}). નેટવર્ક મળતા આપમેળે સિંક થશે.`,
        });
      } else {
        setNotice({ type: 'success', message: 'રસીકરણ ઇવેન્ટ સફળતાપૂર્વક નોંધાઈ.' });
      }

      setIsVaxModalOpen(false);
      setBatchNumber('');
      setVaxRemarks('');
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રસીકરણ નોંધણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Clinical Treatment Record
  const handleRecordTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatAnimalId || !treatmentText.trim()) {
      setNotice({ type: 'error', message: 'કૃપા કરીને પશુ અને આપેલ સારવારની વિગત ભરો.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fwService.recordTreatment(
        apiBaseUrl,
        {
          animal_id: treatAnimalId,
          village_id: activeVillageId,
          event_date: treatDate,
          treatment_text: treatmentText.trim(),
          diagnosis_text: diagnosisText.trim() || undefined,
          medicine_text: medicineText.trim() || undefined,
        },
        deviceInfo
      );

      if (res.isOffline) {
        setNotice({
          type: 'success',
          message: `સારવાર ઑફલાઇન કતારમાં નોંધાઈ (ઇવેન્ટ ID: ${res.eventId}).`,
        });
      } else {
        setNotice({ type: 'success', message: 'સારવાર રેકોર્ડ સફળતાપૂર્વક સાચવવામાં આવ્યો.' });
      }

      setIsTreatModalOpen(false);
      setTreatmentText('');
      setDiagnosisText('');
      setMedicineText('');
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'સારવાર નોંધણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-4 pb-10 font-body text-[#172033]">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button variant="outline" size="sm" onClick={() => navigate('/fw/home')} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
          હોમ
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            તાજું કરો
          </Button>
          {isVaccinator && (
            <Button
              variant="primary"
              size="sm"
              disabled={animals.length === 0}
              onClick={() => setIsVaxModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              + રસીકરણ નોંધો
            </Button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-[#135D43]" />
            રસીકરણ અને ક્લિનિકલ ઇવેન્ટ્સ
          </h2>
          <div className="text-xs text-[#64748B] mt-1 flex items-center gap-2">
            <span>કાર્યક્ષેત્ર:</span>
            {villages.length === 0 ? (
              <span className="font-semibold text-red-600">ગામ સોંપણી નથી</span>
            ) : villages.length === 1 ? (
              <span className="font-bold text-[#135D43] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {villages[0].name_gu} ({villages[0].code})
              </span>
            ) : (
              <select
                value={activeVillageId}
                onChange={(e) => {
                  setActiveVillageId(e.target.value);
                  localStorage.setItem('fw_active_village_id', e.target.value);
                }}
                className="px-2 py-1 text-xs border rounded-md font-semibold text-[#135D43] bg-emerald-50"
              >
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name_gu} ({v.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isVaccinator ? (
          <StatusChip
            variant="success"
            label="અધિકૃત રસીકરણકર્તા"
            icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />}
          />
        ) : (
          <StatusChip
            variant="warning"
            label="રસીકરણ સત્તા નથી"
            icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-700" />}
          />
        )}
      </div>

      {/* Honest Alert if No Village Assigned */}
      {villages.length === 0 && !isLoading && (
        <Card noPadding className="p-4 bg-red-50/70 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-900 leading-relaxed">
              <p className="font-bold text-red-800">ગામ સોંપણી ગેરહાજર:</p>
              <p className="mt-0.5">
                તમને હાલમાં કોઈ ગામની સોંપણી કરવામાં આવી નથી. કૃપા કરીને અધિકૃત અધિકારીનો સંપર્ક કરો.
              </p>
            </div>
          </div>
        </Card>
      )}

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
            }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Vaccinator Authorization Banner */}
      {villages.length === 0 ? null : !isVaccinator ? (
        <Card noPadding className="p-4 bg-amber-50/60 border-amber-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-bold">રસીકરણ નોંધણી પરવાનગી નથી:</p>
              <p className="mt-1">
                સરકારી નીતિ અનુસાર માત્ર અલગથી અધિકૃત થયેલા રસીકરણકર્તાઓ (Authorised Vaccinators) જ રસીકરણ ઇવેન્ટ્સ નોંધી શકે છે. ક્ષેત્રીય કાર્યકર હોવા માત્રથી રસીકરણ સત્તા આપોઆપ મળતી નથી.
              </p>
              <p className="mt-1 text-amber-800">
                તમે પશુની ક્લિનિકલ સારવાર કે પ્રાથમિક અવલોકન નોંધી શકો છો, પરંતુ રસીકરણ માટે વેટરનરી ઓફિસર (VO) નો સંપર્ક કરવો.
              </p>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setIsTreatModalOpen(true)} leftIcon={<Stethoscope className="w-3.5 h-3.5" />}>
                  + સારવાર / અવલોકન નોંધો
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsVaxModalOpen(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            + રસીકરણ નોંધો
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTreatModalOpen(true)} leftIcon={<Stethoscope className="w-3.5 h-3.5" />}>
            + સારવાર નોંધો
          </Button>
        </div>
      )}

      {/* Recent Vaccinations Feed */}
      <Card noPadding className="p-4">
        <h3 className="text-xs font-bold text-[#1E293B] mb-3">તાજેતરની રસીકરણ ઇવેન્ટ્સ</h3>
        {isLoading ? (
          <StateView state="loading" message="માહિતી લોડ થઈ રહી છે..." />
        ) : vaccinations.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ રસીકરણ ઇવેન્ટ નથી"
            message="આ ગામમાં હાલમાં કોઈ રસીકરણ નોંધાયેલ નથી."
          />
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {vaccinations.map((v) => (
              <div key={v.event_id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-[#1E293B] font-mono">{v.programme_code}</span>
                  <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{v.event_date}</span>
                    {v.batch_number && <span>• બેચ: {v.batch_number}</span>}
                  </div>
                </div>
                <StatusChip variant="success" label="નોંધાયેલ" size="sm" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Record Vaccination Modal */}
      <Modal isOpen={isVaxModalOpen} onClose={() => setIsVaxModalOpen(false)} title="નવી રસીકરણ ઇવેન્ટ નોંધો">
        <form onSubmit={handleRecordVaccination} className="space-y-4 text-xs">
          <FormField label="પશુ પસંદ કરો" required>
            <select
              value={vaxAnimalId}
              onChange={(e) => setVaxAnimalId(e.target.value)}
              className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
            >
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.animal_code || a.id.substring(0, 8)} ({SPECIES_NAMES_GU[a.species_code] || a.species_code})
                </option>
              ))}
            </select>
          </FormField>

          {/* Campaign Selection */}
          <FormField label="રસીકરણ ઝુંબેશ">
            <select
              value={selectedCampaignId}
              onChange={(e) => {
                setSelectedCampaignId(e.target.value);
                setSelectedCampId('');
              }}
              className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
            >
              <option value="">-- નિયમિત રસીકરણ (ઝુંબેશ સિવાય) --</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.code}] {c.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#64748B] mt-0.5">
              નોંધ: જો રસીકરણ ચાલુ ઝુંબેશ હેઠળ આપેલ હોય તો યોગ્ય ઝુંબેશ પસંદ કરો
            </p>
          </FormField>

          {/* Veterinary Camp Selection */}
          <FormField label="પશુ આરોગ્ય કેમ્પ">
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
            >
              <option value="">-- કેમ્પ સિવાય / ઘેર-ઘેર (ડોરસ્ટેપ) --</option>
              {camps
                .filter((cp) => !selectedCampaignId || cp.campaign_id === selectedCampaignId)
                .map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.camp_code} ({cp.planned_start.substring(0, 10)})
                  </option>
                ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="રસીકરણ કાર્યક્રમ" required>
              <select
                value={programmeCode}
                onChange={(e) => setProgrammeCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              >
                <option value="FMD">FMD (ખરવા-મોવાસા)</option>
                <option value="HS">HS (ગળસૂંઠો)</option>
                <option value="BQ">BQ (ગાઠીયો તાવ)</option>
                <option value="BRUCELLOSIS">Brucellosis (બ્રુસેલોસિસ)</option>
                <option value="PPR">PPR (પીપીઆર)</option>
              </select>
            </FormField>

            <FormField label="રસીકરણ તારીખ" required>
              <input
                type="date"
                value={vaxDate}
                onChange={(e) => setVaxDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>
          </div>

          <FormField label="રસી બેચ નંબર (વૈકલ્પિક)">
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="દા.ત. BATCH-2026-04 (વૈકલ્પિક)"
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
            />
            <p className="text-[10px] text-[#64748B] mt-1">
              નોંધ: પ્રોજેક્ટ નિયમ મુજબ બેચ નંબર વૈકલ્પિક છે. ન હોય તો ખાલી રાખી શકો છો.
            </p>
          </FormField>

          <FormField label="વિશેષ નોંધ (વૈકલ્પિક)">
            <input
              type="text"
              value={vaxRemarks}
              onChange={(e) => setVaxRemarks(e.target.value)}
              placeholder="અન્ય કોઈ નોંધ..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsVaxModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              રસીકરણ સાચવો
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Treatment Modal */}
      <Modal isOpen={isTreatModalOpen} onClose={() => setIsTreatModalOpen(false)} title="ક્લિનિકલ સારવાર / અવલોકન નોંધો">
        <form onSubmit={handleRecordTreatment} className="space-y-4 text-xs">
          <FormField label="પશુ પસંદ કરો" required>
            <select
              value={treatAnimalId}
              onChange={(e) => setTreatAnimalId(e.target.value)}
              className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
            >
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.animal_code || a.id.substring(0, 8)} ({SPECIES_NAMES_GU[a.species_code] || a.species_code})
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="તારીખ" required>
              <input
                type="date"
                value={treatDate}
                onChange={(e) => setTreatDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>

            <FormField label="નિદાન / લક્ષણ">
              <input
                type="text"
                value={diagnosisText}
                onChange={(e) => setDiagnosisText(e.target.value)}
                placeholder="દા.ત. સામાન્ય તાવ"
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>
          </div>

          <FormField label="આપેલ પ્રાથમિક સારવાર / અવલોકન" required>
            <textarea
              value={treatmentText}
              onChange={(e) => setTreatmentText(e.target.value)}
              rows={2}
              placeholder="સારવાર અથવા સ્થિતિનું વર્ણન..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <FormField label="દવાઓ (જો આપેલ હોય)">
            <input
              type="text"
              value={medicineText}
              onChange={(e) => setMedicineText(e.target.value)}
              placeholder="દવાનું નામ..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsTreatModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              સારવાર સાચવો
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

