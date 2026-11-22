import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { StatusChip } from '../../components/common/StatusChip';
import { transliterateToGujarati } from '../../utils/transliterateGujarati';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  RotateCcw,
  AlertTriangle,
  Layers,
  Shield,
  Briefcase,
  KeyRound,
} from 'lucide-react';

export const TahoStaffView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [activeTab, setActiveTab] = useState<'VO' | 'FW'>('VO');
  const [vos, setVos] = useState<any[]>([]);
  const [fws, setFws] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Create Staff Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createRole, setCreateRole] = useState<'VET_OFFICER' | 'FIELD_WORKER'>('VET_OFFICER');
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    mobile_e164: '',
    password: '',
    village_ids: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Change Modal
  const [statusModalUser, setStatusModalUser] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadStaffData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [voList, fwList, hier] = await Promise.all([
        adminService.listTahoVos(apiBaseUrl).catch(() => []),
        adminService.listTahoFws(apiBaseUrl).catch(() => []),
        adminService.getTahoHierarchy(apiBaseUrl).catch(() => null),
      ]);
      setVos(voList || []);
      setFws(fwList || []);
      setHierarchy(hier);
    } catch (err: any) {
      setError(err?.message || 'સ્ટાફ ડેટા લોડ કરવામાં નિષ્ફળ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, [apiBaseUrl]);

  const allVillages = useMemo(() => hierarchy?.villages || [], [hierarchy]);

  const handleOpenCreate = (role: 'VET_OFFICER' | 'FIELD_WORKER') => {
    setCreateRole(role);
    setFormData({
      full_name: '',
      username: '',
      email: '',
      mobile_e164: '',
      password: '',
      village_ids: [],
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.username || !formData.email || !formData.password) {
      alert('કૃપા કરીને તમામ જરૂરી ફીલ્ડ્સ ભરો.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (createRole === 'VET_OFFICER') {
        await adminService.createTahoVo(apiBaseUrl, formData);
        setActionSuccess('વેટરનરી અધિકારીનું ખાતું સફળતાપૂર્વક બનાવવામાં આવ્યું અને ઇમેઇલ મોકલવામાં આવ્યો.');
      } else {
        await adminService.createTahoFw(apiBaseUrl, formData);
        setActionSuccess('ફીલ્ડ વર્કરનું ખાતું સફળતાપૂર્વક બનાવવામાં આવ્યું અને ઇમેઇલ મોકલવામાં આવ્યો.');
      }
      setIsCreateModalOpen(false);
      await loadStaffData();
    } catch (err: any) {
      alert(err?.message || 'ખાતું બનાવવામાં નિષ્ફળ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusSubmit = async () => {
    if (!statusModalUser) return;
    if (newStatus === 'INACTIVE' && !statusReason.trim()) {
      alert('કૃપા કરીને નિષ્ક્રિય કરવાનું કારણ દાખલ કરો.');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      if (statusModalUser.role === 'VET_OFFICER') {
        await adminService.updateTahoVoStatus(apiBaseUrl, statusModalUser.id, newStatus, statusReason);
      } else {
        await adminService.updateTahoFwStatus(apiBaseUrl, statusModalUser.id, newStatus, statusReason);
      }
      setActionSuccess(`સ્થિતિ સફળતાપૂર્વક ${newStatus === 'ACTIVE' ? 'સક્રિય' : 'નિષ્ક્રિય'} કરવામાં આવી.`);
      setStatusModalUser(null);
      await loadStaffData();
    } catch (err: any) {
      alert(err?.message || 'સ્થિતિ બદલવામાં નિષ્ફળ.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const toggleVillageSelection = (vId: string) => {
    setFormData((prev) => {
      const exists = prev.village_ids.includes(vId);
      return {
        ...prev,
        village_ids: exists ? prev.village_ids.filter((id) => id !== vId) : [...prev.village_ids, vId],
      };
    });
  };

  const currentList = activeTab === 'VO' ? vos : fws;
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.mobile_e164 || '').includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [currentList, searchQuery]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-body text-slate-800 animate-fade-in">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <h1 className="text-lg font-bold font-heading text-slate-900">
              તાલુકા સ્ટાફ વહીવટ (VO & Field Worker Management)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            વેટરનરી ઓફિસર્સ અને ફીલ્ડ વર્કર્સની નોંધણી, સત્તાવાર ઇમેઇલ સક્રિયકરણ અને ગામ સોંપણી
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenCreate(activeTab === 'VO' ? 'VET_OFFICER' : 'FIELD_WORKER')}
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
          >
            {activeTab === 'VO' ? 'નવા VO ઉમેરો' : 'નવા FW ઉમેરો'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadStaffData} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            રીફ્રેશ
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-lg text-xs font-medium flex items-center justify-between border bg-emerald-50 text-emerald-900 border-emerald-200">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-xs font-bold underline ml-2">
            બંધ કરો
          </button>
        </div>
      )}

      {/* 2. Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex border-b border-slate-200 space-x-4">
          <button
            onClick={() => {
              setActiveTab('VO');
              setSearchQuery('');
            }}
            className={`pb-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'VO'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>વેટરનરી અધિકારીઓ (VO)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {vos.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('FW');
              setSearchQuery('');
            }}
            className={`pb-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'FW'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>ફીલ્ડ વર્કર્સ (FW)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {fws.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="નામ, યૂઝરનેમ કે મોબાઇલ શોધો..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* 3. Staff Table */}
      <Card noPadding className="overflow-hidden border border-slate-200 shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">સ્ટાફ ડેટા લોડ થઈ રહ્યો છે...</div>
        ) : filteredList.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">કોઈ સ્ટાફ સભ્ય મળ્યો નથી.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3">અધિકારી / કાર્યકર</th>
                  <th className="p-3">સંપર્ક વિગત</th>
                  <th className="p-3">સોંપાયેલ ગામો</th>
                  <th className="p-3">કાર્યભાર (પશુઓ)</th>
                  <th className="p-3">સ્થિતિ</th>
                  <th className="p-3 text-right">ક્રિયાઓ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((user) => {
                  const isActive = user.status === 'ACTIVE';
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{user.full_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">@{user.username}</div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{user.designation || '-'}</span>
                      </td>

                      <td className="p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{user.mobile_e164 || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{user.email || '-'}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-slate-900 font-mono">
                            {user.assigned_villages_count || 0}
                          </span>
                          <span className="text-slate-500">ગામ</span>
                        </div>
                        {user.assigned_villages && user.assigned_villages.length > 0 && (
                          <div className="text-[10px] text-slate-500 max-w-xs truncate mt-0.5">
                            {user.assigned_villages.join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-mono text-slate-800 font-medium">
                          {user.assigned_animals_count || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 block">કુલ પશુધન</span>
                      </td>

                      <td className="p-3">
                        <StatusChip
                          status={isActive ? 'ACTIVE' : 'INACTIVE'}
                          label={isActive ? 'સક્રિય' : 'નિષ્ક્રિય'}
                        />
                      </td>

                      <td className="p-3 text-right">
                        <Button
                          variant={isActive ? 'ghost' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setStatusModalUser(user);
                            setNewStatus(isActive ? 'INACTIVE' : 'ACTIVE');
                            setStatusReason('');
                          }}
                          className={`text-xs ${isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700'}`}
                        >
                          {isActive ? 'નિષ્ક્રિય કરો' : 'સક્રિય કરો'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 4. Create Staff Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={createRole === 'VET_OFFICER' ? 'નવા વેટરનરી અધિકારી (VO) ઉમેરો' : 'નવા ફીલ્ડ વર્કર (FW) ઉમેરો'}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
            <Mail className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              ખાતું બનતાની સાથે જ દાખલ કરેલ ઇમેઇલ સરનામા પર <strong>સત્તાવાર લૉગિન ઓળખપત્રો</strong> અને પોર્ટલ એક્સેસ લિંક આપોઆપ મોકલવામાં આવશે.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">પૂરું નામ *</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="દા.ત. ડૉ. રમેશ પટેલ"
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">યૂઝરનેમ *</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                placeholder="દા.ત. vo_ramesh"
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">સત્તાવાર ઇમેઇલ *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                placeholder="officer@anivera.gov.in"
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">મોબાઇલ નંબર (+91...)</label>
              <input
                type="tel"
                value={formData.mobile_e164}
                onChange={(e) => setFormData({ ...formData, mobile_e164: e.target.value.trim() })}
                placeholder="+9198XXXXXXXX"
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">પ્રારંભિક પાસવર્ડ *</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="સુરક્ષિત પાસવર્ડ દાખલ કરો"
                className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Village Assignment Selection */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">
                સોંપવાના ગામો પસંદ કરો ({formData.village_ids.length} પસંદ કરેલ)
              </label>
              <div className="space-x-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, village_ids: allVillages.map((v: any) => v.village_id) })}
                  className="text-emerald-700 hover:underline font-semibold"
                >
                  તમામ પસંદ કરો
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, village_ids: [] })}
                  className="text-slate-500 hover:underline"
                >
                  સાફ કરો
                </button>
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto p-2 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allVillages.map((v: any) => {
                const isChecked = formData.village_ids.includes(v.village_id);
                return (
                  <label
                    key={v.village_id}
                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                      isChecked ? 'bg-emerald-50 border border-emerald-300' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleVillageSelection(v.village_id)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="truncate">{v.name_gu || transliterateToGujarati(v.name_en)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              ખાતું બનાવો અને સક્રિય કરો
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Status Toggle Reason Modal */}
      <Modal
        isOpen={Boolean(statusModalUser)}
        onClose={() => setStatusModalUser(null)}
        title={newStatus === 'ACTIVE' ? 'ખાતું સક્રિય કરો' : 'ખાતું નિષ્ક્રિય કરો'}
        maxWidth="sm"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            તમે <strong>{statusModalUser?.full_name}</strong> નું ખાતું {newStatus === 'ACTIVE' ? 'સક્રિય' : 'નિષ્ક્રિય'} કરવા જઈ રહ્યા છો.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {newStatus === 'INACTIVE' ? 'નિષ્ક્રિય કરવાનું કારણ *' : 'સક્રિય કરવાની નોંધ (ઓપ્શનલ)'}
            </label>
            <textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="વહીવટી કારણ દાખલ કરો..."
              className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setStatusModalUser(null)}>
              રદ કરો
            </Button>
            <Button
              variant={newStatus === 'ACTIVE' ? 'primary' : 'danger'}
              size="sm"
              onClick={handleStatusSubmit}
              isLoading={isUpdatingStatus}
            >
              પુષ્ટિ કરો
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
