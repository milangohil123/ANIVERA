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
};

