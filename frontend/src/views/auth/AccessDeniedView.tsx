import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Home, LogOut, ShieldAlert } from 'lucide-react';
import { STRINGS_GU } from '../../constants/stringsGu';

export const AccessDeniedView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { rolePrefix, logout } = useAuth();

  const state = location.state as { reason?: string; permission?: string; from?: string } | null;
  const missingPerm = state?.permission;

  const message = missingPerm
    ? `આ વિભાગ/પેજ માટે '${missingPerm}' પરવાનગી જરૂરી છે, જે તમારા રોલ માટે સિસ્ટમ એડમિન દ્વારા સક્ષમ કરેલ નથી. જો તમને આ સુવિધાની જરૂર હોય, તો કૃપા કરીને સિસ્ટમ એડમિનિસ્ટ્રેટરનો સંપર્ક કરો.`
    : "તમારા વર્તમાન હોદ્દા (Role) અથવા સ્કોપ મુજબ આ વિભાગમાં પ્રવેશવાની પરવાનગી નથી. જો તમને લાગે કે આ ભૂલ છે, તો કૃપા કરીને જિલ્લા વહીવટી સ્ટાફનો સંપર્ક કરો.";

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-4">
      <StateView
        state="access-denied"
        title={STRINGS_GU.states.accessDenied}
        message={message}
      />
      {missingPerm && (
        <div className="mt-2 text-xs font-mono bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>જરૂરી પરવાનગી (Missing Code): <strong>{missingPerm}</strong></span>
        </div>
      )}
      <div className="flex gap-3 mt-4">
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate(rolePrefix)}
          leftIcon={<Home className="w-4 h-4" />}
        >
          હોમ પેજ પર જાઓ
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={logout}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          {STRINGS_GU.actions.logout}
        </Button>
      </div>
    </div>
  );
};
