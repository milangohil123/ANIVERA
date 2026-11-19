import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coopService, type CoopVillageProgressItem } from '../../services/coopService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StateView } from '../../components/common/StateView';
import { ArrowLeft, Building2, Download, Info, MapPin, Search } from 'lucide-react';
import { reportService } from '../../services/reportService';

export const CoopVillageProgressView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();
  const token = session?.accessToken || '';

  const [villages, setVillages] = useState<CoopVillageProgressItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownloadCsv = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      await reportService.downloadCoopProgressCsv(apiBaseUrl, token);
    } catch (err: any) {
      alert(err?.message || 'CSV ડાઉનલોડ નિષ્ફળ.');
    } finally {
      setIsExporting(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await coopService.getServedVillagesProgress(apiBaseUrl);
      setVillages(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const filteredVillages = villages.filter((v) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      v.village_name.toLowerCase().includes(term) ||
      v.village_code.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10 font-body">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/coop/overview')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          ડેશબોર્ડ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-[#135D43]" />
          ગામવાર રસીકરણ પ્રગતિ (Village Progress)
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/coop/maps')}
            leftIcon={<MapPin className="w-3.5 h-3.5 text-[#135D43]" />}
          >
            જીઓ-નકશો (GIS Map)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            isLoading={isExporting}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            CSV ડાઉનલોડ
          </Button>
        </div>
      </div>

      {/* Scrutiny Notice */}
      <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl text-xs text-[#166534] flex items-start gap-2">
        <Info className="w-4 h-4 text-[#135D43] shrink-0 mt-0.5" />
        <div>
          <strong className="block text-[#135D43]">એકત્રિત માહિતી માત્ર (Aggregate Counts Only):</strong>
          ડેરી સહકારી મંડળી હેઠળ ફક્ત ગામ દીઠ કુલ આંકડા દર્શાવાય છે. ડેટા સુરક્ષા નીતિ મુજબ વ્યક્તિગત પશુપાલક કે પશુની વિગત અહીં ઉપલબ્ધ નથી.
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ગામના નામ અથવા કોડ વડે શોધો..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
          />
        </div>
      </div>

      {/* Table Card */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">
              કાર્યક્ષેત્ર ગામોની યાદી ({filteredVillages.length})
            </h3>
            <span className="text-[11px] text-[#64748B]">કુલ ગામ: {villages.length}</span>
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={loadData} />
        ) : filteredVillages.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ માહિતી નથી"
            message="આ શોધ સાથે મેળ ખાતું કોઈ ગામ મળ્યું નથી."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFB] text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">ગામ</th>
                  <th className="py-2.5 px-3">ગામ કોડ</th>
                  <th className="py-2.5 px-3">સભ્ય પશુપાલકો</th>
                  <th className="py-2.5 px-3">કુલ પશુઓ</th>
                  <th className="py-2.5 px-3">રસીકરણ થયેલ</th>
                  <th className="py-2.5 px-3">કવરેજ (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredVillages.map((v) => (
                  <tr key={v.village_id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-semibold text-[#1E293B] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                      {v.village_name}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#64748B]">{v.village_code}</td>
                    <td className="py-3 px-3 text-[#1E293B]">{v.total_farmers}</td>
                    <td className="py-3 px-3 text-[#1E293B] font-semibold">{v.total_animals}</td>
                    <td className="py-3 px-3 text-[#065F46] font-semibold">{v.vaccinated_animals}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#135D43] h-2 rounded-full"
                            style={{ width: `${Math.min(v.coverage_percent, 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[11px] text-[#1E293B]">
                          {v.coverage_percent}%
                        </span>
                      </div>
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

