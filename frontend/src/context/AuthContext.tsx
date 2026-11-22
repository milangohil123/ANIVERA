import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { authService, type AuthSession } from '../services/authService';
import { type DeviceInfo } from '../services/syncController';
import { type UserProfileResponse, type UserScopeResponse } from '../types/auth';

export type NormalizedRole = 'DAHO' | 'TAHO' | 'VO' | 'FW' | 'FARMER' | 'COOP' | 'SYS_ADMIN' | 'UNKNOWN';

export interface AuthContextType {
  session: AuthSession | null;
  profile: UserProfileResponse | null;
  scope: UserScopeResponse | null;
  role: NormalizedRole;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  deviceInfo: DeviceInfo;
  apiBaseUrl: string;
  selectedDistrictId: string | null;
  setSelectedDistrictId: (id: string | null) => void;
  selectedDistrict: any | null;
  assignedDistricts: Array<{ id: string; district_id?: string; code?: string; name_en?: string; name_gu?: string }>;
  assignedTalukas: Array<{ id: string; taluka_id?: string; district_id?: string; code?: string; name_en?: string; name_gu?: string; village_count?: number }>;
  loginStaff: (username: string, password: string) => Promise<AuthSession>;
  verifyFarmerOtp: (mobile: string, otpCode: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  rolePrefix: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function normalizeRole(roleRaw?: string | null): NormalizedRole {
  if (!roleRaw) return 'UNKNOWN';
  const upper = roleRaw.trim().toUpperCase();
  if (upper === 'DAHO') return 'DAHO';
  if (upper === 'TAHO' || upper === 'TALUKA_OFFICER') return 'TAHO';
  if (upper === 'VO' || upper === 'VET_OFFICER') return 'VO';
  if (upper === 'FW' || upper === 'FIELD_WORKER') return 'FW';
  if (upper === 'FARMER') return 'FARMER';
  if (upper === 'DAIRY_STAFF' || upper === 'COOPERATIVE' || upper === 'COOP') return 'COOP';
  if (upper === 'SYS_ADMIN' || upper === 'ADMIN' || upper === 'SUPER_ADMIN') return 'SYS_ADMIN';
  return 'UNKNOWN';
}

export function getRolePrefix(role: NormalizedRole): string {
  switch (role) {
    case 'DAHO':
      return '/daho';
    case 'TAHO':
      return '/taho';
    case 'VO':
      return '/vo';
    case 'FW':
      return '/fw';
    case 'FARMER':
      return '/farmer';
    case 'COOP':
      return '/coop';
    case 'SYS_ADMIN':
      return '/admin';
    default:
      return '/access-denied';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => authService.getSession());
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [scope, setScope] = useState<UserScopeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDistrictId, setSelectedDistrictIdState] = useState<string | null>(() => {
    return sessionStorage.getItem('pashurakshak_selected_district_id');
  });

  const setSelectedDistrictId = useCallback((id: string | null) => {
    if (id) {
      sessionStorage.setItem('pashurakshak_selected_district_id', id);
    } else {
      sessionStorage.removeItem('pashurakshak_selected_district_id');
    }
    setSelectedDistrictIdState(id);
  }, []);

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? '';

  const role: NormalizedRole = useMemo(() => {
    if (!session?.accessToken) return 'UNKNOWN';
    return normalizeRole(profile?.role || session?.user?.role);
  }, [profile?.role, session?.user?.role, session?.accessToken]);

  const assignedDistricts = useMemo(() => {
    return (profile as any)?.assigned_districts_details || (session?.user as any)?.assigned_districts_details || [];
  }, [profile, session]);

  const assignedTalukas = useMemo(() => {
    return (profile as any)?.assigned_talukas_details || (session?.user as any)?.assigned_talukas_details || [];
  }, [profile, session]);

  // If DAHO has only 1 district, automatically select it
  useEffect(() => {
    if (role === 'DAHO' && assignedDistricts.length === 1) {
      const singleId = assignedDistricts[0].id || assignedDistricts[0].district_id;
      if (singleId && selectedDistrictId !== singleId) {
        setSelectedDistrictId(singleId);
      }
    }
  }, [role, assignedDistricts, selectedDistrictId, setSelectedDistrictId]);

  const selectedDistrict = useMemo(() => {
    if (!selectedDistrictId) return null;
    return assignedDistricts.find((d: any) => (d.id || d.district_id) === selectedDistrictId) || null;
  }, [selectedDistrictId, assignedDistricts]);

  const permissions: string[] = useMemo(() => {
    const fromScope = scope?.permissions || [];
    const fromProfile = profile?.permissions || [];
    return Array.from(new Set([...fromScope, ...fromProfile]));
  }, [scope?.permissions, profile?.permissions]);

  const deviceInfo: DeviceInfo = useMemo(() => {
    return {
      deviceId: session?.deviceId || '',
      userId: session?.user?.id || '',
      offlineValidUntil: session?.offlineValidUntil || '',
      offlineGrant: session?.offlineGrant,
    };
  }, [session]);

  const rolePrefix = useMemo(() => getRolePrefix(role), [role]);

  const fetchProfileAndScope = useCallback(async (activeSession: AuthSession) => {
    try {
      let token = await authService.getValidAccessToken(apiBaseUrl);
      if (!token) {
        token = activeSession.accessToken;
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [resProfile, resScope] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/auth/me`, { headers }),
        fetch(`${apiBaseUrl}/api/v1/rbac/scope`, { headers }),
      ]);

      if (resProfile.status === 401 || resScope.status === 401) {
        // Attempt a refresh once
        try {
          const refreshedToken = await authService.refreshAccessToken(apiBaseUrl);
          const retryHeaders = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refreshedToken}`,
          };
          const [p2, s2] = await Promise.all([
            fetch(`${apiBaseUrl}/api/v1/auth/me`, { headers: retryHeaders }),
            fetch(`${apiBaseUrl}/api/v1/rbac/scope`, { headers: retryHeaders }),
          ]);
          if (p2.ok) {
            setProfile(await p2.json());
          } else {
            // Authentication permanently invalid; clear session immediately
            await authService.logout(apiBaseUrl);
            setSession(null);
            setProfile(null);
            setScope(null);
            return;
          }
          if (s2.ok) {
            setScope(await s2.json());
          } else {
            // Fail closed on scope failure
            setScope(null);
          }
        } catch {
          // Token refresh failed; clear session and fail closed
          await authService.logout(apiBaseUrl);
          setSession(null);
          setProfile(null);
          setScope(null);
          return;
        }
      } else if (resProfile.status === 403 || !resProfile.ok) {
        // Account is locked, inactive, or not found; fail closed
        await authService.logout(apiBaseUrl);
        setSession(null);
        setProfile(null);
        setScope(null);
        return;
      } else {
        setProfile(await resProfile.json());
        if (resScope.ok) {
          setScope(await resScope.json());
        } else {
          // Fail closed on scope failure: zero permissions granted
          setScope(null);
        }
      }
    } catch (err) {
      console.warn('Failed to load user profile or rbac scope:', err);
      // Network or unexpected failure: do not grant fallback permissions
      setScope(null);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const unsub = authService.subscribe((newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setScope(null);
        setIsLoading(false);
      } else {
        fetchProfileAndScope(newSession).finally(() => setIsLoading(false));
      }
    });

    return () => unsub();
  }, [fetchProfileAndScope]);

  const loginStaff = async (u: string, p: string) => {
    setIsLoading(true);
    try {
      const newSession = await authService.loginStaff(apiBaseUrl, u, p);
      await fetchProfileAndScope(newSession);
      return newSession;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyFarmerOtp = async (mobile: string, otpCode: string) => {
    setIsLoading(true);
    try {
      const newSession = await authService.verifyFarmerOtp(apiBaseUrl, mobile, otpCode);
      await fetchProfileAndScope(newSession);
      return newSession;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout(apiBaseUrl);
    setSession(null);
    setProfile(null);
    setScope(null);
  };

  const refreshProfile = async () => {
    if (session) {
      await fetchProfileAndScope(session);
    }
  };

  const hasPermission = (perm: string) => {
    return permissions.includes(perm);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        scope,
        role,
        permissions,
        isAuthenticated: !!session?.accessToken,
        isLoading,
        deviceInfo,
        apiBaseUrl,
        selectedDistrictId,
        setSelectedDistrictId,
        selectedDistrict,
        assignedDistricts,
        assignedTalukas,
        loginStaff,
        verifyFarmerOtp,
        logout,
        refreshProfile,
        hasPermission,
        rolePrefix,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const fallbackAuthContext: AuthContextType = {
  session: null,
  profile: null,
  scope: null,
  role: 'UNKNOWN',
  permissions: [],
  isAuthenticated: false,
  isLoading: false,
  deviceInfo: {
    deviceId: 'BROWSER-DEV',
    platform: 'Web',
    registered: false,
    appVersion: '1.0.0',
    deviceSecret: '',
  },
  apiBaseUrl: (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  selectedDistrictId: null,
  setSelectedDistrictId: () => {},
  selectedDistrict: null,
  assignedDistricts: [],
  assignedTalukas: [],
  loginStaff: async (u: string, p: string) => authService.loginStaff((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000', u, p),
  verifyFarmerOtp: async (m: string, c: string) => authService.verifyFarmerOtp((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000', m, c),
  logout: async () => {},
  refreshProfile: async () => {},
  hasPermission: () => false,
  rolePrefix: '/login',
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return fallbackAuthContext;
  }
  return ctx;
};

