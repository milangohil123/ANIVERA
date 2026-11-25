/**
 * PashuRakshak Botad — Client Authentication & Token Management Service.
 *
 * Implements:
 * - Staff credential authentication (username/password).
 * - Farmer OTP request & verification.
 * - Rotating refresh token management via /api/v1/auth/refresh.
 * - Automatic pre-expiry token refresh (60s buffer).
 * - Graceful 401 handling preserving all local Dexie records.
 * - Invariant: Logging out or session expiry NEVER deletes offline queue.
 */

import { generateUUID } from '../utils/uuid';
import { apiCache } from '../utils/apiCache';

export interface UserBasic {
  id: string;
  fullName: string;
  username?: string;
  mobileE164?: string;
  role: string;
  designation?: string;
  organisation?: string;
  mustChangePassword: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number; // epoch ms
  user: UserBasic;
  offlineValidUntil: string;
  deviceId: string;
  offlineGrant?: string;
}

const STORAGE_KEY = 'pashurakshak_auth_session';

type AuthStateListener = (session: AuthSession | null) => void;

class AuthService {
  private currentSession: AuthSession | null = null;
  private refreshPromise: Promise<string> | null = null;
  private listeners: Set<AuthStateListener> = new Set();

  constructor() {
    this.loadPersistedSession();
  }

  private loadPersistedSession(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.currentSession = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse persisted auth session:', e);
      this.currentSession = null;
    }
  }

  private persistSession(session: AuthSession | null): void {
    if (typeof window === 'undefined') return;
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      apiCache.clear();
    }
    this.currentSession = session;
    this.notifyListeners();
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentSession);
      } catch (e) {
        console.error('Error notifying auth listener:', e);
      }
    });
  }

  getSession(): AuthSession | null {
    return this.currentSession;
  }

  isAuthenticated(): boolean {
    return !!this.currentSession?.accessToken;
  }

  /**
   * Login staff member with username and password.
   */
  async loginStaff(
    apiBaseUrl: string,
    username: string,
    password: string,
    deviceId?: string,
    deviceLabel?: string
  ): Promise<AuthSession> {
    const boundDeviceId = deviceId || this.currentSession?.deviceId || generateUUID();

    const res = await fetch(`${apiBaseUrl}/api/v1/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim(),
        password,
        device_id: boundDeviceId,
        device_label: deviceLabel || navigator.userAgent.substring(0, 50),
      }),
    });

    if (!res.ok) {
      let errorDetail = '';
      try {
        const err = await res.json();
        errorDetail = err.detail || '';
      } catch {
        if (res.status === 500 || res.status === 502 || res.status === 504) {
          errorDetail = `બેકએન્ડ સર્વર સાથે જોડાણ થઈ શક્યું નથી (HTTP ${res.status}). કૃપા કરીને ખાતરી કરો કે બેકએન્ડ સર્વર http://127.0.0.1:8000 પર ચાલુ છે.`;
        }
      }
      throw new Error(errorDetail || `Login failed: HTTP ${res.status}`);
    }

    const data = await res.json();
    const tokenExpiresAt = Date.now() + (data.expires_in || 1800) * 1000;

    const session: AuthSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt,
      user: {
        id: data.user.id,
        fullName: data.user.full_name,
        username: data.user.username,
        mobileE164: data.user.mobile_e164,
        role: data.user.role,
        designation: data.user.designation,
        organisation: data.user.organisation,
        mustChangePassword: data.user.must_change_password,
      },
      offlineValidUntil: data.offline_valid_until,
      deviceId: boundDeviceId,
    };

    // Obtain initial 7-day signed offline grant token
    try {
      const grantRes = await fetch(`${apiBaseUrl}/api/v1/sync/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          deviceId: boundDeviceId,
          label: navigator.userAgent.substring(0, 50),
        }),
      });
      if (grantRes.ok) {
        const grantData = await grantRes.json();
        session.offlineGrant = grantData.offlineGrant;
      }
    } catch (e) {
      console.warn('Initial offline grant retrieval skipped:', e);
    }

    this.persistSession(session);
    return session;
  }

  /**
   * Request OTP for farmer mobile number.
   */
  async requestFarmerOtp(apiBaseUrl: string, mobileE164: string): Promise<string> {
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/farmer/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_e164: mobileE164.trim() }),
    });

    if (!res.ok) {
      let errorDetail = '';
      try {
        const err = await res.json();
        errorDetail = err.detail || '';
      } catch {
        if (res.status === 500 || res.status === 502 || res.status === 504) {
          errorDetail = `બેકએન્ડ સર્વર સાથે જોડાણ થઈ શક્યું નથી (HTTP ${res.status}). કૃપા કરીને ખાતરી કરો કે બેકએન્ડ સર્વર http://127.0.0.1:8000 પર ચાલુ છે.`;
        }
      }
      throw new Error(errorDetail || `Failed to request OTP: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.debug_otp) {
      console.log(`%c[PashuRakshak Farmer OTP] %c${data.debug_otp}`, 'color: #135D43; font-weight: bold;', 'color: #059669; font-weight: bold; font-size: 14px;');
      if (!data.message.includes(data.debug_otp)) {
        return `${data.message} [ટેસ્ટિંગ OTP: ${data.debug_otp}]`;
      }
    }
    return data.message;
  }

  /**
   * Verify farmer OTP and establish session.
   */
  async verifyFarmerOtp(
    apiBaseUrl: string,
    mobileE164: string,
    otpCode: string,
    deviceId?: string
  ): Promise<AuthSession> {
    const boundDeviceId = deviceId || this.currentSession?.deviceId || generateUUID();

    const res = await fetch(`${apiBaseUrl}/api/v1/auth/farmer/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile_e164: mobileE164.trim(),
        otp_code: otpCode.trim(),
        device_id: boundDeviceId,
      }),
    });

    if (!res.ok) {
      let errorDetail = '';
      try {
        const err = await res.json();
        errorDetail = err.detail || '';
      } catch {
        if (res.status === 500 || res.status === 502 || res.status === 504) {
          errorDetail = `બેકએન્ડ સર્વર સાથે જોડાણ થઈ શક્યું નથી (HTTP ${res.status}). કૃપા કરીને ખાતરી કરો કે બેકએન્ડ સર્વર http://127.0.0.1:8000 પર ચાલુ છે.`;
        }
      }
      throw new Error(errorDetail || `OTP verification failed: HTTP ${res.status}`);
    }

    const data = await res.json();
    const tokenExpiresAt = Date.now() + (data.expires_in || 1800) * 1000;

    const session: AuthSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt,
      user: {
        id: data.user.id,
        fullName: data.user.full_name,
        username: data.user.username,
        mobileE164: data.user.mobile_e164,
        role: data.user.role,
        designation: data.user.designation,
        organisation: data.user.organisation,
        mustChangePassword: data.user.must_change_password,
      },
      offlineValidUntil: data.offline_valid_until,
      deviceId: boundDeviceId,
    };

    this.persistSession(session);
    return session;
  }

  /**
   * Acquire a valid, non-expired access token. Automatically refreshes if within 60s of expiry.
   */
  async getValidAccessToken(apiBaseUrl: string): Promise<string | null> {
    if (!this.currentSession) {
      return null;
    }

    const now = Date.now();
    // If token has more than 60 seconds left, use directly
    if (this.currentSession.tokenExpiresAt - now > 60000) {
      return this.currentSession.accessToken;
    }

    // Otherwise refresh token with backend
    try {
      return await this.refreshAccessToken(apiBaseUrl);
    } catch (err) {
      console.warn('Automatic token refresh failed:', err);
      return null;
    }
  }

  /**
   * Perform rotating refresh token exchange.
   * Concurrency-safe: shares active in-flight refresh promise across simultaneous callers.
   */
  async refreshAccessToken(apiBaseUrl: string): Promise<string> {
    if (!this.currentSession?.refreshToken) {
      throw new Error('No active refresh token available');
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.currentSession!.refreshToken }),
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403 || res.status === 400 || res.status === 404) {
            // Refresh token has been revoked or expired. Clear session tokens.
            // Queue invariant: DO NOT CLEAR Dexie records.
            this.persistSession(null);
            throw new Error('Session has expired. Please log in again.');
          }
          throw new Error(`Token refresh failed: HTTP ${res.status}`);
        }

        const data = await res.json();
        const updatedSession: AuthSession = {
          ...this.currentSession!,
          accessToken: data.access_token,
          refreshToken: data.refresh_token, // Rotated token!
          tokenExpiresAt: Date.now() + (data.expires_in || 1800) * 1000,
          offlineValidUntil: data.offline_valid_until || this.currentSession!.offlineValidUntil,
        };

        this.persistSession(updatedSession);
        return updatedSession.accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Explicit user logout.
   * Clears in-memory and persisted tokens while strictly preserving all offline Dexie data.
   */
  async logout(apiBaseUrl?: string): Promise<void> {
    const session = this.currentSession;
    if (session && apiBaseUrl) {
      try {
        await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        });
      } catch (e) {
        console.warn('Logout notification to backend failed:', e);
      }
    }

    // Clear session but leave Dexie data untouched
    this.persistSession(null);
  }
}

export const authService = new AuthService();
