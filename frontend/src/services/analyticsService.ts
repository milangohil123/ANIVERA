/**
 * PashuRakshak Inference & Analytics API Service Layer
 * Interfaces strictly with PostgreSQL-backed /api/v1/analytics endpoints.
 */

export interface AnalyticsMetadata {
  districts: Array<{ id: string; code: string; name_en: string; name_gu: string }>;
  talukas: Array<{ id: string; district_id: string; code: string; name_en: string; name_gu: string }>;
  programmes: Array<{ code: string; name_en: string; name_gu: string }>;
  vaccines: Array<{ code: string; name_en: string; name_gu: string; disease_code: string }>;
  diseases: Array<{ code: string; name_en: string; name_gu: string; color?: string }>;
  species: Array<{ code: string; name_en: string; name_gu: string }>;
  user_role: string;
  can_select_all_districts: boolean;
}

export interface VaccinationAnalyticsParams {
  programme_code?: string;
  vaccine_code?: string;
  disease_code?: string;
  start_date?: string;
  end_date?: string;
  district_ids?: string[];
  taluka_ids?: string[];
  village_ids?: string[];
  species_codes?: string[];
}

export interface VaccinationAnalyticsResponse {
  kpis: {
    total_eligible_animals: number;
    vaccinated_animals: number;
    pending_animals: number;
    coverage_percentage: number;
    total_programmes: number;
    total_doses_administered: number;
  };
  filters_applied: Record<string, any>;
  graphs: {
    coverage: {
      eligible: number;
      vaccinated: number;
      pending: number;
      coverage_pct: number;
      total_doses: number;
    };
    programme_progress: Array<{
      programme_code: string;
      programme_name: string;
      vaccinated_count: number;
      pending_count: number;
      total_target: number;
      coverage_pct: number;
    }>;
    district_comparison: Array<{
      district_id: string;
      district_name_gu: string;
      district_name_en: string;
      eligible_count: number;
      vaccinated_count: number;
      pending_count: number;
      coverage_pct: number;
    }>;
    species_comparison: Array<{
      species_code: string;
      species_name_gu: string;
      species_name_en: string;
      eligible_count: number;
      vaccinated_count: number;
      pending_count: number;
      coverage_pct: number;
    }>;
    time_trend: Array<{
      period: string;
      label: string;
      value: number;
      cumulative: number;
    }>;
  };
}

export interface DiseaseAnalyticsParams {
  disease_code?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  district_ids?: string[];
  taluka_ids?: string[];
  village_ids?: string[];
  species_codes?: string[];
}

export interface DiseaseAnalyticsResponse {
  kpis: {
    total_disease_reports: number;
    confirmed_cases: number;
    pending_disease_reports: number;
    completed_verified_cases: number;
    distinct_diseases_count: number;
  };
  filters_applied: Record<string, any>;
  graphs: {
    disease_wise_reports: Array<{
      disease_code: string;
      disease_name_gu: string;
      disease_name_en: string;
      total_cases: number;
      confirmed_cases: number;
      suspected_cases: number;
      percentage: number;
    }>;
    cases_trend: Array<{
      period: string;
      label: string;
      total_reports: number;
      confirmed_cases: number;
      suspected_cases: number;
    }>;
    district_comparison: Array<{
      district_id: string;
      district_name_gu: string;
      district_name_en: string;
      total_cases: number;
      confirmed_cases: number;
      pending_cases: number;
    }>;
    species_distribution: Array<{
      species_code: string;
      species_name_gu: string;
      case_count: number;
      percentage: number;
    }>;
    status_breakdown: Array<{
      status: string;
      label_gu: string;
      count: number;
      percentage: number;
    }>;
    regional_hotspots: Array<{
      taluka_id: string;
      taluka_name_gu: string;
      district_name_gu: string;
      case_count: number;
      confirmed_count: number;
      risk_level: 'HIGH' | 'MODERATE' | 'LOW';
    }>;
  };
}

function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v) query.append(key, String(v));
      });
    } else {
      query.append(key, String(value));
    }
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const analyticsService = {
  async getMetadata(apiBaseUrl: string, token: string): Promise<AnalyticsMetadata> {
    const res = await fetch(`${apiBaseUrl}/api/v1/analytics/metadata`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      // Fallback attempt to /reports/analytics/metadata
      const res2 = await fetch(`${apiBaseUrl}/api/v1/reports/analytics/metadata`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res2.ok) throw new Error('Failed to load analytics metadata');
      return res2.json();
    }
    return res.json();
  },

  async getVaccinationAnalytics(
    apiBaseUrl: string,
    token: string,
    params: VaccinationAnalyticsParams = {}
  ): Promise<VaccinationAnalyticsResponse> {
    const qs = buildQueryString(params);
    let res = await fetch(`${apiBaseUrl}/api/v1/analytics/vaccination${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      res = await fetch(`${apiBaseUrl}/api/v1/reports/analytics/vaccination${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to load vaccination analytics');
    }
    return res.json();
  },

  async getDiseaseAnalytics(
    apiBaseUrl: string,
    token: string,
    params: DiseaseAnalyticsParams = {}
  ): Promise<DiseaseAnalyticsResponse> {
    const qs = buildQueryString(params);
    let res = await fetch(`${apiBaseUrl}/api/v1/analytics/disease${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      res = await fetch(`${apiBaseUrl}/api/v1/reports/analytics/disease${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to load disease surveillance analytics');
    }
    return res.json();
  },
};
