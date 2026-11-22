import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { adminService, type StaffItem, type VillageItem } from '../../services/adminService';
import {
  Plus,
  Search,
  RotateCcw,
  UserCheck,
  Users,
  Info,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Power,
  Building,
} from 'lucide-react';

type StaffTab = 'TAHO' | 'VETERINARY_OFFICERS' | 'FIELD_WORKERS';

const voSchema = z.object({
  full_name: z.string().trim().min(2, 'સંપૂર્ણ નામ ઓછામાં ઓછું ૨ અક્ષરનું હોવું જોઈએ').max(150),
  username: z.string().trim().min(3, 'વપરાશકર્તા નામ ઓછામાં ઓછું ૩ અક્ષરનું હોવું જોઈએ').max(50),
  password: z.string().min(8, 'પાસવર્ડ ઓછામાં ઓછો ૮ અક્ષરનો હોવો જોઈએ').max(128),
  mobile_e164: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\+[1-9][0-9]{7,14}$/.test(val), {
      message: 'મોબાઇલ નંબર માન્ય E.164 ફોર્મેટમાં હોવો જોઈએ (દા.ત. +919876543210)',
    }),
  designation: z.string().trim().optional(),
  office_name: z.string().trim().optional(),
  employee_ref: z.string().trim().optional(),
});

const fwSchema = z.object({
  full_name: z.string().trim().min(2, 'સંપૂર્ણ નામ ઓછામાં ઓછું ૨ અક્ષરનું હોવું જોઈએ').max(150),
  username: z.string().trim().min(3, 'વપરાશકર્તા નામ ઓછામાં ઓછું ૩ અક્ષરનું હોવું જોઈએ').max(50),
  password: z.string().min(8, 'પાસવર્ડ ઓછામાં ઓછો ૮ અક્ષરનો હોવો જોઈએ').max(128),
  mobile_e164: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\+[1-9][0-9]{7,14}$/.test(val), {
      message: 'મોબાઇલ નંબર માન્ય E.164 ફોર્મેટમાં હોવો જોઈએ (દા.ત. +919876543210)',
    }),
  designation: z.string().trim().optional(),
  organisation: z.string().trim().optional(),
});

export const DahoStaffView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, scope, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<StaffTab>('TAHO');
  const [searchTerm, setSearchTerm] = useState('');

  const [tahoList, setTahoList] = useState<any[]>([]);
  const [voList, setVoList] = useState<StaffItem[]>([]);
  const [fwList, setFwList] = useState<StaffItem[]>([]);
  const [villages, setVillages] = useState<VillageItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Assignment Feature Flag (Enabled for direct DAHO staff management)
  const enableVillageAssignment = true;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [selectedVillageIds, setSelectedVillageIds] = useState<string[]>([]);
  const [villageSearch, setVillageSearch] = useState('');

  // Form Fields State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [officeOrOrg, setOfficeOrOrg] = useState('');
  const [employeeRef, setEmployeeRef] = useState('');

  const assignedDistrictId = scope?.assigned_districts?.[0] || profile?.assigned_districts?.[0];

  const loadStaffData = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      let districtId = assignedDistrictId;
      if (!districtId) {
        try {
          const dists = await adminService.listDistricts(apiBaseUrl);
          if (dists && dists.length > 0) {
            districtId = dists[0].id;
          }
        } catch (e) {
          console.warn('Could not fetch district list:', e);
        }
      }
      if (!districtId) {
        setIsLoading(false);
        return;
      }

      const results = await Promise.allSettled([
        adminService.listVeterinaryOfficers(apiBaseUrl, districtId),
        adminService.listFieldWorkers(apiBaseUrl, districtId),
        adminService.listVillages(apiBaseUrl, districtId),
        adminService.getDahoTalukas(apiBaseUrl, districtId),
      ]);

      if (results[0].status === 'fulfilled') setVoList(results[0].value);
      if (results[1].status === 'fulfilled') setFwList(results[1].value);
      if (results[2].status === 'fulfilled') setVillages(results[2].value);
      if (results[3].status === 'fulfilled') setTahoList(results[3].value);

      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (rejected.length === results.length) {
        const firstErr = rejected[0].reason instanceof Error ? rejected[0].reason.message : 'સ્ટાફ માહિતી મેળવવામાં નિષ્ફળ.';
        setNotice({
          type: 'error',
          message: firstErr,
        });
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'સ્ટાફ માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, [assignedDistrictId, apiBaseUrl]);

  // Create Staff Handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (activeTab === 'VETERINARY_OFFICERS') {
      const validation = voSchema.safeParse({
        full_name: fullName,
        username,
        password,
        mobile_e164: mobile || undefined,
        designation,
        office_name: officeOrOrg,
        employee_ref: employeeRef,
      });

      if (!validation.success) {
        const errMap: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) errMap[String(err.path[0])] = err.message;
        });
        setFormErrors(errMap);
        return;
      }

      setIsSubmitting(true);
      try {
        await adminService.createVeterinaryOfficer(apiBaseUrl, {
          full_name: fullName,
          username,
          password,
          mobile_e164: mobile.trim() || undefined,
          designation: designation.trim() || undefined,
          office_name: officeOrOrg.trim() || undefined,
          employee_ref: employeeRef.trim() || undefined,
        });
        setNotice({ type: 'success', message: 'વેટરનરી અધિકારી ખાતું સફળતાપૂર્વક તૈયાર થયું.' });
        setIsCreateModalOpen(false);
        resetForm();
        await loadStaffData();
      } catch (err) {
        setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const validation = fwSchema.safeParse({
        full_name: fullName,
        username,
        password,
        mobile_e164: mobile || undefined,
        designation,
        organisation: officeOrOrg,
      });

      if (!validation.success) {
        const errMap: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) errMap[String(err.path[0])] = err.message;
        });
        setFormErrors(errMap);
        return;
      }

      setIsSubmitting(true);
      try {
        await adminService.createFieldWorker(apiBaseUrl, {
          full_name: fullName,
          username,
          password,
          mobile_e164: mobile.trim() || undefined,
          designation: designation.trim() || undefined,
          organisation: officeOrOrg.trim() || undefined,
        });
        setNotice({ type: 'success', message: 'ક્ષેત્રીય કાર્યકર ખાતું સફળતાપૂર્વક તૈયાર થયું.' });
        setIsCreateModalOpen(false);
        resetForm();
        await loadStaffData();
      } catch (err) {
        setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedStaff) return;
    setIsSubmitting(true);
    const newStatus = selectedStaff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      if (activeTab === 'VETERINARY_OFFICERS') {
        await adminService.updateVOStatus(apiBaseUrl, selectedStaff.id, newStatus, statusReason);
      } else {
        await adminService.updateFWStatus(apiBaseUrl, selectedStaff.id, newStatus, statusReason);
      }
      setNotice({ type: 'success', message: `સ્ટાફ સ્થિતિ સફળતાપૂર્વક બદલાઈ: ${newStatus}` });
      setIsStatusModalOpen(false);
      setSelectedStaff(null);
      setStatusReason('');
      await loadStaffData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignVillage = async () => {
    if (!selectedStaff) return;
    const targets = selectedVillageIds.length > 0 ? selectedVillageIds : (selectedVillageId ? [selectedVillageId] : []);
    if (targets.length === 0) return;

    setIsSubmitting(true);
    try {
      const isFw = selectedStaff.role === 'FIELD_WORKER' || selectedStaff.role === 'FW';
      if (isFw) {
        for (const vid of targets) {
          await adminService.assignFWVillage(apiBaseUrl, selectedStaff.id, vid);
        }
        setNotice({ type: 'success', message: 'ક્ષેત્રીય કાર્યકરને ગામ(ઓ) સફળતાપૂર્વક સોંપાયા.' });
      } else {
        if (targets.length > 1) {
          const res = await adminService.assignVOVillagesBulk(apiBaseUrl, selectedStaff.id, targets);
          setNotice({ type: 'success', message: res.message || `${res.assigned_count} ગામો સફળતાપૂર્વક સોંપાયા.` });
        } else {
          await adminService.assignVOVillage(apiBaseUrl, selectedStaff.id, targets[0]);
          setNotice({ type: 'success', message: 'વેટરનરી અધિકારીને ગામ સફળતાપૂર્વક સોંપાયું અને સંબંધિત તમામ હિતધારકોને સૂચના મોકલાઈ.' });
        }
      }
      setIsAssignModalOpen(false);
      setSelectedStaff(null);
      setSelectedVillageId('');
      setSelectedVillageIds([]);
      setVillageSearch('');
      await loadStaffData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassignVillage = async (villageId: string) => {
    if (!selectedStaff) return;
    setIsSubmitting(true);
    try {
      const isFw = selectedStaff.role === 'FIELD_WORKER' || selectedStaff.role === 'FW';
      if (isFw) {
        await adminService.endFWVillage(apiBaseUrl, selectedStaff.id, villageId);
      } else {
        await adminService.endVOVillage(apiBaseUrl, selectedStaff.id, villageId);
      }
      setNotice({ type: 'success', message: 'ગામ સોંપણી સફળતાપૂર્વક સમાપ્ત કરવામાં આવી.' });
      // Update selectedStaff's assigned_village_ids locally so modal reflects changes instantly
      setSelectedStaff((prev) => prev ? {
        ...prev,
        assigned_village_ids: prev.assigned_village_ids.filter((id) => id !== villageId)
      } : null);
      await loadStaffData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'સોંપણી રદ કરવામાં નિષ્ફળ.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setPassword('');
    setMobile('');
    setDesignation('');
    setOfficeOrOrg('');
    setEmployeeRef('');
    setFormErrors({});
  };

  // Filtered lists
  const filteredVOs = voList.filter(
    (v) =>
      v.full_name.includes(searchTerm) ||
      (v.username && v.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.mobile_e164 && v.mobile_e164.includes(searchTerm))
  );

  const filteredFWs = fwList.filter(
    (f) =>
      f.full_name.includes(searchTerm) ||
      (f.username && f.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.mobile_e164 && f.mobile_e164.includes(searchTerm))
  );

  // Column definitions
  const voColumns: Column<StaffItem>[] = [
    {
      key: 'full_name',
      header: 'અધિકારી નામ',
      render: (v) => (
        <div>
          <p className="font-bold text-[#1E293B]">{v.full_name}</p>
          <p className="text-[11px] text-[#64748B] font-mono">@{v.username}</p>
        </div>
      ),
    },
    { key: 'mobile_e164', header: 'મોબાઇલ', render: (v) => v.mobile_e164 || '—' },
    { key: 'designation', header: 'હોદ્દો', render: (v) => v.designation || 'વેટરનરી ઓફિસર' },
    { key: 'office_name', header: 'કચેરી/દવાખાનું', render: (v) => v.office_name || '—' },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (v) => (
        <StatusChip
          label={v.status === 'ACTIVE' ? 'સક્રિય' : 'નિષ્ક્રિય'}
          variant={v.status === 'ACTIVE' ? 'success' : 'neutral'}
          size="sm"
        />
      ),
    },
    {
      key: 'assigned_village_ids',
      header: 'સોંપેલ ગામો',
      render: (v) => <span className="font-mono">{v.assigned_village_ids?.length || 0} ગામ</span>,
    },
    {
      key: 'actions',
      header: 'ક્રિયાઓ',
      render: (v) => (
        <div className="flex items-center gap-1.5">
          {enableVillageAssignment && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedStaff(v);
                setIsAssignModalOpen(true);
              }}
              leftIcon={<MapPin className="w-3.5 h-3.5" />}
            >
              ગામ સોંપણી
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedStaff(v);
              setIsStatusModalOpen(true);
            }}
            title={v.status === 'ACTIVE' ? 'નિષ્ક્રિય કરો' : 'સક્રિય કરો'}
            className="text-xs"
          >
            <Power className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const fwColumns: Column<StaffItem>[] = [
    {
      key: 'full_name',
      header: 'કાર્યકર નામ',
      render: (f) => (
        <div>
          <p className="font-bold text-[#1E293B]">{f.full_name}</p>
          <p className="text-[11px] text-[#64748B] font-mono">@{f.username}</p>
        </div>
      ),
    },
    { key: 'mobile_e164', header: 'મોબાઇલ', render: (f) => f.mobile_e164 || '—' },
    { key: 'designation', header: 'હોદ્દો', render: (f) => f.designation || 'ક્ષેત્રીય કાર્યકર' },
    { key: 'organisation', header: 'સંસ્થા', render: (f) => f.organisation || '—' },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (f) => (
        <StatusChip
          label={f.status === 'ACTIVE' ? 'સક્રિય' : 'નિષ્ક્રિય'}
          variant={f.status === 'ACTIVE' ? 'success' : 'neutral'}
          size="sm"
        />
      ),
    },
    {
      key: 'assigned_village_ids',
      header: 'સોંપેલ ગામો (VO દ્વારા)',
      render: (f) => <span className="font-mono">{f.assigned_village_ids?.length || 0} ગામ</span>,
    },
    {
      key: 'actions',
      header: 'ક્રિયાઓ',
      render: (f) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedStaff(f);
              setIsStatusModalOpen(true);
            }}
            title={f.status === 'ACTIVE' ? 'નિષ્ક્રિય કરો' : 'સક્રિય કરો'}
            className="text-xs"
          >
            <Power className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  if (!assignedDistrictId) {
    return (
      <StateView
        state="error"
        title="કોઈ સક્રિય જિલ્લો સોંપાયેલ નથી"
        message="સ્ટાફ વહીવટ માટે સક્રિય જિલ્લો સોંપાયેલ હોવો જરૂરી છે."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading">
            સ્ટાફ વહીવટ (Staff Directory & Provisioning)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            વેટરનરી અધિકારીઓ (VO) અને ક્ષેત્રીય કાર્યકરો (FW) નું સંચાલન
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStaffData}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            તાજું કરો
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            {activeTab === 'VETERINARY_OFFICERS' ? 'નવા વેટરનરી ઓફિસર' : 'નવા ક્ષેત્રીય કાર્યકર'}
          </Button>
        </div>
      </div>

      {/* Village Assignment Authority Notice (Scope 5) */}
      {!enableVillageAssignment && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-bold">ગામ સોંપણીની સત્તા વિભાગ દ્વારા નક્કી થવાની બાકી છે</p>
            <p className="mt-0.5 text-[11px] text-blue-700">
              નિયમ અનુસાર: નવું ગામ બનાવવાથી તે આપમેળે કોઈને સોંપાતું નથી. ક્ષેત્રીય કાર્યકરો (FW) ને ગામ સોંપણીની સત્તા વેટરનરી અધિકારી (VO) પાસે રહેશે કે DAHO પાસે, તે અંગે વિભાગીય નીતિ સ્પષ્ટ ન થાય ત્યાં સુધી સામાન્ય ગામ સોંપણી નિયંત્રિત છે.
            </p>
          </div>
        </div>
      )}

      {/* Global Notice */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2.5 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>
              {notice.message === 'Failed to fetch'
                ? 'સર્વર સાથે જોડાણ થઈ શક્યું નથી (Failed to fetch). કૃપા કરીને ખાતરી કરો કે બેકએન્ડ સર્વર http://127.0.0.1:8000 પર ચાલુ છે.'
                : notice.message}
            </span>
          </div>
          {notice.type === 'error' && (
            <button
              onClick={() => loadStaffData()}
              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              ફરી પ્રયાસ કરો (Retry)
            </button>
          )}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-[#E2E8F0] gap-4 text-sm font-semibold">
        <button
          onClick={() => {
            setActiveTab('TAHO');
            setSearchTerm('');
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'TAHO'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>તાલુકા અધિકારીઓ (TAHO) ({tahoList.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('VETERINARY_OFFICERS');
            setSearchTerm('');
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'VETERINARY_OFFICERS'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>વેટરનરી અધિકારીઓ ({voList.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('FIELD_WORKERS');
            setSearchTerm('');
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'FIELD_WORKERS'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ક્ષેત્રીય કાર્યકરો ({fwList.length})</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="નામ, યુઝરનેમ અથવા મોબાઇલ દ્વારા શોધો..."
            className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#135D43]"
          />
        </div>
      </div>

      {/* DataTable */}
      {isLoading ? (
        <StateView state="loading" />
      ) : activeTab === 'TAHO' ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-slate-500 border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">તાલુકો અને કોડ</th>
                <th className="p-3.5 text-center">કુલ ગામ</th>
                <th className="p-3.5">નિયુક્ત TAHO અધિકારી</th>
                <th className="p-3.5">સંપર્ક વિગતો</th>
                <th className="p-3.5 text-center">સ્થિતિ</th>
                <th className="p-3.5 text-right">વહીવટ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {tahoList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    કોઈ તાલુકા ડેટા મળ્યો નથી.
                  </td>
                </tr>
              ) : (
                tahoList
                  .filter((t) =>
                    !searchTerm ||
                    (t.name_gu && t.name_gu.includes(searchTerm)) ||
                    (t.name_en && t.name_en.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (t.code && t.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (t.assigned_taho?.full_name && t.assigned_taho.full_name.includes(searchTerm))
                  )
                  .map((t) => {
                    const taho = t.assigned_taho;
                    return (
                      <tr key={t.taluka_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5">
                          <span className="font-bold text-[#0F172A] block text-sm">
                            {t.name_gu || t.name_en}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {t.name_en} ({t.code})
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                          {t.village_count || 0}
                        </td>
                        <td className="p-3.5">
                          {taho ? (
                            <div>
                              <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                {taho.full_name}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                @{taho.username}
                              </span>
                            </div>
                          ) : (
                            <span className="text-amber-600 font-medium text-xs">
                              કોઈ TAHO સોંપાયેલ નથી
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {taho ? (
                            <div className="space-y-0.5 text-[11px]">
                              <div>{taho.email || '-'}</div>
                              <div className="font-mono text-slate-500">{taho.mobile_e164 || '-'}</div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <StatusChip
                            label={taho ? 'સક્રિય' : 'ખાલી'}
                            variant={taho ? 'success' : 'neutral'}
                            size="sm"
                          />
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/daho')}
                            className="text-xs"
                          >
                            {taho ? 'બદલો (Reassign)' : 'સોંપો (Assign)'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'VETERINARY_OFFICERS' ? (
        <DataTable
          columns={voColumns}
          data={filteredVOs}
          keyExtractor={(v) => v.id}
          pageSize={10}
          emptyMessage="કોઈ વેટરનરી અધિકારી નોંધાયેલ નથી."
        />
      ) : (
        <DataTable
          columns={fwColumns}
          data={filteredFWs}
          keyExtractor={(f) => f.id}
          pageSize={10}
          emptyMessage="કોઈ ક્ષેત્રીય કાર્યકર નોંધાયેલ નથી."
        />
      )}

      {/* Create Staff Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={activeTab === 'VETERINARY_OFFICERS' ? 'નવા વેટરનરી અધિકારીનું ખાતું બનાવો' : 'નવા ક્ષેત્રીય કાર્યકરનું ખાતું બનાવો'}
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <FormField label="સંપૂર્ણ નામ (Full Name)" required error={formErrors.full_name}>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="દા.ત. ડૉ. રમેશભાઈ પટેલ"
              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="વપરાશકર્તા નામ (Username)" required error={formErrors.username}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                placeholder="દા.ત. vo_botad_01"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-mono"
              />
            </FormField>

            <FormField label="પ્રારંભિક પાસવર્ડ" required error={formErrors.password}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ઓછામાં ઓછા ૮ અક્ષર"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="મોબાઇલ નંબર (E.164)" error={formErrors.mobile_e164} helperText="દા.ત. +919876543210">
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91..."
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-mono"
              />
            </FormField>

            <FormField label="હોદ્દો (Designation)">
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder={activeTab === 'VETERINARY_OFFICERS' ? 'વેટરનરી ઓફિસર' : 'લાઇવસ્ટોક ઇન્સ્પેક્ટર'}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
          </div>

          {activeTab === 'VETERINARY_OFFICERS' ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="દવાખાનું / કચેરી નામ">
                <input
                  type="text"
                  value={officeOrOrg}
                  onChange={(e) => setOfficeOrOrg(e.target.value)}
                  placeholder="દા.ત. પશુ દવાખાનું બોટાદ"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
                />
              </FormField>
              <FormField label="કર્મચારી સંદર્ભ (Employee Ref)">
                <input
                  type="text"
                  value={employeeRef}
                  onChange={(e) => setEmployeeRef(e.target.value)}
                  placeholder="દા.ત. EMP-1042"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-mono"
                />
              </FormField>
            </div>
          ) : (
            <FormField label="સંસ્થા / એજન્સી (Organisation)">
              <input
                type="text"
                value={officeOrOrg}
                onChange={(e) => setOfficeOrOrg(e.target.value)}
                placeholder="દા.ત. જિલ્લા પંચાયત પશુપાલન શાખા"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              ખાતું બનાવો
            </Button>
          </div>
        </form>
      </Modal>

      {/* Staff Status Toggle Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`સ્ટાફ સ્થિતિ બદલો: ${selectedStaff?.full_name || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#64748B]">
            હાલની સ્થિતિ:{' '}
            <span className="font-semibold text-[#1E293B]">
              {selectedStaff?.status === 'ACTIVE' ? 'સક્રિય (ACTIVE)' : 'નિષ્ક્રિય (INACTIVE)'}
            </span>
            . તમે તેને બદલીને{' '}
            <span className="font-semibold text-[#1E293B]">
              {selectedStaff?.status === 'ACTIVE' ? 'નિષ્ક્રિય (INACTIVE)' : 'સક્રિય (ACTIVE)'}
            </span>{' '}
            કરવા જઈ રહ્યા છો.
          </p>

          <FormField label="કારણ (Reason for status change)">
            <textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="સ્થિતિ બદલવાનું વહીવટી કારણ લખો..."
              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
            />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsStatusModalOpen(false)}>
              રદ કરો
            </Button>
            <Button
              variant={selectedStaff?.status === 'ACTIVE' ? 'danger' : 'primary'}
              size="sm"
              isLoading={isSubmitting}
              onClick={handleToggleStatus}
            >
              સ્થિતિ અપડેટ કરો
            </Button>
          </div>
        </div>
      </Modal>

      {/* Staff Village Assignment Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedVillageIds([]);
          setVillageSearch('');
        }}
        title={`ગામ સોંપણી સંચાલન: ${selectedStaff?.full_name || ''}`}
      >
        <div className="space-y-5">
          {/* Staff Summary */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900">{selectedStaff?.full_name}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                @{selectedStaff?.username} • {selectedStaff?.designation || 'વેટરનરી ઓફિસર'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#135D43]">
              {selectedStaff?.assigned_village_ids?.length || 0} ગામ સોંપેલ
            </span>
          </div>

          {/* Section 1: Currently Assigned Villages with Revoke Option */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
              <span>હાલમાં સોંપાયેલ ગામો (Currently Assigned Villages)</span>
            </h4>

            {(() => {
              const assigned = villages.filter((v) => selectedStaff?.assigned_village_ids?.includes(v.id));
              if (assigned.length === 0) {
                return (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    હજુ સુધી આ અધિકારીને કોઈ ગામ સોંપાયેલ નથી. કૃપા કરીને નીચેથી ગામ પસંદ કરી સોંપો.
                  </div>
                );
              }
              return (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {assigned.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span className="font-bold text-slate-900">{v.name_gu}</span>
                        <span className="text-[11px] text-slate-500">({v.name_en || v.code})</span>
                        {v.is_pilot && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                            પાઈલટ
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnassignVillage(v.id)}
                        disabled={isSubmitting}
                        className="text-[11px] font-semibold text-red-600 hover:text-red-800 hover:underline px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        title="આ ગામની સોંપણી રદ કરો"
                      >
                        હટાવો (Remove)
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Section 2: Assign New Villages (Multi-Select & Search) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">
                નવા ગામો ફાળવો (Assign New Villages)
              </h4>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const unassigned = villages
                      .filter((v) => !selectedStaff?.assigned_village_ids?.includes(v.id))
                      .map((v) => v.id);
                    setSelectedVillageIds(unassigned);
                  }}
                  className="text-[#135D43] font-medium hover:underline"
                >
                  બધા પસંદ કરો
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedVillageIds([])}
                  className="text-slate-500 font-medium hover:underline"
                >
                  સાફ કરો
                </button>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ગામનું નામ અથવા કોડ શોધો..."
                value={villageSearch}
                onChange={(e) => setVillageSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded-lg text-xs bg-white focus:outline-none focus:border-[#135D43]"
              />
            </div>

            {/* Scrollable Checkbox List of Available Villages */}
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
              {(() => {
                const available = villages.filter(
                  (v) =>
                    !selectedStaff?.assigned_village_ids?.includes(v.id) &&
                    (v.name_gu.includes(villageSearch) ||
                      (v.name_en && v.name_en.toLowerCase().includes(villageSearch.toLowerCase())) ||
                      v.code.toLowerCase().includes(villageSearch.toLowerCase()))
                );

                if (available.length === 0) {
                  return (
                    <div className="p-4 text-center text-xs text-slate-400">
                      કોઈ ઉપલબ્ધ ગામ મળ્યું નથી.
                    </div>
                  );
                }

                return available.map((v) => {
                  const isChecked = selectedVillageIds.includes(v.id);
                  return (
                    <label
                      key={v.id}
                      className="flex items-center gap-2.5 p-2.5 hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVillageIds((prev) => [...prev, v.id]);
                          } else {
                            setSelectedVillageIds((prev) => prev.filter((id) => id !== v.id));
                          }
                        }}
                        className="w-4 h-4 rounded text-[#135D43] focus:ring-[#135D43] border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-900">{v.name_gu}</span>
                        <span className="text-[11px] text-slate-500 ml-1.5">({v.name_en || v.code})</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{v.code}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              {selectedVillageIds.length > 0 ? (
                <strong className="text-[#135D43] font-bold">{selectedVillageIds.length} ગામ પસંદ કરેલ</strong>
              ) : (
                'ગામ પસંદ કરો'
              )}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedVillageIds([]);
                  setVillageSearch('');
                }}
              >
                બંધ કરો
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={selectedVillageIds.length === 0}
                isLoading={isSubmitting}
                onClick={handleAssignVillage}
              >
                પસંદ કરેલ ગામ સોંપો ({selectedVillageIds.length})
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
