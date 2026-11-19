/**
 * PashuRakshak Botad — Duty & Smart Assignment Client Service.
 *
 * Implements communication with /api/v1/duty endpoints for:
 * - VO live Field Worker location queries
 * - Automatic Complaint Group generation and listing
 * - Intelligent FW recommendations with Haversine distance, workload & reasoning
 * - Final assignment confirmation & manual override
 * - FW assignment task execution (Accept, Start Visit, Complete Visit)
 * - Farmer help request creation
 */
import { authService } from './authService';

export interface LiveFieldWorkerItem {
  fw_user_id: string;
  full_name: string;
  username?: string | null;
  mobile_e164?: string | null;
  designation?: string | null;
  duty_status: 'ACTIVE' | 'INACTIVE';
  freshness: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'INACTIVE';
  last_known_latitude?: number | null;
  last_known_longitude?: number | null;
  location_accuracy?: number | null;
  last_location_update?: string | null;
  minutes_since_update?: number | null;
  nearest_village_name_gu?: string | null;
  assigned_villages_count: number;
  assigned_villages_gu: string[];
  active_assignments_count: number;
  pending_complaints_count: number;
  availability_status: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
}

export interface VoLiveFieldWorkersResponse {
  total_field_workers: number;
  active_on_duty: number;
  fresh_location_count: number;
  stale_location_count: number;
  field_workers: LiveFieldWorkerItem[];
}

export interface ComplaintGroupItemDetail {
  id: string;
  complaint_id: string;
  complaint_type: string;
  village_id: string;
  village_name_gu: string;
  village_code: string;
  requester_name?: string | null;
  contact_number?: string | null;
  problem_text?: string | null;
  animal_code?: string | null;
  status: string;
  outcome_note?: string | null;
  visited_at?: string | null;
}

export interface ComplaintGroupResponse {
  id: string;
  group_code: string;
  district_id: string;
  taluka_id?: string | null;
  taluka_name_gu?: string | null;
  status: 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  total_complaints: number;
  villages_count: number;
  villages_summary_gu: string[];
  centroid_latitude?: number | null;
  centroid_longitude?: number | null;
  assigned_fw_id?: string | null;
  assigned_fw_name?: string | null;
  assigned_by_name?: string | null;
  assigned_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  assignment_reason?: string | null;
  created_at: string;
  items: ComplaintGroupItemDetail[];
}

export interface FwRecommendationItem {
  fw_user_id: string;
  full_name: string;
  username?: string | null;
  mobile_e164?: string | null;
  distance_km: number;
  freshness: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'INACTIVE';
  duty_status: 'ACTIVE' | 'INACTIVE';
  last_known_latitude?: number | null;
  last_known_longitude?: number | null;
  last_location_update?: string | null;
  active_assignments_count: number;
  pending_complaints_count: number;
  assigned_villages_count: number;
  is_village_assigned: boolean;
  score: number;
  rank: number;
  recommendation_reason: string;
}

export interface GroupRecommendationsResponse {
  group_id: string;
  group_code: string;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  suggestion_radius_km: number;
  has_eligible_recommendations: boolean;
  notice_gu?: string | null;
  recommendations: FwRecommendationItem[];
}

export interface AssignmentActionResponse {
  success: boolean;
  group_id: string;
  assigned_fw_id: string;
  assigned_fw_name: string;
  status: string;
  message: string;
}

export interface DutyStatusResponse {
  is_on_duty: boolean;
  session_id?: string | null;
  start_time?: string | null;
  last_known_latitude?: number | null;
  last_known_longitude?: number | null;
  last_location_update?: string | null;
  location_accuracy?: number | null;
  freshness: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'INACTIVE';
  minutes_since_update?: number | null;
}

export interface CreateHelpRequestPayload {
  requester_name: string;
  contact_number?: string;
  village_id: string;
  farmer_id?: string;
  animal_id?: string;
  animal_description?: string;
  problem_text: string;
  priority?: 'NORMAL' | 'HIGH' | 'CRITICAL';
}

class DutyService {
  private async authFetch(apiBaseUrl: string, path: string, options: RequestInit = {}): Promise<Response> {
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
        console.warn('Session refresh failed during duty request:', e);
      }
    }

    return res;
  }

  /**
   * Get caller's current duty and location status
   */
  public async getDutyStatus(apiBaseUrl: string): Promise<DutyStatusResponse> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/status`);
    if (!res.ok) {
      throw new Error(`ડ્યૂટી સ્થિતિ મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Fetch live Field Worker locations for VO's district / jurisdiction map
   */
  public async getVoLiveFieldWorkers(apiBaseUrl: string): Promise<VoLiveFieldWorkersResponse> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/vo/live-field-workers`);
    if (!res.ok) {
      throw new Error(`લાઇવ ફિલ્ડ વર્કર્સ ડેટા મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * List all complaint assignment groups in VO's jurisdiction
   */
  public async listComplaintGroups(
    apiBaseUrl: string,
    statusFilter?: string
  ): Promise<ComplaintGroupResponse[]> {
    const query = statusFilter ? `?status_filter=${statusFilter}` : '';
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/vo/complaint-groups${query}`);
    if (!res.ok) {
      throw new Error(`ફરિયાદ જૂથો લોડ કરવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Trigger automatic clustering of pending complaints into assignment groups
   */
  public async generateComplaintGroups(apiBaseUrl: string): Promise<ComplaintGroupResponse[]> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/vo/complaint-groups/generate`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'જૂથ બનાવવામાં નિષ્ફળ.' }));
      throw new Error(err.detail || `સર્વર ભૂલ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Get intelligent recommendations for a complaint group (Top 2-3 ranked FWs)
   */
  public async getGroupRecommendations(
    apiBaseUrl: string,
    groupId: string
  ): Promise<GroupRecommendationsResponse> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/vo/complaint-groups/${groupId}/recommendations`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'ભલામણો મેળવવામાં નિષ્ફળ.' }));
      throw new Error(err.detail || `સર્વર ભૂલ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Assign a complaint group to a Field Worker (Recommended or Manual with reason)
   */
  public async assignGroup(
    apiBaseUrl: string,
    groupId: string,
    fwUserId: string,
    reason?: string
  ): Promise<AssignmentActionResponse> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/vo/complaint-groups/${groupId}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        fw_user_id: fwUserId,
        reason: reason || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'સોંપણી કરવામાં નિષ્ફળ.' }));
      throw new Error(err.detail || `સર્વર ભૂલ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * List assignments assigned to the logged-in Field Worker
   */
  public async getFwAssignments(apiBaseUrl: string): Promise<ComplaintGroupResponse[]> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/assignments`);
    if (!res.ok) {
      throw new Error(`સોંપાયેલ કામગીરી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Update assignment progress status by Field Worker
   * Actions: 'ACCEPT', 'START_VISIT', 'COMPLETE'
   */
  public async updateAssignmentStatus(
    apiBaseUrl: string,
    groupId: string,
    action: 'ACCEPT' | 'START_VISIT' | 'COMPLETE',
    complaintId?: string,
    outcomeNote?: string
  ): Promise<{ success: boolean; group_id: string; status: string; message: string }> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/assignments/${groupId}/status`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        complaint_id: complaintId || undefined,
        outcome_note: outcomeNote || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'કામગીરી અપડેટ કરવામાં નિષ્ફળ.' }));
      throw new Error(err.detail || `સર્વર ભૂલ: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Register a manual complaint / help request
   */
  public async createHelpRequest(
    apiBaseUrl: string,
    payload: CreateHelpRequestPayload
  ): Promise<{ success: boolean; complaint_id: string; reference_no: string; message: string }> {
    const res = await this.authFetch(apiBaseUrl, `/api/v1/duty/vo/complaints/create`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'ફરિયાદ નોંધણીમાં નિષ્ફળ.' }));
      throw new Error(err.detail || `સર્વર ભૂલ: HTTP ${res.status}`);
    }
    return res.json();
  }
}

export const dutyService = new DutyService();

