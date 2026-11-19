import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { technicalService, type SystemHealthResponse } from '../../services/technicalService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { Activity, ArrowLeft, CheckCircle2, Database, RefreshCw, Server } from 'lucide-react';

export const AdminSystemHealthView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkHealth = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await technicalService.getHealth(apiBaseUrl);
      setHealth(data);
      setLastChecked(new Date());
    } catch (err: any) {
      setErrorMsg(err?.message || 'સિસ્ટમ હેલ્થ ચકાસણી નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, [apiBaseUrl]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10 font-body">
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
          <Activity className="w-4 h-4 text-[#135D43]" />
          સિસ્ટમ સ્વાસ્થ્ય નિદાન (System Health Diagnostics)
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={checkHealth}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          ફરી તપાસો
        </Button>
      </div>

      {isLoading ? (
        <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
      ) : errorMsg ? (
        <StateView state="error" message={errorMsg} onRetry={checkHealth} />
      ) : (
        <div className="space-y-4">
          {/* Main Status Card */}
          <Card
            header={
              <div className="flex items-center justify-between w-full">
                <h3 className="text-xs font-bold text-[#1E293B]">સિસ્ટમ સ્થિતિ નિરીક્ષણ</h3>
                <StatusChip
                  status={health?.status === 'HEALTHY' ? 'SUCCESS' : 'DANGER'}
                  text={health?.status === 'HEALTHY' ? 'કાર્યરત (Healthy)' : 'સમસ્યા છે (Degraded)'}
                />
              </div>
            }
          >
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[#64748B] block text-[11px] flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-[#135D43]" />
                    એપ્લિકેશન નામ / સંસ્કરણ
                  </span>
                  <span className="font-bold text-[#1E293B] mt-1 block">
                    {health?.app_name || 'PashuRakshak Botad'} (v{health?.version || '0.3.1'})
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[#64748B] block text-[11px] flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-[#065F46]" />
                    PostgreSQL 16 જોડાણ
                  </span>
                  <span className="font-bold text-[#065F46] mt-1 block flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {health?.database?.connected !== false ? 'જોડાયેલ (Connected)' : 'ડિસ્કનેક્ટ'}
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[#64748B] block text-[11px]">વાતાવરણ (Environment)</span>
                  <span className="font-mono font-bold text-[#1E293B] mt-1 block">
                    {health?.environment || 'development'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[#64748B] flex items-center justify-between pt-2">
                <span>છેલ્લી ચકાસણી: {lastChecked.toLocaleTimeString()}</span>
                <span>એન્ડપોઇન્ટ: /api/v1/health</span>
              </div>
            </div>
          </Card>

          {/* Raw JSON Dump */}
          <Card
            header={
              <h3 className="text-xs font-bold text-[#1E293B]">ડાયગ્નોસ્ટિક કાચો ડેટા (Raw JSON)</h3>
            }
          >
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto">
              {JSON.stringify(health, null, 2)}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
};

