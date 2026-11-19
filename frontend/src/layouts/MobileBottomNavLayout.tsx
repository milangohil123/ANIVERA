import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { STRINGS_GU } from '../constants/stringsGu';
import { SyncStatusChip } from '../components/common/SyncStatusChip';
import { NotificationBell } from '../components/common/NotificationBell';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { LogoutDialog } from '../components/LogoutDialog';
import { LogOut, Shield } from 'lucide-react';

export interface MobileNavItemDef {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export interface MobileBottomNavLayoutProps {
  navItems: MobileNavItemDef[];
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount?: number;
  onTriggerSync?: () => void;
}

export const MobileBottomNavLayout: React.FC<MobileBottomNavLayoutProps> = ({
  navItems,
  isOnline,
  isSyncing,
  pendingCount,
  failedCount,
  onTriggerSync,
}) => {
  const { session, profile, role, logout } = useAuth();
  const { t } = useTranslation();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const displayName = profile?.full_name || session?.user.fullName || t('role.FW');
  const roleLabel = t(`role.${role}`) || STRINGS_GU.roles[role] || role;

  return (
    <div className="min-h-screen bg-[#F1F5FF] flex flex-col font-body text-[#0F172A]">
      {/* Light Enterprise Top Bar */}
      <header className="sticky top-0 z-30 h-14 bg-white text-[#0F172A] px-4 flex items-center justify-between border-b border-[#E2E8F0] shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#135D43] border border-emerald-200 flex items-center justify-center font-bold text-xs shadow-2xs">
            <Shield className="w-4 h-4 text-[#135D43]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold truncate leading-tight font-heading text-slate-900">
              PashuRakshak
            </h1>
            <p className="text-[10px] text-[#64748B] truncate flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#135D43]" />
              <span>{displayName} ({roleLabel})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SyncStatusChip
            isOnline={isOnline}
            isSyncing={isSyncing}
            pendingCount={pendingCount}
            failedCount={failedCount}
            onClick={onTriggerSync}
          />
          <LanguageSelector compact />
          <NotificationBell />
          <button
            onClick={() => setIsLogoutOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
            title={t('common.logout') || STRINGS_GU.actions.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 p-4 max-w-2xl w-full mx-auto animate-fade-in bg-[#F1F5FF]">
        <Outlet />
      </main>

      {/* Light Frosted Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-[62px] bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] px-3 flex items-center justify-around z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-2.5 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-[#135D43] font-bold bg-emerald-50 border border-emerald-100 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 font-medium'
              }`
            }
          >
            <span className="w-4 h-4 flex items-center justify-center mb-1">{item.icon}</span>
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <LogoutDialog
        isOpen={isLogoutOpen}
        onConfirmLogout={async () => {
          setIsLogoutOpen(false);
          await logout();
        }}
        onCancel={() => setIsLogoutOpen(false)}
      />
    </div>
  );
};
