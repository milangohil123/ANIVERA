import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { farmerService, type FarmerAnimalItem } from '../../services/farmerService';
import { FarmerAnimalDetailModal } from './FarmerAnimalDetailModal';
import { FarmerDiseaseReportModal } from './FarmerDiseaseReportModal';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  ArrowLeft,
  ChevronRight,
  HeartPulse,
  QrCode,
  Search,
  Tag,
} from 'lucide-react';

export const FarmerAnimalsView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useAuth();

  const [animals, setAnimals] = useState<FarmerAnimalItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [speciesFilter, setSpeciesFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [selectedAnimal, setSelectedAnimal] = useState<FarmerAnimalItem | null>(null);
  const [isDiseaseModalOpen, setIsDiseaseModalOpen] = useState<boolean>(false);
  const [profileData, setProfileData] = useState<any>(null);

  const fetchAnimals = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [data, prof] = await Promise.all([
        farmerService.getOwnAnimals(apiBaseUrl),
        farmerService.getOwnProfile(apiBaseUrl).catch(() => null),
      ]);
      setAnimals(data);
      if (prof) setProfileData(prof);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnimals();
  }, [apiBaseUrl]);

  const filteredAnimals = animals.filter((a) => {
    const matchesSpecies = speciesFilter === 'ALL' || a.species_code === speciesFilter;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return matchesSpecies;
    const matchesCode = (a.animal_code || '').toLowerCase().includes(term);
    const matchesTag = (a.active_tag || '').toLowerCase().includes(term);
    return matchesSpecies && (matchesCode || matchesTag);
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 pb-10 font-body text-[#172033]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/farmer/home')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          હોમ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-[#135D43]" />
          મારા પશુઓની યાદી
        </h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsDiseaseModalOpen(true)}
          leftIcon={<HeartPulse className="w-3.5 h-3.5" />}
        >
          સહાય
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="કોડ અથવા ૧૨-અંક ટેગ વડે શોધો..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:ring-2 focus:ring-[#135D43]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto text-[11px] pb-0.5">
          {['ALL', 'CATTLE', 'BUFFALO', 'GOAT', 'SHEEP'].map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeciesFilter(sp)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${speciesFilter === sp
                  ? 'bg-[#135D43] text-white shadow-xs'
                  : 'bg-gray-100 text-[#64748B] hover:bg-gray-200'
                }`}
            >
              {sp === 'ALL'
                ? 'બધાં પશુઓ'
                : sp === 'CATTLE'
                  ? 'ગાય (Cattle)'
                  : sp === 'BUFFALO'
                    ? 'ભેંસ (Buffalo)'
                    : sp === 'GOAT'
                      ? 'બકરી (Goat)'
                      : 'ઘેટાં (Sheep)'}
            </button>
          ))}
        </div>
      </div>

      {/* Animals Card */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">
              પરિણામો ({filteredAnimals.length})
            </h3>
            <span className="text-[11px] text-[#64748B]">કુલ: {animals.length}</span>
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={fetchAnimals} />
        ) : filteredAnimals.length === 0 ? (
          <StateView
            state="empty"
            title="કોઈ માહિતી નથી"
            message={
              searchTerm
                ? 'આ શોધ સાથે મેળ ખાતું કોઈ પશુ મળ્યું નથી.'
                : 'તમારા ખાતામાં કોઈ પશુ નોંધાયેલ નથી.'
            }
          />
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {filteredAnimals.map((animal) => (
              <div
                key={animal.id}
                onClick={() => setSelectedAnimal(animal)}
                className="py-3 px-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors rounded-xl"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#1E293B]">
                      {animal.animal_code || animal.id.slice(0, 8)}
                    </span>
                    <StatusChip
                      status={animal.registration_status === 'VERIFIED' ? 'SUCCESS' : 'WARNING'}
                      text={animal.registration_status === 'VERIFIED' ? 'ચકાસાયેલ' : 'નોંધાયેલ'}
                    />
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    {animal.species_code} • {animal.sex === 'F' ? 'માદા' : 'નર'} • {animal.age_months_estimate ? `${animal.age_months_estimate} માસ` : 'ઉંમર અંદાજિત'}
                  </p>
                  {animal.active_tag && (
                    <div className="flex items-center gap-1 text-[11px] text-[#1E293B] font-mono">
                      <Tag className="w-3 h-3 text-[#135D43]" />
                      <span>ટેગ: {animal.active_tag}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs text-[#135D43] font-semibold">
                  <span>ઇતિહાસ</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <FarmerAnimalDetailModal
        animal={selectedAnimal}
        onClose={() => setSelectedAnimal(null)}
      />

      <FarmerDiseaseReportModal
        isOpen={isDiseaseModalOpen}
        onClose={() => setIsDiseaseModalOpen(false)}
        animals={animals}
        farmerProfile={profileData}
        onReportSuccess={fetchAnimals}
      />
    </div>
  );
};

