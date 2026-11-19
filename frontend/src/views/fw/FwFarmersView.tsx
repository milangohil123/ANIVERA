import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { fwService, type FWFarmerItem, type FWFarmerDetail, type FWVillageItem } from '../../services/fwService';
import {
  Users,
  Search,
  RotateCcw,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Phone,
  MapPin,
} from 'lucide-react';

const farmerSchema = z.object({
  full_name: z.string().trim().min(2, 'સંપૂર્ણ નામ ઓછામાં ઓછું ૨ અક્ષરનું હોવું જોઈએ').max(200),
  mobile_e164: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\+[1-9][0-9]{7,14}$/.test(val), {
      message: 'મોબાઇલ નંબર માન્ય E.164 ફોર્મેટમાં હોવો જોઈએ (દા.ત. +919876543210)',
    }),
  address_text: z.string().trim().max(500).optional(),
  data_consent: z.literal(true, {
    errorMap: () => ({ message: 'ખેડૂતની ડેટા પ્રોસેસિંગ સંમતિ (Consent) અનિવાર્ય છે' }),
  }),
});

export const FwFarmersView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, deviceInfo } = useAuth();

  const [villages, setVillages] = useState<FWVillageItem[]>([]);
  const [activeVillageId, setActiveVillageId] = useState<string>(() => {
    return localStorage.getItem('fw_active_village_id') || '';
  });

  const [farmers, setFarmers] = useState<FWFarmerItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<FWFarmerDetail | null>(null);
  const [_isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileShared, setMobileShared] = useState(false);
  const [hasSmartphone, setHasSmartphone] = useState<'UNKNOWN' | 'YES' | 'NO'>('UNKNOWN');
  const [address, setAddress] = useState('');
  const [dataConsent, setDataConsent] = useState(true);
  const [outreachConsent, _setOutreachConsent] = useState<'UNKNOWN' | 'GRANTED' | 'WITHDRAWN'>('GRANTED');

  // Load Assigned Villages
  useEffect(() => {
    let isMounted = true;
    const fetchVillages = async () => {
      try {
        const list = await fwService.listAssignedVillages(apiBaseUrl);
        if (isMounted) {
          setVillages(list);
          if (list.length > 0) {
            const saved = localStorage.getItem('fw_active_village_id');
            const valid = list.some((v) => v.id === saved);
            const chosen = valid && saved ? saved : list[0].id;
            setActiveVillageId(chosen);
            localStorage.setItem('fw_active_village_id', chosen);
          }
        }
      } catch (e) {
        console.warn('Failed to load villages in FarmersView:', e);
      }
    };
    fetchVillages();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // Load Farmers in Active Village
  const loadFarmers = async () => {
    if (!activeVillageId) {
      setFarmers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotice(null);
    try {
      const data = await fwService.listFarmers(apiBaseUrl, activeVillageId, searchTerm);
      setFarmers(data);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ખેડૂતોની યાદી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFarmers();
  }, [activeVillageId, apiBaseUrl]);

  const handleVillageChange = (vid: string) => {
    setActiveVillageId(vid);
    localStorage.setItem('fw_active_village_id', vid);
  };

  // Create Farmer Submit
  const handleCreateFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const formattedMobile = mobile.trim() ? (mobile.startsWith('+') ? mobile.trim() : `+91${mobile.trim()}`) : undefined;

    const val = farmerSchema.safeParse({
      full_name: fullName,
      mobile_e164: formattedMobile,
      address_text: address || undefined,
      data_consent: dataConsent,
    });

    if (!val.success) {
      const errMap: Record<string, string> = {};
      val.error.errors.forEach((err) => {
        if (err.path[0]) errMap[String(err.path[0])] = err.message;
      });
      setFormErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await fwService.registerFarmer(
        apiBaseUrl,
        {
          full_name: fullName.trim(),
          village_id: activeVillageId,
          mobile_e164: formattedMobile,
          mobile_shared: mobileShared,
          has_smartphone: hasSmartphone,
          address_text: address.trim() || undefined,
          data_consent: dataConsent,
          outreach_consent: outreachConsent,
        },
        deviceInfo
      );

      if (result.isOffline) {
        setNotice({
          type: 'success',
          message: `ખેડૂત સફળતાપૂર્વક ઑફલાઇન કતારમાં નોંધાયેલ છે (ઇવેન્ટ ID: ${result.queuedEventId}). નેટવર્ક મળતા આપમેળે સિંક થશે.`,
        });
      } else {
        setNotice({
          type: 'success',
          message: 'ખેડૂત સફળતાપૂર્વક નોંધાયા.',
        });
      }

      setIsCreateModalOpen(false);
      setFullName('');
      setMobile('');
      setAddress('');
      setMobileShared(false);
      setHasSmartphone('UNKNOWN');
      setDataConsent(true);
      await loadFarmers();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ખેડૂત નોંધણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Farmer Detail
  const handleOpenDetail = async (farmer: FWFarmerItem) => {
    setIsLoadingDetail(true);
    try {
      const detail = await fwService.getFarmer(apiBaseUrl, farmer.id);
      setSelectedFarmer(detail);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ખેડૂત વિગત મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Verify Farmer
  const handleVerifyFarmer = async (farmerId: string) => {
    setIsSubmitting(true);
    try {
      await fwService.verifyFarmer(apiBaseUrl, farmerId);
      setNotice({ type: 'success', message: 'ખેડૂત ઓળખ ભૌતિક રીતે ચકાસવામાં આવી.' });
      if (selectedFarmer) {
        setSelectedFarmer({ ...selectedFarmer, registration_status: 'VERIFIED' });
      }
      await loadFarmers();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ખેડૂત ચકાસણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<FWFarmerItem>[] = [
    {
      key: 'name',
      header: 'ખેડૂતનું નામ / કોડ',
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1E293B]">{row.full_name}</div>
          <div className="text-xs text-[#64748B] font-mono mt-0.5">{row.farmer_code || 'કોડ નિયત નથી'}</div>
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'મોબાઇલ નંબર',
      render: (row) => (
        <div className="text-xs text-[#1E293B]">
          {row.mobile_e164 ? (
            <span className="font-mono flex items-center gap-1">
              <Phone className="w-3 h-3 text-[#64748B]" />
              {row.mobile_e164}
            </span>
          ) : (
            <span className="text-[#64748B] italic">નોંધાયેલ નથી</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => {
        const isVer = row.registration_status === 'VERIFIED';
        return (
          <StatusChip
            variant={isVer ? 'success' : 'warning'}
            label={isVer ? 'ચકાસાયેલ' : 'નોંધાયેલ'}
          />
        );
      },
    },
    {
      key: 'actions',
      header: 'વિગત',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => handleOpenDetail(row)}>
          જુઓ
        </Button>
      ),
    },
  ];

  const activeVillageObj = villages.find((v) => v.id === activeVillageId);

  return (
    <div className="w-full space-y-4 pb-10 font-body text-[#172033]">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button variant="outline" size="sm" onClick={() => navigate('/fw/home')} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
          હોમ
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFarmers} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            તાજું કરો
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (!activeVillageId) {
                setNotice({ type: 'error', message: 'કૃપા કરીને પહેલા સક્રિય ગામ પસંદ કરો.' });
                return;
              }
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + નવો ખેડૂત
          </Button>
        </div>
      </div>

      {/* Village Picker Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-[#135D43]" />
            ગામના ખેડૂત પશુપાલક રજીસ્ટર
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            ગામ: <span className="font-semibold text-[#1E293B]">{activeVillageObj?.name_gu || 'કોઈ નહીં'}</span>
          </p>
        </div>

        {villages.length > 1 && (
          <select
            value={activeVillageId}
            onChange={(e) => handleVillageChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B]"
          >
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name_gu} ({v.code})
              </option>
            ))}
          </select>
        )}
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Honest Empty State for No Village */}
      {villages.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ ગામ ફાળવેલ નથી"
          message="ખેડૂત યાદી જોવા માટે તમારા એકાઉન્ટમાં ગામ ફાળવેલું હોવું જરૂરી છે. કૃપા કરીને વેટરનરી ઓફિસર અથવા DAHO નો સંપર્ક કરો."
        />
      ) : (
        <>
          {/* Search Box */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadFarmers()}
                placeholder="ખેડૂતનું નામ, મોબાઇલ કે કોડ શોધો..."
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#135D43]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadFarmers}>
              શોધો
            </Button>
          </div>

          {/* Farmers Table */}
          {isLoading ? (
            <StateView state="loading" message="ખેડૂતોની માહિતી લોડ થઈ રહી છે..." />
          ) : farmers.length === 0 ? (
            <StateView
              state="empty"
              title="કોઈ ખેડૂત મળ્યા નથી"
              message="આ ગામ માટે કોઈ ખેડૂત નોંધાયેલા નથી અથવા શોધ પરિણામ શૂન્ય છે."
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
              <DataTable data={farmers} columns={columns} keyExtractor={(f) => f.id} />
            </div>
          )}
        </>
      )}

      {/* Add New Farmer Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="નવા ખેડૂત પશુપાલકની નોંધણી">
        <form onSubmit={handleCreateFarmer} className="space-y-4">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>ફાળવેલ ગામ: <strong>{activeVillageObj?.name_gu} ({activeVillageObj?.code})</strong></span>
          </div>

          <FormField label="ખેડૂતનું પૂરું નામ" required error={formErrors.full_name}>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="દા.ત. રમેશભાઈ પટેલ"
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="મોબાઇલ નંબર (વૈકલ્પિક)" error={formErrors.mobile_e164}>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
              />
            </FormField>

            <FormField label="સ્માર્ટફોન ધરાવે છે?">
              <select
                value={hasSmartphone}
                onChange={(e) => setHasSmartphone(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              >
                <option value="UNKNOWN">માહિતી નથી</option>
                <option value="YES">હા</option>
                <option value="NO">ના</option>
              </select>
            </FormField>
          </div>

          <FormField label="સરનામું / વિગત">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="શેરી, વાડી વિસ્તાર..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={dataConsent}
                onChange={(e) => setDataConsent(e.target.checked)}
                className="mt-0.5 rounded text-[#135D43]"
              />
              <span className="text-[#1E293B] leading-relaxed">
                <strong>ડેટા પ્રોસેસિંગ સંમતિ (અનિવાર્ય સંમતિ):</strong> ખેડૂત પશુપાલન અને રોગ દેખરેખ વ્યવસ્થાપન માટે પોતાના ડેટાની નોંધણી માટે સંમત છે.
              </span>
            </label>
            {formErrors.data_consent && (
              <p className="text-[11px] text-red-600 font-medium pl-6">{formErrors.data_consent}</p>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={mobileShared}
                onChange={(e) => setMobileShared(e.target.checked)}
                className="rounded text-[#135D43]"
              />
              <span className="text-[#64748B]">આ મોબાઇલ નંબર પરિવારના અન્ય સભ્યો સાથે સહિયારો છે.</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsCreateModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              ખેડૂત સાચવો
            </Button>
          </div>
        </form>
      </Modal>

      {/* Farmer Detail Modal */}
      <Modal
        isOpen={Boolean(selectedFarmer)}
        onClose={() => setSelectedFarmer(null)}
        title={selectedFarmer ? `ખેડૂત વિગત: ${selectedFarmer.full_name}` : 'વિગત'}
      >
        {selectedFarmer && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl">
              <div>
                <span className="text-[#64748B]">ખેડૂત કોડ:</span>
                <p className="font-bold text-[#1E293B] font-mono mt-0.5">{selectedFarmer.farmer_code || 'નિયત નથી'}</p>
              </div>
              <div>
                <span className="text-[#64748B]">નોંધણી સ્થિતિ:</span>
                <div className="mt-0.5">
                  <StatusChip
                    variant={selectedFarmer.registration_status === 'VERIFIED' ? 'success' : 'warning'}
                    label={selectedFarmer.registration_status === 'VERIFIED' ? 'ચકાસાયેલ' : 'નોંધાયેલ'}
                  />
                </div>
              </div>
              <div>
                <span className="text-[#64748B]">મોબાઇલ નંબર:</span>
                <p className="font-bold text-[#1E293B] font-mono mt-0.5">{selectedFarmer.mobile_e164 || 'નથી'}</p>
              </div>
              <div>
                <span className="text-[#64748B]">મોબાઇલ સ્થિતિ:</span>
                <p className="font-semibold text-[#1E293B] mt-0.5">
                  {selectedFarmer.mobile_status === 'VERIFIED' ? 'ચકાસાયેલ' : selectedFarmer.mobile_status === 'ACTIVE' ? 'સક્રિય' : 'પેન્ડિંગ'}
                </p>
              </div>
            </div>

            <div className="p-3 border rounded-xl space-y-1.5">
              <p className="text-[#64748B]">સરનામું:</p>
              <p className="text-[#1E293B] font-medium">{selectedFarmer.address_text || 'માહિતી નથી'}</p>
              <p className="text-[11px] text-[#64748B] pt-1">
                સંમતિ નોંધણી: {selectedFarmer.data_consent_at ? new Date(selectedFarmer.data_consent_at).toLocaleDateString('gu-IN') : 'હા'}
              </p>
            </div>

            {/* Note on Login Account Provisioning */}
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">લોગિન એકાઉન્ટ વ્યવસ્થાપન:</p>
                <p className="text-blue-800 mt-0.5">
                  ખેડૂત પ્રોફાઇલ અને લોગિન એકાઉન્ટ અલગ-અલગ કામગીરી છે. ખેડૂતને OTP લોગિન સત્તા જિલ્લા વહીવટી સ્તરેથી પ્રોવિઝન થાય છે.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {selectedFarmer.registration_status !== 'VERIFIED' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleVerifyFarmer(selectedFarmer.id)}
                  isLoading={isSubmitting}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  ભૌતિક ઓળખ ચકાસણી કરો
                </Button>
              ) : (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> આ ખેડૂતની ઓળખ ચકાસાયેલી છે
                </span>
              )}

              <Button variant="outline" size="sm" onClick={() => setSelectedFarmer(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

