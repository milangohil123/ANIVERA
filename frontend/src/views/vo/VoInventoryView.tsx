import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import {
  dahoOpsService,
  type VaccineProductItem,
  type VaccineLotItem,
} from '../../services/dahoOpsService';
import { Package, RotateCcw, Shield, Layers, Thermometer } from 'lucide-react';

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

export const VoInventoryView: React.FC = () => {
  const { apiBaseUrl } = useAuth();
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'LOTS'>('PRODUCTS');
  const [products, setProducts] = useState<VaccineProductItem[]>([]);
  const [lots, setLots] = useState<VaccineLotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, lotList] = await Promise.all([
        dahoOpsService.listProducts(apiBaseUrl),
        dahoOpsService.listLots(apiBaseUrl),
      ]);
      setProducts(prods);
      setLots(lotList);
    } catch (e) {
      console.warn('Inventory read failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const productColumns: Column<VaccineProductItem>[] = [
    {
      key: 'name',
      header: 'રસીનું નામ / કોડ',
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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          {row.disease_code}
        </span>
      ),
    },
    {
      key: 'mfg',
      header: 'ઉત્પાદક',
      render: (row) => <span className="text-xs text-[#1E293B]">{row.manufacturer}</span>,
    },
    {
      key: 'temp',
      header: 'કોલ્ડ-ચેઇન તાપમાન',
      render: (row) => (
        <div className="flex items-center gap-1 text-xs text-[#64748B]">
          <Thermometer className="w-3.5 h-3.5 text-blue-500" />
          <span>{row.storage_temp_celsius || '2-8°C'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => (
        <StatusChip variant={row.active ? 'success' : 'neutral'} label={row.active ? 'સક્રિય' : 'નિષ્ક્રિય'} />
      ),
    },
  ];

  const lotColumns: Column<VaccineLotItem>[] = [
    {
      key: 'batch',
      header: 'બેચ નંબર',
      render: (row) => <span className="font-mono font-semibold text-[#1E293B]">{row.batch_number}</span>,
    },
    {
      key: 'expiry',
      header: 'સમાપ્તિ તારીખ',
      render: (row) => <span className="text-xs text-[#1E293B]">{row.expiry_date}</span>,
    },
    {
      key: 'balance',
      header: 'હાલનો સ્ટોક (વાયલ)',
      render: (row) => <span className="font-semibold text-emerald-700">{row.current_balance}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <Package className="w-5 h-5 text-[#135D43]" />
            રસી કેટાલોગ અને સ્ટોક (માત્ર વાંચન)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            વિભાગીય રસીકરણ અભિયાન માટે માન્ય રસી કેટાલોગ અને ઉપલબ્ધ બેચ સ્ટોક.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
          તાજું કરો
        </Button>
      </div>

      <div className="flex gap-2 border-b border-[#E2E8F0] pb-2">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'PRODUCTS' ? 'bg-[#135D43] text-white' : 'text-[#64748B] hover:bg-gray-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          રસી પ્રોડક્ટ્સ ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('LOTS')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'LOTS' ? 'bg-[#135D43] text-white' : 'text-[#64748B] hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          બેચ સ્ટોક ({lots.length})
        </button>
      </div>

      {isLoading ? (
        <StateView state="loading" message="ઈન્વેન્ટરી માહિતી લોડ થઈ રહી છે..." />
      ) : activeTab === 'PRODUCTS' ? (
        products.length === 0 ? (
          <StateView state="empty" title="કોઈ રસી પ્રોડક્ટ ઉપલબ્ધ નથી" message="કેટાલોગમાં કોઈ ડેટા નથી." />
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
            <DataTable data={products} columns={productColumns} keyExtractor={(p) => p.id} />
          </div>
        )
      ) : lots.length === 0 ? (
        <StateView state="empty" title="કોઈ બેચ ઉપલબ્ધ નથી" message="હાલમાં કોઈ સ્ટોક બેચ નોંધાયેલ નથી." />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable data={lots} columns={lotColumns} keyExtractor={(l) => l.id} />
        </div>
      )}
    </div>
  );
};

