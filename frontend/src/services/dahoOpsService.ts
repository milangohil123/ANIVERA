/**
 * PashuRakshak Botad — Operations Service for DAHO & Veterinary Portals.
 *
 * Coordinates:
 * - Campaigns (/api/v1/campaigns)
 * - Veterinary Camps (/api/v1/veterinary-camps)
 * - Vaccine Inventory (/api/v1/vaccine-inventory)
 * - Disease Surveillance (/api/v1/disease-reports)
 */
import { authService } from './authService';

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
      console.warn('Session refresh failed during ops request:', e);
    }
  }

  return res;
}

export interface SpeciesOption {
  code: string;
  name_gu: string;
  name_en: string;
}

export interface TalukaOption {
  id: string;
  code: string;
  name_gu: string;
  name_en: string;
}

export interface VillageWithVO {
  id: string;
  code: string;
  name_gu: string;
  name_en: string;
  taluka_id: string;
  taluka_name_gu?: string;
  taluka_name_en?: string;
  assigned_vo?: {
    user_id: string;
    full_name: string;
    username?: string;
    designation?: string;
  } | null;
}

export interface CampaignCreationMeta {
  species: SpeciesOption[];
  talukas: TalukaOption[];
  villages: VillageWithVO[];
  default_programmes: string[];
}

export interface MonitoringVillageItem {
  village_id: string;
  village_code: string;
  village_name_gu: string;
  village_name_en: string;
  taluka_name?: string | null;
  assigned_vo?: {
    user_id: string;
    full_name: string;
    username?: string;
    designation?: string;
  } | null;
  vo_acceptance_status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED' | 'UNASSIGNED';
  rejection_reason?: string | null;
  assigned_at?: string | null;
  eligible_count: number;
  vaccinated_count: number;
  remaining_count: number;
  completion_percentage: number;
  assigned_fws: Array<{
    user_id: string;
    full_name: string;
    username?: string;
    designation?: string;
  }>;
}

export interface CampaignMonitoringData {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  disease_code?: string;
  campaign_status: string;
  start_date?: string | null;
  end_date?: string | null;
  planned_target_count?: number | null;
  actual_eligible_count: number;
  total_vaccinated_count: number;
  total_remaining_count: number;
  overall_completion_percentage: number;
  villages: MonitoringVillageItem[];
}

export interface CampaignItem {
  id: string;
  code: string;
  name: string;
  name_gu?: string;
  name_en?: string;
  disease_code?: string;
  district_id?: string;
  start_date?: string;
  end_date?: string;
  target_animals_count?: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  created_at?: string;
}

export interface CampItem {
  id: string;
  camp_code?: string;
  campaign_id: string;
  village_id: string;
  organizer_type?: string;
  cooperative_id?: string | null;
  planned_start?: string;
  planned_end?: string;
  location_text?: string | null;
  status: 'PROPOSED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';
  vaccine_availability?: string;
  vaccine_note?: string | null;
  expected_farmers?: number | null;
  created_at: string;
  // Backward compatibility fields
  camp_date?: string;
  camp_type?: 'FIXED' | 'DOORSTEP';
  notes?: string | null;
}

export interface VaccineProductItem {
  id: string;
  code: string;
  name: string;
  disease_code?: string;
  programme_code?: string;
  manufacturer?: string;
  doses_per_vial?: number;
  shelf_life_days?: number;
  storage_temp_celsius?: string | null;
  unit_name?: string;
  active: boolean;
  created_at: string;
}

export interface VaccineLotItem {
  id: string;
  product_id: string;
  district_id?: string;
  batch_number: string;
  manufacturing_date?: string;
  received_date?: string;
  expiry_date?: string;
  initial_quantity?: number;
  quantity_received?: number;
  current_balance?: number;
  quantity_on_hand?: number;
  storage_location?: string;
  status: string;
}

export interface DiseaseReportItem {
  id: string;
  report_id?: string;
  report_no?: string | null;
  animal_id?: string | null;
  farmer_id?: string | null;
  village_id: string;
  disease_code: string;
  report_source?: string;
  report_date?: string;
  status: string;
  symptoms?: string[];
  symptoms_described?: string | null;
  observation_text?: string | null;
  received_at: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  confirmation_basis?: string | null;
  not_confirmed_reason?: string | null;
}

function formatApiError(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item: any) => {
        const field = item.loc ? item.loc.slice(1).join('.') : '';
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join('; ');
  }
  if (data.message && typeof data.message === 'string') return data.message;
  return fallback;
}

export const dahoOpsService = {
  // 1. Campaigns
  async getCreationMeta(apiBaseUrl: string): Promise<CampaignCreationMeta> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/meta/creation-context`);
    if (!res.ok) throw new Error(`ઝુંબેશ માસ્ટર ડેટા મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async listCampaigns(apiBaseUrl: string, status?: string): Promise<CampaignItem[]> {
    const query = status ? `?status=${status}&limit=100` : '?limit=100';
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns${query}`);
    if (!res.ok) throw new Error(`ઝુંબેશ યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createCampaign(
    apiBaseUrl: string,
    payload: {
      code: string;
      name: string;
      disease_code?: string;
      start_date?: string;
      end_date?: string;
      target_animals_count?: number;
      village_ids?: string[];
      species_codes?: string[];
      notes?: string;
      programmes?: { species_code: string; programme_code: string }[];
    }
  ): Promise<CampaignItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `ઝુંબેશ બનાવવામાં નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  async getCampaignMonitoring(apiBaseUrl: string, campaignId: string): Promise<CampaignMonitoringData> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/monitoring`);
    if (!res.ok) throw new Error(`ઝુંબેશ મોનિટરિંગ માહિતી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async activateCampaign(
    apiBaseUrl: string,
    campaignId: string,
    payload: {
      schedule_version_id?: string;
      start_date: string;
      end_date?: string;
    }
  ): Promise<CampaignItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/activate`, {
      method: 'POST',
      body: JSON.stringify({
        schedule_version_id: payload.schedule_version_id || null,
        start_date: payload.start_date,
        end_date: payload.end_date || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `ઝુંબેશ સક્રિય કરવામાં નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  // 2. Camps
  async listCamps(apiBaseUrl: string, status?: string): Promise<CampItem[]> {
    const query = status ? `?status=${status}&limit=100` : '?limit=100';
    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps${query}`);
    if (!res.ok) throw new Error(`કેમ્પ યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async proposeCamp(
    apiBaseUrl: string,
    payload: {
      campaign_id: string;
      village_id: string;
      planned_start?: string;
      planned_end?: string;
      organizer_type?: 'GOVERNMENT' | 'COOPERATIVE' | 'JOINT' | 'DOORSTEP';
      location_text?: string;
      vaccine_note?: string;
      expected_farmers?: number;
      camp_date?: string;
      camp_type?: 'FIXED' | 'DOORSTEP';
      notes?: string;
    }
  ): Promise<CampItem> {
    let pStart = payload.planned_start;
    let pEnd = payload.planned_end;
    if (!pStart && payload.camp_date) {
      pStart = `${payload.camp_date}T09:00:00Z`;
      pEnd = `${payload.camp_date}T17:00:00Z`;
    }
    const orgType =
      payload.organizer_type ||
      (payload.camp_type === 'DOORSTEP' ? 'DOORSTEP' : 'GOVERNMENT');

    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps`, {
      method: 'POST',
      body: JSON.stringify({
        campaign_id: payload.campaign_id,
        village_id: payload.village_id,
        organizer_type: orgType,
        planned_start: pStart,
        planned_end: pEnd,
        location_text: payload.location_text || payload.notes || null,
        vaccine_note: payload.vaccine_note || payload.notes || null,
        expected_farmers: payload.expected_farmers ?? 30,
        vaccine_availability: 'UNKNOWN',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `કેમ્પ પ્રસ્તાવિત કરવામાં નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  // 3. Vaccine Inventory
  async listProducts(apiBaseUrl: string): Promise<VaccineProductItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccine-inventory/products?active_only=false`);
    if (!res.ok) throw new Error(`રસી પ્રોડક્ટ યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async createProduct(
    apiBaseUrl: string,
    payload: {
      code: string;
      name: string;
      disease_code: string;
      manufacturer: string;
      doses_per_vial: number;
      shelf_life_days: number;
      storage_temp_celsius?: string;
    }
  ): Promise<VaccineProductItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccine-inventory/products`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `રસી ઉમેરવામાં નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  async listLots(apiBaseUrl: string): Promise<VaccineLotItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccine-inventory/lots?limit=100`);
    if (!res.ok) {
      // Return empty if endpoint not populated yet
      return [];
    }
    return res.json();
  },

  // 4. Disease Surveillance
  async listDiseaseReports(apiBaseUrl: string): Promise<DiseaseReportItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/disease-reports?limit=100`);
    if (!res.ok) throw new Error(`રોગ અહેવાલો મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((r: any) => {
      const actualId = r.id || r.report_id || '';
      return {
        ...r,
        id: actualId || String(Math.random()),
        report_id: r.report_id || r.id || '',
        report_no: r.report_no || (actualId ? `REP-${String(actualId).substring(0, 8).toUpperCase()}` : 'અહેવાલ'),
      };
    });
  },

  async decideDiseaseReport(
    apiBaseUrl: string,
    reportId: string,
    payload: {
      action: 'CONFIRM' | 'DISPROVE' | 'INSUFFICIENT';
      confirmation_basis?: string;
      not_confirmed_reason?: string;
    }
  ): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/disease-reports/${reportId}/decide`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, 'રોગ અહેવાલ ચકાસણી નિર્ણય નિષ્ફળ.'));
    }
    return res.json();
  },

  // 5. Campaign Staff Assignment
  async assignCampaignWorker(
    apiBaseUrl: string,
    campaignId: string,
    payload: { village_id: string; worker_user_id: string }
  ): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, 'કાર્યકર સોંપણી નિષ્ફળ.'));
    }
    return res.json();
  },
};

