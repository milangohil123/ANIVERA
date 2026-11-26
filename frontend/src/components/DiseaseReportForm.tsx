import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { CameraCapture, type SelectedPhoto } from './CameraCapture';
import { queueDiseaseReportPhoto } from '../services/mediaService';
import { syncController, type DeviceInfo } from '../services/syncController';
import { networkSyncManager } from '../services/networkSyncManager';
import { authService } from '../services/authService';
import { fwService } from '../services/fwService';
import { offlineDb, type QueuedEvent } from '../db/offlineDb';
import { AlertTriangle, CheckCircle, MapPin, Send, RotateCcw, AlertCircle } from 'lucide-react';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DiseaseReportFormProps {
  deviceInfo: DeviceInfo;
  apiBaseUrl: string;
  authToken: string;
  editingEvent?: QueuedEvent | null;
  onSubmitted?: (eventId: string, hasPhoto: boolean) => void;
  onCancelEdit?: () => void;
}

export interface VillageOption {
  id: string;
  code: string;
  nameGu: string;
  nameEn: string;
}

export interface FarmerOption {
  id: string;
  fullName: string;
  farmerCode?: string;
  mobileE164?: string;
}

export interface AnimalOption {
  id: string;
  animalCode?: string;
  tag?: string;
  speciesCode: string;
  farmerId?: string;
}

const COMMON_DISEASES = [
  { code: 'FMD', labelGu: 'ખરવા-મોવાસા (FMD)' },
  { code: 'HS', labelGu: 'ગળસૂંઠો (HS)' },
  { code: 'BQ', labelGu: 'ગાઠીયો તાવ (BQ)' },
  { code: 'LSD', labelGu: 'લમ્પી ચામડીનો રોગ (LSD)' },
  { code: 'PPR', labelGu: 'પીપીઆર (PPR)' },
  { code: 'ANTHRAX', labelGu: 'કાળીયો તાવ (Anthrax)' },
  { code: 'UNKNOWN', labelGu: 'અન્ય / અજ્ઞાત રોગ' },
];

const COMMON_SYMPTOMS = [
  { code: 'MOUTH_BLISTERS', labelGu: 'મોંમાં ચાંદા / ફોલ્લા' },
  { code: 'FOOT_LESIONS', labelGu: 'ખરીમાં ચાંદા' },
  { code: 'SALIVATION', labelGu: 'મોંમાંથી સતત લાળ પડવી' },
  { code: 'HIGH_FEVER', labelGu: 'તીવ્ર તાવ' },
  { code: 'LAMENESS', labelGu: 'લંગડાપણું' },
  { code: 'RESPIRATORY_DISTRESS', labelGu: 'શ્વાસ લેવામાં તકલીફ / ઘસારો' },
  { code: 'MILK_DROP', labelGu: 'દૂધ ઉત્પાદનમાં અચાનક ઘટાડો' },
  { code: 'SKIN_NODULES', labelGu: 'ચામડી પર ગાંઠો / ઢીમણા' },
];

const isValidId = (val?: string | null): boolean => Boolean(val && val.trim().length >= 8);

export const DiseaseReportForm: React.FC<DiseaseReportFormProps> = ({
  deviceInfo,
  apiBaseUrl,
  authToken,
  editingEvent,
  onSubmitted,
  onCancelEdit,
}) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const preloadedAnimal = (location.state as any)?.preloadedAnimal;

  const paramAnimalId = searchParams.get('animal_id');
  const paramVillageId = searchParams.get('village_id');
  const paramFarmerId = searchParams.get('farmer_id');

  const [villageId, setVillageId] = useState<string>(() => preloadedAnimal?.village_id || paramVillageId || '');
  const [animalId, setAnimalId] = useState<string>(() => preloadedAnimal?.id || paramAnimalId || '');
  const [farmerId, setFarmerId] = useState<string>(() => preloadedAnimal?.farmer_id || paramFarmerId || '');
  const [diseaseCode, setDiseaseCode] = useState('FMD');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [observationText, setObservationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);

  // Pre-selected context summary banner
  const [selectedAnimalContext, setSelectedAnimalContext] = useState<{
    code: string;
    species: string;
    farmerName?: string | null;
    villageName?: string | null;
  } | null>(() => {
    if (preloadedAnimal) {
      return {
        code: preloadedAnimal.animal_code || preloadedAnimal.bharat_pashudhan_tag || preloadedAnimal.id?.substring(0, 8),
        species: preloadedAnimal.species_code || 'LIVESTOCK',
        farmerName: preloadedAnimal.farmer_name || preloadedAnimal.owner_name,
        villageName: preloadedAnimal.village_name,
      };
    }
    return null;
  });

  // Selector Options
  const [villages, setVillages] = useState<VillageOption[]>(() => {
    if (preloadedAnimal?.village_id) {
      const vName = (preloadedAnimal.village_name && preloadedAnimal.village_name.trim()) ? preloadedAnimal.village_name.trim() : '';
      return [
        {
          id: String(preloadedAnimal.village_id),
          code: '',
          nameGu: vName || 'ગામ',
          nameEn: vName || 'Village',
        },
      ];
    }
    return [];
  });
  const [farmers, setFarmers] = useState<FarmerOption[]>(() => {
    if (preloadedAnimal?.farmer_id) {
      return [
        {
          id: String(preloadedAnimal.farmer_id),
          fullName: preloadedAnimal.farmer_name || preloadedAnimal.owner_name || 'પશુપાલક',
        },
      ];
    }
    return [];
  });
  const [animals, setAnimals] = useState<AnimalOption[]>(() => {
    if (preloadedAnimal?.id) {
      return [
        {
          id: String(preloadedAnimal.id),
          animalCode: preloadedAnimal.animal_code,
          tag: preloadedAnimal.bharat_pashudhan_tag,
          speciesCode: preloadedAnimal.species_code || 'LIVESTOCK',
          farmerId: preloadedAnimal.farmer_id ? String(preloadedAnimal.farmer_id) : undefined,
        },
      ];
    }
    return [];
  });

  const [isLoadingVillages, setIsLoadingVillages] = useState(false);
  const [isLoadingFarmers, setIsLoadingFarmers] = useState(false);
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{ eventId: string; offline: boolean; isRetry?: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch authorized villages on mount
  useEffect(() => {
    let isMounted = true;

    const loadAuthorizedVillages = async () => {
      setIsLoadingVillages(true);
      let mapped: VillageOption[] = [];
      try {
        const raw = await fwService.listAssignedVillages(apiBaseUrl);
        mapped = (raw || []).map((v) => ({
          id: String(v.id),
          code: String(v.code || ''),
          nameGu: String((v.name_gu && v.name_gu.trim()) ? v.name_gu.trim() : (v.name_en && v.name_en.trim()) ? v.name_en.trim() : v.code || 'ગામ'),
          nameEn: String((v.name_en && v.name_en.trim()) ? v.name_en.trim() : v.code || 'Village'),
        }));

        if (mapped.length > 0) {
          // Cache for offline usage
          await offlineDb.offline_meta.put({
            key: 'cached_authorized_villages',
            value: mapped,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Network village fetch failed, falling back to local cache:', err);
      } finally {
        if (isMounted) setIsLoadingVillages(false);
      }

      // Offline fallback: load cached villages from IndexedDB
      if (mapped.length === 0) {
        try {
          const cached = await offlineDb.offline_meta.get('cached_authorized_villages');
          if (cached && Array.isArray(cached.value)) {
            mapped = cached.value as VillageOption[];
          }
        } catch (cacheErr) {
          console.error('Failed to load cached villages:', cacheErr);
        }
      }

      if (isMounted) {
        if (mapped.length > 0) {
          setVillages((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const extra = mapped.filter((m) => !existingIds.has(m.id));
            return [...prev, ...extra];
          });
        }
        setIsLoadingVillages(false);
      }
    };

    loadAuthorizedVillages();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // 2. Resolve initial animal / farmer / village from URL query params or preloaded state
  useEffect(() => {
    let isMounted = true;

    const resolveInitialContext = async () => {
      if (editingEvent) return; // handled by editingEvent effect

      // If preloaded animal was passed via navigation state, confirm fields are locked in
      if (preloadedAnimal) {
        if (preloadedAnimal.village_id) setVillageId(String(preloadedAnimal.village_id));
        if (preloadedAnimal.farmer_id) setFarmerId(String(preloadedAnimal.farmer_id));
        if (preloadedAnimal.id) setAnimalId(String(preloadedAnimal.id));
        return;
      }

      // If animal_id is in URL query parameters
      if (paramAnimalId && isValidId(paramAnimalId)) {
        setIsLoadingAnimals(true);
        try {
          // A: Try local cache first for instant populate
          const cached = await offlineDb.cached_animals.get(paramAnimalId);
          if (cached && isMounted) {
            setAnimalId(cached.id);
            if (cached.villageId) setVillageId(cached.villageId);
            if (cached.farmerId) setFarmerId(cached.farmerId);
          }

          // B: Fetch fresh animal details from backend
          const detail = await fwService.getAnimal(apiBaseUrl, paramAnimalId);
          if (isMounted && detail) {
            const vId = String(detail.village_id || paramVillageId || '');
            const fId = String(detail.farmer_id || paramFarmerId || '');
            const aId = String(detail.id || paramAnimalId);

            if (vId) setVillageId(vId);
            if (fId) setFarmerId(fId);
            setAnimalId(aId);

            // Pre-seed into village list if not present
            if (vId) {
              setVillages((prev) => {
                if (prev.some((v) => v.id === vId)) return prev;
                return [
                  {
                    id: vId,
                    code: '',
                    nameGu: detail.village_name || 'ગામ',
                    nameEn: detail.village_name || 'Village',
                  },
                  ...prev,
                ];
              });
            }

            // Pre-seed into farmer list
            if (fId) {
              const fName = (detail as any).farmer_name || detail.owner_name || 'પશુપાલક';
              setFarmers((prev) => {
                if (prev.some((f) => f.id === fId)) return prev;
                return [
                  {
                    id: fId,
                    fullName: fName,
                    farmerCode: (detail as any).farmer_code,
                  },
                  ...prev,
                ];
              });
            }

            // Pre-seed into animal list
            setAnimals((prev) => {
              if (prev.some((a) => a.id === aId)) return prev;
              return [
                {
                  id: aId,
                  animalCode: detail.animal_code || undefined,
                  tag: detail.bharat_pashudhan_tag || undefined,
                  speciesCode: detail.species_code || 'LIVESTOCK',
                  farmerId: fId,
                },
                ...prev,
              ];
            });

            setSelectedAnimalContext({
              code: detail.animal_code || detail.bharat_pashudhan_tag || aId.substring(0, 8),
              species: detail.species_code,
              farmerName: (detail as any).farmer_name || detail.owner_name,
              villageName: detail.village_name,
            });
          }
        } catch (e) {
          console.warn('Failed to load initial animal details:', e);
          if (paramVillageId && isMounted) setVillageId(paramVillageId);
          if (paramFarmerId && isMounted) setFarmerId(paramFarmerId);
          if (paramAnimalId && isMounted) setAnimalId(paramAnimalId);
        } finally {
          if (isMounted) setIsLoadingAnimals(false);
        }
        return;
      }

      // If only farmer_id is in URL
      if (paramFarmerId && isValidId(paramFarmerId)) {
        try {
          const fDetail = await fwService.getFarmer(apiBaseUrl, paramFarmerId);
          if (isMounted && fDetail) {
            setFarmerId(fDetail.id);
            if (fDetail.village_id) setVillageId(fDetail.village_id);
          }
        } catch (e) {
          console.warn('Failed to load initial farmer details:', e);
        }
        return;
      }

      // If only village_id is in URL
      if (paramVillageId && isValidId(paramVillageId)) {
        setVillageId(paramVillageId);
      }
    };

    resolveInitialContext();
    return () => {
      isMounted = false;
    };
  }, [paramAnimalId, paramVillageId, paramFarmerId, preloadedAnimal, apiBaseUrl, editingEvent]);

  // 3. Fetch farmers and animals when villageId changes
  useEffect(() => {
    let isMounted = true;

    const loadVillageEntities = async () => {
      if (!villageId || !isValidId(villageId)) {
        setFarmers((prev) => (farmerId ? prev.filter((f) => f.id === farmerId) : []));
        setAnimals((prev) => (animalId ? prev.filter((a) => a.id === animalId) : []));
        return;
      }

      setIsLoadingFarmers(true);
      setIsLoadingAnimals(true);

      // A: Farmers
      try {
        let loadedFarmers: FarmerOption[] = [];
        try {
          const data = await fwService.listFarmers(apiBaseUrl, villageId);
          loadedFarmers = (data || []).map((f) => ({
            id: String(f.id),
            fullName: String(f.full_name || ''),
            farmerCode: f.farmer_code ? String(f.farmer_code) : undefined,
            mobileE164: f.mobile_e164 ? String(f.mobile_e164) : undefined,
          }));

          for (const f of loadedFarmers) {
            await offlineDb.cached_farmers.put({
              id: f.id,
              villageId,
              fullName: f.fullName,
              mobileE164: f.mobileE164,
              farmerCode: f.farmerCode,
              userId: f.id,
              cachedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('Could not fetch online farmers, checking offline cache:', err);
        }

        if (loadedFarmers.length === 0) {
          const cached = await offlineDb.cached_farmers.where('villageId').equals(villageId).toArray();
          loadedFarmers = cached.map((c) => ({
            id: c.id,
            fullName: c.fullName,
            farmerCode: c.farmerCode,
            mobileE164: c.mobileE164,
          }));
        }

        if (isMounted) {
          setFarmers((prev) => {
            const existing = new Set(loadedFarmers.map((f) => f.id));
            const preserved = prev.filter((p) => p.id === farmerId && !existing.has(p.id));
            return [...loadedFarmers, ...preserved];
          });
        }
      } catch (err) {
        console.error('Error loading farmers:', err);
      } finally {
        if (isMounted) setIsLoadingFarmers(false);
      }

      // B: Animals
      try {
        let loadedAnimals: AnimalOption[] = [];
        try {
          const data = await fwService.listAnimals(apiBaseUrl, villageId);
          loadedAnimals = (data || []).map((a) => ({
            id: String(a.id),
            animalCode: a.animal_code ? String(a.animal_code) : undefined,
            tag: (a as any).bharat_pashudhan_tag || undefined,
            speciesCode: String(a.species_code || 'LIVESTOCK'),
            farmerId: a.farmer_id ? String(a.farmer_id) : undefined,
          }));

          for (const a of loadedAnimals) {
            await offlineDb.cached_animals.put({
              id: a.id,
              animalCode: a.animalCode,
              speciesCode: a.speciesCode,
              farmerId: a.farmerId || '',
              villageId,
              status: 'ACTIVE',
              userId: a.farmerId || 'OFFLINE',
              cachedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('Could not fetch online animals, checking offline cache:', err);
        }

        if (loadedAnimals.length === 0) {
          const cached = await offlineDb.cached_animals.where('villageId').equals(villageId).toArray();
          loadedAnimals = cached.map((c) => ({
            id: c.id,
            animalCode: c.animalCode,
            speciesCode: c.speciesCode,
            farmerId: c.farmerId,
          }));
        }

        if (isMounted) {
          setAnimals((prev) => {
            const existing = new Set(loadedAnimals.map((a) => a.id));
            const preserved = prev.filter((p) => p.id === animalId && !existing.has(p.id));
            return [...loadedAnimals, ...preserved];
          });
        }
      } catch (err) {
        console.error('Error loading animals:', err);
      } finally {
        if (isMounted) setIsLoadingAnimals(false);
      }
    };

    loadVillageEntities();
    return () => {
      isMounted = false;
    };
  }, [villageId, apiBaseUrl]);

  // When user selects an animal, automatically set the owner farmer
  const handleAnimalSelect = (newAnimalId: string) => {
    setAnimalId(newAnimalId);
    if (!newAnimalId) return;
    const found = animals.find((a) => a.id === newAnimalId);
    if (found && found.farmerId) {
      setFarmerId(found.farmerId);
    }
  };

  // When user selects a farmer, keep matching animal or reset
  const handleFarmerSelect = (newFarmerId: string) => {
    setFarmerId(newFarmerId);
    if (!newFarmerId) return;
    const currentAnimal = animals.find((a) => a.id === animalId);
    if (currentAnimal && currentAnimal.farmerId && currentAnimal.farmerId !== newFarmerId) {
      setAnimalId('');
    }
  };

  // Animals filtered by selected farmer if any
  const displayedAnimals = farmerId
    ? animals.filter((a) => !a.farmerId || a.farmerId === farmerId)
    : animals;

  // 4. Populate form fields if editing an existing rejected report
  useEffect(() => {
    if (editingEvent && editingEvent.payload) {
      const p = editingEvent.payload as Record<string, unknown>;
      const vId = String(p.village_id || p.villageId || '');
      setVillageId(vId);
      setDiseaseCode(String(p.disease_code || p.diseaseCode || 'FMD'));
      setReportDate(String(p.report_date || p.reportDate || new Date().toISOString().split('T')[0]));
      setSelectedSymptoms(Array.isArray(p.symptoms) ? (p.symptoms as string[]) : []);
      setObservationText(String(p.observation_text || ''));
      setAnimalId(p.animal_id ? String(p.animal_id) : '');
      setFarmerId(p.farmer_id ? String(p.farmer_id) : '');
      if (typeof p.latitude === 'number') setLatitude(p.latitude);
      if (typeof p.longitude === 'number') setLongitude(p.longitude);
      setErrorMessage(null);
      setSubmitSuccess(null);
    }
  }, [editingEvent]);

  const toggleSymptom = (code: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      alert('તમારા ઉપકરણમાં GPS સપોર્ટ ઉપલબ્ધ નથી.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
      },
      (err) => {
        alert(`સ્થાન મેળવવામાં નિષ્ફળ: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation 1: Village UUID
    if (!villageId.trim()) {
      setErrorMessage('કૃપા કરીને યાદીમાંથી ગામ પસંદ કરો.');
      return;
    }
    if (!UUID_REGEX.test(villageId.trim())) {
      setErrorMessage('અમાન્ય ગામ ID. કૃપા કરીને યાદીમાંથી માન્ય ગામ પસંદ કરો.');
      return;
    }

    // Validation 2: Optional Animal UUID
    const cleanAnimalId = animalId.trim();
    if (cleanAnimalId && !UUID_REGEX.test(cleanAnimalId)) {
      setErrorMessage('અમાન્ય પશુ ID. કૃપા કરીને યાદીમાંથી માન્ય પશુ પસંદ કરો અથવા ખાલી રાખો.');
      return;
    }

    // Validation 3: Optional Farmer UUID
    const cleanFarmerId = farmerId.trim();
    if (cleanFarmerId && !UUID_REGEX.test(cleanFarmerId)) {
      setErrorMessage('અમાન્ય પશુપાલક ID. કૃપા કરીને યાદીમાંથી માન્ય પશુપાલક પસંદ કરો અથવા ખાલી રાખો.');
      return;
    }

    if (!diseaseCode) {
      setErrorMessage('કૃપા કરીને શંકાસ્પદ રોગ પસંદ કરો.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        village_id: villageId.trim(),
        disease_code: diseaseCode,
        report_date: reportDate,
        symptoms: selectedSymptoms,
        observation_text: observationText.trim() || null,
        animal_id: cleanAnimalId || null,
        farmer_id: cleanFarmerId || null,
        latitude,
        longitude,
      };

      let targetEventId: string;
      const isOnline = navigator.onLine;

      if (editingEvent) {
        // Safe correction & retry of an existing rejected report
        targetEventId = editingEvent.eventId;
        await syncController.updateAndRetryEvent(targetEventId, payload);
      } else {
        // Enqueue fresh domain event into local IndexedDB
        targetEventId = await syncController.enqueueEvent('DISEASE_REPORT', payload, deviceInfo);
      }

      // If photo was captured or attached, compress and enqueue linked to targetEventId
      let hasPhoto = false;
      if (photo) {
        await queueDiseaseReportPhoto(targetEventId, photo.file);
        hasPhoto = true;
      }

      // If online and authenticated, trigger full sync in background
      if (isOnline) {
        const validToken = (await authService.getValidAccessToken(apiBaseUrl)) || authToken;
        if (validToken && validToken !== 'mock-bearer-token-for-dev') {
          networkSyncManager
            .triggerFullSync(apiBaseUrl, validToken, deviceInfo)
            .catch((syncErr) => {
              console.warn('Background sync encountered an issue, queued safely locally:', syncErr);
            });
        }
      }

      setSubmitSuccess({
        eventId: targetEventId,
        offline: !isOnline,
        isRetry: Boolean(editingEvent),
      });

      if (onSubmitted) {
        onSubmitted(targetEventId, hasPhoto);
      }

      // Reset form if fresh submission
      if (!editingEvent) {
        setObservationText('');
        setSelectedSymptoms([]);
        setPhoto(null);
        setAnimalId('');
        setFarmerId('');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'અહેવાલ સંગ્રહિત કરવામાં નિષ્ફળ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 max-w-2xl mx-auto">
      <div className="border-b border-gray-100 pb-4 mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            {editingEvent
              ? 'અહેવાલ સુધારો અને ફરી સબમિટ કરો'
              : 'શંકાસ્પદ રોગ અહેવાલ નોંધણી'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {editingEvent
              ? `અસ્વીકાર થયેલ અહેવાલ (${editingEvent.eventId.substring(0, 8)}...) માં સુધારો કરી ફરીથી સબમિટ કરો.`
              : 'ક્ષેત્ર કાર્યકર / પશુચિકિત્સક દ્વારા શંકાસ્પદ રોગના લક્ષણો અને પુરાવા સબમિટ કરો.'}
          </p>
        </div>

        {editingEvent && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            રદ કરો
          </button>
        )}
      </div>

      {editingEvent && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>સૂચના:</strong> આ અહેવાલ પૂર્વમાં સર્વર દ્વારા અસ્વીકાર (REJECTED) થયો હતો. યોગ્ય ગામ, પશુ અથવા પશુપાલક પસંદ કરીને ફરી સબમિટ કરવાથી પિતૃ અહેવાલ અને તેનો ફોટોગ્રાફ બંને આપમેળે સંગ્રહિત થશે.
          </div>
        </div>
      )}

      {submitSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-emerald-800">
              {submitSuccess.isRetry
                ? 'અહેવાલ સુધારીને સફળતાપૂર્વક અપડેટ થયો છે!'
                : 'અહેવાલ સફળતાપૂર્વક નોંધાયો છે!'}
            </h4>
            <p className="text-xs text-emerald-700 mt-1">
              સ્થાનિક ઇવેન્ટ ID: <code className="font-mono bg-emerald-100/60 px-1 rounded">{submitSuccess.eventId}</code>
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {submitSuccess.offline
                ? 'હાલમાં ઉપકરણ ઑફલાઇન છે. નેટવર્ક જોડાણ થતાં ફોટો અને અહેવાલ સ્વચાલિત અપલોડ થશે.'
                : 'સર્વર સાથે સમન્વયન (Sync) પ્રક્રિયા શરૂ થઈ ગઈ છે.'}
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {selectedAnimalContext && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-emerald-800">
              સ્કેન કરેલ પશુની વિગત આપમેળે પસંદ થઈ ગઈ છે:
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-emerald-800 font-medium">
              <span>
                પશુ કોડ: <strong className="font-mono bg-white/60 px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-900">{selectedAnimalContext.code}</strong> ({selectedAnimalContext.species})
              </span>
              {selectedAnimalContext.farmerName && (
                <span>
                  પશુપાલક: <strong>{selectedAnimalContext.farmerName}</strong>
                </span>
              )}
              {selectedAnimalContext.villageName && (
                <span>
                  ગામ: <strong>{selectedAnimalContext.villageName}</strong>
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-emerald-600">
              ગામ, પશુપાલક અને પશુની પસંદગી આપમેળે થઈ ગઈ છે. હવે માત્ર શંકાસ્પદ રોગ અને લક્ષણો પસંદ કરીને સબમિટ કરો.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Village Selection Dropdown */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            અધિકૃત ગામ <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={villageId}
            onChange={(e) => {
              setVillageId(e.target.value);
              setFarmerId('');
              setAnimalId('');
              setSelectedAnimalContext(null);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
            disabled={isSubmitting || isLoadingVillages}
          >
            <option value="">
              {isLoadingVillages ? 'ગામોની યાદી લાવી રહ્યું છે...' : '-- ગામ પસંદ કરો * --'}
            </option>
            {villages.map((v) => {
              const primary = (v.nameGu && v.nameGu !== 'ગામ') ? v.nameGu : (v.nameEn && v.nameEn !== 'Village') ? v.nameEn : v.code || 'ગામ';
              const secondary = (v.nameEn && v.nameEn !== 'Village' && v.nameEn !== primary) ? v.nameEn : v.code || '';
              return (
                <option key={v.id} value={v.id}>
                  {primary}{secondary ? ` (${secondary})` : ''}
                </option>
              );
            })}
          </select>
          {villages.length === 0 && !isLoadingVillages && (
            <p className="text-xs text-gray-400 mt-1">
              જો ગામો ન દેખાય, તો ખાતરી કરો કે તમારું સ્ટાફ એકાઉન્ટ અધિકૃત ગામો સાથે જોડાયેલ છે.
            </p>
          )}
        </div>

        {/* Farmer and Animal Dropdown Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              પશુપાલક <span className="text-xs text-gray-400 font-normal">(વૈકલ્પિક)</span>
            </label>
            <select
              value={farmerId}
              onChange={(e) => handleFarmerSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={isSubmitting || !villageId || isLoadingFarmers}
            >
              <option value="">
                {!villageId
                  ? '-- પહેલા ગામ પસંદ કરો --'
                  : isLoadingFarmers
                  ? 'પશુપાલકો લાવી રહ્યું છે...'
                  : '-- પશુપાલક પસંદ કરો (વૈકલ્પિક) --'}
              </option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.fullName} {f.farmerCode ? `(${f.farmerCode})` : f.mobileE164 ? `(${f.mobileE164})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              પશુ <span className="text-xs text-gray-400 font-normal">(વૈકલ્પિક)</span>
            </label>
            <select
              value={animalId}
              onChange={(e) => handleAnimalSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={isSubmitting || !villageId || isLoadingAnimals}
            >
              <option value="">
                {!villageId
                  ? '-- પહેલા ગામ પસંદ કરો --'
                  : isLoadingAnimals
                  ? 'પશુઓ લાવી રહ્યું છે...'
                  : '-- પશુ પસંદ કરો (વૈકલ્પિક) --'}
              </option>
              {displayedAnimals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.animalCode || a.tag || a.id.substring(0, 8)} ({a.speciesCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Suspected Disease & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              શંકાસ્પદ રોગ <span className="text-red-500">*</span>
            </label>
            <select
              value={diseaseCode}
              onChange={(e) => setDiseaseCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={isSubmitting}
            >
              {COMMON_DISEASES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.labelGu}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              લક્ષણ દેખાયા તારીખ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Symptoms Tags */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            દેખાતા લક્ષણો પસંદ કરો
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.map((s) => {
              const active = selectedSymptoms.includes(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => toggleSymptom(s.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    active
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                  disabled={isSubmitting}
                >
                  {s.labelGu}
                </button>
              );
            })}
          </div>
        </div>

        {/* Observation Narrative */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            વિગતવાર અવલોકન / નોંધ
          </label>
          <textarea
            rows={3}
            value={observationText}
            onChange={(e) => setObservationText(e.target.value)}
            placeholder="સ્થળ પર જોવા મળેલ સ્થિતિની સ્પષ્ટ નોંધ..."
            maxLength={1000}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500"
            disabled={isSubmitting}
          />
        </div>

        {/* GPS Location Button */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">GPS સ્થાન (સ્થળ ચકાસણી)</label>
            <button
              type="button"
              onClick={handleCaptureLocation}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-medium py-1 px-2 rounded-md hover:bg-emerald-50 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              {latitude && longitude ? 'સ્થાન અપડેટ કરો' : 'હાલનું સ્થાન મેળવો'}
            </button>
          </div>
          {latitude && longitude && (
            <p className="text-xs text-gray-500 mt-1 font-mono">
              અક્ષાંશ: {latitude}, રેખાંશ: {longitude}
            </p>
          )}
        </div>

        {/* Camera / Photo Attachment */}
        <CameraCapture
          photo={photo}
          onPhotoSelected={setPhoto}
          onPhotoRemoved={() => setPhoto(null)}
          disabled={isSubmitting}
        />

        {/* Submit / Retry Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {editingEvent ? <RotateCcw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {isSubmitting
              ? 'પ્રક્રિયા ચાલુ છે...'
              : editingEvent
              ? 'સુધારેલ અહેવાલ સાચવો અને ફરી સબમિટ કરો'
              : 'અહેવાલ સબમિટ કરો'}
          </button>
        </div>
      </form>
    </div>
  );
};
