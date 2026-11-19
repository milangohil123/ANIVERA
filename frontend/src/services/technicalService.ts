/**
 * PashuRakshak Botad — SYS_ADMIN Technical Monitoring & Audit Service.
 *
 * Scoped strictly to technical and security metadata:
 * - System health diagnostics via /api/v1/health
 * - Technical overview counters via /api/v1/technical/overview
 * - User directory & account lock status via /api/v1/technical/users
 * - Registered field devices via /api/v1/technical/devices
 * - Immutable audit trail via /api/v1/technical/audit-logs
 *
 * Invariant: SYS_ADMIN receives NO operational geographic or clinical data.
 */
import { authService } from './authService';

export interface TechnicalOverview {
  status: string;
  total_users: number;
  active_users: number;
  total_devices: number;
  active_devices: number;
  total_audit_events: number;
}

export interface TechnicalUser {
  id: string;
  username?: string | null;
  full_name: string;
  mobile_e164?: string | null;
  role: string;
  status: string;
  designation?: string | null;
  organisation?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

export interface TechnicalDevice {
  id: string;
  user_id: string;
  user_full_name?: string | null;
  label?: string | null;
  first_seen_at: string;
  last_seen_at?: string | null;
  last_sync_at?: string | null;
  pending_count_reported?: number | null;
  status: string;
}

export interface TechnicalAuditItem {
  id: number;
  occurred_at: string;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  action: string;
  object_type?: string | null;
  object_id?: string | null;
  result: string;
  reason?: string | null;
  ip?: string | null;
}

export interface SystemHealthResponse {
  status: string;
  app_name?: string;
  version?: string;
  environment?: string;
  database?: {
    connected: boolean;
    pool_size?: number;
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

export const technicalService = {
  /**
   * Fetch technical system overview metrics.
   */
  async getOverview(apiBaseUrl: string): Promise<TechnicalOverview> {
    const res = await authFetch(apiBaseUrl, `/api/v1/technical/overview`);
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.');
      }
      throw new Error(`સિસ્ટમ ઓવરવ્યૂ મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * List system accounts for technical identity administration.
   */
  async listUsers(
    apiBaseUrl: string,
    role?: string,
    status?: string,
    search?: string
  ): Promise<TechnicalUser[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (role) query.set('role', role);
    if (status) query.set('status', status);
    if (search) query.set('search', search);

    const res = await authFetch(apiBaseUrl, `/api/v1/technical/users?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`વપરાશકર્તાઓની યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * List field devices registered for offline synchronization.
   */
  async listDevices(apiBaseUrl: string, status?: string): Promise<TechnicalDevice[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (status) query.set('status', status);

    const res = await authFetch(apiBaseUrl, `/api/v1/technical/devices?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`ઉપકરણોની યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * Read immutable system audit logs.
   */
  async listAuditLogs(
    apiBaseUrl: string,
    action?: string,
    result?: string
  ): Promise<TechnicalAuditItem[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (action) query.set('action', action);
    if (result) query.set('result', result);

    const res = await authFetch(apiBaseUrl, `/api/v1/technical/audit-logs?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`ઓડિટ લોગ મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * Diagnostic check against /api/v1/health.
   */
  async getHealth(apiBaseUrl: string): Promise<SystemHealthResponse> {
    const res = await fetch(`${apiBaseUrl}/api/v1/health`);
    if (!res.ok) {
      return { status: 'UNHEALTHY', database: { connected: false } };
    }
    return res.json();
  },
};

