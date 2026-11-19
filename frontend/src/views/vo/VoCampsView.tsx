import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { voService, type VOCamp } from '../../services/voService';
import {
  Tent,
  RotateCcw,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const VoCampsView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [camps, setCamps] = useState<VOCamp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [selectedCamp, setSelectedCamp] = useState<VOCamp | null>(null);
  const [modalType, setModalType] = useState<'CONFIRM' | 'RESCHEDULE' | 'CANCEL' | 'COMPLETE' | null>(null);

  // Action fields
  const [actionReason, setActionReason] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCamps = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const data = await voService.listCamps(apiBaseUrl);
      setCamps(data);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'કેમ્પ માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCamps();
  }, [apiBaseUrl]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCamp || !modalType) return;

    setIsSubmitting(true);
    try {
      if (modalType === 'CONFIRM') {
        await voService.confirmCamp(apiBaseUrl, selectedCamp.id, {
          vaccine_availability: 'AVAILABLE',
          vaccine_note: actionReason.trim() || undefined,
        });
        setNotice({ type: 'success', message: 'કેમ્પ સફળતાપૂર્વક મંજૂર કરવામાં આવ્યો.' });
      } else if (modalType === 'RESCHEDULE') {
        if (!newStartDate || !newEndDate || !actionReason.trim()) {
          setNotice({ type: 'error', message: 'નવી તારીખ અને કારણ આપવું જરૂરી છે.' });
          setIsSubmitting(false);
          return;
        }
        await voService.rescheduleCamp(apiBaseUrl, selectedCamp.id, {
          new_planned_start: newStartDate,
          new_planned_end: newEndDate,
          reason: actionReason.trim(),
        });
        setNotice({ type: 'success', message: 'કેમ્પ પુનઃનિર્ધારિત થયો.' });
      } else if (modalType === 'CANCEL') {
        if (!actionReason.trim()) {
          setNotice({ type: 'error', message: 'કેમ્પ રદ કરવાનું કારણ ફરજિયાત છે.' });
          setIsSubmitting(false);
          return;
        }
        await voService.cancelCamp(apiBaseUrl, selectedCamp.id, actionReason.trim());
        setNotice({ type: 'success', message: 'કેમ્પ રદ કરવામાં આવ્યો.' });
      } else if (modalType === 'COMPLETE') {
        await voService.completeCamp(apiBaseUrl, selectedCamp.id, actionReason.trim() || undefined);
        setNotice({ type: 'success', message: 'કેમ્પ સંપન્ન તરીકે નોંધાયો.' });
      }

      setModalType(null);
      setSelectedCamp(null);
      setActionReason('');
      await loadCamps();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'કાર્યવાહી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<VOCamp>[] = [
    {
      key: 'code',
      header: 'કેમ્પ કોડ / પ્રકાર',
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1E293B] font-mono">{row.camp_code || row.id.substring(0, 8)}</div>
          <div className="text-xs text-[#64748B]">
            {row.organizer_type === 'DOORSTEP' ? 'ઘરબેઠા રાઉન્ડ' : 'નિયત પશુ કેમ્પ'}
          </div>
        </div>
      ),
    },
    {
      key: 'village',
      header: 'ગામ UUID',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[#1E293B] font-mono">
          <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
          <span>{row.village_id.substring(0, 8)}...</span>
        </div>
      ),
    },
    {
      key: 'timing',
      header: 'આયોજિત સમય',
      render: (row) => (
        <div className="text-xs text-[#1E293B] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <span>{row.planned_start.substring(0, 10)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => {
        const variant =
          row.status === 'COMPLETED'
            ? 'success'
            : row.status === 'CONFIRMED'
            ? 'info'
            : row.status === 'PROPOSED'
            ? 'warning'
            : row.status === 'CANCELLED'
            ? 'error'
            : 'neutral';
        const labelMap: Record<string, string> = {
          PROPOSED: 'પ્રસ્તાવિત',
          CONFIRMED: 'મંજૂર',
          RESCHEDULED: 'પુનઃનિર્ધારિત',
          CANCELLED: 'રદ',
          COMPLETED: 'સંપન્ન',
        };
        return <StatusChip variant={variant} label={labelMap[row.status] || row.status} />;
      },
    },
    {
      key: 'actions',
      header: 'કાર્યવાહી',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === 'PROPOSED' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedCamp(row);
                setModalType('CONFIRM');
              }}
            >
              મંજૂર કરો
            </Button>
          )}
          {row.status === 'CONFIRMED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCamp(row);
                setModalType('COMPLETE');
              }}
            >
              સંપન્ન
            </Button>
          )}
          {row.status !== 'CANCELLED' && row.status !== 'COMPLETED' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCamp(row);
                  setModalType('RESCHEDULE');
                }}
              >
                તારીખ બદલો
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setSelectedCamp(row);
                  setModalType('CANCEL');
                }}
              >
                રદ કરો
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Tent className="w-5 h-5 text-[#135D43]" />
            પશુ ચિકિત્સા કેમ્પ વ્યવસ્થાપન
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            તમારા અધિકૃત ગામડાઓમાં આયોજિત પશુ આરોગ્ય કેમ્પની મંજૂરી, પુનઃનિર્ધારણ અને સંપન્નતા નોંધ.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCamps} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
          તાજું કરો
        </Button>
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

      {isLoading ? (
        <StateView state="loading" message="કેમ્પ માહિતી લોડ થઈ રહી છે..." />
      ) : camps.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ કેમ્પ મળ્યો નથી"
          message="તમારા સોંપાયેલા ગામો માટે હાલમાં કોઈ પશુ આરોગ્ય કેમ્પ નોંધાયેલ નથી."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable data={camps} columns={columns} keyExtractor={(c) => c.id} />
        </div>
      )}

      {/* Action Modal */}
      {selectedCamp && modalType && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedCamp(null);
            setModalType(null);
          }}
          title={
            modalType === 'CONFIRM'
              ? 'કેમ્પ મંજૂર કરો'
              : modalType === 'RESCHEDULE'
              ? 'કેમ્પ પુનઃનિર્ધારિત કરો'
              : modalType === 'CANCEL'
              ? 'કેમ્પ રદ કરો'
              : 'કેમ્પ સંપન્ન તરીકે નોંધો'
          }
        >
          <form onSubmit={handleAction} className="space-y-4">
            {modalType === 'RESCHEDULE' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="નવી શરૂઆત તારીખ/સમય" required>
                  <input
                    type="datetime-local"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg"
                  />
                </FormField>
                <FormField label="નવી સમાપ્તિ તારીખ/સમય" required>
                  <input
                    type="datetime-local"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg"
                  />
                </FormField>
              </div>
            )}

            <FormField
              label={
                modalType === 'CONFIRM'
                  ? 'રસી ઉપલબ્ધતા નોંધ (વૈકલ્પિક)'
                  : modalType === 'CANCEL'
                  ? 'રદ કરવાનું કારણ'
                  : modalType === 'RESCHEDULE'
                  ? 'પુનઃનિર્ધારણનું કારણ'
                  : 'સંપન્નતા નોંધ (વૈકલ્પિક)'
              }
              required={modalType === 'CANCEL' || modalType === 'RESCHEDULE'}
            >
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={3}
                placeholder="વિગત લખો..."
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setSelectedCamp(null);
                  setModalType(null);
                }}
              >
                રદ કરો
              </Button>
              <Button
                variant={modalType === 'CANCEL' ? 'danger' : 'primary'}
                type="submit"
                isLoading={isSubmitting}
              >
                સાચવો
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

