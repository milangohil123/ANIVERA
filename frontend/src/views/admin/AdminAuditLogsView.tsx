import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { technicalService, type TechnicalAuditItem } from '../../services/technicalService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { ArrowLeft, FileText, Filter } from 'lucide-react';

export const AdminAuditLogsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [logs, setLogs] = useState<TechnicalAuditItem[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await technicalService.listAuditLogs(
        apiBaseUrl,
        actionFilter || undefined,
        resultFilter || undefined
      );
      setLogs(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [apiBaseUrl, actionFilter, resultFilter]);

  const formatTimestamp = (iso?: string | null): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${h}:${m}:${s}`;
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
          <FileText className="w-4 h-4 text-[#135D43]" />
          સુરક્ષા અને સિસ્ટમ ઓડિટ ટ્રાયલ (Security Audit Trail)
        </h2>
        <div className="w-12" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#64748B]" />
          <span className="text-xs text-[#64748B]">ફિલ્ટર:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
          >
            <option value="">-- બધી ક્રિયાઓ (All Actions) --</option>
            <option value="AUTH_STAFF_LOGIN">AUTH_STAFF_LOGIN</option>
            <option value="AUTH_FARMER_OTP_REQUEST">AUTH_FARMER_OTP_REQUEST</option>
            <option value="AUTH_FARMER_OTP_VERIFY">AUTH_FARMER_OTP_VERIFY</option>
            <option value="PERMISSION_CHECK">PERMISSION_CHECK</option>
            <option value="OFFLINE_SYNC_PUSH">OFFLINE_SYNC_PUSH</option>
          </select>

          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-[#1E293B] focus:ring-2 focus:ring-[#135D43]"
          >
            <option value="">-- બધું પરિણામ (All Results) --</option>
            <option value="SUCCESS">SUCCESS (સફળ)</option>
            <option value="DENIED">DENIED (નકારાયેલ)</option>
            <option value="FAILED">FAILED (નિષ્ફળ)</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchLogs}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {/* Logs Table Card */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">
              ઓડિટ લોગ પરિણામો ({logs.length})
            </h3>
            <span className="text-[11px] text-[#64748B]">અપરિવર્તનીય ઓડિટ લોગ</span>
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={fetchLogs} />
        ) : logs.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ માહિતી નથી"
            message="પસંદ કરેલા માપદંડ માટે કોઈ ઓડિટ રેકોર્ડ્સ મળ્યા નથી."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">સમય (Timestamp)</th>
                  <th className="py-2.5 px-3">ક્રિયા (Action)</th>
                  <th className="py-2.5 px-3">કર્તા (Actor)</th>
                  <th className="py-2.5 px-3">લક્ષ્ય એન્ટિટી</th>
                  <th className="py-2.5 px-3">પરિણામ</th>
                  <th className="py-2.5 px-3">IP સરનામું</th>
                  <th className="py-2.5 px-3">વિગત / કારણ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                      {formatTimestamp(log.occurred_at)}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-[#1E293B]">
                      {log.action}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#1E293B]">
                        {log.actor_name || 'અજ્ઞાત'}
                      </div>
                      <span className="text-[10px] text-[#64748B]">
                        {log.actor_role || 'PUBLIC'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#64748B]">
                      {log.object_type ? `${log.object_type}:${log.object_id?.slice(0, 8)}` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <StatusChip
                        status={
                          log.result === 'SUCCESS'
                            ? 'SUCCESS'
                            : log.result === 'DENIED'
                              ? 'DANGER'
                              : 'WARNING'
                        }
                        text={log.result}
                      />
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#64748B]">
                      {log.ip || '—'}
                    </td>
                    <td className="py-3 px-3 text-[#64748B] text-[11px] max-w-xs truncate">
                      {log.reason || '—'}
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

