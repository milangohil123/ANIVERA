import React, { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, CheckCircle2, Download } from 'lucide-react';
import { offlineDb } from '../db/offlineDb';
import { referenceSyncService } from '../services/referenceSyncService';
import { useTranslation } from '../i18n';

interface LogoutDialogProps {
  isOpen: boolean;
  onConfirmLogout: () => void;
  onCancel: () => void;
}

export const LogoutDialog: React.FC<LogoutDialogProps> = ({
  isOpen,
  onConfirmLogout,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [pendingMediaCount, setPendingMediaCount] = useState(0);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const checkPendingItems = async () => {
      setIsChecking(true);
      try {
        const mediaCount = await offlineDb.queued_media
          .where('state')
          .anyOf('PENDING_REPORT_SYNC', 'READY_FOR_UPLOAD', 'UPLOADING')
          .count();

        const eventsCount = await offlineDb.queued_events
          .where('state')
          .anyOf('PENDING_SYNC', 'SYNCING', 'SYNC_FAILED')
          .count();

        setPendingMediaCount(mediaCount);
        setPendingEventsCount(eventsCount);
      } finally {
        setIsChecking(false);
      }
    };

    checkPendingItems();
  }, [isOpen]);

  if (!isOpen) return null;

  const hasPending = pendingMediaCount > 0 || pendingEventsCount > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              hasPending ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {hasPending ? <AlertTriangle className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('logoutDialog.confirmTitle')}</h3>
            <p className="text-xs text-gray-500">{t('logoutDialog.confirmSubtitle')}</p>
          </div>
        </div>

        {isChecking ? (
          <div className="py-4 text-center text-xs text-gray-400">{t('logoutDialog.checkingQueue')}</div>
        ) : hasPending ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 mb-5">
            <p className="font-semibold text-amber-800">
              {t('logoutDialog.warningCaution')}
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              {pendingMediaCount > 0 && (
                <li>
                  {t('logoutDialog.unsyncedPhotos', { count: pendingMediaCount })}
                </li>
              )}
              {pendingEventsCount > 0 && (
                <li>
                  {t('logoutDialog.unsyncedEvents', { count: pendingEventsCount })}
                </li>
              )}
            </ul>
            <p className="text-[11px] text-amber-700 pt-1">
              {t('logoutDialog.persistenceNote')}
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 mb-5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{t('logoutDialog.allSyncedMsg')}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-center">
          {hasPending ? (
            <button
              type="button"
              onClick={() => referenceSyncService.exportPendingRecords()}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-300 cursor-pointer"
              title={t('logoutDialog.exportPendingTitle')}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('logoutDialog.exportPending')}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t('logoutDialog.cancelBtn')}
            </button>
            <button
              type="button"
              onClick={onConfirmLogout}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors cursor-pointer ${
                hasPending ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {t('logoutDialog.confirmLogoutBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

