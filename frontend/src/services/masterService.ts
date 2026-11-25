/**
 * PashuRakshak Botad — Animal, Disease & Vaccine Master Data Service.
 */
import { authService } from './authService';
import { apiCache } from '../utils/apiCache';

async function authFetch(apiBaseUrl: string, path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

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
      console.warn('Session refresh failed during master data request:', e);
    }
  }

  if (isMutation && res.ok) {
    apiCache.invalidate();
  }

  return res;
}

export interface SpeciesItem {
  code: string;
  name_gu: string;
  name_en: string;
  name_hi?: string | null;
  description?: string | null;
  active: boolean;
  archived: boolean;
  usage_count: number;
}

export interface DiseaseItem {
  code: string;
  name_en: string;
  name_gu: string;
  name_hi?: string | null;
  description?: string | null;
  applicable_species: string[];
  color?: string | null;
  severity?: string | null;
  active: boolean;
  archived: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  vaccines_count: number;
  reports_count: number;
}

export interface VaccineItem {
  id: string;
  code: string;
  name_en: string;
  name_gu: string;
  disease_code: string;
  disease_name_gu?: string | null;
  disease_name_en?: string | null;
  applicable_species: string[];
  administration_route?: string | null;
  standard_dosage?: string | null;
  schedule_interval?: string | null;
  verification_status: 'VERIFIED' | 'PENDING_VERIFICATION';
  verified_source?: string | null;
  is_custom_manual: boolean;
  description?: string | null;
  active: boolean;
  archived: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DiseaseVaccineMappingItem {
  disease_code: string;
  disease_name_gu: string;
  disease_name_en: string;
  color?: string | null;
  severity?: string | null;
  applicable_species: string[];
  active: boolean;
  vaccines: VaccineItem[];
}

export interface MasterOverview {
  total_species: number;
  active_species: number;
  total_diseases: number;
  active_diseases: number;
  total_vaccines: number;
  verified_vaccines: number;
  pending_vaccines: number;
}

export const masterService = {
  // -------------------------------------------------------------------------
  // Overview & Mapping
  // -------------------------------------------------------------------------
  async getOverview(apiBaseUrl: string): Promise<MasterOverview> {
    const res = await authFetch(apiBaseUrl, '/api/v1/master/overview');
    if (!res.ok) throw new Error('માસ્ટર આંકડા મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async getMapping(apiBaseUrl: string, activeOnly: boolean = false): Promise<DiseaseVaccineMappingItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/mapping?active_only=${activeOnly}`);
    if (!res.ok) throw new Error('રોગ અને રસી મેપિંગ મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  // -------------------------------------------------------------------------
  // Species
  // -------------------------------------------------------------------------
  async listSpecies(apiBaseUrl: string, activeOnly: boolean = false): Promise<SpeciesItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/species?active_only=${activeOnly}`);
    if (!res.ok) throw new Error('પશુ પ્રજાતિઓની યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async createSpecies(apiBaseUrl: string, data: Partial<SpeciesItem>): Promise<SpeciesItem> {
    const res = await authFetch(apiBaseUrl, '/api/v1/master/species', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'પ્રજાતિ ઉમેરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async updateSpecies(apiBaseUrl: string, code: string, data: Partial<SpeciesItem>): Promise<SpeciesItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/species/${code}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'પ્રજાતિ સુધારવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async toggleSpeciesActive(apiBaseUrl: string, code: string): Promise<SpeciesItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/species/${code}/toggle-active`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async deleteSpecies(apiBaseUrl: string, code: string): Promise<{ action: string; message: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/species/${code}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'પ્રજાતિ કાઢી નાખવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // -------------------------------------------------------------------------
  // Diseases
  // -------------------------------------------------------------------------
  async listDiseases(apiBaseUrl: string, activeOnly: boolean = false, speciesCode?: string): Promise<DiseaseItem[]> {
    const q = new URLSearchParams();
    if (activeOnly) q.append('active_only', 'true');
    if (speciesCode) q.append('species_code', speciesCode);
    const res = await authFetch(apiBaseUrl, `/api/v1/master/diseases?${q.toString()}`);
    if (!res.ok) throw new Error('રોગ માસ્ટર યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async createDisease(apiBaseUrl: string, data: Partial<DiseaseItem>): Promise<DiseaseItem> {
    const res = await authFetch(apiBaseUrl, '/api/v1/master/diseases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'રોગ ઉમેરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async updateDisease(apiBaseUrl: string, code: string, data: Partial<DiseaseItem>): Promise<DiseaseItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/diseases/${code}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'રોગ સુધારવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async toggleDiseaseActive(apiBaseUrl: string, code: string): Promise<DiseaseItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/diseases/${code}/toggle-active`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async deleteDisease(apiBaseUrl: string, code: string): Promise<{ action: string; message: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/diseases/${code}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'રોગ કાઢી નાખવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // -------------------------------------------------------------------------
  // Vaccines
  // -------------------------------------------------------------------------
  async listVaccines(
    apiBaseUrl: string,
    params?: { activeOnly?: boolean; diseaseCode?: string; speciesCode?: string; verificationStatus?: string }
  ): Promise<VaccineItem[]> {
    const q = new URLSearchParams();
    if (params?.activeOnly) q.append('active_only', 'true');
    if (params?.diseaseCode) q.append('disease_code', params.diseaseCode);
    if (params?.speciesCode) q.append('species_code', params.speciesCode);
    if (params?.verificationStatus) q.append('verification_status', params.verificationStatus);

    const res = await authFetch(apiBaseUrl, `/api/v1/master/vaccines?${q.toString()}`);
    if (!res.ok) throw new Error('રસી માસ્ટર યાદી મેળવવામાં નિષ્ફળ');
    return res.json();
  },

  async createVaccine(apiBaseUrl: string, data: Partial<VaccineItem>): Promise<VaccineItem> {
    const res = await authFetch(apiBaseUrl, '/api/v1/master/vaccines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'રસી ઉમેરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async updateVaccine(apiBaseUrl: string, id: string, data: Partial<VaccineItem>): Promise<VaccineItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/vaccines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'રસી સુધારવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async toggleVaccineActive(apiBaseUrl: string, id: string): Promise<VaccineItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/vaccines/${id}/toggle-active`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async setVaccineVerification(
    apiBaseUrl: string,
    id: string,
    verificationStatus: 'VERIFIED' | 'PENDING_VERIFICATION',
    verifiedSource?: string
  ): Promise<VaccineItem> {
    const q = new URLSearchParams();
    q.append('verification_status', verificationStatus);
    if (verifiedSource) q.append('verified_source', verifiedSource);

    const res = await authFetch(apiBaseUrl, `/api/v1/master/vaccines/${id}/verify?${q.toString()}`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'ચકાસણી સ્થિતિ અપડેટ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async deleteVaccine(apiBaseUrl: string, id: string): Promise<{ action: string; message: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/master/vaccines/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'રસી કાઢી નાખવામાં નિષ્ફળ');
    }
    return res.json();
  },
};
