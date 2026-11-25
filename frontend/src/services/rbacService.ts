/**
 * PashuRakshak / ANIVERA — RBAC (Role-Based Access Control) API Service.
 *
 * Implements communication with backend /api/v1/rbac/* endpoints:
 * - Roles & Permissions Overview and Catalog
 * - Role-Permission Matrix persistence
 * - User Role Assignments and Geographic Scopes
 * - Access and Audit Logs
 */
import { authService } from './authService';

export interface RbacRole {
  code: string;
  alias?: string;
  name_en: string;
  name_gu: string;
  badge_color: string;
  geographic_scope_type: string;
  geographic_scope_desc: string;
  description: string;
  user_count: number;
  permissions_count: number;
  permissions: string[];
}

export interface RbacPermission {
  code: string;
  name_en: string;
  name_gu: string;
  desc: string;
}

export interface RbacPermissionCategory {
  id: string;
  name_en: string;
  name_gu: string;
  icon?: string;
  permissions: RbacPermission[];
}

export interface RbacOverview {
  summary: {
    total_roles: number;
    total_permissions: number;
    total_users: number;
    total_rbac_logs: number;
  };
  roles: RbacRole[];
  categories: RbacPermissionCategory[];
  matrix: Record<string, string[]>;
}

export interface RbacUserItem {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  mobile_e164: string | null;
  role: string;
  designation?: string | null;
  organisation?: string | null;
  status: string;
  geographic_scope: string;
  created_at?: string | null;
  last_login_at?: string | null;
}

export interface RbacAuditLogItem {
  id: number;
  occurred_at: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  action: string;
  object_type?: string | null;
  object_id?: string | null;
  result: string;
  reason?: string | null;
  before_state?: any;
  after_state?: any;
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
      if (refreshed) {
        headers.Authorization = `Bearer ${refreshed}`;
        res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
      }
    } catch {}
  }

  return res;
}

export const rbacService = {
  /**
   * Fetch complete RBAC overview, categories, roles, and current matrix.
   */
  async getOverview(apiBaseUrl: string): Promise<RbacOverview> {
    const res = await authFetch(apiBaseUrl, '/api/v1/rbac/overview');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to load RBAC data' }));
      throw new Error(err.detail || `RBAC ડેટા લોડ કરવામાં નિષ્ફળ (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Update permissions for a single role.
   */
  async updateRolePermissions(
    apiBaseUrl: string,
    role: string,
    permissionCodes: string[]
  ): Promise<{ status: string; role: string; permissions_count: number }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/rbac/roles/${role}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permission_codes: permissionCodes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update permissions' }));
      throw new Error(err.detail || `પરવાનગીઓ સાચવવામાં નિષ્ફળ (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Batch update matrix across multiple roles.
   */
  async updateMatrix(
    apiBaseUrl: string,
    matrix: Record<string, string[]>
  ): Promise<{ status: string; message: string; updated_roles: string[] }> {
    const res = await authFetch(apiBaseUrl, '/api/v1/rbac/matrix', {
      method: 'PUT',
      body: JSON.stringify({ matrix }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update matrix' }));
      throw new Error(err.detail || `મેટ્રિક્સ સાચવવામાં નિષ્ફળ (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * List users with roles and geographic scopes.
   */
  async listUsers(
    apiBaseUrl: string,
    search?: string,
    role?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ total: number; limit: number; offset: number; users: RbacUserItem[] }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.append('search', search);
    if (role) params.append('role', role);

    const res = await authFetch(apiBaseUrl, `/api/v1/rbac/users?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to load users' }));
      throw new Error(err.detail || `વપરાશકર્તાઓની યાદી મેળવવામાં નિષ્ફળ (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Assign or update a user's role.
   */
  async assignUserRole(
    apiBaseUrl: string,
    userId: string,
    role: string,
    reason?: string
  ): Promise<{ status: string; user_id: string; old_role: string; new_role: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/rbac/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to assign role' }));
      throw new Error(err.detail || `ભૂમિકા બદલવામાં નિષ્ફળ (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * List RBAC audit logs.
   */
  async listLogs(
    apiBaseUrl: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ total: number; limit: number; offset: number; logs: RbacAuditLogItem[] }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await authFetch(apiBaseUrl, `/api/v1/rbac/logs?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to load logs' }));
      throw new Error(err.detail || `ઍક્સેસ લૉગ્સ મેળવવામાં નિષ્ફળ (HTTP ${res.status})`);
    }
    return res.json();
  },
};
