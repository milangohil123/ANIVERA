import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Search,
  MapPin,
  Crosshair,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '../common/Button';

export interface VillageLocationPickerProps {
  talukaName?: string;
  districtName?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationConfirmed: (location: {
    latitude: number;
    longitude: number;
    googlePlaceId?: string;
    formattedAddress?: string;
  }) => void;
  className?: string;
}

const DEFAULT_CENTER = { lat: 22.1704, lng: 71.6684 }; // Botad District Center

const FREE_OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

interface SearchSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const VillageLocationPicker: React.FC<VillageLocationPickerProps> = ({
  talukaName: _talukaName = 'બોટાદ',
  districtName: _districtName = 'બોટાદ',
  initialLat,
  initialLng,
  onLocationConfirmed,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerInstanceRef = useRef<maplibregl.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected Location State
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(() => {
    if (initialLat && initialLng) {
      return { lat: Number(initialLat), lng: Number(initialLng) };
    }
    return DEFAULT_CENTER;
  });

  const [formattedAddress, setFormattedAddress] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState<boolean>(Boolean(initialLat && initialLng));
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  // --------------------------------------------------------------------------
  // 1. Initialize MapLibre GL Map
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: FREE_OSM_STYLE,
        center: [coords.lng, coords.lat],
        zoom: initialLat && initialLng ? 13.5 : 11,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

      // Add Draggable Marker
      const marker = new maplibregl.Marker({
        draggable: true,
        color: '#135D43',
      })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);

      // Marker Drag End Listener
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const newLat = Number(lngLat.lat.toFixed(6));
        const newLng = Number(lngLat.lng.toFixed(6));
        setCoords({ lat: newLat, lng: newLng });
        setIsConfirmed(false);
        setStatusMessage({
          type: 'info',
          text: 'માર્કર ખસેડાયું. નવા સ્થાનને સાચવવા "સ્થાન પુષ્ટિ કરો" પર ક્લિક કરો.',
        });
      });

      // Map Click Listener to reposition marker
      map.on('click', (e) => {
        const newLat = Number(e.lngLat.lat.toFixed(6));
        const newLng = Number(e.lngLat.lng.toFixed(6));
        marker.setLngLat([newLng, newLat]);
        setCoords({ lat: newLat, lng: newLng });
        setIsConfirmed(false);
        setStatusMessage({
          type: 'info',
          text: 'ક્લિક કરેલ નવું સ્થાન પસંદ થયું. કૃપા કરીને "સ્થાન પુષ્ટિ કરો" દબાવો.',
        });
      });

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;
    } catch (err) {
      console.warn('MapLibre GL Picker initialization note:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position if initial coords change externally
  useEffect(() => {
    if (initialLat && initialLng) {
      const lat = Number(initialLat);
      const lng = Number(initialLng);
      setCoords({ lat, lng });
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLngLat([lng, lat]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter([lng, lat]);
      }
    }
  }, [initialLat, initialLng]);

  // --------------------------------------------------------------------------
  // 2. Free OpenStreetMap Nominatim Place Search
  // --------------------------------------------------------------------------
  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const query = `${val.trim()} Botad Gujarat`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`,
        { headers: { 'Accept-Language': 'gu,en' } }
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data || []);
        setShowDropdown((data || []).length > 0);
      }
    } catch (e) {
      console.warn('OpenStreetMap search fallback notice:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestion = (s: SearchSuggestion) => {
    const newLat = Number(parseFloat(s.lat).toFixed(6));
    const newLng = Number(parseFloat(s.lon).toFixed(6));
    setCoords({ lat: newLat, lng: newLng });
    setFormattedAddress(s.display_name);
    setSearchQuery(s.display_name.split(',')[0]);
    setShowDropdown(false);
    setIsConfirmed(false);

    if (markerInstanceRef.current) {
      markerInstanceRef.current.setLngLat([newLng, newLat]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: [newLng, newLat],
        zoom: 14,
        speed: 1.2,
      });
    }

    setStatusMessage({
      type: 'info',
      text: `સ્થાન "${s.display_name.split(',')[0]}" પસંદ થયું. પુષ્ટિ કરવા માટે નીચે બટન દબાવો.`,
    });
  };

  // --------------------------------------------------------------------------
  // 3. HTML5 Geolocation (Locate Me)
  // --------------------------------------------------------------------------
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'આ બ્રાઉઝરમાં જીઓ-લોકેશન સપોર્ટેડ નથી.' });
      return;
    }

    setIsLocating(true);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const newLat = Number(pos.coords.latitude.toFixed(6));
        const newLng = Number(pos.coords.longitude.toFixed(6));
        setCoords({ lat: newLat, lng: newLng });
        setIsConfirmed(false);

        if (markerInstanceRef.current) {
          markerInstanceRef.current.setLngLat([newLng, newLat]);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: [newLng, newLat],
            zoom: 15,
            speed: 1.4,
          });
        }

        setStatusMessage({
          type: 'success',
          text: `તમારું વર્તમાન જીપીએસ સ્થાન મેળવાયું (${newLat}, ${newLng}). સાચવવા માટે પુષ્ટિ કરો.`,
        });
      },
      (err) => {
        setIsLocating(false);
        setStatusMessage({
          type: 'error',
          text: `જીપીએસ સ્થાન મેળવી શકાયું નથી: ${err.message}`,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // --------------------------------------------------------------------------
  // 4. Confirm Location Handler
  // --------------------------------------------------------------------------
  const handleConfirmLocation = () => {
    setIsConfirmed(true);
    setStatusMessage({
      type: 'success',
      text: 'સ્થાન સફળતાપૂર્વક ચકાસાયેલ છે અને ફોર્મ સાથે લિંક કરવામાં આવ્યું છે.',
    });

    onLocationConfirmed({
      latitude: coords.lat,
      longitude: coords.lng,
      formattedAddress: formattedAddress || undefined,
    });
  };

  const handleManualCoordChange = (latVal: string, lngVal: string) => {
    const parsedLat = parseFloat(latVal);
    const parsedLng = parseFloat(lngVal);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      setCoords({ lat: parsedLat, lng: parsedLng });
      setIsConfirmed(false);
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLngLat([parsedLng, parsedLat]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({ center: [parsedLng, parsedLat], zoom: 14 });
      }
    }
  };

  return (
    <div className={`space-y-3 bg-[#F8FAFC] p-3 sm:p-4 rounded-xl border border-[#E2E8F0] ${className}`}>
      {/* Title & Free Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-[#135D43] flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-[#0F172A] font-heading">
              ગામનું ચોક્કસ ભૌગોલિક સ્થાન (GPS Geolocation)
            </h4>
            <p className="text-[10px] text-[#64748B]">
              ઓપનસ્ટ્રીટમેપ પર ક્લિક કરો અથવા માર્કરને ખેંચીને ચોક્કસ સ્થાન નિર્ધારિત કરો
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            OpenStreetMap Free
          </span>
        </div>
      </div>

      {/* Free Search & Current Location Control Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder="ગામ અથવા વિસ્તારનું નામ શોધો (દા.ત. પાળીયાદ, લાઠીદડ)..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#135D43]"
          />
          {isSearching && (
            <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
          )}

          {/* Autocomplete Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-56 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#135D43] mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2 text-slate-700">{s.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleLocateMe}
          isLoading={isLocating}
          leftIcon={<Crosshair className="w-3.5 h-3.5 text-[#0284C7]" />}
          className="whitespace-nowrap"
        >
          વર્તમાન સ્થાન મેળવો
        </Button>
      </div>

      {/* Map Canvas */}
      <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-[#E2E8F0] bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Instruction Chip */}
        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-xs text-[10px] text-slate-700 flex items-center gap-1 z-10 pointer-events-none">
          <Info className="w-3 h-3 text-[#135D43]" />
          <span>નકશા પર ક્લિક કરો અથવા લીલા માર્કરને ખસેડો</span>
        </div>
      </div>

      {/* Manual Coordinates Row & Confirmation Status */}
      <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              અક્ષાંશ (Latitude)
            </label>
            <input
              type="number"
              step="0.000001"
              value={coords.lat}
              onChange={(e) => handleManualCoordChange(e.target.value, String(coords.lng))}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              રેખાંશ (Longitude)
            </label>
            <input
              type="number"
              step="0.000001"
              value={coords.lng}
              onChange={(e) => handleManualCoordChange(String(coords.lat), e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
            />
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            ) : (
              <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            )}
            <span className="text-[11px]">{statusMessage.text}</span>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#0284C7] hover:underline flex items-center gap-1 font-medium self-start sm:self-auto"
            title="બાહ્ય Google Maps માં ચકાસો"
          >
            <ExternalLink className="w-3 h-3" />
            <span>બાહ્ય Google Maps માં દિશા નિર્દેશ જુઓ</span>
          </a>

          <Button
            type="button"
            variant={isConfirmed ? 'primary' : 'primary'}
            size="sm"
            onClick={handleConfirmLocation}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto"
          >
            {isConfirmed ? 'સ્થાન પુષ્ટિ થઈ ગયેલ છે ✓' : 'આ ભૌગોલિક સ્થાન પુષ્ટિ કરો'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VillageLocationPicker;
