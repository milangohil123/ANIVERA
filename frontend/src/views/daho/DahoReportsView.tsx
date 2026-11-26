import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { StatusChip } from '../../components/common/StatusChip';
import { useAuth } from '../../context/AuthContext';
import {
  reportService,
  type CampaignCoverageReportItem,
  type InventoryReportItem,
  type SurveillanceReportItem,
  type RegistryCountsReportItem,
  type StaffActivityReportItem,
  type ExportLogItem,
} from '../../services/reportService';
import {
  FileText,
  Download,
  RotateCcw,
  Layers,
  Syringe,
  Activity,
  ClipboardList,
  Users,
  History,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

type ReportTab = 'CAMPAIGN' | 'INVENTORY' | 'SURVEILLANCE' | 'REGISTRY' | 'STAFF' | 'HISTORY';

export const DahoReportsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';

  const [activeTab, setActiveTab] = useState<ReportTab>('CAMPAIGN');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [campaignData, setCampaignData] = useState<CampaignCoverageReportItem[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryReportItem[]>([]);
  const [surveillanceData, setSurveillanceData] = useState<SurveillanceReportItem[]>([]);
  const [registryData, setRegistryData] = useState<RegistryCountsReportItem[]>([]);
  const [staffData, setStaffData] = useState<StaffActivityReportItem[]>([]);
  const [historyData, setHistoryData] = useState<ExportLogItem[]>([]);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadActiveReport = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === 'CAMPAIGN') {
        const data = await reportService.getCampaignCoverage(apiBaseUrl, token);
        setCampaignData(data);
      } else if (activeTab === 'INVENTORY') {
        const data = await reportService.getInventory(apiBaseUrl, token);
        setInventoryData(data);
      } else if (activeTab === 'SURVEILLANCE') {
        const data = await reportService.getSurveillance(
          apiBaseUrl,
          token,
          undefined,
          undefined,
          startDate || undefined,
          endDate || undefined
        );
        setSurveillanceData(data);
      } else if (activeTab === 'REGISTRY') {
        const data = await reportService.getRegistryCounts(apiBaseUrl, token);
        setRegistryData(data);
      } else if (activeTab === 'STAFF') {
        const data = await reportService.getStaffActivity(
          apiBaseUrl,
          token,
          undefined,
          startDate || undefined,
          endDate || undefined
        );
        setStaffData(data);
      } else if (activeTab === 'HISTORY') {
        const data = await reportService.getExportHistory(apiBaseUrl, token);
        setHistoryData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'અહેવાલ ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, apiBaseUrl, token, startDate, endDate]);

  useEffect(() => {
    loadActiveReport();
  }, [loadActiveReport]);

  const handleExportCsv = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      if (activeTab === 'CAMPAIGN') {
        await reportService.downloadCampaignCoverageCsv(apiBaseUrl, token);
      } else if (activeTab === 'INVENTORY') {
        await reportService.downloadInventoryCsv(apiBaseUrl, token);
      } else if (activeTab === 'SURVEILLANCE') {
        await reportService.downloadSurveillanceCsv(
          apiBaseUrl,
          token,
          undefined,
          undefined,
          startDate || undefined,
          endDate || undefined
        );
      } else if (activeTab === 'REGISTRY') {
        await reportService.downloadRegistryCsv(apiBaseUrl, token);
      } else if (activeTab === 'STAFF') {
        await reportService.downloadStaffActivityCsv(
          apiBaseUrl,
          token,
          undefined,
          startDate || undefined,
          endDate || undefined
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'CSV ડાઉનલોડ નિષ્ફળ થયું.');
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: 'CAMPAIGN', label: 'ઝુંબેશ કવરેજ', icon: Layers },
    { id: 'INVENTORY', label: 'રસી સ્ટોક / લેજર', icon: Syringe },
    { id: 'SURVEILLANCE', label: 'રોગ સર્વેક્ષણ', icon: Activity },
    { id: 'REGISTRY', label: 'પશુ નોંધણી આંકડા', icon: ClipboardList },
    { id: 'STAFF', label: 'સ્ટાફ કામગીરી', icon: Users },
    { id: 'HISTORY', label: 'નિકાસ ઇતિહાસ', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#135D43]" />
            જિલ્લા વહીવટી અહેવાલો અને સલામત નિકાસ (Reports & Safe Exports)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            કાર્યક્ષેત્ર-આધારિત વાસ્તવિક આંકડા, ફોર્મ્યુલા-ઈન્જેક્શન સુરક્ષિત CSV ડાઉનલોડ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/daho/analytics')}
            leftIcon={<TrendingUp className="w-3.5 h-3.5" />}
          >
            ઇન્ફરન્સ ડેશબોર્ડ (Live Analytics)
          </Button>
          {activeTab !== 'HISTORY' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              isLoading={isExporting}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              CSV નિકાસ (Safe Download)
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadActiveReport}
            isLoading={isLoading}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            તાજું કરો
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as ReportTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-[#135D43] text-[#135D43] bg-emerald-50/50'
                  : 'border-transparent text-[#64748B] hover:text-[#1E293B] hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Date Filters for Surveillance and Staff Tabs */}
      {(activeTab === 'SURVEILLANCE' || activeTab === 'STAFF') && (
        <Card className="p-4 bg-white border border-[#E2E8F0]">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold text-[#1E293B]">તારીખ ગાળો (Date Range):</span>
            <div className="flex items-center gap-2">
              <label className="text-[#64748B]">શરૂઆત:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 border border-[#E2E8F0] rounded text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[#64748B]">અંત:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 border border-[#E2E8F0] rounded text-xs"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-[#0284C7] underline"
              >
                ફિલ્ટર હટાવો
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Content States */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <StateView state="loading" message="અહેવાલ ડેટા તૈયાર થઈ રહ્યો છે..." />
      ) : (
        <>
          {/* TAB 1: CAMPAIGN COVERAGE */}
          {activeTab === 'CAMPAIGN' && (
            <Card className="overflow-hidden border border-[#E2E8F0]">
              <div className="p-4 bg-[#F8FAFB] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">
                  ઝુંબેશવાર રસીકરણ કવરેજ સંખ્યા (Campaign Vaccination Counts)
                </span>
                <span className="text-xs text-[#64748B]">
                  કુલ પરિણામો: {campaignData.length}
                </span>
              </div>
              {campaignData.length === 0 ? (
                <StateView state="empty" message="કોઈ ઝુંબેશ કવરેજ ડેટા મળ્યો નથી." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                      <tr>
                        <th className="p-3">ઝુંબેશનું નામ</th>
                        <th className="p-3">ગામનું નામ</th>
                        <th className="p-3">કાર્યક્રમ</th>
                        <th className="p-3 text-right">લાયક પશુઓ (Eligible)</th>
                        <th className="p-3 text-right">રસી અપાયેલ (Covered)</th>
                        <th className="p-3">લક્ષ્યાંક નોંધ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {campaignData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-[#1E293B]">{row.campaignName}</td>
                          <td className="p-3 text-[#1E293B]">{row.villageNameGu}</td>
                          <td className="p-3 font-mono text-[#64748B]">{row.programmeCode}</td>
                          <td className="p-3 text-right font-mono font-semibold text-[#1E293B]">{row.eligibleCount}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#135D43]">{row.coveredCount}</td>
                          <td className="p-3 text-[#64748B]">
                            <StatusChip variant="neutral" label={row.note} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 2: INVENTORY */}
          {activeTab === 'INVENTORY' && (
            <Card className="overflow-hidden border border-[#E2E8F0]">
              <div className="p-4 bg-[#F8FAFB] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">
                  જિલ્લા રસી સ્ટોક અને જથ્થો (Vaccine Stock Ledger)
                </span>
                <span className="text-xs text-[#64748B]">
                  કુલ બેચ: {inventoryData.length}
                </span>
              </div>
              {inventoryData.length === 0 ? (
                <StateView state="empty" message="કોઈ સ્ટોક રેકોર્ડ ઉપલબ્ધ નથી." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                      <tr>
                        <th className="p-3">રસીનું નામ / કોડ</th>
                        <th className="p-3">કાર્યક્રમ</th>
                        <th className="p-3">બેચ નંબર</th>
                        <th className="p-3 text-right">આવેલ ડોઝ</th>
                        <th className="p-3 text-right">વિતરિત ડોઝ</th>
                        <th className="p-3 text-right">ફેરફાર</th>
                        <th className="p-3 text-right font-bold">વર્તમાન સ્ટોક</th>
                        <th className="p-3">મુદત પૂર્ણ તારીખ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {inventoryData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-[#1E293B]">{row.productName}</div>
                            <div className="text-[11px] text-[#64748B] font-mono">{row.productCode}</div>
                          </td>
                          <td className="p-3 font-mono text-[#64748B]">{row.programmeCode || '-'}</td>
                          <td className="p-3 font-mono text-[#1E293B]">{row.batchNumber}</td>
                          <td className="p-3 text-right font-mono text-[#1E293B]">{row.receivedDoses}</td>
                          <td className="p-3 text-right font-mono text-blue-700">{row.issuedDoses}</td>
                          <td className="p-3 text-right font-mono text-[#64748B]">{row.adjustedDoses}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/50">
                            {row.currentBalance}
                          </td>
                          <td className="p-3 text-[#64748B]">
                            {row.expiryDate ? row.expiryDate.split('-').reverse().join('/') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 3: SURVEILLANCE */}
          {activeTab === 'SURVEILLANCE' && (
            <Card className="overflow-hidden border border-[#E2E8F0]">
              <div className="p-4 bg-[#F8FAFB] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">
                  ગામવાર રોગ સર્વેક્ષણ અહેવાલ (Surveillance — Suspected vs Confirmed Separate)
                </span>
                <span className="text-xs text-[#64748B]">
                  કુલ પરિણામો: {surveillanceData.length}
                </span>
              </div>
              {surveillanceData.length === 0 ? (
                <StateView state="empty" message="આ ગાળામાં કોઈ રોગ અહેવાલ નોંધાયેલ નથી." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                      <tr>
                        <th className="p-3">ગામનું નામ</th>
                        <th className="p-3">રોગનું નામ</th>
                        <th className="p-3 text-right text-amber-800">શંકાસ્પદ કેસ (Suspected)</th>
                        <th className="p-3 text-right text-red-800">પુષ્ટિ થયેલ (Confirmed)</th>
                        <th className="p-3 text-right text-gray-600">અનપુષ્ટિ (Not Confirmed)</th>
                        <th className="p-3 text-right text-gray-600">અપૂર્ણ માહિતી</th>
                        <th className="p-3">છેલ્લો રિપોર્ટ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {surveillanceData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-[#1E293B]">{row.villageNameGu}</td>
                          <td className="p-3 font-mono font-bold text-[#1E293B]">{row.diseaseCode}</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-700 bg-amber-50/50">
                            {row.suspectedCount}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-red-700 bg-red-50/50">
                            {row.confirmedCount}
                          </td>
                          <td className="p-3 text-right font-mono text-[#64748B]">{row.notConfirmedCount}</td>
                          <td className="p-3 text-right font-mono text-[#64748B]">{row.insufficientCount}</td>
                          <td className="p-3 text-[#64748B]">
                            {row.latestReportDate ? row.latestReportDate.split('-').reverse().join('/') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 4: REGISTRY COUNTS */}
          {activeTab === 'REGISTRY' && (
            <Card className="overflow-hidden border border-[#E2E8F0]">
              <div className="p-4 bg-[#F8FAFB] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">
                  ગામવાર પશુપાલક અને પશુ સંખ્યા વિશ્લેષણ (Registry Livestock Demographics)
                </span>
                <span className="text-xs text-[#64748B]">
                  કુલ ગામડાઓ: {registryData.length}
                </span>
              </div>
              {registryData.length === 0 ? (
                <StateView state="empty" message="કોઈ નોંધણી ડેટા ઉપલબ્ધ નથી." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                      <tr>
                        <th className="p-3">ગામનું નામ</th>
                        <th className="p-3 text-right">પશુપાલકો</th>
                        <th className="p-3 text-right">ગાય (Cattle)</th>
                        <th className="p-3 text-right">ભેંસ (Buffalo)</th>
                        <th className="p-3 text-right">બકરી (Goat)</th>
                        <th className="p-3 text-right">ઘેટાં (Sheep)</th>
                        <th className="p-3 text-right font-bold text-[#135D43]">કુલ પશુઓ</th>
                        <th className="p-3 text-right font-semibold text-blue-700">ચકાસાયેલ પશુઓ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {registryData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-[#1E293B]">{row.villageNameGu}</td>
                          <td className="p-3 text-right font-mono font-semibold text-[#1E293B]">{row.farmerCount}</td>
                          <td className="p-3 text-right font-mono text-[#64748B]">{row.cattleCount}</td>
                          <td className="p-3 text-right font-mono text-[#64748B]">{row.buffaloCount}</td>
                          <td className="p-3 text-right font-mono text-[#64748B]">{row.goatCount}</td>
                          <td className="p-3 text-right font-mono text-[#64748B]">{row.sheepCount}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#135D43] bg-emerald-50/50">
                            {row.totalAnimals}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-blue-700">
                            {row.verifiedAnimals}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 5: STAFF ACTIVITY */}
          {activeTab === 'STAFF' && (
            <Card className="overflow-hidden border border-[#E2E8F0]">
              <div className="p-4 bg-[#F8FAFB] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">
                  ક્ષેત્રીય સ્ટાફ કામગીરી ટ્રેકિંગ (Field Worker & VO Operational Activity)
                </span>
                <span className="text-xs text-[#64748B]">
                  કુલ કર્મચારીઓ: {staffData.length}
                </span>
              </div>
              {staffData.length === 0 ? (
                <StateView state="empty" message="કોઈ સ્ટાફ પ્રવૃત્તિ નોંધાયેલ નથી." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                      <tr>
                        <th className="p-3">કર્મચારીનું નામ</th>
                        <th className="p-3">હોદ્દો (Role)</th>
                        <th className="p-3 text-right">પશુ નોંધણી</th>
                        <th className="p-3 text-right">રસીકરણ ઇવેન્ટ્સ</th>
                        <th className="p-3 text-right">રોગ અહેવાલો</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {staffData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-[#1E293B]">{row.staffName}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-[#1E293B]">
                              {row.role}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-[#1E293B]">
                            {row.registrationsCount}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-[#135D43]">
                            {row.vaccinationsCount}
                          </td>
                          <td className="p-3 text-right font-mono text-amber-700">
                            {row.diseaseReportsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 6: EXPORT HISTORY */}
          {activeTab === 'HISTORY' && (
            <Card className="overflow-hidden border border-[#E2E8F0]">
              <div className="p-4 bg-[#F8FAFB] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">
                  તમારી અગાઉની નિકાસ લૉગ્સ (Audit Export History)
                </span>
                <span className="text-xs text-[#64748B]">
                  કુલ નિકાસ: {historyData.length}
                </span>
              </div>
              {historyData.length === 0 ? (
                <StateView state="empty" message="અત્યાર સુધી કોઈ ફાઇલ નિકાસ કરવામાં આવી નથી." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFB] border-b border-[#E2E8F0] text-[#64748B]">
                      <tr>
                        <th className="p-3">નિકાસ પ્રકાર (Export Type)</th>
                        <th className="p-3">હેતુ</th>
                        <th className="p-3 text-right">પંક્તિઓ (Rows)</th>
                        <th className="p-3">ફોર્મ્યુલા સુરક્ષિત</th>
                        <th className="p-3">તારીખ અને સમય</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {historyData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-[#1E293B]">{row.exportType}</td>
                          <td className="p-3 text-[#64748B]">{row.purpose}</td>
                          <td className="p-3 text-right font-mono text-[#1E293B]">{row.rowCount ?? '-'}</td>
                          <td className="p-3">
                            <StatusChip variant="success" label="હા (Formula-Safe)" />
                          </td>
                          <td className="p-3 text-[#64748B] font-mono">
                            {new Date(row.createdAt).toLocaleString('gu-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};
