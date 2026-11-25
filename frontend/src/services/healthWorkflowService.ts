/**
 * PashuRakshak Botad - Connected Animal Health, Case Assignment, Treatment Verification,
 * Dairy Cooperative Recurring Vaccination Schedules, and Timeline Service.
 */
import { authService } from './authService';

export interface FarmerReportPayload {
  animal_id?: string;
  animal_tag_id?: string;
  is_unknown_disease: boolean;
  suspected_disease_code?: string;
  custom_disease_name?: string;
  symptoms: string[];
  symptom_onset_date?: string;
  description?: string;
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  village_id?: string;
  latitude?: number;
  longitude?: number;
  photo_urls?: string[];
}

export interface FarmerReportItem {
  report_id: string;
  report_no?: string;
  animal_id?: string;
  animal_code?: string;
  animal_tag_id?: string;
  animal_name?: string;
  species_code?: string;
  farmer_id?: string;
  farmer_name?: string;
  farmer_mobile?: string;
  farmer_address?: string;
  village_id: string;
  village_name_gu?: string;
  village_name_en?: string;
  disease_code: string;
  is_unknown_disease: boolean;
  custom_disease_name?: string;
  symptoms: string[];
  observation_text?: string;
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  treatment_status: string;
  report_date: string;
  received_at: string;
  assigned_vo_id?: string;
  assigned_vo_name?: string;
  assigned_fw_name?: string;
  assigned_to_role?: string;
  assignment_deadline?: string;
  hours_remaining_for_assignment?: number;
  is_assignment_overdue?: boolean;
  is_escalated_to_daho?: boolean;
  latitude?: number;
  longitude?: number;
  attachment_count: number;
  photo_urls: string[];
  treatment_record?: any;
}

export interface CaseAssignmentPayload {
  assigned_to_role?: 'VO';
  assigned_vo_id: string;
  priority?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  instructions?: string;
  planned_visit_date?: string;
}

export type CaseAssignmentRequest = CaseAssignmentPayload;

export interface CaseTreatmentPayload {
  observations: string;
  diagnosis?: string;
  treatment_text: string;
  medicine_administered?: string;
  dosage_details?: string;
  treatment_notes?: string;
  follow_up_instructions?: string;
  next_visit_date?: string;
  latitude?: number;
  longitude?: number;
  evidence_photos?: string[];
  before_treatment_photos?: string[];
  after_treatment_photos?: string[];
}

export interface DiseaseClusterAlert {
  cluster_id: string;
  disease_code: string;
  disease_name: string;
  title: string;
  severity: 'ALERT' | 'HIGH_RISK' | 'SUSPECTED_OUTBREAK';
  case_count: number;
  village_ids: string[];
  village_names: string[];
  first_report_date: string;
  latest_report_date: string;
  center_latitude?: number;
  center_longitude?: number;
  radius_km: number;
  underlying_case_ids: string[];
  cases: FarmerReportItem[];
}

export interface CaseVerificationPayload {
  action?: 'APPROVED' | 'REJECTED' | 'FOLLOW_UP_REQUIRED';
  decision?: string;
  verification_notes?: string;
  rejection_reason?: string;
  followup_instructions?: string;
}

export interface RecurringSchedulePayload {
  schedule_name: string;
  programme_code?: string;
  vaccine_code?: string;
  vaccine_name: string;
  disease_prevention_purpose?: string;
  target_species?: string[];
  target_villages?: string[];
  taluka_id?: string;
  start_date?: string;
  target_start_date?: string;
  recurrence_interval_value?: number;
  recurrence_interval_months?: number;
  recurrence_interval_unit?: 'MONTHS' | 'WEEKS' | 'DAYS';
  reminder_days_before?: number;
  execution_instructions?: string;
  description?: string;
  enrolled_animal_ids?: string[];
  submit_immediately?: boolean;
}

export interface ScheduleSummaryItem {
  id: string;
  schedule_id?: string;
  cooperative_id: string;
  cooperative_name?: string;
  schedule_name: string;
  programme_code?: string;
  vaccine_code?: string;
  vaccine_name: string;
  disease_prevention_purpose?: string;
  target_species?: string[];
  target_villages?: string[];
  taluka_id?: string;
  start_date?: string;
  target_start_date?: string;
  recurrence_interval_value?: number;
  recurrence_interval_months?: number;
  custom_recurrence_value?: number;
  custom_recurrence_unit?: string;
  recurrence_interval_unit?: string;
  reminder_days_before?: number;
  status: string;
  enrolled_animals_count: number;
  vaccinated_animals_count?: number;
  due_animals_count?: number;
  overdue_animals_count?: number;
  description?: string;
  created_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  review_notes?: string;
}

export type CooperativeScheduleSummary = ScheduleSummaryItem;
export type ScheduleEligibilityPreview = any;

export interface AnimalTimelineItem {
  event_id: string;
  event_type: string;
  event_date: string;
  title: string;
  description: string;
  performed_by?: string;
  actor_name?: string;
  actor_role?: string;
  badge_color?: string;
  status?: string;
  metadata?: Record<string, any>;
}

export type AnimalTimelineEventItem = AnimalTimelineItem;

async function authFetch(apiBaseUrl: string, path: string, options: RequestInit = {}): Promise<Response> {
  let token = await authService.getValidAccessToken(apiBaseUrl);
  if (!token) {
    const session = authService.getSession();
    token = session?.accessToken || '';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...((options.headers as Record<string, string>) || {}),
  };

  let res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (res.status === 401) {
    try {
      const refreshed = await authService.refreshAccessToken(apiBaseUrl);
      headers.Authorization = `Bearer ${refreshed}`;
      res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    } catch {
      // ignore
    }
  }
  return res;
}

export const healthWorkflowService = {
  // --- Farmer Disease Reporting ---
  async submitFarmerReport(apiBaseUrl: string, payload: FarmerReportPayload): Promise<FarmerReportItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/farmer/reports`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'અહેવાલ સબમિટ કરવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'અહેવાલ સબમિટ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async listFarmerReports(apiBaseUrl: string): Promise<FarmerReportItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/farmer/reports`);
    if (!res.ok) return [];
    return res.json();
  },

  // --- TAHO Case Assignment & Verification ---
  async listTahoCases(
    apiBaseUrl: string,
    filters?: { village_id?: string; disease_code?: string; urgency?: string; status_filter?: string }
  ): Promise<FarmerReportItem[]> {
    const q = new URLSearchParams();
    if (filters?.village_id) q.set('village_id', filters.village_id);
    if (filters?.disease_code) q.set('disease_code', filters.disease_code);
    if (filters?.urgency) q.set('urgency', filters.urgency);
    if (filters?.status_filter) q.set('status_filter', filters.status_filter);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/taho/cases${qs}`);
    if (!res.ok) return [];
    return res.json();
  },

  async assignTahoCase(apiBaseUrl: string, reportId: string, payload: CaseAssignmentRequest): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/taho/cases/${reportId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'કેસ સોંપવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'કેસ સોંપવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async verifyTahoTreatment(apiBaseUrl: string, reportId: string, payload: CaseVerificationPayload): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/taho/cases/${reportId}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'ચકાસણી નોંધવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'ચકાસણી નોંધવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // --- VO / FW Clinical Treatment ---
  async listAssignedCases(apiBaseUrl: string): Promise<FarmerReportItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/staff/cases`);
    if (!res.ok) return [];
    return res.json();
  },

  async listAssignedCasesForStaff(apiBaseUrl: string): Promise<FarmerReportItem[]> {
    return this.listAssignedCases(apiBaseUrl);
  },

  async recordCaseTreatment(apiBaseUrl: string, reportId: string, payload: CaseTreatmentPayload): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/staff/cases/${reportId}/treatment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'સારવાર નોંધવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'સારવાર નોંધવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // --- DAHO District Surveillance & Overdue Escalation ---
  async listDahoCases(
    apiBaseUrl: string,
    params?: { taluka_id?: string; disease_code?: string; is_overdue_only?: boolean; limit?: number }
  ): Promise<FarmerReportItem[]> {
    const q = new URLSearchParams();
    if (params?.taluka_id) q.set('taluka_id', params.taluka_id);
    if (params?.disease_code) q.set('disease_code', params.disease_code);
    if (params?.is_overdue_only) q.set('is_overdue_only', 'true');
    if (params?.limit) q.set('limit', String(params.limit));

    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/daho/cases?${q.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  async assignDahoCase(apiBaseUrl: string, reportId: string, payload: CaseAssignmentPayload): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/daho/cases/${reportId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'DAHO કેસ સોંપણીમાં નિષ્ફળ' }));
      throw new Error(err.detail || 'DAHO કેસ સોંપણીમાં નિષ્ફળ');
    }
    return res.json();
  },

  // --- Data-Driven Disease Outbreak & Cluster Detection ---
  async getDiseaseClusters(apiBaseUrl: string): Promise<DiseaseClusterAlert[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/gis/clusters`);
    if (!res.ok) return [];
    return res.json();
  },

  // --- Dairy Cooperative Recurring Schedules ---
  async previewScheduleEligibility(
    apiBaseUrl: string,
    params: { programme_code: string; target_species?: string } | string
  ): Promise<any> {
    const q = new URLSearchParams();
    if (typeof params === 'string') {
      q.set('programme_code', params);
      q.set('target_species', 'CATTLE,BUFFALO');
    } else {
      q.set('programme_code', params.programme_code);
      q.set('target_species', params.target_species || 'CATTLE,BUFFALO');
    }
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/coop/schedules/preview-eligibility?${q.toString()}`);
    if (!res.ok) return null;
    return res.json();
  },

  async createCooperativeSchedule(apiBaseUrl: string, payload: RecurringSchedulePayload): Promise<ScheduleSummaryItem> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/coop/schedules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'સમયપત્રક બનાવવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'સમયપત્રક બનાવવામાં નિષ્ફળ');
    }
    return res.json();
  },

  async listCooperativeSchedules(apiBaseUrl: string): Promise<ScheduleSummaryItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/coop/schedules`);
    if (!res.ok) return [];
    return res.json();
  },

  async submitScheduleToTaho(apiBaseUrl: string, scheduleId: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/coop/schedules/${scheduleId}/submit`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'સબમિટ કરવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'સબમિટ કરવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // --- TAHO Schedule Approvals ---
  async listTahoSchedules(apiBaseUrl: string): Promise<ScheduleSummaryItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/taho/schedules`);
    if (!res.ok) return [];
    return res.json();
  },

  async decideTahoSchedule(
    apiBaseUrl: string,
    scheduleId: string,
    payload: {
      action?: string;
      decision?: string;
      review_notes?: string;
      approved_start_date?: string;
      approved_execution_start?: string;
    }
  ): Promise<any> {
    const rawAction = payload.action || payload.decision || 'APPROVE';
    const action =
      rawAction === 'APPROVED' ? 'APPROVE' : rawAction === 'REJECTED' ? 'REJECT' : rawAction === 'NEEDS_REVISION' ? 'REQUEST_CHANGES' : rawAction;
    const backendPayload = {
      action,
      review_notes: payload.review_notes,
      approved_execution_start: payload.approved_execution_start || payload.approved_start_date,
    };
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/taho/schedules/${scheduleId}/decide`, {
      method: 'POST',
      body: JSON.stringify(backendPayload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિર્ણય નોંધવામાં નિષ્ફળ' }));
      throw new Error(err.detail || 'નિર્ણય નોંધવામાં નિષ્ફળ');
    }
    return res.json();
  },

  // --- 15-Day Reminders Trigger ---
  async trigger15DayReminders(apiBaseUrl: string): Promise<any> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/reminders/check-15-days`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    return res.json();
  },

  // --- Animal Chronological Timeline ---
  async getAnimalTimeline(apiBaseUrl: string, animalId: string): Promise<AnimalTimelineItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/health-cases/animals/${animalId}/timeline`);
    if (!res.ok) return [];
    return res.json();
  },
};
