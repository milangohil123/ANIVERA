import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  voService,
  type VOVaccination,
  type VOTreatment,
} from '../../services/voService';
import {
  HeartPulse,
  RotateCcw,
  Plus,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Stethoscope,
  Edit3,
} from 'lucide-react';

export const VoVaccinationsView: React.FC = () => {
  const { apiBaseUrl, scope, hasPermission } = useAuth();
  const isVaccinator = scope?.is_approved_vaccinator || hasPermission('vaccination.record');

  const [activeTab, setActiveTab] = useState<'TREATMENTS' | 'VACCINATIONS'>('TREATMENTS');
  const [treatments, setTreatments] = useState<VOTreatment[]>([]);
  const [vaccinations, setVaccinations] = useState<VOVaccination[]>([]);
  const [villages, setVillages] = useState<Array<{ id: string; name_gu: string; name_en: string; code: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [isVaccinationModalOpen, setIsVaccinationModalOpen] = useState(false);
  const [selectedEventForCorrection, setSelectedEventForCorrection] = useState<{ id: string; type: string } | null>(null);

  // Treatment Form State
  const [animalId, setAnimalId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().substring(0, 10));
  const [treatmentText, setTreatmentText] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [medicineText, setMedicineText] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [treatmentRemarks, setTreatmentRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vaccination Form State
  const [vaxAnimalId, setVaxAnimalId] = useState('');
  const [vaxVillageId, setVaxVillageId] = useState('');
  const [vaxProgramme, setVaxProgramme] = useState('FMD');
  const [vaxDate, setVaxDate] = useState(new Date().toISOString().substring(0, 10));
  const [vaxBatch, setVaxBatch] = useState('');
  const [vaxRemarks, setVaxRemarks] = useState('');

  // Correction Form State
  const [correctionAction, setCorrectionAction] = useState<'AMEND' | 'VOID'>('VOID');
  const [correctionReason, setCorrectionReason] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const [treats, vaccs, villageList] = await Promise.all([
        voService.listTreatments(apiBaseUrl).catch(() => []),
        voService.listVaccinations(apiBaseUrl).catch(() => []),
        voService.listVillages(apiBaseUrl).catch(() => []),
      ]);
      setTreatments(treats);
      setVaccinations(vaccs);
      setVillages(villageList);
      if (villageList.length > 0 && !villageId) {
        setVillageId(villageList[0].id);
        setVaxVillageId(villageList[0].id);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'માહિતી લોડ કરવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const handleRecordTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animalId.trim() || !villageId.trim() || !treatmentText.trim()) {
      setNotice({ type: 'error', message: 'કૃપા કરીને પશુ ID, ગામ અને સારવારની વિગત ભરો.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await voService.recordTreatment(apiBaseUrl, {
        animal_id: animalId.trim(),
        village_id: villageId.trim(),
        event_date: eventDate,
        treatment_text: treatmentText.trim(),
        diagnosis_text: diagnosisText.trim() || undefined,
        medicine_text: medicineText.trim() || undefined,
        follow_up_date: followUpDate || undefined,
        remarks: treatmentRemarks.trim() || undefined,
      });

      setNotice({ type: 'success', message: 'ક્લિનિકલ સારવાર રેકોર્ડ સફળતાપૂર્વક સાચવવામાં આવ્યો.' });
      setIsTreatmentModalOpen(false);
      setTreatmentText('');
      setDiagnosisText('');
      setMedicineText('');
      setTreatmentRemarks('');
      setFollowUpDate('');
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'સારવાર નોંધવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaxAnimalId.trim() || !vaxVillageId.trim()) {
      setNotice({ type: 'error', message: 'કૃપા કરીને પશુ ID અને ગામ પસંદ કરો.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await voService.recordVaccination(apiBaseUrl, {
        animal_id: vaxAnimalId.trim(),
        village_id: vaxVillageId.trim(),
        programme_code: vaxProgramme,
        event_date: vaxDate,
        batch_number: vaxBatch.trim() || undefined,
        remarks: vaxRemarks.trim() || undefined,
      });

      setNotice({ type: 'success', message: 'રસીકરણ ઇવેન્ટ સફળતાપૂર્વક નોંધાઈ.' });
      setIsVaccinationModalOpen(false);
      setVaxBatch('');
      setVaxRemarks('');
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રસીકરણ નોંધવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForCorrection) return;
    if (!correctionReason.trim()) {
      setNotice({ type: 'error', message: 'સુધારણા અથવા રદ કરવાનું કારણ ફરજિયાત છે.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await voService.correctEvent(apiBaseUrl, selectedEventForCorrection.id, {
        action: correctionAction,
        reason: correctionReason.trim(),
      });

      setNotice({ type: 'success', message: 'ઇવેન્ટ સફળતાપૂર્વક સુધારેલ / રદ તરીકે નોંધાઈ.' });
      setSelectedEventForCorrection(null);
      setCorrectionReason('');
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ઇવેન્ટ સુધારણા નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const treatmentColumns: Column<VOTreatment>[] = [
    {
      key: 'animal',
      header: 'પશુ ID / ગામ',
      render: (row) => (
        <div>
          <div className="font-mono font-semibold text-[#1E293B]">{row.animal_id.substring(0, 8)}...</div>
          <div className="text-xs text-[#64748B] flex items-center gap-1 font-mono">
            <MapPin className="w-3 h-3" />
            {row.village_id.substring(0, 8)}...
          </div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'તારીખ',
      render: (row) => (
        <div className="text-xs text-[#1E293B] flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <span>{row.event_date}</span>
        </div>
      ),
    },
    {
      key: 'diagnosis',
      header: 'નિદાન / સારવાર',
      render: (row) => (
        <div className="text-xs text-[#1E293B] max-w-sm">
          <div className="font-medium text-emerald-800">{row.diagnosis_text || 'ક્લિનિકલ કન્સલ્ટેશન'}</div>
          <div className="text-[#64748B] truncate">{row.treatment_text}</div>
        </div>
      ),
    },
    {
      key: 'medicine',
      header: 'દવાઓ / ફોલો-અપ',
      render: (row) => (
        <div className="text-xs text-[#64748B]">
          <div>{row.medicine_text || '—'}</div>
          {row.follow_up_date && <div className="text-blue-700 font-semibold">તપાસ: {row.follow_up_date}</div>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'સુધારણા',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedEventForCorrection({ id: row.event_id, type: 'TREATMENT' })}
          leftIcon={<Edit3 className="w-3.5 h-3.5" />}
        >
          સુધારો
        </Button>
      ),
    },
  ];

  const vaccinationColumns: Column<VOVaccination>[] = [
    {
      key: 'animal',
      header: 'પશુ ID / ગામ',
      render: (row) => (
        <div>
          <div className="font-mono font-semibold text-[#1E293B]">{row.animal_id.substring(0, 8)}...</div>
          <div className="text-xs text-[#64748B] font-mono">{row.village_id.substring(0, 8)}...</div>
        </div>
      ),
    },
    {
      key: 'prog',
      header: 'રસીકરણ કાર્યક્રમ',
      render: (row) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          {row.programme_code}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'તારીખ',
      render: (row) => (
        <div className="text-xs text-[#1E293B] flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <span>{row.event_date}</span>
        </div>
      ),
    },
    {
      key: 'batch',
      header: 'બેચ નંબર',
      render: (row) => <span className="font-mono text-xs">{row.batch_number || '—'}</span>,
    },
    {
      key: 'auth',
      header: 'વેક્સિનેટર સ્કોપ',
      render: (row) => (
        <StatusChip
          variant="info"
          label={
            row.authorization_check === 'PASSED' || row.authorization_check === 'AUTHORIZED'
              ? 'અધિકૃત'
              : row.authorization_check === 'REJECTED'
              ? 'અનધિકૃત'
              : row.authorization_check
          }
        />
      ),
    },
    {
      key: 'next_due',
      header: 'આગામી નિયત તારીખ (Next Due)',
      render: (row) => (
        <div className="text-xs">
          {row.next_due_date ? (
            <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {row.next_due_date}
            </span>
          ) : (
            <span className="text-gray-400 font-mono text-[11px]">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'સુધારણા',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedEventForCorrection({ id: row.event_id, type: 'VACCINATION' })}
          leftIcon={<Edit3 className="w-3.5 h-3.5" />}
        >
          સુધારો
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-[#135D43]" />
            પશુ સારવાર અને રસીકરણ વ્યવસ્થાપન
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            ક્લિનિકલ કન્સલ્ટેશન નોંધણી, અધિકૃત રસીકરણ ઇવેન્ટ અને ઓડિટ-સુરક્ષિત સુધારણા.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            તાજું કરો
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsTreatmentModalOpen(true)}
            leftIcon={<Stethoscope className="w-4 h-4" />}
          >
            + નવી સારવાર
          </Button>
          {isVaccinator && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVaccinationModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              + રસીકરણ નોંધો
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Vaccinator Status Banner */}
      {!isVaccinator ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">રસીકરણ અધિકાર નિયંત્રણ:</div>
            <div>
              તમારા એકાઉન્ટ પાસે અલગથી માન્ય રસીકરણ અધિકાર (<span className="font-mono font-semibold">is_approved_vaccinator</span>) નથી.
              વિભાગીય નિયમ અનુસાર વેટરનરી અધિકારી માત્ર ક્લિનિકલ સારવાર નોંધી શકે છે અને ભૂલો સુધારી શકે છે. રસીકરણનું બટન સુરક્ષા હેતુથી અક્ષમ છે.
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>તમે અધિકૃત વેક્સિનેટર છો. તમે પશુ રસીકરણ ઇવેન્ટ સીધી નોંધી શકો છો.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E2E8F0] pb-2">
        <button
          onClick={() => setActiveTab('TREATMENTS')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'TREATMENTS' ? 'bg-[#135D43] text-white shadow-xs' : 'text-[#64748B] hover:bg-gray-100'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          ક્લિનિકલ સારવાર ({treatments.length})
        </button>
        <button
          onClick={() => setActiveTab('VACCINATIONS')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'VACCINATIONS' ? 'bg-[#135D43] text-white shadow-xs' : 'text-[#64748B] hover:bg-gray-100'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          રસીકરણ ઇવેન્ટ્સ ({vaccinations.length})
        </button>
      </div>

      {isLoading ? (
        <StateView state="loading" message="માહિતી લોડ થઈ રહી છે..." />
      ) : activeTab === 'TREATMENTS' ? (
        treatments.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ સારવાર નોંધાયેલ નથી"
            message="હાલમાં કોઈ ક્લિનિકલ સારવાર રેકોર્ડ ઉપલબ્ધ નથી. નવી સારવાર નોંધવા ઉપરનું બટન દબાવો."
          />
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
            <DataTable data={treatments} columns={treatmentColumns} keyExtractor={(t) => t.event_id} />
          </div>
        )
      ) : vaccinations.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ રસીકરણ ઇવેન્ટ નથી"
          message="તમારા અધિકૃત ગામડાં માટે હાલમાં કોઈ રસીકરણ રેકોર્ડ નથી."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable data={vaccinations} columns={vaccinationColumns} keyExtractor={(v) => v.event_id} />
        </div>
      )}

      {/* Record Treatment Modal */}
      <Modal isOpen={isTreatmentModalOpen} onClose={() => setIsTreatmentModalOpen(false)} title="નવી ક્લિનિકલ સારવાર નોંધો">
        <form onSubmit={handleRecordTreatment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="પશુ UUID" required>
              <input
                type="text"
                value={animalId}
                onChange={(e) => setAnimalId(e.target.value)}
                placeholder="માન્ય UUID દાખલ કરો"
                className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
              />
            </FormField>
            <FormField label="ગામ પસંદ કરો" required>
              <select
                value={villageId}
                onChange={(e) => setVillageId(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              >
                {villages.length === 0 ? (
                  <option value="">કોઈ ગામ ઉપલબ્ધ નથી</option>
                ) : (
                  villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name_gu} ({v.name_en || v.code})
                    </option>
                  ))
                )}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="સારવાર તારીખ" required>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>
            <FormField label="પૂર્વ ધારણા / રોગ નિદાન (Diagnosis)">
              <input
                type="text"
                value={diagnosisText}
                onChange={(e) => setDiagnosisText(e.target.value)}
                placeholder="દા.ત. અપચો / શરદી"
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>
          </div>

          <FormField label="આપેલ સારવારની વિગત" required>
            <textarea
              value={treatmentText}
              onChange={(e) => setTreatmentText(e.target.value)}
              rows={2}
              placeholder="આપેલ ઇન્જેક્શન, સલાહ કે પાટાપિંડી..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="સૂચવેલ દવાઓ">
              <input
                type="text"
                value={medicineText}
                onChange={(e) => setMedicineText(e.target.value)}
                placeholder="દવાનું નામ અને માત્રા"
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>
            <FormField label="પુનઃ તપાસ તારીખ (Follow-up)">
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>
          </div>

          <FormField label="વિશેષ નોંધ">
            <input
              type="text"
              value={treatmentRemarks}
              onChange={(e) => setTreatmentRemarks(e.target.value)}
              placeholder="અન્ય કોઈ નોંધ..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsTreatmentModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              સારવાર સાચવો
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Vaccination Modal (Authorised only) */}
      <Modal isOpen={isVaccinationModalOpen} onClose={() => setIsVaccinationModalOpen(false)} title="રસીકરણ ઇવેન્ટ નોંધો (અધિકૃત વેક્સિનેટર)">
        <form onSubmit={handleRecordVaccination} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="પશુ UUID" required>
              <input
                type="text"
                value={vaxAnimalId}
                onChange={(e) => setVaxAnimalId(e.target.value)}
                placeholder="પશુ UUID"
                className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
              />
            </FormField>
            <FormField label="ગામ પસંદ કરો" required>
              <select
                value={vaxVillageId}
                onChange={(e) => setVaxVillageId(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              >
                {villages.length === 0 ? (
                  <option value="">કોઈ ગામ ઉપલબ્ધ નથી</option>
                ) : (
                  villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name_gu} ({v.name_en || v.code})
                    </option>
                  ))
                )}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="રસીકરણ કાર્યક્રમ" required>
              <select
                value={vaxProgramme}
                onChange={(e) => setVaxProgramme(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              >
                <option value="FMD">FMD (ખરવા-મોવાસા)</option>
                <option value="HS">HS (ગળસૂંઠો)</option>
                <option value="BQ">BQ (ગાઠીયો તાવ)</option>
                <option value="BRUCELLOSIS">Brucellosis (બ્રુસેલોસિસ)</option>
                <option value="PPR">PPR (પીપીઆર)</option>
              </select>
            </FormField>
            <FormField label="તારીખ" required>
              <input
                type="date"
                value={vaxDate}
                onChange={(e) => setVaxDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>
          </div>

          <FormField label="બેચ નંબર (વૈકલ્પિક)">
            <input
              type="text"
              value={vaxBatch}
              onChange={(e) => setVaxBatch(e.target.value)}
              placeholder="રસી વાયલ બેચ નંબર"
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsVaccinationModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              રસીકરણ સાચવો
            </Button>
          </div>
        </form>
      </Modal>

      {/* Event Correction Modal */}
      {selectedEventForCorrection && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEventForCorrection(null)}
          title="ઇવેન્ટ સુધારણા / રદ્દીકરણ ઓડિટ"
        >
          <form onSubmit={handleCorrection} className="space-y-4">
            <div className="p-3 rounded-xl bg-gray-50 border text-xs text-gray-700">
              <span className="font-semibold">ઇવેન્ટ ID:</span>{' '}
              <span className="font-mono">{selectedEventForCorrection.id}</span>
            </div>

            <FormField label="સુધારણા પ્રકાર" required>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectionAction('VOID')}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    correctionAction === 'VOID' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-700'
                  }`}
                >
                  રદ કરો (VOID)
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectionAction('AMEND')}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    correctionAction === 'AMEND' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700'
                  }`}
                >
                  સુધારો (AMEND)
                </button>
              </div>
            </FormField>

            <FormField label="સુધારણાનું ફરજિયાત કારણ" required>
              <textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                rows={3}
                placeholder="શા માટે આ ઇવેન્ટ રદ અથવા સુધારવામાં આવી રહી છે તેનું સત્તાવાર કારણ લખો..."
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setSelectedEventForCorrection(null)}>
                રદ કરો
              </Button>
              <Button variant="danger" type="submit" isLoading={isSubmitting}>
                સુધારણા નોંધો
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

