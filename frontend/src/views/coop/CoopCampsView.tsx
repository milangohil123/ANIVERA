import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  coopService,
  type CoopCampItem,
  type CoopVillageProgressItem,
} from '../../services/coopService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  PlusCircle,
  Users,
  X,
} from 'lucide-react';

export const CoopCampsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [camps, setCamps] = useState<CoopCampItem[]>([]);
  const [villages, setVillages] = useState<CoopVillageProgressItem[]>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name_gu: string; name_en: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [campaignId, setCampaignId] = useState<string>('');
  const [villageId, setVillageId] = useState<string>('');
  const [plannedStart, setPlannedStart] = useState<string>('');
  const [plannedEnd, setPlannedEnd] = useState<string>('');
  const [locationText, setLocationText] = useState<string>('');
  const [expectedFarmers, setExpectedFarmers] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [cmps, vils, campsList] = await Promise.all([
        coopService.listCamps(apiBaseUrl),
        coopService.getServedVillagesProgress(apiBaseUrl),
        coopService.listActiveCampaigns(apiBaseUrl),
      ]);
      setCamps(cmps);
      setVillages(vils);
      setCampaigns(campsList);
      if (vils.length > 0) setVillageId(vils[0].village_id);
      if (campsList.length > 0) setCampaignId(campsList[0].id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !villageId || !plannedStart || !plannedEnd) {
      setFormError('બધી ફરજિયાત વિગતો ભરો.');
      return;
    }

    if (new Date(plannedEnd) <= new Date(plannedStart)) {
      setFormError('સમાપ્તિ સમય શરૂઆતના સમય પછીનો હોવો જોઈએ.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await coopService.proposeCamp(apiBaseUrl, {
        campaign_id: campaignId,
        village_id: villageId,
        planned_start: new Date(plannedStart).toISOString(),
        planned_end: new Date(plannedEnd).toISOString(),
        location_text: locationText.trim() || undefined,
        expected_farmers: expectedFarmers,
      });

      setFormSuccess('કેમ્પ દરખાસ્ત સફળતાપૂર્વક મોકલાઈ ગઈ છે. વેટરનરી ઓફિસર દ્વારા મંજૂરી અપાશે.');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
        loadData();
      }, 1800);
    } catch (err: any) {
      setFormError(err?.message || 'દરખાસ્ત મોકલવામાં નિષ્ફળ. ફરી પ્રયાસ કરો.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (iso?: string | null): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10 font-body">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/coop/overview')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          ડેશબોર્ડ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[#135D43]" />
          પશુ ચિકિત્સા કેમ્પ સંકલન (Camp Coordination)
        </h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          નવો કેમ્પ
        </Button>
      </div>

      {/* Cross-Village Restriction Alert */}
      <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl text-xs text-[#92400E] flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
        <div>
          <strong className="block text-[#92400E]">કાર્યક્ષેત્ર સીમા (Cross-Village Boundary):</strong>
          ક્રોસ-વિલેજ દરખાસ્તો અસમર્થિત છે (UNRESOLVED). સહકારી મંડળી ફક્ત તેના ફાળવાયેલ સિંગલ-સ્કોપ ગામ પૂરતી જ દરખાસ્ત કરી શકે છે. અન્ય ગામોમાં કેમ્પ પ્રસ્તાવ સિસ્ટમ દ્વારા આપમેળે બ્લોક થશે.
        </div>
      </div>

      {/* Camps Card */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">
              આયોજિત કેમ્પ યાદી ({camps.length})
            </h3>
            <span className="text-[11px] text-[#64748B]">સહકારી કેમ્પ</span>
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={loadData} />
        ) : camps.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ માહિતી નથી"
            message="હાલમાં કોઈ પશુ કેમ્પ આયોજિત નથી. નવો કેમ્પ દરખાસ્ત કરવા ઉપરના બટનનો ઉપયોગ કરો."
          />
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {camps.map((camp) => (
              <div
                key={camp.id}
                className="py-3 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#1E293B]">
                      {camp.location_text || 'પશુ ચિકિત્સા કેમ્પ'}
                    </span>
                    <StatusChip
                      status={
                        camp.status === 'CONFIRMED'
                          ? 'SUCCESS'
                          : camp.status === 'CANCELLED'
                            ? 'DANGER'
                            : 'WARNING'
                      }
                      text={
                        camp.status === 'CONFIRMED'
                          ? 'મંજૂર (Confirmed)'
                          : camp.status === 'CANCELLED'
                            ? 'રદ થયેલ (Cancelled)'
                            : 'પ્રસ્તાવિત (Proposed)'
                      }
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#135D43]" />
                      {formatDate(camp.planned_start)} થી {formatDate(camp.planned_end)}
                    </span>
                    {camp.expected_farmers && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> અંદાજિત ખેડૂતો: {camp.expected_farmers}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] text-[#64748B]">
                  આયોજક: <span className="font-semibold text-[#1E293B]">{camp.organizer_type}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Propose Camp Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-body">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-[#E2E8F0] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#D5F0E4] text-[#135D43] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                  નવો પશુ ચિકિત્સા કેમ્પ પ્રસ્તાવ
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#065F46] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleProposeSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#1E293B] mb-1">
                  અભિયાન પસંદ કરો (Campaign) *
                </label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
                >
                  <option value="">-- અભિયાન પસંદ કરો --</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_gu || c.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1E293B] mb-1">
                  કાર્યક્ષેત્ર ગામ પસંદ કરો (ફક્ત મંડળીના ગામ) *
                </label>
                <select
                  value={villageId}
                  onChange={(e) => setVillageId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
                >
                  <option value="">-- ગામ પસંદ કરો --</option>
                  {villages.map((v) => (
                    <option key={v.village_id} value={v.village_id}>
                      {v.village_name} ({v.village_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1E293B] mb-1">
                    શરૂઆત સમય *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={plannedStart}
                    onChange={(e) => setPlannedStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1E293B] mb-1">
                    સમાપ્તિ સમય *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={plannedEnd}
                    onChange={(e) => setPlannedEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1E293B] mb-1">
                  કેમ્પ સ્થળ વર્ણન (Location Text)
                </label>
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="દા.ત. દૂધ મંડળી ચોક, પંચાયત ભવન પાસે"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1E293B] mb-1">
                  અપેક્ષિત પશુપાલક સંખ્યા (Expected Farmers)
                </label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={expectedFarmers}
                  onChange={(e) => setExpectedFarmers(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  રદ કરો
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  દરખાસ્ત સબમિટ કરો
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

