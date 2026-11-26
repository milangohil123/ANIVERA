import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { farmerService, formatApiError, type FarmerAnimalItem } from '../../services/farmerService';
import { healthWorkflowService } from '../../services/healthWorkflowService';
import { Button } from '../../components/common/Button';
import {
  AlertCircle,
  CheckCircle2,
  HeartPulse,
  X,
  Camera,
  MapPin,
  Upload,
  Trash2,
  HelpCircle,
  AlertTriangle,
  Search,
  PawPrint,
} from 'lucide-react';

interface FarmerDiseaseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  animals: FarmerAnimalItem[];
  farmerProfile?: any;
  preselectedAnimalId?: string;
  onReportSuccess?: () => void;
  onSuccess?: () => void;
}

const COMMON_DISEASES = [
  { code: 'FMD', nameGu: 'ખરવા-મોવાસા (Foot and Mouth Disease / FMD)' },
  { code: 'HS', nameGu: 'ગળસૂંઠો (Hemorrhagic Septicemia / HS)' },
  { code: 'BQ', nameGu: 'ગાંઠિયો તાવ (Black Quarter / BQ)' },
  { code: 'LSD', nameGu: 'લમ્પી ચામડીનો રોગ (Lumpy Skin Disease / LSD)' },
  { code: 'BRUCELLA', nameGu: 'બ્રુસેલોસિસ (Brucellosis)' },
  { code: 'MASTITIS', nameGu: 'આંચળનો સોજો / મસ્ટાઇટિસ (Mastitis)' },
  { code: 'ANTHRAX', nameGu: 'એન્થ્રેક્સ (Anthrax)' },
  { code: 'PPR', nameGu: 'બકરા-ઘેટાનો તાવ (PPR - Peste des Petits Ruminants)' },
  { code: 'THEILERIOSIS', nameGu: 'થાઈલેરીયોસિસ (Theileriosis)' },
  { code: 'ENTEROTOXAEMIA', nameGu: 'આંતરડાનો તાવ / એન્ટરોટોક્સેમિયા (ET)' },
  { code: 'RABIES', nameGu: 'હડકવા (Rabies)' },
  { code: 'OTHER', nameGu: 'અન્ય રોગ (Other / Custom)' },
];

const SYMPTOM_CHECKLIST = [
  'તીવ્ર તાવ (High Fever)',
  'મોં અને ખરીમાં ચાંદા / ફોલ્લા (Lesions)',
  'મોંમાંથી સતત લાળ પડવી (Drooling)',
  'ખોરાક બંધ / અતિશય સુસ્તી (Loss of Appetite)',
  'દૂધ ઉત્પાદનમાં અચાનક ભારે ઘટાડો (Sudden Milk Drop)',
  'ચામડી પર ગાંઠો / ફોલ્લીઓ (Lumpy Nodules)',
  'ગળામાં સોજો / ઘસારો (Swelling in Throat)',
  'શ્વાસ લેવામાં તીવ્ર તકલીફ (Respiratory Distress)',
  'આંચળમાં સોજો / લાલ પડવું / લોહીવાળું દૂધ (Mastitis signs)',
  'ઝાડા / લોહીવાળા ઝાડા (Severe Diarrhea)',
  'લંગડાપણું / ઊભા ન થઈ શકવું (Lameness)',
  'આંચકી / કંપારી (Tremors / Convulsions)',
];

export const FarmerDiseaseReportModal: React.FC<FarmerDiseaseReportModalProps> = ({
  isOpen,
  onClose,
  animals,
  farmerProfile,
  preselectedAnimalId,
  onReportSuccess,
  onSuccess,
}) => {
  const { apiBaseUrl } = useAuth();

  // Mode: 'KNOWN' or 'UNKNOWN'
  const [reportMode, setReportMode] = useState<'KNOWN' | 'UNKNOWN'>('KNOWN');

  // Animal Selection
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>(preselectedAnimalId || '');
  const [animalSearchQuery, setAnimalSearchQuery] = useState<string>('');

  // Known Disease fields
  const [suspectedDiseaseCode, setSuspectedDiseaseCode] = useState<string>('FMD');
  const [customDiseaseName, setCustomDiseaseName] = useState<string>('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomOnsetDate, setSymptomOnsetDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Unknown Disease fields
  const [affectedBodyPart, setAffectedBodyPart] = useState<string>('');
  const [conditionDescription, setConditionDescription] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);

  // Common fields
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('NORMAL');
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [coords, setCoords] = useState<{ lat?: number; lng?: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredAnimals = animals.filter((a) => {
    if (!animalSearchQuery.trim()) return true;
    const q = animalSearchQuery.toLowerCase();
    return (
      (a.animal_code || '').toLowerCase().includes(q) ||
      (a.active_tag || '').toLowerCase().includes(q) ||
      (a.species_code || '').toLowerCase().includes(q)
    );
  });

  const selectedAnimal = animals.find((a) => a.id === selectedAnimalId);

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('બ્રાઉઝરમાં GPS સપોર્ટ ઉપલબ્ધ નથી.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS location capture warning:', err);
        setIsLocating(false);
        setErrorMsg('GPS સ્થાન મેળવવામાં ક્ષતિ થઈ. કૃપા કરીને લોકેશન પરવાનગી આપો.');
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (photos.length >= 5) {
        setErrorMsg('મહત્તમ ૫ ફોટા અપલોડ કરી શકાય છે.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        if (uploadEvt.target?.result) {
          setPhotos((prev) => [...prev, uploadEvt.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const animal = selectedAnimal;
    const villageId =
      animal?.village_id ||
      (animal as any)?.villageId ||
      farmerProfile?.farmer?.village_id ||
      farmerProfile?.farmer?.villageId ||
      (animals.length > 0 ? (animals[0].village_id || (animals[0] as any)?.villageId) : undefined);

    const isUnknown = reportMode === 'UNKNOWN';

    // Validations
    if (isUnknown && !conditionDescription.trim()) {
      setErrorMsg('કૃપા કરીને પશુની અજ્ઞાત સ્વાસ્થ્ય સ્થિતિનું વર્ણન દાખલ કરો.');
      return;
    }

    if (!isUnknown && selectedSymptoms.length === 0 && !generalNotes.trim()) {
      setErrorMsg('કૃપા કરીને ઓછામાં ઓછું એક લક્ષણ પસંદ કરો અથવા વિગતવાર નોંધ લખો.');
      return;
    }

    setIsSubmitting(true);

    try {
      const fullSymptoms = [...selectedSymptoms];
      if (isUnknown && affectedBodyPart.trim()) {
        fullSymptoms.push(`અસરગ્રસ્ત અંગ: ${affectedBodyPart.trim()}`);
      }

      const payload = {
        animal_id: selectedAnimalId ? selectedAnimalId.trim() : undefined,
        animal_tag_id: selectedAnimal?.active_tag || undefined,
        is_unknown_disease: isUnknown,
        suspected_disease_code: isUnknown ? 'UNKNOWN' : suspectedDiseaseCode,
        custom_disease_name:
          !isUnknown && suspectedDiseaseCode === 'OTHER'
            ? customDiseaseName.trim()
            : isUnknown
            ? affectedBodyPart.trim()
            : undefined,
        symptoms: fullSymptoms,
        symptom_onset_date: symptomOnsetDate,
        description: isUnknown
          ? `${conditionDescription.trim()} ${generalNotes ? `| નોંધ: ${generalNotes.trim()}` : ''}`
          : generalNotes.trim() || undefined,
        urgency,
        village_id: villageId,
        latitude: coords?.lat,
        longitude: coords?.lng,
        photo_urls: photos,
      };

      // Call Unified Health Workflow Service
      await healthWorkflowService.submitFarmerReport(apiBaseUrl, payload);

      setSuccessMsg(
        'રોગ / સ્વાસ્થ્ય સમસ્યાનો અહેવાલ સફળતાપૂર્વક નોંધાયો છે! તાલુકા પશુપાલન અધિકારી (TAHO) અને વેટરનરી ટીમને તાત્કાલિક સૂચના મોકલી દેવાઈ છે.'
      );

      setTimeout(() => {
        onReportSuccess?.();
        onSuccess?.();
        onClose();
      }, 1600);
    } catch (err: any) {
      const fallback = 'અહેવાલ સબમિટ કરતી વખતે ક્ષતિ આવી છે. કૃપા કરીને ફરી પ્રયાસ કરો.';
      let msg = formatApiError(err, fallback);
      if (!msg || msg.includes('[object Object]')) {
        msg = fallback;
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs font-body animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] flex items-center justify-center shadow-xs">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                પશુ સ્વાસ્થ્ય સમસ્યા / રોગ અહેવાલ
              </h3>
              <p className="text-xs text-slate-500">
                અહેવાલ સીધો તાલુકા પશુપાલન અધિકારી (TAHO), વેટરનરી ઓફિસર (VO) અને ફિલ્ડ વર્કરને પહોંચશે
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Animal Selection */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-800">
                ૧. બીમાર પશુ પસંદ કરો (Select Animal) *
              </label>
              {animals.length > 5 && (
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={animalSearchQuery}
                    onChange={(e) => setAnimalSearchQuery(e.target.value)}
                    placeholder="ટેગ કે નામ શોધો..."
                    className="w-full pl-8 pr-2 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#135D43]"
                  />
                </div>
              )}
            </div>

            <select
              value={selectedAnimalId}
              onChange={(e) => setSelectedAnimalId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 font-medium focus:ring-2 focus:ring-[#135D43]"
            >
              <option value="">-- સમગ્ર ટોળા માટે / ચોક્કસ પશુ વગર --</option>
              {filteredAnimals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.animal_code || a.id.slice(0, 8)} ({a.species_code} - {a.sex === 'F' ? 'માદા' : 'નર'}) {a.active_tag ? `| ટેગ: ${a.active_tag}` : ''}
                </option>
              ))}
            </select>

            {selectedAnimal && (
              <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#E6F3EF] text-[#135D43] flex items-center justify-center font-bold">
                  <PawPrint className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{selectedAnimal.animal_code || selectedAnimal.species_code}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                      ટેગ: {selectedAnimal.active_tag || 'ટેગ નથી'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    જાતિ: {selectedAnimal.species_code} • લિંગ: {selectedAnimal.sex === 'F' ? 'માદા (Female)' : 'નર (Male)'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2. Mode Selector: Known Disease vs Unknown Problem */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800">
              ૨. રોગની ઓળખ સ્થિતિ (Condition Diagnosis Knowledge) *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportMode('KNOWN')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  reportMode === 'KNOWN'
                    ? 'bg-[#E6F3EF] text-[#135D43] border-[#135D43] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <HeartPulse className="w-4 h-4" />
                <span>મને શંકાસ્પદ રોગ ખબર છે</span>
              </button>
              <button
                type="button"
                onClick={() => setReportMode('UNKNOWN')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  reportMode === 'UNKNOWN'
                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>અજ્ઞાત સ્વાસ્થ્ય સમસ્યા</span>
              </button>
            </div>
          </div>

          {/* MODE A: KNOWN DISEASE */}
          {reportMode === 'KNOWN' && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    શંકાસ્પદ રોગ પસંદ કરો *
                  </label>
                  <select
                    value={suspectedDiseaseCode}
                    onChange={(e) => setSuspectedDiseaseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  >
                    {COMMON_DISEASES.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.nameGu}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    લક્ષણો શરૂ થયા તારીખ *
                  </label>
                  <input
                    type="date"
                    required
                    value={symptomOnsetDate}
                    onChange={(e) => setSymptomOnsetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>
              </div>

              {suspectedDiseaseCode === 'OTHER' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    અન્ય રોગનું નામ દાખલ કરો *
                  </label>
                  <input
                    type="text"
                    required
                    value={customDiseaseName}
                    onChange={(e) => setCustomDiseaseName(e.target.value)}
                    placeholder="દા.ત. શરદી, આફરો, ચામડી પર ખંજવાળ..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>
              )}

              {/* Symptoms Checklist */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  જોવા મળેલા મુખ્ય લક્ષણો (Check all applicable)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                  {SYMPTOM_CHECKLIST.map((sym) => {
                    const isChecked = selectedSymptoms.includes(sym);
                    return (
                      <label
                        key={sym}
                        className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-[#E6F3EF] text-[#135D43] font-medium' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSymptom(sym)}
                          className="mt-0.5 rounded text-[#135D43] focus:ring-[#135D43]"
                        />
                        <span className="text-[11px] leading-tight">{sym}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MODE B: UNKNOWN DISEASE WITH PHOTOS */}
          {reportMode === 'UNKNOWN' && (
            <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>અજ્ઞાત સ્વાસ્થ્ય સ્થિતિ વિગતો અને ફોટો જોડાણ</span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  અસરગ્રસ્ત શારીરિક ભાગ / અંગ (Affected Body Area)
                </label>
                <input
                  type="text"
                  value={affectedBodyPart}
                  onChange={(e) => setAffectedBodyPart(e.target.value)}
                  placeholder="દા.ત. ડાબો પગ, મોંની આજુબાજુ, આંચળ, પીઠ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  સ્વાસ્થ્ય સમસ્યાનું વિગતવાર વર્ણન (Detailed Condition Description) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={conditionDescription}
                  onChange={(e) => setConditionDescription(e.target.value)}
                  placeholder="પશુ કેવું વર્તન કરે છે, ક્યારથી તકલીફ છે, શું ખાય છે, અન્ય કોઈ અસામાન્ય લક્ષણ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              {/* Photo Upload / Camera Capture */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  પશુના લક્ષણો / અસરગ્રસ્ત ભાગના ફોટા (Photos / Camera Capture)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-dashed border-amber-300 text-amber-900 hover:bg-amber-100/50 cursor-pointer font-medium text-xs transition-colors">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span>ફોટો લો / અપલોડ કરો</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-slate-500">મહત્તમ ૫ ફોટા (JPG, PNG)</span>
                </div>

                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photos.map((p, idx) => (
                      <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
                        <img src={p} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Urgency & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                ૩. જરૂરીયાત / તાત્કાલિકતા સ્તર (Urgency) *
              </label>
              <div className="flex gap-2">
                {[
                  { key: 'NORMAL', label: 'સામાન્ય (Normal)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { key: 'URGENT', label: 'જરૂરી (Urgent)', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                  { key: 'EMERGENCY', label: 'ઇમરજન્સી (Emergency)', color: 'text-red-700 bg-red-50 border-red-200' },
                ].map((u) => (
                  <button
                    key={u.key}
                    type="button"
                    onClick={() => setUrgency(u.key as any)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-[11px] font-bold text-center transition-all ${
                      urgency === u.key
                        ? `${u.color} ring-2 ring-[#135D43]`
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                ૪. GPS સ્થળ માહિતી (GPS Coordinates)
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCaptureLocation}
                  isLoading={isLocating}
                  className="text-xs"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1 text-[#135D43]" />
                  {coords ? 'સ્થાન અપડેટ કરો' : 'વર્તમાન GPS મેળવો'}
                </Button>
                {coords && (
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                    {coords.lat}, {coords.lng}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4. General Notes */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              વધારાની વિગત / સ્થાનિક ઓળખ (Optional Notes)
            </label>
            <input
              type="text"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="વાડાનું સરનામું, નજીકની નિશાની અથવા ખેડૂત સંપર્ક બાબત..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-[#135D43]"
            />
          </div>

          {/* Footer CTAs */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
              રદ કરો
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              અહેવાલ મોકલો (Submit Report)
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
