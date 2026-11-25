import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { farmerService, type FarmerAnimalItem } from '../../services/farmerService';
import { healthWorkflowService, type FarmerReportItem } from '../../services/healthWorkflowService';
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
  CheckCircle2,
  UserCheck,
  Stethoscope,
  Calendar,
} from 'lucide-react';

export const FarmerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session, hasPermission } = useAuth();
  const { t } = useTranslation();

  const [animals, setAnimals] = useState<FarmerAnimalItem[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthReports, setHealthReports] = useState<FarmerReportItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [selectedAnimal, setSelectedAnimal] = useState<FarmerAnimalItem | null>(null);
  const [isDiseaseModalOpen, setIsDiseaseModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ANIMALS' | 'REPORTS'>('ANIMALS');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [anms, prof, reports] = await Promise.all([
        farmerService.getOwnAnimals(apiBaseUrl).catch(() => []),
        farmerService.getOwnProfile(apiBaseUrl).catch(() => null),
        healthWorkflowService.listFarmerReports(apiBaseUrl).catch(() => []),
      ]);
      setAnimals(anms || []);
      setProfileData(prof);
      setHealthReports(reports || []);
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

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'EMERGENCY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">ઇમરજન્સી</span>;
      case 'URGENT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">જરૂરી</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">સામાન્ય</span>;
    }
  };

  const getStatusPipeline = (status: string, voName?: string, fwName?: string) => {
    const isSubmitted = true;
    const isAssigned = ['ASSIGNED', 'UNDER_TREATMENT', 'TREATED_PENDING_VERIFICATION', 'VERIFIED_CLOSED'].includes(status);
    const isTreated = ['TREATED_PENDING_VERIFICATION', 'VERIFIED_CLOSED'].includes(status);
    const isVerified = status === 'VERIFIED_CLOSED';

    return (
      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
        <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${isSubmitted ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'}`}>
          <CheckCircle2 className="w-3 h-3" /> સબમિટ
        </span>
        <span className="text-slate-300">→</span>
        <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${isAssigned ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}>
          <UserCheck className="w-3 h-3" /> સોંપાયેલ {voName || fwName ? `(${voName || fwName})` : ''}
        </span>
        <span className="text-slate-300">→</span>
        <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${isTreated ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-400'}`}>
          <Stethoscope className="w-3 h-3" /> સારવાર થયેલ
        </span>
        <span className="text-slate-300">→</span>
        <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
          <ShieldCheck className="w-3 h-3" /> ચકાસાયેલ
        </span>
      </div>
    );
  };

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
      {hasPermission('disease.report') && (
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
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div
          onClick={() => { setActiveTab('ANIMALS'); }}
          className={`bg-white p-4 rounded-xl border shadow-xs cursor-pointer transition-colors ${
            activeTab === 'ANIMALS' ? 'border-[#135D43] ring-1 ring-[#135D43]' : 'border-[#E2E8F0] hover:border-slate-300'
          }`}
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

        <div
          onClick={() => { setActiveTab('REPORTS'); }}
          className={`bg-white p-4 rounded-xl border shadow-xs cursor-pointer transition-colors ${
            activeTab === 'REPORTS' ? 'border-[#135D43] ring-1 ring-[#135D43]' : 'border-[#E2E8F0] hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-[#64748B] block uppercase tracking-wider">
            રોગ અહેવાલો / કેસ
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-700 font-heading">{healthReports.length}</span>
            <span className="text-[10px] text-amber-700 font-bold flex items-center">
              સ્થિતિ જુઓ <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ANIMALS')}
          className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'ANIMALS'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>મારા પશુધન ({animals.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'REPORTS'
              ? 'border-[#135D43] text-[#135D43]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>મારા રોગ અહેવાલો અને સારવાર પ્રગતિ ({healthReports.length})</span>
        </button>
      </div>

      {/* Tab 1: Animals List */}
      {activeTab === 'ANIMALS' && (
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
              {animals.map((anm) => (
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
                      {anm.species_code} • {anm.sex === 'F' ? 'માદા' : 'નર'} {anm.active_tag ? `• ટેગ: ${anm.active_tag}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#135D43] font-bold">
                    <span>ઇતિહાસ અને સમયરેખા</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Health Reports & Treatment Progress */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-800">નોંધાયેલ રોગ / સ્વાસ્થ્ય સમસ્યાઓ</h4>
              <p className="text-[11px] text-slate-500">અહેવાલ સબમિશનથી લઈને વેટરનરી તપાસ, સારવાર અને TAHO ચકાસણીની લાઈવ સ્થિતિ</p>
            </div>
            <button
              onClick={() => setIsDiseaseModalOpen(true)}
              className="px-3 py-1.5 bg-[#135D43] hover:bg-[#0E4B35] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>નવો અહેવાલ</span>
            </button>
          </div>

          {isLoading ? (
            <StateView state="loading" title={t('common.loading')} />
          ) : healthReports.length === 0 ? (
            <Card>
              <StateView
                state="empty"
                title="કોઈ રોગ અહેવાલ નથી"
                message="તમારા દ્વારા હજુ સુધી કોઈ પશુ રોગ કે સમસ્યા નોંધાયેલ નથી."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {healthReports.map((report) => (
                <div
                  key={report.report_id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {report.report_no || report.report_id.slice(0, 8)}
                      </span>
                      <span className="font-bold text-xs text-slate-800">
                        {report.is_unknown_disease
                          ? `અજ્ઞાત સ્વાસ્થ્ય સમસ્યા ${report.custom_disease_name ? `(${report.custom_disease_name})` : ''}`
                          : report.custom_disease_name || report.disease_code}
                      </span>
                      {getUrgencyBadge(report.urgency)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(report.report_date).toLocaleDateString('gu-IN')}</span>
                    </div>
                  </div>

                  {/* Progress Pipeline */}
                  <div className="p-2.5 bg-slate-50 rounded-lg overflow-x-auto">
                    {getStatusPipeline(report.treatment_status, report.assigned_vo_name, report.assigned_fw_name)}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">પશુ વિગત</span>
                      <span className="font-semibold text-slate-800">
                        {report.animal_name || report.animal_code || 'ટોળું / સામાન્ય'}
                        {report.animal_tag_id ? ` (ટેગ: ${report.animal_tag_id})` : ''}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">સોંપાયેલ વેટરનરી સ્ટાફ</span>
                      <span className="font-semibold text-slate-800">
                        {report.assigned_vo_name || report.assigned_fw_name
                          ? `${report.assigned_vo_name || ''} ${report.assigned_fw_name ? `& ${report.assigned_fw_name}` : ''}`
                          : 'હજુ સોંપણી બાકી છે'}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">લક્ષણો / ફોટા</span>
                      <span className="font-medium text-slate-700">
                        {report.symptoms && report.symptoms.length > 0 ? report.symptoms.join(', ') : 'કોઈ લક્ષણ નોંધાયેલ નથી'}
                        {report.photo_urls && report.photo_urls.length > 0 && ` • 📷 ${report.photo_urls.length} ફોટા`}
                      </span>
                    </div>
                  </div>

                  {report.observation_text && (
                    <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-xs text-blue-900">
                      <strong>વેટરનરી સારવાર નોંધ:</strong> {report.observation_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
