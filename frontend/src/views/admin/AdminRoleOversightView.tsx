import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { technicalService, type TechnicalUser } from '../../services/technicalService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  UserCheck,
  ArrowLeft,
  Search,
  RotateCcw,
} from 'lucide-react';

export const AdminRoleOversightView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();
  const { t, formatNumber } = useTranslation();

  const roleList = useMemo(() => [
    { code: '', label: t('superAdmin.roles.allRoles') },
    { code: 'SUPER_ADMIN', label: t('role.SUPER_ADMIN') },
    { code: 'SYS_ADMIN', label: t('role.SYS_ADMIN') },
    { code: 'DAHO', label: t('role.DAHO') },
    { code: 'VO', label: t('role.VO') },
    { code: 'FW', label: t('role.FW') },
    { code: 'FARMER', label: t('role.FARMER') },
    { code: 'COOPERATIVE', label: t('role.COOPERATIVE') },
    { code: 'GRAM_PANCHAYAT', label: t('role.GRAM_PANCHAYAT') },
  ], [t]);

  const [users, setUsers] = useState<TechnicalUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await technicalService.listUsers(
        apiBaseUrl,
        selectedRole || undefined,
        undefined,
        searchTerm || undefined
      );
      setUsers(data);
    } catch (err: any) {
      setErrorMsg(err?.message || t('superAdmin.common.loadFailed') || 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [apiBaseUrl, selectedRole]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  if (isLoading) {
    return <StateView state="loading" title={t('superAdmin.common.loading')} />;
  }

  if (errorMsg) {
    return <StateView state="error" message={errorMsg} onRetry={fetchUsers} />;
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12 font-body animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/overview')}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            {t('nav.overview') || 'Dashboard'}
          </Button>
          <h1 className="text-base font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.roles.pageTitle')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.dashboard.refresh')}
          </Button>
        </div>
      </div>

      {/* Role Selector Grid */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {roleList.map((r) => (
          <button
            key={r.code}
            onClick={() => setSelectedRole(r.code)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
              selectedRole === r.code
                ? 'bg-[#135D43] text-white border-[#135D43] shadow-xs'
                : 'bg-white text-slate-700 border-[#E2E8F0] hover:bg-slate-50'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 text-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('superAdmin.roles.searchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#135D43]"
          />
        </div>
        <Button variant="primary" size="sm" type="submit">
          {t('common.search') || 'Search'}
        </Button>
      </form>

      {/* Role Oversight Table */}
      <Card className="p-0 border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="p-3 bg-white border-b border-[#E2E8F0] flex items-center justify-between text-xs">
          <span className="font-bold text-[#0F172A]">
            Total: {formatNumber(users.length)}
          </span>
          <span className="text-[#64748B]">
            {t('superAdmin.roles.pageTitle')}
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">{t('superAdmin.common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-2.5 px-3">{t('superAdmin.roles.userCol')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.daho.username')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.roles.roleCol')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.roles.designationCol')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.roles.contactCol')}</th>
                  <th className="py-2.5 px-3">{t('superAdmin.roles.statusCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {users.length > 0 ? (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3 font-bold text-[#0F172A]">{u.full_name}</td>
                      <td className="py-2.5 px-3 font-mono text-[#64748B]">@{u.username}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#E8EEFC] text-[#135D43]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {u.designation || u.organisation || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{u.mobile_e164 || '-'}</td>
                      <td className="py-2.5 px-3">
                        <StatusChip
                          status={u.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                          label={u.status === 'ACTIVE' ? t('superAdmin.roles.activeStatus') : t('superAdmin.roles.inactiveStatus')}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {t('superAdmin.common.noData') || 'No users found matching filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
