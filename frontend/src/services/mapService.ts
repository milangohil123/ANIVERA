/**
 * PashuRakshak Botad — Geospatial and Maps API Client.
 */

export interface VillageMapPoint {
  villageId: string;
  code: string;
  nameGu: string;
  nameEn: string;
  talukaId: string;
  talukaNameGu?: string;
  districtNameGu?: string;
  latitude?: number;
  longitude?: number;
  coordStatus: 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE';
  isPilot: boolean;
  assignedVoName?: string | null;
  googlePlaceId?: string | null;
  formattedAddress?: string | null;
  boundaryGeojson?: any;
}

export interface VillageSurveillanceMapItem {
  villageId: string;
  suspectedCount: number;
  confirmedCount: number;
  notConfirmedCount: number;
  insufficientCount: number;
  latestReportDate?: string;
  statusLabelGu: string;
}

export interface VillageVaccinationMapItem {
  villageId: string;
  totalVaccinatedCount: number;
  totalRegisteredAnimals: number;
  coveragePercentage?: number;
  pendingVaccinations?: number;
  thresholdConfigured: boolean;
  statusLabelGu: string;
}

export interface MapLayersResponse {
  mappedVillages: VillageMapPoint[];
  unmappedVillages: VillageMapPoint[];
  surveillanceLayer: Record<string, VillageSurveillanceMapItem>;
  vaccinationLayer: Record<string, VillageVaccinationMapItem>;
}

export const mapService = {
  async getLayers(apiBaseUrl: string, token: string): Promise<MapLayersResponse> {
    const res = await fetch(`${apiBaseUrl}/api/v1/maps/layers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to load map layers: HTTP ${res.status}`);
    }
    return res.json();
  },
};

