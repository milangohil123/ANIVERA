import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  notificationService,
  type InAppNotification,
} from '../../services/notificationService';
import {
  Bell,
  CheckCheck,
  Check,
  Clock,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  MapPin,
  Megaphone,
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { session, apiBaseUrl } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!session?.accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await notificationService.listNotifications(
        apiBaseUrl,
        session.accessToken,
        filter === 'UNREAD' ? 'UNREAD' : undefined
      );
      setNotifications(res.items);
    } catch (err) {
      setError('સૂચનાઓ લોડ કરવામાં ભૂલ આવી.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter, session?.accessToken]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!session?.accessToken) return;
    try {
      await notificationService.markAsRead(apiBaseUrl, session.accessToken, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!session?.accessToken) return;
    setIsMarkingAll(true);
    try {
      await notificationService.markAllAsRead(apiBaseUrl, session.accessToken);
      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'READ' })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleItemClick = (n: InAppNotification) => {
    if (n.status === 'UNREAD') {
      handleMarkAsRead(n.id);
    }
    // Navigate based on relatedType
    if (n.relatedType === 'disease_report') {
      if (session?.user.role === 'VET_OFFICER' || session?.user.role === 'VO') {
        navigate('/vo/reports');
      } else {
        navigate('/fw/dashboard');
      }
    } else if (n.relatedType === 'camp') {
      navigate('/camps');
    } else if (n.relatedType === 'campaign') {
      if (session?.user.role === 'FIELD_WORKER' || session?.user.role === 'FW') {
        navigate('/fw/pending');
      } else if (session?.user.role === 'VET_OFFICER' || session?.user.role === 'VO') {
        navigate('/vo/campaigns');
      } else {
        navigate('/farmer/animals');
      }
    } else if (n.relatedType === 'village') {
      if (session?.user.role === 'VET_OFFICER' || session?.user.role === 'VO') {
        navigate('/vo/dashboard');
      } else if (session?.user.role === 'FARMER') {
        navigate('/farmer/dashboard');
      }
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoStr;
    }
  };

  const getIcon = (kind: string) => {
    if (kind.includes('VILLAGE') || kind.includes('ASSIGNED')) {
      return <MapPin className="w-5 h-5 text-emerald-600" />;
    }
    if (kind.includes('CAMPAIGN')) {
      return <Megaphone className="w-5 h-5 text-blue-600" />;
    }
    if (kind.includes('REPORT') || kind.includes('ALERT')) {
      return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    }
    if (kind.includes('CAMP')) {
      return <Calendar className="w-5 h-5 text-emerald-600" />;
    }
    return <ShieldCheck className="w-5 h-5 text-emerald-700" />;
  };

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  return (
    <div className="w-full max-w-5xl mx-auto px-2 py-4 font-body text-[#172033]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">સૂચનાઓ (Notifications)</h1>
              <p className="text-xs text-gray-500">
                રોગ અહેવાલ, કેમ્પ પુષ્ટિ અને ખાતા સંબંધિત ઇન-એપ સૂચનાઓ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            disabled={isLoading}
            className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title="રીફ્રેશ કરો"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAll || unreadCount === 0}
            className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-200"
          >
            <CheckCheck className="w-4 h-4" />
            <span>બધા વાંચેલા તરીકે માર્ક કરો</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2 text-xs font-semibold">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filter === 'ALL'
              ? 'bg-emerald-800 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          બધી ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            filter === 'UNREAD'
              ? 'bg-emerald-800 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>વણવાંચેલી</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500 text-sm flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
          <span>સૂચનાઓ લોડ થઈ રહી છે...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200 p-8">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">કોઈ નવી સૂચના નથી.</p>
          <p className="text-xs text-gray-400 mt-1">
            જ્યારે નવો રોગ અહેવાલ અથવા કેમ્પ પુષ્ટિ થશે ત્યારે અહીં વિગત જોવા મળશે.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                n.status === 'UNREAD'
                  ? 'bg-emerald-50/40 border-emerald-300 hover:bg-emerald-50/70 shadow-xs'
                  : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                  n.status === 'UNREAD' ? 'bg-white shadow-xs' : 'bg-gray-100'
                }`}
              >
                {getIcon(n.kind)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3
                    className={`text-sm truncate ${
                      n.status === 'UNREAD'
                        ? 'font-bold text-gray-900'
                        : 'font-medium text-gray-700'
                    }`}
                  >
                    {n.titleGu || n.kind}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(n.createdAt)}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {n.messageGu || n.messageKey}
                </p>

                {n.relatedType && (
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline">
                      <span>વિગત જુઓ</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>

                    {n.status === 'UNREAD' && (
                      <button
                        onClick={(e) => handleMarkAsRead(n.id, e)}
                        className="px-2 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-emerald-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                        title="વાંચેલું માર્ક કરો"
                      >
                        <Check className="w-3 h-3" />
                        <span>વાંચેલું</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

