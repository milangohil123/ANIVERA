import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  Megaphone,
  Plus,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Layers,
  PawPrint,
  TrendingUp,
} from 'lucide-react';

export const TahoCampaignsView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    start_date: '',
    end_date: '',
    village_ids: [] as string[],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cList, hier] = await Promise.all([
        adminService.listTahoCampaigns(apiBaseUrl).catch(() => []),
        adminService.getTahoHierarchy(apiBaseUrl).catch(() => null),
      ]);
      setCampaigns(cList || []);
      setHierarchy(hier);
    } catch (err: any) {
      console.warn('Campaigns load note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const allVillages = useMemo(() => hierarchy?.villages || [], [hierarchy]);

  const handleOpenModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormData({
      name: '',
      code: '',
      start_date: today,
      end_date: in30Days,
      village_ids: allVillages.map((v: any) => v.village_id), // Default all villages
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.start_date || !formData.end_date) {
      alert('કૃપા કરીને નામ અને તારીખો દાખલ કરો.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminService.createTahoCampaign(apiBaseUrl, formData);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'ઝુંબેશ બનાવવામાં નિષ્ફળ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVillage = (vId: string) => {
    setFormData((prev) => ({
      ...prev,
      village_ids: prev.village_ids.includes(vId)
        ? prev.village_ids.filter((id) => id !== vId)
        : [...prev.village_ids, vId],
    }));
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-700" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              તાલુકા રસીકરણ ઝુંબેશો (Vaccination Campaigns)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            તાલુકા-કક્ષાના સામૂહિક રસીકરણ અભિયાનોનું આયોજન, લક્ષ્યાંક નિર્ધારણ અને ગામ મુજબ પ્રગતિ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handleOpenModal} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            નવી ઝુંબેશ શરૂ કરો
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {/* 2. Campaigns Grid / Cards */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">ઝુંબેશ ડેટા લોડ થઈ રહ્યો છે...</div>
      ) : campaigns.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-white border border-slate-200">
          <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">હાલમાં કોઈ સક્રિય રસીકરણ ઝુંબેશ નથી</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            તાલુકાના ગામો માટે નવું રસીકરણ અભિયાન શરૂ કરવા માટે ઉપરના "નવી ઝુંબેશ શરૂ કરો" બટન પર ક્લિક કરો.
          </p>
          <Button variant="primary" size="sm" onClick={handleOpenModal}>
            પ્રથમ ઝુંબેશ બનાવો
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((camp) => {
            const pct = camp.completion_pct || 0;
            return (
              <Card key={camp.id} className="p-4 bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm font-heading">{camp.name}</h3>
                      <span className="text-[10px] font-mono text-slate-500 block">{camp.code}</span>
                    </div>
                    <StatusChip status={camp.status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED'} label={camp.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">લક્ષ્યાંકિત ગામો:</span>
                      <span className="font-bold text-slate-800 font-mono flex items-center gap-1">
                        <Layers className="w-3 h-3 text-emerald-700" />
                        {camp.target_villages_count} ગામ
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">કુલ રસીકરણ:</span>
                      <span className="font-bold text-emerald-700 font-mono flex items-center gap-1">
                        <PawPrint className="w-3 h-3 text-emerald-700" />
                        {camp.vaccinated_count} ડોઝ
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">પ્રગતિ:</span>
                      <span className="font-bold text-emerald-800 font-mono">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{camp.start_date || '-'} થી {camp.end_date || '-'}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 3. Create Campaign Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="નવું રસીકરણ અભિયાન બનાવો" maxWidth="md">
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">ઝુંબેશનું નામ *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="દા.ત. FMD મુક્ત તાલુકો અભિયાન ૨૦૨૬"
              className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">ઝુંબેશ કોડ (ઓપ્શનલ)</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="CAMP-FMD-2026"
              className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">શરૂઆત તારીખ *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">સમાપ્તિ તારીખ *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Villages Multi-select */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">
                લક્ષ્યાંકિત ગામો ({formData.village_ids.length} પસંદ કરેલ)
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, village_ids: allVillages.map((v: any) => v.village_id) })}
                className="text-emerald-700 hover:underline text-[11px] font-semibold"
              >
                તમામ પસંદ કરો
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto p-2 rounded-lg border border-slate-200 grid grid-cols-2 gap-1.5">
              {allVillages.map((v: any) => {
                const isChecked = formData.village_ids.includes(v.village_id);
                return (
                  <label
                    key={v.village_id}
                    className={`flex items-center gap-1.5 p-1 rounded cursor-pointer text-[11px] ${
                      isChecked ? 'bg-emerald-50 text-emerald-900 font-medium' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleVillage(v.village_id)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="truncate">{v.name_gu || transliterateToGujarati(v.name_en)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              ઝુંબેશ બનાવો
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
