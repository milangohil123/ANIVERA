import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { farmerService, type FarmerAnimalItem } from '../../services/farmerService';
import { FarmerAnimalDetailModal } from './FarmerAnimalDetailModal';
import { FarmerDiseaseReportModal } from './FarmerDiseaseReportModal';
import { Card } from '../../components/common/Card';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  ChevronRight,
  HeartPulse,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

export const FarmerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();
  const { t } = useTranslation();

  const [animals, setAnimals] = useState<FarmerAnimalItem[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [selectedAnimal, setSelectedAnimal] = useState<FarmerAnimalItem | null>(null);
  const [isDiseaseModalOpen, setIsDiseaseModalOpen] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [anms, prof] = await Promise.all([
        farmerService.getOwnAnimals(apiBaseUrl),
        farmerService.getOwnProfile(apiBaseUrl),
      ]);
      setAnimals(anms);
      setProfileData(prof);
    } catch (err: any) {
      setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const verifiedCount = animals.filter((a) => a.registration_status === 'VERIFIED').length;
  const farmerName = profileData?.farmer?.full_name || profileData?.user?.full_name || session?.user?.fullName || t('dashboards.farmer.farmerRole');
  const farmerCode = profileData?.farmer?.farmer_code || 'FRM-BOT';
  const mobile = profileData?.farmer?.mobile_e164 || profileData?.user?.mobile_e164 || session?.user?.mobileE164 || '';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 pb-12 font-body text-[#172033] animate-fade-in">
      {/* Farmer Greeting Banner - Solid Brand #135D43, No Gradient */}
      <div className="bg-[#135D43] text-white p-4.5 rounded-xl shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-lg text-white">
              {farmerName.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold font-heading">{t('dashboards.farmer.welcome', { name: farmerName })}</h2>
              <div className="flex items-center gap-2 text-xs text-white/80 mt-0.5">
                <span className="font-mono bg-white/15 px-1.5 py-0.2 rounded">{farmerCode}</span>
                {mobile && <span>• {mobile}</span>}
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-white/20 text-white rounded-lg text-[11px] font-bold">
            {t('dashboards.farmer.farmerRole')}
          </span>
        </div>
      </div>

      {/* Primary Action Button: Disease Report / Emergency Request */}
      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5 text-amber-800" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-900">
              {t('dashboards.farmer.sickAnimalPrompt')}
            </h3>
            <p className="text-[11px] text-amber-700">
              {t('dashboards.farmer.sickAnimalDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsDiseaseModalOpen(true)}
          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          {t('dashboards.farmer.reportBtn')}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => navigate('/farmer/animals')}
          className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs cursor-pointer hover:border-[#135D43] transition-colors"
        >
          <span className="text-[11px] font-semibold text-[#64748B] block uppercase tracking-wider">
            {t('dashboards.farmer.myTotalAnimals')}
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-[#0F172A] font-heading">{animals.length}</span>
            <span className="text-[10px] text-[#135D43] font-bold flex items-center">
              {t('common.viewAll')} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] block uppercase tracking-wider">
            {t('dashboards.farmer.verifiedAnimals')}
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-[#135D43] font-heading">{verifiedCount}</span>
            <ShieldCheck className="w-5 h-5 text-[#135D43]" />
          </div>
        </div>
      </div>

      {/* Recent Animals Preview */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 font-heading">
              <QrCode className="w-4 h-4 text-[#135D43]" />
              {t('dashboards.farmer.myAnimalsList', { count: animals.length })}
            </h3>
            {animals.length > 0 && (
              <button
                onClick={() => navigate('/farmer/animals')}
                className="text-xs text-[#135D43] font-bold hover:underline cursor-pointer"
              >
                {t('common.viewAll')} ({animals.length})
              </button>
            )}
          </div>
        }
      >
        {isLoading ? (
          <StateView state="loading" title={t('common.loading')} />
        ) : errorMsg ? (
          <StateView state="error" message={errorMsg} onRetry={loadData} />
        ) : animals.length === 0 ? (
          <StateView
            state="empty"
            title={t('common.noData')}
            message={t('common.empty')}
          />
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {animals.slice(0, 3).map((anm) => (
              <div
                key={anm.id}
                onClick={() => setSelectedAnimal(anm)}
                className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-lg px-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#0F172A]">
                      {anm.animal_code || anm.id.slice(0, 8)}
                    </span>
                    <StatusChip
                      status={anm.registration_status === 'VERIFIED' ? 'SUCCESS' : 'WARNING'}
                      text={anm.registration_status === 'VERIFIED' ? t('status.VERIFIED') : t('status.SUBMITTED')}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {anm.species_code} • {anm.sex === 'F' ? 'Female' : 'Male'} {anm.active_tag ? `• Tag: ${anm.active_tag}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#135D43] font-bold">
                  <span>{t('dashboards.farmer.history')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Animal Detail Modal */}
      {selectedAnimal && (
        <FarmerAnimalDetailModal
          animal={selectedAnimal}
          isOpen={!!selectedAnimal}
          onClose={() => setSelectedAnimal(null)}
        />
      )}

      {/* Disease Report Modal */}
      {isDiseaseModalOpen && (
        <FarmerDiseaseReportModal
          animals={animals}
          farmerProfile={profileData}
          isOpen={isDiseaseModalOpen}
          onClose={() => setIsDiseaseModalOpen(false)}
          onSuccess={() => {
            setIsDiseaseModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
