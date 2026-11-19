/**
 * PashuRakshak Botad — Free Map & Geolocation Utilities.
 * (Google Maps Platform API integration has been removed in favor of 100% Free OpenStreetMap & MapLibre GL).
 */

export interface GeolocationResult {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface VillageLocationDetails {
  lat: number;
  lng: number;
  placeId?: string;
  formattedAddress?: string;
}

export const googleMapsService = {
  getApiKey(): string {
    return '';
  },

  isApiKeyConfigured(): boolean {
    return false;
  },

  async loadGoogleMaps(): Promise<any> {
    return null;
  },

  async searchVillagePlaces(query: string, _talukaName?: string): Promise<PlaceSuggestion[]> {
    if (!query.trim()) return [];
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Botad Gujarat')}&countrycodes=in&limit=5`,
        { headers: { 'Accept-Language': 'gu,en' } }
      );
      if (res.ok) {
        const data = await res.json();
        return (data || []).map((item: any) => ({
          placeId: String(item.place_id),
          description: item.display_name,
          mainText: item.display_name.split(',')[0],
          secondaryText: item.display_name.split(',').slice(1).join(',').trim(),
        }));
      }
    } catch {
      // fallback
    }
    return [];
  },

  async getPlaceLocationDetails(placeId: string, description: string): Promise<VillageLocationDetails | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/lookup?format=json&osm_ids=${encodeURIComponent(placeId)}`,
        { headers: { 'Accept-Language': 'gu,en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: Number(data[0].lat),
            lng: Number(data[0].lon),
            placeId,
            formattedAddress: data[0].display_name || description,
          };
        }
      }
    } catch {
      // fallback
    }
    return null;
  },

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'gu,en' } }
      );
      if (res.ok) {
        const data = await res.json();
        return data.display_name || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
      }
    } catch {
      // fallback
    }
    return `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  },

  async getCurrentLocation(): Promise<GeolocationResult> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => reject(new Error(err.message)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  getDirectionsUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  },
};
