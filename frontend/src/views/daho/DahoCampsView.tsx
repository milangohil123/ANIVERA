import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { adminService, type VillageItem } from '../../services/adminService';
import { dahoOpsService, type CampItem, type CampaignItem } from '../../services/dahoOpsService';
import { Plus, RotateCcw, Tent, Calendar, MapPin, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export const DahoCampsView: React.FC = () => {
  const { apiBaseUrl, scope, profile } = useAuth();
  const assignedDistrictId = scope?.assigned_districts?.[0] || profile?.assigned_districts?.[0];

  const [camps, setCamps] = useState<CampItem[]>([]);
  const [villages, setVillages] = useState<VillageItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [campaignId, setCampaignId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [campDate, setCampDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [organizerType, setOrganizerType] = useState<'GOVERNMENT' | 'DOORSTEP' | 'COOPERATIVE' | 'JOINT'>('GOVERNMENT');
  const [locationText, setLocationText] = useState('');
  const [expectedFarmers, setExpectedFarmers] = useState('30');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      let districtId = assignedDistrictId;
      if (!districtId) {
        const dists = await adminService.listDistricts(apiBaseUrl);
        if (dists.length > 0) {
          districtId = dists[0].id;
        }
      }

      const [campList, vilList, campns] = await Promise.all([
        dahoOpsService.listCamps(apiBaseUrl),
        districtId ? adminService.listVillages(apiBaseUrl, districtId) : Promise.resolve([]),
        dahoOpsService.listCampaigns(apiBaseUrl),
      ]);
      setCamps(campList);
      setVillages(vilList);
      setCampaigns(campns);
      if (vilList.length > 0 && !villageId) {
        setVillageId(vilList[0].id);
      }
      if (campns.length > 0 && !campaignId) {
        const active = campns.find((c) => c.status === 'ACTIVE') || campns[0];
        setCampaignId(active.id);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'કેમ્પ માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, assignedDistrictId]);

  const handleProposeCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) {
      setNotice({ type: 'error', message: 'કૃપા કરીને રસીકરણ ઝુંબેશ પસંદ કરો.' });
      return;
    }
    if (!villageId) {
      setNotice({ type: 'error', message: 'કૃપા કરીને ગામ પસંદ કરો.' });
      return;
    }
    if (!campDate) {
      setNotice({ type: 'error', message: 'કૃપા કરીને કેમ્પની તારીખ પસંદ કરો.' });
      return;
    }

    const startDt = new Date(`${campDate}T${startTime || '09:00'}:00`);
    const endDt = new Date(`${campDate}T${endTime || '17:00'}:00`);

    if (endDt <= startDt) {
      setNotice({ type: 'error', message: 'કેમ્પ સમાપ્તિ સમય શરૂઆતના સમય પછીનો હોવો જરૂરી છે.' });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      await dahoOpsService.proposeCamp(apiBaseUrl, {
        campaign_id: campaignId,
        village_id: villageId,
        planned_start: startDt.toISOString(),
        planned_end: endDt.toISOString(),
        organizer_type: organizerType,
        location_text: locationText.trim() || undefined,
        vaccine_note: notes.trim() || undefined,
        expected_farmers: expectedFarmers ? Number(expectedFarmers) : 30,
      });

      setNotice({ type: 'success', message: 'પશુ આરોગ્ય કેમ્પ સફળતાપૂર્વક પ્રસ્તાવિત થયો.' });
      setIsModalOpen(false);
      setLocationText('');
      setNotes('');
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'કેમ્પ પ્રસ્તાવિત કરવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVillageName = (vId: string) => {
    const v = villages.find((item) => item.id === vId);
    return v ? `${v.name_gu} (${v.name_en})` : vId.substring(0, 8);
  };

  const columns: Column<CampItem>[] = [
    {
      key: 'code',
      header: 'કેમ્પ કોડ / પ્રકાર',
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1E293B] font-mono">{row.camp_code || 'CMP-BOT'}</div>
          <div className="text-xs text-[#64748B]">
            {row.organizer_type === 'DOORSTEP' || row.camp_type === 'DOORSTEP'
              ? 'ઘરબેઠા રાઉન્ડ (Doorstep)'
              : row.organizer_type === 'COOPERATIVE'
              ? 'સહકારી મંડળી કેમ્પ'
              : 'સ્થિર કેમ્પ (Fixed Camp)'}
          </div>
        </div>
      ),
    },
    {
      key: 'village',
      header: 'ગામ',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-[#1E293B]">
          <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
          <span>{getVillageName(row.village_id)}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'આયોજિત તારીખ / સમય',
      render: (row) => (
        <div className="text-xs text-[#1E293B] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <span>
            {row.planned_start
              ? new Date(row.planned_start).toLocaleDateString('gu-IN')
              : row.camp_date || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => {
        const variant =
          row.status === 'COMPLETED'
            ? 'success'
            : row.status === 'CONFIRMED'
            ? 'info'
            : row.status === 'PROPOSED'
            ? 'warning'
            : row.status === 'CANCELLED'
            ? 'error'
            : 'neutral';
        const labelMap: Record<string, string> = {
          PROPOSED: 'પ્રસ્તાવિત',
          CONFIRMED: 'મંજૂર',
          RESCHEDULED: 'પુનઃનિર્ધારિત',
          CANCELLED: 'રદ',
          COMPLETED: 'સંપન્ન',
        };
        return <StatusChip variant={variant} label={labelMap[row.status] || row.status} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Tent className="w-5 h-5 text-[#135D43]" />
            પશુ સારવાર અને આરોગ્ય કેમ્પ (Veterinary Camps)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            જિલ્લાના ગામડાઓમાં આયોજિત પશુ ચિકિત્સા કેમ્પ અને ડોરસ્ટેપ રાઉન્ડનું વહીવટી નિયમન.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            તાજું કરો
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            + નવો કેમ્પ
          </Button>
        </div>
      </div>

      {notice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{notice.message}</span>
        </div>
      )}

      {isLoading ? (
        <StateView state="loading" message="કેમ્પ માહિતી લોડ થઈ રહી છે..." />
      ) : camps.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ કેમ્પ આયોજિત નથી"
          message="આ જિલ્લામાં હાલમાં કોઈ કેમ્પ નોંધાયેલ નથી. નવો કેમ્પ પ્રસ્તાવિત કરવા ઉપરનું બટન દબાવો."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable data={camps} columns={columns} keyExtractor={(c) => c.id} />
        </div>
      )}

      {/* Propose Camp Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="નવો પશુ આરોગ્ય કેમ્પ પ્રસ્તાવિત કરો">
        <form onSubmit={handleProposeCamp} className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                હાલમાં કોઈ રસીકરણ ઝુંબેશ ઉપલબ્ધ નથી. કેમ્પ પ્રસ્તાવિત કરતાં પહેલાં કૃપા કરીને &apos;ઝુંબેશ&apos; ટેબમાં જઈ નવી ઝુંબેશ બનાવો.
              </span>
            </div>
          ) : (
            <FormField label="રસીકરણ ઝુંબેશ પસંદ કરો" required>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                required
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.status}] {c.code} — {c.name || c.name_gu}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="ગામ પસંદ કરો" required>
            <select
              value={villageId}
              onChange={(e) => setVillageId(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
              required
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name_gu} ({v.name_en})
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="કેમ્પની તારીખ" required>
              <input
                type="date"
                required
                value={campDate}
                onChange={(e) => setCampDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg"
              />
            </FormField>

            <FormField label="શરૂઆત સમય" required>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-2.5 top-3 text-gray-400" />
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 text-sm border rounded-lg"
                />
              </div>
            </FormField>

            <FormField label="સમાપ્તિ સમય" required>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-2.5 top-3 text-gray-400" />
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 text-sm border rounded-lg"
                />
              </div>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="કેમ્પનો પ્રકાર" required>
              <select
                value={organizerType}
                onChange={(e) => setOrganizerType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
              >
                <option value="GOVERNMENT">સરકારી સ્થિર કેમ્પ (Government Fixed)</option>
                <option value="DOORSTEP">ઘરબેઠા મુલાકાત રાઉન્ડ (Doorstep Round)</option>
                <option value="COOPERATIVE">સહકારી મંડળી કેમ્પ (Cooperative Camp)</option>
                <option value="JOINT">સંયુક્ત કેમ્પ (Joint Camp)</option>
              </select>
            </FormField>

            <FormField label="અંદાજિત પશુપાલકો">
              <input
                type="number"
                min="1"
                max="1000"
                value={expectedFarmers}
                onChange={(e) => setExpectedFarmers(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg"
                placeholder="દા.ત. 30"
              />
            </FormField>
          </div>

          <FormField label="સ્થળ / કેમ્પનું સરનામું">
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="દા.ત. ગામ પંચાયત ચોક / પશુ ચિકિત્સાલય સંકુલ"
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </FormField>

          <FormField label="નોંધ / સૂચના">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="કેમ્પના સ્થળ કે ખાસ વ્યવસ્થા અંગે નોંધ..."
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              રદ કરો
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              disabled={campaigns.length === 0}
            >
              કેમ્પ પ્રસ્તાવિત કરો
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

