import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  reportService,
  type CampaignCoverageReportItem,
  type SurveillanceReportItem,
  type RegistryCountsReportItem,
} from '../../services/reportService';
import {
  FileText,
  Download,
  RotateCcw,
  Activity,
  ClipboardList,
  Layers,
  ShieldAlert,
} from 'lucide-react';

type VoReportTab = 'SURVEILLANCE' | 'REGISTRY' | 'CAMPAIGN';

export const VoReportsView: React.FC = () => {
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';

  const [activeTab, setActiveTab] = useState<VoReportTab>('SURVEILLANCE');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [surveillanceData, setSurveillanceData] = useState<SurveillanceReportItem[]>([]);
  const [registryData, setRegistryData] = useState<RegistryCountsReportItem[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignCoverageReportItem[]>([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === 'SURVEILLANCE') {
        const data = await reportService.getSurveillance(apiBaseUrl, token);
        setSurveillanceData(data);
      } else if (activeTab === 'REGISTRY') {
        const data = await reportService.getRegistryCounts(apiBaseUrl, token);
        setRegistryData(data);
      } else if (activeTab === 'CAMPAIGN') {
        const data = await reportService.getCampaignCoverage(apiBaseUrl, token);
        setCampaignData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'અહેવાલ ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, apiBaseUrl, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      if (activeTab === 'SURVEILLANCE') {
        await reportService.downloadSurveillanceCsv(apiBaseUrl, token);
      } else if (activeTab === 'REGISTRY') {
        await reportService.downloadRegistryCsv(apiBaseUrl, token);
      } else if (activeTab === 'CAMPAIGN') {
        await reportService.downloadCampaignCoverageCsv(apiBaseUrl, token);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'CSV ડાઉનલોડ નિષ્ફળ થયું.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#135D43]" />
            કાર્યક્ષેત્ર ગામોના અહેવાલો અને નિકાસ
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            તમારા અધિકૃત ગામો માટે રોગ સર્વેક્ષણ, નોંધણી અને રસીકરણ પ્રગતિ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            isLoading={isExporting}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            CSV ડાઉનલોડ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            તાજું કરો
          </Button>
        </div>
      </div>

      <div className="flex border-b border-[#E2E8F0] overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('SURVEILLANCE')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'SURVEILLANCE'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B]'
            }`}
        >
          <Activity className="w-4 h-4" />
          રોગ સર્વેક્ષણ
        </button>
        <button
          onClick={() => setActiveTab('REGISTRY')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'REGISTRY'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B]'
            }`}
        >
          <ClipboardList className="w-4 h-4" />
          પશુ નોંધણી આંકડા
        </button>
        <button
          onClick={() => setActiveTab('CAMPAIGN')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'CAMPAIGN'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B]'
            }`}
        >
          <Layers className="w-4 h-4" />
          ઝુંબેશ કવરેજ
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <StateView state="loading" message="અહેવાલ ડેટા લોડ થઈ રહ્યો છે..." />
      ) : activeTab === 'SURVEILLANCE' ? (
        <Card className="overflow-hidden border border-[#E2E8F0]">
          {surveillanceData.length === 0 ? (
            <StateView state="empty" message="તમારા ગામોમાં કોઈ રોગ અહેવાલ નોંધાયેલ નથી." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="p-3">ગામનું નામ</th>
                    <th className="p-3">રોગનું નામ</th>
                    <th className="p-3 text-right">શંકાસ્પદ કેસ</th>
                    <th className="p-3 text-right">પુષ્ટિ થયેલ</th>
                    <th className="p-3 text-right">અનપુષ્ટિ</th>
                    <th className="p-3">છેલ્લો રિપોર્ટ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {surveillanceData.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-[#1E293B]">{r.villageNameGu}</td>
                      <td className="p-3 font-mono font-bold text-[#1E293B]">{r.diseaseCode}</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-700">{r.suspectedCount}</td>
                      <td className="p-3 text-right font-mono font-bold text-red-700">{r.confirmedCount}</td>
                      <td className="p-3 text-right font-mono text-[#64748B]">{r.notConfirmedCount}</td>
                      <td className="p-3 text-[#64748B]">
                        {r.latestReportDate ? r.latestReportDate.split('-').reverse().join('/') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : activeTab === 'REGISTRY' ? (
        <Card className="overflow-hidden border border-[#E2E8F0]">
          {registryData.length === 0 ? (
            <StateView state="empty" message="કોઈ નોંધણી ડેટા ઉપલબ્ધ નથી." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="p-3">ગામનું નામ</th>
                    <th className="p-3 text-right">પશુપાલકો</th>
                    <th className="p-3 text-right">ગાય</th>
                    <th className="p-3 text-right">ભેંસ</th>
                    <th className="p-3 text-right">બકરી</th>
                    <th className="p-3 text-right">ઘેટાં</th>
                    <th className="p-3 text-right font-bold text-[#135D43]">કુલ પશુઓ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {registryData.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-[#1E293B]">{r.villageNameGu}</td>
                      <td className="p-3 text-right font-mono">{r.farmerCount}</td>
                      <td className="p-3 text-right font-mono">{r.cattleCount}</td>
                      <td className="p-3 text-right font-mono">{r.buffaloCount}</td>
                      <td className="p-3 text-right font-mono">{r.goatCount}</td>
                      <td className="p-3 text-right font-mono">{r.sheepCount}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#135D43]">{r.totalAnimals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden border border-[#E2E8F0]">
          {campaignData.length === 0 ? (
            <StateView state="empty" message="કોઈ ઝુંબેશ કવરેજ ડેટા ઉપલબ્ધ નથી." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="p-3">ઝુંબેશ</th>
                    <th className="p-3">ગામ</th>
                    <th className="p-3">કાર્યક્રમ</th>
                    <th className="p-3 text-right">લાયક પશુઓ</th>
                    <th className="p-3 text-right">રસી અપાયેલ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {campaignData.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-[#1E293B]">{r.campaignName}</td>
                      <td className="p-3 text-[#1E293B]">{r.villageNameGu}</td>
                      <td className="p-3 font-mono">{r.programmeCode}</td>
                      <td className="p-3 text-right font-mono">{r.eligibleCount}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#135D43]">{r.coveredCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

