import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StateView } from '../../components/common/StateView';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Home, LogOut } from 'lucide-react';
import { STRINGS_GU } from '../../constants/stringsGu';

export const AccessDeniedView: React.FC = () => {
  const navigate = useNavigate();
  const { rolePrefix, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-4">
      <StateView
        state="access-denied"
        title={STRINGS_GU.states.accessDenied}
        message="તમારા વર્તમાન હોદ્દા (Role) અથવા સ્કોપ મુજબ આ વિભાગમાં પ્રવેશવાની પરવાનગી નથી. જો તમને લાગે કે આ ભૂલ છે, તો કૃપા કરીને જિલ્લા વહીવટી સ્ટાફનો સંપર્ક કરો."
      />
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

