import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { technicalService, type TechnicalDevice } from '../../services/technicalService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { ArrowLeft, Smartphone } from 'lucide-react';

export const AdminDevicesView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [devices, setDevices] = useState<TechnicalDevice[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDevices = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await technicalService.listDevices(apiBaseUrl, statusFilter || undefined);
      setDevices(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [apiBaseUrl, statusFilter]);

  const formatDate = (iso?: string | null): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10 font-body">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/overview')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          ડેશબોર્ડ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-[#135D43]" />
          નોંધાયેલ ક્ષેત્રીય ઉપકરણો (Registered Field Devices)
        </h2>
        <div className="w-12" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
        <span className="text-xs text-[#64748B]">ઉપકરણ સ્થિતિ દ્વારા ફિલ્ટર:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] text-xs bg-white text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
        >
          <option value="">-- બધા ઉપકરણો (All Devices) --</option>
          <option value="ACTIVE">ACTIVE (સક્રિય)</option>
          <option value="REVOKED">REVOKED (રદ થયેલ)</option>
        </select>
      </div>

      {/* Table Card */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">
              ઉપકરણ પરિણામો ({devices.length})
            </h3>
            <span className="text-[11px] text-[#64748B]">ઓફલાઇન સિન્ક અને ઉપકરણ મેનેજમેન્ટ</span>
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={fetchDevices} />
        ) : devices.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ માહિતી નથી"
            message="હાલમાં કોઈ ઉપકરણ નોંધાયેલ નથી."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">ઉપકરણ ID / લેબલ</th>
                  <th className="py-2.5 px-3">સંબંધિત સ્ટાફ</th>
                  <th className="py-2.5 px-3">પ્રથમ જોડાણ</th>
                  <th className="py-2.5 px-3">છેલ્લું જોડાણ</th>
                  <th className="py-2.5 px-3">છેલ્લો સિન્ક</th>
                  <th className="py-2.5 px-3">સ્થિતિ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <div className="font-mono text-[#1E293B] font-semibold">{d.id.slice(0, 13)}...</div>
                      <span className="text-[11px] text-[#64748B] block truncate max-w-xs">
                        {d.label || 'વેબ / મોબાઇલ ક્લાયન્ટ'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#1E293B]">{d.user_full_name || 'સ્ટાફ'}</div>
                    </td>
                    <td className="py-3 px-3 text-[#64748B]">{formatDate(d.first_seen_at)}</td>
                    <td className="py-3 px-3 text-[#64748B]">{formatDate(d.last_seen_at)}</td>
                    <td className="py-3 px-3 text-[#64748B]">{formatDate(d.last_sync_at)}</td>
                    <td className="py-3 px-3">
                      <StatusChip
                        status={d.status === 'ACTIVE' ? 'SUCCESS' : 'DANGER'}
                        text={d.status === 'ACTIVE' ? 'સક્રિય' : 'રદ (Revoked)'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

