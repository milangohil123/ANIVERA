import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import { dutyService, type LiveFieldWorkerItem, type ComplaintGroupResponse } from '../../services/dutyService';
import { voService } from '../../services/voService';
import {
  Users,
  Search,
  RotateCcw,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  Radio,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const VoStaffView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [liveFws, setLiveFws] = useState<LiveFieldWorkerItem[]>([]);
  const [fieldWorkerAccounts, setFieldWorkerAccounts] = useState<any[]>([]);
  const [complaintGroups, setComplaintGroups] = useState<ComplaintGroupResponse[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detail Modal
  const [selectedFw, setSelectedFw] = useState<LiveFieldWorkerItem | null>(null);
  const [fwAssignedGroups, setFwAssignedGroups] = useState<ComplaintGroupResponse[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const [dutyData, fwList, groups, vList] = await Promise.all([
        dutyService.getVoLiveFieldWorkers(apiBaseUrl).catch(() => ({
          total_field_workers: 0,
          active_on_duty: 0,
          fresh_location_count: 0,
          stale_location_count: 0,
          field_workers: [],
        })),
        voService.listFieldWorkers(apiBaseUrl).catch(() => []),
        dutyService.listComplaintGroups(apiBaseUrl).catch(() => []),
        voService.listVillages(apiBaseUrl).catch(() => []),
      ]);

      setLiveFws(dutyData.field_workers || []);
      setFieldWorkerAccounts(fwList);
      setComplaintGroups(groups);
      setVillages(vList);
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ક્ષેત્રીય સ્ટાફ માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 20-second automatic polling for live GPS location updates
    const interval = setInterval(() => {
      dutyService
        .getVoLiveFieldWorkers(apiBaseUrl)
        .then((dutyData) => {
          if (dutyData && Array.isArray(dutyData.field_workers)) {
            setLiveFws(dutyData.field_workers);
          }
        })
        .catch(() => {});
    }, 20000);

    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const handleOpenFwModal = (fw: LiveFieldWorkerItem) => {
    setSelectedFw(fw);
    const assigned = complaintGroups.filter((g) => g.assigned_fw_user_id === fw.fw_user_id);
    setFwAssignedGroups(assigned);
  };

  const filteredFws = useMemo(() => {
    return liveFws.filter((fw) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        fw.full_name.toLowerCase().includes(q) ||
        (fw.mobile_e164 && fw.mobile_e164.includes(q))
      );
    });
  }, [liveFws, searchQuery]);

  const totalFws = liveFws.length;
  const activeOnDuty = liveFws.filter((f) => f.duty_status === 'ACTIVE').length;
  const freshLocations = liveFws.filter((f) => f.is_location_fresh).length;
  const totalAssignedTasks = complaintGroups.filter((g) => !!g.assigned_fw_user_id).length;

  const columns: Column<LiveFieldWorkerItem>[] = [
    {
      key: 'worker_info',
      header: 'ક્ષેત્રીય કાર્યકરનું નામ અને હોદ્દો',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <span>{row.full_name}</span>
            {row.duty_status === 'ACTIVE' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="ઓનલાઇન" />
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {row.mobile_e164 || 'સંપર્ક નંબર ઉપલબ્ધ નથી'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'ડ્યૂટી સ્થિતિ',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            row.duty_status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${row.duty_status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-400'}`}
          />
          <span>{row.duty_status === 'ACTIVE' ? 'ડ્યૂટી પર સક્રિય' : 'ડ્યૂટી બંધ'}</span>
        </span>
      ),
    },
    {
      key: 'location',
      header: 'GPS લોકેશન અને તાજગી',
      render: (row) => (
        <div className="text-xs text-slate-700">
          {row.last_latitude && row.last_longitude ? (
            <div>
              <div className="flex items-center gap-1 font-mono text-[11px] text-[#135D43]">
                <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                <span>
                  {row.last_latitude.toFixed(3)}, {row.last_longitude.toFixed(3)}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {row.is_location_fresh ? '✓ તાજી લોકેશન (Live)' : 'સ્થિર લોકેશન'}
              </div>
            </div>
          ) : (
            <span className="text-slate-400 text-xs">કોઈ GPS રેકોર્ડ નથી</span>
          )}
        </div>
      ),
    },
    {
      key: 'workload',
      header: 'ચાલુ કાર્યભાર',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
          {row.active_assignments_count} ફરિયાદ જૂથો
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'કાર્યવાહી',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenFwModal(row)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#135D43] shadow-2xs transition-colors"
        >
          <span>કાર્યભાર વિગત</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#135D43]" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              ક્ષેત્રીય સ્ટાફ સંચાલન અને સંકલન (Field Worker Management)
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {totalFws} ફિલ્ડ વર્કર્સ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            તમારા અધિકૃત વિસ્તારમાં કાર્યરત ક્ષેત્રીય સ્ટાફની ડ્યૂટી સ્થિતિ, GPS લોકેશન, અને સોંપાયેલ કાર્યોનું મોનિટરિંગ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="કુલ ક્ષેત્રીય સ્ટાફ"
          value={isLoading ? '...' : totalFws}
          subtext="તમારા બ્લોકમાં ઉપલબ્ધ"
          icon={<Users className="w-4 h-4 text-[#135D43]" />}
          iconVariant="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="ડ્યૂટી પર સક્રિય"
          value={isLoading ? '...' : activeOnDuty}
          valueColor="text-[#135D43]"
          subtext="હાલમાં ઓનલાઇન"
          icon={<CheckCircle2 className="w-4 h-4 text-[#135D43]" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
        <KpiCard
          label="લાઇવ GPS તાજગી"
          value={isLoading ? '...' : freshLocations}
          valueColor="text-[#0284C7]"
          subtext="સક્રિય ટ્રેકિંગ ઉપલબ્ધ"
          icon={<Radio className="w-4 h-4 text-[#0284C7]" />}
          iconVariant="secondary"
          isLoading={isLoading}
        />
        <KpiCard
          label="સોંપાયેલ ફરિયાદો"
          value={isLoading ? '...' : totalAssignedTasks}
          subtext="ક્ષેત્રીય જૂથો ચાલુ"
          icon={<Briefcase className="w-4 h-4 text-slate-700" />}
          iconVariant="neutral"
          isLoading={isLoading}
        />
      </div>

      {/* 3. Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="કાર્યકરનું નામ અથવા મોબાઇલ શોધો..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#135D43] bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* 4. Staff Table */}
      {isLoading ? (
        <StateView state="loading" message="ક્ષેત્રીય સ્ટાફ માહિતી લોડ થઈ રહી છે..." />
      ) : filteredFws.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ ક્ષેત્રીય કાર્યકર મળ્યા નથી"
          message="તમારા સોંપાયેલા વિસ્તારમાં કોઈ ક્ષેત્રીય સ્ટાફ નોંધાયેલ નથી."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <DataTable data={filteredFws} columns={columns} keyExtractor={(f) => f.fw_user_id} />
        </div>
      )}

      {/* 5. Field Worker Workload Modal */}
      {selectedFw && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedFw(null)}
          title={`ક્ષેત્રીય કાર્યકર પ્રોફાઇલ અને કાર્યભાર: ${selectedFw.full_name}`}
        >
          <div className="space-y-4">
            {/* Summary Details */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">{selectedFw.full_name}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedFw.duty_status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {selectedFw.duty_status === 'ACTIVE' ? 'સક્રિય ડ્યૂટી' : 'ડ્યૂટી બંધ'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                <div>
                  <span className="text-slate-400">મોબાઇલ:</span>{' '}
                  <strong className="text-slate-900 font-mono">{selectedFw.mobile_e164 || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">કુલ સોંપાયેલ જૂથ:</span>{' '}
                  <strong className="text-slate-900">{fwAssignedGroups.length}</strong>
                </div>
                {selectedFw.last_latitude && (
                  <div className="col-span-2">
                    <span className="text-slate-400">તાજેતરનું GPS સ્થાન:</span>{' '}
                    <span className="font-mono text-[#135D43]">
                      {selectedFw.last_latitude.toFixed(4)}, {selectedFw.last_longitude?.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Complaint Groups */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#135D43]" />
                <span>સોંપાયેલ પશુચિકિત્સા ફરિયાદ જૂથો ({fwAssignedGroups.length})</span>
              </h4>

              {fwAssignedGroups.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  આ કાર્યકરને હાલમાં કોઈ સક્રિય કાર્ય કે ફરિયાદ જૂથ સોંપાયેલ નથી.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {fwAssignedGroups.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">#{g.group_code}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {g.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        ગામડાં: {g.villages_summary_gu?.join(', ') || 'સ્થાનિક ગામ'} • ફરિયાદો: {g.total_complaints}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedFw(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
