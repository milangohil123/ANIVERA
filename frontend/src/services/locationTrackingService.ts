/**
 * PashuRakshak Botad — Field Worker Live Location Tracking & Duty Service.
 *
 * Implements:
 * - HTML5 Browser Geolocation API (getCurrentPosition & watchPosition).
 * - Zero paid third-party APIs.
 * - Battery-friendly periodic interval with visibility lifecycle triggers.
 * - Robust token acquisition with automatic refresh via authService.
 * - High-accuracy with standard-accuracy fallback (preventing laptop/indoor timeouts).
 * - Offline queueing via IndexedDB (Dexie) and opportunistic reconnection draining.
 * - Professional Gujarati error diagnostics for permission and signal states.
 */
import { offlineDb, type QueuedLocation } from '../db/offlineDb';
import { authService } from './authService';

export interface DutyState {
  isOnDuty: boolean;
  sessionId?: string | null;
  startTime?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastAccuracy?: number | null;
  lastUpdate?: string | null;
  freshness: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'INACTIVE';
  gpsPermissionStatus: 'PROMPT' | 'GRANTED' | 'DENIED' | 'UNSUPPORTED';
  isTracking: boolean;
  isOnline: boolean;
  queuedPointsCount: number;
  lastErrorMessage?: string | null;
  lastServerSyncedAt?: string | null;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes periodic interval

class LocationTrackingService {
  private timerId: number | null = null;
  private watchId: number | null = null;
  private activeSessionId: string | null = null;
  private currentUserId: string | null = null;
  private lastSentTime: number = 0;
  private listeners: Set<(state: DutyState) => void> = new Set();

  private currentState: DutyState = {
    isOnDuty: false,
    sessionId: null,
    startTime: null,
    lastLatitude: null,
    lastLongitude: null,
    lastAccuracy: null,
    lastUpdate: null,
    freshness: 'INACTIVE',
    gpsPermissionStatus: 'PROMPT',
    isTracking: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    queuedPointsCount: 0,
    lastErrorMessage: null,
    lastServerSyncedAt: null,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkOnline.bind(this));
      window.addEventListener('offline', this.handleNetworkOffline.bind(this));
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  public subscribe(listener: (state: DutyState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.currentState });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = { ...this.currentState };
    this.listeners.forEach((fn) => {
      try {
        fn(copy);
      } catch (e) {
        console.warn('Listener error in LocationTrackingService:', e);
      }
    });
  }

  public getState(): DutyState {
    return { ...this.currentState };
  }

  private async getAuthToken(apiBaseUrl: string): Promise<string> {
    try {
      const valid = await authService.getValidAccessToken(apiBaseUrl);
      if (valid) return valid;
    } catch {
      // Fallback to active session
    }
    const session = authService.getSession();
    return session?.accessToken || '';
  }

  /**
   * Internal wrapper attempting high-accuracy first, then falling back to standard accuracy.
   */
  private requestPosition(highAccuracy: boolean, timeoutMs: number): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout: timeoutMs,
        maximumAge: 30000,
      });
    });
  }

  /**
   * Acquire device coordinates with progressive fallback (High Accuracy -> Standard Accuracy)
   */
  public async getDeviceCoordinates(): Promise<LocationCoordinates> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.currentState.gpsPermissionStatus = 'UNSUPPORTED';
      this.notify();
      throw new Error('તમારા બ્રાઉઝર અથવા ઉપકરણમાં જીઓ-લોકેશન સપોર્ટેડ નથી.');
    }

    try {
      // 1. Try High Accuracy (GPS hardware) with 8s timeout
      const pos = await this.requestPosition(true, 8000);
      this.currentState.gpsPermissionStatus = 'GRANTED';
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (err: any) {
      if (err.code === err.PERMISSION_DENIED) {
        this.currentState.gpsPermissionStatus = 'DENIED';
        const msg = 'બ્રાઉઝરમાં GPS લોકેશન પરવાનગી નકારવામાં આવી છે. કૃપા કરીને બ્રાઉઝર સેટિંગ્સમાં લોકેશન મંજૂર કરો.';
        this.currentState.lastErrorMessage = msg;
        this.notify();
        throw new Error(msg);
      }

      // 2. Try Standard Accuracy fallback (WiFi / Network Geolocation) with 15s timeout
      try {
        const fallbackPos = await this.requestPosition(false, 15000);
        this.currentState.gpsPermissionStatus = 'GRANTED';
        return {
          latitude: fallbackPos.coords.latitude,
          longitude: fallbackPos.coords.longitude,
          accuracy: fallbackPos.coords.accuracy,
        };
      } catch (fallbackErr: any) {
        let guError = 'GPS લોકેશન મેળવવામાં અસમર્થ.';
        if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
          this.currentState.gpsPermissionStatus = 'DENIED';
          guError = 'બ્રાઉઝરમાં GPS લોકેશન પરવાનગી નકારવામાં આવી છે.';
        } else if (fallbackErr.code === fallbackErr.POSITION_UNAVAILABLE) {
          guError = 'ઉપકરણનું GPS સિગ્નલ અથવા લોકેશન સેવા ઉપલબ્ધ નથી.';
        } else if (fallbackErr.code === fallbackErr.TIMEOUT) {
          guError = 'GPS લોકેશન મેળવવામાં સમય સમાપ્ત થઈ ગયો. કૃપા કરીને ફરી પ્રયાસ કરો.';
        }
        this.currentState.lastErrorMessage = guError;
        this.notify();
        throw new Error(guError);
      }
    }
  }

  /**
   * Start Field Worker duty with initial GPS coordinates
   */
  public async startDuty(apiBaseUrl: string): Promise<DutyState> {
    const session = authService.getSession();
    const token = await this.getAuthToken(apiBaseUrl);
    this.currentUserId = session?.user?.id || null;

    // 1. Obtain GPS coordinates
    const coords = await this.getDeviceCoordinates();
    const nowStr = new Date().toISOString();

    // 2. Post to backend
    const res = await fetch(`${apiBaseUrl}/api/v1/duty/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        device_status: 'ONLINE',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'ડ્યૂટી શરૂ કરવામાં નિષ્ફળ.' }));
      throw new Error(err.detail || `સર્વર ભૂલ: HTTP ${res.status}`);
    }

    const data = await res.json();
    this.activeSessionId = data.session_id;

    // 3. Update state
    this.currentState = {
      ...this.currentState,
      isOnDuty: true,
      sessionId: data.session_id,
      startTime: data.start_time,
      lastLatitude: coords.latitude,
      lastLongitude: coords.longitude,
      lastAccuracy: coords.accuracy,
      lastUpdate: nowStr,
      freshness: 'FRESH',
      isTracking: true,
      lastErrorMessage: null,
      lastServerSyncedAt: nowStr,
    };
    this.lastSentTime = Date.now();
    this.notify();

    // 4. Start periodic tracking & background listeners
    this.startPeriodicUpdates(apiBaseUrl);

    return { ...this.currentState };
  }

  /**
   * End Field Worker duty and halt location tracking
   */
  public async endDuty(apiBaseUrl: string, reason?: string): Promise<DutyState> {
    const token = await this.getAuthToken(apiBaseUrl);

    try {
      await fetch(`${apiBaseUrl}/api/v1/duty/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason || 'શિફ્ટ પૂર્ણ' }),
      });
    } catch (e) {
      console.warn('End duty network call failed (local shutdown will proceed):', e);
    }

    // Stop tracking timers & watchers
    this.stopTracking();

    this.currentState = {
      ...this.currentState,
      isOnDuty: false,
      sessionId: null,
      freshness: 'INACTIVE',
      isTracking: false,
      lastErrorMessage: null,
    };
    this.activeSessionId = null;
    this.notify();

    return { ...this.currentState };
  }

  /**
   * Broadcast current location explicitly to the backend (or queue offline).
   * Automatically initializes an active duty session if not yet started.
   */
  public async broadcastLocation(apiBaseUrl: string, explicitCoords?: LocationCoordinates): Promise<DutyState> {
    const coords = explicitCoords || (await this.getDeviceCoordinates());
    const token = await this.getAuthToken(apiBaseUrl);
    const nowStr = new Date().toISOString();

    if (!navigator.onLine) {
      await this.queueOfflineLocation(coords, nowStr);
      this.currentState.lastLatitude = coords.latitude;
      this.currentState.lastLongitude = coords.longitude;
      this.currentState.lastAccuracy = coords.accuracy;
      this.currentState.lastUpdate = nowStr;
      this.notify();
      return { ...this.currentState };
    }

    // If not currently on duty, start duty session directly
    if (!this.currentState.isOnDuty) {
      return await this.startDuty(apiBaseUrl);
    }

    const res = await fetch(`${apiBaseUrl}/api/v1/duty/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session_id: this.activeSessionId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        source: 'GPS',
        recorded_at: nowStr,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.session_id) {
        this.activeSessionId = data.session_id;
      }
      this.lastSentTime = Date.now();
      this.currentState = {
        ...this.currentState,
        lastLatitude: coords.latitude,
        lastLongitude: coords.longitude,
        lastAccuracy: coords.accuracy,
        lastUpdate: nowStr,
        freshness: 'FRESH',
        lastErrorMessage: null,
        lastServerSyncedAt: nowStr,
      };
      this.notify();

      // Drain offline queue if any points are pending
      await this.drainOfflineQueue(apiBaseUrl);
    } else {
      await this.queueOfflineLocation(coords, nowStr);
    }

    return { ...this.currentState };
  }

  /**
   * Periodic updates starter (10 min interval + visibility change)
   */
  private startPeriodicUpdates(apiBaseUrl: string) {
    this.stopTracking();

    this.timerId = window.setInterval(async () => {
      await this.captureAndSendLocation(apiBaseUrl);
    }, UPDATE_INTERVAL_MS);

    // Passive watchPosition for live client update and distance-based threshold trigger
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          const prevLat = this.currentState.lastLatitude;
          const prevLng = this.currentState.lastLongitude;

          this.currentState.lastLatitude = lat;
          this.currentState.lastLongitude = lng;
          this.currentState.lastAccuracy = acc;
          this.notify();

          // If moved more than ~200 meters and at least 3 minutes passed since last send, transmit immediately
          if (prevLat !== null && prevLat !== undefined && prevLng !== null && prevLng !== undefined) {
            const timeSinceLast = Date.now() - this.lastSentTime;
            const approxDistKm = Math.hypot((lat - prevLat) * 111, (lng - prevLng) * 111);
            if (approxDistKm > 0.2 && timeSinceLast > 3 * 60 * 1000) {
              await this.captureAndSendLocation(apiBaseUrl);
            }
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 60000 }
      );
    }
  }

  private stopTracking() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Capture coordinates and send to backend (or queue in IndexedDB if offline)
   */
  public async captureAndSendLocation(apiBaseUrl: string): Promise<void> {
    if (!this.currentState.isOnDuty) return;

    try {
      const coords = await this.getDeviceCoordinates();
      await this.broadcastLocation(apiBaseUrl, coords);
    } catch (err: any) {
      console.warn('Location capture/send error:', err);
    }
  }

  private async queueOfflineLocation(coords: LocationCoordinates, recordedAt: string) {
    try {
      const point: QueuedLocation = {
        id: crypto.randomUUID(),
        userId: this.currentUserId || 'unknown',
        sessionId: this.activeSessionId || undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        source: 'GPS',
        recordedAt,
        synced: false,
      };
      await offlineDb.queued_locations.add(point);
      const count = await offlineDb.queued_locations.where('synced').equals(0 as any).count();
      this.currentState.queuedPointsCount = count;
      this.notify();
    } catch (e) {
      console.warn('Failed to queue offline location in Dexie:', e);
    }
  }

  private async drainOfflineQueue(apiBaseUrl: string) {
    if (!navigator.onLine) return;
    try {
      const pending = await offlineDb.queued_locations.toArray();
      if (!pending || pending.length === 0) return;

      const token = await this.getAuthToken(apiBaseUrl);

      for (const loc of pending) {
        try {
          await fetch(`${apiBaseUrl}/api/v1/duty/location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              session_id: loc.sessionId || this.activeSessionId,
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              source: loc.source || 'GPS',
              recorded_at: loc.recordedAt,
            }),
          });
          await offlineDb.queued_locations.delete(loc.id);
        } catch {
          break; // Stop draining if network fails
        }
      }

      const count = await offlineDb.queued_locations.count();
      this.currentState.queuedPointsCount = count;
      this.notify();
    } catch (e) {
      console.warn('Drain offline queue failed:', e);
    }
  }

  private handleNetworkOnline() {
    this.currentState.isOnline = true;
    this.notify();
    const session = authService.getSession();
    if (session) {
      this.drainOfflineQueue('');
    }
  }

  private handleNetworkOffline() {
    this.currentState.isOnline = false;
    this.notify();
  }

  private async handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.currentState.isOnDuty) {
      const elapsed = Date.now() - this.lastSentTime;
      if (elapsed >= UPDATE_INTERVAL_MS) {
        // Automatically sync on resume after tab was inactive for 10+ mins
        await this.captureAndSendLocation('');
      }
    }
  }

  /**
   * Sync initial status on dashboard mount
   */
  public async syncServerDutyStatus(apiBaseUrl: string): Promise<DutyState> {
    const token = await this.getAuthToken(apiBaseUrl);
    if (!token) return { ...this.currentState };

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/duty/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const isOnDuty = Boolean(data.is_on_duty);
        this.currentState = {
          ...this.currentState,
          isOnDuty,
          sessionId: data.session_id,
          startTime: data.start_time,
          lastLatitude: data.last_known_latitude,
          lastLongitude: data.last_known_longitude,
          lastAccuracy: data.location_accuracy,
          lastUpdate: data.last_location_update,
          freshness: data.freshness || 'INACTIVE',
          isTracking: isOnDuty,
          lastServerSyncedAt: data.last_location_update,
        };
        this.activeSessionId = data.session_id;
        if (isOnDuty && !this.timerId) {
          this.startPeriodicUpdates(apiBaseUrl);
        }
        this.notify();
      }
    } catch (e) {
      console.warn('Sync server duty status failed:', e);
    }
    return { ...this.currentState };
  }
}

export const locationTrackingService = new LocationTrackingService();
