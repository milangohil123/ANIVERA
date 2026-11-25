import React, { useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, getRolePrefix, normalizeRole } from '../context/AuthContext';
import { STRINGS_GU } from '../constants/stringsGu';
import { SyncStatusChip } from '../components/common/SyncStatusChip';
import { ReferenceDataStatusChip } from '../components/common/ReferenceDataStatusChip';
import { NotificationBell } from '../components/common/NotificationBell';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { LogoutDialog } from '../components/LogoutDialog';
import { useTranslation } from '../i18n';
import { Modal } from '../components/common/Modal';
import {
  LogOut,
  Shield,
  Menu,
  X,
  PhoneCall,
  Search,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface NavItemDef {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  permission?: string | string[];
}

export interface WebSidebarLayoutProps {
  navItems: NavItemDef[];
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount?: number;
  onTriggerSync?: () => void;
}

export const WebSidebarLayout: React.FC<WebSidebarLayoutProps> = ({
  navItems,
  isOnline,
  isSyncing,
  pendingCount,
  failedCount,
  onTriggerSync,
}) => {
  const { session, profile, role, logout, hasPermission } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pashurakshak_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayName = profile?.full_name || session?.user.fullName || 'અધિકૃત અધિકારી';
  const roleLabel = STRINGS_GU.roles[role] || role;
  const rolePrefix = session?.user?.role ? getRolePrefix(normalizeRole(session.user.role)) : '';

  // Persist collapsed state
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pashurakshak_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Group items into logical sections (Notifications strictly removed from sidebar)
  const operationsPaths = [
    'overview',
    'home',
    'animals',
    'farmers',
    'scan',
    'vaccinations',
    'campaigns',
    'camps',
    'inventory',
    'master-data',
    'staff',
    'villages',
    'users',
    'devices',
    'village-progress',
    'cooperatives',
  ];
  const recordsPaths = [
    'surveillance-reviews',
    'surveillance',
    'due',
    'reports',
    'new',
    'pending',
    'sync',
    'audit-logs',
    'maps',
    'map',
  ];

  // Dynamic RBAC Permission Evaluator
  const isPermitted = (item: NavItemDef) => {
    if (!item.permission) return true;
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => hasPermission(p));
    }
    return hasPermission(item.permission);
  };

  // Filter items dynamically by Matrix permissions & search query (excluding notifications)
  const filteredNavItems = navItems
    .filter((item) => isPermitted(item))
    .filter((item) => !item.path.endsWith('/notifications'))
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const label = (item.label || (item.path.includes('map') ? 'GIS નકશો' : '')).toLowerCase();
      return (
        label.includes(q) ||
        item.path.toLowerCase().includes(q)
      );
    });

  const operationsItems: NavItemDef[] = [];
  const recordsItems: NavItemDef[] = [];
  const adminItems: NavItemDef[] = [];

  filteredNavItems.forEach((item) => {
    const subPath = item.path.split('/').pop() || '';
    if (operationsPaths.includes(subPath)) {
      operationsItems.push(item);
    } else if (recordsPaths.includes(subPath)) {
      recordsItems.push(item);
    } else {
      adminItems.push(item);
    }
  });

  if (operationsItems.length === 0 && filteredNavItems.length > 0) {
    operationsItems.push(...filteredNavItems.slice(0, 5));
    recordsItems.push(...filteredNavItems.slice(5, 9));
    adminItems.push(...filteredNavItems.slice(9));
  }

  // Top 5 items for mobile bottom bar (filtered by dynamic permission, excluding notifications)
  const mobileBottomItems = navItems
    .filter((item) => isPermitted(item))
    .filter((item) => !item.path.endsWith('/notifications'))
    .slice(0, 5);

  /**
   * Render Navigation Item
   */
  const renderNavItem = (item: NavItemDef) => {
    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    const itemLabel = (item.label && item.label.trim()) || (item.path.includes('map') ? 'GIS નકશો' : item.path.split('/').pop() || 'મેનુ');

    return (
      <div key={item.path} className="relative group">
        <NavLink
          to={item.path}
          onClick={() => setIsMobileMenuOpen(false)}
          className={`flex items-center transition-all duration-150 relative rounded-lg text-xs font-medium select-none ${
            isCollapsed
              ? 'justify-center w-11 h-11 mx-auto'
              : 'justify-between px-3 py-2.5 w-full'
          } ${
            isActive
              ? 'bg-[#333333] text-white font-semibold shadow-xs'
              : 'text-[#9CA3AF] hover:text-white hover:bg-neutral-800/60'
          }`}
        >
          {/* Active Accent Indicator in Expanded Mode (Muted Forest/Teal: #35A58A) */}
          {!isCollapsed && isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#35A58A] rounded-r-full" />
          )}

          {/* Icon & Label */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
            <span
              className={`flex items-center justify-center shrink-0 transition-colors ${
                isActive ? 'text-[#35A58A]' : 'text-[#9CA3AF] group-hover:text-white'
              }`}
            >
              {item.icon}
            </span>
            {!isCollapsed && (
              <span className="truncate tracking-tight">{itemLabel}</span>
            )}
          </div>

          {/* Badge Count */}
          {item.badge ? (
            !isCollapsed ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E6F3EF] text-[#164E45] border border-[#176B5B]/30 shrink-0">
                {item.badge}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#35A58A] ring-2 ring-[#262626]" />
            )
          ) : null}
        </NavLink>

        {/* Sleek Floating Tooltip in Collapsed Mode */}
        {isCollapsed && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#18181B] text-white text-xs font-medium rounded-lg shadow-2xl border border-neutral-700/80 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-2">
            <span>{itemLabel}</span>
            {item.badge ? (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#E6F3EF] text-[#164E45] border border-[#176B5B]/30">
                {item.badge}
              </span>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render Nav Section
   */
  const renderNavSection = (title: string, items: NavItemDef[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        {!isCollapsed && (
          <p className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase px-3 mb-1.5 font-heading">
            {title}
          </p>
        )}
        {isCollapsed && (
          <div className="h-px bg-neutral-800/80 my-2 mx-3" />
        )}
        <div className="space-y-1">{items.map(renderNavItem)}</div>
      </div>
    );
  };

  /**
   * Shared Sidebar Content (Desktop and Mobile Drawer)
   */
  const sidebarContent = (
    <div className="flex flex-col h-full justify-between select-none bg-[#262626] text-[#E5E7EB] border-r border-[#303030] overflow-x-hidden">
      {/* 1. Header & Search & Scrollable Navigation */}
      <div className="flex flex-col flex-1 min-h-0 overflow-x-hidden">
        {/* Brand Header with Directional Collapse/Expand Control (< and >) */}
        <div className="p-3 border-b border-[#303030]/80">
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2.5 justify-center' : 'justify-between'}`}>
            {/* Logo + Title */}
            <div
              className={`flex items-center gap-2.5 cursor-pointer ${
                isCollapsed ? 'justify-center' : 'min-w-0'
              }`}
              onClick={() => navigate(rolePrefix || '/')}
            >
              <div className="w-8 h-8 rounded-lg bg-[#E6F3EF] text-[#176B5B] border border-[#176B5B]/30 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <Shield className="w-4 h-4 text-[#176B5B]" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-white tracking-tight leading-tight font-heading">
                    PashuRakshak
                  </h1>
                  <p className="text-[10px] text-[#9CA3AF] font-medium leading-tight mt-0.5 truncate">
                    {roleLabel} Console • બોટાદ
                  </p>
                </div>
              )}
            </div>

            {/* Directional Collapse/Expand Toggle Buttons (< and >) */}
            {!isCollapsed ? (
              <button
                type="button"
                onClick={toggleCollapse}
                className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer border border-[#383838]"
                title="સાઇડબાર સંકોચો (Collapse sidebar: <)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleCollapse}
                className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer border border-[#383838]"
                title="સાઇડબાર વિસ્તૃત કરો (Expand sidebar: >)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Portal Active Badge Pill (Expanded Only) */}
          {!isCollapsed && (
            <div className="bg-[#1E1E1E] border border-[#383838] rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs mt-3 shadow-xs">
              <span className="text-[10px] font-mono text-neutral-300 font-semibold truncate uppercase">
                {roleLabel} PORTAL
              </span>
              <span className="inline-flex items-center gap-1 bg-[#E6F3EF] text-[#164E45] border border-[#176B5B]/30 text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#176B5B] animate-pulse" />
                ACTIVE
              </span>
            </div>
          )}
        </div>

        {/* 2. Sleek Dark Search Bar */}
        <div className="px-2.5 pt-3 pb-1">
          {!isCollapsed ? (
            <div className="relative flex items-center bg-[#1E1E1E] hover:bg-[#2A2A2A] focus-within:bg-[#2A2A2A] border border-[#383838] focus-within:border-[#176B5B] rounded-lg px-2.5 py-1.5 transition-all">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.searchPlaceholder') || 'Search menu...'}
                className="w-full bg-transparent text-xs text-[#E5E7EB] placeholder:text-neutral-500 focus:outline-none pl-2 pr-1"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-neutral-400 hover:text-white p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative group flex justify-center">
              <button
                type="button"
                onClick={() => {
                  toggleCollapse();
                  setTimeout(() => searchInputRef.current?.focus(), 150);
                }}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
                title={t('common.search') || 'Search'}
              >
                <Search className="w-4 h-4" />
              </button>
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#18181B] text-white text-xs font-medium rounded-lg shadow-2xl border border-neutral-700/80 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {t('common.search') || 'Search'}
              </div>
            </div>
          )}
        </div>

        {/* 3. Navigation Items Scroll Area (Visually hidden scrollbar, scrolling preserved) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-2.5 py-2 space-y-1">
          {searchQuery && filteredNavItems.length === 0 ? (
            <div className="p-4 text-center text-neutral-400 text-xs">
              {t('common.noData') || 'No menu found.'}
            </div>
          ) : (
            <>
              {renderNavSection(t('nav.sections.operations') || 'OPERATIONS', operationsItems)}
              {renderNavSection(t('nav.sections.records') || 'RECORDS & TOOLS', recordsItems)}
              {renderNavSection(t('nav.sections.system') || 'SYSTEM & PROFILE', adminItems)}
            </>
          )}
        </div>
      </div>

      {/* 4. Bottom Utility & Profile Section */}
      <div className="p-2.5 border-t border-[#303030] bg-[#212121] space-y-2">
        {/* Support & Directional Toggle */}
        <div className="space-y-1">
          {/* Support / Helpdesk Trigger */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className={`flex items-center transition-all duration-150 relative rounded-lg text-xs font-medium select-none text-[#9CA3AF] hover:text-white hover:bg-neutral-800/60 ${
                isCollapsed
                  ? 'justify-center w-11 h-11 mx-auto'
                  : 'justify-between px-3 py-2 w-full'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                <HelpCircle className="w-[18px] h-[18px] shrink-0 text-[#9CA3AF] group-hover:text-white" />
                {!isCollapsed && <span className="truncate">{t('common.help') || 'Support & Help'}</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono text-neutral-400">1800-BOTAD</span>
              )}
            </button>

            {isCollapsed && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#18181B] text-white text-xs font-medium rounded-lg shadow-2xl border border-neutral-700/80 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {t('common.help') || 'Support & Help'} (1800-BOTAD)
              </div>
            )}
          </div>

          {/* In Collapsed Mode: Expand Toggle Button (>) */}
          {isCollapsed && (
            <div className="relative group">
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex items-center justify-center w-11 h-11 mx-auto rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
                title="Expand sidebar (>)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#18181B] text-white text-xs font-medium rounded-lg shadow-2xl border border-neutral-700/80 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                Expand (&gt;)
              </div>
            </div>
          )}
        </div>

        {/* User Profile Card */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between bg-[#1E1E1E] border border-[#383838] rounded-xl p-2.5 shadow-xs transition-colors hover:bg-[#2A2A2A]">
            <div
              className="flex items-center gap-2.5 min-w-0 cursor-pointer"
              onClick={() => navigate(`${rolePrefix}/profile`)}
            >
              {/* Avatar with Online Indicator */}
              <div className="relative w-8 h-8 rounded-full bg-[#176B5B] text-white flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-white/10">
                {displayName.charAt(0)}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#35A58A] ring-2 ring-[#1E1E1E]" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-[#9CA3AF] truncate leading-tight mt-0.5">
                  {roleLabel}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsLogoutOpen(true)}
              className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
              title={t('common.logout') || 'Logout'}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative group flex justify-center py-1">
            <button
              type="button"
              onClick={() => setIsLogoutOpen(true)}
              className="relative w-9 h-9 rounded-full bg-[#176B5B] text-white flex items-center justify-center text-xs font-bold ring-1 ring-white/10 hover:ring-[#35A58A] transition-all cursor-pointer"
            >
              {displayName.charAt(0)}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#35A58A] ring-2 ring-[#212121]" />
            </button>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#18181B] text-white text-xs font-medium rounded-lg shadow-2xl border border-neutral-700/80 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <p className="font-bold">{displayName}</p>
              <p className="text-[10px] text-neutral-400">{roleLabel} • {t('common.logout') || 'Logout'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F1F5FC] text-[#172033] font-body overflow-hidden selection:bg-[#176B5B] selection:text-white">
      {/* 1. Desktop Fixed Left Sidebar (Collapsible: w-64 vs w-20 with Directional Controls) */}
      <aside
        className={`hidden md:flex flex-col justify-between flex-shrink-0 z-20 transition-[width] duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 2. Mobile Slide-out Drawer Sidebar (Opens with hamburger on mobile) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-[280px] max-w-[85vw] bg-[#262626] h-full shadow-2xl flex flex-col z-10 animate-fade-in overflow-hidden">
            <div className="p-3 border-b border-[#383838] flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#176B5B]" />
                <span className="text-xs font-bold font-heading">મેનુ (Navigation)</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">{sidebarContent}</div>
          </div>
        </div>
      )}

      {/* 3. Main Full-Width Application Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Enterprise Top Navigation Bar (Single Notification Bell Entry Point, No Redundancy) */}
        <header className="h-[58px] bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-10 shadow-2xs">
          {/* Left Context: Mobile Hamburger (mobile only) + Desktop Expand Button (when collapsed) + Breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu (Preserved on mobile screens) */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 md:hidden"
              title="મેનુ ખોલો (Open Navigation)"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Desktop Directional Expand Button (>) when Sidebar is Collapsed */}
            {isCollapsed && (
              <button
                onClick={toggleCollapse}
                className="hidden md:flex p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="સાઇડબાર વિસ્તૃત કરો (Expand sidebar: >)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Breadcrumb Hierarchy */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 font-heading">
                PashuRakshak
              </span>
              <span className="text-slate-300 text-xs hidden sm:inline">/</span>
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">
                {roleLabel} Console
              </span>
            </div>

            {/* Dynamic Connectivity Status Pill (Responsive & Localized) */}
            <div className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? 'bg-[#E6F3EF] text-[#164E45] border-[#176B5B]/30'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#176B5B] animate-pulse' : 'bg-rose-500'}`} />
              <span>{isOnline ? `${t('common.online')} ${t('common.connected')}` : `${t('common.offline')}`}</span>
            </div>
          </div>

          {/* Right Controls: Harmoniously spaced without redundancy */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:block">
              <ReferenceDataStatusChip />
            </div>

            <SyncStatusChip
              isOnline={isOnline}
              isSyncing={isSyncing}
              pendingCount={pendingCount}
              failedCount={failedCount}
              onClick={onTriggerSync}
            />

            {/* Language Switcher */}
            <LanguageSelector />

            {/* Single Unified Notification Entry Point */}
            <NotificationBell />

            {/* Profile Avatar Chip */}
            <div
              className="flex items-center gap-2 pl-3 border-l border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate(`${rolePrefix}/profile`)}
              title="પ્રોફાઇલ જુઓ (View Profile)"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#176B5B] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                {displayName.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-[#172033] leading-tight truncate max-w-[130px]">
                  {displayName}
                </p>
                <p className="text-[10px] text-[#64748B] leading-tight truncate">
                  {roleLabel} • Botad
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Viewport with #F1F5FC Application Canvas - Full Width */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 pb-20 md:pb-6 bg-[#F1F5FC] animate-fade-in w-full">
          <Outlet />
        </main>

        {/* 4. Mobile Bottom Navigation Bar (ONLY shown on mobile screens < md, notifications excluded) */}
        <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-[#E2E8F0] px-2 items-center justify-around z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
          {mobileBottomItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[50px] min-h-[44px] py-1 px-2 rounded-xl transition-all duration-150 ${
                  isActive
                    ? 'text-[#176B5B] font-bold bg-[#E6F3EF]'
                    : 'text-slate-400 hover:text-slate-700 font-medium'
                }`
              }
            >
              <span className="w-4 h-4 flex items-center justify-center mb-0.5">{item.icon}</span>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Logout Confirmation Dialog */}
      <LogoutDialog
        isOpen={isLogoutOpen}
        onConfirmLogout={async () => {
          setIsLogoutOpen(false);
          await logout();
        }}
        onCancel={() => setIsLogoutOpen(false)}
      />

      {/* Helpdesk / Support Modal */}
      <Modal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        title="પશુરક્ષક સહાય અને હેલ્પડેસ્ક (PashuRakshak Support)"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="bg-[#E6F3EF] border border-[#176B5B]/30 rounded-xl p-3.5 flex items-start gap-3">
            <PhoneCall className="w-5 h-5 text-[#176B5B] mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-[#164E45]">જિલ્લા હેલ્પડેસ્ક ટોલ-ફ્રી નંબર</h4>
              <p className="text-xs text-[#176B5B] mt-0.5 font-mono font-semibold">1800-BOTAD (1800-268-23)</p>
              <p className="text-[11px] text-[#164E45] mt-1">
                સોમવાર થી શનિવાર: સવારે ૯:૦૦ થી સાંજે ૬:૦૦ વાગ્યા સુધી કાર્યરત.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-700 bg-white">
            <h5 className="font-bold text-slate-800">અધિકૃત પશુપાલન કચેરી:</h5>
            <p>જિલ્લા પશુપાલન અધિકારી કચેરી (DAHO), બોટાદ, ગુજરાત</p>
            <p className="text-slate-500 text-[11px]">ઈમેલ: daho-botad@gujarat.gov.in</p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>PashuRakshak Core Edition</span>
              <span className="font-mono font-semibold text-slate-700">v1.4.2 (Botad Pilot)</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
