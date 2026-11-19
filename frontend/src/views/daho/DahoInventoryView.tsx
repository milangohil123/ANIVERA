import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FormField } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StateView } from '../../components/common/StateView';
import { KpiCard } from '../../components/common/KpiCard';
import { useAuth } from '../../context/AuthContext';
import {
  dahoOpsService,
  type VaccineProductItem,
  type VaccineLotItem,
} from '../../services/dahoOpsService';
import {
  Package,
  RotateCcw,
  Plus,
  Shield,
  Layers,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  Syringe,
} from 'lucide-react';

const localizeVaccineName = (name?: string | null): string => {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.includes('fmd')) return 'FMD (ખરવા-મોવાસા) ઓઇલ એડજુવન્ટ રસી';
  if (lower.includes('hs') || lower.includes('hemorrhagic')) return 'HS (ગળસૂંઠો) એલમ પ્રેસિપિટેટેડ રસી';
  if (lower.includes('bq') || lower.includes('black quarter')) return 'BQ (ગાઠીયો તાવ) પોલિવેલેન્ટ રસી';
  if (lower.includes('brucella') || lower.includes('brucellosis')) return 'Brucella (બ્રુસેલોસિસ) S19 રસી';
  if (lower.includes('ppr')) return 'PPR (પીપીઆર) જીવંત રસી';
  return name;
};

export const DahoInventoryView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'LOTS'>('PRODUCTS');
  const [products, setProducts] = useState<VaccineProductItem[]>([]);
  const [lots, setLots] = useState<VaccineLotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Product Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [diseaseCode, setDiseaseCode] = useState('FMD');
  const [manufacturer, setManufacturer] = useState('');
  const [dosesPerVial, setDosesPerVial] = useState('20');
  const [shelfLifeDays, setShelfLifeDays] = useState('365');
  const [storageTemp, setStorageTemp] = useState('2-8°C');

  const loadInventory = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const [prods, lotList] = await Promise.all([
        dahoOpsService.listProducts(apiBaseUrl),
        dahoOpsService.listLots(apiBaseUrl),
      ]);
      setProducts(prods);
      setLots(lotList);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રસી સ્ટોક માહિતી મેળવવામાં નિષ્ફળ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [apiBaseUrl]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !manufacturer.trim()) {
      setNotice({ type: 'error', message: 'કૃપા કરીને બધા જરૂરી ખાના ભરો.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await dahoOpsService.createProduct(apiBaseUrl, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        disease_code: diseaseCode,
        manufacturer: manufacturer.trim(),
        doses_per_vial: Number(dosesPerVial) || 1,
        shelf_life_days: Number(shelfLifeDays) || 365,
        storage_temp_celsius: storageTemp.trim() || undefined,
      });

      setNotice({ type: 'success', message: 'નવી રસી પ્રોડક્ટ કેટાલોગમાં ઉમેરાઈ ગઈ.' });
      setIsModalOpen(false);
      setCode('');
      setName('');
      setManufacturer('');
      await loadInventory();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'રસી ઉમેરવામાં નિષ્ફળ.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const productColumns: Column<VaccineProductItem>[] = [
    {
      key: 'name',
      header: 'રસી કોડ / નામ',
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1E293B]">{localizeVaccineName(row.name)}</div>
          <div className="text-xs text-[#64748B] font-mono">{row.code}</div>
        </div>
      ),
    },
    {
      key: 'disease',
      header: 'રોગ',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          {row.disease_code}
        </span>
      ),
    },
    {
      key: 'manufacturer',
      header: 'ઉત્પાદક (Manufacturer)',
      render: (row) => <div className="text-xs text-[#1E293B] font-medium">{row.manufacturer}</div>,
    },
    {
      key: 'doses',
      header: 'ડોઝ / વાયલ',
      render: (row) => <span className="font-medium text-xs">{row.doses_per_vial} ડોઝ</span>,
    },
    {
      key: 'storage',
      header: 'સ્ટોરેજ તાપમાન',
      render: (row) => (
        <div className="flex items-center gap-1 text-xs text-[#64748B]">
          <Thermometer className="w-3.5 h-3.5 text-blue-500" />
          <span>{row.storage_temp_celsius || '2-8°C'}</span>
        </div>
      ),
    },
    {
      key: 'active',
      header: 'સ્થિતિ',
      render: (row) => (
        <StatusChip variant={row.active ? 'success' : 'neutral'} label={row.active ? 'સક્રિય' : 'નિષ્ક્રિય'} />
      ),
    },
  ];

  const lotColumns: Column<VaccineLotItem>[] = [
    {
      key: 'batch',
      header: 'બેચ નંબર (Lot)',
      render: (row) => <div className="font-mono font-semibold text-[#1E293B]">{row.batch_number}</div>,
    },
    {
      key: 'dates',
      header: 'ઉત્પાદન / એક્સપાયરી',
      render: (row) => (
        <div className="text-xs text-[#64748B]">
          <div>ઉત્પાદન: {row.manufacturing_date}</div>
          <div className="font-medium text-[#1E293B]">સમાપ્તિ: {row.expiry_date}</div>
        </div>
      ),
    },
    {
      key: 'initial',
      header: 'પ્રારંભિક જથ્થો',
      render: (row) => <span>{row.initial_quantity} વાયલ</span>,
    },
    {
      key: 'balance',
      header: 'હાલનો સ્ટોક (Balance)',
      render: (row) => (
        <span className="font-semibold text-emerald-700">{row.current_balance} વાયલ</span>
      ),
    },
  ];

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.active).length;
  const totalLots = lots.length;
  const totalVialsBalance = lots.reduce((acc, l) => acc + (Number(l.current_balance) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Package className="w-5 h-5 text-[#135D43]" />
            રસી સ્ટોક અને ઈન્વેન્ટરી (Vaccine Inventory)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            જિલ્લા વેક્સિન સ્ટોરેજ, બેચ નંબર અને કોલ્ડ-ચેઈન ઈન્વેન્ટરીનું સતત મોનિટરિંગ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadInventory} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            તાજું કરો
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            + નવી રસી
          </Button>
        </div>
      </div>

      {notice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* KPI Overview Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <KpiCard
          label="રસી પ્રોડક્ટ્સ"
          value={isLoading ? '...' : totalProducts}
          subtext={`${activeProducts} સક્રિય ફોર્મ્યુલેશન`}
          icon={<Syringe className="w-3.5 h-3.5" />}
          iconVariant="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="ઉપલબ્ધ બેચ / લોટ"
          value={isLoading ? '...' : totalLots}
          subtext="વિતરણ માટે પ્રમાણિત"
          icon={<Layers className="w-3.5 h-3.5" />}
          iconVariant="blue"
          isLoading={isLoading}
        />
        <KpiCard
          label="કુલ વાયલ સ્ટોક"
          value={isLoading ? '...' : totalVialsBalance.toLocaleString('gu-IN')}
          valueColor="text-emerald-700"
          subtext="બોટાદ કેન્દ્રીય ડેપો"
          icon={<Package className="w-3.5 h-3.5" />}
          iconVariant="emerald"
          isLoading={isLoading}
        />
        <KpiCard
          label="કોલ્ડ ચેઈન સ્પેક"
          value="2-8°C"
          subtext="આદર્શ સંગ્રહ તાપમાન"
          icon={<Thermometer className="w-3.5 h-3.5" />}
          iconVariant="purple"
          isLoading={isLoading}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E2E8F0] pb-2">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'PRODUCTS' ? 'bg-[#135D43] text-white shadow-xs' : 'text-[#64748B] hover:bg-gray-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          રસી કેટાલોગ ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('LOTS')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'LOTS' ? 'bg-[#135D43] text-white shadow-xs' : 'text-[#64748B] hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          બેચ / લોટ સ્ટોક ({lots.length})
        </button>
      </div>

      {isLoading ? (
        <StateView state="loading" message="ઈન્વેન્ટરી માહિતી લોડ થઈ રહી છે..." />
      ) : activeTab === 'PRODUCTS' ? (
        products.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ રસી નોંધાયેલ નથી"
            message="હાલમાં કોઈ વેક્સિન પ્રોડક્ટ ઉપલબ્ધ નથી. નવી રસી ઉમેરવા ઉપરનું બટન દબાવો."
          />
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
            <DataTable data={products} columns={productColumns} keyExtractor={(p) => p.id} />
          </div>
        )
      ) : lots.length === 0 ? (
        <StateView
          state="empty"
          title="કોઈ એક્ટિવ બેચ નથી"
          message="હાલમાં કોઈ બેચ / લોટ એન્ટ્રી ઉપલબ્ધ નથી."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable data={lots} columns={lotColumns} keyExtractor={(l) => l.id} />
        </div>
      )}

      {/* Add Product Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="નવી રસી પ્રોડક્ટ નોંધો">
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="રસી કોડ" required>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="દા.ત. VAC-FMD-01"
                className="w-full px-3 py-2 text-sm border rounded-lg uppercase font-mono"
              />
            </FormField>
            <FormField label="રસીનું નામ" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Raksha-Ovac FMD"
                className="w-full px-3 py-2 text-sm border rounded-lg"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="રોગ લક્ષ્યાંક" required>
              <select
                value={diseaseCode}
                onChange={(e) => setDiseaseCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
              >
                <option value="FMD">FMD (ખરવા મોવાસા)</option>
                <option value="HS">HS (ગળસૂંઠો)</option>
                <option value="BQ">BQ (ગાઠીયો તાવ)</option>
                <option value="BRUCELLOSIS">Brucellosis (બ્રુસેલોસિસ)</option>
                <option value="PPR">PPR (પીપીઆર)</option>
              </select>
            </FormField>

            <FormField label="ઉત્પાદક કંપની" required>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Indian Immunologicals Ltd"
                className="w-full px-3 py-2 text-sm border rounded-lg"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="ડોઝ / વાયલ">
              <input
                type="number"
                value={dosesPerVial}
                onChange={(e) => setDosesPerVial(e.target.value)}
                min="1"
                className="w-full px-3 py-2 text-sm border rounded-lg"
              />
            </FormField>
            <FormField label="શેલ્ફ લાઈફ (દિવસ)">
              <input
                type="number"
                value={shelfLifeDays}
                onChange={(e) => setShelfLifeDays(e.target.value)}
                min="30"
                className="w-full px-3 py-2 text-sm border rounded-lg"
              />
            </FormField>
            <FormField label="તાપમાન રેન્જ">
              <input
                type="text"
                value={storageTemp}
                onChange={(e) => setStorageTemp(e.target.value)}
                placeholder="2-8°C"
                className="w-full px-3 py-2 text-sm border rounded-lg"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              રદ કરો
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              ઉમેરો
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

