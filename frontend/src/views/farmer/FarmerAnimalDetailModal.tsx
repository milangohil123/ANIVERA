import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  farmerService,
  type FarmerAnimalItem,
  type FarmerVaccinationEvent,
  type FarmerTreatmentEvent,
  type FarmerTransferItem,
} from '../../services/farmerService';
import { healthWorkflowService, type AnimalTimelineEventItem } from '../../services/healthWorkflowService';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { Button } from '../../components/common/Button';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Syringe,
  Stethoscope,
  HeartPulse,
  UserCheck,
  ShieldCheck,
  Bell,
  Calendar,
} from 'lucide-react';

interface FarmerAnimalDetailModalProps {
  animal: FarmerAnimalItem | null;
  isOpen?: boolean;
  onClose: () => void;
}

export const FarmerAnimalDetailModal: React.FC<FarmerAnimalDetailModalProps> = ({
  animal,
  isOpen,
  onClose,
}) => {
  const { apiBaseUrl } = useAuth();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TIMELINE' | 'VACCINATIONS' | 'TREATMENTS' | 'TRANSFERS'>('OVERVIEW');
  const [vaccinations, setVaccinations] = useState<FarmerVaccinationEvent[]>([]);
  const [treatments, setTreatments] = useState<FarmerTreatmentEvent[]>([]);
  const [transfers, setTransfers] = useState<FarmerTransferItem[]>([]);
  const [timeline, setTimeline] = useState<AnimalTimelineEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!animal) return;
    let isMounted = true;

    const loadRecords = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [vacs, treats, trans, timeData] = await Promise.all([
          farmerService.getAnimalVaccinations(apiBaseUrl, animal.id).catch(() => []),
          farmerService.getAnimalTreatments(apiBaseUrl, animal.id).catch(() => []),
          farmerService.getAnimalTransfers(apiBaseUrl, animal.id).catch(() => []),
          healthWorkflowService.getAnimalTimeline(apiBaseUrl, animal.id).catch(() => null),
        ]);

        if (isMounted) {
          setVaccinations(vacs);
          setTreatments(treats);
          setTransfers(trans);
          setTimeline(timeData?.events || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadRecords();
    return () => {
      isMounted = false;
    };
  }, [animal, apiBaseUrl]);

  if (!animal || isOpen === false) return null;

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return isoString;
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'REGISTRATION':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'DISEASE_REPORT':
        return <HeartPulse className="w-4 h-4 text-red-600" />;
      case 'CASE_ASSIGNMENT':
        return <UserCheck className="w-4 h-4 text-amber-600" />;
      case 'CLINICAL_TREATMENT':
        return <Stethoscope className="w-4 h-4 text-purple-600" />;
      case 'TAHO_VERIFICATION':
        return <ShieldCheck className="w-4 h-4 text-teal-600" />;
      case 'RECURRING_SCHEDULE_ENROLLMENT':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'REMINDER_SENT_15_DAYS':
        return <Bell className="w-4 h-4 text-amber-500 animate-bounce" />;
      case 'VACCINATION_EXECUTED':
        return <Syringe className="w-4 h-4 text-emerald-600" />;
      case 'NEXT_CYCLE_SCHEDULED':
        return <Calendar className="w-4 h-4 text-indigo-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-body animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-[#E2E8F0] space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1E293B] font-heading">
                {animal.animal_code || animal.id.slice(0, 8)}
              </h3>
              <StatusChip
                status={animal.registration_status === 'VERIFIED' ? 'SUCCESS' : 'WARNING'}
                text={animal.registration_status === 'VERIFIED' ? 'ચકાસાયેલ (Verified)' : 'નોંધાયેલ (Pending)'}
              />
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              {animal.species_code} • {animal.sex === 'F' ? 'માદા (Female)' : 'નર (Male)'} • {animal.age_months_estimate ? `${animal.age_months_estimate} માસ` : 'ઉંમર અંદાજિત'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748B] hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-gray-100 rounded-xl text-[11px] sm:text-xs font-semibold">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-2 rounded-lg transition-colors ${activeTab === 'OVERVIEW' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'}`}
          >
            વિગતો
          </button>
          <button
            onClick={() => setActiveTab('TIMELINE')}
            className={`py-2 rounded-lg transition-colors ${activeTab === 'TIMELINE' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'}`}
          >
            સમયરેખા ({timeline.length})
          </button>
          <button
            onClick={() => setActiveTab('VACCINATIONS')}
            className={`py-2 rounded-lg transition-colors ${activeTab === 'VACCINATIONS' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'}`}
          >
            રસીકરણ ({vaccinations.length})
          </button>
          <button
            onClick={() => setActiveTab('TREATMENTS')}
            className={`py-2 rounded-lg transition-colors ${activeTab === 'TREATMENTS' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'}`}
          >
            સારવાર ({treatments.length})
          </button>
          <button
            onClick={() => setActiveTab('TRANSFERS')}
            className={`py-2 rounded-lg transition-colors ${activeTab === 'TRANSFERS' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'}`}
          >
            માલિકી ({transfers.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto space-y-3 py-1">
          {isLoading ? (
            <div className="py-12">
              <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
            </div>
          ) : errorMsg ? (
            <div className="py-8">
              <StateView state="error" message={errorMsg} />
            </div>
          ) : activeTab === 'OVERVIEW' ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[#64748B] block text-[11px]">ભારત પશુધન ટેગ (12-Digit Tag)</span>
                  <span className="font-mono font-bold text-sm text-[#1E293B]">
                    {animal.active_tag || 'ટેગ લાગેલ નથી'}
                  </span>
                </div>
                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[#64748B] block text-[11px]">QR ટોકન (Base32 Token)</span>
                  <span className="font-mono font-bold text-sm text-[#135D43]">
                    {animal.active_qr_token || 'ટોકન ઉપલબ્ધ નથી'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-[#64748B] block text-[10px]">જાતિ / પ્રજાતિ</span>
                  <span className="font-semibold text-[#1E293B]">{animal.species_code}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-[#64748B] block text-[10px]">લિંગ (Sex)</span>
                  <span className="font-semibold text-[#1E293B]">
                    {animal.sex === 'F' ? 'માદા (Female)' : 'નર (Male)'}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-[#64748B] block text-[10px]">નોંધણી તારીખ</span>
                  <span className="font-semibold text-[#1E293B]">{formatDate(animal.created_at)}</span>
                </div>
              </div>

              <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl text-[11px] text-[#166534]">
                <strong>સલામતી સૂચના:</strong> પશુનું QR કાર્ડ અને કાનનો ટેગ સુરક્ષિત રાખો. રસીકરણ કે સારવાર સમયે સ્ટાફને આ QR કોડ બતાવવો.
              </div>
            </div>
          ) : activeTab === 'TIMELINE' ? (
            timeline.length === 0 ? (
              <StateView
                state="empty"
                title="કોઈ સમયરેખા ઇવેન્ટ નથી"
                message="આ પશુ માટે હજુ સુધી કોઈ સમયરેખા રેકોર્ડ નથી."
              />
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timeline.map((event, idx) => (
                  <div key={event.event_id || idx} className="relative flex items-start gap-3">
                    <div className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shrink-0 shadow-2xs">
                      {getTimelineIcon(event.event_type)}
                    </div>
                    <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{event.title}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {formatDate(event.event_date)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{event.description}</p>
                      {event.actor_name && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          દ્વારા: <span className="font-medium text-slate-600">{event.actor_name}</span> ({event.actor_role})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'VACCINATIONS' ? (
            vaccinations.length === 0 ? (
              <StateView
                state="empty"
                title="કોઈ માહિતી નથી"
                message="આ પશુ માટે હજુ સુધી કોઈ રસીકરણ નોંધાયેલ નથી."
              />
            ) : (
              <div className="space-y-2">
                {vaccinations.map((v, idx) => (
                  <div
                    key={v.id || idx}
                    className="p-3 rounded-xl border border-[#E2E8F0] bg-white flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#1E293B] block">
                        {v.programme_code || v.vaccine_name || 'પશુ રસીકરણ'}
                      </span>
                      <span className="text-[#64748B] text-[11px]">
                        તારીખ: {formatDate(v.event_date)} {v.batch_number ? `• બેચ: ${v.batch_number}` : ''}
                      </span>
                    </div>
                    <StatusChip status="SUCCESS" text="સંપૂર્ણ (Done)" />
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'TREATMENTS' ? (
            treatments.length === 0 ? (
              <StateView
                state="empty"
                title="કોઈ માહિતી નથી"
                message="આ પશુ માટે હજુ સુધી કોઈ દવાખાના સારવાર નોંધાયેલ નથી."
              />
            ) : (
              <div className="space-y-2">
                {treatments.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="p-3 rounded-xl border border-[#E2E8F0] bg-white text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1E293B]">
                        {t.diagnosis_text || 'ક્લિનિકલ સારવાર'}
                      </span>
                      <span className="text-[11px] text-[#64748B]">{formatDate(t.event_date)}</span>
                    </div>
                    <p className="text-[#64748B] text-[11px]">{t.treatment_text}</p>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'TRANSFERS' ? (
            transfers.length === 0 ? (
              <StateView
                state="empty"
                title="કોઈ માહિતી નથી"
                message="આ પશુ માટે કોઈ માલિકી બદલી વિનંતી સક્રિય નથી."
              />
            ) : (
              <div className="space-y-2">
                {transfers.map((tr) => (
                  <div
                    key={tr.id}
                    className="p-3 rounded-xl border border-[#E2E8F0] bg-white text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1E293B]">માલિકી બદલી અરજી</span>
                      <StatusChip
                        status={
                          tr.status === 'COMPLETED'
                            ? 'SUCCESS'
                            : tr.status === 'REJECTED'
                              ? 'DANGER'
                              : 'WARNING'
                        }
                        text={
                          tr.status === 'COMPLETED'
                            ? 'સ્વીકૃત (Completed)'
                            : tr.status === 'REJECTED'
                              ? 'નકારાયેલ (Rejected)'
                              : 'ચકાસણી હેઠળ (Pending)'
                        }
                      />
                    </div>
                    <p className="text-[11px] text-[#64748B]">કારણ: {tr.reason || 'વેચાણ / હસ્તાંતરણ'}</p>
                    <p className="text-[10px] text-[#64748B]">અરજી તારીખ: {formatDate(tr.requested_at)}</p>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#E2E8F0] flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            બંધ કરો
          </Button>
        </div>
      </div>
    </div>
  );
};
