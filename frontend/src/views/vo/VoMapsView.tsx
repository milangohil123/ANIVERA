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
  dutyService,
  type LiveFieldWorkerItem,
} from '../../services/dutyService';
import {
  RotateCcw,
  Table as TableIcon,
  Map as MapIcon,
  MapPin,
} from 'lucide-react';

type ViewMode = 'MAP' | 'TABLE';

export const VoMapsView: React.FC = () => {
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';
  const isFw = session?.user?.role === 'FIELD_WORKER' || session?.user?.role === 'FW';

  const [layerData, setLayerData] = useState<MapLayersResponse | null>(null);
  const [liveFieldWorkers, setLiveFieldWorkers] = useState<LiveFieldWorkerItem[]>([]);
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
      const [data, fwData] = await Promise.all([
        mapService.getLayers(apiBaseUrl, token),
        dutyService.getVoLiveFieldWorkers(apiBaseUrl).catch(() => ({
          total_field_workers: 0,
          active_on_duty: 0,
          fresh_location_count: 0,
          stale_location_count: 0,
          field_workers: [],
        })),
      ]);
      setLayerData(data);
      setLiveFieldWorkers(fwData.field_workers || []);
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

    // 20-second automatic polling for live field worker GPS updates
    const intervalId = window.setInterval(async () => {
      try {
        const fwData = await dutyService.getVoLiveFieldWorkers(apiBaseUrl);
        if (fwData && Array.isArray(fwData.field_workers)) {
          setLiveFieldWorkers(fwData.field_workers);
        }
      } catch (e) {
        console.debug('Background live field worker polling skipped:', e);
      }
    }, 20000);

    return () => {
      clearInterval(intervalId);
    };
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-[#135D43]" />
          <h2 className="text-sm font-bold text-[#0F172A] font-heading">
            {isFw ? 'કાર્યક્ષેત્ર ગામડાઓ ભૌગોલિક નકશો' : 'કાર્યક્ષેત્ર ગામડાઓ અને લાઇવ ફિલ્ડ વર્કર્સ નકશો'}
          </h2>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
            {isFw ? 'FW_SCOPE' : 'VO_SCOPE'}
          </span>

          {/* Active Field Workers Badge */}
          {liveFieldWorkers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E6F3EF] text-[#164E45] border border-[#176B5B]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#176B5B] animate-ping" />
              <span>
                {liveFieldWorkers.filter((f) => f.duty_status === 'ACTIVE').length} ક્ષેત્રીય કાર્યકર લાઇવ
              </span>
            </span>
          )}
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
              નકશો
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
              કોષ્ટક દર્શન
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

      {/* -------------------------------------------------------------------- */}
      {/* Main View Area (Interactive Map or Table)                            */}
      {/* -------------------------------------------------------------------- */}
      {isLoading ? (
        <StateView state="loading" message="જીઓસ્પેશિયલ નકશો લોડ થઈ રહ્યો છે..." />
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
          liveFieldWorkers={liveFieldWorkers}
          roleScope={isFw ? 'FW' : 'VO'}
          title={isFw ? 'કાર્યક્ષેત્ર ગામડાઓ ભૌગોલિક નકશો' : 'કાર્યક્ષેત્ર ગામડાઓ અને ફિલ્ડ વર્કર્સ ભૌગોલિક નકશો'}
          subtitle={
            isFw
              ? 'તમારા અધિકૃત કાર્યક્ષેત્રના ગામડાઓ માટે રસીકરણ કવરેજ અને રોગ સર્વેક્ષણ નકશો.'
              : 'તમારા અધિકૃત ગામડાઓ માટે રસીકરણ, રોગ સર્વેક્ષણ અને ફિલ્ડ વર્કર્સનું લાઇવ GPS મોનિટરિંગ.'
          }
        />
      ) : (
        /* Table View */
        <div className="space-y-4">
          {/* Live Field Workers Table */}
          {liveFieldWorkers.length > 0 && (
            <Card className="overflow-hidden border border-teal-200 shadow-xs">
              <div className="p-4 bg-teal-50/50 border-b border-teal-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    લાઇવ ફિલ્ડ વર્કર્સ (Field Workers Status)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ડ્યૂટી સ્થિતિ, GPS સ્થાન તાજગી અને સોંપાયેલ કાર્યભાર
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-teal-800 bg-white px-2 py-1 rounded border border-teal-200">
                  કુલ: {liveFieldWorkers.length} | સક્રિય: {liveFieldWorkers.filter((f) => f.duty_status === 'ACTIVE').length}
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-slate-500 border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">કાર્યકર નામ</th>
                    <th className="p-3.5">ડ્યૂટી સ્થિતિ</th>
                    <th className="p-3.5">સ્થાન તાજગી</th>
                    <th className="p-3.5">છેલ્લું GPS અપડેટ</th>
                    <th className="p-3.5 text-right">સક્રિય સોંપણી</th>
                    <th className="p-3.5 text-right">બાકી કેસ</th>
                    <th className="p-3.5">સોંપાયેલ ગામડાઓ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {liveFieldWorkers.map((fw) => (
                    <tr key={fw.fw_user_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{fw.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{fw.mobile_e164 || '—'}</div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            fw.duty_status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              fw.duty_status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          />
                          <span>{fw.duty_status === 'ACTIVE' ? 'સક્રિય' : 'ડ્યૂટી બંધ'}</span>
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            fw.freshness === 'FRESH'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : fw.freshness === 'STALE'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {fw.freshness === 'FRESH'
                            ? 'તાજું (<૧૫ મિ.)'
                            : fw.freshness === 'STALE'
                            ? 'જૂનું (>૧૫ મિ.)'
                            : 'અનુપલબ્ધ'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">
                        {fw.last_location_update
                          ? new Date(fw.last_location_update).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                        {fw.active_assignments_count}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-amber-700">
                        {fw.pending_complaints_count}
                      </td>
                      <td className="p-3.5 text-slate-700 font-medium">
                        {fw.assigned_villages_gu && fw.assigned_villages_gu.length > 0
                          ? fw.assigned_villages_gu.join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Villages Coverage Table */}
          <Card className="overflow-hidden border border-[#E2E8F0] shadow-xs">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] font-heading">
                  અધિકૃત ગામવાર કવરેજ અને કેસ યાદી
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  સત્તાવાર ડેટાબેઝ રેકોર્ડ્સ અને ચકાસાયેલ સ્ટેટસ
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
        </div>
      )}
    </div>
  );
};
export default VoMapsView;
