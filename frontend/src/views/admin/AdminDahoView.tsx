import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  Shield,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';

export const AdminDahoView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDistrictId = searchParams.get('assign') || searchParams.get('reassign');

  const { apiBaseUrl } = useAuth();
  const { t, localizeDistrict, formatNumber } = useTranslation();

  const [districts, setDistricts] = useState<any[]>([]);
  const [dahoUsers, setDahoUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State for creating new DAHO
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [designation, setDesignation] = useState<string>('DAHO');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(preselectedDistrictId || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdResult, setCreatedResult] = useState<any | null>(null);

  // Reassignment Modal State
  const [reassignModalOpen, setReassignModalOpen] = useState<boolean>(false);
  const [targetDistrict, setTargetDistrict] = useState<any | null>(null);
  const [newDahoId, setNewDahoId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [ov, usersList] = await Promise.all([
        adminService.getSuperAdminOverview(apiBaseUrl).catch(() => null),
        adminService.listDistricts(apiBaseUrl).catch(() => []),
      ]);

      if (ov?.districts) {
        setDistricts(ov.districts);
      } else if (usersList) {
        setDistricts(usersList);
      }

      // Extract existing DAHOs
      const assignedDahos = (ov?.districts || [])
        .filter((d: any) => d.assigned_daho)
        .map((d: any) => ({
          ...d.assigned_daho,
          district_name: d.name_en,
          district_name_gu: d.name_gu,
          district_name_hi: d.name_hi,
          district_id: d.district_id,
        }));
      setDahoUsers(assignedDahos);

      if (preselectedDistrictId && ov?.districts) {
        const found = ov.districts.find((d: any) => d.district_id === preselectedDistrictId);
        if (found) {
          setSelectedDistrictId(found.district_id);
          if (searchParams.get('reassign') && found.assigned_daho) {
            setTargetDistrict(found);
            setReassignModalOpen(true);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('superAdmin.common.loadFailed') || 'Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  // Check if selected district is already assigned
  const selectedDistrictInfo = useMemo(() => {
    if (!selectedDistrictId || !districts) return null;
    return districts.find((d: any) => d.district_id === selectedDistrictId);
  }, [selectedDistrictId, districts]);

  const hasAssignmentConflict = Boolean(selectedDistrictInfo?.assigned_daho);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !mobile.trim()) {
      alert('Please fill in required fields.');
      return;
    }

    if (hasAssignmentConflict) {
      alert(
        t('superAdmin.daho.conflictWarningMsg', {
          district: selectedDistrictInfo ? localizeDistrict(selectedDistrictInfo) : '',
          daho: selectedDistrictInfo?.assigned_daho?.full_name || '',
        }) || 'District is already assigned.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminService.createDahoAccount(apiBaseUrl, {
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim() || undefined,
        mobile_e164: mobile.trim(),
        designation: designation.trim() || undefined,
        district_id: selectedDistrictId || undefined,
      });
      setCreatedResult(res);
      setIsCreating(false);
      setFullName('');
      setUsername('');
      setEmail('');
      setMobile('');
      setSelectedDistrictId('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create DAHO account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReassignSubmit = async () => {
    if (!targetDistrict || !newDahoId || !reassignReason.trim()) {
      alert('Please select a DAHO and provide a reason.');
      return;
    }

    setIsReassigning(true);
    try {
      await adminService.reassignDistrict(
        apiBaseUrl,
        targetDistrict.district_id,
        newDahoId,
        reassignReason.trim()
      );
      alert(t('superAdmin.daho.reassignSuccess') || 'District reassigned successfully.');
      setReassignModalOpen(false);
      setTargetDistrict(null);
      setNewDahoId('');
      setReassignReason('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Reassignment failed.');
    } finally {
      setIsReassigning(false);
    }
  };

  const handleReleaseDistrict = async (district: any) => {
    const promptMsg = t('superAdmin.daho.releaseModalPrompt', { district: localizeDistrict(district) }) || `Enter administrative reason for releasing DAHO assignment from district:`;
    const reason = prompt(promptMsg);
    if (!reason || !reason.trim()) return;

    try {
      await adminService.releaseDistrict(apiBaseUrl, district.district_id, reason.trim());
      alert(t('superAdmin.daho.releaseSuccess', { district: localizeDistrict(district) }) || 'Assignment released.');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to release assignment.');
    }
  };

  if (isLoading) {
    return <StateView state="loading" title={t('superAdmin.common.loading')} />;
  }

  if (errorMsg) {
    return <StateView state="error" message={errorMsg} onRetry={loadData} />;
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
            <Shield className="w-4 h-4 text-[#135D43]" />
            {t('superAdmin.daho.pageTitle')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.dashboard.refresh')}
          </Button>
          {!isCreating && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreating(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              + {t('superAdmin.dashboard.addDaho')}
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {createdResult && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <strong>{t('superAdmin.daho.createdSuccess')}:</strong> {createdResult.full_name} (@{createdResult.username})
              {createdResult.assigned_district_name && (
                <span> — {createdResult.assigned_district_name}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setCreatedResult(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CREATE NEW DAHO FORM MODAL/DRAWER */}
      {isCreating && (
        <Card className="p-4 border-2 border-[#135D43]/30 shadow-md bg-white">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5 mb-3.5">
            <h2 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#135D43]" />
              {t('superAdmin.daho.createTitle')}
            </h2>
            <button
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.fullName')} *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('superAdmin.daho.fullNamePlaceholder')}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.username')} *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('superAdmin.daho.usernamePlaceholder')}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.mobile')} *
                </label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder={t('superAdmin.daho.mobilePlaceholder')}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('superAdmin.daho.emailPlaceholder')}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.designation')}
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.selectDistrict')}
                </label>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white font-medium"
                >
                  <option value="">{t('superAdmin.daho.selectDistrictPlaceholder')}</option>
                  {districts.map((d: any) => (
                    <option key={d.district_id} value={d.district_id}>
                      {localizeDistrict(d)} {d.status === 'ASSIGNED' ? `⚠️ [${t('superAdmin.dashboard.registryTable.tabAssigned')}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Invariant Warning if District has Conflict */}
            {hasAssignmentConflict && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">{t('superAdmin.daho.conflictWarningTitle')}:</strong>
                  <p className="mt-0.5">
                    {t('superAdmin.daho.conflictWarningMsg', {
                      district: selectedDistrictInfo ? localizeDistrict(selectedDistrictInfo) : '',
                      daho: selectedDistrictInfo?.assigned_daho?.full_name || '',
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(false)}
                type="button"
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isSubmitting}
                disabled={hasAssignmentConflict}
              >
                {t('superAdmin.daho.createBtn')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ACTIVE DAHO DIRECTORY TABLE */}
      <Card className="p-0 border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="p-3.5 bg-white border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#135D43]" />
              {t('superAdmin.daho.pageTitle')}
            </h2>
            <p className="text-xs text-[#64748B]">
              {t('superAdmin.daho.pageSubtitle')}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
            {t('superAdmin.daho.existingDahoList', { count: formatNumber(dahoUsers.length) })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-3">{t('superAdmin.roles.userCol')}</th>
                <th className="py-2.5 px-3">{t('superAdmin.daho.username')}</th>
                <th className="py-2.5 px-3">{t('superAdmin.assignments.districtLabel')}</th>
                <th className="py-2.5 px-3">{t('superAdmin.daho.mobile')}</th>
                <th className="py-2.5 px-3">{t('superAdmin.roles.statusCol')}</th>
                <th className="py-2.5 px-3 text-right">{t('superAdmin.dashboard.registryTable.thActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {dahoUsers.length > 0 ? (
                dahoUsers.map((u: any) => (
                  <tr key={u.user_id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-bold text-[#0F172A]">{u.full_name}</td>
                    <td className="py-2.5 px-3 font-mono text-[#64748B]">@{u.username}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#135D43]">
                      {localizeDistrict({ name_en: u.district_name, name_gu: u.district_name_gu, name_hi: u.district_name_hi })}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{u.mobile_e164 || '-'}</td>
                    <td className="py-2.5 px-3">
                      <StatusChip status="ACTIVE" label={t('superAdmin.roles.activeStatus')} />
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const dist = districts.find((d: any) => d.district_id === u.district_id);
                          setTargetDistrict(dist);
                          setReassignModalOpen(true);
                        }}
                      >
                        {t('superAdmin.daho.reassignModalTitle')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          const dist = districts.find((d: any) => d.district_id === u.district_id);
                          if (dist) handleReleaseDistrict(dist);
                        }}
                      >
                        {t('superAdmin.map.releaseBtn')}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    {t('superAdmin.dashboard.selectedDistrict.unassignedWarning')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* REASSIGNMENT SAFEGUARD MODAL */}
      {reassignModalOpen && targetDistrict && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4.5 border border-[#E2E8F0] shadow-xl space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <h3 className="text-sm font-bold text-[#0F172A] font-heading flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#135D43]" />
                {t('superAdmin.daho.reassignModalTitle')}
              </h3>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Downstream Impact Safeguard Disclaimer */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t('superAdmin.daho.reassignModalSubtitle')}
              </div>
              <p className="text-[11px] leading-relaxed">
                {t('superAdmin.daho.downstreamGuarantee')}
              </p>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-slate-500 font-medium">{t('superAdmin.daho.targetDistrict')}:</span>
                <p className="font-bold text-[#0F172A] text-sm">
                  {localizeDistrict(targetDistrict)} ({targetDistrict.code})
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.selectSuccessor')} *
                </label>
                <select
                  value={newDahoId}
                  onChange={(e) => setNewDahoId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white font-medium"
                >
                  <option value="">{t('superAdmin.daho.selectSuccessorPlaceholder')}</option>
                  {dahoUsers
                    .filter((u: any) => u.user_id !== targetDistrict.assigned_daho?.user_id)
                    .map((u: any) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name} (@{u.username})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t('superAdmin.daho.reassignReason')} *
                </label>
                <textarea
                  rows={2}
                  required
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder={t('superAdmin.daho.reassignReasonPlaceholder')}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReassignModalOpen(false)}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReassignSubmit}
                isLoading={isReassigning}
                disabled={!newDahoId || !reassignReason.trim()}
              >
                {t('superAdmin.daho.confirmReassignBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
