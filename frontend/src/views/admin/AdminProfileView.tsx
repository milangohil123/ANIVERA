import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusChip } from '../../components/common/StatusChip';
import { ArrowLeft, LogOut, Server, Shield, ShieldAlert, User } from 'lucide-react';

export const AdminProfileView: React.FC = () => {
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
          onClick={() => navigate('/admin/overview')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          ડેશબોર્ડ
        </Button>
        <h2 className="text-sm font-bold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Server className="w-4 h-4 text-[#135D43]" />
          સિસ્ટમ એડમિન પ્રોફાઇલ (Admin Profile)
        </h2>
        <div className="w-12" />
      </div>

      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xs font-bold text-[#1E293B]">તકનીકી સંચાલક ઓળખ</h3>
            <StatusChip status="SUCCESS" text="SYS_ADMIN (Active)" />
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div className="flex items-center gap-3 p-3 bg-slate-900 text-white rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-lg border border-slate-700">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                {session?.user?.fullName || 'સિસ્ટમ એડમિનિસ્ટ્રેટર'}
              </h4>
              <span className="font-mono text-xs text-slate-300">
                {session?.user?.username || 'admin_state'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
              <span className="text-[11px] text-[#64748B] block flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#135D43]" />
                ભૂમિકા (Role)
              </span>
              <span className="font-bold text-xs text-[#1E293B] mt-0.5 block">
                SYS_ADMIN
              </span>
            </div>

            <div className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
              <span className="text-[11px] text-[#64748B] block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#135D43]" />
                સંસ્થા / સેલ
              </span>
              <span className="text-xs text-[#1E293B] mt-0.5 block">
                {session?.user?.organisation || 'સ્ટેટ એનિમલ હસબન્ડ્રી આઈટી સેલ'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Security Scope Guarantee Card */}
      <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl text-xs text-[#92400E] flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
        <div>
          <strong className="block text-[#92400E]">ડેટા એકાંતતા બાંહેધરી (Zero Operational Data):</strong>
          ટેકનિકલ એડમિનિસ્ટ્રેટર ખાતાને પશુપાલકોની અંગત માહિતી કે જિલ્લા/ગામના ક્લિનિકલ રેકોર્ડ્સ જોવાની કોઈ ભૌગોલિક પરવાનગી આપવામાં આવતી નથી.
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

