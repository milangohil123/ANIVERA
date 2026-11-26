import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  reportService,
  type CampaignCoverageReportItem,
  type SurveillanceReportItem,
  type RegistryCountsReportItem,
  type StaffActivityReportItem,
  type InventoryReportItem,
} from '../../services/reportService';
import {
  FileText,
  Download,
  RotateCcw,
  Activity,
  ClipboardList,
  Layers,
  Users,
  Package,
  TrendingUp,
} from 'lucide-react';

type VoReportTab = 'SURVEILLANCE' | 'REGISTRY' | 'CAMPAIGN' | 'STAFF' | 'INVENTORY';

export const VoReportsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';

  const [activeTab, setActiveTab] = useState<VoReportTab>('SURVEILLANCE');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [surveillanceData, setSurveillanceData] = useState<SurveillanceReportItem[]>([]);
  const [registryData, setRegistryData] = useState<RegistryCountsReportItem[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignCoverageReportItem[]>([]);
  const [staffData, setStaffData] = useState<StaffActivityReportItem[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryReportItem[]>([]);

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
      } else if (activeTab === 'STAFF') {
        const data = await reportService.getStaffActivity(apiBaseUrl, token);
        setStaffData(data);
      } else if (activeTab === 'INVENTORY') {
        const data = await reportService.getInventory(apiBaseUrl, token);
        setInventoryData(data);
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
      } else if (activeTab === 'STAFF') {
        await reportService.downloadStaffActivityCsv(apiBaseUrl, token);
      } else if (activeTab === 'INVENTORY') {
        await reportService.downloadInventoryCsv(apiBaseUrl, token);
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
            કાર્યક્ષેત્ર ગામોના અહેવાલો અને નિકાસ (Reports & CSV Exports)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            તમારા અધિકૃત ગામો માટે રોગ સર્વેક્ષણ, પશુ રજિસ્ટ્રી, ઝુંબેશ કવરેજ અને સ્ટાફ કામગીરી.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/vo/analytics')}
            leftIcon={<TrendingUp className="w-3.5 h-3.5" />}
          >
            ઇન્ફરન્સ ડેશબોર્ડ (Live Analytics)
          </Button>
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

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('SURVEILLANCE')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'SURVEILLANCE'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Activity className="w-4 h-4" />
          રોગ સર્વેક્ષણ
        </button>

        <button
          onClick={() => setActiveTab('REGISTRY')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'REGISTRY'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          પશુ નોંધણી આંકડા
        </button>

        <button
          onClick={() => setActiveTab('CAMPAIGN')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'CAMPAIGN'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Layers className="w-4 h-4" />
          ઝુંબેશ કવરેજ
        </button>

        <button
          onClick={() => setActiveTab('STAFF')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'STAFF'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Users className="w-4 h-4" />
          ક્ષેત્રીય સ્ટાફ કામગીરી
        </button>

        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'INVENTORY'
              ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Package className="w-4 h-4" />
          રસી સ્ટોક અહેવાલ
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <StateView state="loading" message="અહેવાલ તૈયાર થઈ રહ્યો છે..." />
      ) : activeTab === 'SURVEILLANCE' ? (
        <Card className="overflow-hidden border border-[#E2E8F0]">
          {surveillanceData.length === 0 ? (
            <StateView state="empty" message="કોઈ રોગ સર્વેક્ષણ ડેટા ઉપલબ્ધ નથી." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="p-3">ગામનું નામ</th>
                    <th className="p-3">રોગ</th>
                    <th className="p-3 text-right">શંકાસ્પદ કેસ</th>
                    <th className="p-3 text-right">પુષ્ટિ થયેલ</th>
                    <th className="p-3 text-right">નકારાયેલ</th>
                    <th className="p-3">છેલ્લી તારીખ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {surveillanceData.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-[#1E293B]">{r.villageNameGu}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {r.diseaseCode}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700">{r.suspectedCount}</td>
                      <td className="p-3 text-right font-mono font-bold text-red-600">{r.confirmedCount}</td>
                      <td className="p-3 text-right font-mono text-slate-500">{r.notConfirmedCount}</td>
                      <td className="p-3 text-[#64748B]">{r.latestReportDate || '-'}</td>
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
            <StateView state="empty" message="કોઈ પશુ નોંધણી ડેટા ઉપલબ્ધ નથી." />
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
      ) : activeTab === 'CAMPAIGN' ? (
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
      ) : activeTab === 'STAFF' ? (
        <Card className="overflow-hidden border border-[#E2E8F0]">
          {staffData.length === 0 ? (
            <StateView state="empty" message="કોઈ સ્ટાફ કામગીરી ડેટા ઉપલબ્ધ નથી." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="p-3">સ્ટાફ સભ્યનું નામ</th>
                    <th className="p-3">હોદ્દો / રોલ</th>
                    <th className="p-3 text-right">પશુ નોંધણી</th>
                    <th className="p-3 text-right font-bold text-[#135D43]">રસીકરણ ડોઝ</th>
                    <th className="p-3 text-right">રોગ અહેવાલો</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {staffData.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-[#1E293B]">{s.staffName}</td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">{s.role}</td>
                      <td className="p-3 text-right font-mono">{s.registrationsCount}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#135D43]">{s.vaccinationsCount}</td>
                      <td className="p-3 text-right font-mono text-amber-700">{s.diseaseReportsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden border border-[#E2E8F0]">
          {inventoryData.length === 0 ? (
            <StateView state="empty" message="કોઈ રસી સ્ટોક ડેટા ઉપલબ્ધ નથી." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="p-3">રસી ઉત્પાદન</th>
                    <th className="p-3">બેચ નંબર</th>
                    <th className="p-3 text-right">પ્રાપ્ત ડોઝ</th>
                    <th className="p-3 text-right">વિતરિત ડોઝ</th>
                    <th className="p-3 text-right font-bold text-[#135D43]">હાજર સ્ટોક</th>
                    <th className="p-3">મુદત પૂરી તારીખ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {inventoryData.map((inv, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-[#1E293B]">
                        {inv.productName} ({inv.productCode})
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">{inv.batchNumber}</td>
                      <td className="p-3 text-right font-mono">{inv.receivedDoses}</td>
                      <td className="p-3 text-right font-mono">{inv.issuedDoses}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#135D43]">{inv.currentBalance}</td>
                      <td className="p-3 text-slate-600">{inv.expiryDate || '-'}</td>
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
