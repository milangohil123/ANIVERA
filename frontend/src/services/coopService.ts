/**
 * PashuRakshak Botad — Complete Dairy Cooperative API Service.
 *
 * Supports:
 * 1. DAHO Dairy Cooperative Management (District-scoped list, create, edit, activate/deactivate, email resend, member link/unlink, demo data)
 * 2. Dairy Cooperative Portal (Dedicated 10-KPI and 8-Chart analytics, member farmers, livestock register, read-only vaccination telemetry, disease surveillance, and exportable reports)
 */
import { authService } from './authService';

export interface CoopSummaryItem {
  id: string;
  code: string;
  name_gu: string;
  name_en: string;
  org_type: string;
  status: string;
  registration_no?: string | null;
  contact_person?: string | null;
  designation?: string | null;
  mobile_e164?: string | null;
  email?: string | null;
  district_id?: string | null;
  district_name?: string | null;
  taluka_id?: string | null;
  taluka_name?: string | null;
  village_id?: string | null;
  village_name?: string | null;
  user_id?: string | null;
  created_at: string;
  linked_farmers_count: number;
  linked_animals_count: number;
  vaccinated_animals_count: number;
  coverage_percent: number;
  is_demo: boolean;
}

export interface CoopDetailItem extends CoopSummaryItem {
  address?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  username?: string | null;
  user_status?: string | null;
  last_login_at?: string | null;
  pending_vaccinations_count: number;
  overdue_vaccinations_count: number;
  active_campaigns_count: number;
  suspected_disease_cases_count: number;
}

export interface CoopRegisterPayload {
  code: string;
  name_gu: string;
  name_en: string;
  org_type: string;
  registration_no?: string;
  contact_person: string;
  designation?: string;
  mobile_e164: string;
  email: string;
  district_id: string;
  taluka_id: string;
  village_id: string;
  address?: string;
  postal_code?: string;
  status?: string;
  notes?: string;
  initial_password?: string;
}

export interface CoopMemberFarmerItem {
  farmer_id: string;
  farmer_code: string;
  full_name_gu: string;
  full_name_en: string;
  mobile_e164?: string | null;
  village_id: string;
  village_name: string;
  member_no?: string | null;
  joined_on?: string | null;
  total_animals: number;
  vaccinated_animals: number;
  coverage_percent: number;
}

export interface CoopAnimalItem {
  id: string;
  animal_code: string;
  bharat_pashudhan_tag?: string | null;
  species: string;
  breed?: string | null;
  sex: string;
  age_years?: number | null;
  farmer_id: string;
  farmer_name: string;
  village_name: string;
  vaccination_status: string;
  last_vaccinated_at?: string | null;
  next_due_date?: string | null;
}

export interface CoopVaccinationItem {
  id: string;
  animal_id: string;
  animal_code: string;
  bharat_pashudhan_tag?: string | null;
  species: string;
  farmer_name: string;
  village_name: string;
  vaccine_name: string;
  disease_name: string;
  dose_number: number;
  batch_number?: string | null;
  administered_at: string;
  vaccinator_designation: string;
  status: string;
}

export interface CoopSurveillanceItem {
  id: string;
  report_code: string;
  village_name: string;
  species: string;
  suspected_disease: string;
  affected_animals_count: number;
  mortality_count: number;
  review_status: string;
  reported_at: string;
}

export interface CoopCampItem {
  id: string;
  campaign_id: string;
  village_id: string;
  village_name?: string;
  organizer_type: string;
  cooperative_id?: string | null;
  planned_start: string;
  planned_end: string;
  location_text?: string | null;
  status: string;
  expected_farmers?: number | null;
  created_at: string;
}

export interface CoopCampProposePayload {
  campaign_id: string;
  village_id: string;
  cooperative_id?: string;
  planned_start: string;
  planned_end: string;
  location_text?: string;
  expected_farmers?: number;
}

export interface CoopVillageProgressItem {
  village_id: string;
  village_name: string;
  village_code: string;
  total_animals: number;
  total_farmers: number;
  vaccinated_animals: number;
  coverage_percent: number;
  disease_alert?: boolean;
  active_campaigns_count?: number;
  status?: string;
  status_label?: string;
}

export interface CoopVillageMapFeature {
  type: 'Feature';
  id: string;
  geometry: any;
  properties: {
    village_id: string;
    village_name: string;
    village_name_en?: string;
    village_code: string;
    member_farmers_count: number;
    total_animals: number;
    vaccinated_animals: number;
    pending_animals: number;
    coverage_pct: number;
    fill_color: string;
    fillColor?: string;
    border_color?: string;
    fill_opacity?: number;
    status: 'HIGH' | 'MODERATE' | 'LOW' | 'CRITICAL' | 'ALERT';
    status_label: string;
    active_campaigns_count: number;
    disease_alert: boolean;
    disease_cases_count: number;
    camps_count: number;
    latitude?: number;
    longitude?: number;
  };
}

export interface CoopVillageMapData {
  cooperative: {
    id: string;
    code: string;
    name_gu: string;
    name_en: string;
    district_id?: string | null;
    taluka_id?: string | null;
    village_id?: string | null;
  };
  summary: {
    total_villages: number;
    total_members: number;
    total_animals: number;
    total_vaccinated: number;
    overall_coverage_pct: number;
    alert_villages_count: number;
    active_campaigns_count: number;
  };
  villages_geojson: {
    type: 'FeatureCollection';
    features: CoopVillageMapFeature[];
  };
}

export interface CoopVillageDetailTelemetry {
  village: {
    id: string;
    name_gu: string;
    name_en: string;
    code: string;
    latitude?: number;
    longitude?: number;
  };
  kpis: {
    total_members: number;
    total_animals: number;
    vaccinated_animals: number;
    pending_animals: number;
    coverage_pct: number;
    disease_reports_count: number;
    active_campaigns_count: number;
    camps_count: number;
  };
  species_breakdown: Record<string, number>;
  farmers: Array<{
    farmer_id: string;
    farmer_code: string;
    full_name: string;
    mobile_e164?: string;
    member_no?: string;
    joined_on?: string;
    total_animals: number;
    vaccinated_animals: number;
    coverage_percent: number;
  }>;
  animals: Array<{
    id: string;
    animal_code: string;
    bharat_pashudhan_tag?: string;
    species: string;
    breed: string;
    sex: string;
    farmer_name: string;
    farmer_id: string;
    vaccination_status: string;
    last_vaccinated_at?: string;
    next_due_date?: string;
  }>;
  vaccinations: Array<{
    id: string;
    animal_code: string;
    species: string;
    farmer_name: string;
    vaccine_name: string;
    disease_name: string;
    dose_number: number;
    batch_number: string;
    administered_at: string;
    status: string;
  }>;
  disease_reports: Array<{
    report_id: string;
    report_code: string;
    disease_code: string;
    status: string;
    received_at: string;
    affected_count: number;
  }>;
  campaigns: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    start_date?: string;
    end_date?: string;
  }>;
  camps: Array<{
    id: string;
    camp_code: string;
    organizer_type: string;
    status: string;
    planned_start?: string;
    planned_end?: string;
    location_text?: string;
    expected_farmers?: number;
  }>;
}

export interface CoopDashboardAnalytics {
  cooperative: Record<string, any>;
  kpis: {
    total_member_farmers: number;
    total_animals: number;
    fully_vaccinated_animals: number;
    partially_vaccinated_animals: number;
    pending_vaccinations: number;
    overdue_vaccinations: number;
    overall_coverage_pct: number;
    active_campaigns: number;
    linked_villages: number;
    suspected_disease_cases: number;
    total_camps?: number;
  };
  charts: {
    monthly_trend: Array<{ month: string; doses: number }>;
    species_distribution: Array<{ species: string; count: number; color: string }>;
    status_distribution: Array<{ name: string; value: number; color: string }>;
    village_farmers: Array<{ village: string; farmers: number }>;
    village_livestock: Array<{ village: string; animals: number }>;
    village_coverage: Array<{ village: string; coverage_pct: number }>;
    campaign_progress: Array<{ campaign: string; target: number; achieved: number }>;
    disease_trends: Array<{ week: string; suspected: number; verified: number }>;
  };
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
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });
}

export const coopService = {
  // =========================================================================
  // DAHO Administrative Management
  // =========================================================================
  async dahoListCooperatives(
    apiBaseUrl: string,
    params: {
      district_id?: string;
      taluka_id?: string;
      village_id?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CoopSummaryItem[]> {
    const q = new URLSearchParams();
    if (params.district_id) q.set('district_id', params.district_id);
    if (params.taluka_id) q.set('taluka_id', params.taluka_id);
    if (params.village_id) q.set('village_id', params.village_id);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));

    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives?${q.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'ડેરી સહકારી મંડળીઓની યાદી મેળવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoCreateCooperative(apiBaseUrl: string, payload: CoopRegisterPayload): Promise<CoopDetailItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'સહકારી મંડળી બનાવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoGetCooperative(apiBaseUrl: string, coopId: string): Promise<CoopDetailItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/${coopId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'મંડળીની વિગતો મેળવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoUpdateCooperative(apiBaseUrl: string, coopId: string, payload: Partial<CoopRegisterPayload>): Promise<CoopDetailItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/${coopId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'મંડળી અપડેટ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoSetStatus(apiBaseUrl: string, coopId: string, statusVal: string, reason?: string): Promise<CoopDetailItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/${coopId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusVal, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'સ્થિતિ બદલવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoResendEmail(apiBaseUrl: string, coopId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/${coopId}/resend-email`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'ઈમેઇલ ફરી મોકલવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoListMembers(apiBaseUrl: string, coopId: string, search?: string): Promise<CoopMemberFarmerItem[]> {
    const q = new URLSearchParams({ limit: '200' });
    if (search) q.set('search', search);
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/${coopId}/members?${q.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  async dahoLinkMember(apiBaseUrl: string, coopId: string, farmerId: string, memberNo?: string, joinedOn?: string): Promise<CoopMemberFarmerItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/${coopId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        farmer_id: farmerId,
        member_no: memberNo,
        joined_on: joinedOn,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'સભાસદ લિંક કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoUnlinkMember(apiBaseUrl: string, coopId: string, farmerId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/${coopId}/members/${farmerId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'સભાસદ દૂર કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoSeedDemo(apiBaseUrl: string, districtId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/seed-demo?district_id=${districtId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'ડેમો ડેટા બનાવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async dahoResetDemo(apiBaseUrl: string, districtId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/daho/cooperatives/reset-demo?district_id=${districtId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'ડેમો ડેટા રીસેટ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // =========================================================================
  // Dairy Cooperative Portal Methods
  // =========================================================================
  async getMyCoopProfile(apiBaseUrl: string): Promise<CoopDetailItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/me`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'ડેરી સહકારી પ્રોફાઇલ મેળવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async getDashboardAnalytics(apiBaseUrl: string, coopId?: string): Promise<CoopDashboardAnalytics> {
    const q = coopId ? `?coop_id=${coopId}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/analytics${q}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'એનાલિટિક્સ મેળવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async listMemberFarmers(apiBaseUrl: string, search?: string): Promise<CoopMemberFarmerItem[]> {
    const q = new URLSearchParams({ limit: '200' });
    if (search) q.set('search', search);
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/farmers?${q.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  async linkMemberFarmer(apiBaseUrl: string, farmerId: string, memberNo?: string, joinedOn?: string): Promise<CoopMemberFarmerItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/farmers`, {
      method: 'POST',
      body: JSON.stringify({
        farmer_id: farmerId,
        member_no: memberNo,
        joined_on: joinedOn,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'સભાસદ ઉમેરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async unlinkMemberFarmer(apiBaseUrl: string, farmerId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/farmers/${farmerId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'સભાસદ દૂર કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async listMemberAnimals(
    apiBaseUrl: string,
    params: { species?: string; status?: string; search?: string } = {}
  ): Promise<CoopAnimalItem[]> {
    const q = new URLSearchParams({ limit: '100' });
    if (params.species) q.set('species', params.species);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);

    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/animals?${q.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  async listVaccinations(apiBaseUrl: string): Promise<CoopVaccinationItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/vaccinations?limit=100`);
    if (!res.ok) return [];
    return res.json();
  },

  async listSurveillance(apiBaseUrl: string): Promise<CoopSurveillanceItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/surveillance?limit=50`);
    if (!res.ok) return [];
    return res.json();
  },

  async getReports(apiBaseUrl: string, reportType: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/reports?report_type=${reportType}`);
    if (!res.ok) return null;
    return res.json();
  },

  async getVillageMapData(apiBaseUrl: string): Promise<CoopVillageMapData> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/village-map`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'નકશા ડેટા લોડ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async getVillageDetails(apiBaseUrl: string, villageId: string): Promise<CoopVillageDetailTelemetry> {
    const res = await authFetch(apiBaseUrl, `/api/v1/cooperative/villages/${villageId}/details`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'ગામ વિગતો લોડ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // Backward compatibility with camps and village progress
  async getServedVillagesProgress(apiBaseUrl: string): Promise<CoopVillageProgressItem[]> {
    try {
      const mapData = await this.getVillageMapData(apiBaseUrl);
      if (mapData?.villages_geojson?.features?.length > 0) {
        return mapData.villages_geojson.features.map((f) => ({
          village_id: f.properties.village_id,
          village_name: f.properties.village_name,
          village_code: f.properties.village_code,
          total_animals: f.properties.total_animals,
          total_farmers: f.properties.member_farmers_count,
          vaccinated_animals: f.properties.vaccinated_animals,
          coverage_percent: f.properties.coverage_pct,
          disease_alert: f.properties.disease_alert,
          active_campaigns_count: f.properties.active_campaigns_count,
          status: f.properties.status,
          status_label: f.properties.status_label,
        }));
      }
    } catch {
      // Fallback to analytics charts if map data is pending
    }

    try {
      const analytics = await this.getDashboardAnalytics(apiBaseUrl);
      if (analytics?.charts?.village_coverage) {
        return analytics.charts.village_coverage.map((vc, i) => {
          const vl = analytics.charts.village_livestock?.[i]?.animals || 0;
          const vf = analytics.charts.village_farmers?.[i]?.farmers || 0;
          const cov = typeof vc.coverage_pct === 'number' ? vc.coverage_pct : 0;
          return {
            village_id: `v-${i}`,
            village_name: vc.village,
            village_code: `VIL-${i + 1}`,
            total_animals: vl,
            total_farmers: vf,
            vaccinated_animals: Math.round((vl * cov) / 100),
            coverage_percent: cov,
          };
        });
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async listCamps(apiBaseUrl: string, cooperativeId?: string): Promise<CoopCampItem[]> {
    const query = new URLSearchParams({ limit: '50' });
    if (cooperativeId) query.set('cooperative_id', cooperativeId);
    const res = await authFetch(apiBaseUrl, `/api/v1/camps?${query.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  async proposeCamp(apiBaseUrl: string, payload: CoopCampProposePayload): Promise<CoopCampItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/camps`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        organizer_type: 'COOPERATIVE',
        vaccine_availability: 'UNKNOWN',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || `કેમ્પ દરખાસ્ત સબમિટ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async listActiveCampaigns(apiBaseUrl: string): Promise<Array<{ id: string; name_gu: string; name_en: string }>> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns?status=ACTIVE&limit=20`);
    if (!res.ok) return [];
    return res.json();
  },
};
