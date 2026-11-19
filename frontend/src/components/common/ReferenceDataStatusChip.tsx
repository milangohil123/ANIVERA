import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { referenceSyncService, type ReferenceSyncStatus } from '../../services/referenceSyncService';

export const ReferenceDataStatusChip: React.FC = () => {
  const { session, apiBaseUrl } = useAuth();
  const [status, setStatus] = useState<ReferenceSyncStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkStatus = async () => {
    if (!session?.user?.id) return;
    const s = await referenceSyncService.getReferenceSyncStatus(session.user.id);
    setStatus(s);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60_000); // 1m check
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.accessToken || !session?.user?.id || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await referenceSyncService.syncReferenceData(apiBaseUrl, session.accessToken, session.user.id, false);
      await checkStatus();
    } catch (err) {
      console.warn('Manual reference sync error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!status) return null;

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'અપૂર્ણ';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'અજ્ઞાત';
    }
  };

  return (
    <div
      onClick={handleRefresh}
      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors border select-none ${
        status.isExpired
          ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
          : status.isStale
          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          : 'bg-emerald-50/60 text-emerald-800 border-emerald-200/60 hover:bg-emerald-100/60'
      }`}
      title={status.statusTextGu + ' — ક્લિક કરીને તાજો કરો'}
    >
      {status.isExpired ? (
        <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      ) : status.isStale ? (
        <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      ) : (
        <Database className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      )}

      <span>રેફરન્સ: {formatLastSync(status.lastSyncAt)}</span>

      <RefreshCw
        className={`w-3 h-3 ml-0.5 text-gray-400 hover:text-gray-700 ${
          isRefreshing ? 'animate-spin text-emerald-600' : ''
        }`}
      />
    </div>
  );
};

