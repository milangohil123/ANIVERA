import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  adminService,
  type TalukaItem,
  type VillageItem,
  type GramPanchayatItem,
  type CooperativeItem,
} from '../../services/adminService';
import { VillageLocationPicker } from '../../components/maps/VillageLocationPicker';
import {
  Plus,
  Search,
  RotateCcw,
  Layers,
  MapPin,
  Building,
  Briefcase,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type MasterDataTab = 'TALUKAS' | 'VILLAGES' | 'GRAM_PANCHAYATS' | 'COOPERATIVES';

// Zod Validation Schemas
const talukaSchema = z.object({
  code: z.string().trim().min(2, 'કોડ ઓછામાં ઓછો ૨ અક્ષરનો હોવો જોઈએ').max(30),
  name_gu: z.string().trim().min(1, 'ગુજરાતી નામ જરૂરી છે'),
  name_en: z.string().trim().min(1, 'અંગ્રેજી નામ જરૂરી છે'),
});

const villageSchema = z.object({
  taluka_id: z.string().uuid('કૃપા કરીને માન્ય તાલુકો પસંદ કરો'),
  code: z.string().trim().min(2, 'કોડ ઓછામાં ઓછો ૨ અક્ષરનો હોવો જોઈએ').max(30),
  name_gu: z.string().trim().min(1, 'ગુજરાતી નામ જરૂરી છે'),
  name_en: z.string().trim().min(1, 'અંગ્રેજી નામ જરૂરી છે'),
  census_code: z.string().trim().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  is_pilot: z.boolean().default(false),
  google_place_id: z.string().optional().nullable(),
  formatted_address: z.string().optional().nullable(),
});

const gpSchema = z.object({
  taluka_id: z.string().uuid('કૃપા કરીને માન્ય તાલુકો પસંદ કરો'),
  code: z.string().trim().min(2, 'કોડ ઓછામાં ઓછો ૨ અક્ષરનો હોવો જોઈએ').max(30),
  name_gu: z.string().trim().min(1, 'ગુજરાતી નામ જરૂરી છે'),
  name_en: z.string().trim().min(1, 'અંગ્રેજી નામ જરૂરી છે'),
});

const coopSchema = z.object({
  code: z.string().trim().min(2, 'કોડ ઓછામાં ઓછો ૨ અક્ષરનો હોવો જોઈએ').max(30),
  name_gu: z.string().trim().min(1, 'ગુજરાતી નામ જરૂરી છે'),
  name_en: z.string().trim().min(1, 'અંગ્રેજી નામ જરૂરી છે'),
  org_type: z.enum(['DAIRY_COOPERATIVE', 'MILK_UNION', 'OTHER']).default('DAIRY_COOPERATIVE'),
});

export const DahoMasterDataView: React.FC = () => {
  const { apiBaseUrl, scope, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterDataTab>('TALUKAS');
  const [searchTerm, setSearchTerm] = useState('');

  // Data lists
  const [talukas, setTalukas] = useState<TalukaItem[]>([]);
  const [villages, setVillages] = useState<VillageItem[]>([]);
  const [gps, setGps] = useState<GramPanchayatItem[]>([]);
  const [cooperatives, setCooperatives] = useState<CooperativeItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [selectedEntityForMap, setSelectedEntityForMap] = useState<{ id: string; name: string } | null>(null);
  const [selectedVillageIdToMap, setSelectedVillageIdToMap] = useState('');

  // Form Fields State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Taluka Form
  const [tCode, setTCode] = useState('');
  const [tNameGu, setTNameGu] = useState('');
  const [tNameEn, setTNameEn] = useState('');

  // Village Form
  const [vTalukaId, setVTalukaId] = useState('');
  const [vCode, setVCode] = useState('');
  const [vNameGu, setVNameGu] = useState('');
  const [vNameEn, setVNameEn] = useState('');
  const [vCensus, setVCensus] = useState('');
  const [vLat, setVLat] = useState<number | null>(null);
  const [vLng, setVLng] = useState<number | null>(null);
  const [vPlaceId, setVPlaceId] = useState<string>('');
  const [vAddress, setVAddress] = useState<string>('');
  const [vIsPilot, setVIsPilot] = useState(false);

  // GP Form
  const [gpTalukaId, setGpTalukaId] = useState('');
  const [gpCode, setGpCode] = useState('');
  const [gpNameGu, setGpNameGu] = useState('');
  const [gpNameEn, setGpNameEn] = useState('');

  // Coop Form
  const [cCode, setCCode] = useState('');
  const [cNameGu, setCNameGu] = useState('');
  const [cNameEn, setCNameEn] = useState('');
  const [cOrgType, setCOrgType] = useState('DAIRY_COOPERATIVE');

  // Active district UUID from DAHO security scope
  const assignedDistrictId = scope?.assigned_districts?.[0] || profile?.assigned_districts?.[0];

  const loadData = async () => {
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
        adminService.listTalukas(apiBaseUrl, districtId),
        adminService.listVillages(apiBaseUrl, districtId),
        adminService.listGramPanchayats(apiBaseUrl, districtId),
        adminService.listCooperatives(apiBaseUrl),
      ]);

      if (results[0].status === 'fulfilled') setTalukas(results[0].value);
      if (results[1].status === 'fulfilled') setVillages(results[1].value);
      if (results[2].status === 'fulfilled') setGps(results[2].value);
      if (results[3].status === 'fulfilled') setCooperatives(results[3].value);

      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (rejected.length === results.length) {
        const firstErr = rejected[0].reason instanceof Error ? rejected[0].reason.message : 'માહિતી લોડ કરવામાં નિષ્ફળ.';
        setNotice({
          type: 'error',
          message: firstErr,
        });
      } else if (rejected.length > 0) {
        console.warn('Some master data tabs failed to load:', rejected);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'માહિતી લોડ કરવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignedDistrictId, apiBaseUrl]);

  // Create Handlers
  const handleCreateTaluka = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const validation = talukaSchema.safeParse({ code: tCode, name_gu: tNameGu, name_en: tNameEn });
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
      await adminService.createTaluka(apiBaseUrl, {
        district_id: assignedDistrictId!,
        code: tCode,
        name_gu: tNameGu,
        name_en: tNameEn,
      });
      setNotice({ type: 'success', message: 'તાલુકો સફળતાપૂર્વક ઉમેરાયો.' });
      setIsCreateModalOpen(false);
      setTCode('');
      setTNameGu('');
      setTNameEn('');
      await loadData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const validation = villageSchema.safeParse({
      taluka_id: vTalukaId,
      code: vCode,
      name_gu: vNameGu,
      name_en: vNameEn,
      census_code: vCensus,
      latitude: vLat,
      longitude: vLng,
      is_pilot: vIsPilot,
      google_place_id: vPlaceId,
      formatted_address: vAddress,
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
      await adminService.createVillage(apiBaseUrl, {
        district_id: assignedDistrictId!,
        taluka_id: vTalukaId,
        code: vCode,
        name_gu: vNameGu,
        name_en: vNameEn,
        census_code: vCensus.trim() || null,
        latitude: vLat !== null ? Number(vLat) : null,
        longitude: vLng !== null ? Number(vLng) : null,
        is_pilot: vIsPilot,
      });
      setNotice({ type: 'success', message: 'ગામ અને તેનું ચોક્કસ ભૌગોલિક સ્થાન સફળતાપૂર્વક ઉમેરાયું.' });
      setIsCreateModalOpen(false);
      setVCode('');
      setVNameGu('');
      setVNameEn('');
      setVCensus('');
      setVLat(null);
      setVLng(null);
      setVPlaceId('');
      setVAddress('');
      await loadData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGP = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const validation = gpSchema.safeParse({
      taluka_id: gpTalukaId,
      code: gpCode,
      name_gu: gpNameGu,
      name_en: gpNameEn,
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
      await adminService.createGramPanchayat(apiBaseUrl, {
        taluka_id: gpTalukaId,
        code: gpCode,
        name_gu: gpNameGu,
        name_en: gpNameEn,
      });
      setNotice({ type: 'success', message: 'ગ્રામ પંચાયત સફળતાપૂર્વક ઉમેરાઈ.' });
      setIsCreateModalOpen(false);
      setGpCode('');
      setGpNameGu('');
      setGpNameEn('');
      await loadData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCoop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const validation = coopSchema.safeParse({
      code: cCode,
      name_gu: cNameGu,
      name_en: cNameEn,
      org_type: cOrgType,
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
      await adminService.createCooperative(apiBaseUrl, {
        code: cCode,
        name_gu: cNameGu,
        name_en: cNameEn,
        org_type: cOrgType,
      });
      setNotice({ type: 'success', message: 'સહકારી મંડળી સફળતાપૂર્વક ઉમેરાઈ.' });
      setIsCreateModalOpen(false);
      setCCode('');
      setCNameGu('');
      setCNameEn('');
      await loadData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Village Mapping Handlers
  const handleMapVillage = async () => {
    if (!selectedEntityForMap || !selectedVillageIdToMap) return;
    setIsSubmitting(true);
    try {
      if (activeTab === 'GRAM_PANCHAYATS') {
        await adminService.mapGPVillage(apiBaseUrl, selectedEntityForMap.id, selectedVillageIdToMap);
        setNotice({ type: 'success', message: 'ગામ ગ્રામ પંચાયત સાથે લિંક થયું.' });
      } else if (activeTab === 'COOPERATIVES') {
        await adminService.mapCooperativeVillage(apiBaseUrl, selectedEntityForMap.id, selectedVillageIdToMap);
        setNotice({ type: 'success', message: 'ગામ સહકારી મંડળી સાથે મેપ થયું.' });
      }
      setIsMapModalOpen(false);
      setSelectedEntityForMap(null);
      setSelectedVillageIdToMap('');
      await loadData();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'નિષ્ફળ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Lists
  const filteredTalukas = talukas.filter(
    (t) =>
      t.name_gu.includes(searchTerm) ||
      t.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.includes(searchTerm.toUpperCase())
  );

  const filteredVillages = villages.filter(
    (v) =>
      v.name_gu.includes(searchTerm) ||
      v.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.code.includes(searchTerm.toUpperCase())
  );

  const filteredGPs = gps.filter(
    (g) =>
      g.name_gu.includes(searchTerm) ||
      g.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.code.includes(searchTerm.toUpperCase())
  );

  const filteredCooperatives = cooperatives.filter(
    (c) =>
      c.name_gu.includes(searchTerm) ||
      c.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.includes(searchTerm.toUpperCase())
  );

  // Column Definitions
  const talukaColumns: Column<TalukaItem>[] = [
    { key: 'code', header: 'કોડ', render: (t) => <span className="font-mono font-semibold">{t.code}</span> },
    { key: 'name_gu', header: 'તાલુકા નામ (ગુજરાતી)', render: (t) => <span className="font-bold">{t.name_gu}</span> },
    { key: 'name_en', header: 'અંગ્રેજી નામ' },
  ];

  const villageColumns: Column<VillageItem>[] = [
    { key: 'code', header: 'ગામ કોડ', render: (v) => <span className="font-mono font-semibold">{v.code}</span> },
    { key: 'name_gu', header: 'ગામ નામ', render: (v) => <span className="font-bold">{v.name_gu}</span> },
    { key: 'name_en', header: 'અંગ્રેજી નામ' },
    {
      key: 'coord_status',
      header: 'GPS સ્થિતિ',
      render: (v) => {
        let variant: 'success' | 'warning' | 'neutral' = 'neutral';
        let label = 'અનુપલબ્ધ (Unavailable)';
        if (v.coord_status === 'VERIFIED') {
          variant = 'success';
          label = 'ચકાસાયેલ (Verified)';
        } else if (v.coord_status === 'APPROXIMATE' || v.coord_status === 'UNVERIFIED') {
          variant = 'warning';
          label = 'અંદાજિત (Approximate)';
        }
        return <StatusChip label={label} variant={variant} size="sm" />;
      },
    },
    {
      key: 'is_pilot',
      header: 'પાઇલટ સ્થિતિ',
      render: (v) => (v.is_pilot ? <StatusChip label="પાઇલટ ગામ" variant="info" size="sm" /> : '—'),
    },
  ];

  const gpColumns: Column<GramPanchayatItem>[] = [
    { key: 'code', header: 'કોડ', render: (g) => <span className="font-mono font-semibold">{g.code}</span> },
    { key: 'name_gu', header: 'ગ્રામ પંચાયત નામ', render: (g) => <span className="font-bold">{g.name_gu}</span> },
    { key: 'name_en', header: 'અંગ્રેજી નામ' },
    {
      key: 'associated_village_ids',
      header: 'જોડાયેલ ગામો',
      render: (g) => <span className="font-mono">{g.associated_village_ids?.length || 0} ગામ</span>,
    },
    {
      key: 'actions',
      header: 'ક્રિયાઓ',
      render: (g) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedEntityForMap({ id: g.id, name: g.name_gu });
            setIsMapModalOpen(true);
          }}
          leftIcon={<LinkIcon className="w-3.5 h-3.5" />}
        >
          ગામ લિંક કરો
        </Button>
      ),
    },
  ];

  const coopColumns: Column<CooperativeItem>[] = [
    { key: 'code', header: 'કોડ', render: (c) => <span className="font-mono font-semibold">{c.code}</span> },
    { key: 'name_gu', header: 'મંડળી નામ', render: (c) => <span className="font-bold">{c.name_gu}</span> },
    { key: 'org_type', header: 'પ્રકાર' },
    {
      key: 'served_village_ids',
      header: 'આવરેલ ગામો',
      render: (c) => <span className="font-mono">{c.served_village_ids?.length || 0} ગામ</span>,
    },
    {
      key: 'actions',
      header: 'ક્રિયાઓ',
      render: (c) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedEntityForMap({ id: c.id, name: c.name_gu });
            setIsMapModalOpen(true);
          }}
          leftIcon={<LinkIcon className="w-3.5 h-3.5" />}
        >
          ગામ મેપ કરો
        </Button>
      ),
    },
  ];

  if (!assignedDistrictId) {
    return (
      <StateView
        state="error"
        title="કોઈ સક્રિય જિલ્લો સોંપાયેલ નથી"
        message="માસ્ટર ડેટા જોવા અથવા ઉમેરવા માટે સક્રિય જિલ્લો સોંપાયેલ હોવો જરૂરી છે."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Navigation */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading">
            માસ્ટર ડેટા સંચાલન (Master Data Directory)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            તાલુકા, ગામો, ગ્રામ પંચાયતો અને દૂધ સહકારી મંડળીઓની વહીવટી નોંધણી
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            તાજું કરો
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setFormErrors({});
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            {activeTab === 'TALUKAS' && 'નવો તાલુકો'}
            {activeTab === 'VILLAGES' && 'નવું ગામ'}
            {activeTab === 'GRAM_PANCHAYATS' && 'નવી ગ્રામ પંચાયત'}
            {activeTab === 'COOPERATIVES' && 'નવી સહકારી મંડળી'}
          </Button>
        </div>
      </div>

      {/* Global Notice Banner */}
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
              onClick={() => loadData()}
              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              ફરી પ્રયાસ કરો (Retry)
            </button>
          )}
        </div>
      )}

      {/* Segmented Sub-Tab Switcher */}
      <div className="flex border-b border-[#E2E8F0] gap-4 text-sm font-semibold">
        <button
          onClick={() => {
            setActiveTab('TALUKAS');
            setSearchTerm('');
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'TALUKAS'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>તાલુકા ({talukas.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('VILLAGES');
            setSearchTerm('');
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'VILLAGES'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>ગામો ({villages.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('GRAM_PANCHAYATS');
            setSearchTerm('');
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'GRAM_PANCHAYATS'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>ગ્રામ પંચાયતો ({gps.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('COOPERATIVES');
            setSearchTerm('');
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'COOPERATIVES'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>સહકારી મંડળીઓ ({cooperatives.length})</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="કોડ અથવા નામ દ્વારા શોધો..."
            className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#135D43]"
          />
        </div>
      </div>

      {/* Tab Data Table */}
      {isLoading ? (
        <StateView state="loading" />
      ) : activeTab === 'TALUKAS' ? (
        <DataTable
          columns={talukaColumns}
          data={filteredTalukas}
          keyExtractor={(t) => t.id}
          pageSize={10}
          emptyMessage="કોઈ તાલુકો નોંધાયેલ નથી."
        />
      ) : activeTab === 'VILLAGES' ? (
        <DataTable
          columns={villageColumns}
          data={filteredVillages}
          keyExtractor={(v) => v.id}
          pageSize={10}
          emptyMessage="કોઈ ગામ નોંધાયેલ નથી."
        />
      ) : activeTab === 'GRAM_PANCHAYATS' ? (
        <DataTable
          columns={gpColumns}
          data={filteredGPs}
          keyExtractor={(g) => g.id}
          pageSize={10}
          emptyMessage="કોઈ ગ્રામ પંચાયત નોંધાયેલ નથી."
        />
      ) : (
        <DataTable
          columns={coopColumns}
          data={filteredCooperatives}
          keyExtractor={(c) => c.id}
          pageSize={10}
          emptyMessage="કોઈ સહકારી મંડળી નોંધાયેલ નથી."
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        maxWidth={activeTab === 'VILLAGES' ? 'xl' : 'md'}
        title={
          activeTab === 'TALUKAS'
            ? 'નવો તાલુકો ઉમેરો'
            : activeTab === 'VILLAGES'
            ? 'નવું ગામ ઉમેરો (Google Maps ભૌગોલિક સ્થાન સાથે)'
            : activeTab === 'GRAM_PANCHAYATS'
            ? 'નવી ગ્રામ પંચાયત ઉમેરો'
            : 'નવી સહકારી મંડળી ઉમેરો'
        }
      >
        {activeTab === 'TALUKAS' && (
          <form onSubmit={handleCreateTaluka} className="space-y-4">
            <FormField label="તાલુકા કોડ (Code)" required error={formErrors.code}>
              <input
                type="text"
                value={tCode}
                onChange={(e) => setTCode(e.target.value.toUpperCase())}
                placeholder="દા.ત. TALUKA_BOTAD"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-mono"
              />
            </FormField>
            <FormField label="ગુજરાતી નામ (Name in Gujarati)" required error={formErrors.name_gu}>
              <input
                type="text"
                value={tNameGu}
                onChange={(e) => setTNameGu(e.target.value)}
                placeholder="દા.ત. બોટાદ"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
            <FormField label="અંગ્રેજી નામ (Name in English)" required error={formErrors.name_en}>
              <input
                type="text"
                value={tNameEn}
                onChange={(e) => setTNameEn(e.target.value)}
                placeholder="દા.ત. Botad"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                સાચવો
              </Button>
            </div>
          </form>
        )}

        {activeTab === 'VILLAGES' && (
          <form onSubmit={handleCreateVillage} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="તાલુકો પસંદ કરો" required error={formErrors.taluka_id}>
                <select
                  value={vTalukaId}
                  onChange={(e) => setVTalukaId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs bg-white"
                >
                  <option value="">— તાલુકો પસંદ કરો —</option>
                  {talukas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name_gu} ({t.name_en})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="ગામ કોડ (Village Code)" required error={formErrors.code}>
                <input
                  type="text"
                  value={vCode}
                  onChange={(e) => setVCode(e.target.value.toUpperCase())}
                  placeholder="દા.ત. V_BOTAD_01"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-mono"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="ગુજરાતી ગામનું નામ" required error={formErrors.name_gu}>
                <input
                  type="text"
                  value={vNameGu}
                  onChange={(e) => setVNameGu(e.target.value)}
                  placeholder="દા.ત. પાળીયાદ"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
                />
              </FormField>

              <FormField label="અંગ્રેજી ગામનું નામ" required error={formErrors.name_en}>
                <input
                  type="text"
                  value={vNameEn}
                  onChange={(e) => setVNameEn(e.target.value)}
                  placeholder="દા.ત. Paliyad"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
                />
              </FormField>
            </div>

            {/* Google Maps Location Search, Drag & Confirm */}
            <VillageLocationPicker
              talukaName={talukas.find((t) => t.id === vTalukaId)?.name_gu || 'બોટાદ'}
              districtName="બોટાદ"
              initialLat={vLat}
              initialLng={vLng}
              onLocationConfirmed={(loc) => {
                setVLat(loc.latitude);
                setVLng(loc.longitude);
                setVPlaceId(loc.googlePlaceId || '');
                setVAddress(loc.formattedAddress || '');
              }}
            />

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={vIsPilot}
                  onChange={(e) => setVIsPilot(e.target.checked)}
                  className="rounded border-gray-300 text-[#135D43] focus:ring-[#135D43]"
                />
                <span>પાઇલટ ગામ તરીકે ચિહ્નિત કરો (Is Pilot Village)</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                ગામ સાચવો
              </Button>
            </div>
          </form>
        )}

        {activeTab === 'GRAM_PANCHAYATS' && (
          <form onSubmit={handleCreateGP} className="space-y-4">
            <FormField label="તાલુકો પસંદ કરો" required error={formErrors.taluka_id}>
              <select
                value={gpTalukaId}
                onChange={(e) => setGpTalukaId(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              >
                <option value="">— તાલુકો પસંદ કરો —</option>
                {talukas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_gu} ({t.name_en})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="પંચાયત કોડ" required error={formErrors.code}>
              <input
                type="text"
                value={gpCode}
                onChange={(e) => setGpCode(e.target.value.toUpperCase())}
                placeholder="દા.ત. GP_PALIYAD"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-mono"
              />
            </FormField>
            <FormField label="ગુજરાતી નામ" required error={formErrors.name_gu}>
              <input
                type="text"
                value={gpNameGu}
                onChange={(e) => setGpNameGu(e.target.value)}
                placeholder="દા.ત. પાળીયાદ ગ્રામ પંચાયત"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
            <FormField label="અંગ્રેજી નામ" required error={formErrors.name_en}>
              <input
                type="text"
                value={gpNameEn}
                onChange={(e) => setGpNameEn(e.target.value)}
                placeholder="દા.ત. Paliyad Gram Panchayat"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                સાચવો
              </Button>
            </div>
          </form>
        )}

        {activeTab === 'COOPERATIVES' && (
          <form onSubmit={handleCreateCoop} className="space-y-4">
            <FormField label="મંડળી કોડ" required error={formErrors.code}>
              <input
                type="text"
                value={cCode}
                onChange={(e) => setCCode(e.target.value.toUpperCase())}
                placeholder="દા.ત. COOP_BOTAD_01"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-mono"
              />
            </FormField>
            <FormField label="ગુજરાતી નામ" required error={formErrors.name_gu}>
              <input
                type="text"
                value={cNameGu}
                onChange={(e) => setCNameGu(e.target.value)}
                placeholder="દા.ત. બોટાદ દૂધ ઉત્પાદક મંડળી"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
            <FormField label="અંગ્રેજી નામ" required error={formErrors.name_en}>
              <input
                type="text"
                value={cNameEn}
                onChange={(e) => setCNameEn(e.target.value)}
                placeholder="દા.ત. Botad Milk Cooperative"
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              />
            </FormField>
            <FormField label="સંસ્થાનો પ્રકાર (Organisation Type)">
              <select
                value={cOrgType}
                onChange={(e) => setCOrgType(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
              >
                <option value="DAIRY_COOPERATIVE">દૂધ સહકારી મંડળી (Dairy Cooperative)</option>
                <option value="MILK_UNION">દૂધ સંઘ (Milk Union)</option>
                <option value="OTHER">અન્ય (Other)</option>
              </select>
            </FormField>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                રદ કરો
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                સાચવો
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Map Village Modal */}
      <Modal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title={`${selectedEntityForMap?.name || ''} સાથે ગામ જોડો`}
      >
        <div className="space-y-4">
          <FormField label="ગામ પસંદ કરો" required>
            <select
              value={selectedVillageIdToMap}
              onChange={(e) => setSelectedVillageIdToMap(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs"
            >
              <option value="">— ગામ પસંદ કરો —</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name_gu} ({v.code})
                </option>
              ))}
            </select>
          </FormField>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsMapModalOpen(false)}>
              રદ કરો
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedVillageIdToMap}
              isLoading={isSubmitting}
              onClick={handleMapVillage}
            >
              લિંક કરો
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
