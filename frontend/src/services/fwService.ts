/**
 * PashuRakshak Botad — Field Worker API and Offline-first Service.
 *
 * Implements:
 * - Assigned village scoping (strictly derived from backend /administration/villages)
 * - Farmer management: list, register (staff-assisted with consent), verify
 * - Animal management: list, register (primary registrar with 12-digit tag), verify, transfer request
 * - QR assignment & re-tagging (revoking old token)
 * - QR and tag lookup
 * - Vaccinator authorization checking and event recording
 * - Offline queueing via syncController for supported event types
 */
import { authService } from './authService';
import { syncController, type DeviceInfo } from './syncController';

export interface FWVillageItem {
  id: string;
  code: string;
  name_gu: string;
  name_en: string;
  census_code?: string | null;
  active: boolean;
}

export interface FWFarmerItem {
  id: string;
  farmer_code?: string | null;
  full_name: string;
  name_norm: string;
  mobile_e164?: string | null;
  mobile_status: string;
  mobile_shared: boolean;
  has_smartphone: string;
  village_id: string;
  address_text?: string | null;
  registration_status: string;
  registration_path: string;
  active: boolean;
  created_at: string;
}

export interface FWFarmerDetail extends FWFarmerItem {
  registered_by?: string | null;
  data_consent_at?: string | null;
  outreach_consent: string;
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface FWAnimalItem {
  id: string;
  animal_code?: string | null;
  species_code: string;
  breed_id?: string | null;
  sex: string;
  age_months_estimate?: number | null;
  farmer_id: string;
  village_id: string;
  registration_status: string;
  status: string;
  created_at: string;
}

export interface FWAnimalDetail extends FWAnimalItem {
  bharat_pashudhan_tag?: string | null;
  active_qr_token?: string | null;
  active_tag?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  owner_name?: string | null;
  farmer_name?: string | null;
  farmer_code?: string | null;
  village_name?: string | null;
}

export interface FWAnimalRegistrationPayload {
  [key: string]: unknown;
  species_code: string;
  breed_id?: string | null;
  sex: 'F' | 'M' | 'UNKNOWN';
  farmer_id: string;
  village_id: string;
  age_months_estimate?: number;
  birth_date?: string;
  tag_identification_method?: 'EXISTING_QR' | 'EXISTING_BARCODE' | 'INTERNAL_QR' | 'INTERNAL_BARCODE';
  tag_value?: string;
  tag_payload?: string;
  tag_format?: string;
  previous_vaccinations?: Array<{
    programme_code: string;
    vaccination_date: string;
    source: 'CARD_VERIFIED' | 'FARMER_REPORTED' | 'TAG_EXTRACTED';
    batch_number?: string;
    remarks?: string;
  }>;
  bharat_pashudhan_tag?: string;
  qr_token?: string;
}

export interface FWTagCheckResult {
  is_registered: boolean;
  tag_value: string;
  message: string;
  animal?: FWAnimalDetail | null;
}

export interface FWVaccinationItem {
  event_id: string;
  animal_id: string;
  village_id: string;
  event_date: string;
  programme_code: string;
  batch_number?: string | null;
  performed_by: string;
}

export interface FWTreatmentItem {
  event_id: string;
  animal_id: string;
  village_id: string;
  event_date: string;
  treatment_text: string;
  diagnosis_text?: string | null;
  performed_by: string;
}

export interface FWAnimalVaccinationHistoryItem {
  event_id: string;
  programme_code: string;
  programme_name_gu?: string | null;
  event_date: string;
  batch_number?: string | null;
  dose_note?: string | null;
  administered_by_name?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  camp_id?: string | null;
  camp_code?: string | null;
  authorization_check: string;
  review_status: string;
  remarks?: string | null;
}

export interface FWAnimalDiseaseHistoryItem {
  report_id: string;
  report_no?: string | null;
  disease_code: string;
  disease_name_gu?: string | null;
  report_date: string;
  symptoms: string[];
  observation_text?: string | null;
  status: string;
  reported_by_name?: string | null;
  confirmed_at?: string | null;
  confirmation_basis?: string | null;
  attachment_ids: string[];
}

export interface FWAnimalHistoryResponse {
  animal: FWAnimalDetail;
  vaccinations: FWAnimalVaccinationHistoryItem[];
  disease_reports: FWAnimalDiseaseHistoryItem[];
  total_vaccinations: number;
  total_disease_reports: number;
}

export interface FWPendingAnimalItem {
  animal_id: string;
  animal_code: string;
  species_code: string;
  sex: string;
  age_months_estimate?: number | null;
  tag_number?: string | null;
  qr_token?: string | null;
  programme_code: string;
  is_vaccinated: boolean;
  vaccinated_date?: string | null;
  batch_number?: string | null;
}

export interface FWPendingFarmerGroup {
  farmer_id: string;
  farmer_name: string;
  farmer_code?: string | null;
  mobile_e164?: string | null;
  eligible_count: number;
  vaccinated_count: number;
  remaining_count: number;
  animals: FWPendingAnimalItem[];
}

export interface FWCampaignPendingResponse {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  campaign_status: string;
  village_id: string;
  village_name_gu: string;
  village_name_en: string;
  total_eligible: number;
  total_vaccinated: number;
  total_remaining: number;
  completion_percentage: number;
  farmers: FWPendingFarmerGroup[];
}

export interface FWCampaignOption {
  id: string;
  code: string;
  name: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface FWCampaignAssignmentItem {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  disease_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  campaign_status: string;
  village_id: string;
  village_code: string;
  village_name_gu: string;
  village_name_en: string;
  taluka_name?: string | null;
  acceptance_status: string;
  rejection_reason?: string | null;
  assigned_at?: string | null;
  eligible_animals_count: number;
  vaccinated_animals_count: number;
  pending_animals_count: number;
  species_names_gu: string[];
}

export interface FWCampOption {
  id: string;
  camp_code: string;
  village_id: string;
  campaign_id: string;
  planned_start: string;
  planned_end: string;
  status: string;
  location_text?: string | null;
}


function formatApiError(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item: any) => {
        const field = item.loc ? item.loc.slice(1).join('.') : '';
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join('; ');
  }
  if (data.message && typeof data.message === 'string') return data.message;
  return fallback;
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
    Authorization: `Bearer ${token}`,
    ...((options.headers as Record<string, string>) || {}),
  };

  let res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    try {
      const refreshed = await authService.refreshAccessToken(apiBaseUrl);
      headers.Authorization = `Bearer ${refreshed}`;
      res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    } catch (e) {
      console.warn('Session refresh failed during FW request:', e);
    }
  }

  return res;
}

export const fwService = {
  // 1. Assigned Villages (Server Scoped)
  async listAssignedVillages(apiBaseUrl: string): Promise<FWVillageItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/administration/villages?limit=200`);
    if (!res.ok) {
      throw new Error(`ફાળવેલા ગામની યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  // 2. Farmers (Scoped to Village)
  async listFarmers(
    apiBaseUrl: string,
    villageId: string,
    search?: string
  ): Promise<FWFarmerItem[]> {
    const query = new URLSearchParams({ village_id: villageId, limit: '100' });
    if (search && search.trim()) query.set('search', search.trim());
    const res = await authFetch(apiBaseUrl, `/api/v1/farmers?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`ખેડૂત યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getFarmer(apiBaseUrl: string, farmerId: string): Promise<FWFarmerDetail> {
    const res = await authFetch(apiBaseUrl, `/api/v1/farmers/${farmerId}`);
    if (!res.ok) {
      throw new Error(`ખેડૂત વિગત મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async registerFarmer(
    apiBaseUrl: string,
    payload: {
      full_name: string;
      village_id: string;
      mobile_e164?: string;
      mobile_shared?: boolean;
      has_smartphone?: 'UNKNOWN' | 'YES' | 'NO';
      address_text?: string;
      data_consent: boolean;
      outreach_consent?: 'UNKNOWN' | 'GRANTED' | 'WITHDRAWN';
    },
    deviceInfo?: DeviceInfo
  ): Promise<{ farmer?: FWFarmerItem; queuedEventId?: string; isOffline?: boolean }> {
    // If online, try direct creation
    if (navigator.onLine) {
      try {
        const res = await authFetch(apiBaseUrl, `/api/v1/farmers`, {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            registration_path: 'STAFF_ASSISTED',
          }),
        });
        if (res.ok) {
          const created = await res.json();
          return { farmer: created, isOffline: false };
        }
        if (res.status !== 500 && res.status !== 503) {
          const err = await res.json().catch(() => null);
          throw new Error(formatApiError(err, `ખેડૂત નોંધણી નિષ્ફળ: HTTP ${res.status}`));
        }
      } catch (e) {
        if (!(e instanceof TypeError)) {
          // If not network error, rethrow
          throw e;
        }
      }
    }

    // Offline Queue fallback
    if (!deviceInfo) {
      throw new Error('ઓફલાઇન નોંધણી માટે ઉપકરણ માહિતી જરૂરી છે.');
    }

    const eventId = await syncController.enqueueEvent(
      'FARMER_REGISTRATION',
      {
        ...payload,
        registration_path: 'STAFF_ASSISTED',
      },
      deviceInfo
    );

    return { queuedEventId: eventId, isOffline: true };
  },

  async verifyFarmer(
    apiBaseUrl: string,
    farmerId: string,
    notes?: string
  ): Promise<{ status: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/farmers/${farmerId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verification_notes: notes || 'ક્ષેત્રીય કાર્યકર દ્વારા રૂબરૂ ચકાસણી' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `ખેડૂત ચકાસણી નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  // 3. Animals (Scoped to Village / Farmer)
  async listAnimals(
    apiBaseUrl: string,
    villageId: string,
    farmerId?: string,
    speciesCode?: string
  ): Promise<FWAnimalItem[]> {
    const query = new URLSearchParams({ village_id: villageId, limit: '100' });
    if (farmerId) query.set('farmer_id', farmerId);
    if (speciesCode) query.set('species_code', speciesCode);
    const res = await authFetch(apiBaseUrl, `/api/v1/animals?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`પશુ યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getAnimal(apiBaseUrl: string, animalId: string): Promise<FWAnimalDetail> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}`);
    if (!res.ok) {
      throw new Error(`પશુ વિગત મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getAnimalHistory(apiBaseUrl: string, animalId: string): Promise<FWAnimalHistoryResponse> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}/history`);
    if (!res.ok) {
      throw new Error(`પશુ ઇતિહાસ મેળવવામાં નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async checkTag(apiBaseUrl: string, tagValue: string): Promise<FWTagCheckResult> {
    const clean = encodeURIComponent(tagValue.trim());
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/tag-check?tag_value=${clean}`);
    if (!res.ok) {
      throw new Error(`ટેગ ચકાસણી નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async registerAnimal(
    apiBaseUrl: string,
    payload: FWAnimalRegistrationPayload,
    deviceInfo?: DeviceInfo
  ): Promise<{ animal?: FWAnimalDetail; queuedEventId?: string; isOffline?: boolean }> {
    if (navigator.onLine) {
      try {
        const res = await authFetch(apiBaseUrl, `/api/v1/animals`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          return { animal: created, isOffline: false };
        }
        // If server returns any HTTP error (4xx or 5xx), parse and throw the exact error!
        const err = await res.json().catch(() => null);
        throw new Error(formatApiError(err, `પશુ નોંધણી નિષ્ફળ: HTTP ${res.status}`));
      } catch (e: any) {
        // Only if it is an actual browser network drop (Failed to fetch) allow offline queue
        const isNetworkFailure =
          e instanceof TypeError ||
          e?.message?.includes('Failed to fetch') ||
          e?.message?.includes('NetworkError');
        if (!isNetworkFailure) {
          throw e;
        }
      }
    }

    if (!deviceInfo) {
      throw new Error('ઇન્ટરનેટ જોડાણ નથી અને ઓફલાઇન નોંધણી માટે ઉપકરણ માહિતી મળેલ નથી.');
    }

    const eventId = await syncController.enqueueEvent(
      'ANIMAL_REGISTRATION',
      { ...payload },
      deviceInfo
    );

    return { queuedEventId: eventId, isOffline: true };
  },

  async verifyAnimal(
    apiBaseUrl: string,
    animalId: string,
    notes?: string
  ): Promise<{ status: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        method: 'FIELD_PHYSICAL',
        outcome: 'VERIFIED',
        owner_confirmed: true,
        tag_checked: true,
        notes: notes || 'ક્ષેત્રીય કાર્યકર દ્વારા રૂબરૂ ભૌતિક ચકાસણી',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `પશુ ચકાસણી નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  async assignQrToken(
    apiBaseUrl: string,
    animalId: string,
    token?: string
  ): Promise<{ token: string; status: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}/qr-token`, {
      method: 'POST',
      body: JSON.stringify({ token: token ? token.trim().toUpperCase() : undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `QR ટોકન ફાળવણી નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  async addExternalId(
    apiBaseUrl: string,
    animalId: string,
    idValue: string,
    idType: string = 'OTHER_EAR_TAG'
  ): Promise<{ id_value: string; status: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}/external-ids`, {
      method: 'POST',
      body: JSON.stringify({
        id_type: idType,
        id_value: idValue.trim(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `ટેગ નોંધણી નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  async requestOwnershipTransfer(
    apiBaseUrl: string,
    animalId: string,
    toFarmerId: string,
    reason: string
  ): Promise<{ id: string; status: string }> {
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/${animalId}/transfers`, {
      method: 'POST',
      body: JSON.stringify({
        to_farmer_id: toFarmerId,
        reason: reason.trim(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `માલિકી બદલી વિનંતી નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  // 4. QR and Tag Lookup
  async lookupByQr(apiBaseUrl: string, token: string): Promise<FWAnimalDetail> {
    const cleanToken = encodeURIComponent(token.trim().toUpperCase());
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/lookup/qr/${cleanToken}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('આ QR ટોકન સાથે જોડાયેલ કોઈ પશુ મળ્યું નથી.');
      }
      throw new Error(`QR શોધ નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async lookupByTag(apiBaseUrl: string, tagValue: string): Promise<FWAnimalDetail> {
    const cleanTag = encodeURIComponent(tagValue.trim());
    // Try universal lookup query parameter first for maximum compatibility
    let res = await authFetch(apiBaseUrl, `/api/v1/animals/lookup?identifier=${cleanTag}`);
    if (!res.ok && res.status === 404) {
      res = await authFetch(apiBaseUrl, `/api/v1/animals/lookup/tag/${cleanTag}`);
    }
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('આ ટેગ અથવા બારકોડ સાથે જોડાયેલ કોઈ પશુ મળ્યું નથી.');
      }
      throw new Error(`ટેગ શોધ નિષ્ફળ: HTTP ${res.status}`);
    }
    return res.json();
  },

  async universalLookup(apiBaseUrl: string, identifier: string): Promise<FWAnimalDetail> {
    const clean = encodeURIComponent(identifier.trim());
    // Try query param lookup first
    const res = await authFetch(apiBaseUrl, `/api/v1/animals/lookup?identifier=${clean}`);
    if (res.ok) {
      return res.json();
    }
    // Fallbacks
    try {
      return await this.lookupByTag(apiBaseUrl, identifier);
    } catch {
      return await this.lookupByQr(apiBaseUrl, identifier);
    }
  },

  // 5. Vaccinations, Campaigns & Clinical Treatments
  async listMyCampaignAssignments(apiBaseUrl: string): Promise<FWCampaignAssignmentItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/my-assignments`);
    if (!res.ok) {
      const fallback = await authFetch(apiBaseUrl, `/api/v1/campaigns/vo/my-assignments`);
      if (!fallback.ok) return [];
      return fallback.json();
    }
    return res.json();
  },

  async listActiveCampaigns(apiBaseUrl: string): Promise<FWCampaignOption[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns?limit=50`);
    if (!res.ok) return [];
    const all: FWCampaignOption[] = await res.json();
    const active = all.filter((c) => c.status === 'ACTIVE');
    return active.length > 0 ? active : all.filter((c) => c.status !== 'CANCELLED' && c.status !== 'CLOSED');
  },

  async listVillageCamps(apiBaseUrl: string, villageId: string, campaignId?: string): Promise<FWCampOption[]> {
    const query = new URLSearchParams({ village_id: villageId });
    if (campaignId) query.set('campaign_id', campaignId);
    const res = await authFetch(apiBaseUrl, `/api/v1/camps?${query.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  async getPendingVaccinations(
    apiBaseUrl: string,
    campaignId: string,
    villageId?: string
  ): Promise<FWCampaignPendingResponse> {
    const query = villageId ? `?village_id=${villageId}` : '';
    const res = await authFetch(apiBaseUrl, `/api/v1/campaigns/${campaignId}/pending-vaccinations${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(formatApiError(err, `બાકી રસીકરણ યાદી મેળવવામાં નિષ્ફળ: HTTP ${res.status}`));
    }
    return res.json();
  },

  async listVaccinations(apiBaseUrl: string): Promise<FWVaccinationItem[]> {
    const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations?limit=50`);
    if (!res.ok) return [];
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
      campaign_id?: string;
      camp_id?: string;
    },
    deviceInfo?: DeviceInfo
  ): Promise<{ eventId?: string; isOffline?: boolean }> {
    if (navigator.onLine) {
      try {
        const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          return { eventId: data.event_id, isOffline: false };
        }
        if (res.status !== 500 && res.status !== 503) {
          const err = await res.json().catch(() => null);
          throw new Error(formatApiError(err, `રસીકરણ નોંધણી નિષ્ફળ: HTTP ${res.status}`));
        }
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
      }
    }

    if (!deviceInfo) {
      throw new Error('ઓફલાઇન રસીકરણ માટે ઉપકરણ માહિતી જરૂરી છે.');
    }

    const eventId = await syncController.enqueueEvent(
      'VACCINATION',
      payload,
      deviceInfo
    );
    return { eventId, isOffline: true };
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
      remarks?: string;
    },
    deviceInfo?: DeviceInfo
  ): Promise<{ eventId?: string; isOffline?: boolean }> {
    if (navigator.onLine) {
      try {
        const res = await authFetch(apiBaseUrl, `/api/v1/vaccinations/treatments`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          return { eventId: data.event_id, isOffline: false };
        }
        if (res.status !== 500 && res.status !== 503) {
          const err = await res.json().catch(() => null);
          throw new Error(formatApiError(err, `સારવાર નોંધણી નિષ્ફળ: HTTP ${res.status}`));
        }
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
      }
    }

    if (!deviceInfo) {
      throw new Error('ઓફલાઇન સારવાર માટે ઉપકરણ માહિતી જરૂરી છે.');
    }

    const eventId = await syncController.enqueueEvent(
      'TREATMENT',
      payload,
      deviceInfo
    );
    return { eventId, isOffline: true };
  },
};

