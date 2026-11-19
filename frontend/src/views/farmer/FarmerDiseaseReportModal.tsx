
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { farmerService, formatApiError, type FarmerAnimalItem } from '../../services/farmerService';
import { Button } from '../../components/common/Button';
import { AlertCircle, CheckCircle2, HeartPulse, X } from 'lucide-react';

interface FarmerDiseaseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  animals: FarmerAnimalItem[];
  farmerProfile?: any;
  onReportSuccess?: () => void;
  onSuccess?: () => void;
}

export const FarmerDiseaseReportModal: React.FC<FarmerDiseaseReportModalProps> = ({
  isOpen,
  onClose,
  animals,
  farmerProfile,
  onReportSuccess,
  onSuccess,
}) => {
  const { apiBaseUrl } = useAuth();

  const [selectedAnimalId, setSelectedAnimalId] = useState<string>('');
  const [primarySymptom, setPrimarySymptom] = useState<string>('');
  const [symptomOnsetDate, setSymptomOnsetDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [affectedCount, setAffectedCount] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primarySymptom.trim()) {
      setErrorMsg('કૃપા કરીને મુખ્ય લક્ષણ પસંદ કરો અથવા લખો.');
      return;
    }

    const animal = animals.find((a) => a.id === selectedAnimalId);
    const villageId =
      animal?.village_id ||
      (animal as any)?.villageId ||
      farmerProfile?.farmer?.village_id ||
      farmerProfile?.farmer?.villageId ||
      (animals.length > 0 ? (animals[0].village_id || (animals[0] as any)?.villageId) : '') ||
      '';

    const farmerId =
      animal?.farmer_id ||
      (animal as any)?.farmerId ||
      farmerProfile?.farmer?.id ||
      (animals.length > 0 ? (animals[0].farmer_id || (animals[0] as any)?.farmerId) : '') ||
      undefined;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await farmerService.reportDisease(apiBaseUrl, {
        animal_id: selectedAnimalId ? selectedAnimalId.trim() : undefined,
        farmer_id: farmerId,
        village_id: villageId || undefined,
        primary_symptom: primarySymptom.trim(),
        symptom_onset_date: symptomOnsetDate,
        affected_count: affectedCount,
        notes: notes.trim() || undefined,
      });

      setSuccessMsg('રોગ અહેવાલ સફળતાપૂર્વક નોંધાયો છે. પશુ ચિકિત્સકને તાત્કાલિક સૂચના મોકલી દેવાઈ છે.');
      setTimeout(() => {
        onReportSuccess?.();
        onSuccess?.();
        onClose();
      }, 1800);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-body">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-[#E2E8F0] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#991B1B] flex items-center justify-center">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                પશુ રોગ અહેવાલ / સહાય વિનંતી
              </h3>
              <p className="text-[11px] text-[#64748B]">
                અહેવાલ સીધો વેટરનરી ઓફિસર અને ક્ષેત્રીય કાર્યકર સુધી પહોંચશે
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748B] hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#065F46] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-[#1E293B] mb-1">
              બીમાર પશુ પસંદ કરો (વૈકલ્પિક)
            </label>
            <select
              value={selectedAnimalId}
              onChange={(e) => setSelectedAnimalId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
            >
              <option value="">-- સમગ્ર ટોળા માટે અથવા ચોક્કસ પશુ વગર --</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.animal_code || a.id.slice(0, 8)} ({a.species_code} - {a.sex === 'F' ? 'માદા' : 'નર'}) {a.active_tag ? `| ટેગ: ${a.active_tag}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#1E293B] mb-1">
              મુખ્ય લક્ષણ (Primary Symptom) *
            </label>
            <select
              value={primarySymptom}
              onChange={(e) => setPrimarySymptom(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
            >
              <option value="">-- મુખ્ય લક્ષણ પસંદ કરો --</option>
              <option value="તીવ્ર તાવ (High Fever)">તીવ્ર તાવ (High Fever)</option>
              <option value="મોં અને ખરીમાં ચાંદા (Mouth & Foot Lesions / FMD)">મોં અને ખરીમાં ચાંદા (Mouth & Foot Lesions / FMD)</option>
              <option value="ચામડી પર ગાંઠો (Lumpy Skin Nodules)">ચામડી પર ગાંઠો (Lumpy Skin Nodules)</option>
              <option value="ગળામાં સોજો અને શ્વાસ લેવામાં તકલીફ (HS)">ગળામાં સોજો અને શ્વાસ લેવામાં તકલીફ (HS)</option>
              <option value="ખોરાક બંધ / સુસ્તી (Loss of Appetite)">ખોરાક બંધ / સુસ્તી (Loss of Appetite)</option>
              <option value="દૂધ ઉત્પાદનમાં અચાનક ઘટાડો (Sudden Milk Drop)">દૂધ ઉત્પાદનમાં અચાનક ઘટાડો (Sudden Milk Drop)</option>
              <option value="અન્ય લક્ષણ (Other Symptoms)">અન્ય લક્ષણ (Other Symptoms)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#1E293B] mb-1">
                લક્ષણ શરૂ થયા તારીખ *
              </label>
              <input
                type="date"
                required
                value={symptomOnsetDate}
                onChange={(e) => setSymptomOnsetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1E293B] mb-1">
                અસરગ્રસ્ત પશુ સંખ્યા
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={affectedCount}
                onChange={(e) => setAffectedCount(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#1E293B] mb-1">
              વધારાની વિગત / સ્થિતિ વર્ણન (Notes)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="પશુની સ્થિતિ, સ્થળ અથવા વિશેષ સહાયની જરૂરિયાત લખો..."
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
            />
          </div>

          <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl text-[11px] text-[#166534]">
            <strong>નોંધ:</strong> સામાન્ય પશુપાલન સહાય/માર્ગદર્શન સેવાની અલગ સિસ્ટમ ઉપલબ્ધ નથી; કોઈપણ આરોગ્ય કે સારવાર વિનંતી આ રોગ અહેવાલ મોડ્યુલ દ્વારા જ નોંધાય છે.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
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
