import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { networkSyncManager } from '../../services/networkSyncManager';
import { offlineDb, type QueuedEvent } from '../../db/offlineDb';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const EVENT_TYPE_GU: Record<string, string> = {
  VACCINATION: 'રસીકરણ',
  TREATMENT: 'ક્લિનિકલ સારવાર',
  DISEASE_REPORT: 'રોગ અહેવાલ',
  ATTACHMENT: 'જોડાણ ફાઇલ',
  ANIMAL_REGISTRATION: 'પશુ નોંધણી',
};

const EVENT_STATE_GU: Record<string, string> = {
  PENDING: 'પેન્ડિંગ',
  IN_FLIGHT: 'સિંકિંગ...',
  SYNCED: 'સિંક થયેલ',
  SYNC_FAILED: 'નિષ્ફળ',
  REJECTED: 'અસ્વીકૃત',
};

export const VoSyncView: React.FC = () => {
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
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'સિંક પ્રક્રિયામાં ભૂલ આવી.',
      });
    } finally {
      setIsSyncing(false);
      await loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#135D43]" />
            ઓફલાઇન કતાર અને સિંક સ્થિતિ
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            લોકલ બ્રાઉઝર IndexedDB માં સંગ્રહિત ઓફલાઇન ઇવેન્ટ્સ અને સર્વર સિંક પ્રક્રિયા.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleManualSync}
          isLoading={isSyncing}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          હમણાં સિંક કરો
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="text-xs text-[#64748B]">પેન્ડિંગ ઇવેન્ટ્સ</div>
          <div className="text-2xl font-bold text-[#1E293B] mt-1">{pendingCounts.pendingEvents}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-[#64748B]">પેન્ડિંગ ફોટો / મીડિયા</div>
          <div className="text-2xl font-bold text-[#1E293B] mt-1">{pendingCounts.pendingMedia}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="text-xs text-[#64748B]">અસ્વીકૃત ઇવેન્ટ્સ</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{pendingCounts.failedEvents}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-gray-400">
          <div className="text-xs text-[#64748B]">અસ્વીકૃત મીડિયા</div>
          <div className="text-2xl font-bold text-gray-700 mt-1">{pendingCounts.failedMedia}</div>
        </Card>
      </div>

      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-sm font-bold text-[#1E293B]">સ્થાનિક કતાર યાદી</h3>
            <span className="text-xs text-[#64748B]">કુલ {events.length} રેકોર્ડ</span>
          </div>
        }
      >
        {events.length === 0 ? (
          <StateView state="empty" title="કતાર ખાલી છે" message="બધો સ્થાનિક ડેટા સફળતાપૂર્વક સર્વર સાથે સિંક થયેલ છે." />
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.eventId} className="p-3 rounded-lg border text-xs flex justify-between items-center bg-gray-50">
                <div>
                  <span className="font-semibold text-[#1E293B]">
                    {EVENT_TYPE_GU[e.type] || e.type}
                  </span>
                  <div className="text-[#64748B] font-mono text-[11px] mt-0.5">ID: {e.eventId}</div>
                </div>
                <StatusChip
                  variant={
                    e.state === 'SYNCED'
                      ? 'success'
                      : e.state === 'SYNC_FAILED'
                      ? 'error'
                      : 'warning'
                  }
                  label={EVENT_STATE_GU[e.state] || e.state}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

