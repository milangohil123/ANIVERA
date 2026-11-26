import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  Users,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Phone,
  PawPrint,
  MapPin,
} from 'lucide-react';

export const TahoFarmersView: React.FC = () => {
  const { apiBaseUrl, selectedTalukaId } = useAuth();
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, total_pages: 1 });
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async (page = 1) => {
    setIsLoading(true);
    try {
      const [fRes, hier] = await Promise.all([
        adminService.listTahoFarmers(apiBaseUrl, {
          taluka_id: selectedTalukaId || undefined,
          search: searchQuery || undefined,
          village_id: selectedVillageId || undefined,
          page,
          page_size: 15,
        }),
        adminService.getTahoHierarchy(apiBaseUrl, selectedTalukaId || undefined).catch(() => null),
      ]);
      setData(fRes);
      setCurrentPage(page);
      setHierarchy(hier);
    } catch (err: any) {
      console.warn('Farmers load note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [apiBaseUrl, selectedVillageId, selectedTalukaId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(1);
  };

  const allVillages = hierarchy?.villages || [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 0. Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
        <span>નોંધ અને સાધનો</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span>તાલુકા પશુપાલન અધિકારી (TAHO)</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-[#0F172A] font-medium">પશુપાલક ડિરેક્ટરી • {data.total || 0} ખેડૂતો</span>
      </div>

      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              તાલુકા પશુપાલક ડિરેક્ટરી (Farmer Directory)
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {data.total || 0} નોંધાયેલ ખેડૂતો
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            તાલુકાના તમામ ગામોમાં નોંધાયેલ પશુપાલકો, સંપર્ક વિગત અને માલિકીના પશુઓની સંખ્યા
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(currentPage)} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="નામ, ખેડૂત કોડ કે મોબાઇલ નંબર શોધો..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={selectedVillageId}
            onChange={(e) => setSelectedVillageId(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
          >
            <option value="">તમામ ગામો (All Villages)</option>
            {allVillages.map((v: any) => (
              <option key={v.village_id} value={v.village_id}>
                {v.name_gu || transliterateToGujarati(v.name_en)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Farmers Table */}
      <Card noPadding className="overflow-hidden border border-slate-200 shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">ખેડૂત ડિરેક્ટરી લોડ થઈ રહી છે...</div>
        ) : data.items.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">કોઈ ખેડૂત રેકોર્ડ મળ્યો નથી.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3">ખેડૂતનું નામ</th>
                  <th className="p-3">ખેડૂત કોડ</th>
                  <th className="p-3">સંપર્ક નંબર</th>
                  <th className="p-3">ગામ</th>
                  <th className="p-3">સરનામું</th>
                  <th className="p-3">નોંધાયેલ પશુઓ</th>
                  <th className="p-3">સ્થિતિ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{f.full_name}</td>

                    <td className="p-3 font-mono text-slate-600 text-[11px]">
                      {f.farmer_code || '-'}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-mono text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{f.mobile_e164 || '-'}</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-900">
                        {f.village_name_gu || transliterateToGujarati(f.village_name_en)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{f.village_name_en}</div>
                    </td>

                    <td className="p-3 text-slate-600 text-[11px] max-w-xs truncate">
                      {f.address_text || '-'}
                    </td>

                    <td className="p-3">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] flex items-center gap-1 w-fit">
                        <PawPrint className="w-3 h-3 text-emerald-700" />
                        {f.animal_count} પશુ
                      </span>
                    </td>

                    <td className="p-3">
                      <StatusChip status="ACTIVE" label={f.active ? 'સક્રિય' : 'નિષ્ક્રિય'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data.total_pages > 1 && (
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => loadData(currentPage - 1)}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              પાછલું
            </Button>
            <span className="text-slate-600 font-medium font-mono">
              પેજ {currentPage} / {data.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= data.total_pages}
              onClick={() => loadData(currentPage + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              આગલું
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
