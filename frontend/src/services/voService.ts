/**
 * PashuRakshak Botad — Veterinary Officer (VO) Service.
 *
 * Coordinates:
 * - Disease surveillance review inbox & decisions (/api/v1/disease-reports)
 * - Animal vaccination events & treatments (/api/v1/vaccinations)
 * - Veterinary camps lifecycle (/api/v1/veterinary-camps)
 * - Campaign field worker assignments (/api/v1/campaigns/{id}/assignments)
 * - Vaccine inventory read (/api/v1/vaccine-inventory)
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
      console.warn('Session refresh failed during VO request:', e);
    }
  }

  return res;
}

export interface VODiseaseReport {
  report_id: string;
  report_no?: string | null;
  animal_id?: string | null;
  farmer_id?: string | null;
  village_id: string;
  disease_code: string;
  report_source: string;
  report_date: string;
  symptoms: string[];
  observation_text?: string | null;
  status: string;
  reported_by: string;
  received_at: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  confirmation_basis?: string | null;
  not_confirmed_reason?: string | null;
}

export interface VODiseaseReview {
  id: string;
  report_id: string;
  reviewer_id: string;
  reviewer_role: string;
  review_type: string;
  assessment: string;
  basis?: string | null;
  authorised_to_confirm: boolean;
  at: string;
}

export interface VOCamp {
  id: string;
  camp_code?: string | null;
  campaign_id: string;
  village_id: string;
  organizer_type: string;
  cooperative_id?: string | null;
  planned_start: string;
  planned_end: string;
  location_text?: string | null;
  status: string;
  vaccine_availability: string;
  vaccine_note?: string | null;
  expected_farmers?: number | null;
  proposed_by: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  cancelled_reason?: string | null;
  created_at: string;
}

export interface VOVaccination {
  event_id: string;
  animal_id: string;
  village_id: string;
  programme_code: string;
  event_date: string;
  batch_number?: string | null;
  dose_note?: string | null;
  campaign_id?: string | null;
  camp_id?: string | null;
  administered_by_name?: string | null;
  authorization_check: string;
  review_status: string;
  remarks?: string | null;
  received_at: string;
}

export interface VOTreatment {
  event_id: string;
  animal_id: string;
  village_id: string;
  event_date: string;
  treatment_text: string;
  diagnosis_text?: string | null;
  medicine_text?: string | null;
  follow_up_date?: string | null;
  performed_by: string;
  review_status: string;
  remarks?: string | null;
  received_at: string;
}

export interface VOCampaignVillageAssignment {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  disease_code?: string;
  start_date?: string | null;
  end_date?: string | null;
  campaign_status: string;
  village_id: string;
  village_code: string;
  village_name_gu: string;
  village_name_en: string;
  taluka_name?: string | null;
  acceptance_status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED';
  rejection_reason?: string | null;
  assigned_at?: string | null;
  eligible_animals_count: number;
  vaccinated_animals_count: number;
  pending_animals_count: number;
  species_names_gu: string[];
  assigned_fws: Array<{ user_id: string; full_name: string; username?: string }>;
}

export interface VOCampaignAssignment {
  id: string;
  campaign_id: string;
  village_id: string;
  worker_user_id: string;
  assigned_by: string;
  assigned_at: string;
  ended_at?: string | null;
}

export const voService = {
  // 1. Disease Surveillance
  async listReports(
    apiBaseUrl: string,
    params?: { status?: string; disease_code?: string; limit?: number; offset?: number }
  ): Promise<VODiseaseReport[]> {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.disease_code) q.append('disease_code', params.disease_code);
    q.append('limit', String(params?.limit || 50));
    q.append('offset', String(params?.offset || 0));

    const res = await authFetch(apiBaseUrl, `/api/v1/disease-reports?${q.toString()}`);
    if (!res.ok) throw new Error(`રોગ અહેવાલો લોડ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async getReport(apiBaseUrl: string, reportId: string): Promise<VODiseaseReport> {
    const res = await authFetch(apiBaseUrl, `/api/v1/disease-reports/${reportId}`);
    if (!res.ok) throw new Error(`રોગ અહેવાલ વિગત મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async addReview(
    apiBaseUrl: string,
    reportId: string,
    payload: { review_type: string; assessment: string; basis?: string }
  ): Promise<VODiseaseReview> {
    const res = await authFetch(apiBaseUrl, `/api/v1/disease-reports/${reportId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સમીક્ષા નોંધવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async decideReport(
    apiBaseUrl: string,
    reportId: string,
    payload: { action: 'CONFIRM' | 'DISPROVE' | 'INSUFFICIENT'; confirmation_basis?: string; not_confirmed_reason?: string }
  ): Promise<VODiseaseReport> {
    const res = await authFetch(apiBaseUrl, `/api/v1/disease-reports/${reportId}/decide`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `નિર્ણય સાચવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  // 2. Camps
  async listCamps(apiBaseUrl: string, status?: string): Promise<VOCamp[]> {
    const q = status ? `?status=${status}&limit=100` : '?limit=100';
    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps${q}`);
    if (!res.ok) throw new Error(`કેમ્પ યાદી લોડ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async confirmCamp(apiBaseUrl: string, campId: string, payload?: { vaccine_availability?: string; vaccine_note?: string }): Promise<VOCamp> {
    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps/${campId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `કેમ્પ મંજૂર કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async rescheduleCamp(
    apiBaseUrl: string,
    campId: string,
    payload: { new_planned_start: string; new_planned_end: string; reason: string }
  ): Promise<VOCamp> {
    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps/${campId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `કેમ્પ પુનઃનિર્ધારિત કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async cancelCamp(apiBaseUrl: string, campId: string, reason: string): Promise<VOCamp> {
    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps/${campId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled_reason: reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `કેમ્પ રદ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async completeCamp(apiBaseUrl: string, campId: string, notes?: string): Promise<VOCamp> {
    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps/${campId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `કેમ્પ પૂર્ણ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async assignCampStaff(apiBaseUrl: string, campId: string, payload: { user_id: string; camp_role: string }): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/veterinary-camps/${campId}/staff`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સ્ટાફ સોંપવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  // 3. Vaccinations & Treatments
  async listVaccinations(apiBaseUrl: string, animalId?: string): Promise<VOVaccination[]> {
    const q = animalId ? `?animal_id=${animalId}&limit=100` : '?limit=100';
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations${q}`);
    if (!res.ok) throw new Error(`રસીકરણ ઇવેન્ટ લોડ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async recordVaccination(
    apiBaseUrl: string,
    payload: {
      animal_id: string;
      village_id: string;
      programme_code: string;
      event_date: string;
      batch_number?: string;
      remarks?: string;
    }
  ): Promise<VOVaccination> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `રસીકરણ નોંધવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async listTreatments(apiBaseUrl: string, animalId?: string): Promise<VOTreatment[]> {
    const q = animalId ? `?animal_id=${animalId}&limit=100` : '?limit=100';
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations/treatments${q}`);
    if (!res.ok) throw new Error(`સારવાર રેકોર્ડ લોડ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async recordTreatment(
    apiBaseUrl: string,
    payload: {
      animal_id: string;
      village_id: string;
      event_date: string;
      treatment_text: string;
      diagnosis_text?: string;
      medicine_text?: string;
      follow_up_date?: string;
      remarks?: string;
    }
  ): Promise<VOTreatment> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations/treatments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `સારવાર નોંધવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async reviewEvent(apiBaseUrl: string, eventId: string, reviewStatus: 'REVIEWED' | 'FLAGGED', reviewNote?: string): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations/events/${eventId}/review`, {
      method: 'POST',
      body: JSON.stringify({ review_status: reviewStatus, review_note: reviewNote }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ઇવેન્ટ સમીક્ષા કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  async correctEvent(
    apiBaseUrl: string,
    eventId: string,
    payload: { action: 'AMEND' | 'VOID'; reason: string; replacement_event_id?: string }
  ): Promise<void> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations/events/${eventId}/correct`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ઇવેન્ટ સુધારણા નિષ્ફળ: HTTP ${res.status}`);
    }
  },

  // 4. Campaign FW Coordination & VO Acceptance
  async listMyCampaignAssignments(apiBaseUrl: string): Promise<VOCampaignVillageAssignment[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/vo/my-assignments`);
    if (!res.ok) throw new Error(`ઝુંબેશ સોંપણી યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async acceptCampaignAssignment(apiBaseUrl: string, campaignId: string, villageId: string): Promise<VOCampaignVillageAssignment> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/villages/${villageId}/accept`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ઝુંબેશ સ્વીકારવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async rejectCampaignAssignment(apiBaseUrl: string, campaignId: string, villageId: string, reason: string): Promise<VOCampaignVillageAssignment> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/villages/${villageId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ઝુંબેશ અસ્વીકાર કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async listCampaignAssignments(apiBaseUrl: string, campaignId: string): Promise<VOCampaignAssignment[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/assignments`);
    if (!res.ok) throw new Error(`ઝુંબેશ સ્ટાફ સોંપણી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    return res.json();
  },

  async assignCampaignWorker(
    apiBaseUrl: string,
    campaignId: string,
    payload: { village_id: string; worker_user_id: string }
  ): Promise<VOCampaignAssignment> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'નિષ્ફળ' }));
      throw new Error(err.detail || `ક્ષેત્રીય કાર્યકર સોંપવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  // 5. Jurisdictional Master Data Helpers
  async listVillages(apiBaseUrl: string): Promise<Array<{ id: string; name_gu: string; name_en: string; code: string }>> {
    try {
      const res = await authFetch(apiBaseUrl, `/api/v1/administration/villages?limit=200`);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  },

  async listFieldWorkers(apiBaseUrl: string): Promise<Array<{ id: string; full_name: string; username: string }>> {
    try {
      const res = await authFetch(apiBaseUrl, `/api/v1/administration/field-workers?limit=100`);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  },
};

