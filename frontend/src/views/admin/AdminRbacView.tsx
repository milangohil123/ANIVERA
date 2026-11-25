import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  rbacService,
  type RbacOverview,
  type RbacRole,
  type RbacPermissionCategory,
  type RbacUserItem,
  type RbacAuditLogItem,
} from '../../services/rbacService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  ShieldCheck,
  Users,
  Key,
  FileText,
  RotateCcw,
  Save,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Megaphone,
  PawPrint,
  Syringe,
  Activity,
  Building2,
  Layers,
  BarChart3,
  History,
} from 'lucide-react';

export const AdminRbacView: React.FC = () => {
  const { apiBaseUrl, refreshProfile } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'matrix' | 'roles' | 'permissions' | 'assignments' | 'logs'>('matrix');

  // RBAC Data State
  const [overview, setOverview] = useState<RbacOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Local Editable Matrix State: { [role: string]: Set<string> }
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});
  const [savedMatrixState, setSavedMatrixState] = useState<Record<string, Set<string>>>({});
  const [isSavingMatrix, setIsSavingMatrix] = useState<boolean>(false);

  // Users Assignment Tab State
  const [users, setUsers] = useState<RbacUserItem[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [selectedUserForRoleChange, setSelectedUserForRoleChange] = useState<RbacUserItem | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<string>('');
  const [roleChangeReason, setRoleChangeReason] = useState<string>('');
  const [isSubmittingRoleChange, setIsSubmittingRoleChange] = useState<boolean>(false);

  // Audit Logs Tab State
  const [logs, setLogs] = useState<RbacAuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<RbacAuditLogItem | null>(null);

  // Permission Tab Search & Filter
  const [permSearch, setPermSearch] = useState<string>('');
  const [permCatFilter, setPermCatFilter] = useState<string>('ALL');

  // Role Comparison Modal
  const [compareModalOpen, setCompareModalOpen] = useState<boolean>(false);
  const [compareRoleA, setCompareRoleA] = useState<string>('DAHO');
  const [compareRoleB, setCompareRoleB] = useState<string>('TAHO');

  // Role View Details Modal
  const [viewRoleDetail, setViewRoleDetail] = useState<RbacRole | null>(null);

  // Collapsed Categories in Matrix
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // 1. Load Overview Data
  const loadOverview = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await rbacService.getOverview(apiBaseUrl);
      setOverview(data);

      // Initialize matrix state
      const initial: Record<string, Set<string>> = {};
      for (const r of data.roles) {
        const perms = data.matrix[r.code] || (r.alias && data.matrix[r.alias]) || [];
        initial[r.code] = new Set(perms);
      }
      setMatrixState(initial);
      setSavedMatrixState(JSON.parse(JSON.stringify(
        Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, Array.from(v)]))
      )));
    } catch (err: any) {
      setErrorMsg(err?.message || 'RBAC ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [apiBaseUrl]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Check if matrix has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!overview) return false;
    for (const r of overview.roles) {
      const current = matrixState[r.code] || new Set();
      const saved = new Set(savedMatrixState[r.code] || []);
      if (current.size !== saved.size) return true;
      for (const p of current) {
        if (!saved.has(p)) return true;
      }
    }
    return false;
  }, [matrixState, savedMatrixState, overview]);

  // 2. Load Users for Assignment Tab
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await rbacService.listUsers(apiBaseUrl, userSearch, userRoleFilter);
      setUsers(data.users);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'assignments') {
      loadUsers();
    }
  }, [activeTab, userSearch, userRoleFilter]);

  // 3. Load Logs for Logs Tab
  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const data = await rbacService.listLogs(apiBaseUrl);
      setLogs(data.logs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  // Toggle Single Matrix Checkbox
  const togglePermission = (roleCode: string, permCode: string) => {
    setMatrixState((prev) => {
      const nextRolePerms = new Set(prev[roleCode] || []);
      if (nextRolePerms.has(permCode)) {
        nextRolePerms.delete(permCode);
      } else {
        nextRolePerms.add(permCode);
      }
      return {
        ...prev,
        [roleCode]: nextRolePerms,
      };
    });
  };

  // Select All / Deselect All for Category in Role
  const toggleCategoryForRole = (roleCode: string, category: RbacPermissionCategory) => {
    const permCodes = category.permissions.map((p) => p.code);
    setMatrixState((prev) => {
      const current = new Set(prev[roleCode] || []);
      const allSelected = permCodes.every((c) => current.has(c));

      if (allSelected) {
        permCodes.forEach((c) => current.delete(c));
      } else {
        permCodes.forEach((c) => current.add(c));
      }

      return {
        ...prev,
        [roleCode]: current,
      };
    });
  };

  // Select All / Deselect All across all roles in category
  const toggleCategoryAllRoles = (category: RbacPermissionCategory) => {
    if (!overview) return;
    const permCodes = category.permissions.map((p) => p.code);
    const anyMissing = overview.roles.some((r) => {
      const current = matrixState[r.code] || new Set();
      return permCodes.some((c) => !current.has(c));
    });

    setMatrixState((prev) => {
      const next = { ...prev };
      for (const r of overview.roles) {
        const cur = new Set(next[r.code] || []);
        if (anyMissing) {
          permCodes.forEach((c) => cur.add(c));
        } else {
          permCodes.forEach((c) => cur.delete(c));
        }
        next[r.code] = cur;
      }
      return next;
    });
  };

  // Save Matrix Changes to Backend Database
  const handleSaveMatrix = async () => {
    if (!overview) return;
    setIsSavingMatrix(true);
    try {
      const payload: Record<string, string[]> = {};
      for (const r of overview.roles) {
        payload[r.code] = Array.from(matrixState[r.code] || []);
      }
      await rbacService.updateMatrix(apiBaseUrl, payload);

      setSavedMatrixState(JSON.parse(JSON.stringify(payload)));
      setToastMsg({ type: 'success', message: 'RBAC ભૂમિકા-પરવાનગી મેટ્રિક્સ ડેટાબેઝમાં સફળતાપૂર્વક સાચવવામાં આવ્યો.' });

      // Live Dynamic Refresh: Broadcast update and re-sync current auth session
      try {
        window.dispatchEvent(new CustomEvent('pashurakshak_rbac_updated'));
        await refreshProfile();
      } catch (syncErr) {
        console.warn('Live profile refresh note:', syncErr);
      }

      // Refresh overview in background
      await loadOverview();
    } catch (err: any) {
      setToastMsg({ type: 'error', message: err?.message || 'મેટ્રિક્સ સાચવવામાં નિષ્ફળ.' });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Reset Unsaved Matrix Changes
  const handleResetMatrix = () => {
    if (!overview) return;
    const reset: Record<string, Set<string>> = {};
    for (const r of overview.roles) {
      reset[r.code] = new Set(savedMatrixState[r.code] || []);
    }
    setMatrixState(reset);
    setToastMsg({ type: 'success', message: 'અણસાચવેલા ફેરફારો રદ કર્યા.' });
  };

  // Submit User Role Change
  const handleAssignRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRoleChange || !newSelectedRole) return;
    setIsSubmittingRoleChange(true);
    try {
      await rbacService.assignUserRole(
        apiBaseUrl,
        selectedUserForRoleChange.id,
        newSelectedRole,
        roleChangeReason || `Admin reassigned role to ${newSelectedRole}`
      );
      setToastMsg({
        type: 'success',
        message: `${selectedUserForRoleChange.full_name} ની ભૂમિકા સફળતાપૂર્વક બદલાઈ: ${newSelectedRole}`,
      });
      setSelectedUserForRoleChange(null);
      setRoleChangeReason('');
      window.dispatchEvent(new CustomEvent('pashurakshak_rbac_updated'));
      await refreshProfile().catch(() => {});
      await loadUsers();
      if (overview) {
        await loadOverview();
      }
    } catch (err: any) {
      alert(err?.message || 'ભૂમિકા બદલવામાં નિષ્ફળ.');
    } finally {
      setIsSubmittingRoleChange(false);
    }
  };

  // Category Icon Resolver
  const renderCategoryIcon = (id: string, className = 'w-4 h-4') => {
    switch (id) {
      case 'geo_gis':
        return <MapPin className={className} />;
      case 'user_staff':
        return <Users className={className} />;
      case 'campaign':
        return <Megaphone className={className} />;
      case 'animal_farmer':
        return <PawPrint className={className} />;
      case 'vaccination':
        return <Syringe className={className} />;
      case 'surveillance':
        return <Activity className={className} />;
      case 'cooperative':
        return <Building2 className={className} />;
      case 'panchayat':
        return <Layers className={className} />;
      case 'reports':
        return <BarChart3 className={className} />;
      case 'system':
      default:
        return <ShieldCheck className={className} />;
    }
  };

  // Role Badge Styling Helper
  const getRoleBadgeStyle = (color: string) => {
    switch (color) {
      case 'purple':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'blue':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'teal':
        return 'bg-teal-100 text-teal-900 border-teal-200';
      case 'amber':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'indigo':
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
      case 'green':
        return 'bg-green-100 text-green-900 border-green-200';
      case 'slate':
      default:
        return 'bg-slate-100 text-slate-900 border-slate-200';
    }
  };

  // Filtered Permissions for Tab 2
  const filteredPermissionsList = useMemo(() => {
    if (!overview) return [];
    let list: Array<{ category: RbacPermissionCategory; perm: any }> = [];

    overview.categories.forEach((cat) => {
      if (permCatFilter !== 'ALL' && cat.id !== permCatFilter) return;
      cat.permissions.forEach((perm) => {
        if (
          !permSearch.trim() ||
          perm.name_en.toLowerCase().includes(permSearch.toLowerCase()) ||
          perm.name_gu.includes(permSearch) ||
          perm.code.toLowerCase().includes(permSearch.toLowerCase())
        ) {
          list.push({ category: cat, perm });
        }
      });
    });

    return list;
  }, [overview, permSearch, permCatFilter]);

  if (isLoading && !overview) {
    return <StateView state="loading" title="RBAC ભૂમિકા નિયંત્રણ ડેટા લોડ થઈ રહ્યો છે..." />;
  }

  if (errorMsg && !overview) {
    return <StateView state="error" message={errorMsg} onRetry={loadOverview} />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16 font-body text-slate-800 animate-fade-in">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold animate-fade-in ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{toastMsg.message}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 text-slate-400 hover:text-slate-600 text-sm font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-100 text-purple-800 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-lg font-bold font-heading text-slate-900">
                ભૂમિકા નિયંત્રણ (Role-Based Access Control — RBAC)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                અધિકૃત ભૂમિકાઓ, પરવાનગી મેટ્રિક્સ, વપરાશકર્તા ફાળવણી અને સિસ્ટમ ઍક્સેસ ઓડિટ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetMatrix}
                disabled={isSavingMatrix}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                રીસેટ
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveMatrix}
                isLoading={isSavingMatrix}
                leftIcon={<Save className="w-3.5 h-3.5" />}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                ફેરફારો સાચવો
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompareModalOpen(true)}
            leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
          >
            ભૂમિકા સરખામણી
          </Button>

          <Button variant="outline" size="sm" onClick={loadOverview} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {/* 4 Sleek Compact KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs flex items-center justify-between hover:border-purple-300 transition-colors">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
              કુલ ભૂમિકાઓ (Roles)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-heading text-slate-900 leading-none">
                {overview?.summary.total_roles || 8}
              </span>
              <span className="text-[10px] text-purple-700 font-medium">સત્તાવાર</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs flex items-center justify-between hover:border-blue-300 transition-colors">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
              કુલ પરવાનગીઓ (Permissions)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-heading text-slate-900 leading-none">
                {overview?.summary.total_permissions || 48}
              </span>
              <span className="text-[10px] text-blue-600 font-medium">૧૦ શ્રેણી</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Key className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition-colors">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
              નોંધાયેલ સ્ટાફ / યુઝર્સ
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-heading text-slate-900 leading-none">
                {overview?.summary.total_users || 0}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">સક્રિય ખાતા</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs flex items-center justify-between hover:border-amber-300 transition-colors">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
              RBAC ઍક્સેસ લૉગ્સ
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-heading text-slate-900 leading-none">
                {overview?.summary.total_rbac_logs || 0}
              </span>
              <span className="text-[10px] text-amber-600 font-medium">ઓડિટ ઇવેન્ટ્સ</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <History className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-semibold">
              તમે ભૂમિકા-પરવાનગી મેટ્રિક્સમાં ફેરફારો કર્યા છે. આ ફેરફારો સિસ્ટમમાં અમલમાં મૂકવા માટે 'ફેરફારો સાચવો' બટન પર ક્લિક કરો.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={handleResetMatrix}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold underline text-xs"
            >
              રદ કરો
            </button>
            <button
              onClick={handleSaveMatrix}
              disabled={isSavingMatrix}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs"
            >
              {isSavingMatrix ? 'સાચવી રહ્યું છે...' : 'સાચવો'}
            </button>
          </div>
        </div>
      )}

      {/* 5 Tab Navigation Bar */}
      <div className="flex border-b border-slate-200 bg-white px-3 pt-2 rounded-t-xl overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'border-purple-700 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>૩. રોલ-પરમિશન મેટ્રિક્સ (Matrix)</span>
          {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'roles'
              ? 'border-purple-700 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>૧. અધિકૃત ભૂમિકાઓ (Roles)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-600">
            {overview?.roles.length || 8}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'permissions'
              ? 'border-purple-700 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>૨. પરવાનગી શ્રેણીઓ (Permissions)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-600">
            {overview?.summary.total_permissions || 48}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'assignments'
              ? 'border-purple-700 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>૪. વપરાશકર્તા ભૂમિકા ફાળવણી (Users)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-600">
            {overview?.summary.total_users || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-purple-700 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>૫. ઍક્સેસ ઓડિટ લૉગ્સ (Access Logs)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 3: ROLE-PERMISSION MATRIX (PRIMARY USER INTERFACE)                     */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && overview && (
        <Card noPadding className="bg-white border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">રોલ-પરમિશન મેટ્રિક્સ વહીવટ:</span>
              <span className="text-slate-500">
                કોઈપણ ભૂમિકા માટે ચોક્કસ પરવાનગી આપવા કે રદ કરવા ચેકબોક્સ પર ક્લિક કરો.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                (બધા ફેરફારો સાચવવા માટે ઉપરના 'ફેરફારો સાચવો' બટનનો ઉપયોગ કરો)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[68vh] relative">
            <table className="w-full text-left text-xs border-collapse">
              {/* Sticky Table Header */}
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300 shadow-2xs">
                <tr>
                  <th className="p-3 min-w-[280px] font-bold text-slate-800 sticky left-0 bg-slate-100 z-30 border-r border-slate-200">
                    પરવાનગી શ્રેણી અને વિગત (Permissions)
                  </th>
                  {overview.roles.map((r) => (
                    <th
                      key={r.code}
                      className="p-2.5 text-center min-w-[110px] font-bold text-slate-800 border-r border-slate-200 last:border-r-0"
                    >
                      <div className="truncate font-heading">{r.code}</div>
                      <div className="text-[10px] text-slate-500 font-normal truncate max-w-[100px] mx-auto">
                        {r.name_gu.split(' ')[0]}
                      </div>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200">
                        {matrixState[r.code]?.size || 0} / {overview.summary.total_permissions}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {overview.categories.map((cat) => {
                  const isCollapsed = collapsedCategories[cat.id];
                  return (
                    <React.Fragment key={cat.id}>
                      {/* Category Header Row */}
                      <tr className="bg-slate-50/90 font-bold text-slate-800 border-t-2 border-b border-slate-200">
                        <td className="p-2.5 sticky left-0 bg-slate-50/90 z-10 border-r border-slate-200">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() =>
                                setCollapsedCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                              }
                              className="flex items-center gap-2 text-left hover:text-purple-800"
                            >
                              {renderCategoryIcon(cat.id, 'w-4 h-4 text-purple-700')}
                              <span className="font-heading text-xs font-bold">{cat.name_gu}</span>
                              <span className="text-[10px] text-slate-500 font-normal">({cat.name_en})</span>
                              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => toggleCategoryAllRoles(cat)}
                              className="text-[10px] text-purple-700 hover:underline px-2 py-0.5 rounded bg-purple-50"
                              title="બધી ભૂમિકાઓ માટે પસંદ/સાફ કરો"
                            >
                              તમામ રોલ સેટ
                            </button>
                          </div>
                        </td>

                        {overview.roles.map((r) => {
                          const catCodes = cat.permissions.map((p) => p.code);
                          const currentRoleSet = matrixState[r.code] || new Set();
                          const allSelected = catCodes.every((c) => currentRoleSet.has(c));
                          const someSelected = catCodes.some((c) => currentRoleSet.has(c));

                          return (
                            <td key={r.code} className="p-2 text-center border-r border-slate-200 last:border-r-0">
                              <button
                                type="button"
                                onClick={() => toggleCategoryForRole(r.code, cat)}
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                                  allSelected
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                    : someSelected
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'text-slate-400 hover:bg-slate-200'
                                }`}
                                title={`${r.code} માટે ${cat.name_gu} ની તમામ પરવાનગીઓ પસંદ / રદ કરો`}
                              >
                                {allSelected ? 'બધા પસંદ' : someSelected ? 'અંશતઃ' : 'ખાલી'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Permission Rows within Category */}
                      {!isCollapsed &&
                        cat.permissions.map((perm) => (
                          <tr key={perm.code} className="hover:bg-purple-50/30 transition-colors">
                            <td className="p-2.5 sticky left-0 bg-white z-10 border-r border-slate-200 group-hover:bg-purple-50/30">
                              <div className="font-semibold text-slate-900">{perm.name_gu}</div>
                              <div className="text-[11px] text-slate-500 font-sans">
                                {perm.name_en}{' '}
                                <code className="text-[10px] bg-slate-100 px-1 rounded text-purple-800 font-mono">
                                  {perm.code}
                                </code>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-sm" title={perm.desc}>
                                {perm.desc}
                              </p>
                            </td>

                            {overview.roles.map((r) => {
                              const isChecked = (matrixState[r.code] || new Set()).has(perm.code);
                              const isSaved = (new Set(savedMatrixState[r.code] || [])).has(perm.code);
                              const hasChanged = isChecked !== isSaved;

                              return (
                                <td
                                  key={r.code}
                                  onClick={() => togglePermission(r.code, perm.code)}
                                  className={`p-2 text-center border-r border-slate-200 last:border-r-0 cursor-pointer select-none transition-colors ${
                                    hasChanged
                                      ? 'bg-amber-50'
                                      : isChecked
                                      ? 'bg-emerald-50/30 hover:bg-emerald-100/50'
                                      : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}} // Handled by td onClick
                                      className="w-4 h-4 rounded text-purple-700 focus:ring-purple-600 border-slate-300 cursor-pointer"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ROLES OVERVIEW                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {overview.roles.map((r) => {
            const permsCount = matrixState[r.code]?.size || r.permissions_count;
            return (
              <Card key={r.code} className="bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadgeStyle(r.badge_color)}`}>
                        {r.code}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1.5 font-heading">
                        {r.name_gu}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">{r.name_en}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-purple-800 font-mono">
                        {permsCount} / {overview.summary.total_permissions}
                      </span>
                      <span className="block text-[10px] text-slate-400">પરવાનગીઓ</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{r.description}</p>

                  <div className="p-2 bg-slate-50 rounded-lg text-xs border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <span>ભૌગોલિક મર્યાદા (Scope):</span>
                      <span className="font-semibold text-slate-800">{r.geographic_scope_desc}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <span>સક્રિય વપરાશકર્તાઓ:</span>
                      <span className="font-bold font-mono text-purple-800">{r.user_count} યુઝર્સ</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewRoleDetail(r)}
                    className="text-xs"
                  >
                    પરવાનગીઓ જુઓ
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('matrix')}
                    className="text-xs bg-purple-700 hover:bg-purple-800 text-white"
                  >
                    મેટ્રિક્સમાં સંપાદન
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERMISSIONS CATALOG                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'permissions' && overview && (
        <Card noPadding className="bg-white border border-slate-200 shadow-xs">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="પરવાનગી નામ કે કોડ શોધો..."
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-600 shrink-0">શ્રેણી:</label>
              <select
                value={permCatFilter}
                onChange={(e) => setPermCatFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white w-full sm:w-auto"
              >
                <option value="ALL">તમામ શ્રેણીઓ ({overview.summary.total_permissions})</option>
                {overview.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_gu} ({c.permissions.length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3">પરવાનગી નામ અને કોડ</th>
                  <th className="p-3">શ્રેણી (Category)</th>
                  <th className="p-3">વર્ણન (Description)</th>
                  <th className="p-3 text-right">મંજૂર ભૂમિકાઓ (Authorized Roles)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermissionsList.map(({ category, perm }) => {
                  const authorizedRoles = overview.roles.filter((r) =>
                    (matrixState[r.code] || new Set()).has(perm.code)
                  );

                  return (
                    <tr key={perm.code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{perm.name_gu}</div>
                        <div className="text-[11px] text-slate-500">{perm.name_en}</div>
                        <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-purple-800 font-mono mt-0.5 inline-block">
                          {perm.code}
                        </code>
                      </td>

                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                          {renderCategoryIcon(category.id, 'w-3 h-3')}
                          <span>{category.name_gu}</span>
                        </span>
                      </td>

                      <td className="p-3 text-slate-600 max-w-md">{perm.desc}</td>

                      <td className="p-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1 max-w-xs ml-auto">
                          {authorizedRoles.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">કોઈ ભૂમિકા નથી</span>
                          ) : (
                            authorizedRoles.map((r) => (
                              <span
                                key={r.code}
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getRoleBadgeStyle(
                                  r.badge_color
                                )}`}
                              >
                                {r.code}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: USER ROLE ASSIGNMENTS                                              */}
      {/* ========================================================================= */}
      {activeTab === 'assignments' && (
        <Card noPadding className="bg-white border border-slate-200 shadow-xs">
          {/* Search and Role Filter */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="નામ, યૂઝરનેમ કે મોબાઇલ શોધો..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-600 shrink-0">ભૂમિકા ફિલ્ટર:</label>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white w-full sm:w-auto"
              >
                <option value="">તમામ ભૂમિકાઓ</option>
                {overview?.roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} — {r.name_gu}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingUsers ? (
            <div className="p-8 text-center text-xs text-slate-400">વપરાશકર્તાઓ લોડ થઈ રહ્યા છે...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">કોઈ વપરાશકર્તા મળ્યા નથી.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="p-3">વપરાશકર્તા વિગત</th>
                    <th className="p-3">વર્તમાન ભૂમિકા (Current Role)</th>
                    <th className="p-3">ભૌગોલિક મર્યાદા (Geographic Scope)</th>
                    <th className="p-3">સ્થિતિ (Status)</th>
                    <th className="p-3 text-right">ક્રિયા (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const roleMeta = overview?.roles.find(
                      (r) => r.code === u.role || (r.alias && r.alias === u.role)
                    );
                    const color = roleMeta?.badge_color || 'slate';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{u.full_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">@{u.username || '-'}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {u.mobile_e164 || ''} {u.email ? `• ${u.email}` : ''}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getRoleBadgeStyle(color)}`}>
                            {u.role}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {roleMeta?.name_gu || u.designation || '-'}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{u.geographic_scope}</span>
                          </div>
                        </td>

                        <td className="p-3">
                          <StatusChip
                            status={u.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                            label={u.status === 'ACTIVE' ? 'સક્રિય' : 'નિષ્ક્રિય'}
                          />
                        </td>

                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserForRoleChange(u);
                              setNewSelectedRole(u.role);
                              setRoleChangeReason('');
                            }}
                            className="text-xs text-purple-700 hover:bg-purple-50"
                          >
                            ભૂમિકા બદલો
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ACCESS & AUDIT LOGS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <Card noPadding className="bg-white border border-slate-200 shadow-xs">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">RBAC ઓડિટ ટ્રેઇલ (અપરિવર્તનીય સુરક્ષા લોગ):</span>
            <Button variant="outline" size="sm" onClick={loadLogs} leftIcon={<RotateCcw className="w-3 h-3" />}>
              રીફ્રેશ લૉગ્સ
            </Button>
          </div>

          {isLoadingLogs ? (
            <div className="p-8 text-center text-xs text-slate-400">લૉગ્સ લોડ થઈ રહ્યા છે...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <History className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">કોઈ RBAC ઍક્સેસ લૉગ મળ્યો નથી.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="p-3">તારીખ અને સમય</th>
                    <th className="p-3">ક્રિયા (Action)</th>
                    <th className="p-3">કર્તા (Actor)</th>
                    <th className="p-3">લક્ષ્ય (Target)</th>
                    <th className="p-3">પરિણામ (Result)</th>
                    <th className="p-3">વિગત / કારણ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogDetail(log)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {log.occurred_at ? new Date(log.occurred_at).toLocaleString('gu-IN') : '-'}
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-slate-800 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                          {log.action}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{log.actor_role || 'SYSTEM'}</div>
                        {log.actor_user_id && (
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                            {log.actor_user_id}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-semibold text-purple-900">{log.object_id || '-'}</span>
                        <span className="text-[10px] text-slate-400 block">{log.object_type || ''}</span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.result === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.result}
                        </span>
                      </td>

                      <td className="p-3 text-slate-600 max-w-sm truncate" title={log.reason || ''}>
                        {log.reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW ROLE DETAILS & PERMISSIONS                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(viewRoleDetail)}
        onClose={() => setViewRoleDetail(null)}
        title={viewRoleDetail ? `${viewRoleDetail.name_gu} (${viewRoleDetail.code}) ની પરવાનગીઓ` : ''}
        maxWidth="lg"
      >
        {viewRoleDetail && overview && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-slate-700 font-medium">{viewRoleDetail.description}</p>
              <div className="mt-2 text-[11px] text-purple-900 font-semibold">
                ભૌગોલિક કાર્યક્ષેત્ર: {viewRoleDetail.geographic_scope_desc}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-sm">
                હાલમાં મંજૂર કરેલ પરવાનગીઓ ({matrixState[viewRoleDetail.code]?.size || 0}):
              </h4>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {overview.categories.map((cat) => {
                  const rolePerms = matrixState[viewRoleDetail.code] || new Set();
                  const grantedInCat = cat.permissions.filter((p) => rolePerms.has(p.code));

                  if (grantedInCat.length === 0) return null;

                  return (
                    <div key={cat.id} className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                        {renderCategoryIcon(cat.id, 'w-3.5 h-3.5')}
                        <span>{cat.name_gu}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({grantedInCat.length} / {cat.permissions.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {grantedInCat.map((p) => (
                          <div key={p.code} className="p-1.5 bg-slate-50 rounded text-[11px] text-slate-800">
                            <span className="font-semibold block">{p.name_gu}</span>
                            <code className="text-[9px] text-slate-500 font-mono">{p.code}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewRoleDetail(null)}>
                બંધ કરો
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setViewRoleDetail(null);
                  setActiveTab('matrix');
                }}
                className="bg-purple-700 hover:bg-purple-800 text-white"
              >
                મેટ્રિક્સમાં સંપાદન કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: ROLE COMPARISON MODAL                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        title="બે ભૂમિકાઓની પરવાનગીઓની સરખામણી (Role Comparison)"
        maxWidth="xl"
      >
        {overview && (
          <div className="space-y-4 text-xs">
            {/* Role Selectors */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ભૂમિકા A પસંદ કરો:</label>
                <select
                  value={compareRoleA}
                  onChange={(e) => setCompareRoleA(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold text-purple-900"
                >
                  {overview.roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code} — {r.name_gu}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ભૂમિકા B પસંદ કરો:</label>
                <select
                  value={compareRoleB}
                  onChange={(e) => setCompareRoleB(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold text-blue-900"
                >
                  {overview.roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code} — {r.name_gu}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 font-bold text-slate-800">પરવાનગી</th>
                    <th className="p-2.5 text-center font-bold text-purple-900">{compareRoleA}</th>
                    <th className="p-2.5 text-center font-bold text-blue-900">{compareRoleB}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.categories.map((cat) => (
                    <React.Fragment key={cat.id}>
                      <tr className="bg-slate-50 font-bold text-slate-700">
                        <td colSpan={3} className="p-2 text-xs font-heading">
                          {cat.name_gu} ({cat.permissions.length})
                        </td>
                      </tr>
                      {cat.permissions.map((p) => {
                        const hasA = (matrixState[compareRoleA] || new Set()).has(p.code);
                        const hasB = (matrixState[compareRoleB] || new Set()).has(p.code);

                        return (
                          <tr key={p.code} className="hover:bg-slate-50/50">
                            <td className="p-2 text-slate-800">
                              <span className="font-semibold">{p.name_gu}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">{p.code}</span>
                            </td>
                            <td className="p-2 text-center">
                              {hasA ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {hasB ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setCompareModalOpen(false)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: ASSIGN USER ROLE                                                 */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(selectedUserForRoleChange)}
        onClose={() => setSelectedUserForRoleChange(null)}
        title="વપરાશકર્તા ભૂમિકા ફાળવણી (Change User Role)"
        maxWidth="md"
      >
        {selectedUserForRoleChange && (
          <form onSubmit={handleAssignRoleSubmit} className="space-y-3.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">વપરાશકર્તા:</span>
                <strong className="text-slate-900 font-heading">{selectedUserForRoleChange.full_name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">યૂઝરનેમ:</span>
                <span className="font-mono text-purple-800">@{selectedUserForRoleChange.username || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">હાલની ભૂમિકા:</span>
                <span className="font-bold text-slate-900">{selectedUserForRoleChange.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">કાર્યક્ષેત્ર:</span>
                <span className="text-slate-700">{selectedUserForRoleChange.geographic_scope}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">નવી ભૂમિકા પસંદ કરો *</label>
              <select
                required
                value={newSelectedRole}
                onChange={(e) => setNewSelectedRole(e.target.value)}
                className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-600"
              >
                {overview?.roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} — {r.name_gu} ({r.name_en})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">વહીવટી કારણ / નોંધ (Audit Reason) *</label>
              <textarea
                required
                rows={3}
                value={roleChangeReason}
                onChange={(e) => setRoleChangeReason(e.target.value)}
                placeholder="ભૂમિકા બદલવા માટેનું વહીવટી કારણ દાખલ કરો..."
                className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
            </div>

            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
              <strong>નોંધ:</strong> વપરાશકર્તાની ભૂમિકા બદલવાથી તેમની સિસ્ટમ પરવાનગીઓ તાત્કાલિક અપડેટ થશે અને આ ક્રિયા ઓડિટ લોગમાં કાયમી રેકોર્ડ થશે.
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white pb-1 z-10">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setSelectedUserForRoleChange(null)}
              >
                રદ કરો
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isSubmittingRoleChange}
                className="bg-purple-700 hover:bg-purple-800 text-white"
              >
                પુષ્ટિ કરો અને ભૂમિકા સોંપો
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: AUDIT LOG DETAIL INSPECTOR                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(selectedLogDetail)}
        onClose={() => setSelectedLogDetail(null)}
        title="RBAC ઓડિટ લૉગ વિગત (Audit Event Detail)"
        maxWidth="md"
      >
        {selectedLogDetail && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">ક્રિયા:</span> <strong>{selectedLogDetail.action}</strong>
              </div>
              <div>
                <span className="text-slate-500">પરિણામ:</span>{' '}
                <span
                  className={`font-bold ${
                    selectedLogDetail.result === 'SUCCESS' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {selectedLogDetail.result}
                </span>
              </div>
              <div>
                <span className="text-slate-500">તારીખ:</span>{' '}
                {new Date(selectedLogDetail.occurred_at).toLocaleString('gu-IN')}
              </div>
              <div>
                <span className="text-slate-500">કર્તા રોલ:</span> {selectedLogDetail.actor_role || '-'}
              </div>
              <div>
                <span className="text-slate-500">કર્તા ID:</span> {selectedLogDetail.actor_user_id || '-'}
              </div>
              <div>
                <span className="text-slate-500">લક્ષ્ય ID:</span> {selectedLogDetail.object_id || '-'}
              </div>
            </div>

            {selectedLogDetail.reason && (
              <div>
                <span className="font-semibold text-slate-700">કારણ:</span>
                <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-800 mt-1">
                  {selectedLogDetail.reason}
                </p>
              </div>
            )}

            {selectedLogDetail.before_state && (
              <div>
                <span className="font-semibold text-slate-700">પહેલાની સ્થિતિ (Before State):</span>
                <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[10px] overflow-x-auto mt-1 max-h-36">
                  {JSON.stringify(selectedLogDetail.before_state, null, 2)}
                </pre>
              </div>
            )}

            {selectedLogDetail.after_state && (
              <div>
                <span className="font-semibold text-slate-700">પછીની સ્થિતિ (After State):</span>
                <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[10px] overflow-x-auto mt-1 max-h-36">
                  {JSON.stringify(selectedLogDetail.after_state, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedLogDetail(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
