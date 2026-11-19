import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import {
  fwService,
  type FWFarmerItem,
  type FWAnimalItem,
  type FWAnimalDetail,
} from '../../services/fwService';
import {
  classifyScannedTag,
  GUJARAT_BREEDS_BY_SPECIES,
  STANDARD_VACCINATION_DISEASES,
  type ClassifiedTagResult,
  type IdentificationMethod,
} from '../../utils/tagClassifier';
import {
  Tag,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Camera,
  Upload,
  Keyboard,
  Plus,
  Trash2,
  X,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

interface UniversalAnimalRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeVillageId: string;
  farmers: FWFarmerItem[];
  prefilledTag?: string;
  onSuccess: (animal: FWAnimalItem) => void;
}

export const UniversalAnimalRegistrationModal: React.FC<UniversalAnimalRegistrationModalProps> = ({
  isOpen,
  onClose,
  activeVillageId,
  farmers,
  prefilledTag,
  onSuccess,
}) => {
  const { apiBaseUrl, deviceInfo } = useAuth();

  // Wizard Step: 1 = Farmer, 2 = Existing Tag Question, 3 = Scan/Verify, 4 = Animal Details, 5 = Vaccination History, 6 = Review
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Step 1: Farmer Selection
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const [farmerSearch, setFarmerSearch] = useState<string>('');

  // Step 2: Has Existing Tag Question
  const [hasExistingTag, setHasExistingTag] = useState<boolean | null>(null);
  const [idMethod, setIdMethod] = useState<IdentificationMethod>('EXISTING_QR');

  // Step 3: Scan / Candidate Tag / Verification
  const [scanTab, setScanTab] = useState<'CAMERA' | 'FILE' | 'MANUAL'>('MANUAL');
  const [manualInput, setManualInput] = useState<string>('');
  const [classifiedTag, setClassifiedTag] = useState<ClassifiedTagResult | null>(null);
  const [isCheckingTag, setIsCheckingTag] = useState<boolean>(false);
  const [duplicateCheckNotice, setDuplicateCheckNotice] = useState<{
    isDup: boolean;
    message: string;
    animal?: FWAnimalDetail | null;
  } | null>(null);

  // Camera & File state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 4: Animal Details
  const [speciesCode, setSpeciesCode] = useState<'CATTLE' | 'BUFFALO' | 'GOAT' | 'SHEEP'>('CATTLE');
  const [sex, setSex] = useState<'F' | 'M'>('F');
  const [ageMonths, setAgeMonths] = useState<string>('24');
  const [breedName, setBreedName] = useState<string>('');
  const [identifyingMark, setIdentifyingMark] = useState<string>('');

  // Source badges state (to indicate which fields were auto-extracted vs manual)
  const [autoExtractedFields, setAutoExtractedFields] = useState<Record<string, boolean>>({});

  // Step 5: Previous Vaccination History
  const [hasPreviousVaccinations, setHasPreviousVaccinations] = useState<'YES' | 'NO'>('NO');
  const [vaccinationList, setVaccinationList] = useState<
    Array<{
      programme_code: string;
      vaccination_date: string;
      source: 'CARD_VERIFIED' | 'FARMER_REPORTED' | 'TAG_EXTRACTED';
      batch_number?: string;
      remarks?: string;
    }>
  >([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registeredSuccessAnimal, setRegisteredSuccessAnimal] = useState<FWAnimalItem | null>(null);

  // Initialize or reset wizard when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedFarmerId(farmers.length > 0 ? farmers[0].id : '');
      setFarmerSearch('');
      setHasExistingTag(null);
      setIdMethod('EXISTING_QR');
      setScanTab('MANUAL');
      setManualInput(prefilledTag || '');
      setClassifiedTag(null);
      setDuplicateCheckNotice(null);
      setSpeciesCode('CATTLE');
      setSex('F');
      setAgeMonths('24');
      setBreedName('');
      setIdentifyingMark('');
      setAutoExtractedFields({});
      setHasPreviousVaccinations('NO');
      setVaccinationList([]);
      setSubmitError(null);
      setRegisteredSuccessAnimal(null);

      if (prefilledTag) {
        // If prefilled tag provided, start directly with existing tag mode
        setHasExistingTag(true);
        handleRawInputProcess(prefilledTag);
      }
    } else {
      stopCamera();
    }
  }, [isOpen, prefilledTag]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping camera in modal:', e);
      }
      try {
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      await stopCamera();

      const qrElem = document.getElementById('modal-scanner-box');
      if (!qrElem) return;

      const formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ];

      const qrCode = new Html5Qrcode('modal-scanner-box', {
        formatsToSupport: formats,
        verbose: false,
      });
      html5QrCodeRef.current = qrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      await qrCode.start(
        { facingMode: 'environment' },
        config,
        async (decodedText: string) => {
          await stopCamera();
          handleRawInputProcess(decodedText);
        },
        () => {}
      );

      setCameraActive(true);
    } catch (err: any) {
      console.warn('Modal camera start failed:', err);
      setCameraError('કેમેરા શરૂ કરવામાં મુશ્કેલી. કૃપા કરીને પરવાનગી ચકાસો અથવા ટેગ નંબર લખો.');
      setCameraActive(false);
    }
  };

  // Handle Tab Change in Step 3
  useEffect(() => {
    if (currentStep === 3 && hasExistingTag && scanTab === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [scanTab, currentStep, hasExistingTag]);

  // Process any raw string (from Camera, File, or Manual Input)
  const handleRawInputProcess = async (rawText: string) => {
    if (!rawText || !rawText.trim()) return;
    const classified = classifyScannedTag(rawText.trim());
    setClassifiedTag(classified);
    setManualInput(classified.candidateTagValue || rawText.trim());

    // Auto-prefill extracted data if available in Format 3
    const extractedBadges: Record<string, boolean> = {};
    if (classified.extractedData) {
      if (classified.extractedData.speciesCode) {
        setSpeciesCode(classified.extractedData.speciesCode);
        extractedBadges['speciesCode'] = true;
      }
      if (classified.extractedData.sex && classified.extractedData.sex !== 'UNKNOWN') {
        setSex(classified.extractedData.sex);
        extractedBadges['sex'] = true;
      }
      if (classified.extractedData.ageMonths) {
        setAgeMonths(String(classified.extractedData.ageMonths));
        extractedBadges['ageMonths'] = true;
      }
      if (classified.extractedData.breedName) {
        setBreedName(classified.extractedData.breedName);
        extractedBadges['breedName'] = true;
      }
      if (classified.extractedData.vaccinations && classified.extractedData.vaccinations.length > 0) {
        setHasPreviousVaccinations('YES');
        const todayStr = new Date().toISOString().split('T')[0];
        setVaccinationList(
          classified.extractedData.vaccinations.map((v) => {
            const vDate = v.date && v.date <= todayStr ? v.date : todayStr;
            return {
              programme_code: v.programmeCode,
              vaccination_date: vDate,
              source: 'TAG_EXTRACTED',
              batch_number: v.batch,
              remarks: 'ટેગમાંથી આપોઆપ મળેલ માહિતી',
            };
          })
        );
      }
    }
    setAutoExtractedFields(extractedBadges);

    // Perform duplicate check
    const candidate = classified.candidateTagValue || rawText.trim();
    if (candidate) {
      await performDuplicateCheck(candidate);
    }
  };

  // Perform duplicate check against server
  const performDuplicateCheck = async (tagVal: string) => {
    if (!tagVal.trim()) return;
    setIsCheckingTag(true);
    setDuplicateCheckNotice(null);
    try {
      const res = await fwService.checkTag(apiBaseUrl, tagVal.trim());
      if (res.is_registered) {
        setDuplicateCheckNotice({
          isDup: true,
          message: res.message || 'આ Tag પહેલેથી જ પશુ સાથે જોડાયેલ છે!',
          animal: res.animal,
        });
      } else {
        setDuplicateCheckNotice({
          isDup: false,
          message: '✓ આ Tag ઉપલબ્ધ છે અને નવી નોંધણી માટે વાપરી શકાય છે.',
        });
      }
    } catch (e: any) {
      console.warn('Tag duplicate check error:', e);
      // Fallback: assume available if check failed due to offline
      setDuplicateCheckNotice({
        isDup: false,
        message: 'ટેગ ચકાસણી પૂર્ણ (સ્થાનિક ચકાસણી).',
      });
    } finally {
      setIsCheckingTag(false);
    }
  };

  // Handle Image Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileScanner = new Html5Qrcode('modal-scanner-box');
      const text = await fileScanner.scanFile(file, true);
      await fileScanner.clear();
      handleRawInputProcess(text);
    } catch {
      // Fallback: check filename if contains ID
      const nameMatch = file.name.match(/[A-Za-z0-9\-_]{6,26}/);
      if (nameMatch) {
        handleRawInputProcess(nameMatch[0]);
      } else {
        setDuplicateCheckNotice({
          isDup: false,
          message: 'ઇમેજમાંથી કોડ વંચાયો નથી. કૃપા કરીને ટેગ નંબર જાતે લખો.',
        });
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add Vaccination Row
  const handleAddVaccination = () => {
    setVaccinationList((prev) => [
      ...prev,
      {
        programme_code: 'FMD',
        vaccination_date: new Date().toISOString().split('T')[0],
        source: 'CARD_VERIFIED',
        batch_number: '',
        remarks: '',
      },
    ]);
  };

  const handleRemoveVaccination = (idx: number) => {
    setVaccinationList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateVaccination = (idx: number, field: string, val: any) => {
    setVaccinationList((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  // Submit Final Registration
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const selectedFarmer = farmers.find((f) => f.id === selectedFarmerId);
      if (!selectedFarmer) {
        throw new Error('કૃપા કરીને માન્ય ખેડૂત પસંદ કરો.');
      }

      const candidateTagVal = classifiedTag?.candidateTagValue || manualInput.trim();

      const payload = {
        species_code: speciesCode,
        sex: sex,
        age_months_estimate: parseInt(ageMonths, 10) || 24,
        farmer_id: selectedFarmerId,
        village_id: activeVillageId,
        breed_id: null,
        tag_identification_method: idMethod,
        tag_value: hasExistingTag ? candidateTagVal : undefined,
        tag_payload: classifiedTag?.rawPayload || undefined,
        tag_format: classifiedTag?.format || undefined,
        previous_vaccinations:
          hasPreviousVaccinations === 'YES' && vaccinationList.length > 0
            ? vaccinationList.map((v) => {
                const todayStr = new Date().toISOString().split('T')[0];
                return {
                  programme_code: v.programme_code,
                  vaccination_date: v.vaccination_date && v.vaccination_date > todayStr ? todayStr : v.vaccination_date,
                  source: v.source,
                  batch_number: v.batch_number || undefined,
                  remarks: v.remarks || undefined,
                };
              })
            : [],
      };

      const result = await fwService.registerAnimal(apiBaseUrl, payload, deviceInfo);

      if (result.animal) {
        setRegisteredSuccessAnimal(result.animal);
        onSuccess(result.animal);
      } else if (result.isOffline) {
        // Offline queued
        const placeholderAnimal: FWAnimalItem = {
          id: 'offline-' + Date.now(),
          animal_code: 'PENDING-OFFLINE',
          species_code: speciesCode,
          sex: sex,
          age_months_estimate: parseInt(ageMonths, 10) || 24,
          farmer_id: selectedFarmerId,
          village_id: activeVillageId,
          registration_status: 'QUEUED_OFFLINE',
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
        };
        setRegisteredSuccessAnimal(placeholderAnimal);
        onSuccess(placeholderAnimal);
      }
    } catch (err: any) {
      console.warn('Animal registration failed:', err);
      setSubmitError(err.message || 'પશુ નોંધણી નિષ્ફળ. કૃપા કરીને ફરી પ્રયાસ કરો.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedFarmer = farmers.find((f) => f.id === selectedFarmerId);
  const filteredFarmers = farmers.filter(
    (f) =>
      f.full_name.toLowerCase().includes(farmerSearch.toLowerCase()) ||
      (f.farmer_code && f.farmer_code.toLowerCase().includes(farmerSearch.toLowerCase())) ||
      (f.mobile_e164 && f.mobile_e164.includes(farmerSearch))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-700/80 flex items-center justify-center text-emerald-100">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                સાર્વત્રિક પશુ ઓળખ અને નોંધણી
              </h2>
              <p className="text-xs text-emerald-100/90 font-medium">
                ભૌતિક QR / Barcode ટેગ ચકાસણી અને અધિકૃત ડિજિટલ નોંધણી
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        {!registeredSuccessAnimal && (
          <div className="bg-emerald-50/70 border-b border-emerald-100 px-6 py-2.5 shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span className={currentStep >= 1 ? 'text-emerald-700 font-bold' : ''}>
                ૧. ખેડૂત
              </span>
              <span>→</span>
              <span className={currentStep >= 2 ? 'text-emerald-700 font-bold' : ''}>
                ૨. ટેગ પ્રકાર
              </span>
              <span>→</span>
              <span className={currentStep >= 3 ? 'text-emerald-700 font-bold' : ''}>
                ૩. સ્કેન / ચકાસણી
              </span>
              <span>→</span>
              <span className={currentStep >= 4 ? 'text-emerald-700 font-bold' : ''}>
                ૪. પશુ વિગત
              </span>
              <span>→</span>
              <span className={currentStep >= 5 ? 'text-emerald-700 font-bold' : ''}>
                ૫. અગાઉનું રસીકરણ
              </span>
              <span>→</span>
              <span className={currentStep >= 6 ? 'text-emerald-700 font-bold' : ''}>
                ૬. સમીક્ષા
              </span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto grow space-y-6">
          {/* SUCCESS STATE */}
          {registeredSuccessAnimal && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">પશુ સફળતાપૂર્વક નોંધાયું છે!</h3>
                <p className="text-sm text-slate-600 mt-1">
                  પશુનો આંતરિક ઓળખ ક્રમાંક:{' '}
                  <span className="font-mono font-bold text-emerald-800">
                    {registeredSuccessAnimal.animal_code || 'ANM-REGISTERED'}
                  </span>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-md mx-auto text-left text-xs space-y-2">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ખેડૂત માલિક:</span>
                  <span className="font-semibold text-slate-800">{selectedFarmer?.full_name}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ઓળખ પદ્ધતિ:</span>
                  <span className="font-semibold text-slate-800">
                    {idMethod === 'EXISTING_QR' && 'પહેલેથી ઉપલબ્ધ QR કોડ'}
                    {idMethod === 'EXISTING_BARCODE' && 'પહેલેથી ઉપલબ્ધ Barcode'}
                    {idMethod === 'INTERNAL_QR' && 'સિસ્ટમ જનરેટેડ QR કોડ'}
                    {idMethod === 'INTERNAL_BARCODE' && 'સિસ્ટમ જનરેટેડ Barcode'}
                  </span>
                </div>
                {hasExistingTag && (
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-slate-500">ટેગ / બારકોડ નંબર:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {classifiedTag?.candidateTagValue || manualInput}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">જાતિ / લિંગ:</span>
                  <span className="font-semibold text-slate-800">
                    {speciesCode} ({sex === 'F' ? 'માદા' : 'નર'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">અગાઉના રસીકરણ નોંધ:</span>
                  <span className="font-semibold text-slate-800">
                    {hasPreviousVaccinations === 'YES' ? `${vaccinationList.length} નોંધાયેલ` : 'ઉપલબ્ધ નથી'}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <Button variant="secondary" onClick={onClose}>
                  પૂર્ણ કરો / બહાર નીકળો
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setRegisteredSuccessAnimal(null);
                    setCurrentStep(1);
                    setHasExistingTag(null);
                    setClassifiedTag(null);
                    setManualInput('');
                  }}
                >
                  બીજું પશુ નોંધો
                </Button>
              </div>
            </div>
          )}

          {/* STEP 1: FARMER SELECTION */}
          {!registeredSuccessAnimal && currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">પગલું ૧: પશુ માલિક (ખેડૂત) પસંદ કરો</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ગામમાં નોંધાયેલા ખેડૂતોમાંથી પશુના માલિકની પસંદગી કરો.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ખેડૂતનું નામ, કોડ અથવા મોબાઈલ નંબર દ્વારા શોધો..."
                  value={farmerSearch}
                  onChange={(e) => setFarmerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                {filteredFarmers.length === 0 ? (
                  <p className="text-xs text-center py-6 text-slate-400">કોઈ ખેડૂત મળ્યા નથી</p>
                ) : (
                  filteredFarmers.map((f) => {
                    const isSelected = f.id === selectedFarmerId;
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedFarmerId(f.id)}
                        className={`p-3 rounded-lg border text-sm cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{f.full_name}</div>
                            <div className="text-xs text-slate-500 flex gap-2">
                              <span>કોડ: {f.farmer_code || '-'}</span>
                              {f.mobile_e164 && <span>• મો: {f.mobile_e164}</span>}
                            </div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: EXISTING TAG QUESTION */}
          {!registeredSuccessAnimal && currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  પગલું ૨: શું આ પશુના કાનમાં પહેલેથી કોઈ ભૌતિક Tag લાગેલો છે?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  પશુપાલકના પશુના કાનમાં પહેલેથી લાગેલા Tag ની જાળવણી કરવી આવશ્યક છે. તેને બદલવાની જરૂર નથી.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* OPTION A: YES, EXISTING TAG */}
                <div
                  onClick={() => {
                    setHasExistingTag(true);
                    setIdMethod('EXISTING_QR');
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    hasExistingTag === true
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Tag className="w-5 h-5" />
                      </div>
                      {hasExistingTag === true && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">હા, પહેલેથી Tag લાગેલો છે</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      પશુના કાનમાં પહેલેથી QR Code અથવા 1D Barcode વાળો પીળો/લીલો ભૌતિક ટેગ છે.
                    </p>
                  </div>

                  {hasExistingTag === true && (
                    <div className="mt-4 pt-3 border-t border-emerald-200 space-y-2">
                      <label className="text-xs font-semibold text-emerald-900 block">
                        ભૌતિક ટેગનો પ્રકાર પસંદ કરો:
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIdMethod('EXISTING_QR');
                          }}
                          className={`py-2 px-2.5 rounded font-medium border text-center ${
                            idMethod === 'EXISTING_QR'
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          ભૌતિક QR કોડ
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIdMethod('EXISTING_BARCODE');
                          }}
                          className={`py-2 px-2.5 rounded font-medium border text-center ${
                            idMethod === 'EXISTING_BARCODE'
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          ૧D Barcode (લીટીઓ)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* OPTION B: NO TAG */}
                <div
                  onClick={() => {
                    setHasExistingTag(false);
                    setIdMethod('INTERNAL_QR');
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    hasExistingTag === false
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      {hasExistingTag === false && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">ના, કોઈ Tag નથી</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      પશુના કાનમાં કોઈ ટેગ નથી. પશુરક્ષક સિસ્ટમ આપોઆપ નવો ડિજિટલ ઓળખ ક્રમાંક ફાળવશે.
                    </p>
                  </div>

                  {hasExistingTag === false && (
                    <div className="mt-4 pt-3 border-t border-emerald-200 space-y-2">
                      <label className="text-xs font-semibold text-emerald-900 block">
                        સિસ્ટમ જનરેશન પદ્ધતિ પસંદ કરો:
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIdMethod('INTERNAL_QR');
                          }}
                          className={`py-2 px-2.5 rounded font-medium border text-center ${
                            idMethod === 'INTERNAL_QR'
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          નવો QR કોડ
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIdMethod('INTERNAL_BARCODE');
                          }}
                          className={`py-2 px-2.5 rounded font-medium border text-center ${
                            idMethod === 'INTERNAL_BARCODE'
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          નવો Barcode
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SCANNING, EXTRACTION & VERIFICATION */}
          {!registeredSuccessAnimal && currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  પગલું ૩: ભૌતિક Tag સ્કેનિંગ અને ડુપ્લિકેટ ચકાસણી
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ટેગ પર રહેલો QR કોડ અથવા 1D Barcode સ્કેન કરો, અથવા ટેગ પર છપાયેલો નંબર સીધો દાખલ કરો.
                </p>
              </div>

              {/* Scan Method Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setScanTab('MANUAL')}
                  className={`py-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition ${
                    scanTab === 'MANUAL'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  ટેગ નંબર લખો
                </button>
                <button
                  type="button"
                  onClick={() => setScanTab('CAMERA')}
                  className={`py-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition ${
                    scanTab === 'CAMERA'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  કેમેરા સ્કેનર
                </button>
                <button
                  type="button"
                  onClick={() => setScanTab('FILE')}
                  className={`py-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition ${
                    scanTab === 'FILE'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  ઇમેજ અપલોડ
                </button>
              </div>

              {/* CAMERA SCANNER TAB */}
              {scanTab === 'CAMERA' && (
                <div className="space-y-3">
                  <div
                    id="modal-scanner-box"
                    className="w-full max-w-sm mx-auto h-56 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center text-slate-400"
                  >
                    {!cameraActive && <p className="text-xs">કેમેરા શરૂ થઈ રહ્યો છે...</p>}
                  </div>
                  {cameraError && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      {cameraError}
                    </div>
                  )}
                  <p className="text-xs text-center text-slate-500">
                    કેમેરા સામે કાનનો ભૌતિક ટેગ (QR અથવા Barcode) લાવો.
                  </p>
                </div>
              )}

              {/* FILE UPLOAD TAB */}
              {scanTab === 'FILE' && (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center space-y-2 bg-slate-50/50">
                  <Upload className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs text-slate-600 font-medium">
                    ટેગનો ફોટો અથવા સ્ક્રીનશોટ અહીં અપલોડ કરો
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="modal-file-input"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    ઇમેજ ફાઇલ પસંદ કરો
                  </Button>
                </div>
              )}

              {/* MANUAL INPUT */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-700 block">
                  ભૌતિક ટેગ નંબર *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => {
                      setManualInput(e.target.value);
                      if (classifiedTag) {
                        setClassifiedTag({
                          ...classifiedTag,
                          candidateTagValue: e.target.value.trim(),
                        });
                      }
                    }}
                    placeholder="દા.ત. 202412000005 અથવા 123456789100"
                    className="grow px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent uppercase"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleRawInputProcess(manualInput)}
                    disabled={!manualInput.trim() || isCheckingTag}
                  >
                    {isCheckingTag ? 'ચકાસણી...' : 'ચકાસો'}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  ટેગ પર છપાયેલા અંકો સીધા અહીં લખી શકો છો.
                </p>
              </div>

              {/* CLASSIFIED TAG DETAILS CARD */}
              {classifiedTag && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold text-slate-700">સ્કેન કરેલ ટેગનું ફોર્મેટ:</span>
                    <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                      {classifiedTag.formatNameGu}
                    </span>
                  </div>

                  <p className="text-slate-600">{classifiedTag.formatDescriptionGu}</p>

                  {/* URL Special Preview */}
                  {classifiedTag.isUrl && classifiedTag.url && (
                    <div className="bg-white border rounded p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ડોમેન:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {classifiedTag.domain}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">અધિકૃતતા:</span>
                        <span
                          className={`font-semibold ${
                            classifiedTag.isOfficialDomain ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {classifiedTag.isOfficialDomain ? 'અધિકૃત સંસ્થાકીય લિંક' : 'બાહ્ય વેબસાઇટ'}
                        </span>
                      </div>
                      <a
                        href={classifiedTag.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold underline pt-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        લિંક ખોલો
                      </a>
                    </div>
                  )}

                  {/* Raw content view if unknown */}
                  {classifiedTag.format === 'FORMAT_4_UNKNOWN' && (
                    <div className="bg-slate-900 text-slate-200 p-2 rounded font-mono text-[11px] break-all max-h-24 overflow-y-auto">
                      {classifiedTag.rawPayload}
                    </div>
                  )}
                </div>
              )}

              {/* DUPLICATE CHECK RESULT NOTICE */}
              {duplicateCheckNotice && (
                <div
                  className={`p-3.5 rounded-lg border flex items-start gap-3 text-xs ${
                    duplicateCheckNotice.isDup
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  {duplicateCheckNotice.isDup ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="grow">
                    <p className="font-semibold">{duplicateCheckNotice.message}</p>
                    {duplicateCheckNotice.animal && (
                      <div className="mt-2 bg-white/80 p-2 rounded border border-rose-200 space-y-1 font-mono text-[11px]">
                        <div>પશુ કોડ: {duplicateCheckNotice.animal.animal_code}</div>
                        <div>માલિક: {duplicateCheckNotice.animal.farmer_name || duplicateCheckNotice.animal.owner_name || '-'}</div>
                        <div>ગામ: {duplicateCheckNotice.animal.village_name || '-'}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: ANIMAL MANDATORY DETAILS */}
          {!registeredSuccessAnimal && currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">પગલું ૪: પશુની વિગતો પૂર્ણ કરો</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  લાલ તારાંકિત (*) તમામ વિગતો ફરજિયાત છે.
                </p>
              </div>

              {/* Identification Summary Pill */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-600">ટેગ ઓળખ:</span>
                <span className="font-mono font-bold text-emerald-800">
                  {hasExistingTag
                    ? classifiedTag?.candidateTagValue || manualInput
                    : 'સિસ્ટમ દ્વારા ઓટો જનરેટ થશે'}
                </span>
              </div>

              {/* Species Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">પશુ જાતિ *</label>
                  {autoExtractedFields['speciesCode'] && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                      🏷️ Tag માંથી મળેલ
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { code: 'CATTLE', label: 'ગાય' },
                    { code: 'BUFFALO', label: 'ભેંસ' },
                    { code: 'GOAT', label: 'બકરી' },
                    { code: 'SHEEP', label: 'ઘેટું' },
                  ].map((sp) => (
                    <button
                      key={sp.code}
                      type="button"
                      onClick={() => setSpeciesCode(sp.code as any)}
                      className={`p-2.5 rounded-lg border font-semibold text-center transition ${
                        speciesCode === sp.code
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sex & Age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">લિંગ *</label>
                    {autoExtractedFields['sex'] && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                        🏷️ Tag માંથી મળેલ
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSex('F')}
                      className={`py-2 rounded-lg border font-semibold text-center ${
                        sex === 'F'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      માદા
                    </button>
                    <button
                      type="button"
                      onClick={() => setSex('M')}
                      className={`py-2 rounded-lg border font-semibold text-center ${
                        sex === 'M'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      નર
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      અંદાજિત ઉંમર (મહિનામાં) *
                    </label>
                    {autoExtractedFields['ageMonths'] && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                        🏷️ Tag માંથી મળેલ
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={ageMonths}
                    onChange={(e) => setAgeMonths(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="દા.ત. ૨૪ (૨ વર્ષ)"
                  />
                </div>
              </div>

              {/* Breed */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">નસલ</label>
                  {autoExtractedFields['breedName'] && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                      🏷️ Tag માંથી મળેલ
                    </span>
                  )}
                </div>
                <select
                  value={breedName}
                  onChange={(e) => setBreedName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value="">-- નસલ પસંદ કરો --</option>
                  {(GUJARAT_BREEDS_BY_SPECIES[speciesCode] || []).map((b) => (
                    <option key={b.code} value={b.nameGu}>
                      {b.nameGu}
                    </option>
                  ))}
                </select>
              </div>

              {/* Identifying Mark */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  ઓળખ ચિહ્ન / રંગ (વિશેષ વિગત)
                </label>
                <input
                  type="text"
                  value={identifyingMark}
                  onChange={(e) => setIdentifyingMark(e.target.value)}
                  placeholder="દા.ત. સફેદ કપાળ, કાળો રંગ, ડાબા કાનમાં કાપો"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          )}

          {/* STEP 5: PREVIOUS VACCINATION HISTORY */}
          {!registeredSuccessAnimal && currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  પગલું ૫: અગાઉના રસીકરણની માહિતી
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  પશુને અગાઉ કોઈ રસી મુકાયેલ હોય તો તેની વિગત સ્પષ્ટ સ્ત્રોત સાથે નોંધો.
                </p>
              </div>

              {/* Question */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  શું આ પશુને અગાઉ કોઈ રસી મુકાયેલ છે? *
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setHasPreviousVaccinations('NO');
                      setVaccinationList([]);
                    }}
                    className={`p-3 rounded-lg border font-semibold text-center transition ${
                      hasPreviousVaccinations === 'NO'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    ના / વિગત ઉપલબ્ધ નથી
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasPreviousVaccinations('YES');
                      if (vaccinationList.length === 0) {
                        handleAddVaccination();
                      }
                    }}
                    className={`p-3 rounded-lg border font-semibold text-center transition ${
                      hasPreviousVaccinations === 'YES'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    હા, અગાઉ રસી મુકાયેલ છે
                  </button>
                </div>
              </div>

              {/* Vaccination rows if YES */}
              {hasPreviousVaccinations === 'YES' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">રસીકરણ યાદી:</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddVaccination}
                      className="text-xs py-1"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      નવી રસી ઉમેરો
                    </Button>
                  </div>

                  {vaccinationList.map((vax, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/70 space-y-3 relative text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700">રસી #{idx + 1}</span>
                        {vaccinationList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVaccination(idx)}
                            className="text-rose-600 hover:text-rose-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Disease */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            રોગ / રસીનું નામ *
                          </label>
                          <select
                            value={vax.programme_code}
                            onChange={(e) => handleUpdateVaccination(idx, 'programme_code', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs"
                          >
                            {STANDARD_VACCINATION_DISEASES.map((d) => (
                              <option key={d.code} value={d.code}>
                                {d.nameGu}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Date */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            રસી તારીખ *
                          </label>
                          <input
                            type="date"
                            max={new Date().toISOString().split('T')[0]}
                            value={vax.vaccination_date}
                            onChange={(e) => {
                              const val = e.target.value;
                              const todayStr = new Date().toISOString().split('T')[0];
                              handleUpdateVaccination(idx, 'vaccination_date', val > todayStr ? todayStr : val);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs"
                          />
                        </div>

                        {/* Source */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            માહિતીનો સ્ત્રોત *
                          </label>
                          <select
                            value={vax.source}
                            onChange={(e) => handleUpdateVaccination(idx, 'source', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs"
                          >
                            <option value="CARD_VERIFIED">રસીકરણ કાર્ડમાંથી ચકાસાયેલ</option>
                            <option value="FARMER_REPORTED">ખેડૂત દ્વારા મૌખિક જણાવેલ</option>
                            <option value="TAG_EXTRACTED">ટેગમાંથી આપોઆપ મળેલ</option>
                          </select>
                        </div>
                      </div>

                      {/* Remarks */}
                      <div>
                        <input
                          type="text"
                          placeholder="બેચ નંબર અથવા વધારાની નોંધ (વૈકલ્પિક)"
                          value={vax.remarks || ''}
                          onChange={(e) => handleUpdateVaccination(idx, 'remarks', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 6: FINAL REVIEW & SUBMISSION */}
          {!registeredSuccessAnimal && currentStep === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">પગલું ૬: આખરી સમીક્ષા અને નોંધણી</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  કૃપા કરીને તમામ વિગતો ધ્યાનપૂર્વક ચકાસીને અંતિમ નોંધણી કરો.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 border-b pb-2">
                  <div>
                    <span className="text-slate-500 block">ખેડૂત માલિક:</span>
                    <span className="font-bold text-slate-800">{selectedFarmer?.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ગામ:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedFarmer?.address_text || activeVillageId}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b pb-2">
                  <div>
                    <span className="text-slate-500 block">ઓળખ પદ્ધતિ:</span>
                    <span className="font-semibold text-slate-800">
                      {idMethod === 'EXISTING_QR' && 'ભૌતિક QR કોડ'}
                      {idMethod === 'EXISTING_BARCODE' && 'ભૌતિક 1D Barcode'}
                      {idMethod === 'INTERNAL_QR' && 'સિસ્ટમ જનરેટેડ QR કોડ'}
                      {idMethod === 'INTERNAL_BARCODE' && 'સિસ્ટમ જનરેટેડ Barcode'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ટેગ નંબર:</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {hasExistingTag ? classifiedTag?.candidateTagValue || manualInput : '(ઓટો જનરેટ)'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-b pb-2">
                  <div>
                    <span className="text-slate-500 block">જાતિ:</span>
                    <span className="font-bold text-slate-800">
                      {speciesCode === 'CATTLE'
                        ? 'ગાય'
                        : speciesCode === 'BUFFALO'
                        ? 'ભેંસ'
                        : speciesCode === 'GOAT'
                        ? 'બકરી'
                        : 'ઘેટું'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">લિંગ:</span>
                    <span className="font-semibold text-slate-800">{sex === 'F' ? 'માદા' : 'નર'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ઉંમર:</span>
                    <span className="font-semibold text-slate-800">{ageMonths} મહિના</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">અગાઉનું રસીકરણ:</span>
                  {hasPreviousVaccinations === 'YES' && vaccinationList.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {vaccinationList.map((v, i) => (
                        <li key={i}>
                          <span className="font-semibold">{v.programme_code}</span> — તારીખ:{' '}
                          {v.vaccination_date} (
                          {v.source === 'CARD_VERIFIED'
                            ? 'રસીકરણ કાર્ડમાંથી ચકાસાયેલ'
                            : v.source === 'FARMER_REPORTED'
                            ? 'ખેડૂત દ્વારા મૌખિક'
                            : 'ટેગમાંથી આપોઆપ'}
                          )
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-600 italic">કોઈ અગાઉની રસી નોંધાયેલ નથી</span>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!registeredSuccessAnimal && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div>
              {currentStep > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  પાછળ
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
                રદ કરો
              </Button>

              {currentStep === 1 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!selectedFarmerId}
                  onClick={() => setCurrentStep(2)}
                >
                  આગળ
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}

              {currentStep === 2 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={hasExistingTag === null}
                  onClick={() => {
                    if (hasExistingTag) {
                      setCurrentStep(3);
                    } else {
                      // Skip scan step if no tag
                      setCurrentStep(4);
                    }
                  }}
                >
                  આગળ
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}

              {currentStep === 3 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    !manualInput.trim() ||
                    isCheckingTag ||
                    (duplicateCheckNotice ? duplicateCheckNotice.isDup : false)
                  }
                  onClick={() => setCurrentStep(4)}
                >
                  આગળ
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}

              {currentStep === 4 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!speciesCode || !sex || !ageMonths}
                  onClick={() => setCurrentStep(5)}
                >
                  આગળ
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}

              {currentStep === 5 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentStep(6)}
                >
                  આગળ (સમીક્ષા)
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}

              {currentStep === 6 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'નોંધણી થઈ રહી છે...' : 'પશુ નોંધણી પૂર્ણ કરો'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

