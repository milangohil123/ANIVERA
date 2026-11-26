import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  RotateCcw,
  Search,
  MapPin,
  Edit3,
  Save,
  X,
  ChevronRight,
  Globe,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { adminService } from '../../services/adminService';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { StatusChip } from '../common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';

const GUJARAT_CENTER = { lng: 71.55, lat: 22.35 };

const FREE_OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors | PashuRakshak',
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

function getGeometryCentroid(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;
  let totalLng = 0, totalLat = 0, count = 0;
  const extract = (c: any) => {
    if (typeof c[0] === 'number') {
      totalLng += c[0];
      totalLat += c[1];
      count++;
    } else {
      c.forEach(extract);
    }
  };
  extract(geometry.coordinates);
  if (count > 0) {
    return [totalLng / count, totalLat / count];
  }
  return null;
}

function getGeometryBounds(geometry: any): maplibregl.LngLatBoundsLike | null {
  if (!geometry || !geometry.coordinates) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const extractCoords = (c: any) => {
    if (typeof c[0] === 'number') {
      const [lng, lat] = c;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else {
      c.forEach(extractCoords);
    }
  };
  extractCoords(geometry.coordinates);
  if (minLng !== Infinity && maxLng !== -Infinity) {
    return [[minLng, minLat], [maxLng, maxLat]];
  }
  return null;
}

function getFeatureCollectionBounds(fc: any): maplibregl.LngLatBoundsLike | null {
  if (!fc || !fc.features || fc.features.length === 0) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const extractCoords = (c: any) => {
    if (typeof c[0] === 'number') {
      const [lng, lat] = c;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else {
      c.forEach(extractCoords);
    }
  };
  fc.features.forEach((f: any) => {
    if (f.geometry && f.geometry.coordinates) {
      extractCoords(f.geometry.coordinates);
    }
  });
  if (minLng !== Infinity && maxLng !== -Infinity) {
    return [[minLng, minLat], [maxLng, maxLat]];
  }
  return null;
}

export interface GujaratStateMapProps {
  geoJsonData?: any;
  selectedDistrictId?: string;
  selectedDistrictProps?: any;
  onDistrictSelect?: (districtProps: any) => void;
  onDistrictHover?: (districtProps: any | null) => void;
  selectedTalukaId?: string;
  selectedTalukaProps?: any;
  onTalukaSelect?: (talukaProps: any) => void;
  selectedVillageId?: string;
  selectedVillageProps?: any;
  onVillageSelect?: (villageProps: any) => void;
  viewLevel?: 'DISTRICT' | 'TALUKA' | 'VILLAGE';
  onViewLevelChange?: (level: 'DISTRICT' | 'TALUKA' | 'VILLAGE') => void;
  talukasGeoJson?: any;
  villagesGeoJson?: any;
  isLoadingSubLayer?: boolean;
  enableDrawingMode?: boolean;
  onCustomBoundarySave?: (geometry: any, reason: string) => Promise<void>;
  height?: string;
  title?: string;
  subtitle?: string;
}

export const GujaratStateMap: React.FC<GujaratStateMapProps> = ({
  geoJsonData,
  selectedDistrictId,
  selectedDistrictProps,
  onDistrictSelect,
  onDistrictHover,
  selectedTalukaId,
  selectedTalukaProps,
  onTalukaSelect,
  selectedVillageId,
  selectedVillageProps,
  onVillageSelect,
  viewLevel: controlledViewLevel,
  onViewLevelChange,
  talukasGeoJson,
  villagesGeoJson,
  isLoadingSubLayer = false,
  enableDrawingMode = false,
  onCustomBoundarySave,
  height = '540px',
  title,
  subtitle,
}) => {
  const { apiBaseUrl } = useAuth();
  const { t, localizeDistrict, formatNumber } = useTranslation();
  const mapTitle = title || t('superAdmin.map.title');
  const mapSubtitle = subtitle || t('superAdmin.map.subtitle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const clickPopupRef = useRef<maplibregl.Popup | null>(null);
  const talukaMarkersRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement; talukaId: string }[]>([]);
  const villageMarkersRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement; villageId: string }[]>([]);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Uncontrolled / Controlled View Level
  const [internalViewLevel, setInternalViewLevel] = useState<'DISTRICT' | 'TALUKA' | 'VILLAGE'>(
    controlledViewLevel || 'DISTRICT'
  );
  useEffect(() => {
    if (controlledViewLevel && controlledViewLevel !== internalViewLevel) {
      setInternalViewLevel(controlledViewLevel);
    }
  }, [controlledViewLevel]);
  const effectiveViewLevel = controlledViewLevel || internalViewLevel;

  // Autonomous fallback data when parent doesn't provide sub-layers
  const [internalDistrictsGeoJson, setInternalDistrictsGeoJson] = useState<any | null>(null);
  const [internalTalukasGeoJson, setInternalTalukasGeoJson] = useState<any | null>(null);
  const [internalVillagesGeoJson, setInternalVillagesGeoJson] = useState<any | null>(null);
  const [isInternalLoading, setIsInternalLoading] = useState<boolean>(false);

  const effectiveDistrictsGeoJson = geoJsonData || internalDistrictsGeoJson;
  const effectiveTalukasGeoJson = talukasGeoJson || internalTalukasGeoJson;
  const effectiveVillagesGeoJson = villagesGeoJson || internalVillagesGeoJson;

  useEffect(() => {
    if (!geoJsonData) {
      adminService.listDistrictsGeoJson(apiBaseUrl)
        .then((data: any) => setInternalDistrictsGeoJson(data))
        .catch((err: any) => console.warn('Auto-fetch districts GeoJSON note:', err));
    }
  }, [geoJsonData, apiBaseUrl]);

  // Statewide Talukas Auto-fetch (Guarantees all 226 authentic taluka boundaries are ready)
  useEffect(() => {
    if (!talukasGeoJson || !talukasGeoJson.features || talukasGeoJson.features.length < 50) {
      adminService.getDistrictTalukasGeoJson(apiBaseUrl)
        .then((data: any) => {
          if (data && data.features && data.features.length > 0) {
            setInternalTalukasGeoJson(data);
          }
        })
        .catch((err: any) => console.warn('Auto-fetch talukas GeoJSON note:', err));
    }
  }, [talukasGeoJson, apiBaseUrl]);

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredEntity, setHoveredEntity] = useState<any | null>(null);
  const [internalSelectedTaluka, setInternalSelectedTaluka] = useState<any | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);
  const [saveReason, setSaveReason] = useState<string>('');
  const [isSavingBoundary, setIsSavingBoundary] = useState<boolean>(false);

  // Filter district features
  const filteredGeoJson = useMemo(() => {
    if (!effectiveDistrictsGeoJson || !effectiveDistrictsGeoJson.features) return null;
    let feats = effectiveDistrictsGeoJson.features;

    if (filterStatus !== 'ALL') {
      feats = feats.filter((f: any) => {
        const st = (f.properties?.status || 'UNASSIGNED').toUpperCase();
        return st === filterStatus;
      });
    }

    if (searchQuery.trim() && effectiveViewLevel === 'DISTRICT') {
      const q = searchQuery.toLowerCase();
      feats = feats.filter((f: any) => {
        const nameEn = (f.properties?.name_en || f.properties?.district || '').toLowerCase();
        const nameGu = (f.properties?.name_gu || '').toLowerCase();
        const nameHi = (f.properties?.name_hi || '').toLowerCase();
        const code = (f.properties?.code || '').toLowerCase();
        return nameEn.includes(q) || nameGu.includes(q) || nameHi.includes(q) || code.includes(q);
      });
    }

    return {
      type: 'FeatureCollection',
      features: feats,
    };
  }, [effectiveDistrictsGeoJson, filterStatus, searchQuery, effectiveViewLevel]);

  // Filter taluka features
  const filteredTalukasGeoJson = useMemo(() => {
    if (!effectiveTalukasGeoJson || !effectiveTalukasGeoJson.features) return null;
    let feats = effectiveTalukasGeoJson.features;
    if (searchQuery.trim() && effectiveViewLevel === 'TALUKA') {
      const q = searchQuery.toLowerCase();
      feats = feats.filter((f: any) => {
        const nameEn = (f.properties?.name_en || '').toLowerCase();
        const nameGu = (f.properties?.name_gu || '').toLowerCase();
        const code = (f.properties?.code || '').toLowerCase();
        return nameEn.includes(q) || nameGu.includes(q) || code.includes(q);
      });
    }
    return { type: 'FeatureCollection', features: feats };
  }, [effectiveTalukasGeoJson, searchQuery, effectiveViewLevel]);

  // Filter village features
  const filteredVillagesGeoJson = useMemo(() => {
    if (!effectiveVillagesGeoJson || !effectiveVillagesGeoJson.features) return null;
    let feats = effectiveVillagesGeoJson.features;
    if (searchQuery.trim() && effectiveViewLevel === 'VILLAGE') {
      const q = searchQuery.toLowerCase();
      feats = feats.filter((f: any) => {
        const nameEn = (f.properties?.name_en || '').toLowerCase();
        const nameGu = (f.properties?.name_gu || '').toLowerCase();
        const code = (f.properties?.code || '').toLowerCase();
        const census = (f.properties?.census_code || '').toLowerCase();
        return nameEn.includes(q) || nameGu.includes(q) || code.includes(q) || census.includes(q);
      });
    }
    return { type: 'FeatureCollection', features: feats };
  }, [effectiveVillagesGeoJson, searchQuery, effectiveViewLevel]);

  // Dedicated Layer Visibility Updater
  const applyLayerVisibilities = useCallback((lvl: 'DISTRICT' | 'TALUKA' | 'VILLAGE') => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      if (lvl === 'DISTRICT') {
        // District View: Only District Polygons are primary
        if (map.getLayer('districts-fill')) map.setLayoutProperty('districts-fill', 'visibility', 'visible');
        if (map.getLayer('districts-borders')) map.setLayoutProperty('districts-borders', 'visibility', 'visible');
        if (map.getLayer('districts-context-line')) map.setLayoutProperty('districts-context-line', 'visibility', 'none');

        if (map.getLayer('talukas-fill')) map.setLayoutProperty('talukas-fill', 'visibility', 'none');
        if (map.getLayer('talukas-borders')) map.setLayoutProperty('talukas-borders', 'visibility', 'none');
        if (map.getLayer('talukas-labels')) map.setLayoutProperty('talukas-labels', 'visibility', 'none');
        if (map.getLayer('talukas-context-line')) map.setLayoutProperty('talukas-context-line', 'visibility', 'none');

        if (map.getLayer('villages-fill')) map.setLayoutProperty('villages-fill', 'visibility', 'none');
        if (map.getLayer('villages-borders')) map.setLayoutProperty('villages-borders', 'visibility', 'none');
      } else if (lvl === 'TALUKA') {
        // Taluka View: Taluka Polygons are primary; District lines completely removed as requested
        if (map.getLayer('districts-fill')) map.setLayoutProperty('districts-fill', 'visibility', 'none');
        if (map.getLayer('districts-borders')) map.setLayoutProperty('districts-borders', 'visibility', 'none');
        if (map.getLayer('districts-context-line')) map.setLayoutProperty('districts-context-line', 'visibility', 'none');

        if (map.getLayer('talukas-fill')) map.setLayoutProperty('talukas-fill', 'visibility', 'visible');
        if (map.getLayer('talukas-borders')) map.setLayoutProperty('talukas-borders', 'visibility', 'visible');
        if (map.getLayer('talukas-labels')) map.setLayoutProperty('talukas-labels', 'visibility', 'visible');
        if (map.getLayer('talukas-context-line')) map.setLayoutProperty('talukas-context-line', 'visibility', 'none');

        if (map.getLayer('villages-fill')) map.setLayoutProperty('villages-fill', 'visibility', 'none');
        if (map.getLayer('villages-borders')) map.setLayoutProperty('villages-borders', 'visibility', 'none');
      } else if (lvl === 'VILLAGE') {
        // Village View: Village Polygons are primary; Taluka line is subtle dashed context
        if (map.getLayer('districts-fill')) map.setLayoutProperty('districts-fill', 'visibility', 'none');
        if (map.getLayer('districts-borders')) map.setLayoutProperty('districts-borders', 'visibility', 'none');
        if (map.getLayer('districts-context-line')) map.setLayoutProperty('districts-context-line', 'visibility', 'none');

        if (map.getLayer('talukas-fill')) map.setLayoutProperty('talukas-fill', 'visibility', 'none');
        if (map.getLayer('talukas-borders')) map.setLayoutProperty('talukas-borders', 'visibility', 'none');
        if (map.getLayer('talukas-labels')) map.setLayoutProperty('talukas-labels', 'visibility', 'none');
        if (map.getLayer('talukas-context-line')) map.setLayoutProperty('talukas-context-line', 'visibility', 'visible');

        if (map.getLayer('villages-fill')) map.setLayoutProperty('villages-fill', 'visibility', 'visible');
        if (map.getLayer('villages-borders')) map.setLayoutProperty('villages-borders', 'visibility', 'visible');
      }
    } catch (e) {
      console.warn('applyLayerVisibilities notice:', e);
    }
  }, []);

  // Dedicated Dynamic Paint Properties Updater (Synchronous Highlight Reflection)
  const updateLayerStyles = useCallback((lvl: 'DISTRICT' | 'TALUKA' | 'VILLAGE') => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {

    if (lvl === 'DISTRICT') {
      if (map.getLayer('districts-fill')) {
        map.setPaintProperty('districts-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'district_id'], selectedDistrictId || ''],
          0.75,
          0.45,
        ]);
      }
      if (map.getLayer('districts-borders')) {
        map.setPaintProperty('districts-borders', 'line-color', [
          'case',
          ['==', ['get', 'district_id'], selectedDistrictId || ''],
          '#2563EB',
          '#334155',
        ]);
        map.setPaintProperty('districts-borders', 'line-width', [
          'case',
          ['==', ['get', 'district_id'], selectedDistrictId || ''],
          3.0,
          1.2,
        ]);
      }
    } else if (lvl === 'TALUKA') {
      const activeTalukaId = selectedTalukaId || internalSelectedTaluka?.taluka_id || '';
      if (map.getLayer('talukas-fill')) {
        map.setPaintProperty('talukas-fill', 'fill-color', [
          'case',
          ['==', ['get', 'taluka_id'], activeTalukaId],
          '#38BDF8',
          ['any', ['==', ['get', 'status'], 'ASSIGNED'], ['==', ['get', 'is_assigned'], true]],
          '#135D43',
          '#0EA5E9',
        ]);
        map.setPaintProperty('talukas-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'taluka_id'], activeTalukaId],
          0.45,
          ['any', ['==', ['get', 'status'], 'ASSIGNED'], ['==', ['get', 'is_assigned'], true]],
          0.35,
          0.05,
        ]);
      }
      if (map.getLayer('talukas-borders')) {
        map.setPaintProperty('talukas-borders', 'line-color', [
          'case',
          ['==', ['get', 'taluka_id'], activeTalukaId],
          '#2563EB',
          '#000000',
        ]);
        map.setPaintProperty('talukas-borders', 'line-width', [
          'case',
          ['==', ['get', 'taluka_id'], activeTalukaId],
          3.2,
          1.8,
        ]);
      }
    } else if (lvl === 'VILLAGE') {
      if (map.getLayer('villages-fill')) {
        map.setPaintProperty('villages-fill', 'fill-color', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          '#38BDF8',
          ['has', 'fill_color'],
          ['get', 'fill_color'],
          ['has', 'fillColor'],
          ['get', 'fillColor'],
          '#FFFFFF',
        ]);
        map.setPaintProperty('villages-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          0.85,
          ['has', 'fill_opacity'],
          ['get', 'fill_opacity'],
          0.70,
        ]);
      }
      if (map.getLayer('villages-borders')) {
        map.setPaintProperty('villages-borders', 'line-color', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          '#1D4ED8',
          ['has', 'border_color'],
          ['get', 'border_color'],
          '#0F172A',
        ]);
        map.setPaintProperty('villages-borders', 'line-width', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          3.5,
          1.2,
        ]);
      }
      if (map.getLayer('talukas-context-line')) {
        map.setPaintProperty('talukas-context-line', 'line-color', '#0F172A');
        map.setPaintProperty('talukas-context-line', 'line-width', 3.5);
      }
    }
  } catch (e) {
    console.warn('updateLayerStyles notice:', e);
  }
  }, [selectedDistrictId, selectedTalukaId, selectedVillageId, internalSelectedTaluka]);

  // Sync Paint Properties when selection or level changes
  useEffect(() => {
    updateLayerStyles(effectiveViewLevel);
  }, [selectedDistrictId, selectedTalukaId, selectedVillageId, internalSelectedTaluka, effectiveViewLevel, updateLayerStyles]);

  // Synchronize Taluka DOM Markers for crisp statewide small-font labels
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !effectiveTalukasGeoJson || !effectiveTalukasGeoJson.features) return;

    // Clear previous markers
    talukaMarkersRef.current.forEach(({ marker }) => marker.remove());
    talukaMarkersRef.current = [];

    const feats = effectiveTalukasGeoJson.features;
    feats.forEach((f: any) => {
      const p = f.properties || {};
      const centroid: [number, number] | null = p.centroid || getGeometryCentroid(f.geometry);
      if (!centroid) return;

      const talukaName = p.name_gu || p.name_en || '';
      const districtName = p.district_name_gu || p.district_name || p.district_name_en || '';
      const isSelected = p.taluka_id === selectedTalukaId;

      const el = document.createElement('div');
      el.className = 'taluka-map-label';
      el.style.display = effectiveViewLevel === 'TALUKA' ? 'flex' : 'none';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.pointerEvents = 'none';
      el.style.userSelect = 'none';
      el.style.transform = 'translate(-50%, -50%)';

      el.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          background: ${isSelected ? '#2563EB' : 'rgba(255, 255, 255, 0.92)'};
          color: ${isSelected ? '#FFFFFF' : '#0F172A'};
          padding: 1px 4px;
          border-radius: 4px;
          border: 1px solid ${isSelected ? '#1D4ED8' : 'rgba(15, 23, 42, 0.2)'};
          box-shadow: 0 1px 2px rgba(0,0,0,0.12);
          white-space: nowrap;
          line-height: 1.15;
          text-align: center;
          transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
          transition: transform 0.15s ease;
        ">
          <span style="font-size: 8.5px; font-weight: 700; letter-spacing: -0.2px;">${talukaName}</span>
          ${districtName ? `<span style="font-size: 7px; font-weight: 600; opacity: 0.85; margin-top: 1px;">(${districtName})</span>` : ''}
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(centroid)
        .addTo(map);

      talukaMarkersRef.current.push({ marker, el, talukaId: p.taluka_id });
    });

    return () => {
      talukaMarkersRef.current.forEach(({ marker }) => marker.remove());
      talukaMarkersRef.current = [];
    };
  }, [effectiveTalukasGeoJson]);

  // Update visibility and highlight of Taluka Markers
  useEffect(() => {
    talukaMarkersRef.current.forEach(({ el, talukaId }) => {
      if (effectiveViewLevel === 'TALUKA') {
        el.style.display = 'flex';
        const isSelected = talukaId === selectedTalukaId;
        const inner = el.firstElementChild as HTMLElement;
        if (inner) {
          inner.style.background = isSelected ? '#2563EB' : 'rgba(255, 255, 255, 0.92)';
          inner.style.color = isSelected ? '#FFFFFF' : '#0F172A';
          inner.style.border = isSelected ? '1px solid #1D4ED8' : '1px solid rgba(15, 23, 42, 0.2)';
          inner.style.transform = isSelected ? 'scale(1.15)' : 'scale(1)';
          el.style.zIndex = isSelected ? '10' : '1';
        }
      } else {
        el.style.display = 'none';
      }
    });
  }, [effectiveViewLevel, selectedTalukaId]);

  // Synchronize Village DOM Markers for crisp taluka-level village labels (matching reference village map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !effectiveVillagesGeoJson || !effectiveVillagesGeoJson.features) return;

    // Clear previous village markers
    villageMarkersRef.current.forEach(({ marker }) => marker.remove());
    villageMarkersRef.current = [];

    const feats = effectiveVillagesGeoJson.features;
    feats.forEach((f: any) => {
      const p = f.properties || {};
      const centroid: [number, number] | null =
        (p.longitude && p.latitude) ? [p.longitude, p.latitude] : getGeometryCentroid(f.geometry);
      if (!centroid) return;

      const rawName = p.name_gu || p.name_en || '';
      const villageName = /[\u0A80-\u0AFF]/.test(rawName) ? rawName : (transliterateToGujarati(rawName) || rawName);
      const isSelected = p.village_id === selectedVillageId;

      const el = document.createElement('div');
      el.className = 'village-map-label';
      el.style.display = effectiveViewLevel === 'VILLAGE' ? 'flex' : 'none';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.userSelect = 'none';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';

      el.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          background: ${isSelected ? '#2563EB' : 'transparent'};
          color: ${isSelected ? '#FFFFFF' : '#0F172A'};
          padding: ${isSelected ? '2px 6px' : '0px 2px'};
          border-radius: 4px;
          border: ${isSelected ? '1.5px solid #1D4ED8' : 'none'};
          box-shadow: ${isSelected ? '0 2px 4px rgba(0,0,0,0.25)' : 'none'};
          white-space: nowrap;
          line-height: 1.15;
          text-align: center;
          transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
          transition: transform 0.15s ease;
          font-family: 'Shruti', 'Nirmala UI', 'Gujarati Sangam MN', 'Noto Sans Gujarati', sans-serif;
        ">
          <span style="
            font-size: 10px;
            font-weight: 700;
            letter-spacing: -0.2px;
            text-shadow: ${isSelected ? 'none' : '0 0 3px #FFFFFF, 0 0 2px #FFFFFF, 0 0 4px #FFFFFF, 0 0 1px #FFFFFF'};
          ">${villageName}</span>
          ${isSelected ? '' : '<span style="font-size: 7px; color: #0F172A; line-height: 1; margin-top: -1px; text-shadow: 0 0 2px #FFF;">•</span>'}
        </div>
      `;

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onVillageSelect?.(p);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(centroid)
        .addTo(map);

      villageMarkersRef.current.push({ marker, el, villageId: p.village_id });
    });

    return () => {
      villageMarkersRef.current.forEach(({ marker }) => marker.remove());
      villageMarkersRef.current = [];
    };
  }, [effectiveVillagesGeoJson]);

  // Update visibility and highlight of Village Markers
  useEffect(() => {
    villageMarkersRef.current.forEach(({ el, villageId }) => {
      if (effectiveViewLevel === 'VILLAGE') {
        el.style.display = 'flex';
        const isSelected = villageId === selectedVillageId;
        const inner = el.firstElementChild as HTMLElement;
        if (inner) {
          inner.style.background = isSelected ? '#2563EB' : 'transparent';
          inner.style.color = isSelected ? '#FFFFFF' : '#0F172A';
          inner.style.border = isSelected ? '1.5px solid #1D4ED8' : 'none';
          inner.style.boxShadow = isSelected ? '0 2px 4px rgba(0,0,0,0.25)' : 'none';
          inner.style.padding = isSelected ? '2px 6px' : '0px 2px';
          inner.style.borderRadius = '4px';
          inner.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
          el.style.zIndex = isSelected ? '30' : '5';
          const span = inner.querySelector('span');
          if (span) {
            span.style.textShadow = isSelected ? 'none' : '0 0 3px #FFFFFF, 0 0 2px #FFFFFF, 0 0 4px #FFFFFF, 0 0 1px #FFFFFF';
          }
        }
      } else {
        el.style.display = 'none';
      }
    });
  }, [effectiveViewLevel, selectedVillageId]);

  // View Level Switching Logic
  const handleSwitchLevel = useCallback(async (level: 'DISTRICT' | 'TALUKA' | 'VILLAGE', targetDistrictId?: string, overrideTalukaProps?: any) => {
    if (clickPopupRef.current) clickPopupRef.current.remove();
    setHoverPos(null);
    setHoveredEntity(null);
    setInternalViewLevel(level);
    onViewLevelChange?.(level);

    const map = mapInstanceRef.current;
    if (!map) return;

    if (level === 'DISTRICT') {
      applyLayerVisibilities('DISTRICT');
      updateLayerStyles('DISTRICT');
      if (selectedDistrictProps) {
        const b = getGeometryBounds(selectedDistrictProps.geometry);
        if (b) map.fitBounds(b, { padding: 40, maxZoom: 10, duration: 800 });
      } else {
        map.flyTo({ center: [GUJARAT_CENTER.lng, GUJARAT_CENTER.lat], zoom: 6.8, duration: 800 });
      }
      return;
    }

    if (level === 'TALUKA') {
      setIsInternalLoading(true);
      try {
        let tData = effectiveTalukasGeoJson;
        // Always ensure statewide Gujarat talukas are loaded
        if (!tData || !tData.features || tData.features.length < 50) {
          tData = await adminService.getDistrictTalukasGeoJson(apiBaseUrl);
          setInternalTalukasGeoJson(tData);
        }

        const tSrc: any = map.getSource('district-talukas-source');
        if (tSrc && tData) {
          tSrc.setData(tData);
        }

        applyLayerVisibilities('TALUKA');
        updateLayerStyles('TALUKA');

        if (targetDistrictId && tData?.features) {
          const distFeats = tData.features.filter((f: any) => f.properties?.district_id === targetDistrictId);
          if (distFeats.length > 0) {
            const b = getFeatureCollectionBounds({ type: 'FeatureCollection', features: distFeats });
            if (b) map.fitBounds(b, { padding: 40, duration: 800 });
          }
        } else if (selectedTalukaProps?.geometry) {
          const b = getGeometryBounds(selectedTalukaProps.geometry);
          if (b) map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 800 });
        } else if (selectedDistrictProps?.geometry) {
          const b = getGeometryBounds(selectedDistrictProps.geometry);
          if (b) map.fitBounds(b, { padding: 40, duration: 800 });
        } else {
          map.flyTo({ center: [GUJARAT_CENTER.lng, GUJARAT_CENTER.lat], zoom: 6.8, duration: 800 });
        }
      } catch (err) {
        console.warn('Auto-fetch talukas note:', err);
      } finally {
        setIsInternalLoading(false);
      }
      return;
    }

    if (level === 'VILLAGE') {
      setIsInternalLoading(true);
      try {
        let activeTalukaId = overrideTalukaProps?.taluka_id || selectedTalukaId;
        let activeTalukaProps = overrideTalukaProps || selectedTalukaProps;

        // If no taluka selected, but district selected (or targetDistrictId): auto-pick first taluka of district
        const activeDistrictId = targetDistrictId || selectedDistrictId;
        let tData = effectiveTalukasGeoJson;
        if (!activeTalukaId) {
          if (!tData || !tData.features || tData.features.length === 0) {
            tData = await adminService.getDistrictTalukasGeoJson(apiBaseUrl, activeDistrictId);
            setInternalTalukasGeoJson(tData);
          }
          if (activeDistrictId && tData?.features) {
            const distFeats = tData.features.filter((f: any) => f.properties?.district_id === activeDistrictId);
            if (distFeats.length > 0) {
              activeTalukaProps = distFeats[0].properties;
              activeTalukaId = activeTalukaProps?.taluka_id;
              onTalukaSelect?.(activeTalukaProps);
            }
          }
          if (!activeTalukaId && tData?.features?.length) {
            // Find Gadhada or first taluka
            const gadhadaFeat = tData.features.find((f: any) =>
              (f.properties?.name_en || '').toLowerCase().includes('gadhada')
            );
            activeTalukaProps = gadhadaFeat?.properties || tData.features[0].properties;
            activeTalukaId = activeTalukaProps?.taluka_id;
            onTalukaSelect?.(activeTalukaProps);
          }
        }

        if (activeTalukaId) {
          let vData = effectiveVillagesGeoJson;
          if (
            !vData ||
            !vData.features ||
            vData.features.length === 0 ||
            vData.features[0]?.properties?.taluka_id !== activeTalukaId
          ) {
            vData = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, activeTalukaId);
            setInternalVillagesGeoJson(vData);
          }

          const vSrc: any = map.getSource('taluka-villages-source');
          if (vSrc && vData) {
            vSrc.setData(vData);
          }

          applyLayerVisibilities('VILLAGE');
          updateLayerStyles('VILLAGE');

          if (vData?.features?.length > 0) {
            const b = getFeatureCollectionBounds(vData);
            if (b) map.fitBounds(b, { padding: 45, duration: 800 });
          }
        } else {
          applyLayerVisibilities('TALUKA');
          updateLayerStyles('TALUKA');
        }
      } catch (err) {
        console.warn('Auto-fetch villages note:', err);
      } finally {
        setIsInternalLoading(false);
      }
      return;
    }
  }, [
    onViewLevelChange,
    selectedDistrictId,
    effectiveTalukasGeoJson,
    apiBaseUrl,
    applyLayerVisibilities,
    updateLayerStyles,
    selectedTalukaId,
    effectiveVillagesGeoJson,
    selectedDistrictProps,
    selectedTalukaProps,
    onTalukaSelect,
  ]);

  // Comprehensive Layer Setup Function
  const setupAllSourcesAndLayers = useCallback((map: maplibregl.Map) => {
    // -------------------------------------------------------------------------
    // 1. DISTRICTS SOURCE & LAYERS
    // -------------------------------------------------------------------------
    const dSource = 'gujarat-districts-source';
    if (!map.getSource(dSource)) {
      map.addSource(dSource, {
        type: 'geojson',
        data: (filteredGeoJson || { type: 'FeatureCollection', features: [] }) as any,
      });

      // 1.1 District Polygon Fill
      map.addLayer({
        id: 'districts-fill',
        type: 'fill',
        source: dSource,
        layout: {
          visibility: effectiveViewLevel === 'DISTRICT' ? 'visible' : 'none',
        },
        paint: {
          'fill-color': [
            'case',
            ['has', 'fill_color'],
            ['get', 'fill_color'],
            ['has', 'fillColor'],
            ['get', 'fillColor'],
            ['==', ['get', 'district_id'], selectedDistrictId || ''],
            '#38BDF8',
            ['==', ['get', 'status'], 'ASSIGNED'],
            '#135D43', // Forest green
            ['==', ['get', 'status'], 'CONFLICT'],
            '#DC2626', // Red
            '#94A3B8', // Slate neutral
          ],
          'fill-opacity': 0.45,
        },
      });

      // 1.2 District Context Line (Subtle dashed outline in Taluka View)
      map.addLayer({
        id: 'districts-context-line',
        type: 'line',
        source: dSource,
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#64748B',
          'line-width': 1.5,
          'line-dasharray': [4, 2],
        },
      });

      // 1.3 District Primary Borders (Solid outlines in District View)
      map.addLayer({
        id: 'districts-borders',
        type: 'line',
        source: dSource,
        layout: {
          visibility: effectiveViewLevel === 'DISTRICT' ? 'visible' : 'none',
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'district_id'], selectedDistrictId || ''],
            '#2563EB',
            '#334155',
          ],
          'line-width': [
            'case',
            ['==', ['get', 'district_id'], selectedDistrictId || ''],
            3.0,
            1.2,
          ],
        },
      });

      // District Interaction Handlers: single-click selects & displays metrics, dblclick drills down to talukas
      map.on('click', 'districts-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          onDistrictSelect?.(props);
        }
      });

      map.on('dblclick', 'districts-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          onDistrictSelect?.(props);
          handleSwitchLevel('TALUKA', props.district_id);
        }
      });

      map.on('mousemove', 'districts-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          map.getCanvas().style.cursor = 'pointer';
          const p = e.features[0].properties;
          setHoveredEntity({
            type: 'DISTRICT',
            ...p,
          });
          setHoverPos({ x: e.point.x, y: e.point.y });
          onDistrictHover?.(p);
        }
      });

      map.on('mouseleave', 'districts-fill', () => {
        if (isDrawingMode) return;
        map.getCanvas().style.cursor = '';
        setHoveredEntity(null);
        setHoverPos(null);
        onDistrictHover?.(null);
      });
    }

    // -------------------------------------------------------------------------
    // 2. TALUKAS SOURCE & LAYERS
    // -------------------------------------------------------------------------
    const tSource = 'district-talukas-source';
    if (!map.getSource(tSource)) {
      map.addSource(tSource, {
        type: 'geojson',
        data: (filteredTalukasGeoJson || { type: 'FeatureCollection', features: [] }) as any,
      });

      // 2.1 Taluka Polygon Fill (Assigned green #135D43, Unassigned neutral #0EA5E9)
      map.addLayer({
        id: 'talukas-fill',
        type: 'fill',
        source: tSource,
        layout: {
          visibility: effectiveViewLevel === 'TALUKA' ? 'visible' : 'none',
        },
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
            '#38BDF8',
            ['has', 'fill_color'],
            ['get', 'fill_color'],
            ['has', 'fillColor'],
            ['get', 'fillColor'],
            ['any', ['==', ['get', 'status'], 'ASSIGNED'], ['==', ['get', 'is_assigned'], true]],
            '#135D43',
            '#0EA5E9',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
            0.45,
            ['any', ['==', ['get', 'status'], 'ASSIGNED'], ['==', ['get', 'is_assigned'], true]],
            0.35,
            0.05,
          ],
        },
      });

      // 2.2 Taluka Context Line (Outer perimeter in Village View)
      map.addLayer({
        id: 'talukas-context-line',
        type: 'line',
        source: tSource,
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#0F172A',
          'line-width': 2.5,
        },
      });

      // 2.3 Taluka Primary Borders (Thinner clean outlines in Taluka View: 1.8px)
      map.addLayer({
        id: 'talukas-borders',
        type: 'line',
        source: tSource,
        layout: {
          visibility: effectiveViewLevel === 'TALUKA' ? 'visible' : 'none',
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
            '#2563EB',
            '#000000',
          ],
          'line-width': [
            'case',
            ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
            3.2,
            1.8,
          ],
        },
      });

      // 2.4 Taluka Names & Labels (Clear readable centered labels with white halo)
      map.addLayer({
        id: 'talukas-labels',
        type: 'symbol',
        source: tSource,
        layout: {
          visibility: effectiveViewLevel === 'TALUKA' ? 'visible' : 'none',
          'text-field': ['coalesce', ['get', 'name_gu'], ['get', 'name_en'], ''],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 10,
            9, 11,
            11, 13,
            13, 15,
          ],
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'text-max-width': 8,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#0F172A',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2.0,
        },
      });

      // Taluka Interaction Handlers
      map.on('click', 'talukas-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          setInternalSelectedTaluka(props);
          onTalukaSelect?.(props);

          // If in Village View or clicked while viewing villages, auto-fetch and display village polygons
          if (effectiveViewLevel === 'VILLAGE' && props.taluka_id) {
            adminService.getTalukaVillagesGeoJson(apiBaseUrl, props.taluka_id).then((vData) => {
              setInternalVillagesGeoJson(vData);
              const vSrc: any = map.getSource('taluka-villages-source');
              if (vSrc && vData) vSrc.setData(vData);
              applyLayerVisibilities('VILLAGE');
              updateLayerStyles('VILLAGE');
              if (vData?.features?.length > 0) {
                const b = getFeatureCollectionBounds(vData);
                if (b) map.fitBounds(b, { padding: 45, duration: 800 });
              }
            }).catch(console.warn);
          } else {
            const b = getGeometryBounds(e.features[0].geometry);
            if (b) {
              map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 800 });
            }
          }

          if (clickPopupRef.current) clickPopupRef.current.remove();
          const tName = props.name_gu || transliterateToGujarati(props.name_en);
          const tNameEn = props.name_en;
          const dName = props.district_name_gu || props.district_name || props.district_name_en || '';
          const vCount = props.village_count || 0;

          const popupNode = document.createElement('div');
          popupNode.style.fontFamily = 'inherit';
          popupNode.style.padding = '4px 6px';
          popupNode.style.minWidth = '180px';
          popupNode.innerHTML = `
            <div style="font-weight: 800; font-size: 13px; color: #0F172A; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
              <span>📍 ${tName}</span>
              <span style="font-size: 10px; color: #64748B; font-weight: 500;">(${tNameEn})</span>
            </div>
            <div style="margin-top: 6px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748B;">🏛️ જિલ્લો (District):</span>
              <span style="font-weight: 700; color: #135D43; background: #E8F5E9; padding: 1px 6px; border-radius: 4px;">${dName}</span>
            </div>
            <div style="margin-top: 4px; font-size: 11px; display: flex; justify-content: space-between; align-items: center; color: #475569;">
              <span>🏷️ કોડ (Code):</span>
              <span style="font-family: monospace; font-weight: 600; color: #0F172A;">${props.code || '-'}</span>
            </div>
            <div style="margin-top: 4px; font-size: 11px; display: flex; justify-content: space-between; align-items: center; color: #475569;">
              <span>🏘️ ગામો (Villages):</span>
              <span style="font-weight: 700; color: #0284C7;">${vCount}</span>
            </div>
            <div style="margin-top: 4px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748B;">📋 સોંપણી સ્થિતિ:</span>
              <span style="font-weight: 700; color: ${props.is_assigned || props.status === 'ASSIGNED' ? '#135D43' : '#64748B'}; background: ${props.is_assigned || props.status === 'ASSIGNED' ? '#DCFCE7' : '#F1F5F9'}; padding: 1px 6px; border-radius: 4px; border: 1px solid ${props.is_assigned || props.status === 'ASSIGNED' ? '#86EFAC' : '#E2E8F0'};">
                ${props.is_assigned || props.status === 'ASSIGNED' ? 'સોંપાયેલ (Assigned)' : 'બાકી (Unassigned)'}
              </span>
            </div>
            <button id="btn-drill-villages" style="margin-top: 8px; width: 100%; background: #135D43; color: white; border: none; border-radius: 4px; padding: 5px 8px; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span>🏘️ ગામ સીમાઓ જુઓ (View Village Boundaries)</span>
            </button>
          `;

          const drillBtn = popupNode.querySelector('#btn-drill-villages');
          if (drillBtn) {
            drillBtn.addEventListener('click', () => {
              if (clickPopupRef.current) clickPopupRef.current.remove();
              onTalukaSelect?.(props);
              handleSwitchLevel('VILLAGE', props.district_id, props);
            });
          }

          const popup = new maplibregl.Popup({ offset: 12, closeButton: true, className: 'taluka-click-popup' })
            .setLngLat(e.lngLat)
            .setDOMContent(popupNode)
            .addTo(map);
          clickPopupRef.current = popup;
        }
      });

      map.on('mousemove', 'talukas-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          map.getCanvas().style.cursor = 'pointer';
          setHoveredEntity({
            type: 'TALUKA',
            ...e.features[0].properties,
          });
          setHoverPos({ x: e.point.x, y: e.point.y });
        }
      });

      map.on('mouseleave', 'talukas-fill', () => {
        if (isDrawingMode) return;
        map.getCanvas().style.cursor = '';
        setHoveredEntity(null);
        setHoverPos(null);
      });
    }

    // -------------------------------------------------------------------------
    // 3. VILLAGES SOURCE & LAYERS
    // -------------------------------------------------------------------------
    const vSource = 'taluka-villages-source';
    if (!map.getSource(vSource)) {
      map.addSource(vSource, {
        type: 'geojson',
        data: (filteredVillagesGeoJson || { type: 'FeatureCollection', features: [] }) as any,
      });

      // 3.1 Village Polygon Fill
      map.addLayer({
        id: 'villages-fill',
        type: 'fill',
        source: vSource,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'village_id'], selectedVillageId || ''],
            '#38BDF8',
            ['has', 'fill_color'],
            ['get', 'fill_color'],
            ['has', 'fillColor'],
            ['get', 'fillColor'],
            '#FFFFFF',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'village_id'], selectedVillageId || ''],
            0.85,
            ['has', 'fill_opacity'],
            ['get', 'fill_opacity'],
            0.70,
          ],
        },
      });

      // 3.2 Village Primary Borders (Solid sharp outlines in Village View)
      map.addLayer({
        id: 'villages-borders',
        type: 'line',
        source: vSource,
        layout: {
          visibility: 'none',
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'village_id'], selectedVillageId || ''],
            '#1D4ED8',
            ['has', 'border_color'],
            ['get', 'border_color'],
            '#0F172A',
          ],
          'line-width': [
            'case',
            ['==', ['get', 'village_id'], selectedVillageId || ''],
            3.5,
            1.2,
          ],
        },
      });

      // Village Interaction Handlers
      map.on('click', 'villages-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          onVillageSelect?.(props);
          const b = getGeometryBounds(e.features[0].geometry);
          if (b) {
            map.fitBounds(b, { padding: 50, maxZoom: 15, duration: 600 });
          }
        }
      });

      map.on('mousemove', 'villages-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          map.getCanvas().style.cursor = 'pointer';
          setHoveredEntity({
            type: 'VILLAGE',
            ...e.features[0].properties,
          });
          setHoverPos({ x: e.point.x, y: e.point.y });
        }
      });

      map.on('mouseleave', 'villages-fill', () => {
        if (isDrawingMode) return;
        map.getCanvas().style.cursor = '';
        setHoveredEntity(null);
        setHoverPos(null);
      });
    }

    // -------------------------------------------------------------------------
    // 4. DRAWING SOURCE & LAYERS (CUSTOM JURISDICTIONS)
    // -------------------------------------------------------------------------
    const drawSource = 'custom-drawing-source';
    if (!map.getSource(drawSource)) {
      map.addSource(drawSource, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'drawing-fill',
        type: 'fill',
        source: drawSource,
        paint: {
          'fill-color': '#A855F7',
          'fill-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'drawing-line',
        type: 'line',
        source: drawSource,
        paint: {
          'line-color': '#7C3AED',
          'line-width': 2.5,
        },
      });

      map.addLayer({
        id: 'drawing-points',
        type: 'circle',
        source: drawSource,
        paint: {
          'circle-radius': 5,
          'circle-color': '#6D28D9',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });
    }

    applyLayerVisibilities(effectiveViewLevel);
    updateLayerStyles(effectiveViewLevel);
  }, [
    filteredGeoJson,
    filteredTalukasGeoJson,
    filteredVillagesGeoJson,
    selectedDistrictId,
    selectedTalukaId,
    selectedVillageId,
    effectiveViewLevel,
    isDrawingMode,
    onDistrictSelect,
    onTalukaSelect,
    onVillageSelect,
    applyLayerVisibilities,
    updateLayerStyles,
  ]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: FREE_OSM_STYLE,
        center: [GUJARAT_CENTER.lng, GUJARAT_CENTER.lat],
        zoom: 6.8,
        minZoom: 5.2,
        maxZoom: 17,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-right'
      );
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        'top-right'
      );

      // Drawing Click Handler
      map.on('click', (e) => {
        if (!isDrawingMode) return;
        setDrawVertices((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      });

      mapInstanceRef.current = map;

      map.on('load', () => {
        map.resize();
        setupAllSourcesAndLayers(map);
      });
    } catch (err) {
      console.warn('MapLibre init notice:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [setupAllSourcesAndLayers, isDrawingMode]);

  // Sync data updates to sources
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const dSrc: any = map.getSource('gujarat-districts-source');
    if (dSrc && filteredGeoJson) {
      dSrc.setData(filteredGeoJson);
    }

    const tSrc: any = map.getSource('district-talukas-source');
    if (tSrc) {
      tSrc.setData(filteredTalukasGeoJson || { type: 'FeatureCollection', features: [] });
    }

    const vSrc: any = map.getSource('taluka-villages-source');
    if (vSrc) {
      vSrc.setData(filteredVillagesGeoJson || { type: 'FeatureCollection', features: [] });
    }

    applyLayerVisibilities(effectiveViewLevel);
    updateLayerStyles(effectiveViewLevel);
  }, [
    filteredGeoJson,
    filteredTalukasGeoJson,
    filteredVillagesGeoJson,
    effectiveViewLevel,
    applyLayerVisibilities,
    updateLayerStyles,
  ]);

  // Sync Drawing Vertices to Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const drawSrc: any = map.getSource('custom-drawing-source');
    if (!drawSrc) return;

    if (drawVertices.length === 0) {
      drawSrc.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features: any[] = [];
    // Points
    drawVertices.forEach((coord, i) => {
      features.push({
        type: 'Feature',
        properties: { index: i },
        geometry: { type: 'Point', coordinates: coord },
      });
    });

    // Line / Polygon
    if (drawVertices.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: drawVertices },
      });
    }

    if (drawVertices.length >= 3) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...drawVertices, drawVertices[0]]] },
      });
    }

    drawSrc.setData({ type: 'FeatureCollection', features });
  }, [drawVertices]);

  // Reset view button handler
  const handleResetView = () => {
    if (clickPopupRef.current) clickPopupRef.current.remove();
    setHoverPos(null);
    setHoveredEntity(null);
    handleSwitchLevel('DISTRICT');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: [GUJARAT_CENTER.lng, GUJARAT_CENTER.lat],
        zoom: 6.8,
        duration: 800,
      });
    }
    setSearchQuery('');
  };

  // Handle Custom Boundary Drawing
  const handleSaveCustomBoundary = async () => {
    if (drawVertices.length < 3) {
      alert(t('superAdmin.map.minPointsAlert'));
      return;
    }
    if (!saveReason.trim()) {
      alert(t('superAdmin.map.reasonRequiredAlert'));
      return;
    }
    setIsSavingBoundary(true);
    try {
      const closed = [...drawVertices, drawVertices[0]];
      const geometry = {
        type: 'Polygon',
        coordinates: [closed],
      };
      if (onCustomBoundarySave) {
        await onCustomBoundarySave(geometry, saveReason);
      }
      setIsDrawingMode(false);
      setDrawVertices([]);
      setSaveReason('');
      alert(t('superAdmin.map.saveSuccessAlert'));
    } catch (err: any) {
      alert(err?.message || t('superAdmin.map.saveFailedAlert'));
    } finally {
      setIsSavingBoundary(false);
    }
  };

  return (
    <Card className="overflow-hidden border border-[#E2E8F0] shadow-xs bg-white">
      {/* Map Header Toolbar */}
      <div className="p-3 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#135D43]" />
            <h2 className="text-sm font-bold text-[#0F172A] font-heading">{mapTitle}</h2>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">{mapSubtitle}</p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Level Switcher: District / Taluka / Village View Buttons */}
          <div className="flex items-center bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleSwitchLevel('DISTRICT')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${effectiveViewLevel === 'DISTRICT'
                ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
            >
              District View
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLevel('TALUKA')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${effectiveViewLevel === 'TALUKA'
                ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
            >
              Taluka View
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLevel('VILLAGE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${effectiveViewLevel === 'VILLAGE'
                ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
            >
              Village View
            </button>
          </div>

          {/* Status Filter (District level) */}
          {effectiveViewLevel === 'DISTRICT' && (
            <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterStatus === 'ALL'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
              >
                {t('superAdmin.map.all')} ({formatNumber(geoJsonData?.features?.length || 0)})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('ASSIGNED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${filterStatus === 'ASSIGNED'
                  ? 'bg-[#E8F5E9] text-[#135D43] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#135D43]'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#135D43]" />
                {t('superAdmin.map.assigned')}
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('UNASSIGNED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${filterStatus === 'UNASSIGNED'
                  ? 'bg-slate-200 text-slate-800 shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-slate-800'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                {t('superAdmin.map.unassigned')}
              </button>
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                effectiveViewLevel === 'VILLAGE'
                  ? 'Search village...'
                  : effectiveViewLevel === 'TALUKA'
                    ? 'Search taluka...'
                    : t('superAdmin.map.searchPlaceholder')
              }
              className="pl-8 pr-3 py-1 text-xs border border-[#CBD5E1] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#135D43] w-36 sm:w-44"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Drawing Mode Toggle */}
          {enableDrawingMode && effectiveViewLevel === 'DISTRICT' && (
            <Button
              variant={isDrawingMode ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setIsDrawingMode(!isDrawingMode);
                if (isDrawingMode) setDrawVertices([]);
              }}
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            >
              {isDrawingMode ? t('superAdmin.map.stopDrawing') : t('superAdmin.map.editBoundary')}
            </Button>
          )}

          {/* Reset View */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetView}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {t('superAdmin.map.reset')}
          </Button>
        </div>
      </div>

      {/* Hierarchical Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0] overflow-x-auto">
        <button
          type="button"
          onClick={() => handleSwitchLevel('DISTRICT')}
          className={`flex items-center gap-1 hover:text-[#135D43] transition-colors ${effectiveViewLevel === 'DISTRICT' ? 'font-bold text-[#135D43]' : 'text-slate-600'
            }`}
        >
          <Globe className="w-3.5 h-3.5 text-[#135D43]" />
          <span>Gujarat State</span>
        </button>

        {selectedDistrictProps && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => handleSwitchLevel('TALUKA')}
              className={`hover:text-[#135D43] transition-colors ${effectiveViewLevel === 'TALUKA' ? 'font-bold text-[#135D43]' : 'text-slate-600'
                }`}
            >
              {localizeDistrict(selectedDistrictProps)}
            </button>
          </>
        )}

        {selectedTalukaProps && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => handleSwitchLevel('VILLAGE')}
              className={`hover:text-[#135D43] transition-colors ${effectiveViewLevel === 'VILLAGE' ? 'font-bold text-[#135D43]' : 'text-slate-600'
                }`}
            >
              {selectedTalukaProps.name_gu || selectedTalukaProps.name_en}
            </button>
          </>
        )}

        {selectedVillageProps && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-bold text-[#0F172A]">
              {selectedVillageProps.name_gu || selectedVillageProps.name_en}
            </span>
          </>
        )}

        {(isLoadingSubLayer || isInternalLoading) && (
          <span className="ml-auto text-[11px] text-[#135D43] font-semibold animate-pulse">
            Loading GIS Polygons...
          </span>
        )}
      </div>

      {/* Taluka Selector Strip in Village View */}
      {effectiveViewLevel === 'VILLAGE' && effectiveTalukasGeoJson?.features?.length > 0 && (
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-1.5 flex items-center gap-2 overflow-x-auto text-xs z-10">
          <span className="text-slate-600 font-bold shrink-0 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-[#135D43]" />
            <span>તાલુકો પસંદ કરો (Taluka):</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {(selectedDistrictId
              ? effectiveTalukasGeoJson.features.filter((f: any) => f.properties?.district_id === selectedDistrictId)
              : effectiveTalukasGeoJson.features.slice(0, 25)
            ).map((f: any) => {
              const tp = f.properties;
              const isCurr = tp.taluka_id === selectedTalukaId;
              return (
                <button
                  key={tp.taluka_id}
                  type="button"
                  onClick={() => {
                    onTalukaSelect?.(tp);
                    handleSwitchLevel('VILLAGE', tp.district_id, tp);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 ${
                    isCurr
                      ? 'bg-[#135D43] text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                  }`}
                >
                  {tp.name_gu || transliterateToGujarati(tp.name_en)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawing Instructions Banner */}
      {isDrawingMode && (
        <div className="bg-[#FAF5FF] border-b border-[#E9D5FF] px-3 py-2 flex items-center justify-between text-xs text-[#6B21A8]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-ping" />
            <span>
              <strong>{t('superAdmin.map.customModeActive')}</strong> {formatNumber(drawVertices.length)} {t('superAdmin.map.pointsAdded')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={saveReason}
              onChange={(e) => setSaveReason(e.target.value)}
              placeholder={t('superAdmin.map.reasonPlaceholder')}
              className="px-2 py-0.5 border border-[#D8B4FE] rounded-lg text-xs bg-white text-[#1E293B]"
            />
            <Button
              size="sm"
              variant="primary"
              onClick={handleSaveCustomBoundary}
              isLoading={isSavingBoundary}
              disabled={drawVertices.length < 3}
              leftIcon={<Save className="w-3 h-3" />}
            >
              {t('superAdmin.map.save')}
            </Button>
            <button
              type="button"
              onClick={() => setDrawVertices([])}
              className="text-xs text-rose-600 hover:underline px-1"
            >
              {t('superAdmin.map.clear')}
            </button>
          </div>
        </div>
      )}

      {/* Map Canvas Container */}
      <div className="relative w-full overflow-hidden" style={{ height }}>
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Taluka Inspector Card in Taluka View (as explicitly requested: "aa map ma hu click karu koi taluka ne to eno thodo data k detail side ma dekhavi joye") */}
        {effectiveViewLevel === 'TALUKA' && (selectedTalukaProps || internalSelectedTaluka) && (
          (() => {
            const activeTaluka = selectedTalukaProps || internalSelectedTaluka;
            return (
              <div className="absolute top-3 right-3 z-30 bg-white/95 backdrop-blur-xs border-2 border-[#135D43] rounded-xl p-3 shadow-lg max-w-xs pointer-events-auto animate-fade-in font-body text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                  <span className="text-[10px] font-bold text-[#135D43] uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                    તાલુકા વિગત (Taluka Details)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setInternalSelectedTaluka(null);
                      onTalukaSelect?.(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors"
                    title="બંધ કરો"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-sm font-bold text-[#0F172A] leading-snug">
                  {activeTaluka?.name_gu || transliterateToGujarati(activeTaluka?.name_en || '')}{' '}
                  {activeTaluka?.name_en ? `(${activeTaluka.name_en})` : ''}
                </div>
                <div className="mt-2 space-y-1.5 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">તાલુકા કોડ:</span>
                    <span className="font-mono font-bold text-slate-800">{activeTaluka?.code || selectedTalukaId || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">જિલ્લો:</span>
                    <span className="font-semibold text-slate-800">
                      {activeTaluka?.district_name_gu || selectedDistrictProps?.name_gu || activeTaluka?.district_name || 'ગુજરાત'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">કુલ ગામો:</span>
                    <span className="font-bold text-emerald-700">
                      {formatNumber(activeTaluka?.village_count || activeTaluka?.total_villages || 0)} ગામ
                    </span>
                  </div>
                  {activeTaluka?.vo_count !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">સોંપાયેલ VO:</span>
                      <span className="font-bold text-slate-800">{formatNumber(activeTaluka.vo_count)}</span>
                    </div>
                  )}
                  {activeTaluka?.fw_count !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">ક્ષેત્રીય સ્ટાફ (FW):</span>
                      <span className="font-bold text-slate-800">{formatNumber(activeTaluka.fw_count)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">સીમા સ્થિતિ:</span>
                    <span className="font-bold text-blue-700">૧૦૦% સત્તાવાર GIS સીમા</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">સોંપણી સ્થિતિ:</span>
                    {activeTaluka?.is_assigned || activeTaluka?.status === 'ASSIGNED' ? (
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        સોંપાયેલ (Assigned)
                      </span>
                    ) : (
                      <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        બાકી (Unassigned)
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSwitchLevel('VILLAGE', activeTaluka?.district_id, activeTaluka)}
                    className="w-full py-1.5 px-2.5 bg-[#135D43] text-white rounded-lg text-[11px] font-semibold hover:bg-[#0f4a35] transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    ગામડાં જુઓ (Explore Villages)
                  </button>
                </div>
              </div>
            );
          })()
        )}

        {/* Taluka Header Card in Village View (Matching Image 2 Reference Layout) */}
        {effectiveViewLevel === 'VILLAGE' && selectedTalukaProps && (
          <div className="absolute top-3 left-3 z-30 bg-white/95 backdrop-blur-xs border-2 border-slate-800 rounded-lg p-2.5 shadow-md max-w-xs pointer-events-auto animate-fade-in font-body">
            <div className="text-sm font-black text-slate-900 tracking-tight leading-tight">
              {selectedTalukaProps.name_gu || transliterateToGujarati(selectedTalukaProps.name_en)} તાલુકો
            </div>
            <div className="text-xs font-bold text-slate-700 mt-1 leading-tight">
              જિ. {selectedDistrictProps?.name_gu || selectedTalukaProps.district_name_gu || selectedTalukaProps.district_name || 'ગુજરાત'}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
              કુલ ગામો: {formatNumber(effectiveVillagesGeoJson?.features?.length || selectedTalukaProps.village_count || 0)}
            </div>
          </div>
        )}

        {/* North Arrow icon matching Image 2 Reference */}
        {effectiveViewLevel === 'VILLAGE' && (
          <div
            className="absolute top-3 right-14 z-30 w-9 h-9 rounded-full border-2 border-slate-700 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center shadow-md pointer-events-none"
            title="North Arrow"
          >
            <span className="text-[9px] font-black text-slate-900 leading-none">N</span>
            <span className="text-[11px] leading-none text-slate-900 font-black">▲</span>
          </div>
        )}

        {/* Dynamic Floating Cursor Tooltip (Follows mouse on hover) */}
        {hoveredEntity && hoverPos && (
          <div
            className="absolute z-40 pointer-events-none transform -translate-x-1/2 -translate-y-full transition-transform duration-75"
            style={{ left: hoverPos.x, top: hoverPos.y - 12 }}
          >
            <div className="bg-[#0F172A]/95 text-white backdrop-blur-md px-3 py-2 rounded-xl shadow-2xl border border-slate-700/80 text-xs min-w-[170px] whitespace-nowrap animate-fade-in">
              <div className="flex items-center gap-1.5 font-bold text-sky-400 text-sm">
                <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {hoveredEntity.type === 'DISTRICT'
                    ? localizeDistrict(hoveredEntity)
                    : hoveredEntity.name_gu || hoveredEntity.name_en}
                </span>
                {hoveredEntity.name_en && hoveredEntity.name_en !== hoveredEntity.name_gu && (
                  <span className="text-slate-300 font-normal text-xs">({hoveredEntity.name_en})</span>
                )}
              </div>

              {hoveredEntity.type === 'DISTRICT' && (
                <div className="mt-1 pt-1 border-t border-slate-700/80 space-y-1 text-[11px]">
                  {hoveredEntity.code && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">કોડ (Code):</span>
                      <span className="font-mono text-slate-200">{hoveredEntity.code}</span>
                    </div>
                  )}
                  {(hoveredEntity.villages_count !== undefined || hoveredEntity.village_count !== undefined) && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">ગામો (Villages):</span>
                      <span className="font-bold text-sky-300">{formatNumber(hoveredEntity.villages_count ?? hoveredEntity.village_count)}</span>
                    </div>
                  )}
                  {hoveredEntity.animal_count !== undefined && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">પશુધન (Animals):</span>
                      <span className="font-bold text-amber-300">{formatNumber(hoveredEntity.animal_count)} પશુ</span>
                    </div>
                  )}
                  {hoveredEntity.coverage_pct !== undefined && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">રસીકરણ કવરેજ:</span>
                      <span className="font-bold text-emerald-400">{hoveredEntity.coverage_pct}% ({formatNumber(hoveredEntity.vaccination_count || 0)} ડોઝ)</span>
                    </div>
                  )}
                  {hoveredEntity.disease_count !== undefined && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">રોગ સ્થિતિ:</span>
                      <span className={`font-bold ${hoveredEntity.disease_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {hoveredEntity.disease_count > 0 ? `${hoveredEntity.disease_count} સક્રિય કેસ` : 'રોગમુક્ત / સુરક્ષિત'}
                      </span>
                    </div>
                  )}
                  {hoveredEntity.daho_name && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">DAHO:</span>
                      <span className="font-semibold text-emerald-300">{hoveredEntity.daho_name}</span>
                    </div>
                  )}
                </div>
              )}

              {hoveredEntity.type === 'TALUKA' && (
                <div className="mt-1 pt-1 border-t border-slate-700/80 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">જિલ્લો (District):</span>
                    <span className="font-bold text-emerald-400">
                      {hoveredEntity.district_name_gu || hoveredEntity.district_name || hoveredEntity.district_name_en || '-'}
                    </span>
                  </div>
                  {hoveredEntity.code && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">કોડ (Code):</span>
                      <span className="font-mono text-slate-200">{hoveredEntity.code}</span>
                    </div>
                  )}
                  {hoveredEntity.village_count !== undefined && (
                    <div className="flex items-center justify-between text-[10px] text-slate-300 gap-3">
                      <span className="text-slate-400">ગામો (Villages):</span>
                      <span className="font-bold text-sky-300">{formatNumber(hoveredEntity.village_count)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hover Info Tooltip Badge (Fallback when mouse position is unavailable) */}
        {hoveredEntity && !hoverPos && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-[#CBD5E1] rounded-xl p-2.5 shadow-md z-20 pointer-events-none max-w-[calc(100%-24px)] sm:max-w-xs text-xs animate-fade-in break-words">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-[#0F172A] font-heading break-words">
                {hoveredEntity.type === 'DISTRICT'
                  ? localizeDistrict(hoveredEntity)
                  : hoveredEntity.name_gu || hoveredEntity.name_en}
              </span>
              {hoveredEntity.type === 'DISTRICT' && (
                <StatusChip
                  status={hoveredEntity.status === 'ASSIGNED' ? 'ACTIVE' : 'INACTIVE'}
                  label={hoveredEntity.status === 'ASSIGNED' ? t('superAdmin.map.assigned') : t('superAdmin.map.unassigned')}
                />
              )}
              {hoveredEntity.type === 'TALUKA' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                  TALUKA
                </span>
              )}
              {hoveredEntity.type === 'VILLAGE' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  VILLAGE
                </span>
              )}
            </div>

            {hoveredEntity.type === 'DISTRICT' && hoveredEntity.status === 'ASSIGNED' && (
              <p className="text-[11px] text-[#135D43] mt-1 font-medium truncate">
                DAHO: {hoveredEntity.daho_name || t('superAdmin.map.officialAssigned')}
              </p>
            )}

            {hoveredEntity.type === 'TALUKA' && (
              <div className="mt-1 space-y-0.5 text-[11px] text-[#64748B]">
                <p>Code: <span className="font-mono text-[#0F172A]">{hoveredEntity.code}</span></p>
                {hoveredEntity.district_name && (
                  <p>District: <span className="font-medium text-[#0F172A]">{hoveredEntity.district_name}</span></p>
                )}
                <p>
                  Villages: <span className="font-bold text-[#0F172A]">{formatNumber(hoveredEntity.village_count || 0)}</span> (Verified: {formatNumber(hoveredEntity.verified_village_count || 0)})
                </p>
              </div>
            )}

            {hoveredEntity.type === 'VILLAGE' && (
              <div className="mt-1 space-y-0.5 text-[11px] text-[#64748B]">
                <p>Code: <span className="font-mono text-[#0F172A]">{hoveredEntity.code}</span></p>
                {hoveredEntity.census_code && (
                  <p>Census/LGD: <span className="font-mono text-[#0F172A]">{hoveredEntity.census_code}</span></p>
                )}
                {hoveredEntity.taluka_name && (
                  <p>Taluka: <span className="font-medium text-[#0F172A]">{hoveredEntity.taluka_name}</span></p>
                )}
                <p>Status: <span className="font-bold text-emerald-700">✓ Verified Official Polygon</span></p>
              </div>
            )}

            {hoveredEntity.type === 'DISTRICT' && (
              <div className="mt-1 flex items-center gap-3 text-[11px] text-[#64748B] flex-wrap">
                <span>
                  {t('superAdmin.dashboard.registryTable.thTalukas')}:{' '}
                  {hoveredEntity.taluka_count !== undefined
                    ? formatNumber(hoveredEntity.taluka_count)
                    : t('superAdmin.map.dataAvailable')}
                </span>
                <span>
                  {t('superAdmin.dashboard.registryTable.thVillages')}:{' '}
                  {hoveredEntity.village_count !== undefined
                    ? formatNumber(hoveredEntity.village_count)
                    : t('superAdmin.map.dataAvailable')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Floating Map Legend */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs border border-[#E2E8F0] rounded-xl p-2.5 shadow-sm text-xs z-10 flex items-center gap-2 sm:gap-3 flex-wrap max-w-[calc(100%-24px)]">
          {effectiveViewLevel === 'DISTRICT' && (
            <>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md bg-[#135D43]" />
                <span className="text-slate-700 font-medium">{t('superAdmin.map.legendAssigned')}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md bg-slate-300" />
                <span className="text-slate-700 font-medium">{t('superAdmin.map.legendUnassigned')}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md border-2 border-[#2563EB] bg-[#2563EB]/20" />
                <span className="text-slate-700 font-medium">{t('superAdmin.map.legendSelected')}</span>
              </div>
            </>
          )}

          {effectiveViewLevel === 'TALUKA' && (
            <>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md bg-[#135D43]" />
                <span className="text-slate-700 font-medium">સોંપાયેલ તાલુકો (Assigned)</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md border border-[#1F2937] bg-[#0EA5E9]/10" />
                <span className="text-slate-700 font-medium">બાકી તાલુકો (Unassigned)</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md border-2 border-[#2563EB] bg-[#38BDF8]" />
                <span className="text-slate-700 font-medium">પસંદ કરેલ (Selected)</span>
              </div>
            </>
          )}

          {effectiveViewLevel === 'VILLAGE' && (
            <>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md border border-[#047857] bg-[#6EE7B7]" />
                <span className="text-slate-700 font-medium">Village Polygon</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md border-2 border-[#B45309] bg-[#F59E0B]" />
                <span className="text-slate-700 font-medium">Selected Village</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3.5 h-0.5 border-b-2 border-dashed border-[#0284C7]" />
                <span className="text-slate-500 text-[11px]">Taluka Boundary Context</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
