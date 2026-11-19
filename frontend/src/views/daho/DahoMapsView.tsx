import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { GoogleMapViewer, type MapLayerMode } from '../../components/maps/GoogleMapViewer';
import {
  mapService,
  type MapLayersResponse,
} from '../../services/mapService';
import {
  RotateCcw,
  Table as TableIcon,
  Map as MapIcon,
  MapPin,
  Info,
} from 'lucide-react';

type ViewMode = 'MAP' | 'TABLE';

export const DahoMapsView: React.FC = () => {
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';

  const [layerData, setLayerData] = useState<MapLayersResponse | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerMode>('VACCINATION');
  const [viewMode, setViewMode] = useState<ViewMode>('MAP');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoadDoneRef = useRef(false);

  const loadLayers = useCallback(async (isSilent = false) => {
    if (!token) return;

    if (!isInitialLoadDoneRef.current) {
      setIsLoading(true);
    } else if (!isSilent) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const data = await mapService.getLayers(apiBaseUrl, token);
      setLayerData(data);
      isInitialLoadDoneRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'નકશા ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    loadLayers(false);
  }, [apiBaseUrl]);

  const mappedVillages = useMemo(() => layerData?.mappedVillages || [], [layerData?.mappedVillages]);
  const unmappedVillages = useMemo(() => layerData?.unmappedVillages || [], [layerData?.unmappedVillages]);
  const surveillanceLayer = useMemo(() => layerData?.surveillanceLayer || {}, [layerData?.surveillanceLayer]);
  const vaccinationLayer = useMemo(() => layerData?.vaccinationLayer || {}, [layerData?.vaccinationLayer]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10 animate-fade-in">
      {/* -------------------------------------------------------------------- */}
      {/* Action / View Switcher Bar                                           */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#135D43]" />
          <h2 className="text-sm font-bold text-[#0F172A] font-heading">
            જિલ્લા ભૌગોલિક નકશો અને જીઓ-ડેટા (Geospatial & Map Layers)
          </h2>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
            DAHO_DISTRICT_SCOPE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
            <button
              onClick={() => setViewMode('MAP')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'MAP'
                  ? 'bg-white shadow-xs text-[#135D43]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              નકશો (Interactive GIS)
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-white shadow-xs text-[#135D43]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              કોષ્ટક (Table View)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLayers(false)}
            isLoading={isRefreshing}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#135D43]" />}
            className="text-xs py-1.5"
          >
            તાજું કરો
          </Button>
        </div>
      </div>

      {/* Governance Invariant Alert */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#334155] flex items-start gap-2">
        <Info className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
        <div>
          <strong>સરકારી સર્વેક્ષણ સિદ્ધાંત:</strong> જે ગામમાં કોઈ રિપોર્ટ નથી તેને ‘રોગમુક્ત’ નહીં પણ તટસ્થ ‘કોઈ રિપોર્ટ નથી / ડેટા અપૂરતો’ ગણવામાં આવે છે. રસીકરણ પ્રગતિ ચોક્કસ નોંધાયેલ ડોઝ અને કુલ પશુધન ગુણોત્તર મુજબ ગણવામાં આવે છે.
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Main View Area (Interactive Map or Table)                            */}
      {/* -------------------------------------------------------------------- */}
      {isLoading ? (
        <StateView state="loading" message="જિલ્લા જીઓસ્પેશિયલ નકશો લોડ થઈ રહ્યો છે..." />
      ) : error ? (
        <StateView state="error" message={error} onRetry={loadLayers} />
      ) : viewMode === 'MAP' ? (
        <GoogleMapViewer
          mappedVillages={mappedVillages}
          unmappedVillages={unmappedVillages}
          surveillanceLayer={surveillanceLayer}
          vaccinationLayer={vaccinationLayer}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          roleScope="DAHO"
          title="બોટાદ જિલ્લો ભૌગોલિક પોર્ટલ (DAHO District GIS)"
          subtitle="જિલ્લાના તમામ તાલુકા અને ગામડાઓમાં રસીકરણ સિદ્ધિ દર અને રોગ સર્વેક્ષણ જીઓ-મોનિટરિંગ."
        />
      ) : (
        /* Table View */
        <Card className="overflow-hidden border border-[#E2E8F0] shadow-xs">
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] font-heading">
                જિલ્લા ગામવાર રસીકરણ કવરેજ અને રોગ સર્વેક્ષણ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                બોટાદ જિલ્લાના અધિકૃત ડેટાબેઝ રેકોર્ડ્સ
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
              કુલ ગામ: {mappedVillages.length + unmappedVillages.length}
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-slate-500 border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">ગામનું નામ</th>
                <th className="p-3.5">કોડ</th>
                <th className="p-3.5">સ્થાન સ્થિતિ</th>
                <th className="p-3.5 text-right">શંકાસ્પદ કેસ</th>
                <th className="p-3.5 text-right">પુષ્ટિ થયેલ કેસ</th>
                <th className="p-3.5 text-right">રસીકરણ સંખ્યા</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {[...mappedVillages, ...unmappedVillages].map((v) => {
                const surv = surveillanceLayer[v.villageId];
                const vac = vaccinationLayer[v.villageId];
                return (
                  <tr key={v.villageId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-[#0F172A]">{v.nameGu}</td>
                    <td className="p-3.5 font-mono text-slate-500">{v.code}</td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                        <MapPin className="w-2.5 h-2.5 text-slate-500" />
                        {v.latitude ? 'ચકાસાયેલ જીઓ-પોઇન્ટ' : 'સંદર્ભ જીઓ-પોઇન્ટ'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-amber-700">
                      {surv?.suspectedCount || 0}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-red-700">
                      {surv?.confirmedCount || 0}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-800">
                      {vac?.totalVaccinatedCount || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};
export default DahoMapsView;
