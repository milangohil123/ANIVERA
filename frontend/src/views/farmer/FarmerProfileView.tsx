import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { farmerService } from '../../services/farmerService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { StateView } from '../../components/common/StateView';
import {
  ArrowLeft,
  Info,
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';

export const FarmerProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session, logout } = useAuth();

  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const data = await farmerService.getOwnProfile(apiBaseUrl);
        setProfileData(data);
      } catch (err: any) {
        setErrorMsg(err?.message || 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [apiBaseUrl]);

  const handleLogout = async () => {
    await logout();
    navigate('/farmer/login', { replace: true });
  };

  const farmer = profileData?.farmer;

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-10 font-body">
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
          <User className="w-4 h-4 text-[#135D43]" />
          મારું પ્રોફાઇલ (My Profile)
        </h2>
        <div className="w-12" />
      </div>

      {isLoading ? (
        <StateView state="loading" title="લોડ થઈ રહ્યું છે…" />
      ) : errorMsg ? (
        <StateView state="error" message={errorMsg} />
      ) : (
        <div className="space-y-4">
          {/* Identity Card */}
          <Card
            header={
              <div className="flex items-center justify-between w-full">
                <h3 className="text-xs font-bold text-[#1E293B]">પશુપાલક ઓળખ માહિતી</h3>
                <StatusChip status="SUCCESS" text="સક્રિય ખાતું (Active)" />
              </div>
            }
          >
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-[#135D43] text-white flex items-center justify-center font-bold text-lg">
                  {(farmer?.full_name || session?.user?.fullName || 'F').charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1E293B]">
                    {farmer?.full_name || session?.user?.fullName || 'પશુપાલક'}
                  </h4>
                  <span className="font-mono text-xs text-[#135D43] font-semibold">
                    {farmer?.farmer_code || 'FRM-BOT-XXXXXX'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#135D43]" />
                    મોબાઇલ નંબર (E.164)
                  </span>
                  <span className="font-mono font-bold text-xs text-[#1E293B] mt-0.5 block">
                    {farmer?.mobile_e164 || session?.user?.mobileE164 || '—'}
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#065F46]" />
                    ચકાસણી સ્થિતિ
                  </span>
                  <span className="font-semibold text-xs text-[#065F46] mt-0.5 block">
                    {farmer?.registration_status === 'VERIFIED' ? 'રૂબરૂ ચકાસાયેલ' : 'નોંધાયેલ (Draft)'}
                  </span>
                </div>
              </div>

              {farmer?.address_text && (
                <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#135D43]" />
                    સરનામું
                  </span>
                  <span className="text-xs text-[#1E293B] font-medium mt-0.5 block">
                    {farmer.address_text}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Policy Information Box */}
          <div className="p-3 bg-[#F8FAFB] border border-[#E2E8F0] rounded-2xl text-[11px] text-[#64748B] flex items-start gap-2">
            <Info className="w-4 h-4 text-[#135D43] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#1E293B] block">પ્રોફાઇલ ફેરફાર નીતિ:</strong>
              પશુપાલક પ્રોફાઇલમાં સીધો સુધારો માન્ય નથી. સરનામું કે મોબાઇલ બદલવા માટે તમારા ગામના અધિકૃત ક્ષેત્રીય કાર્યકર (Field Worker) નો સંપર્ક કરવો.
            </div>
          </div>

          {/* Logout Button */}
          <Button
            variant="danger"
            size="md"
            className="w-full"
            onClick={handleLogout}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            લૉગઆઉટ કરો (Log Out)
          </Button>
        </div>
      )}
    </div>
  );
};

