import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth, getRolePrefix, normalizeRole } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { useTranslation } from '../../i18n';

export const NotificationBell: React.FC = () => {
  const { session, apiBaseUrl } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchUnread = async () => {
    if (!session?.accessToken) return;
    try {
      const count = await notificationService.getUnreadCount(apiBaseUrl, session.accessToken);
      setUnreadCount(count);
    } catch {
      // Non-fatal background telemetry
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000); // 30s polling
    return () => clearInterval(interval);
  }, [session?.accessToken, apiBaseUrl]);

  const handleClick = () => {
    const rolePrefix = session?.user?.role ? getRolePrefix(normalizeRole(session.user.role)) : '';
    navigate(`${rolePrefix}/notifications`);
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className="relative p-2 rounded-xl text-slate-600 hover:text-[#176B5B] hover:bg-[#E6F3EF] transition-colors border border-slate-200 cursor-pointer"
      title={t('common.notifications')}
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs animate-in zoom-in duration-100">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

