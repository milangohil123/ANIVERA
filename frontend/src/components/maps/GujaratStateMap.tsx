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

const GUJARAT_CENTER = { lng: 71.55, lat: 22.35 };

const FREE_OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
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
  const [internalTalukasGeoJson, setInternalTalukasGeoJson] = useState<any | null>(null);
  const [internalVillagesGeoJson, setInternalVillagesGeoJson] = useState<any | null>(null);
  const [isInternalLoading, setIsInternalLoading] = useState<boolean>(false);

  const effectiveTalukasGeoJson = talukasGeoJson || internalTalukasGeoJson;
  const effectiveVillagesGeoJson = villagesGeoJson || internalVillagesGeoJson;

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredEntity, setHoveredEntity] = useState<any | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);
  const [saveReason, setSaveReason] = useState<string>('');
  const [isSavingBoundary, setIsSavingBoundary] = useState<boolean>(false);

  // Filter district features
  const filteredGeoJson = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return null;
    let feats = geoJsonData.features;

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
  }, [geoJsonData, filterStatus, searchQuery, effectiveViewLevel]);

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
    if (!map || !map.isStyleLoaded()) return;

    if (lvl === 'DISTRICT') {
      // District View: Only District Polygons are primary
      if (map.getLayer('districts-fill')) map.setLayoutProperty('districts-fill', 'visibility', 'visible');
      if (map.getLayer('districts-borders')) map.setLayoutProperty('districts-borders', 'visibility', 'visible');
      if (map.getLayer('districts-context-line')) map.setLayoutProperty('districts-context-line', 'visibility', 'none');

      if (map.getLayer('talukas-fill')) map.setLayoutProperty('talukas-fill', 'visibility', 'none');
      if (map.getLayer('talukas-borders')) map.setLayoutProperty('talukas-borders', 'visibility', 'none');
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
      if (map.getLayer('talukas-context-line')) map.setLayoutProperty('talukas-context-line', 'visibility', 'visible');

      if (map.getLayer('villages-fill')) map.setLayoutProperty('villages-fill', 'visibility', 'visible');
      if (map.getLayer('villages-borders')) map.setLayoutProperty('villages-borders', 'visibility', 'visible');
    }
  }, []);

  // Dedicated Dynamic Paint Properties Updater (Synchronous Highlight Reflection)
  const updateLayerStyles = useCallback((lvl: 'DISTRICT' | 'TALUKA' | 'VILLAGE') => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

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
      if (map.getLayer('talukas-fill')) {
        map.setPaintProperty('talukas-fill', 'fill-color', [
          'case',
          ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
          '#38BDF8',
          '#BAE6FD',
        ]);
        map.setPaintProperty('talukas-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
          0.8,
          0.45,
        ]);
      }
      if (map.getLayer('talukas-borders')) {
        map.setPaintProperty('talukas-borders', 'line-color', [
          'case',
          ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
          '#2563EB',
          '#0284C7',
        ]);
        map.setPaintProperty('talukas-borders', 'line-width', [
          'case',
          ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
          3.5,
          1.8,
        ]);
      }
    } else if (lvl === 'VILLAGE') {
      if (map.getLayer('villages-fill')) {
        map.setPaintProperty('villages-fill', 'fill-color', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          '#F59E0B',
          '#6EE7B7',
        ]);
        map.setPaintProperty('villages-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          0.85,
          0.55,
        ]);
      }
      if (map.getLayer('villages-borders')) {
        map.setPaintProperty('villages-borders', 'line-color', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          '#B45309',
          '#047857',
        ]);
        map.setPaintProperty('villages-borders', 'line-width', [
          'case',
          ['==', ['get', 'village_id'], selectedVillageId || ''],
          3.0,
          1.2,
        ]);
      }
    }
  }, [selectedDistrictId, selectedTalukaId, selectedVillageId]);

  // Sync Paint Properties when selection or level changes
  useEffect(() => {
    updateLayerStyles(effectiveViewLevel);
  }, [selectedDistrictId, selectedTalukaId, selectedVillageId, effectiveViewLevel, updateLayerStyles]);

  // View Level Switching Logic
  const handleSwitchLevel = useCallback(async (level: 'DISTRICT' | 'TALUKA' | 'VILLAGE', targetDistrictId?: string) => {
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
        const distId = targetDistrictId || selectedDistrictId;
        let tData = effectiveTalukasGeoJson;
        // Fetch talukas if not yet available or if target district differs
        if (
          !tData ||
          !tData.features ||
          tData.features.length === 0 ||
          (distId && tData.features[0]?.properties?.district_id !== distId)
        ) {
          tData = await adminService.getDistrictTalukasGeoJson(apiBaseUrl, distId);
          setInternalTalukasGeoJson(tData);
        }

        const tSrc: any = map.getSource('district-talukas-source');
        if (tSrc && tData) {
          tSrc.setData(tData);
        }

        applyLayerVisibilities('TALUKA');
        updateLayerStyles('TALUKA');

        if (tData?.features?.length > 0) {
          const b = getFeatureCollectionBounds(tData);
          if (b) map.fitBounds(b, { padding: 50, duration: 800 });
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
        let vData = effectiveVillagesGeoJson;

        if (selectedTalukaId) {
          // Chosen taluka: load its villages directly
          if (
            !vData ||
            !vData.features ||
            vData.features.length === 0 ||
            vData.features[0]?.properties?.taluka_id !== selectedTalukaId
          ) {
            vData = await adminService.getTalukaVillagesGeoJson(apiBaseUrl, selectedTalukaId);
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
            if (b) map.fitBounds(b, { padding: 50, duration: 800 });
          }
        } else if (selectedDistrictId) {
          // District chosen without a taluka: ensure talukas for this district are loaded so user can browse
          let tData = effectiveTalukasGeoJson;
          if (
            !tData ||
            !tData.features ||
            tData.features.length === 0 ||
            tData.features[0]?.properties?.district_id !== selectedDistrictId
          ) {
            tData = await adminService.getDistrictTalukasGeoJson(apiBaseUrl, selectedDistrictId);
            setInternalTalukasGeoJson(tData);
            const tSrc: any = map.getSource('district-talukas-source');
            if (tSrc) tSrc.setData(tData);
          }

          // Show talukas so user can click to drill into village view
          applyLayerVisibilities('TALUKA');
          updateLayerStyles('TALUKA');
          if (tData?.features?.length > 0) {
            const b = getFeatureCollectionBounds(tData);
            if (b) map.fitBounds(b, { padding: 50, duration: 800 });
          }
        } else {
          // Neither district nor taluka selected: fall back to district view
          applyLayerVisibilities('DISTRICT');
          updateLayerStyles('DISTRICT');
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
        paint: {
          'fill-color': [
            'case',
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

      // District Interaction Handlers
      map.on('click', 'districts-fill', (e) => {
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
          setHoveredEntity({
            type: 'DISTRICT',
            ...e.features[0].properties,
          });
        }
      });

      map.on('mouseleave', 'districts-fill', () => {
        if (isDrawingMode) return;
        map.getCanvas().style.cursor = '';
        setHoveredEntity(null);
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

      // 2.1 Taluka Polygon Fill
      map.addLayer({
        id: 'talukas-fill',
        type: 'fill',
        source: tSource,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
            '#38BDF8',
            '#BAE6FD',
          ],
          'fill-opacity': 0.45,
        },
      });

      // 2.2 Taluka Context Line (Subtle dashed outline in Village View)
      map.addLayer({
        id: 'talukas-context-line',
        type: 'line',
        source: tSource,
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#0284C7',
          'line-width': 1.8,
          'line-dasharray': [4, 2],
        },
      });

      // 2.3 Taluka Primary Borders (Solid sharp outlines in Taluka View)
      map.addLayer({
        id: 'talukas-borders',
        type: 'line',
        source: tSource,
        layout: {
          visibility: 'none',
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
            '#2563EB',
            '#0284C7',
          ],
          'line-width': [
            'case',
            ['==', ['get', 'taluka_id'], selectedTalukaId || ''],
            3.5,
            1.8,
          ],
        },
      });

      // Taluka Interaction Handlers
      map.on('click', 'talukas-fill', (e) => {
        if (isDrawingMode) return;
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          onTalukaSelect?.(props);
          const b = getGeometryBounds(e.features[0].geometry);
          if (b) {
            map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 800 });
          }
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
        }
      });

      map.on('mouseleave', 'talukas-fill', () => {
        if (isDrawingMode) return;
        map.getCanvas().style.cursor = '';
        setHoveredEntity(null);
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
            '#F59E0B',
            '#6EE7B7',
          ],
          'fill-opacity': 0.55,
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
            '#B45309',
            '#047857',
          ],
          'line-width': [
            'case',
            ['==', ['get', 'village_id'], selectedVillageId || ''],
            3.0,
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
        }
      });

      map.on('mouseleave', 'villages-fill', () => {
        if (isDrawingMode) return;
        map.getCanvas().style.cursor = '';
        setHoveredEntity(null);
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
    if (!map || !map.isStyleLoaded()) return;

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
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                effectiveViewLevel === 'DISTRICT'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              District View
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLevel('TALUKA')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                effectiveViewLevel === 'TALUKA'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Taluka View
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLevel('VILLAGE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                effectiveViewLevel === 'VILLAGE'
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
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterStatus === 'ALL'
                    ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {t('superAdmin.map.all')} ({formatNumber(geoJsonData?.features?.length || 0)})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('ASSIGNED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  filterStatus === 'ASSIGNED'
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
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  filterStatus === 'UNASSIGNED'
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
          className={`flex items-center gap-1 hover:text-[#135D43] transition-colors ${
            effectiveViewLevel === 'DISTRICT' ? 'font-bold text-[#135D43]' : 'text-slate-600'
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
              className={`hover:text-[#135D43] transition-colors ${
                effectiveViewLevel === 'TALUKA' ? 'font-bold text-[#135D43]' : 'text-slate-600'
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
              className={`hover:text-[#135D43] transition-colors ${
                effectiveViewLevel === 'VILLAGE' ? 'font-bold text-[#135D43]' : 'text-slate-600'
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

      {/* Guided Taluka Selection Banner in Village View (When District is chosen but Taluka not yet picked) */}
      {effectiveViewLevel === 'VILLAGE' && !selectedTalukaId && selectedDistrictProps && (
        <div className="bg-emerald-50/95 border-b border-emerald-200 px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#135D43] shrink-0" />
            <span className="text-[#0F172A] font-medium">
              Select a Taluka from <strong>{localizeDistrict(selectedDistrictProps)}</strong> to load its village boundaries:
            </span>
          </div>
          {effectiveTalukasGeoJson?.features?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {effectiveTalukasGeoJson.features.map((f: any) => {
                const tp = f.properties;
                return (
                  <button
                    key={tp.taluka_id}
                    type="button"
                    onClick={() => {
                      onTalukaSelect?.(tp);
                      handleSwitchLevel('VILLAGE');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition-colors font-medium text-[11px] shadow-xs"
                  >
                    {tp.name_gu || tp.name_en} ({tp.village_count || 0})
                  </button>
                );
              })}
            </div>
          )}
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
      <div className="relative w-full" style={{ height }}>
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Hover Info Tooltip Badge */}
        {hoveredEntity && (
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
                <span className="w-3 h-3 rounded-md border border-[#0284C7] bg-[#BAE6FD]" />
                <span className="text-slate-700 font-medium">Taluka Polygon</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-md border-2 border-[#2563EB] bg-[#38BDF8]" />
                <span className="text-slate-700 font-medium">Selected Taluka Highlight</span>
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
