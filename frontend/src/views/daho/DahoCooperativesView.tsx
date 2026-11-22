import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { Modal } from '../../components/common/Modal';
import { adminService, type DistrictSummary, type DistrictItem, type TalukaItem, type VillageItem } from '../../services/adminService';
import {
  coopService,
  type CoopSummaryItem,
  type CoopDetailItem,
  type CoopRegisterPayload,
  type CoopMemberFarmerItem,
} from '../../services/coopService';
import {
  Building2,
  Users,
  PawPrint,
  Syringe,
  Plus,
  Search,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  UserCheck,
  UserX,
} from 'lucide-react';

export const DahoCooperativesView: React.FC = () => {
  const { apiBaseUrl, session } = useAuth();

  // District & Geography
  const [district, setDistrict] = useState<DistrictSummary | null>(null);
  const [talukas, setTalukas] = useState<TalukaItem[]>([]);
  const [villages, setVillages] = useState<VillageItem[]>([]);
  const [selectedTalukaFilter, setSelectedTalukaFilter] = useState<string>('');
  const [selectedVillageFilter, setSelectedVillageFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data state
  const [cooperatives, setCooperatives] = useState<CoopSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedCoopDetail, setSelectedCoopDetail] = useState<CoopDetailItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'farmers' | 'animals' | 'villages'>('profile');
  const [drawerMembers, setDrawerMembers] = useState<CoopMemberFarmerItem[]>([]);
  const [isDrawerLoading, setIsDrawerLoading] = useState<boolean>(false);

  // Link Farmer Modal
  const [isLinkFarmerModalOpen, setIsLinkFarmerModalOpen] = useState<boolean>(false);
  const [targetCoopForLink, setTargetCoopForLink] = useState<CoopSummaryItem | null>(null);
  const [availableFarmers, setAvailableFarmers] = useState<any[]>([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const [customMemberNo, setCustomMemberNo] = useState<string>('');
  const [linkFarmerDate, setLinkFarmerDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLinking, setIsLinking] = useState<boolean>(false);

  // Add Form State
  const [addForm, setAddForm] = useState<CoopRegisterPayload>({
    code: '',
    name_gu: '',
    name_en: '',
    org_type: 'DAIRY_COOPERATIVE',
    registration_no: '',
    contact_person: '',
    designation: 'સચિવ (Secretary)',
    mobile_e164: '',
    email: '',
    district_id: '',
    taluka_id: '',
    village_id: '',
    address: '',
    postal_code: '',
    status: 'ACTIVE',
    notes: '',
    initial_password: '',
  });
  const [addFormVillages, setAddFormVillages] = useState<VillageItem[]>([]);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [createdCredentialsAlert, setCreatedCredentialsAlert] = useState<{
    email: string;
    username: string;
    tempPass: string;
  } | null>(null);

  // Action loaders
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load Initial Data
  const loadInitialData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let activeDist: DistrictItem | null = null;
      if (typeof adminService.getActiveDistrict === 'function') {
        try {
          activeDist = await adminService.getActiveDistrict(apiBaseUrl);
        } catch {
          activeDist = null;
        }
      }
      if (!activeDist) {
        const dists = await adminService.listDistricts(apiBaseUrl);
        if (dists && dists.length > 0) {
          activeDist = dists[0];
        }
      }
      if (!activeDist) {
        throw new Error('કોઈ સક્રિય જિલ્લો મળ્યો નથી');
      }
      const distSummary = await adminService.getDistrictSummary(apiBaseUrl, activeDist.id).catch(() => null);
      setDistrict(distSummary);

      const [tals, coops] = await Promise.all([
        adminService.listTalukas(apiBaseUrl, activeDist.id),
        coopService.dahoListCooperatives(apiBaseUrl, { district_id: activeDist.id }),
      ]);
      setTalukas(tals);
      setCooperatives(coops);

      setAddForm((prev) => ({
        ...prev,
        district_id: activeDist.id,
      }));
    } catch (err: any) {
      setErrorMsg(err?.message || 'માહિતી લોડ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [apiBaseUrl]);

  // Load villages when filter taluka changes
  useEffect(() => {
    if (selectedTalukaFilter) {
      adminService.listVillages(apiBaseUrl, district?.id, selectedTalukaFilter).then(setVillages).catch(() => setVillages([]));
    } else {
      setVillages([]);
      setSelectedVillageFilter('');
    }
  }, [selectedTalukaFilter, apiBaseUrl]);

  // Load villages for Add Form when its taluka changes
  const handleAddTalukaChange = async (talukaId: string) => {
    setAddForm((prev) => ({ ...prev, taluka_id: talukaId, village_id: '' }));
    if (talukaId) {
      try {
        const vils = await adminService.listVillages(apiBaseUrl, district?.id, talukaId);
        setAddFormVillages(vils);
      } catch {
        setAddFormVillages([]);
      }
    } else {
      setAddFormVillages([]);
    }
  };

  // Filter cooperatives
  const filteredCooperatives = useMemo(() => {
    return cooperatives.filter((c) => {
      if (selectedTalukaFilter && c.taluka_id !== selectedTalukaFilter) return false;
      if (selectedVillageFilter && c.village_id !== selectedVillageFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (c.name_gu?.toLowerCase() || '').includes(q) || (c.name_en?.toLowerCase() || '').includes(q);
        const matchCode = (c.code?.toLowerCase() || '').includes(q);
        const matchContact = (c.contact_person?.toLowerCase() || '').includes(q);
        const matchMobile = (c.mobile_e164?.toLowerCase() || '').includes(q);
        const matchReg = (c.registration_no?.toLowerCase() || '').includes(q);
        if (!matchName && !matchCode && !matchContact && !matchMobile && !matchReg) return false;
      }
      return true;
    });
  }, [cooperatives, selectedTalukaFilter, selectedVillageFilter, statusFilter, searchQuery]);

  // Overall KPIs
  const totalCount = cooperatives.length;
  const activeCount = cooperatives.filter((c) => c.status === 'ACTIVE').length;
  const totalFarmers = cooperatives.reduce((acc, c) => acc + (c.linked_farmers_count || 0), 0);
  const totalAnimals = cooperatives.reduce((acc, c) => acc + (c.linked_animals_count || 0), 0);
  const totalVax = cooperatives.reduce((acc, c) => acc + (c.vaccinated_animals_count || 0), 0);
  const avgCoverage = totalAnimals > 0 ? Math.round((totalVax / totalAnimals) * 100) : 0;

  // Submit Add Form
  const handleCreateCooperative = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAdd(true);
    setAddFormError(null);
    try {
      if (!addForm.code || !addForm.name_gu || !addForm.name_en || !addForm.contact_person || !addForm.email || !addForm.mobile_e164 || !addForm.taluka_id || !addForm.village_id) {
        throw new Error('કૃપા કરીને તમામ ફરજિયાત માહિતી ભરો (જિલ્લો, તાલુકો, ગામ, મંડળી નામ, સંપર્ક વ્યક્તિ, ઈમેઇલ, મોબાઇલ)');
      }

      // Normalize mobile to E.164
      let cleanMobile = addForm.mobile_e164.trim().replace(/[^\d+]/g, '');
      if (!cleanMobile.startsWith('+')) {
        const raw = cleanMobile.replace(/^0+/, '');
        if (raw.length === 10) {
          cleanMobile = `+91${raw}`;
        } else if (raw.length === 12 && raw.startsWith('91')) {
          cleanMobile = `+${raw}`;
        } else {
          cleanMobile = `+91${raw}`;
        }
      }
      const payloadToSubmit = { ...addForm, mobile_e164: cleanMobile };
      const created = await coopService.dahoCreateCooperative(apiBaseUrl, payloadToSubmit);
      setSuccessMsg(`સહકારી મંડળી '${created.name_gu}' સફળતાપૂર્વક બનાવવામાં આવી છે.`);

      setCreatedCredentialsAlert({
        email: created.email || addForm.email,
        username: created.username || addForm.email.split('@')[0],
        tempPass: addForm.initial_password || 'સ્વતઃ જનરેટ કરેલ સુરક્ષિત પાસવર્ડ ઈમેઇલ દ્વારા મોકલાયો છે',
      });

      // Refresh list
      if (district) {
        const coops = await coopService.dahoListCooperatives(apiBaseUrl, { district_id: district.id });
        setCooperatives(coops);
      }

      setIsAddModalOpen(false);
      // Reset form
      setAddForm({
        code: '',
        name_gu: '',
        name_en: '',
        org_type: 'DAIRY_COOPERATIVE',
        registration_no: '',
        contact_person: '',
        designation: 'સચિવ (Secretary)',
        mobile_e164: '',
        email: '',
        district_id: district?.id || '',
        taluka_id: '',
        village_id: '',
        address: '',
        postal_code: '',
        status: 'ACTIVE',
        notes: '',
        initial_password: '',
      });
    } catch (err: any) {
      setAddFormError(err?.message || 'મંડળી બનાવવામાં નિષ્ફળ');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Detail Drawer
  const handleOpenDetailDrawer = async (coopId: string) => {
    setIsDrawerLoading(true);
    setDrawerOpen(true);
    setDrawerTab('profile');
    try {
      const [detail, members] = await Promise.all([
        coopService.dahoGetCooperative(apiBaseUrl, coopId),
        coopService.dahoListMembers(apiBaseUrl, coopId),
      ]);
      setSelectedCoopDetail(detail);
      setDrawerMembers(members);
    } catch (err: any) {
      setErrorMsg(err?.message || 'મંડળી વિગત મેળવવામાં નિષ્ફળ');
    } finally {
      setIsDrawerLoading(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (coop: CoopSummaryItem) => {
    const newStatus = coop.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmText = newStatus === 'INACTIVE'
      ? `શું તમે ખરેખર '${coop.name_gu}' ને નિષ્ક્રિય (Deactivate) કરવા માંગો છો? આનાથી જોડાયેલ સ્ટાફ પોર્ટલ લોગિન પણ અટકી જશે.`
      : `શું તમે '${coop.name_gu}' ને સક્રિય (Activate) કરવા માંગો છો?`;

    if (!window.confirm(confirmText)) return;

    setActionLoadingId(coop.id);
    try {
      await coopService.dahoSetStatus(apiBaseUrl, coop.id, newStatus, 'DAHO Manual Toggle');
      setSuccessMsg(`મંડળી '${coop.name_gu}' ની સ્થિતિ '${newStatus}' તરીકે અપડેટ કરવામાં આવી.`);
      if (district) {
        const coops = await coopService.dahoListCooperatives(apiBaseUrl, { district_id: district.id });
        setCooperatives(coops);
      }
      if (selectedCoopDetail && selectedCoopDetail.id === coop.id) {
        setSelectedCoopDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      alert(err?.message || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Resend Email
  const handleResendEmail = async (coop: CoopSummaryItem) => {
    if (!window.confirm(`'${coop.contact_person}' (${coop.email}) ને નવો ઓનબોર્ડિંગ એક્ટિવેશન ઈમેઇલ મોકલવો છે?`)) return;

    setActionLoadingId(coop.id);
    try {
      const res = await coopService.dahoResendEmail(apiBaseUrl, coop.id);
      setSuccessMsg(`ઈમેઇલ સફળતાપૂર્વક મોકલવામાં આવ્યો! (સ્થિતિ: ${res.delivery_status || 'SENT'})`);
    } catch (err: any) {
      alert(err?.message || 'ઈમેઇલ મોકલવામાં નિષ્ફળ');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Link Farmer Modal
  const handleOpenLinkFarmerModal = async (coop: CoopSummaryItem) => {
    setTargetCoopForLink(coop);
    setSelectedFarmerId('');
    setCustomMemberNo(`MBR-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsLinkFarmerModalOpen(true);

    try {
      // Fetch farmers in this village or taluka
      const q = new URLSearchParams({ limit: '100' });
      if (coop.village_id) q.set('village_id', coop.village_id);
      const res = await fetch(`${apiBaseUrl}/api/v1/farmers?${q.toString()}`, {
        headers: { Authorization: `Bearer ${session?.accessToken || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableFarmers(data || []);
      }
    } catch {
      setAvailableFarmers([]);
    }
  };

  // Submit Link Farmer
  const handleLinkFarmerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCoopForLink || !selectedFarmerId) return;

    setIsLinking(true);
    try {
      await coopService.dahoLinkMember(
        apiBaseUrl,
        targetCoopForLink.id,
        selectedFarmerId,
        customMemberNo || undefined,
        linkFarmerDate
      );
      setSuccessMsg('ખેડૂતને ડેરી સહકારી મંડળી સાથે સફળતાપૂર્વક લિંક કરવામાં આવ્યા છે.');
      setIsLinkFarmerModalOpen(false);

      // Refresh list and drawer
      if (district) {
        const coops = await coopService.dahoListCooperatives(apiBaseUrl, { district_id: district.id });
        setCooperatives(coops);
      }
      if (drawerOpen && selectedCoopDetail?.id === targetCoopForLink.id) {
        const members = await coopService.dahoListMembers(apiBaseUrl, targetCoopForLink.id);
        setDrawerMembers(members);
      }
    } catch (err: any) {
      alert(err?.message || 'સભાસદ લિંક કરવામાં નિષ્ફળ');
    } finally {
      setIsLinking(false);
    }
  };

  // Unlink Farmer
  const handleUnlinkFarmer = async (coopId: string, farmerId: string, farmerName: string) => {
    if (!window.confirm(`શું તમે ખરેખર ખેડૂત '${farmerName}' નું સભાસદપદ રદ કરવા માંગો છો?`)) return;

    try {
      await coopService.dahoUnlinkMember(apiBaseUrl, coopId, farmerId);
      setSuccessMsg('સભાસદ ખેડૂતને સફળતાપૂર્વક દૂર કરવામાં આવ્યા.');
      const members = await coopService.dahoListMembers(apiBaseUrl, coopId);
      setDrawerMembers(members);
      if (district) {
        const coops = await coopService.dahoListCooperatives(apiBaseUrl, { district_id: district.id });
        setCooperatives(coops);
      }
    } catch (err: any) {
      alert(err?.message || 'સભાસદ દૂર કરવામાં નિષ્ફળ');
    }
  };

  // Demo Seeding / Reset
  const handleSeedDemo = async () => {
    if (!district) return;
    if (!window.confirm('શું તમે ૨ પૂર્ણ [DEMO] ડેરી સહકારી મંડળીઓ અને લિંક કરેલ સભાસદો ઉમેરવા માંગો છો?')) return;
    setIsLoading(true);
    try {
      await coopService.dahoSeedDemo(apiBaseUrl, district.id);
      setSuccessMsg('૨ ડેમો સહકારી મંડળીઓ સફળતાપૂર્વક તૈયાર કરવામાં આવી.');
      const coops = await coopService.dahoListCooperatives(apiBaseUrl, { district_id: district.id });
      setCooperatives(coops);
    } catch (err: any) {
      alert(err?.message || 'ડેમો ડેટા બનાવવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!district) return;
    if (!window.confirm('શું તમે તમામ [DEMO] ડેરી સહકારી મંડળીઓ સાફ કરવા માંગો છો?')) return;
    setIsLoading(true);
    try {
      await coopService.dahoResetDemo(apiBaseUrl, district.id);
      setSuccessMsg('ડેમો મંડળીઓ સાફ કરવામાં આવી.');
      const coops = await coopService.dahoListCooperatives(apiBaseUrl, { district_id: district.id });
      setCooperatives(coops);
    } catch (err: any) {
      alert(err?.message || 'ડેમો ડેટા સાફ કરવામાં નિષ્ફળ');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && cooperatives.length === 0) {
    return <StateView state="loading" message="ડેરી સહકારી મંડળીઓ લોડ થઈ રહી છે..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-[#135D43] rounded-lg">
              <Building2 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ડેરી સહકારી મંડળી સંચાલન</h1>
              <p className="text-sm text-slate-600">
                {district ? `${district.name_gu} જિલ્લો` : 'જિલ્લો'} • મંડળી નોંધણી, ખેડૂત લિંકિંગ અને પોર્ટલ એક્ટિવેશન
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDemo}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
            title="૨ ડેમો મંડળીઓ ઉમેરો"
          >
            <Sparkles className="w-4 h-4 mr-1 text-amber-600" />
            ડેમો ઉમેરો
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDemo}
            className="text-slate-600 hover:bg-slate-100"
            title="ડેમો ડેટા સાફ કરો"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            ડેમો રીસેટ
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setAddFormError(null);
              setIsAddModalOpen(true);
            }}
            className="bg-[#135D43] hover:bg-[#114B36] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            નવી ડેરી મંડળી ઉમેરો
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-sm font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-700 hover:text-red-900 text-sm font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Created Credentials Modal Alert */}
      {createdCredentialsAlert && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              નવું ડેરી પોર્ટલ એકાઉન્ટ સફળતાપૂર્વક બની ગયું છે
            </h4>
            <button
              onClick={() => setCreatedCredentialsAlert(null)}
              className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded hover:bg-emerald-300"
            >
              બંધ કરો
            </button>
          </div>
          <p className="text-xs text-emerald-700">
            સત્તાવાર ઓનબોર્ડિંગ ઈમેઇલ સંપર્ક સરનામે મોકલવામાં આવ્યો છે. નીચેની વિગતો નોંધણી અધિકારી માટે છે:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-emerald-200 text-xs">
            <div>
              <span className="text-slate-500 block">ઈમેઇલ:</span>
              <strong className="text-slate-900">{createdCredentialsAlert.email}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">યુઝરનેમ:</span>
              <strong className="text-slate-900">{createdCredentialsAlert.username}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">પાસવર્ડ:</span>
              <code className="text-[#135D43] font-bold bg-emerald-50 px-2 py-0.5 rounded">
                {createdCredentialsAlert.tempPass}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500">કુલ ડેરી મંડળીઓ</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
            <p className="text-xs text-slate-500 mt-1">{activeCount} સક્રિય</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-[#135D43] rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500">સભાસદ ખેડૂતો</p>
            <p className="text-2xl font-bold text-[#135D43] mt-1">{totalFarmers.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">મંડળી સાથે જોડાયેલ</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500">સંલગ્ન પશુધન</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalAnimals.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 mt-1">{totalVax.toLocaleString()} રસીકૃત</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <PawPrint className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500">સરેરાશ રસીકરણ કવરેજ</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{avgCoverage}%</p>
            <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${avgCoverage}%` }} />
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <Syringe className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="મંડળી નામ, કોડ, સંપર્ક વ્યક્તિ, રજીસ્ટ્રેશન નંબર અથવા મોબાઇલ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#135D43]"
            />
          </div>

          {/* Taluka Dropdown */}
          <div className="w-full md:w-48">
            <select
              value={selectedTalukaFilter}
              onChange={(e) => setSelectedTalukaFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#135D43] bg-white"
            >
              <option value="">તમામ તાલુકા</option>
              {talukas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name_gu} ({t.name_en})
                </option>
              ))}
            </select>
          </div>

          {/* Village Dropdown */}
          <div className="w-full md:w-48">
            <select
              value={selectedVillageFilter}
              onChange={(e) => setSelectedVillageFilter(e.target.value)}
              disabled={!selectedTalukaFilter}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#135D43] bg-white disabled:bg-slate-100"
            >
              <option value="">તમામ ગામો</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name_gu} ({v.name_en})
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="w-full md:w-36">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#135D43] bg-white"
            >
              <option value="">તમામ સ્થિતિ</option>
              <option value="ACTIVE">સક્રિય (ACTIVE)</option>
              <option value="INACTIVE">નિષ્ક્રિય (INACTIVE)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(selectedTalukaFilter || selectedVillageFilter || statusFilter || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTalukaFilter('');
                setSelectedVillageFilter('');
                setStatusFilter('');
                setSearchQuery('');
              }}
              className="text-slate-600 hover:bg-slate-100 shrink-0"
            >
              રીસેટ
            </Button>
          )}
        </div>
      </Card>

      {/* Cooperatives Table */}
      <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            સહકારી મંડળીઓની યાદી ({filteredCooperatives.length})
          </h3>
          <span className="text-xs text-slate-500">
            જિલ્લા સ્તરે અધિકૃત ડેરી સહકારી મંડળીઓ
          </span>
        </div>

        {filteredCooperatives.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-slate-600 font-medium">કોઈ સહકારી મંડળી મળી નથી.</p>
            <p className="text-xs text-slate-400">
              તમે 'નવી ડેરી મંડળી ઉમેરો' બટન પર ક્લિક કરીને નવી મંડળી રજીસ્ટર કરી શકો છો અથવા 'ડેમો ઉમેરો' વડે નમૂના ડેટા જોઈ શકો છો.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">મંડળી કોડ અને નામ</th>
                  <th className="p-3">તાલુકો / ગામ</th>
                  <th className="p-3">સંપર્ક વ્યક્તિ અને હોદ્દો</th>
                  <th className="p-3">સંપર્ક વિગતો</th>
                  <th className="p-3 text-center">સભાસદો</th>
                  <th className="p-3 text-center">પશુધન</th>
                  <th className="p-3">કવરેજ</th>
                  <th className="p-3 text-center">સ્થિતિ</th>
                  <th className="p-3 text-right">ક્રિયાઓ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCooperatives.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{c.name_gu}</span>
                        {c.is_demo && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded font-semibold">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-slate-700">{c.code}</code>
                        {c.registration_no && <span>• રેગિ: {c.registration_no}</span>}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-900 font-medium">{c.taluka_name || 'N/A'}</div>
                      <div className="text-slate-500 text-[11px]">{c.village_name || 'N/A'}</div>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-900 font-medium">{c.contact_person || 'N/A'}</div>
                      <div className="text-slate-500 text-[11px]">{c.designation || 'સચિવ'}</div>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-900">{c.mobile_e164 || 'N/A'}</div>
                      <div className="text-slate-500 text-[11px] truncate max-w-[150px]" title={c.email || ''}>
                        {c.email || 'N/A'}
                      </div>
                    </td>

                    <td className="p-3 text-center font-bold text-blue-700">
                      {c.linked_farmers_count || 0}
                    </td>

                    <td className="p-3 text-center font-bold text-slate-800">
                      {c.linked_animals_count || 0}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              c.coverage_percent >= 80 ? 'bg-emerald-600' : c.coverage_percent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, c.coverage_percent)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-700">{c.coverage_percent}%</span>
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.status === 'ACTIVE' ? 'સક્રિય' : 'નિષ્ક્રિય'}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetailDrawer(c.id)}
                          className="text-[#135D43] border-[#135D43]/30 hover:bg-emerald-50 px-2 py-1 h-7 text-xs"
                          title="સંપૂર્ણ પ્રોફાઇલ જુઓ"
                        >
                          વિગત
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLinkFarmerModal(c)}
                          className="text-blue-700 border-blue-200 hover:bg-blue-50 px-2 py-1 h-7 text-xs"
                          title="ખેડૂત લિંક કરો"
                        >
                          + ખેડૂત
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendEmail(c)}
                          disabled={actionLoadingId === c.id}
                          className="text-slate-600 hover:bg-slate-100 px-2 py-1 h-7 text-xs"
                          title="ઓનબોર્ડિંગ ઈમેઇલ ફરી મોકલો"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(c)}
                          disabled={actionLoadingId === c.id}
                          className={`px-2 py-1 h-7 text-xs ${
                            c.status === 'ACTIVE'
                              ? 'text-red-700 border-red-200 hover:bg-red-50'
                              : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          }`}
                          title={c.status === 'ACTIVE' ? 'નિષ્ક્રિય કરો' : 'સક્રિય કરો'}
                        >
                          {c.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===================================================================== */}
      {/* ADD COOPERATIVE MODAL                                                 */}
      {/* ===================================================================== */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="નવી ડેરી સહકારી મંડળી ઉમેરો (Add Dairy Cooperative)"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateCooperative} className="space-y-4 text-xs">
            {addFormError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{addFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">જિલ્લો (District) *</label>
                <input
                  type="text"
                  disabled
                  value={district?.name_gu || 'બોટાદ'}
                  className="w-full p-2 border border-slate-200 rounded bg-slate-100 text-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">તાલુકો (Taluka) *</label>
                <select
                  required
                  value={addForm.taluka_id}
                  onChange={(e) => handleAddTalukaChange(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 focus:ring-1 focus:ring-[#135D43]"
                >
                  <option value="">-- તાલુકો પસંદ કરો --</option>
                  {talukas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name_gu} ({t.name_en})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">મુખ્ય ગામ (Village) *</label>
                <select
                  required
                  disabled={!addForm.taluka_id}
                  value={addForm.village_id}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, village_id: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 focus:ring-1 focus:ring-[#135D43] disabled:bg-slate-100"
                >
                  <option value="">-- ગામ પસંદ કરો --</option>
                  {addFormVillages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name_gu} ({v.name_en})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">મંડળી નામ (ગુજરાતી) *</label>
                <input
                  type="text"
                  required
                  placeholder="દા.ત. બોટાદ દૂધ ઉત્પાદક સહકારી મંડળી"
                  value={addForm.name_gu}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name_gu: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Cooperative Name (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Botad Milk Producers Cooperative Society"
                  value={addForm.name_en}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name_en: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">મંડળી કોડ (Unique Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="COOP_BOTAD_01"
                  value={addForm.code}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">નોંધણી નંબર (Reg No)</label>
                <input
                  type="text"
                  placeholder="REG/BOTAD/D/2026/01"
                  value={addForm.registration_no || ''}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, registration_no: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">મંડળી પ્રકાર</label>
                <select
                  value={addForm.org_type}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, org_type: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-[#135D43]"
                >
                  <option value="DAIRY_COOPERATIVE">ડેરી સહકારી મંડળી (Dairy Cooperative)</option>
                  <option value="MILK_UNION">દૂધ સંઘ (Milk Union)</option>
                  <option value="OTHER">અન્ય પશુપાલન મંડળી (Other)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">સંપર્ક વ્યક્તિનું નામ *</label>
                <input
                  type="text"
                  required
                  placeholder="દા.ત. રમેશભાઈ પટેલ"
                  value={addForm.contact_person}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, contact_person: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">હોદ્દો (Designation)</label>
                <input
                  type="text"
                  placeholder="સચિવ / મંત્રી / મેનેજર"
                  value={addForm.designation || ''}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, designation: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">મોબાઇલ નંબર (10 અંક) *</label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={addForm.mobile_e164}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, mobile_e164: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">ઈમેઇલ સરનામું (Portal Login) *</label>
                <input
                  type="email"
                  required
                  placeholder="secretary@botaddairy.org"
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-[#135D43]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">સરનામું (Address)</label>
                <input
                  type="text"
                  placeholder="ડેરી બિલ્ડીંગ, સ્ટેશન રોડ"
                  value={addForm.address || ''}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">પીનકોડ (Postal Code)</label>
                <input
                  type="text"
                  placeholder="364710"
                  value={addForm.postal_code || ''}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmittingAdd} className="bg-[#135D43] text-white">
                {isSubmittingAdd ? 'નોંધણી થઈ રહી છે...' : 'સહકારી મંડળી સાચવો અને ઈમેઇલ મોકલો'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* COOPERATIVE DETAIL DRAWER                                             */}
      {/* ===================================================================== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-sm">
          {isDrawerLoading ? (
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex items-center justify-center p-8">
              <StateView state="loading" message="મંડળી વિગતો લોડ થઈ રહી છે..." />
            </div>
          ) : selectedCoopDetail ? (
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{selectedCoopDetail.name_gu}</h2>
                  {selectedCoopDetail.is_demo && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded font-bold">
                      DEMO
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedCoopDetail.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedCoopDetail.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedCoopDetail.name_en} • <code className="bg-slate-200 px-1 rounded">{selectedCoopDetail.code}</code>
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* 4 Mini KPI Tiles */}
            <div className="grid grid-cols-4 gap-2 p-3 bg-white border-b border-slate-200 text-center text-xs">
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">સભાસદ ખેડૂતો</span>
                <strong className="text-base text-blue-700">{selectedCoopDetail.linked_farmers_count}</strong>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">કુલ પશુધન</span>
                <strong className="text-base text-slate-900">{selectedCoopDetail.linked_animals_count}</strong>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">કવરેજ ટકાવારી</span>
                <strong className="text-base text-emerald-700">{selectedCoopDetail.coverage_percent}%</strong>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">સક્રિય ઝુંબેશો</span>
                <strong className="text-base text-amber-700">{selectedCoopDetail.active_campaigns_count}</strong>
              </div>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-200 px-4 bg-slate-50 text-xs font-medium">
              <button
                onClick={() => setDrawerTab('profile')}
                className={`py-2.5 px-3 border-b-2 ${
                  drawerTab === 'profile' ? 'border-[#135D43] text-[#135D43] font-bold' : 'border-transparent text-slate-500'
                }`}
              >
                સામાન્ય વિગતો
              </button>
              <button
                onClick={() => setDrawerTab('farmers')}
                className={`py-2.5 px-3 border-b-2 ${
                  drawerTab === 'farmers' ? 'border-[#135D43] text-[#135D43] font-bold' : 'border-transparent text-slate-500'
                }`}
              >
                સભાસદ ખેડૂત યાદી ({drawerMembers.length})
              </button>
              <button
                onClick={() => setDrawerTab('animals')}
                className={`py-2.5 px-3 border-b-2 ${
                  drawerTab === 'animals' ? 'border-[#135D43] text-[#135D43] font-bold' : 'border-transparent text-slate-500'
                }`}
              >
                રસીકરણ વિશ્લેષણ
              </button>
              <button
                onClick={() => setDrawerTab('villages')}
                className={`py-2.5 px-3 border-b-2 ${
                  drawerTab === 'villages' ? 'border-[#135D43] text-[#135D43] font-bold' : 'border-transparent text-slate-500'
                }`}
              >
                રોગ સર્વેલન્સ
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-700 space-y-4">
              {drawerTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[11px]">જિલ્લો / તાલુકો</span>
                      <strong className="text-slate-800">{selectedCoopDetail.district_name} / {selectedCoopDetail.taluka_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">મુખ્ય ગામ</span>
                      <strong className="text-slate-800">{selectedCoopDetail.village_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">સંપર્ક વ્યક્તિ અને હોદ્દો</span>
                      <strong className="text-slate-800">{selectedCoopDetail.contact_person} ({selectedCoopDetail.designation || 'સચિવ'})</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">મોબાઇલ નંબર</span>
                      <strong className="text-slate-800">{selectedCoopDetail.mobile_e164}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">સત્તાવાર ઈમેઇલ</span>
                      <strong className="text-slate-800">{selectedCoopDetail.email}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">નોંધણી નંબર</span>
                      <strong className="text-slate-800">{selectedCoopDetail.registration_no || 'N/A'}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px]">સરનામું</span>
                      <strong className="text-slate-800">{selectedCoopDetail.address || 'N/A'} {selectedCoopDetail.postal_code ? `- ${selectedCoopDetail.postal_code}` : ''}</strong>
                    </div>
                  </div>

                  {/* Portal User Status */}
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-2">
                    <h4 className="font-bold text-[#135D43] flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" />
                      પોર્ટલ લોગિન અને એકાઉન્ટ સ્થિતિ
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">યુઝરનેમ:</span> <strong>{selectedCoopDetail.username || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">એકાઉન્ટ સ્થિતિ:</span> <strong>{selectedCoopDetail.user_status || 'ACTIVE'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">નોંધણી તારીખ:</span>{' '}
                        <span>{new Date(selectedCoopDetail.created_at).toLocaleDateString('gu-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">છેલ્લું લોગિન:</span>{' '}
                        <span>
                          {selectedCoopDetail.last_login_at
                            ? new Date(selectedCoopDetail.last_login_at).toLocaleString('gu-IN')
                            : 'હજી લોગિન કરેલ નથી'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'farmers' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">લિંક થયેલ સભાસદ ખેડૂતો ({drawerMembers.length})</span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenLinkFarmerModal(selectedCoopDetail)}
                      className="bg-[#135D43] text-white text-xs h-7"
                    >
                      + નવો સભાસદ ઉમેરો
                    </Button>
                  </div>

                  {drawerMembers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl">
                      હજી કોઈ ખેડૂત આ મંડળી સાથે લિંક કરેલ નથી. ઉપર '+ નવો સભાસદ ઉમેરો' બટન વડે ખેડૂત લિંક કરો.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {drawerMembers.map((m) => (
                        <div key={m.farmer_id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{m.full_name_gu}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="bg-blue-50 text-blue-700 px-1 rounded font-mono">{m.member_no || 'MBR'}</span>
                              <span>• {m.village_name}</span>
                              <span>• {m.mobile_e164 || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <span className="text-slate-500 block text-[10px]">પશુધન / કવરેજ</span>
                              <strong className="text-slate-800">{m.total_animals} પશુ</strong> ({m.coverage_percent}%)
                            </div>
                            <button
                              onClick={() => handleUnlinkFarmer(selectedCoopDetail.id, m.farmer_id, m.full_name_gu)}
                              className="text-red-500 hover:text-red-700 font-bold p-1 rounded"
                              title="સભાસદપદ રદ કરો"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerTab === 'animals' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-emerald-700 block text-[11px]">સંપૂર્ણ રસીકૃત</span>
                      <strong className="text-lg text-emerald-800">{selectedCoopDetail.vaccinated_animals_count}</strong>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <span className="text-amber-700 block text-[11px]">બાકી રસીકરણ</span>
                      <strong className="text-lg text-amber-800">{selectedCoopDetail.pending_vaccinations_count}</strong>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-red-700 block text-[11px]">મુદતવીતી (Overdue)</span>
                      <strong className="text-lg text-red-800">{selectedCoopDetail.overdue_vaccinations_count}</strong>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    ડેરી સહકારી મંડળી ફક્ત સંલગ્ન સભાસદોના પશુધનની રસીકરણ સ્થિતિનું ટેલિમેટ્રી મોનિટરિંગ કરી શકે છે.
                  </p>
                </div>
              )}

              {drawerTab === 'villages' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                    <strong className="block mb-1">રોગ સર્વેલન્સ સુવિધા (Read-only Observation):</strong>
                    મંડળી કાર્યક્ષેત્ર ગામોમાં પશુ રોગચાળાની શંકાસ્પદ ચેતવણીઓની સ્થિતિ: <strong>{selectedCoopDetail.suspected_disease_cases_count} કેસ</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResendEmail(selectedCoopDetail)}
                className="text-slate-700"
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                ઓનબોર્ડિંગ ઈમેઇલ મોકલો
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleToggleStatus(selectedCoopDetail)}
                className={selectedCoopDetail.status === 'ACTIVE' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}
              >
                {selectedCoopDetail.status === 'ACTIVE' ? 'મંડળી નિષ્ક્રિય કરો' : 'મંડળી સક્રિય કરો'}
              </Button>
            </div>
          </div>
          ) : null}
        </div>
      )}

      {/* ===================================================================== */}
      {/* LINK FARMER MODAL                                                     */}
      {/* ===================================================================== */}
      {isLinkFarmerModalOpen && targetCoopForLink && (
        <Modal
          isOpen={isLinkFarmerModalOpen}
          onClose={() => setIsLinkFarmerModalOpen(false)}
          title={`ખેડૂત લિંક કરો — ${targetCoopForLink.name_gu}`}
          maxWidth="md"
        >
          <form onSubmit={handleLinkFarmerSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              મંડળીના કાર્યક્ષેત્ર ({targetCoopForLink.village_name || targetCoopForLink.taluka_name}) માં નોંધાયેલ ખેડૂતને સભાસદ તરીકે જોડો:
            </p>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">ખેડૂત પસંદ કરો *</label>
              <select
                required
                value={selectedFarmerId}
                onChange={(e) => setSelectedFarmerId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#135D43]"
              >
                <option value="">-- ખેડૂત પસંદ કરો --</option>
                {availableFarmers.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.full_name_gu || f.full_name_en} ({f.farmer_code}) • મો: {f.mobile_e164 || 'N/A'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">સભાસદ નંબર (Member ID)</label>
                <input
                  type="text"
                  placeholder="MBR-1001"
                  value={customMemberNo}
                  onChange={(e) => setCustomMemberNo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">જોડાણ તારીખ (Joined Date)</label>
                <input
                  type="date"
                  value={linkFarmerDate}
                  onChange={(e) => setLinkFarmerDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#135D43]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="outline" type="button" onClick={() => setIsLinkFarmerModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" type="submit" disabled={isLinking} className="bg-[#135D43] text-white">
                {isLinking ? 'લિંક થઈ રહ્યું છે...' : 'સભાસદ તરીકે જોડો'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
