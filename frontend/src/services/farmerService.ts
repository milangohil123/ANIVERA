/**
 * PashuRakshak Botad — Farmer Portal API Service.
 *
 * Scoped strictly to farmer's own records:
 * - Own livestock query via /api/v1/animals
 * - Animal details, vaccination and clinical history
 * - Animal ownership-transfer tracking
 * - Disease event reporting (report_source="FARMER_APP")
 * - Profile and verification status
 */
import { authService } from './authService';

export interface FarmerAnimalItem {
  id: string;
  animal_code?: string | null;
  species_code: string;
  breed_id?: string | null;
  sex: string;
  age_months_estimate?: number | null;
  farmer_id: string;
  village_id: string;
  registration_status: string;
  status: string;
  created_at: string;
  active_tag?: string | null;
  active_qr_token?: string | null;
}

export interface FarmerVaccinationEvent {
  id: string;
  event_id?: string;
  animal_id: string;
  event_date: string;
  programme_code: string;
  batch_number?: string | null;
  vaccine_name?: string | null;
  performed_by_name?: string | null;
}

export interface FarmerTreatmentEvent {
  id: string;
  event_id?: string;
  animal_id: string;
  event_date: string;
  treatment_text: string;
  diagnosis_text?: string | null;
  performed_by_name?: string | null;
}

export interface FarmerTransferItem {
  id: string;
  animal_id: string;
  from_farmer_id: string;
  to_farmer_id: string;
  status: string;
  reason?: string | null;
  requested_at?: string;
  decided_at?: string | null;
}

export interface FarmerDiseaseReportPayload {
  animal_id?: string;
  farmer_id?: string;
  village_id?: string;
  primary_symptom: string;
  symptom_onset_date: string;
  affected_count?: number;
  dead_count?: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

export function formatApiError(data: any, fallback: string): string {
  if (!data) return fallback;

  // Handle Error instances
  if (data instanceof Error) {
    const m = data.message || '';
    if (m && typeof m === 'string' && !m.includes('[object Object]')) {
      return m.trim();
    }
    return fallback;
  }

  // Handle plain string error
  if (typeof data === 'string') {
    if (data.includes('[object Object]')) {
      return fallback;
    }
    return data.trim() || fallback;
  }

  // Handle { detail: ... }
  if (data.detail) {
    if (typeof data.detail === 'string' && !data.detail.includes('[object Object]')) {
      return data.detail.trim();
    }
    if (Array.isArray(data.detail)) {
      const parts = data.detail
        .map((item: any) => {
          if (!item) return '';
          if (typeof item === 'string') return item;
          const locArr = Array.isArray(item.loc) ? item.loc.filter((p: any) => p !== 'body') : [];
          const field = locArr.join('.');
          const msg = item.msg || item.message || '';
          if (typeof msg !== 'string') return '';
          return field ? `${field}: ${msg}` : msg;
        })
        .filter((s: string) => s && !s.includes('[object Object]'));
      if (parts.length > 0) return parts.join('; ');
    }
  }

  // Handle { message: ... }
  if (typeof data.message === 'string' && !data.message.includes('[object Object]')) {
    return data.message.trim();
  }

  // Handle array of error items
  if (Array.isArray(data)) {
    const parts = data
      .map((item: any) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        const msg = item.msg || item.message || item.detail || '';
        return typeof msg === 'string' ? msg : '';
      })
      .filter((s: string) => s && !s.includes('[object Object]'));
    if (parts.length > 0) return parts.join('; ');
  }

  // Handle { errors: [...] }
  if (Array.isArray(data.errors)) {
    const parts = data.errors
      .map((item: any) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        const msg = item.msg || item.message || '';
        return typeof msg === 'string' ? msg : '';
      })
      .filter((s: string) => s && !s.includes('[object Object]'));
    if (parts.length > 0) return parts.join('; ');
  }

  return fallback;
}

async function authFetch(
  apiBaseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = await authService.getValidAccessToken(apiBaseUrl);
  if (!token) {
    const session = authService.getSession();
    token = session?.accessToken || '';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    try {
      const refreshed = await authService.refreshAccessToken(apiBaseUrl);
      headers['Authorization'] = `Bearer ${refreshed}`;
      res = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch (e) {
      console.warn('Session refresh failed during farmer request:', e);
    }
  }

  return res;
}

export const farmerService = {
  /**
   * Fetch animals belonging to the logged-in farmer.
   */
  async getOwnAnimals(apiBaseUrl: string): Promise<FarmerAnimalItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals?limit=100`);
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.');
      }
      throw new Error(`પશુઓની યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * Fetch complete details of a single animal.
   */
  async getAnimalDetail(apiBaseUrl: string, animalId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}`);
    if (!res.ok) {
      throw new Error(`પશુની વિગત મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * Fetch vaccination records for an animal.
   */
  async getAnimalVaccinations(apiBaseUrl: string, animalId: string): Promise<FarmerVaccinationEvent[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations?animal_id=${animalId}&limit=50`);
    if (!res.ok) return [];
    return res.json();
  },

  /**
   * Fetch treatment and clinical records for an animal.
   */
  async getAnimalTreatments(apiBaseUrl: string, animalId: string): Promise<FarmerTreatmentEvent[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations/treatments?animal_id=${animalId}&limit=50`);
    if (!res.ok) return [];
    return res.json();
  },

  /**
   * Fetch ownership transfer status for an animal.
   */
  async getAnimalTransfers(apiBaseUrl: string, animalId: string): Promise<FarmerTransferItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}/transfers`);
    if (!res.ok) return [];
    return res.json();
  },

  /**
   * Submit farmer disease report / urgent health assistance request.
   */
  async reportDisease(apiBaseUrl: string, payload: FarmerDiseaseReportPayload): Promise<{ id: string }> {
    const symptom = (payload.primary_symptom || '').trim();
    let diseaseCode = 'UNKNOWN';
    if (symptom.includes('FMD') || symptom.includes('મોં અને ખરી')) {
      diseaseCode = 'FMD';
    } else if (symptom.includes('Lumpy') || symptom.includes('ગાંઠો')) {
      diseaseCode = 'LSD';
    } else if (symptom.includes('HS') || symptom.includes('ગળામાં સોજો')) {
      diseaseCode = 'HS';
    } else if (symptom.includes('તાવ') || symptom.includes('Fever')) {
      diseaseCode = 'FEVER';
    } else if (symptom.includes('ખોરાક') || symptom.includes('સુસ્તી')) {
      diseaseCode = 'GENERAL_SICKNESS';
    } else if (symptom.includes('દૂધ')) {
      diseaseCode = 'MILK_DROP';
    }

    const obsText = payload.notes
      ? `${symptom} | ${payload.notes.trim()}`
      : symptom || 'પશુ બીમારી અહેવાલ';

    const cleanAnimalId = payload.animal_id && payload.animal_id.trim() ? payload.animal_id.trim() : undefined;
    const cleanFarmerId = payload.farmer_id && payload.farmer_id.trim() ? payload.farmer_id.trim() : undefined;
    const cleanVillageId = payload.village_id && payload.village_id.trim() ? payload.village_id.trim() : undefined;

    const res = await authFetch(apiBaseUrl, `/api/v1/disease-reports`, {
      method: 'POST',
      body: JSON.stringify({
        animal_id: cleanAnimalId,
        farmer_id: cleanFarmerId,
        village_id: cleanVillageId,
        disease_code: diseaseCode,
        report_date: payload.symptom_onset_date || new Date().toISOString().split('T')[0],
        symptoms: [symptom].filter(Boolean),
        observation_text: obsText,
        report_source: 'FARMER_APP',
        primary_symptom: symptom,
        symptom_onset_date: payload.symptom_onset_date || new Date().toISOString().split('T')[0],
        affected_count: payload.affected_count || 1,
        dead_count: payload.dead_count || 0,
        notes: payload.notes ? payload.notes.trim() : undefined,
        latitude: payload.latitude,
        longitude: payload.longitude,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `અહેવાલ સબમિટ કરવામાં નિષ્ફળ (HTTP ${res.status}). કૃપા કરીને વિગતો તપાસી ફરી પ્રયાસ કરો.`));
    }
    return res.json();
  },

  /**
   * Fetch farmer's own profile and registration details.
   */
  async getOwnProfile(apiBaseUrl: string): Promise<any> {
    const [profRes, farmersRes] = await Promise.all([
      authFetch(apiBaseUrl, `/api/v1/auth/me`),
      authFetch(apiBaseUrl, `/api/v1/farmers?limit=10`),
    ]);

    const userProfile = profRes.ok ? await profRes.json() : null;
    const farmerRecords = farmersRes.ok ? await farmersRes.json() : [];

    return {
      user: userProfile,
      farmer: farmerRecords.length > 0 ? farmerRecords[0] : null,
      farmers: farmerRecords,
    };
  },
};

