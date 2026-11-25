import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { AnimalQrCard } from '../../components/common/AnimalQrCard';
import { UniversalAnimalRegistrationModal } from '../../components/animals/UniversalAnimalRegistrationModal';
import { useAuth } from '../../context/AuthContext';
import {
  fwService,
  type FWAnimalItem,
  type FWAnimalDetail,
  type FWFarmerItem,
  type FWVillageItem,
} from '../../services/fwService';
import {
  CheckSquare,
  Search,
  RotateCcw,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Tag,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય',
  BUFFALO: 'ભેંસ',
  GOAT: 'બકરી',
  SHEEP: 'ઘેટું',
  OTHER: 'અન્ય',
};

export const FwAnimalsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [villages, setVillages] = useState<FWVillageItem[]>([]);
  const [activeVillageId, setActiveVillageId] = useState<string>(() => {
    return localStorage.getItem('fw_active_village_id') || '';
  });

  const [farmers, setFarmers] = useState<FWFarmerItem[]>([]);
  const [animals, setAnimals] = useState<FWAnimalItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<FWAnimalDetail | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-Modals for Actions
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Action input states
  const [newQrToken, setNewQrToken] = useState('');
  const [newTagNumber, setNewTagNumber] = useState('');
  const [transferFarmerId, setTransferFarmerId] = useState('');
  const [transferReason, setTransferReason] = useState('');

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
        console.warn('Failed to load villages in AnimalsView:', e);
      }
    };
    fetchVillages();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // Load Farmers in Active Village for Dropdown
  useEffect(() => {
    let isMounted = true;
    if (!activeVillageId) return;

    const fetchFarmers = async () => {
      try {
        const data = await fwService.listFarmers(apiBaseUrl, activeVillageId);
        if (isMounted) {
          setFarmers(data);
        }
      } catch (e) {
        console.warn('Failed to load village farmers for dropdown:', e);
      }
    };
    fetchFarmers();
    return () => {
      isMounted = false;
    };
  }, [activeVillageId, apiBaseUrl]);

  // Load Animals in Active Village
  const loadAnimals = async () => {
    if (!activeVillageId) {
      setAnimals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotice(null);
    try {
      const data = await fwService.listAnimals(
        apiBaseUrl,
        activeVillageId,
        undefined,
        speciesFilter || undefined
      );
      setAnimals(data);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'પશુ યાદી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnimals();
  }, [activeVillageId, speciesFilter, apiBaseUrl]);

  const handleVillageChange = (vid: string) => {
    setActiveVillageId(vid);
    localStorage.setItem('fw_active_village_id', vid);
  };

  // Open Animal Detail
  const handleOpenDetail = async (animal: FWAnimalItem) => {
    try {
      const detail = await fwService.getAnimal(apiBaseUrl, animal.id);
      setSelectedAnimal(detail);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'પશુ વિગત મેળવવામાં નિષ્ફળ.',
      });
    }
  };

  // Verify Animal
  const handleVerifyAnimal = async () => {
    if (!selectedAnimal) return;
    setIsSubmitting(true);
    try {
      await fwService.verifyAnimal(apiBaseUrl, selectedAnimal.id);
      setNotice({ type: 'success', message: 'પશુની ભૌતિક ઓળખ સફળતાપૂર્વક ચકાસાયી.' });
      setSelectedAnimal({ ...selectedAnimal, registration_status: 'VERIFIED' });
      await loadAnimals();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'પશુ ચકાસણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign / Re-tag QR
  const handleAssignQr = async () => {
    if (!selectedAnimal) return;
    setIsSubmitting(true);
    try {
      const res = await fwService.assignQrToken(apiBaseUrl, selectedAnimal.id, newQrToken || undefined);
      setNotice({
        type: 'success',
        message: `QR ટોકન ${res.token} સફળતાપૂર્વક ફાળવવામાં આવ્યો (જૂનો ટોકન રદ થયો).`,
      });
      setSelectedAnimal({ ...selectedAnimal, active_qr_token: res.token });
      setIsQrModalOpen(false);
      setNewQrToken('');
      await loadAnimals();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'QR ફાળવણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add External Tag / Barcode
  const handleAddExternalTag = async () => {
    if (!selectedAnimal) return;
    if (!newTagNumber.trim() || newTagNumber.trim().length < 3) {
      setNotice({ type: 'error', message: 'કૃપા કરીને માન્ય ટેગ અથવા બારકોડ નંબર દાખલ કરો.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await fwService.addExternalId(apiBaseUrl, selectedAnimal.id, newTagNumber.trim());
      setNotice({ type: 'success', message: 'ભૌતિક ટેગ / બારકોડ સફળતાપૂર્વક જોડાયો.' });
      setSelectedAnimal({ ...selectedAnimal, bharat_pashudhan_tag: newTagNumber.trim() });
      setIsTagModalOpen(false);
      setNewTagNumber('');
      await loadAnimals();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'ટેગ નોંધણી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request Ownership Transfer
  const handleRequestTransfer = async () => {
    if (!selectedAnimal || !transferFarmerId || !transferReason.trim()) {
      setNotice({ type: 'error', message: 'કૃપા કરીને નવો ખેડૂત પસંદ કરો અને કારણ દાખલ કરો.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await fwService.requestOwnershipTransfer(
        apiBaseUrl,
        selectedAnimal.id,
        transferFarmerId,
        transferReason.trim()
      );
      setNotice({
        type: 'success',
        message: 'માલિકી બદલી વિનંતી સફળતાપૂર્વક નોંધાઈ. વેટરનરી અધિકારીની મંજૂરી બાદ માલિકી બદલાશે.',
      });
      setIsTransferModalOpen(false);
      setTransferReason('');
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'માલિકી બદલી વિનંતી નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<FWAnimalItem>[] = [
    {
      key: 'code',
      header: 'પશુ કોડ / જાતિ',
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1E293B] font-mono">{row.animal_code || row.id.substring(0, 8)}</div>
          <div className="text-xs text-[#64748B] mt-0.5">
            {SPECIES_NAMES_GU[row.species_code] || row.species_code} • {row.sex === 'F' ? 'માદા' : row.sex === 'M' ? 'નર' : 'અજ્ઞાત'}
          </div>
        </div>
      ),
    },
    {
      key: 'age',
      header: 'અંદાજિત ઉંમર',
      render: (row) => (
        <span className="text-xs text-[#1E293B]">
          {row.age_months_estimate ? `${row.age_months_estimate} માસ` : 'નિયત નથી'}
        </span>
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
      header: 'કાર્યવાહી',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => handleOpenDetail(row)}>
          વિગત / QR
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
          <Button variant="outline" size="sm" onClick={loadAnimals} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
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
              if (farmers.length === 0) {
                setNotice({
                  type: 'error',
                  message: 'પશુ નોંધણી કરતા પહેલા ઓછામાં ઓછો એક ખેડૂત નોંધાયેલ હોવો જરૂરી છે. કૃપા કરીને પહેલા ખેડૂત નોંધણી કરો.',
                });
                return;
              }
              setIsRegisterModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + નવું પશુ નોંધો
          </Button>
        </div>
      </div>

      {/* Village Picker Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#135D43]" />
            ગામ પશુધન રજીસ્ટર
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
          message="પશુ યાદી જોવા માટે તમારા એકાઉન્ટમાં ગામ ફાળવેલું હોવું જરૂરી છે. કૃપા કરીને વેટરનરી ઓફિસર અથવા DAHO નો સંપર્ક કરો."
        />
      ) : (
        <>
          {/* Filters & Search */}
          <div className="flex gap-2">
            <select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="px-3 py-2 text-xs border rounded-xl bg-white text-[#1E293B]"
            >
              <option value="">બધી જાતિઓ</option>
              <option value="CATTLE">ગાય</option>
              <option value="BUFFALO">ભેંસ</option>
              <option value="GOAT">બકરી</option>
              <option value="SHEEP">ઘેટું</option>
            </select>

            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="કોડ અથવા ટેગ શોધો..."
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#135D43]"
              />
            </div>
          </div>

          {/* Animals Table */}
          {isLoading ? (
            <StateView state="loading" message="પશુઓની માહિતી લોડ થઈ રહી છે..." />
          ) : animals.length === 0 ? (
            <StateView
              state="empty"
              title="કોઈ પશુ નોંધાયેલ નથી"
              message="આ ગામ માટે કોઈ પશુ નોંધાયેલા નથી. નવું પશુ નોંધવા ઉપરનું બટન દબાવો."
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
              <DataTable data={animals} columns={columns} keyExtractor={(a) => a.id} />
            </div>
          )}
        </>
      )}

      {/* Universal Animal Registration Modal */}
      <UniversalAnimalRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        activeVillageId={activeVillageId}
        farmers={farmers}
        onSuccess={async (newAnimal) => {
          setIsRegisterModalOpen(false);
          setNotice({
            type: 'success',
            message: `પશુ ${newAnimal.animal_code || ''} સફળતાપૂર્વક નોંધાયું.`,
          });
          await loadAnimals();
          try {
            const detail = await fwService.getAnimal(apiBaseUrl, newAnimal.id);
            setSelectedAnimal(detail);
          } catch {
            setSelectedAnimal(newAnimal as any);
          }
        }}
      />

      {/* Animal Detail Modal */}
      <Modal
        isOpen={Boolean(selectedAnimal)}
        onClose={() => setSelectedAnimal(null)}
        title={selectedAnimal ? `પશુ પ્રોફાઇલ: ${selectedAnimal.animal_code || selectedAnimal.id.substring(0, 8)}` : 'વિગત'}
      >
        {selectedAnimal && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl">
              <div>
                <span className="text-[#64748B]">આંતરિક કોડ:</span>
                <p className="font-bold text-[#1E293B] font-mono mt-0.5">{selectedAnimal.animal_code || 'નિયત નથી'}</p>
              </div>
              <div>
                <span className="text-[#64748B]">ઓળખ સ્થિતિ:</span>
                <div className="mt-0.5">
                  <StatusChip
                    variant={selectedAnimal.registration_status === 'VERIFIED' ? 'success' : 'warning'}
                    label={selectedAnimal.registration_status === 'VERIFIED' ? 'ચકાસાયેલ' : 'નોંધાયેલ'}
                  />
                </div>
              </div>
              <div>
                <span className="text-[#64748B]">જાતિ / લિંગ:</span>
                <p className="font-semibold text-[#1E293B] mt-0.5">
                  {SPECIES_NAMES_GU[selectedAnimal.species_code] || selectedAnimal.species_code} • {selectedAnimal.sex === 'F' ? 'માદા' : selectedAnimal.sex === 'M' ? 'નર' : 'અજ્ઞાત'}
                </p>
              </div>
              <div>
                <span className="text-[#64748B]">ઉંમર:</span>
                <p className="font-semibold text-[#1E293B] mt-0.5">{selectedAnimal.age_months_estimate ? `${selectedAnimal.age_months_estimate} માસ` : 'માહિતી નથી'}</p>
              </div>
            </div>

            {/* Visual Scannable Tag Card (QR & 1D Barcode) */}
            {selectedAnimal.active_qr_token || selectedAnimal.bharat_pashudhan_tag || (selectedAnimal as any).active_tag ? (
              <div className="space-y-2">
                <AnimalQrCard
                  tagType="BOTH"
                  token={selectedAnimal.active_qr_token}
                  barcodeValue={selectedAnimal.bharat_pashudhan_tag || (selectedAnimal as any).active_tag || selectedAnimal.animal_code}
                  animalCode={selectedAnimal.animal_code}
                  speciesCode={selectedAnimal.species_code}
                  sex={selectedAnimal.sex}
                  tagNumber={selectedAnimal.bharat_pashudhan_tag || (selectedAnimal as any).active_tag}
                  farmerName={(selectedAnimal as any).farmer_name || selectedAnimal.owner_name}
                  villageName={(selectedAnimal as any).village_name || selectedAnimal.village_name}
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsQrModalOpen(true)}
                    leftIcon={<QrCode className="w-3.5 h-3.5" />}
                  >
                    રી-ટેગ (નવો QR કોડ બદલો)
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs">આ પશુને હજુ સુધી QR કોડ ફાળવેલ નથી</h5>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      ઝડપી કેમેરા સ્કેનિંગ અને રસીકરણ ટ્રેકિંગ માટે ૧-ક્લિકમાં નવો QR કોડ ફાળવો.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAssignQr}
                    isLoading={isSubmitting}
                    leftIcon={<QrCode className="w-4 h-4" />}
                  >
                    + નવો QR કોડ જનરેટ કરો
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsQrModalOpen(true)}
                  >
                    કસ્ટમ ટોકન દાખલ કરો
                  </Button>
                </div>
              </div>
            )}

            {/* Physical Tag Card */}
            <div className="p-3 border rounded-xl flex items-center justify-between bg-gray-50">
              <div>
                <span className="text-[#64748B] text-xs">કાનનો ટેગ / બારકોડ:</span>
                <p className="font-bold text-[#1E293B] font-mono mt-0.5 text-xs">
                  {selectedAnimal.bharat_pashudhan_tag || (selectedAnimal as any).active_tag || 'ટેગ જોડાયેલ નથી'}
                </p>
              </div>
              {!selectedAnimal.bharat_pashudhan_tag && !(selectedAnimal as any).active_tag && (
                <Button variant="outline" size="sm" onClick={() => setIsTagModalOpen(true)} leftIcon={<Tag className="w-3.5 h-3.5" />}>
                  + ટેગ જોડો
                </Button>
              )}
            </div>

            {/* Verification, Transfer & Direct Workflow Actions */}
            <div className="flex flex-wrap gap-2 pt-2 justify-between items-center border-t border-[#E2E8F0]">
              <div className="flex flex-wrap gap-2">
                {selectedAnimal.registration_status !== 'VERIFIED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleVerifyAnimal}
                    isLoading={isSubmitting}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    ભૌતિક ઓળખ ચકાસો
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/fw/reports/new?animal_id=${selectedAnimal.id}&village_id=${selectedAnimal.village_id}`
                    )
                  }
                  leftIcon={<AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                >
                  રોગ અહેવાલ નોંધો
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/fw/vaccinations?animal_id=${selectedAnimal.id}`)}
                  leftIcon={<Calendar className="w-3.5 h-3.5 text-[#135D43]" />}
                >
                  રસીકરણ / સારવાર
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTransferModalOpen(true)}
                  leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                >
                  માલિકી બદલી વિનંતી
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={() => setSelectedAnimal(null)}>
                બંધ કરો
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* QR Re-tag Modal */}
      <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="QR ટોકન ફાળવો / બદલો">
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">મહત્વની સૂચના (Re-tag Rule):</p>
              <p className="mt-0.5 leading-relaxed">
                નવો QR કોડ ફાળવવાથી અગાઉનો તમામ QR ટોકન આપોઆપ રદ (Revoke) થઈ જશે. નવો ટોકન ખાલી રાખશો તો સિસ્ટમ આપોઆપ નવો Base32 ટોકન બનાવી આપશે.
              </p>
            </div>
          </div>

          <FormField label="નવો પ્રિન્ટેડ Base32 QR કોડ (વૈકલ્પિક)">
            <input
              type="text"
              value={newQrToken}
              onChange={(e) => setNewQrToken(e.target.value.toUpperCase())}
              maxLength={26}
              placeholder="ખાલી રાખવાથી આપોઆપ જનરેટ થશે"
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono uppercase"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsQrModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" onClick={handleAssignQr} isLoading={isSubmitting}>
              ટોકન ફાળવો
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add External Tag Modal */}
      <Modal isOpen={isTagModalOpen} onClose={() => setIsTagModalOpen(false)} title="ભૌતિક કાન ટેગ / બારકોડ જોડો">
        <div className="space-y-4 text-xs">
          <FormField label="કાન ટેગ અથવા ૧D બારકોડ નંબર" required>
            <input
              type="text"
              value={newTagNumber}
              onChange={(e) => setNewTagNumber(e.target.value)}
              placeholder="દા.ત. 202412000005 અથવા 123456789100"
              className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsTagModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" onClick={handleAddExternalTag} isLoading={isSubmitting}>
              ટેગ સાચવો
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ownership Transfer Request Modal */}
      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="માલિકી બદલી વિનંતી">
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">વિનંતી પ્રક્રિયા:</p>
              <p className="mt-0.5 text-blue-800 leading-relaxed">
                આ માત્ર માલિકી બદલીની વિનંતી નોંધશે. વેટરનરી ઓફિસર (VO) ની સત્તાવાર મંજૂરી બાદ જ માલિકીમાં ફેરફાર લાગુ થશે.
              </p>
            </div>
          </div>

          <FormField label="નવા માલિક ખેડૂત પસંદ કરો" required>
            <select
              value={transferFarmerId}
              onChange={(e) => setTransferFarmerId(e.target.value)}
              className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
            >
              <option value="">-- ખેડૂત પસંદ કરો --</option>
              {farmers
                .filter((f) => f.id !== selectedAnimal?.farmer_id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.full_name} ({f.farmer_code || f.mobile_e164 || 'ખેડૂત'})
                  </option>
                ))}
            </select>
          </FormField>

          <FormField label="માલિકી બદલીનું કારણ" required>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              rows={2}
              placeholder="વેચાણ, ભેટ, વંશપરંપરાગત ફેરબદલ..."
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsTransferModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" onClick={handleRequestTransfer} isLoading={isSubmitting}>
              વિનંતી સબમિટ કરો
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

