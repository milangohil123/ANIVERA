import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { ArrowLeft, Building2, Info, LogOut, Shield, User } from 'lucide-react';

export const CoopProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-10 font-body">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/coop/overview')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          ડેશબોર્ડ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-[#135D43]" />
          મંડળી પ્રોફાઇલ (Cooperative Profile)
        </h2>
        <div className="w-12" />
      </div>

      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">સહકારી મંડળી ઓળખ</h3>
            <StatusChip status="SUCCESS" text="અધિકૃત સ્ટાફ (Authorized)" />
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-[#135D43] text-white flex items-center justify-center font-bold text-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#1E293B]">
                {session?.user?.organisation || 'બોટાદ જિલ્લા સહકારી દૂધ ઉત્પાદક સંઘ'}
              </h4>
              <span className="text-[#64748B] text-xs">ડેરી સહકારી મંડળી શાખા</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
              <span className="text-[11px] text-[#64748B] block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#135D43]" />
                પ્રતિનિધિ નામ
              </span>
              <span className="font-bold text-xs text-[#1E293B] mt-0.5 block">
                {session?.user?.fullName || 'દૂધ મંડળી પ્રતિનિધિ'}
              </span>
            </div>

            <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
              <span className="text-[11px] text-[#64748B] block flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#135D43]" />
                યૂઝરનેમ / હોદ્દો
              </span>
              <span className="font-mono text-xs text-[#1E293B] mt-0.5 block">
                {session?.user?.username || 'coop_botad'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl text-[11px] text-[#166534] flex items-start gap-2">
        <Info className="w-4 h-4 text-[#135D43] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#135D43] block">અધિકાર ક્ષેત્ર:</strong>
          સહકારી મંડળી સ્ટાફ ફક્ત માન્ય કાર્યક્ષેત્રના ગામોની રસીકરણ પ્રગતિ જોઈ શકે છે અને કેમ્પ આયોજનની દરખાસ્ત મોકલી શકે છે.
        </div>
      </div>

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
  );
};

