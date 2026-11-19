import React, { useState, useMemo, useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Maximize2,
  RotateCcw,
  MapPin,
  Activity,
  Syringe,
  Search,
  X,
  ExternalLink,
  Crosshair,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building,
  Radio,
  Phone,
} from 'lucide-react';
import type {
  VillageMapPoint,
  VillageSurveillanceMapItem,
  VillageVaccinationMapItem,
} from '../../services/mapService';
import type { LiveFieldWorkerItem } from '../../services/dutyService';
import { useAuth } from '../../context/AuthContext';
import { locationTrackingService } from '../../services/locationTrackingService';

export type MapLayerMode = 'VACCINATION' | 'SURVEILLANCE';
export type CoverageCategory = 'ALL' | 'HIGH' | 'MODERATE' | 'LOW' | 'NODATA';

export interface ProcessedVillageLocation {
  id: string;
  code: string;
  nameGu: string;
  nameEn: string;
  taluka: string;
  district: string;
  lat: number;
  lng: number;
  hasBoundary: boolean;
  boundaryGeojson?: any;
  totalAnimals: number;
  vaccinatedAnimals: number;
  pendingVaccinations: number;
  vaccinationPct: number;
  vacStatus: 'HIGH' | 'MODERATE' | 'LOW' | 'NODATA';
  vacColor: string;
  vacLabelGu: string;
  suspectedCases: number;
  confirmedCases: number;
  survStatus: 'CONFIRMED' | 'SUSPECTED' | 'NEUTRAL';
  survColor: string;
  assignedVoName?: string | null;
  formattedAddress?: string | null;
  googlePlaceId?: string | null;
}

export interface GoogleMapViewerProps {
  mappedVillages?: VillageMapPoint[];
  unmappedVillages?: VillageMapPoint[];
  surveillanceLayer?: Record<string, VillageSurveillanceMapItem>;
  vaccinationLayer?: Record<string, VillageVaccinationMapItem>;
  activeLayer?: MapLayerMode;
  onLayerChange?: (layer: MapLayerMode) => void;
  title?: string;
  subtitle?: string;
  roleScope?: 'DAHO' | 'VO' | 'FW';
  onVillageSelect?: (village: ProcessedVillageLocation) => void;
  className?: string;
  liveFieldWorkers?: LiveFieldWorkerItem[];
  showLiveFieldWorkers?: boolean;
  onFieldWorkerSelect?: (fw: LiveFieldWorkerItem) => void;
}

const BOTAD_CENTER = { lng: 71.6684, lat: 22.1704 };

// Standard Free OpenStreetMap Raster Tile Style Specification (Zero API Keys Required)
const FREE_OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const GoogleMapViewer: React.FC<GoogleMapViewerProps> = ({
  mappedVillages = [],
  unmappedVillages = [],
  surveillanceLayer = {},
  vaccinationLayer = {},
  activeLayer: externalActiveLayer,
  onLayerChange,
  title = 'બોટાદ જિલ્લો ભૌગોલિક નકશો (Botad District Geospatial Map)',
  subtitle = 'ઓપનસ્ટ્રીટમેપ જીઓ-ડેટા, રસીકરણ સિદ્ધિ દર અને રોગ સર્વેક્ષણ જીઓ-મોનિટરિંગ',
  roleScope: _roleScope = 'VO',
  onVillageSelect,
  className = '',
  liveFieldWorkers = [],
  showLiveFieldWorkers = true,
  onFieldWorkerSelect,
}) => {
  const { apiBaseUrl, session } = useAuth();
  const [internalLayer, setInternalLayer] = useState<MapLayerMode>('VACCINATION');
  const activeLayer = externalActiveLayer || internalLayer;

  const [selectedVillage, setSelectedVillage] = useState<ProcessedVillageLocation | null>(null);
  const [selectedFw, setSelectedFw] = useState<LiveFieldWorkerItem | null>(null);
  const [showFwLayer, setShowFwLayer] = useState<boolean>(showLiveFieldWorkers);
  const [selectedTaluka, setSelectedTaluka] = useState<string>('ALL');
  const [coverageFilter, setCoverageFilter] = useState<CoverageCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fullContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const fwMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);

  const handleLayerSwitch = (layer: MapLayerMode) => {
    setInternalLayer(layer);
    onLayerChange?.(layer);
  };

  // --------------------------------------------------------------------------
  // 1. Process Villages with Verified Coordinates & Real Application Metrics
  // --------------------------------------------------------------------------
  const processedVillages: ProcessedVillageLocation[] = useMemo(() => {
    const combined = [...mappedVillages];

    return combined
      .filter((v) => v.latitude !== undefined && v.latitude !== null && v.longitude !== undefined && v.longitude !== null)
      .map((v) => {
        const vId = v.villageId;
        const vacData = vaccinationLayer[vId];
        const survData = surveillanceLayer[vId];

        const totalAnimals = vacData?.totalRegisteredAnimals || 0;
        const vaccinatedAnimals = vacData?.totalVaccinatedCount || 0;
        const pendingVaccinations = vacData?.pendingVaccinations || Math.max(0, totalAnimals - vaccinatedAnimals);
        const vaccinationPct =
          totalAnimals > 0
            ? Math.round((vaccinatedAnimals / totalAnimals) * 100)
            : vacData?.coveragePercentage || 0;

        let vacStatus: 'HIGH' | 'MODERATE' | 'LOW' | 'NODATA' = 'NODATA';
        let vacColor = '#94A3B8'; // Slate
        let vacLabelGu = 'ડેટા ઉપલબ્ધ નથી';

        if (totalAnimals > 0) {
          if (vaccinationPct >= 80) {
            vacStatus = 'HIGH';
            vacColor = '#135D43'; // Forest Green
            vacLabelGu = 'ઉચ્ચ કવરેજ (≥૮૦%)';
          } else if (vaccinationPct >= 50) {
            vacStatus = 'MODERATE';
            vacColor = '#D97706'; // Amber
            vacLabelGu = 'મધ્યમ કવરેજ (૫૦-૭૯%)';
          } else {
            vacStatus = 'LOW';
            vacColor = '#DC2626'; // Red
            vacLabelGu = 'ઓછું કવરેજ (<૫૦%)';
          }
        }

        const suspectedCases = survData?.suspectedCount || 0;
        const confirmedCases = survData?.confirmedCount || 0;
        let survStatus: 'CONFIRMED' | 'SUSPECTED' | 'NEUTRAL' = 'NEUTRAL';
        let survColor = '#135D43';

        if (confirmedCases > 0) {
          survStatus = 'CONFIRMED';
          survColor = '#DC2626'; // Outbreak Alert
        } else if (suspectedCases > 0) {
          survStatus = 'SUSPECTED';
          survColor = '#F59E0B'; // Amber Suspicion
        }

        return {
          id: v.villageId,
          code: v.code,
          nameGu: v.nameGu,
          nameEn: v.nameEn,
          taluka: v.talukaNameGu || 'બોટાદ',
          district: v.districtNameGu || 'બોટાદ',
          lat: Number(v.latitude),
          lng: Number(v.longitude),
          hasBoundary: false,
          totalAnimals,
          vaccinatedAnimals,
          pendingVaccinations,
          vaccinationPct,
          vacStatus,
          vacColor,
          vacLabelGu,
          suspectedCases,
          confirmedCases,
          survStatus,
          survColor,
          assignedVoName: v.assignedVoName,
          formattedAddress: v.formattedAddress,
          googlePlaceId: v.googlePlaceId,
        };
      });
  }, [mappedVillages, vaccinationLayer, surveillanceLayer]);

  // Unique taluka list for filtering
  const talukaList = useMemo(() => {
    const set = new Set<string>();
    processedVillages.forEach((v) => {
      if (v.taluka) set.add(v.taluka);
    });
    return Array.from(set);
  }, [processedVillages]);

  // Filtered villages based on Taluka, Coverage Category, and Search Query
  const filteredVillages = useMemo(() => {
    return processedVillages.filter((v) => {
      if (selectedTaluka !== 'ALL' && v.taluka !== selectedTaluka) return false;
      if (coverageFilter !== 'ALL' && v.vacStatus !== coverageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNameGu = v.nameGu.toLowerCase().includes(q);
        const matchesNameEn = v.nameEn.toLowerCase().includes(q);
        const matchesCode = v.code.toLowerCase().includes(q);
        if (!matchesNameGu && !matchesNameEn && !matchesCode) return false;
      }
      return true;
    });
  }, [processedVillages, selectedTaluka, coverageFilter, searchQuery]);

  // --------------------------------------------------------------------------
  // 2. Initialize Free MapLibre GL Map
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: FREE_OSM_STYLE,
        center: [BOTAD_CENTER.lng, BOTAD_CENTER.lat],
        zoom: 10.5,
        attributionControl: false,
      });

      // Add Attribution Control
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '© OpenStreetMap contributors | PashuRakshak Botad',
        }),
        'bottom-right'
      );

      // Add Zoom & Compass Controls
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        'top-right'
      );

      mapInstanceRef.current = map;

      map.on('load', () => {
        map.resize();
      });
    } catch (err) {
      console.warn('MapLibre GL Map initialization note:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // 3. Render Village Markers on Map Canvas
  // --------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Render Markers for each filtered village
    filteredVillages.forEach((village) => {
      const isSurv = activeLayer === 'SURVEILLANCE';
      const markerColor = isSurv ? village.survColor : village.vacColor;
      const isSelected = selectedVillage?.id === village.id;

      // Custom Pin DOM element
      const el = document.createElement('div');
      el.className = 'custom-map-marker transition-transform duration-150 cursor-pointer';
      el.style.width = isSelected ? '34px' : '26px';
      el.style.height = isSelected ? '34px' : '26px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = markerColor;
      el.style.border = isSelected ? '3px solid #FFFFFF' : '2px solid #FFFFFF';
      el.style.boxShadow = isSelected
        ? '0 0 0 3px ' + markerColor + ', 0 6px 12px rgba(0,0,0,0.35)'
        : '0 2px 6px rgba(0,0,0,0.25)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#FFFFFF';
      el.style.fontWeight = 'bold';
      el.style.fontSize = isSelected ? '11px' : '9px';
      el.style.fontFamily = 'Inter, sans-serif';

      if (isSurv) {
        if (village.survStatus === 'CONFIRMED') {
          el.innerHTML = '!';
        } else if (village.survStatus === 'SUSPECTED') {
          el.innerHTML = '?';
        } else {
          el.innerHTML = '✓';
        }
      } else {
        el.innerHTML = village.totalAnimals > 0 ? `${village.vaccinationPct}%` : '—';
      }

      // Popup
      const popupContent = `
        <div style="font-family: Inter, sans-serif; padding: 4px 6px; font-size: 11px;">
          <div style="font-weight: bold; font-size: 13px; color: #0F172A; margin-bottom: 2px;">
            ${village.nameGu} (${village.nameEn})
          </div>
          <div style="color: #64748B; font-size: 10px; margin-bottom: 4px;">
            ${village.taluka} તાલુકો • કોડ: ${village.code}
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #E2E8F0;">
            <span style="color: #475569;">${isSurv ? 'શંકાસ્પદ કેસ:' : 'કવરેજ:'}</span>
            <span style="font-weight: bold; color: ${markerColor};">
              ${isSurv ? village.suspectedCases + ' કેસ' : village.vaccinationPct + '%'}
            </span>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(popupContent);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([village.lng, village.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        setSelectedVillage(village);
        onVillageSelect?.(village);
        map.flyTo({
          center: [village.lng, village.lat],
          zoom: Math.max(map.getZoom(), 12.5),
          speed: 1.2,
        });
      });

      markersRef.current.push(marker);
    });

    // Auto fit bounds ONCE upon initial village data load (avoids map jumping on subsequent updates)
    if (filteredVillages.length > 0 && !hasFittedBoundsRef.current) {
      hasFittedBoundsRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      filteredVillages.forEach((v) => bounds.extend([v.lng, v.lat]));
      try {
        map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 600 });
      } catch {
        // bounds fit fallback
      }
    }
  }, [filteredVillages, activeLayer, selectedVillage, onVillageSelect]);

  // --------------------------------------------------------------------------
  // 3.1 Render Live Field Worker Pins & Radar Pulses
  // --------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing FW markers
    fwMarkersRef.current.forEach((m) => m.remove());
    fwMarkersRef.current = [];

    if (!showFwLayer || !liveFieldWorkers || liveFieldWorkers.length === 0) {
      return;
    }

    liveFieldWorkers.forEach((fw) => {
      if (
        fw.last_known_latitude === undefined ||
        fw.last_known_latitude === null ||
        fw.last_known_longitude === undefined ||
        fw.last_known_longitude === null
      ) {
        return;
      }

      const isActive = fw.duty_status === 'ACTIVE';
      const isFresh = fw.freshness === 'FRESH';
      const isStale = fw.freshness === 'STALE';
      const isSelected = selectedFw?.fw_user_id === fw.fw_user_id;

      // Color coding:
      // Green = Active & Fresh (<15 min)
      // Yellow = Active & Stale (>15 min)
      // Orange = Active & GPS Unavailable
      // Grey = Inactive (Duty Ended)
      let pinColor = '#94A3B8'; // Inactive Grey
      let badgeLabelGu = 'ડ્યૂટી બંધ';
      if (isActive) {
        if (isFresh) {
          pinColor = '#10B981'; // Fresh Green
          badgeLabelGu = 'સક્રિય • તાજું (<૧૫ મિ.)';
        } else if (isStale) {
          pinColor = '#F59E0B'; // Stale Yellow
          badgeLabelGu = 'સક્રિય • જૂનું લોકેશન (>૧૫ મિ.)';
        } else {
          pinColor = '#F97316'; // GPS Unavailable Orange
          badgeLabelGu = 'GPS અનુપલબ્ધ';
        }
      }

      const el = document.createElement('div');
      el.className = 'live-fw-map-marker cursor-pointer transition-all duration-200';
      el.style.width = isSelected ? '38px' : '30px';
      el.style.height = isSelected ? '38px' : '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = pinColor;
      el.style.border = isSelected ? '3px solid #FFFFFF' : '2px solid #FFFFFF';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#FFFFFF';
      el.style.fontWeight = 'bold';
      el.style.fontSize = isSelected ? '13px' : '11px';
      el.style.fontFamily = 'Inter, sans-serif';
      el.style.position = 'relative';

      // Pulse ring for Fresh Active FWs
      if (isActive && isFresh) {
        el.style.boxShadow = isSelected
          ? '0 0 0 5px rgba(16, 185, 129, 0.45), 0 8px 16px rgba(0,0,0,0.35)'
          : '0 0 0 4px rgba(16, 185, 129, 0.35), 0 4px 8px rgba(0,0,0,0.2)';
      } else {
        el.style.boxShadow = isSelected
          ? `0 0 0 4px ${pinColor}80, 0 8px 16px rgba(0,0,0,0.3)`
          : '0 2px 6px rgba(0,0,0,0.25)';
      }

      // Initial letter of FW Name
      const initial = fw.full_name ? fw.full_name.trim().charAt(0) : 'F';
      el.innerHTML = `<span style="text-shadow: 0 1px 2px rgba(0,0,0,0.4);">${initial}</span>`;

      // Interactive popup
      const updateTime = fw.last_location_update
        ? new Date(fw.last_location_update).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })
        : 'અજ્ઞાત';

      const popupHtml = `
        <div style="font-family: Inter, sans-serif; padding: 6px 8px; font-size: 11px; min-width: 170px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
            <strong style="font-size: 12px; color: #0F172A;">${fw.full_name}</strong>
            <span style="font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 4px; background: ${pinColor}20; color: ${pinColor}; border: 1px solid ${pinColor}50;">
              ${badgeLabelGu}
            </span>
          </div>
          <div style="color: #64748B; font-size: 10px; margin-bottom: 4px;">
            ${fw.designation || 'ક્ષેત્રીય કાર્યકર (FW)'} ${fw.mobile_e164 ? '• ' + fw.mobile_e164 : ''}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; padding: 3px 0; border-top: 1px solid #E2E8F0; color: #475569;">
            <span>છેલ્લું અપડેટ:</span>
            <span style="font-weight: bold; color: #0F172A;">${updateTime}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; padding: 3px 0; border-top: 1px solid #F1F5F9; color: #475569;">
            <span>સક્રિય સોંપણી:</span>
            <span style="font-weight: bold; color: #0F172A;">${fw.active_assignments_count} જૂથ (${fw.pending_complaints_count} કેસ)</span>
          </div>
          ${fw.assigned_villages_gu && fw.assigned_villages_gu.length > 0 ? `
            <div style="font-size: 10px; padding-top: 3px; border-top: 1px solid #F1F5F9; color: #64748B;">
              ગામ: <strong style="color: #0F172A;">${fw.assigned_villages_gu.join(', ')}</strong>
            </div>
          ` : ''}
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fw.last_known_longitude, fw.last_known_latitude])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        setSelectedFw(fw);
        setSelectedVillage(null);
        onFieldWorkerSelect?.(fw);
        map.flyTo({
          center: [fw.last_known_longitude!, fw.last_known_latitude!],
          zoom: Math.max(map.getZoom(), 13),
          speed: 1.2,
        });
      });

      fwMarkersRef.current.push(marker);
    });
  }, [liveFieldWorkers, showFwLayer, selectedFw, onFieldWorkerSelect]);

  // --------------------------------------------------------------------------
  // 4. HTML5 Browser Geolocation (Locate Me)
  // --------------------------------------------------------------------------
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('તમારા બ્રાઉઝરમાં જીઓ-લોકેશન સપોર્ટેડ નથી.');
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const { latitude, longitude } = pos.coords;

        const map = mapInstanceRef.current;
        if (!map) return;

        // User Marker
        if (userMarkerRef.current) userMarkerRef.current.remove();

        const uEl = document.createElement('div');
        uEl.className = 'user-pin-marker';
        uEl.style.width = '18px';
        uEl.style.height = '18px';
        uEl.style.borderRadius = '50%';
        uEl.style.backgroundColor = '#0284C7';
        uEl.style.border = '3px solid #FFFFFF';
        uEl.style.boxShadow = '0 0 0 5px rgba(2, 132, 199, 0.35)';

        const uMarker = new maplibregl.Marker({ element: uEl })
          .setLngLat([longitude, latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              '<div style="font-size:11px; font-weight:bold; color:#0284C7;">તમારું વર્તમાન સ્થાન (Current Location)</div>'
            )
          )
          .addTo(map);

        userMarkerRef.current = uMarker;

        // If the current user is a Field Worker, broadcast live coordinates to the server immediately
        const userRole = session?.user?.role;
        if (userRole === 'FIELD_WORKER' || userRole === 'FW') {
          locationTrackingService
            .broadcastLocation(apiBaseUrl, {
              latitude,
              longitude,
              accuracy: pos.coords.accuracy || 10,
            })
            .catch((err) => console.warn('Live location broadcast error:', err));
        }

        map.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          speed: 1.5,
        });
      },
      (err) => {
        setIsLocatingUser(false);
        alert(`સ્થાન મેળવી શકાયું નથી: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleResetView = () => {
    setSelectedVillage(null);
    setSelectedFw(null);
    setSelectedTaluka('ALL');
    setCoverageFilter('ALL');
    setSearchQuery('');
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({
        center: [BOTAD_CENTER.lng, BOTAD_CENTER.lat],
        zoom: 10.5,
        bearing: 0,
        pitch: 0,
      });
    }
  };

  const toggleFullscreen = () => {
    if (!fullContainerRef.current) return;
    if (!isFullscreen) {
      if (fullContainerRef.current.requestFullscreen) {
        fullContainerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={fullContainerRef}
      className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col ${className}`}
      style={{ minHeight: isFullscreen ? '100vh' : '650px' }}
    >
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Toolbar & Control Bar                                      */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-3.5 sm:p-4 bg-white border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#135D43] flex items-center justify-center border border-emerald-200/60 shadow-2xs">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] font-heading">
                {title}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                OpenStreetMap Free
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Layer Mode Switcher & FW Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="flex bg-[#F1F5FC] p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => handleLayerSwitch('VACCINATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeLayer === 'VACCINATION'
                  ? 'bg-white text-[#135D43] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Syringe className="w-3.5 h-3.5" />
              <span>રસીકરણ કવરેજ</span>
            </button>
            <button
              onClick={() => handleLayerSwitch('SURVEILLANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeLayer === 'SURVEILLANCE'
                  ? 'bg-white text-red-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>રોગ સર્વેક્ષણ</span>
            </button>
          </div>

          {liveFieldWorkers && liveFieldWorkers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFwLayer(!showFwLayer)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showFwLayer
                  ? 'bg-[#176B5B] text-white shadow-xs'
                  : 'bg-[#F1F5FC] text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${showFwLayer ? 'animate-pulse text-white' : 'text-slate-500'}`} />
              <span>ફિલ્ડ વર્કર્સ ({liveFieldWorkers.filter((f) => f.duty_status === 'ACTIVE').length} લાઇવ)</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
            title="પૂર્ણ સ્ક્રીન (Fullscreen)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Interactive Filtering & Search Ribbon                             */}
      {/* -------------------------------------------------------------------- */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Taluka Filter */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedTaluka}
              onChange={(e) => setSelectedTaluka(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none text-xs cursor-pointer"
            >
              <option value="ALL">બધા તાલુકા ({talukaList.length})</option>
              {talukaList.map((t) => (
                <option key={t} value={t}>
                  {t} તાલુકો
                </option>
              ))}
            </select>
          </div>

          {/* Coverage Status Filter */}
          {activeLayer === 'VACCINATION' && (
            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={coverageFilter}
                onChange={(e) => setCoverageFilter(e.target.value as CoverageCategory)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs cursor-pointer"
              >
                <option value="ALL">બધા કવરેજ દર</option>
                <option value="HIGH">ઉચ્ચ કવરેજ (≥૮૦%)</option>
                <option value="MODERATE">મધ્યમ (૫૦-૭૯%)</option>
                <option value="LOW">{'ઓછું (<૫૦%)'}</option>
                <option value="NODATA">ડેટા અનુપલબ્ધ</option>
              </select>
            </div>
          )}

          {/* Village Quick Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ગામ નામ અથવા કોડ શોધો..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#176B5B]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Locate Me & Reset View Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLocateUser}
            disabled={isLocatingUser}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-[#135D43] hover:border-[#135D43]/40 font-semibold shadow-2xs transition-all disabled:opacity-50"
            title="મારી વર્તમાન સ્થિતિ મેળવો"
          >
            <Crosshair className={`w-3.5 h-3.5 text-[#0284C7] ${isLocatingUser ? 'animate-spin' : ''}`} />
            <span>વર્તમાન સ્થાન</span>
          </button>

          <button
            onClick={handleResetView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs transition-colors"
            title="નકશો રીસેટ કરો"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>રીસેટ</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Main Map Canvas + Right Side Detail Drawer                        */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative flex-1 w-full overflow-hidden min-h-[480px]">
        {/* MapLibre GL Canvas Container */}
        <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />

        {/* Legend Overlay (Floating Bottom-Left) */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-md max-w-[240px] z-10 pointer-events-auto text-xs space-y-2">
          <div className="font-bold text-slate-800 flex items-center justify-between border-b border-slate-100 pb-1">
            <span>{activeLayer === 'VACCINATION' ? 'રસીકરણ સંકેતો' : 'સર્વેક્ષણ સંકેતો'}</span>
            <span className="text-[10px] text-slate-500 font-normal">
              {filteredVillages.length} ગામ
            </span>
          </div>

          {activeLayer === 'VACCINATION' ? (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#135D43] border border-white shadow-2xs inline-block" />
                <span className="text-slate-700 font-medium">સંતોષકારક (≥૮૦%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#D97706] border border-white shadow-2xs inline-block" />
                <span className="text-slate-700 font-medium">મધ્યમ પ્રગતિ (૫૦-૭૯%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#DC2626] border border-white shadow-2xs inline-block" />
                <span className="text-slate-700 font-medium">{'ધ્યાન જરૂરી (<૫૦%)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#94A3B8] border border-white shadow-2xs inline-block" />
                <span className="text-slate-500">ડેટા અનુપલબ્ધ</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#DC2626] border border-white shadow-2xs inline-block text-white text-[8px] text-center font-bold">!</span>
                <span className="text-slate-700 font-bold text-red-600">રોગચાળો પુષ્ટિ (Confirmed)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] border border-white shadow-2xs inline-block text-white text-[8px] text-center font-bold">?</span>
                <span className="text-slate-700 font-medium text-amber-600">શંકાસ્પદ કેસ (Suspected)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#135D43] border border-white shadow-2xs inline-block text-white text-[8px] text-center font-bold">✓</span>
                <span className="text-slate-600">કોઈ રોગ રિપોર્ટ નથી</span>
              </div>
            </div>
          )}
        </div>

        {/* Selected Village Slide-in Details Drawer */}
        {selectedVillage && (
          <div className="absolute top-3 right-3 w-80 sm:w-96 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl z-20 overflow-hidden animate-fade-in pointer-events-auto">
            {/* Drawer Header */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-50/60 to-white border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      activeLayer === 'SURVEILLANCE'
                        ? selectedVillage.survColor
                        : selectedVillage.vacColor,
                  }}
                />
                <div>
                  <h4 className="font-bold text-sm text-[#0F172A] font-heading">
                    {selectedVillage.nameGu}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedVillage.nameEn} • {selectedVillage.code}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVillage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 space-y-3.5 text-xs">
              {/* Location & VO Badge */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">તાલુકો / જિલ્લો</span>
                  <span className="font-bold text-slate-800">
                    {selectedVillage.taluka}, {selectedVillage.district}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">અધિકૃત વેટરનરી ઓફિસર</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {selectedVillage.assignedVoName || 'સોંપણી બાકી'}
                  </span>
                </div>
              </div>

              {/* Vaccination Progress Card */}
              <div className="p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Syringe className="w-4 h-4 text-[#135D43]" />
                    <span>રસીકરણ સિદ્ધિ દર</span>
                  </div>
                  <span
                    className="font-bold text-sm"
                    style={{ color: selectedVillage.vacColor }}
                  >
                    {selectedVillage.vaccinationPct}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, selectedVillage.vaccinationPct)}%`,
                      backgroundColor: selectedVillage.vacColor,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[10px]">
                  <div className="bg-slate-50 p-1.5 rounded-lg">
                    <span className="text-slate-400 block">કુલ પશુ</span>
                    <span className="font-bold text-slate-800">{selectedVillage.totalAnimals}</span>
                  </div>
                  <div className="bg-emerald-50/50 p-1.5 rounded-lg">
                    <span className="text-emerald-700 block">રસીકરણ થયેલ</span>
                    <span className="font-bold text-emerald-800">{selectedVillage.vaccinatedAnimals}</span>
                  </div>
                  <div className="bg-amber-50/50 p-1.5 rounded-lg">
                    <span className="text-amber-700 block">બાકી પશુ</span>
                    <span className="font-bold text-amber-800">{selectedVillage.pendingVaccinations}</span>
                  </div>
                </div>
              </div>

              {/* Disease Surveillance Status */}
              <div className="p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Activity className="w-4 h-4 text-red-600" />
                    <span>રોગ સર્વેક્ષણ સ્થિતિ</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {selectedVillage.confirmedCases > 0
                      ? 'સક્રિય રોગચાળો'
                      : selectedVillage.suspectedCases > 0
                      ? 'શંકાસ્પદ કેસ'
                      : 'શાંતિપૂર્ણ'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                  <div className="p-2 rounded-lg bg-red-50 text-red-700 font-bold">
                    <span className="block text-[10px] text-red-500 font-normal">પુષ્ટિ થયેલ કેસ</span>
                    {selectedVillage.confirmedCases}
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-700 font-bold">
                    <span className="block text-[10px] text-amber-500 font-normal">શંકાસ્પદ કેસ</span>
                    {selectedVillage.suspectedCases}
                  </div>
                </div>
              </div>

              {/* Coordinates & External Google Maps Navigation Destination */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="font-mono">
                  GPS: {selectedVillage.lat.toFixed(5)}, {selectedVillage.lng.toFixed(5)}
                </span>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedVillage.lat},${selectedVillage.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#0284C7] hover:underline font-semibold"
                  title="બાહ્ય Google Maps માં દિશા નિર્દેશ જુઓ"
                >
                  <span>નેવિગેશન</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Selected Field Worker Slide-in Details Drawer */}
        {selectedFw && (
          <div className="absolute top-3 right-3 w-80 sm:w-96 bg-white/98 backdrop-blur-md rounded-2xl border border-teal-200 shadow-2xl z-20 overflow-hidden animate-fade-in pointer-events-auto">
            {/* Drawer Header */}
            <div className="p-3.5 bg-gradient-to-r from-teal-50 to-white border-b border-teal-100 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#176B5B] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {selectedFw.full_name ? selectedFw.full_name.charAt(0) : 'F'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0F172A] font-heading">
                    {selectedFw.full_name}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-medium">
                      {selectedFw.designation || 'ક્ષેત્રીય કાર્યકર (FW)'}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                        selectedFw.duty_status === 'ACTIVE'
                          ? selectedFw.freshness === 'FRESH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {selectedFw.duty_status === 'ACTIVE'
                        ? selectedFw.freshness === 'FRESH'
                          ? '● ડ્યૂટી સક્રિય (તાજું)'
                          : '● ડ્યૂટી સક્રિય (જૂનું)'
                        : '○ ડ્યૂટી બંધ'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFw(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 space-y-3.5 text-xs">
              {/* Contact Card */}
              {selectedFw.mobile_e164 && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#176B5B]" />
                    <span className="font-mono font-bold text-slate-800">{selectedFw.mobile_e164}</span>
                  </div>
                  <a
                    href={`tel:${selectedFw.mobile_e164}`}
                    className="px-2.5 py-1 rounded-lg bg-[#176B5B] text-white text-[10px] font-bold hover:bg-[#164E45]"
                  >
                    કૉલ કરો
                  </a>
                </div>
              )}

              {/* Workload Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">સક્રિય જૂથ</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">
                    {selectedFw.active_assignments_count}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">બાકી કેસ</span>
                  <span className="font-bold text-amber-700 text-sm font-mono">
                    {selectedFw.pending_complaints_count}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">સોંપાયેલ ગામ</span>
                  <span className="font-bold text-teal-800 text-sm font-mono">
                    {selectedFw.assigned_villages_count}
                  </span>
                </div>
              </div>

              {/* Assigned Villages List */}
              {selectedFw.assigned_villages_gu && selectedFw.assigned_villages_gu.length > 0 && (
                <div className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    અધિકૃત ગામડાઓ:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedFw.assigned_villages_gu.map((v, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[10px] font-semibold border border-teal-200"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* GPS Meta Info */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                <div className="flex justify-between">
                  <span>છેલ્લું GPS અપડેટ:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedFw.last_location_update
                      ? new Date(selectedFw.last_location_update).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })
                      : 'અજ્ઞાત'}
                  </span>
                </div>
                {selectedFw.last_known_latitude && selectedFw.last_known_longitude && (
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px]">
                      GPS: {selectedFw.last_known_latitude.toFixed(4)}, {selectedFw.last_known_longitude.toFixed(4)}
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedFw.last_known_latitude},${selectedFw.last_known_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#176B5B] hover:underline font-semibold text-[10px]"
                    >
                      <span>નેવિગેશન</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Bottom Information & Unmapped Villages Summary Drawer             */}
      {/* -------------------------------------------------------------------- */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#135D43]" />
            <span>ચકાસાયેલ ગામો: {mappedVillages.length}</span>
          </div>

          {unmappedVillages.length > 0 && (
            <div className="flex items-center gap-1 text-amber-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>GPS બાકી ગામો: {unmappedVillages.length}</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          સત્તાવાર જિલ્લા પશુપાલન માહિતી પ્રણાલી • બોટાદ
        </div>
      </div>
    </div>
  );
};

export const MapViewer = GoogleMapViewer;
export default GoogleMapViewer;
