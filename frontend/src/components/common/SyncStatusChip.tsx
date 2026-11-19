import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { StatusChip, type StatusVariant } from './StatusChip';
import { STRINGS_GU } from '../../constants/stringsGu';

export interface SyncStatusChipProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount?: number;
  className?: string;
  onClick?: () => void;
}

export const SyncStatusChip: React.FC<SyncStatusChipProps> = ({
  isOnline,
  isSyncing,
  pendingCount,
  failedCount = 0,
  className = '',
  onClick,
}) => {
  let label = STRINGS_GU.sync.synced;
  let variant: StatusVariant = 'success';
  let icon: React.ReactNode = <CheckCircle2 className="w-3.5 h-3.5 text-[#065F46]" />;

  if (!isOnline) {
    label = `${STRINGS_GU.sync.offline}${pendingCount > 0 ? ` (${pendingCount})` : ''}`;
    variant = 'neutral';
    icon = <WifiOff className="w-3.5 h-3.5 text-[#334155]" />;
  } else if (isSyncing) {
    label = STRINGS_GU.sync.syncing;
    variant = 'info';
    icon = <RefreshCw className="w-3.5 h-3.5 text-[#075985] animate-spin" />;
  } else if (failedCount > 0) {
    label = `${STRINGS_GU.sync.failed} (${failedCount})`;
    variant = 'error';
    icon = <AlertCircle className="w-3.5 h-3.5 text-[#991B1B]" />;
  } else if (pendingCount > 0) {
    label = `${STRINGS_GU.sync.pending} (${pendingCount})`;
    variant = 'warning';
    icon = <AlertTriangle className="w-3.5 h-3.5 text-[#92400E]" />;
  }

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer transition-opacity hover:opacity-90 ${className}`}
      title={isOnline ? 'ઓનલાઇન કનેક્શન સક્રિય' : 'ઑફલાઇન મોડ સક્રિય'}
    >
      <StatusChip label={label} variant={variant} icon={icon} />
    </div>
  );
};

