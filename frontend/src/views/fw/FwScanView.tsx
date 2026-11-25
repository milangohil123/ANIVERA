import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  fwService,
  type FWAnimalDetail,
  type FWAnimalHistoryResponse,
  type FWFarmerItem,
  type FWVillageItem,
} from '../../services/fwService';
import { UniversalAnimalRegistrationModal } from '../../components/animals/UniversalAnimalRegistrationModal';
import { AnimalQrCard } from '../../components/common/AnimalQrCard';
import { classifyScannedTag, type ClassifiedTagResult } from '../../utils/tagClassifier';
import {
  Smartphone,
  QrCode,
  Barcode as BarcodeIcon,
  Tag,
  Search,
  RotateCcw,
  Camera,
  Flashlight,
  AlertCircle,
  FileText,
  HeartPulse,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Play,
  MapPin,
  ShieldCheck,
  Plus,
} from 'lucide-react';

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય',
  BUFFALO: 'ભેંસ',
  GOAT: 'બકરી',
  SHEEP: 'ઘેટું',
  OTHER: 'અન્ય',
};

export const FwScanView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [activeTab, setActiveTab] = useState<'CAMERA' | 'IMAGE_UPLOAD' | 'MANUAL_QR' | 'TAG_LOOKUP'>('CAMERA');
  const [cameraScanMode, setCameraScanMode] = useState<'UNIVERSAL' | 'BARCODE' | 'QR'>('UNIVERSAL');
  const [scannerStarted, setScannerStarted] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Unregistered Tag registration wizard state
  const [unregisteredTag, setUnregisteredTag] = useState<string | null>(null);
  const [unregisteredClassified, setUnregisteredClassified] = useState<ClassifiedTagResult | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [_villages, setVillages] = useState<FWVillageItem[]>([]);
  const [activeVillageId, setActiveVillageId] = useState<string>(() => {
    return localStorage.getItem('fw_active_village_id') || '';
  });
  const [farmers, setFarmers] = useState<FWFarmerItem[]>([]);

  // Manual inputs
  const [manualQrToken, setManualQrToken] = useState('');
  const [tagNumber, setTagNumber] = useState('');

  // Lookup results & states
  const [isLoading, setIsLoading] = useState(false);
  const [animalResult, setAnimalResult] = useState<FWAnimalDetail | null>(null);
  const [historyData, setHistoryData] = useState<FWAnimalHistoryResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'VACCINATIONS' | 'DISEASES'>('VACCINATIONS');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Load villages and farmers for instant modal readiness
  useEffect(() => {
    let isMounted = true;
    const loadVillagesAndFarmers = async () => {
      try {
        const vList = await fwService.listAssignedVillages(apiBaseUrl);
        if (isMounted && vList.length > 0) {
          setVillages(vList);
          const saved = localStorage.getItem('fw_active_village_id');
          const valid = vList.some((v) => v.id === saved);
          const chosen = valid && saved ? saved : vList[0].id;
          setActiveVillageId(chosen);
          const fList = await fwService.listFarmers(apiBaseUrl, chosen);
          if (isMounted) setFarmers(fList);
        }
      } catch (e) {
        console.warn('Failed to preload villages/farmers in scan view:', e);
      }
    };
    loadVillagesAndFarmers();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  const loadHistory = async (animalId: string) => {
    setIsLoadingHistory(true);
    try {
      const hist = await fwService.getAnimalHistory(apiBaseUrl, animalId);
      setHistoryData(hist);
    } catch (e) {
      console.warn('Failed to load animal history:', e);
      setHistoryData(null);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStartingRef = useRef(false);

  // Stop Scanner
  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      try {
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error clearing qrCode:', e);
      }
      html5QrCodeRef.current = null;
    }
    setScannerStarted(false);
    setTorchOn(false);
  };

  // Start Scanner with Multi-Camera Fallback Support & Native Permission Prompt
  const startCamera = async (overrideCameraId?: string) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setErrorNotice(null);

    try {
      // 1. Stop any previous instance first
      await stopCamera();

      // 2. Ensure DOM element exists
      const qrElem = document.getElementById('qr-reader');
      if (!qrElem) {
        console.warn('DOM element #qr-reader not found');
        return;
      }

      if (!navigator?.mediaDevices && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setErrorNotice(
          'મોબાઇલ બ્રાઉઝરમાં કેમેરા શરૂ કરવા માટે HTTPS અથવા localhost જરૂરી છે. કૃપા કરીને બાજુમાં આપેલ "ઇમેજ અપલોડ" અથવા "QR કોડ" ટેબ વાપરો.'
        );
        setScannerStarted(false);
        return;
      }

      // 3. Proactively trigger browser permission dialog via getUserMedia
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          }).catch(async () => {
            // Fallback to default video constraint (e.g. laptop webcam)
            return await navigator.mediaDevices.getUserMedia({ video: true });
          });
          // Immediately stop test stream to release webcam for Html5Qrcode
          testStream.getTracks().forEach((t) => t.stop());
        } catch (mediaErr: any) {
          console.warn('getUserMedia permission check result:', mediaErr);
          if (
            mediaErr?.name === 'NotAllowedError' ||
            mediaErr?.name === 'PermissionDeniedError' ||
            mediaErr?.message?.includes('Permission')
          ) {
            throw mediaErr;
          }
        }
      }

      // 4. Create fresh Html5Qrcode instance supporting both 2D QR Code and 1D Barcodes
      const supportedFormats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
      ];
      const qrCode = new Html5Qrcode('qr-reader', {
        formatsToSupport: supportedFormats,
        verbose: false,
      });
      html5QrCodeRef.current = qrCode;

      // 5. Enumerate cameras
      let cameras: Array<{ id: string; label: string }> = [];
      try {
        cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
        }
      } catch (camErr) {
        console.warn('Could not enumerate cameras:', camErr);
      }

      const qrCodeSuccessCallback = async (decodedText: string) => {
        await handleQrScanned(decodedText);
      };

      const qrConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          if (cameraScanMode === 'BARCODE') {
            const w = Math.min(viewfinderWidth * 0.95, 360);
            const h = Math.min(viewfinderHeight * 0.45, 140);
            return { width: Math.floor(w), height: Math.floor(h) };
          }
          if (cameraScanMode === 'QR') {
            const size = Math.min(viewfinderWidth * 0.7, viewfinderHeight * 0.7, 240);
            return { width: Math.floor(size), height: Math.floor(size) };
          }
          const w = Math.min(viewfinderWidth * 0.9, 360);
          const h = Math.min(viewfinderHeight * 0.7, 240);
          return { width: Math.floor(w), height: Math.floor(h) };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      const targetCameraId = overrideCameraId || selectedCameraId;

      if (targetCameraId) {
        await qrCode.start(targetCameraId, qrConfig, qrCodeSuccessCallback, () => {});
      } else if (cameras.length > 0) {
        // Phone: prefer rear/back camera; Laptop/Desktop: use primary webcam
        const backCamera = cameras.find((c) => /back|rear|environment/i.test(c.label));
        const chosen = backCamera ? backCamera.id : cameras[0].id;
        setSelectedCameraId(chosen);
        await qrCode.start(chosen, qrConfig, qrCodeSuccessCallback, () => {});
      } else {
        // Fallback: try environment facingMode first, then user webcam
        try {
          await qrCode.start({ facingMode: 'environment' }, qrConfig, qrCodeSuccessCallback, () => {});
        } catch {
          await qrCode.start({ facingMode: 'user' }, qrConfig, qrCodeSuccessCallback, () => {});
        }
      }

      setScannerStarted(true);
    } catch (err: any) {
      console.warn('Failed to start camera scanner:', err);
      setScannerStarted(false);
      let msg = 'કેમેરા શરૂ કરવામાં નિષ્ફળ.';
      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.message?.includes('Permission') ||
        err?.message?.includes('denied')
      ) {
        msg =
          'બ્રાઉઝરમાં કેમેરા પરવાનગી (Permission) બ્લોક થયેલ છે. એડ્રેસ બારમાં કેમેરા/લોક આઇકોન પર ક્લિક કરી "Allow" કરો, અથવા નીચે "ઇમેજ અપલોડ" વાપરો.';
      } else if (
        err?.name === 'NotFoundError' ||
        err?.name === 'OverconstrainedError' ||
        err?.name === 'DevicesNotFoundError'
      ) {
        msg = 'કોઈ સુસંગત કેમેરા ઉપકરણ મળ્યું નથી. જો તમે લેપટોપ પર છો તો "ઇમેજ અપલોડ" અથવા "QR કોડ" ટેબ પસંદ કરો.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        msg = 'કેમેરા અન્ય વિન્ડો અથવા પ્રોગ્રામમાં ચાલુ છે. કૃપા કરીને અન્ય પ્રોગ્રામ બંધ કરીને ફરી પ્રયાસ કરો.';
      } else {
        msg = err?.message || 'કેમેરા શરૂ કરવામાં નિષ્ફળ. કૃપા કરીને કેમેરા પરવાનગી ચકાસો અથવા ઇમેજ અપલોડ વાપરો.';
      }
      setErrorNotice(msg);
    } finally {
      isStartingRef.current = false;
    }
  };

  // Auto-manage Camera based on active Tab
  useEffect(() => {
    if (activeTab === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [activeTab]);

  // Toggle Torch (Mobile Flash)
  const toggleTorch = async () => {
    if (html5QrCodeRef.current && scannerStarted) {
      try {
        const nextState = !torchOn;
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch not supported on this device/camera:', err);
      }
    }
  };

  // Scan from Uploaded File/Screenshot with Multi-Strategy Pipeline
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorNotice(null);
    setAnimalResult(null);

    let fileScanner: Html5Qrcode | null = null;
    try {
      // 1. Ensure camera is stopped
      await stopCamera();

      // 2. Ensure dedicated file scanner instance supporting both 1D Barcode & 2D QR
      const supportedFormats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
      ];
      fileScanner = new Html5Qrcode('qr-file-reader', {
        formatsToSupport: supportedFormats,
        verbose: false,
      });

      let detectedText: string | null = null;

      // Strategy 1: Check SVG text or embedded metadata if SVG file (QR or Barcode)
      const isSvg = file.name.toLowerCase().endsWith('.svg') || file.type.includes('svg');
      if (isSvg) {
        try {
          const svgContent = await file.text();
          const barcodeLabelMatch = svgContent.match(/aria-label=["']Barcode for ([^"']+)["']/i);
          const barcodeTextMatch = svgContent.match(/letter-spacing=["']2["'][^>]*>([^<]+)<\/text>/i);
          const dataTokenMatch = svgContent.match(/data-token=["']([^"']+)["']/i);
          const dataAnimalMatch = svgContent.match(/data-animal-code=["']([^"']+)["']/i);
          const tokenTextMatch = svgContent.match(/ટોકન:\s*([A-Z2-7]{26})/i);
          const codeMatch = svgContent.match(/ANM-[A-Z0-9]+-[0-9]+/i);
          const rawBase32 = svgContent.match(/[A-Z2-7]{26}/);

          if (barcodeLabelMatch && barcodeLabelMatch[1]) detectedText = barcodeLabelMatch[1].trim();
          else if (barcodeTextMatch && barcodeTextMatch[1]) detectedText = barcodeTextMatch[1].trim();
          else if (dataTokenMatch && dataTokenMatch[1]) detectedText = dataTokenMatch[1];
          else if (dataAnimalMatch && dataAnimalMatch[1]) detectedText = dataAnimalMatch[1];
          else if (tokenTextMatch && tokenTextMatch[1]) detectedText = tokenTextMatch[1];
          else if (codeMatch && codeMatch[0]) detectedText = codeMatch[0];
          else if (rawBase32 && rawBase32[0]) detectedText = rawBase32[0];
        } catch (svgErr) {
          console.warn('SVG text inspection error:', svgErr);
        }
      }

      // Strategy 2: Chromium / Android Native BarcodeDetector (high speed & accuracy for both QR & 1D barcodes)
      if (!detectedText && typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const BarcodeDetectorClass = (window as any).BarcodeDetector;
          const detector = new BarcodeDetectorClass({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
          });
          const imgBitmap = await createImageBitmap(file);
          const barcodes = await detector.detect(imgBitmap);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            detectedText = barcodes[0].rawValue;
            console.log('BarcodeDetector recognized code:', detectedText);
          }
        } catch (bdErr) {
          console.warn('BarcodeDetector pass skipped:', bdErr);
        }
      }

      // Strategy 3: Standard file scan using Html5Qrcode on dedicated container
      if (!detectedText) {
        try {
          detectedText = await fileScanner.scanFile(file, false);
          console.log('Html5Qrcode scanFile decoded:', detectedText);
        } catch (h5Err) {
          console.warn('Html5Qrcode scanFile pass failed:', h5Err);
        }
      }

      // Strategy 4: Offscreen Canvas with Quiet Zone Padding & Binarization
      if (!detectedText) {
        try {
          const img = new Image();
          const objUrl = URL.createObjectURL(file);
          const imgLoaded = new Promise<boolean>((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
          });
          img.src = objUrl;
          const ok = await imgLoaded;
          if (ok) {
            const targetDim = 600;
            // Quiet Zone padding (80px on each side) solves edge-touch detection failure
            const padding = 80;
            const innerDim = targetDim - padding * 2;

            const canvas = document.createElement('canvas');
            canvas.width = targetDim;
            canvas.height = targetDim;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (ctx) {
              // Pass 4A: Crisp white background + centered image with quiet zone
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, targetDim, targetDim);
              ctx.drawImage(img, padding, padding, innerDim, innerDim);

              // 1. Try BarcodeDetector on padded canvas (QR and 1D Barcode)
              if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
                try {
                  const BarcodeDetectorClass = (window as any).BarcodeDetector;
                  const detector = new BarcodeDetectorClass({
                    formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
                  });
                  const barcodes = await detector.detect(canvas);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    detectedText = barcodes[0].rawValue;
                  }
                } catch {
                  // Fall through
                }
              }

              // 2. Try fileScanner on padded canvas blob
              if (!detectedText) {
                try {
                  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
                  if (blob) {
                    const blobFile = new File([blob], 'padded_qr.png', { type: 'image/png' });
                    detectedText = await fileScanner.scanFile(blobFile, false);
                  }
                } catch {
                  // Fall through to binarized pass
                }
              }

              // Pass 4B: High-contrast binarization with white quiet zone
              if (!detectedText) {
                try {
                  const imgData = ctx.getImageData(0, 0, targetDim, targetDim);
                  const data = imgData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    const val = gray < 140 ? 0 : 255;
                    data[i] = val;
                    data[i + 1] = val;
                    data[i + 2] = val;
                  }
                  ctx.putImageData(imgData, 0, 0);

                  const binBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
                  if (binBlob) {
                    const binFile = new File([binBlob], 'binarized_qr.png', { type: 'image/png' });
                    detectedText = await fileScanner.scanFile(binFile, false);
                  }
                } catch {
                  // Fall through
                }
              }
            }
          }
          URL.revokeObjectURL(objUrl);
        } catch (canvasErr) {
          console.warn('Canvas rasterize pass skipped:', canvasErr);
        }
      }

      // Strategy 5: Filename identifier fallback (e.g. PASHU_QR_... or PASHU_BARCODE_...)
      if (!detectedText) {
        const barcodeFileMatch = file.name.match(/PASHU_BARCODE_([A-Za-z0-9\-_]+)/i);
        if (barcodeFileMatch && barcodeFileMatch[1]) {
          detectedText = barcodeFileMatch[1].replace(/\.(svg|png|jpg|jpeg)$/i, '');
        }
        const nameCodeMatch = file.name.match(/ANM-[A-Z0-9]+-[0-9]+/i);
        if (!detectedText && nameCodeMatch) {
          detectedText = nameCodeMatch[0].toUpperCase();
          console.log('Extracted animal code from filename fallback:', detectedText);
        }
      }

      if (detectedText) {
        await handleQrScanned(detectedText);
      } else {
        throw new Error('Could not decode QR or Barcode from image');
      }
    } catch (err: any) {
      console.warn('Image scan failed:', err);
      setErrorNotice(
        'ઇમેજમાંથી QR અથવા બારકોડ વાંચવામાં નિષ્ફળ. કૃપા કરીને સ્પષ્ટ ટેગ ધરાવતી ઇમેજ પસંદ કરો અથવા "ટેગ / બારકોડ" ટેબમાં નંબર લખો.'
      );
    } finally {
      if (fileScanner) {
        try {
          await fileScanner.clear();
        } catch {}
      }
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Universal Tag / QR / Barcode Lookup Pipeline
  const performUniversalLookup = async (tokenRaw: string) => {
    const cleanRaw = tokenRaw.trim();
    if (!cleanRaw) return;

    setIsLoading(true);
    setErrorNotice(null);
    setAnimalResult(null);
    setUnregisteredTag(null);
    setUnregisteredClassified(null);

    const classified = classifyScannedTag(cleanRaw);
    const candidate = classified.candidateTagValue || cleanRaw;

    try {
      // 1. Try universal lookup by candidate
      const animal = await fwService.universalLookup(apiBaseUrl, candidate);
      setAnimalResult(animal);
      loadHistory(animal.id);
    } catch {
      // 2. If candidate differed from raw scanned string, try raw string
      if (candidate !== cleanRaw) {
        try {
          const animal = await fwService.universalLookup(apiBaseUrl, cleanRaw);
          setAnimalResult(animal);
          loadHistory(animal.id);
          return;
        } catch {}
      }
      // Tag is NOT registered in PashuRakshak!
      setUnregisteredTag(candidate);
      setUnregisteredClassified(classified);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle scanned text
  const handleQrScanned = async (tokenRaw: string) => {
    await stopCamera();
    await performUniversalLookup(tokenRaw);
  };

  // Lookup by QR Token
  const performQrLookup = async (token: string) => {
    await performUniversalLookup(token);
  };

  // Lookup by Physical Ear Tag or Barcode
  const performTagLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagNumber.trim()) return;
    await performUniversalLookup(tagNumber.trim());
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-10 font-body text-[#172033]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button variant="outline" size="sm" onClick={() => navigate('/fw/home')} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
          હોમ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-[#135D43]" />
          QR & ટેગ સ્કેનર
        </h2>
        <div className="w-12" />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveTab('CAMERA')}
          className={`py-2 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'CAMERA' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          કેમેરા
        </button>
        <button
          onClick={() => setActiveTab('IMAGE_UPLOAD')}
          className={`py-2 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'IMAGE_UPLOAD' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          ઇમેજ અપલોડ
        </button>
        <button
          onClick={() => setActiveTab('MANUAL_QR')}
          className={`py-2 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'MANUAL_QR' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          QR કોડ
        </button>
        <button
          onClick={() => setActiveTab('TAG_LOOKUP')}
          className={`py-2 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'TAG_LOOKUP' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          ટેગ / બારકોડ
        </button>
      </div>

      {/* Unregistered Tag Notice with One-Click Registration Action */}
      {unregisteredTag && !isLoading && !animalResult && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div className="grow">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-amber-950">
                  આ ટેગ પશુરક્ષકમાં હજુ નોંધાયેલ નથી
                </h4>
                {unregisteredClassified && (
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-bold">
                    {unregisteredClassified.formatNameGu}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800 mt-1">
                સ્કેન કરેલ ટેગ નંબર:{' '}
                <span className="font-mono font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                  {unregisteredTag}
                </span>
              </p>
              <p className="text-xs text-amber-700 mt-1">
                ખેડૂતના પશુના કાનમાં લાગેલો આ ભૌતિક ટેગ સાચવી રાખીને તમે આ પશુને હમણાં જ નોંધી શકો છો. ટેગ બદલવાની જરૂર નથી.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-amber-200 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setUnregisteredTag(null);
                setUnregisteredClassified(null);
              }}
            >
              બંધ કરો
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRegisterModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              આ ટેગ સાથે નવું પશુ નોંધો
            </Button>
          </div>
        </div>
      )}

      {errorNotice && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorNotice}</div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => startCamera()} leftIcon={<RotateCcw className="w-3 h-3" />}>
              ફરી પ્રયાસ કરો
            </Button>
            {activeTab !== 'IMAGE_UPLOAD' && (
              <Button variant="primary" size="sm" onClick={() => setActiveTab('IMAGE_UPLOAD')} leftIcon={<Upload className="w-3 h-3" />}>
                ઇમેજ અપલોડથી સ્કેન કરો
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Offscreen permanent DOM element for background image scanning */}
      <div
        id="qr-file-reader"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 800,
          height: 800,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Permanent Scanner DOM container (always kept mounted so Html5Qrcode never loses DOM node) */}
      <div style={{ display: activeTab === 'CAMERA' ? 'block' : 'none' }}>
        <Card noPadding className="p-4 bg-black text-white rounded-2xl overflow-hidden relative">
          {/* Scanner Mode Selector: Universal, 1D Barcode, 2D QR */}
          <div className="mb-3 flex items-center justify-between text-xs bg-white/10 p-1.5 rounded-xl">
            <span className="text-white/80 text-[11px] font-semibold pl-1">સ્કેનર પ્રકાર:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setCameraScanMode('UNIVERSAL');
                  startCamera();
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  cameraScanMode === 'UNIVERSAL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                સાર્વત્રિક
              </button>
              <button
                type="button"
                onClick={() => {
                  setCameraScanMode('BARCODE');
                  startCamera();
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
                  cameraScanMode === 'BARCODE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <BarcodeIcon className="w-3 h-3" />
                ૧D બારકોડ
              </button>
              <button
                type="button"
                onClick={() => {
                  setCameraScanMode('QR');
                  startCamera();
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
                  cameraScanMode === 'QR'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <QrCode className="w-3 h-3" />
                QR કોડ
              </button>
            </div>
          </div>

          {/* Camera Device Switcher (if multiple cameras available) */}
          {availableCameras.length > 1 && (
            <div className="mb-3 flex items-center justify-between text-xs bg-white/10 p-2 rounded-lg">
              <span className="text-white/80 text-[11px]">કેમેરા પસંદ કરો:</span>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="bg-black/80 text-white text-xs px-2 py-1 rounded border border-white/20"
              >
                {availableCameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${cam.id.substring(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div id="qr-reader" className="w-full rounded-xl overflow-hidden min-h-[260px] bg-black" />

          <div className="mt-3 flex items-center justify-between text-xs text-white/80">
            <span>
              {cameraScanMode === 'BARCODE'
                ? 'પશુના કાન પરનો ૧D બારકોડ કેમેરા સામે રાખો'
                : cameraScanMode === 'QR'
                ? 'પશુના કાન પરનો QR કોડ કેમેરા સામે રાખો'
                : 'પશુના કાન પરનો QR કોડ અથવા ૧D બારકોડ કેમેરા સામે રાખો'}
            </span>
            <div className="flex items-center gap-2">
              {!scannerStarted && (
                <Button variant="primary" size="sm" onClick={() => startCamera()} leftIcon={<Play className="w-3.5 h-3.5" />}>
                  કેમેરા ચાલુ કરો
                </Button>
              )}
              {scannerStarted && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-lg border text-xs flex items-center gap-1 ${
                    torchOn ? 'bg-amber-400 text-black border-amber-300' : 'bg-white/10 border-white/20 text-white'
                  }`}
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  {torchOn ? 'ટોર્ચ ચાલુ' : 'ટોર્ચ'}
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Image Upload Scan Tab */}
      {activeTab === 'IMAGE_UPLOAD' && (
        <Card noPadding className="p-5 text-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#135D43]/30 hover:border-[#135D43] bg-emerald-50/40 rounded-2xl p-6 cursor-pointer transition-colors space-y-3"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-[#135D43] flex items-center justify-center">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#1E293B]">QR કોડનો ફોટો અથવા સ્ક્રીનશોટ અપલોડ કરો</h4>
              <p className="text-[11px] text-[#64748B] mt-1">
                મોબાઇલ ગેલેરી અથવા કમ્પ્યુટરમાંથી QR કોડ વાળી ઇમેજ પસંદ કરો
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              type="button"
              isLoading={isLoading}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              ઇમેજ પસંદ કરો
            </Button>
          </div>
        </Card>
      )}

      {/* Manual QR Token Tab */}
      {activeTab === 'MANUAL_QR' && (
        <Card noPadding className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performQrLookup(manualQrToken);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs font-semibold text-[#1E293B]">૨૬-અક્ષર Base32 QR ટોકન અથવા પશુ કોડ દાખલ કરો</label>
              <input
                type="text"
                value={manualQrToken}
                onChange={(e) => setManualQrToken(e.target.value.toUpperCase())}
                placeholder="દા.ત. ABCDEF234567... અથવા ANM-BOT-000004"
                className="w-full mt-1.5 px-3 py-2 text-xs border rounded-lg font-mono uppercase focus:ring-1 focus:ring-[#135D43]"
              />
            </div>
            <Button variant="primary" size="sm" type="submit" className="w-full" isLoading={isLoading} leftIcon={<Search className="w-3.5 h-3.5" />}>
              QR ટોકન શોધો
            </Button>
          </form>
        </Card>
      )}

      {/* Physical Ear Tag / Barcode Lookup Tab */}
      {activeTab === 'TAG_LOOKUP' && (
        <Card noPadding className="p-4">
          <form onSubmit={performTagLookup} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[#1E293B]">
                ભૌતિક કાન ટેગ અથવા ૧D બારકોડ નંબર
              </label>
              <input
                type="text"
                value={tagNumber}
                onChange={(e) => setTagNumber(e.target.value)}
                placeholder="દા.ત. 202412000005 અથવા 123456789100"
                className="w-full mt-1.5 px-3 py-2 text-xs border rounded-lg font-mono focus:ring-1 focus:ring-[#135D43]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                ટેગ પર છપાયેલો કોઈપણ આલ્ફાન્યૂમેરિક અથવા આંકડાકીય કોડ દાખલ કરો.
              </p>
            </div>
            <Button variant="primary" size="sm" type="submit" className="w-full" isLoading={isLoading} leftIcon={<Search className="w-3.5 h-3.5" />}>
              ટેગ / બારકોડ શોધો
            </Button>
          </form>
        </Card>
      )}

      {/* Animal Result Profile Card */}
      {isLoading ? (
        <StateView state="loading" message="પશુની માહિતી મેળવી રહ્યા છીએ..." />
      ) : animalResult ? (
        <Card noPadding className="p-4 bg-white border-2 border-emerald-500 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                પશુ પ્રોફાઇલ પ્રાપ્ત થઈ
              </span>
              <h3 className="text-base font-bold text-[#1E293B] font-mono mt-0.5">
                {animalResult.animal_code || animalResult.id.substring(0, 8)}
              </h3>
            </div>
            <StatusChip
              variant={animalResult.registration_status === 'VERIFIED' ? 'success' : 'warning'}
              label={animalResult.registration_status === 'VERIFIED' ? 'ચકાસાયેલ' : 'નોંધાયેલ'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-[#E2E8F0]">
            <div>
              <span className="text-[#64748B]">જાતિ / લિંગ:</span>
              <p className="font-semibold text-[#1E293B] mt-0.5">
                {SPECIES_NAMES_GU[animalResult.species_code] || animalResult.species_code} • {animalResult.sex === 'F' ? 'માદા' : animalResult.sex === 'M' ? 'નર' : 'અજ્ઞાત'}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">ઉંમર:</span>
              <p className="font-semibold text-[#1E293B] mt-0.5">
                {animalResult.age_months_estimate ? `${animalResult.age_months_estimate} માસ` : 'માહિતી નથી'}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">પશુપાલક (માલિક):</span>
              <p className="font-bold text-[#1E293B] mt-0.5">
                {(animalResult as any).farmer_name || animalResult.owner_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">ગામ:</span>
              <p className="font-semibold text-[#1E293B] mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#135D43]" />
                {(animalResult as any).village_name || animalResult.village_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">કાનનો ટેગ / બારકોડ:</span>
              <p className="font-bold text-[#1E293B] font-mono mt-0.5">
                {animalResult.bharat_pashudhan_tag || (animalResult as any).active_tag || 'ટેગ જોડાયેલ નથી'}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">સક્રિય QR ટોકન:</span>
              <p className="font-bold text-emerald-800 font-mono mt-0.5 break-all text-[11px]">
                {animalResult.active_qr_token || 'નથી'}
              </p>
            </div>
          </div>

          {/* Visual Digital Tag Card with Print & Download (QR and 1D Barcode) */}
          <div className="pt-2">
            <AnimalQrCard
              tagType="BOTH"
              barcodeValue={animalResult.bharat_pashudhan_tag || (animalResult as any).active_tag || animalResult.animal_code}
              token={animalResult.active_qr_token || animalResult.animal_code}
              animalCode={animalResult.animal_code}
              speciesCode={animalResult.species_code}
              sex={animalResult.sex}
              tagNumber={animalResult.bharat_pashudhan_tag || (animalResult as any).active_tag}
              farmerName={(animalResult as any).farmer_name || animalResult.owner_name}
              villageName={(animalResult as any).village_name || animalResult.village_name}
              showPrintActions={true}
            />
          </div>

          {/* Quick Field Actions */}
          <div className="pt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                navigate(
                  `/fw/reports/new?animal_id=${animalResult.id}&village_id=${animalResult.village_id || ''}&farmer_id=${(animalResult as any).farmer_id || ''}`,
                  { state: { preloadedAnimal: animalResult } }
                )
              }
              leftIcon={<FileText className="w-3.5 h-3.5" />}
            >
              રોગ અહેવાલ નોંધો
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(`/fw/vaccinations?animal_id=${animalResult.id}&village_id=${animalResult.village_id || ''}`, {
                  state: { preloadedAnimal: animalResult },
                })
              }
              leftIcon={<HeartPulse className="w-3.5 h-3.5" />}
            >
              રસીકરણ / સારવાર
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/fw/animals')}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              પશુ યાદી જુઓ
            </Button>
          </div>

          {/* Chronological Medical History (Vaccination & Disease Surveillance) */}
          <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setHistoryTab('VACCINATIONS')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                    historyTab === 'VACCINATIONS' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'
                  }`}
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  રસીકરણ ઇતિહાસ ({historyData?.total_vaccinations || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('DISEASES')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                    historyTab === 'DISEASES' ? 'bg-white text-[#135D43] shadow-xs' : 'text-[#64748B]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  રોગ દેખરેખ ઇતિહાસ ({historyData?.total_disease_reports || 0})
                </button>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="py-4 text-center text-xs text-[#64748B]">ઇતિહાસ લોડ થઈ રહ્યો છે...</div>
            ) : historyTab === 'VACCINATIONS' ? (
              !historyData || historyData.vaccinations.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-gray-50 text-xs text-[#64748B]">
                  આ પશુ માટે હજુ સુધી કોઈ રસીકરણ નોંધાયેલ નથી.
                </div>
              ) : (
                <div className="space-y-2">
                  {historyData.vaccinations.map((vax) => (
                    <div
                      key={vax.event_id}
                      className="p-3 rounded-xl border border-[#E2E8F0] bg-gray-50/60 hover:bg-emerald-50/30 transition-colors text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1E293B]">
                          {vax.programme_name_gu || vax.programme_code}
                        </span>
                        <StatusChip
                          variant="success"
                          label={vax.authorization_check === 'AUTHORIZED' ? 'અધિકૃત ચકાસાયેલ' : 'નોંધાયેલ'}
                          size="sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B]">
                        <div>
                          <span>તારીખ: </span>
                          <strong className="text-[#1E293B]">{vax.event_date}</strong>
                        </div>
                        {vax.batch_number && (
                          <div>
                            <span>બેચ: </span>
                            <span className="font-mono text-[#1E293B]">{vax.batch_number}</span>
                          </div>
                        )}
                        <div>
                          <span>રસીકરણકર્તા: </span>
                          <span className="text-[#1E293B]">{vax.administered_by_name || 'અધિકૃત સ્ટાફ'}</span>
                        </div>
                        {vax.campaign_name && (
                          <div>
                            <span>ઝુંબેશ: </span>
                            <span className="text-emerald-800 font-medium">{vax.campaign_name}</span>
                          </div>
                        )}
                        {vax.camp_code && (
                          <div>
                            <span>કેમ્પ: </span>
                            <span className="text-blue-800 font-mono font-medium">{vax.camp_code}</span>
                          </div>
                        )}
                      </div>
                      {vax.remarks && (
                        <p className="text-[10px] text-[#64748B] italic border-t border-[#E2E8F0] pt-1">
                          નોંધ: {vax.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              !historyData || historyData.disease_reports.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-gray-50 text-xs text-[#64748B]">
                  આ પશુ માટે કોઈ શંકાસ્પદ રોગ અહેવાલ નોંધાયેલ નથી.
                </div>
              ) : (
                <div className="space-y-2">
                  {historyData.disease_reports.map((rep) => {
                    const statusConfig = {
                      SUBMITTED: { label: 'નોંધાયેલ શંકાસ્પદ કેસ', variant: 'warning' as const },
                      SUSPECTED: { label: 'શંકાસ્પદ કેસ', variant: 'warning' as const },
                      UNDER_REVIEW: { label: 'સમીક્ષા હેઠળ', variant: 'default' as const },
                      CONFIRMED: { label: 'પુષ્ટિ થયેલ રોગ', variant: 'error' as const },
                      NOT_CONFIRMED: { label: 'રોગ અસ્વીકાર / નકારાત્મક', variant: 'default' as const },
                    }[rep.status] || { label: rep.status, variant: 'default' as const };

                    return (
                      <div
                        key={rep.report_id}
                        className="p-3 rounded-xl border border-[#E2E8F0] bg-gray-50/60 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1E293B]">
                            {rep.disease_name_gu || rep.disease_code}
                            {rep.report_no && (
                              <span className="text-[10px] font-mono font-normal text-[#64748B] ml-1.5">
                                ({rep.report_no})
                              </span>
                            )}
                          </span>
                          <StatusChip
                            variant={statusConfig.variant}
                            label={statusConfig.label}
                            size="sm"
                          />
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          <span>તારીખ: </span>
                          <strong className="text-[#1E293B]">{rep.report_date}</strong>
                          {rep.reported_by_name && (
                            <span className="ml-2">• નોંધનાર: {rep.reported_by_name}</span>
                          )}
                        </div>
                        {rep.symptoms && rep.symptoms.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {rep.symptoms.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {rep.observation_text && (
                          <p className="text-[11px] text-[#1E293B] bg-white p-2 rounded border border-[#E2E8F0]">
                            {rep.observation_text}
                          </p>
                        )}
                        {rep.confirmation_basis && (
                          <p className="text-[10px] text-emerald-800 bg-emerald-50/60 p-1.5 rounded">
                            VO ચકાસણી આધાર: {rep.confirmation_basis}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </Card>
      ) : null}

      {/* Universal Animal Registration Modal triggered from Unregistered Scanned Tag */}
      <UniversalAnimalRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        activeVillageId={activeVillageId}
        farmers={farmers}
        prefilledTag={unregisteredTag || undefined}
        onSuccess={async (newAnimal) => {
          setIsRegisterModalOpen(false);
          setUnregisteredTag(null);
          setUnregisteredClassified(null);
          if (newAnimal && newAnimal.id && !newAnimal.id.startsWith('offline-')) {
            try {
              const detail = await fwService.getAnimal(apiBaseUrl, newAnimal.id);
              setAnimalResult(detail);
              loadHistory(detail.id);
            } catch {
              try {
                const detail = await fwService.universalLookup(apiBaseUrl, newAnimal.animal_code || newAnimal.id);
                setAnimalResult(detail);
                loadHistory(detail.id);
              } catch (e) {
                console.warn('Failed to load animal profile card:', e);
              }
            }
          }
        }}
      />
    </div>
  );
};
