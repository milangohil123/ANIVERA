import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { STRINGS_GU } from '../../constants/stringsGu';
import { networkSyncManager } from '../../services/networkSyncManager';
import { offlineDb, type QueuedEvent } from '../../db/offlineDb';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const EVENT_TYPE_GU: Record<string, string> = {
  DISEASE_REPORT: 'રોગ અહેવાલ',
  VACCINATION: 'રસીકરણ',
  ANIMAL_REGISTRATION: 'પશુ નોંધણી',
  FARMER_REGISTRATION: 'પશુપાલક નોંધણી',
  TREATMENT: 'ક્લિનિકલ સારવાર',
};

const EVENT_STATE_GU: Record<string, string> = {
  SYNCED: 'સિંક પૂર્ણ',
  SYNC_FAILED: 'સિંક નિષ્ફળ',
  PENDING: 'કતારમાં પેન્ડિંગ',
  SYNCING: 'સિંક ચાલુ છે',
};

export const FwSyncView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCounts, setPendingCounts] = useState({
    pendingEvents: 0,
    pendingMedia: 0,
    failedEvents: 0,
    failedMedia: 0,
  });
  const [events, setEvents] = useState<QueuedEvent[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      const counts = await networkSyncManager.getPendingCounts();
      setPendingCounts(counts);
      const allEvents = await offlineDb.queued_events.toArray();
      setEvents(allEvents.slice(-20).reverse());
    } catch (e) {
      console.warn('Failed to load sync view data:', e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setNotice(null);
    setIsSyncing(true);
    try {
      const res = await networkSyncManager.triggerSync(apiBaseUrl);
      if (res && res.eventResult) {
        setNotice({
          type: 'success',
          message: `સિંક પ્રક્રિયા પૂર્ણ! સ્વીકારેલ: ${res.eventResult.acceptedCount}, અસ્વીકાર: ${res.eventResult.rejectedCount}`,
        });
      } else {
        setNotice({ type: 'success', message: 'સિંક પ્રક્રિયા પૂર્ણ થઈ.' });
      }
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'સિંક નિષ્ફળ થયું.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <h2 className="text-base font-bold text-[#1E293B] font-heading">
          {STRINGS_GU.sync.triggerManual}
        </h2>
        <p className="text-xs text-[#64748B] mt-0.5">
          સ્થાનિક IndexedDB કતાર અને સર્વર સાથે સિંક્રોનાઇઝેશન
        </p>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === 'success'
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

      {/* Sync summary card */}
      <Card noPadding className="p-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-[#64748B] font-medium">બાકી ઇવેન્ટ્સ</p>
            <p className="text-lg font-bold text-[#1E293B] mt-0.5">{pendingCounts.pendingEvents}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-[#64748B] font-medium">બાકી મીડિયા (ફોટો)</p>
            <p className="text-lg font-bold text-[#1E293B] mt-0.5">{pendingCounts.pendingMedia}</p>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            isLoading={isSyncing}
            onClick={handleManualSync}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            {STRINGS_GU.sync.triggerManual}
          </Button>
        </div>
      </Card>

      {/* Local Queue List */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">સ્થાનિક ઑફલાઇન કતાર (તાજેતરના રેકોર્ડ)</h3>
            <span className="text-[11px] text-[#64748B] font-mono">{events.length} કુલ</span>
          </div>
        }
      >
        {events.length === 0 ? (
          <StateView
            state="empty"
            title="ઑફલાઇન કતાર ખાલી છે"
            message="બધા રેકોર્ડ્સ સર્વર સાથે સિંક થયેલ છે અથવા કોઈ ઇવેન્ટ નોંધાયેલ નથી."
          />
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {events.map((ev) => (
              <div key={ev.eventId} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-[#1E293B]">{EVENT_TYPE_GU[ev.type] || ev.type}</p>
                  <p className="text-[10px] text-[#64748B] font-mono">{ev.eventId.substring(0, 16)}...</p>
                </div>
                <div>
                  <StatusChip
                    label={EVENT_STATE_GU[ev.state] || ev.state}
                    variant={
                      ev.state === 'SYNCED'
                        ? 'success'
                        : ev.state === 'SYNC_FAILED'
                        ? 'error'
                        : 'warning'
                    }
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
