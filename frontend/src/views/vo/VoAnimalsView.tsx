import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { CheckSquare, RotateCcw, MapPin, Search } from 'lucide-react';

const SPECIES_NAMES_GU: Record<string, string> = {
  CATTLE: 'ગાય',
  BUFFALO: 'ભેંસ',
  GOAT: 'બકરી',
  SHEEP: 'ઘેટું',
  OTHER: 'અન્ય',
};

interface AnimalItem {
  id: string;
  village_id: string;
  species_code: string;
  breed_id?: string | null;
  gender: string;
  status: string;
  external_tag?: string | null;
  created_at: string;
}

export const VoAnimalsView: React.FC = () => {
  const { apiBaseUrl, session } = useAuth();
  const [animals, setAnimals] = useState<AnimalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTag, setSearchTag] = useState('');

  const loadAnimals = async () => {
    setIsLoading(true);
    try {
      const token = session?.accessToken || '';
      const res = await fetch(`${apiBaseUrl}/api/v1/animals?limit=100`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setAnimals(await res.json());
      }
    } catch (e) {
      console.warn('Animals load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnimals();
  }, [apiBaseUrl]);

  const filteredAnimals = animals.filter((a) => {
    if (!searchTag.trim()) return true;
    return a.id.toLowerCase().includes(searchTag.toLowerCase()) ||
      (a.external_tag && a.external_tag.includes(searchTag.trim()));
  });

  const columns: Column<AnimalItem>[] = [
    {
      key: 'id',
      header: 'પશુ ઓળખ આઈડી',
      render: (row) => (
        <div>
          <div className="font-mono font-semibold text-[#1E293B]">{row.id.substring(0, 8)}...</div>
          {row.external_tag && (
            <div className="text-xs text-[#135D43] font-mono">ટેગ: {row.external_tag}</div>
          )}
        </div>
      ),
    },
    {
      key: 'species',
      header: 'જાતિ અને લિંગ',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          {SPECIES_NAMES_GU[row.species_code] || row.species_code} ({row.gender === 'FEMALE' ? 'માદા' : 'નર'})
        </span>
      ),
    },
    {
      key: 'village',
      header: 'ગામ ઓળખ',
      render: (row) => (
        <div className="flex items-center gap-1 text-xs text-[#1E293B] font-mono">
          <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
          <span>{row.village_id.substring(0, 8)}...</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'સ્થિતિ',
      render: (row) => (
        <StatusChip variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} label={row.status === 'ACTIVE' ? 'સક્રિય' : row.status} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B] font-heading flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#135D43]" />
            પશુ રજિસ્ટ્રી અને ચકાસણી
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            તમારા અધિકૃત ગામડાઓમાં નોંધાયેલા પશુઓની યાદી અને ક્લિનિકલ ઇતિહાસ.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAnimals} isLoading={isLoading} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
          તાજું કરો
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTag}
            onChange={(e) => setSearchTag(e.target.value)}
            placeholder="પશુ ID અથવા ટેગ દ્વારા શોધો..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg bg-white"
          />
        </div>
      </div>

      {isLoading ? (
        <StateView state="loading" message="પશુ માહિતી લોડ થઈ રહી છે..." />
      ) : filteredAnimals.length === 0 ? (
        <StateView state="empty" title="કોઈ પશુ મળ્યા નથી" message="આ વિસ્તારમાં કોઈ નોંધાયેલા પશુ મળ્યા નથી." />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
          <DataTable data={filteredAnimals} columns={columns} keyExtractor={(a) => a.id} />
        </div>
      )}
    </div>
  );
};

