/**
 * PashuRakshak Botad — DAHO Administration API Service.
 *
 * Implements communication with backend /api/v1/administration/* endpoints:
 * - Talukas, Villages, Gram Panchayats, and Dairy Cooperatives
 * - Veterinary Officer and Field Worker staff management
 * - Village-to-VO assignment lifecycle
 * - Authenticated token handling with automatic refresh
 */
import { authService } from './authService';

export interface DistrictSummary {
  id: string;
  code: string;
  name_en: string;
  name_gu: string;
  name_hi?: string;
  active: boolean;
  taluka_count: number;
  village_count: number;
  gram_panchayat_count: number;
  cooperative_count: number;
  vo_count: number;
  fw_count: number;
  total_animals?: number;
  total_farmers?: number;
  total_vaccinations?: number;
  pending_vaccinations?: number;
  active_disease_reports?: number;
}

export interface DistrictItem {
  id: string;
  code: string;
  name_gu: string;
  name_en: string;
  name_hi?: string;
  active: boolean;
}

export interface TalukaItem {
  id: string;
  district_id: string;
  code: string;
  name_gu: string;
  name_en: string;
}

export interface VillageItem {
  id: string;
  district_id: string;
  taluka_id: string;
  code: string;
  name_gu: string;
  name_en: string;
  census_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coord_status: 'VERIFIED' | 'UNVERIFIED' | 'APPROXIMATE' | 'UNAVAILABLE';
  is_pilot: boolean;
  active: boolean;
  created_at: string;
  google_place_id?: string | null;
  formatted_address?: string | null;
  location_source?: string | null;
}

export interface GramPanchayatItem {
  id: string;
  taluka_id: string;
  code: string;
  name_gu: string;
  name_en: string;
  active: boolean;
  associated_village_ids: string[];
}

export interface CooperativeItem {
  id: string;
  code: string;
  name_gu: string;
  name_en: string;
  org_type: string;
  status: string;
  served_village_ids: string[];
}

export interface StaffItem {
  id: string;
  full_name: string;
  role?: string | null;
  username?: string | null;
  mobile_e164?: string | null;
  designation?: string | null;
  organisation?: string | null;
  office_name?: string | null;
  employee_ref?: string | null;
  status: string;
  assigned_village_ids: string[];
  created_at: string;
}

async function authFetch(apiBaseUrl: string, path: string, options: RequestInit = {}): Promise<Response> {
  let token = await authService.getValidAccessToken(apiBaseUrl);
  if (!token) {
    const session = authService.getSession();
    token = session?.accessToken || '';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> || {}),
  };

  let res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    try {
      const refreshed = await authService.refreshAccessToken(apiBaseUrl);
      headers.Authorization = `Bearer ${refreshed}`;
      res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    } catch (e) {
      console.warn('Session refresh failed during admin request:', e);
    }
  }

  return res;
}

export const adminService = {
  // 1. District Summary
  async getDistrictSummary(apiBaseUrl: string, districtId: string): Promise<DistrictSummary> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/districts/${districtId}/summary`);
    if (!res.ok) {
      throw new Error(`જિલ્લા ઝાંખી લોડ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async listDistricts(apiBaseUrl: string): Promise<DistrictItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/districts?active_only=true`);
    if (!res.ok) throw new Error(`જિલ્લા યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async getActiveDistrict(apiBaseUrl: string): Promise<DistrictItem> {
    const dists = await this.listDistricts(apiBaseUrl);
    if (!dists || dists.length === 0) {
      throw new Error('કોઈ સક્રિય જિલ્લો મળ્યો નથી');
    }
    const session = authService.getSession();
    const storedId = (session?.user as any)?.assigned_district_ids?.[0] || localStorage.getItem('pashurakshak_active_district_id');
    if (storedId) {
      const match = dists.find((d) => d.id === storedId);
      if (match) return match;
    }
    return dists[0];
  },

  // 2. Talukas
  async listTalukas(apiBaseUrl: string, districtId?: string): Promise<TalukaItem[]> {
    const query = districtId ? `?district_id=${districtId}&limit=100` : '?limit=100';
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/talukas${query}`);
    if (!res.ok) throw new Error(`તાલુકા યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createTaluka(
    apiBaseUrl: string,
    payload: { district_id: string; code: string; name_gu: string; name_en: string }
  ): Promise<TalukaItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/talukas`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `તાલુકો બનાવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateTaluka(
    apiBaseUrl: string,
    talukaId: string,
    payload: { name_gu?: string; name_en?: string }
  ): Promise<TalukaItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/talukas/${talukaId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `તાલુકો સુધારવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  // 3. Villages
  async listVillages(apiBaseUrl: string, districtId?: string, talukaId?: string): Promise<VillageItem[]> {
    const params = new URLSearchParams({ limit: '200' });
    if (districtId) params.append('district_id', districtId);
    if (talukaId) params.append('taluka_id', talukaId);

    const res = await authFetch(apiBaseUrl, `/api/v1/administration/villages?${params.toString()}`);
    if (!res.ok) throw new Error(`ગામ યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createVillage(
    apiBaseUrl: string,
    payload: {
      district_id: string;
      taluka_id: string;
      code: string;
      name_gu: string;
      name_en: string;
      census_code?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      is_pilot?: boolean;
      google_place_id?: string | null;
      formatted_address?: string | null;
      location_source?: string | null;
    }
  ): Promise<VillageItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/villages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ બનાવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateVillage(
    apiBaseUrl: string,
    villageId: string,
    payload: {
      name_gu?: string;
      name_en?: string;
      census_code?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      is_pilot?: boolean;
      active?: boolean;
      google_place_id?: string | null;
      formatted_address?: string | null;
      location_source?: string | null;
    }
  ): Promise<VillageItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/villages/${villageId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ સુધારવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  // 4. Gram Panchayats
  async listGramPanchayats(apiBaseUrl: string, districtId?: string): Promise<GramPanchayatItem[]> {
    const params = new URLSearchParams({ limit: '100' });
    if (districtId) params.append('district_id', districtId);

    const res = await authFetch(apiBaseUrl, `/api/v1/administration/gram-panchayats?${params.toString()}`);
    if (!res.ok) throw new Error(`ગ્રામ પંચાયત યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createGramPanchayat(
    apiBaseUrl: string,
    payload: { taluka_id: string; code: string; name_gu: string; name_en: string }
  ): Promise<GramPanchayatItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/gram-panchayats`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગ્રામ પંચાયત બનાવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateGramPanchayat(
    apiBaseUrl: string,
    gpId: string,
    payload: { name_gu?: string; name_en?: string; active?: boolean }
  ): Promise<GramPanchayatItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/gram-panchayats/${gpId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગ્રામ પંચાયત સુધારવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async mapGPVillage(apiBaseUrl: string, gpId: string, villageId: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/gram-panchayats/${gpId}/villages`, {
      method: 'POST',
      body: JSON.stringify({ village_id: villageId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ લિંક કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  // 5. Cooperatives
  async listCooperatives(apiBaseUrl: string): Promise<CooperativeItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/cooperatives?limit=100`);
    if (!res.ok) throw new Error(`સહકારી મંડળી યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createCooperative(
    apiBaseUrl: string,
    payload: { code: string; name_gu: string; name_en: string; org_type?: string }
  ): Promise<CooperativeItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/cooperatives`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સહકારી મંડળી બનાવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateCooperative(
    apiBaseUrl: string,
    coopId: string,
    payload: { name_gu?: string; name_en?: string; org_type?: string; status?: string }
  ): Promise<CooperativeItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/cooperatives/${coopId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સહકારી મંડળી સુધારવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async mapCooperativeVillage(apiBaseUrl: string, coopId: string, villageId: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/cooperatives/${coopId}/villages`, {
      method: 'POST',
      body: JSON.stringify({ village_id: villageId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ મેપ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  // 6. Veterinary Officers
  async listVeterinaryOfficers(apiBaseUrl: string, districtId?: string): Promise<StaffItem[]> {
    const params = new URLSearchParams({ limit: '100' });
    if (districtId) params.append('district_id', districtId);

    const res = await authFetch(apiBaseUrl, `/api/v1/administration/veterinary-officers?${params.toString()}`);
    if (!res.ok) throw new Error(`વેટરનરી અધિકારી યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createVeterinaryOfficer(
    apiBaseUrl: string,
    payload: {
      full_name: string;
      username: string;
      password: string;
      mobile_e164?: string;
      designation?: string;
      office_name?: string;
      employee_ref?: string;
    }
  ): Promise<StaffItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/veterinary-officers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `વેટરનરી અધિકારી બનાવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateVOStatus(apiBaseUrl: string, voUserId: string, targetStatus: string, reason?: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/veterinary-officers/${voUserId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: targetStatus, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સ્થિતિ બદલવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  // 7. Field Workers
  async listFieldWorkers(apiBaseUrl: string, districtId?: string): Promise<StaffItem[]> {
    const params = new URLSearchParams({ limit: '100' });
    if (districtId) params.append('district_id', districtId);

    const res = await authFetch(apiBaseUrl, `/api/v1/administration/field-workers?${params.toString()}`);
    if (!res.ok) throw new Error(`ક્ષેત્રીય કાર્યકર યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createFieldWorker(
    apiBaseUrl: string,
    payload: {
      full_name: string;
      username: string;
      password: string;
      mobile_e164?: string;
      designation?: string;
      organisation?: string;
    }
  ): Promise<StaffItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/field-workers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ક્ષેત્રીય કાર્યકર બનાવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateFWStatus(apiBaseUrl: string, fwUserId: string, targetStatus: string, reason?: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/field-workers/${fwUserId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: targetStatus, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સ્થિતિ બદલવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  // 8. Village Assignment
  async assignVOVillage(apiBaseUrl: string, voUserId: string, villageId: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/assignments/vo-village`, {
      method: 'POST',
      body: JSON.stringify({ user_id: voUserId, village_id: villageId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ સોંપણી નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  async assignVOVillagesBulk(apiBaseUrl: string, voUserId: string, villageIds: string[]): Promise<{ assigned_count: number; message: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/assignments/vo-village/bulk`, {
      method: 'POST',
      body: JSON.stringify({ user_id: voUserId, village_ids: villageIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામોની સામૂહિક સોંપણી નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async endVOVillage(apiBaseUrl: string, voUserId: string, villageId: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/assignments/vo-village/end`, {
      method: 'POST',
      body: JSON.stringify({ user_id: voUserId, village_id: villageId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ સોંપણી સમાપ્ત કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  async assignFWVillage(apiBaseUrl: string, fwUserId: string, villageId: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/assignments/fw-village`, {
      method: 'POST',
      body: JSON.stringify({ user_id: fwUserId, village_id: villageId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ સોંપણી નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  async endFWVillage(apiBaseUrl: string, fwUserId: string, villageId: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/assignments/fw-village/end`, {
      method: 'POST',
      body: JSON.stringify({ user_id: fwUserId, village_id: villageId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ સોંપણી સમાપ્ત કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  // ============================================================================
  // SUPER_ADMIN State-Level Administration Methods
  // ============================================================================
  async getSuperAdminOverview(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/super-admin/overview`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સુપર એડમિન ડેશબોર્ડ ડેટા મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async createDahoAccount(apiBaseUrl: string, payload: {
    full_name: string;
    username: string;
    email?: string;
    mobile_e164: string;
    designation?: string;
    organisation?: string;
    district_id?: string;
    password?: string;
  }): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/super-admin/daho-accounts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `DAHO એકાઉન્ટ બનાવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async reassignDistrict(apiBaseUrl: string, districtId: string, newDahoUserId: string, reason: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/districts/${districtId}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ new_daho_user_id: newDahoUserId, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `જિલ્લા પુનઃસોંપણી નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async releaseDistrict(apiBaseUrl: string, districtId: string, reason: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/districts/${districtId}/release`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `જિલ્લા મુક્તિ નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getDistrictHierarchy(apiBaseUrl: string, districtId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/districts/${districtId}/hierarchy`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `જિલ્લા વહીવટી માળખું મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async saveCustomJurisdiction(apiBaseUrl: string, districtId: string, boundaryGeojson: any, reason: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/districts/${districtId}/custom-boundary`, {
      method: 'POST',
      body: JSON.stringify({ boundary_geojson: boundaryGeojson, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `કસ્ટમ કાર્યક્ષેત્ર સેવ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async validateGeodataImport(apiBaseUrl: string, payload: {
    source_name: string;
    dataset_version?: string;
    features: any[];
  }): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/geography/validate-import`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ભૌગોલિક ડેટાસેટ ચકાસણી નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async commitGeodataImport(apiBaseUrl: string, payload: {
    district_id: string;
    source_name?: string;
    dataset_version?: string;
    talukas?: any[];
    relink_existing_names?: boolean;
    features?: any[];
  }): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/geography/commit-import`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ભૌગોલિક ડેટા આયાત સેવ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async seedOfficialHierarchy(apiBaseUrl: string, districtId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/districts/${districtId}/seed-official-hierarchy`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સત્તાવાર વહીવટી માળખું સિંક કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getGujaratStateMap(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/maps/state/gujarat`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગુજરાત રાજ્ય નકશો મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async listDistrictsGeoJson(apiBaseUrl: string): Promise<any> {
    return this.getGujaratStateMap(apiBaseUrl);
  },

  async getDistrictTalukasGeoJson(apiBaseUrl: string, districtId?: string): Promise<any> {
    const url = districtId
      ? `/api/v1/maps/talukas-geojson?district_id=${districtId}`
      : `/api/v1/maps/talukas-geojson`;
    try {
      const res = await authFetch(apiBaseUrl, url);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API talukas fetch error, falling back to static cache:', e);
    }
    // Fallback if statewide and API unreachable or unauthenticated
    if (!districtId) {
      try {
        const localRes = await fetch('/data/gujarat_talukas.geojson');
        if (localRes.ok) return await localRes.json();
      } catch (err) {
        console.warn('Static talukas fallback error:', err);
      }
    }
    throw new Error('તાલુકા પોલિગોન સીમાઓ મેળવવામાં નિષ્ફળ');
  },

  async getDistrictVillagesGeoJson(apiBaseUrl: string, districtId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/maps/districts/${districtId}/villages-geojson`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `જિલ્લા ગામ પોલિગોન સીમાઓ મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getTalukaVillagesGeoJson(apiBaseUrl: string, talukaId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/maps/talukas/${talukaId}/villages-geojson`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ગામ પોલિગોન સીમાઓ મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getGeographicQualityAudit(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/super-admin/geodata/quality-audit`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ભૌગોલિક ડેટા ગુણવત્તા ઓડિટ મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  // ---------------------------------------------------------------------------
  // Email Delivery Logs
  // ---------------------------------------------------------------------------
  async getEmailLogs(apiBaseUrl: string, limit = 50, offset = 0): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/super-admin/email-logs?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('ઇમેઇલ લોગ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async retryEmailLog(apiBaseUrl: string, logId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/super-admin/email-logs/${logId}/retry`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('ઇમેઇલ ફરી મોકલવામાં નિષ્ફળ');
    return res.json();
  },

  // ---------------------------------------------------------------------------
  // DAHO Multi-District & Taluka/TAHO Management
  // ---------------------------------------------------------------------------
  async getDahoAssignedDistricts(apiBaseUrl: string): Promise<any[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/assigned-districts`);
    if (!res.ok) throw new Error('નિયુક્ત જિલ્લાઓ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getDahoDistrictOverview(apiBaseUrl: string, districtId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/district-overview?district_id=${districtId}`);
    if (!res.ok) throw new Error('જિલ્લા વિહંગાવલોકન મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getDahoAnimals(
    apiBaseUrl: string,
    districtId: string,
    params?: { search?: string; species?: string; talukaId?: string; page?: number; pageSize?: number }
  ): Promise<{ total: number; page: number; page_size: number; total_pages: number; items: any[] }> {
    const q = new URLSearchParams();
    q.set('district_id', districtId);
    if (params?.search) q.set('search', params.search);
    if (params?.species) q.set('species', params.species);
    if (params?.talukaId) q.set('taluka_id', params.talukaId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('page_size', String(params.pageSize));
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/animals?${q.toString()}`);
    if (!res.ok) throw new Error('પશુ નોંધણી યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getDahoFarmers(
    apiBaseUrl: string,
    districtId: string,
    params?: { search?: string; talukaId?: string; page?: number; pageSize?: number }
  ): Promise<{ total: number; page: number; page_size: number; total_pages: number; items: any[] }> {
    const q = new URLSearchParams();
    q.set('district_id', districtId);
    if (params?.search) q.set('search', params.search);
    if (params?.talukaId) q.set('taluka_id', params.talukaId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('page_size', String(params.pageSize));
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/farmers?${q.toString()}`);
    if (!res.ok) throw new Error('ખેડૂત યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getDahoDiseaseAlerts(apiBaseUrl: string, districtId: string): Promise<any[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/disease-alerts?district_id=${districtId}`);
    if (!res.ok) throw new Error('રોગ સર્વેલન્સ ચેતવણીઓ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getDahoGisQuality(apiBaseUrl: string, districtId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/gis-quality?district_id=${districtId}`);
    if (!res.ok) throw new Error('GIS ગુણવત્તા ઓડિટ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getDahoVaccinationRecords(
    apiBaseUrl: string,
    districtId: string,
    params?: { talukaId?: string; page?: number; pageSize?: number }
  ): Promise<{ total: number; page: number; page_size: number; total_pages: number; items: any[] }> {
    const q = new URLSearchParams();
    q.set('district_id', districtId);
    if (params?.talukaId) q.set('taluka_id', params.talukaId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('page_size', String(params.pageSize));
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/vaccination-records?${q.toString()}`);
    if (!res.ok) throw new Error('રસીકરણ રેકોર્ડ્સ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getDahoTalukas(apiBaseUrl: string, districtId: string): Promise<any[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/talukas?district_id=${districtId}`);
    if (!res.ok) throw new Error('તાલુકા માહિતી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async searchTahoAccounts(apiBaseUrl: string, q?: string, districtId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (districtId) params.set('district_id', districtId);
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/taho-search?${params.toString()}`);
    if (!res.ok) throw new Error('TAHO શોધ નિષ્ફળ');
    return res.json();
  },

  async createTahoAccount(apiBaseUrl: string, payload: any): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/taho-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'TAHO બનાવવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'TAHO ખાતું બનાવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async assignTahoToTaluka(apiBaseUrl: string, talukaId: string, tahoUserId: string, reason?: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/talukas/${talukaId}/assign-taho`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taho_user_id: tahoUserId, reason: reason || 'Administrative Assignment' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'સોંપણી નિષ્ફળ' }));
      throw new Error(err.detail || 'તાલુકા સોંપણી નિષ્ફળ');
    }
    return res.json();
  },

  async releaseTahoFromTaluka(apiBaseUrl: string, talukaId: string, reason: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/talukas/${talukaId}/release-taho`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'મુક્ત કરવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'TAHO મુક્ત કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // ---------------------------------------------------------------------------
  // TAHO Operational Portal
  // ---------------------------------------------------------------------------
  async getTahoOverview(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/overview`);
    if (!res.ok) throw new Error('TAHO વિહંગાવલોકન મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getTahoHierarchy(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/hierarchy`);
    if (!res.ok) throw new Error('તાલુકા વહીવટી માળખું મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getTahoGisAnalytics(apiBaseUrl: string, params?: Record<string, any>): Promise<any> {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          q.set(key, String(val));
        }
      });
    }
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/gis-analytics${qs}`);
    if (!res.ok) throw new Error('GIS એનાલિટિક્સ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getTahoVillageAnalytics(apiBaseUrl: string, villageId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/village-analytics?village_id=${villageId}`);
    if (!res.ok) throw new Error('ગામ વિશ્લેષણ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async listTahoVos(apiBaseUrl: string): Promise<any[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/veterinary-officers`);
    if (!res.ok) throw new Error('વેટરનરી અધિકારીઓની યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async createTahoVo(apiBaseUrl: string, payload: any): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/veterinary-officers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'VO ખાતું બનાવવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'VO ખાતું બનાવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async updateTahoVoStatus(apiBaseUrl: string, voId: string, status: string, reason: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/veterinary-officers/${voId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'સ્ટેટસ બદલવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'સ્ટેટસ બદલવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async listTahoFws(apiBaseUrl: string): Promise<any[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/field-workers`);
    if (!res.ok) throw new Error('ફીલ્ડ વર્કર્સની યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async createTahoFw(apiBaseUrl: string, payload: any): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/field-workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'FW ખાતું બનાવવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'FW ખાતું બનાવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async updateTahoFwStatus(apiBaseUrl: string, fwId: string, status: string, reason: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/field-workers/${fwId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'સ્ટેટસ બદલવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'સ્ટેટસ બદલવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async listTahoCampaigns(apiBaseUrl: string): Promise<any[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/campaigns`);
    if (!res.ok) throw new Error('ઝુંબેશોની યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async createTahoCampaign(apiBaseUrl: string, payload: any): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'ઝુંબેશ બનાવવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'ઝુંબેશ બનાવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async listTahoVaccinations(apiBaseUrl: string, params?: { village_id?: string; page?: number; page_size?: number }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.village_id) q.set('village_id', params.village_id);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/vaccinations${qs}`);
    if (!res.ok) throw new Error('રસીકરણ રેકોર્ડ્સ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async listTahoAnimals(apiBaseUrl: string, params?: { search?: string; species?: string; village_id?: string; page?: number; page_size?: number }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.species) q.set('species', params.species);
    if (params?.village_id) q.set('village_id', params.village_id);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/animals${qs}`);
    if (!res.ok) throw new Error('પશુ રેકોર્ડ્સ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async listTahoFarmers(apiBaseUrl: string, params?: { search?: string; village_id?: string; page?: number; page_size?: number }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.village_id) q.set('village_id', params.village_id);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/farmers${qs}`);
    if (!res.ok) throw new Error('ખેડૂત રેકોર્ડ્સ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async listTahoSurveillance(apiBaseUrl: string, params?: { village_id?: string; disease_code?: string; status?: string }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.village_id) q.set('village_id', params.village_id);
    if (params?.disease_code) q.set('disease_code', params.disease_code);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/surveillance${qs}`);
    if (!res.ok) throw new Error('રોગ સર્વેલન્સ રિપોર્ટ્સ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async listTahoDiseaseAlerts(apiBaseUrl: string): Promise<any[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/disease-alerts`);
    if (!res.ok) throw new Error('રોગ ચેતવણીઓ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async seedTahoDemoData(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/demo/seed`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'ડેમો ડેટા લોડ કરવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'ડેમો ડેટા લોડ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async resetTahoDemoData(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/taho/demo/reset`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'ડેમો ડેટા રીસેટ કરવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'ડેમો ડેટા રીસેટ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },
};

