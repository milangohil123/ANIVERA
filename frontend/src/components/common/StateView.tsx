import React from 'react';
import { Loader2, Inbox, AlertCircle, ShieldAlert, Clock, RotateCcw } from 'lucide-react';
import { STRINGS_GU } from '../../constants/stringsGu';
import { Button } from './Button';

export type StateKind = 'loading' | 'empty' | 'error' | 'access-denied' | 'not-yet-available';

export interface StateViewProps {
  state?: StateKind;
  type?: StateKind;
  title?: string;
  message?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const StateView: React.FC<StateViewProps> = ({
  state,
  type,
  title,
  message,
  description,
  onRetry,
  className = '',
}) => {
  const configs: Record<
    StateKind,
    { icon: React.ReactNode; defaultTitle: string; defaultMessage: string; color: string }
  > = {
    loading: {
      icon: <Loader2 className="w-10 h-10 animate-spin text-[#135D43]" />,
      defaultTitle: STRINGS_GU.states.loading,
      defaultMessage: 'માહિતી લોડ થઈ રહી છે, કૃપા કરીને થોડી રાહ જુઓ...',
      color: 'text-[#135D43]',
    },
    empty: {
      icon: <Inbox className="w-10 h-10 text-gray-400" />,
      defaultTitle: STRINGS_GU.states.empty,
      defaultMessage: 'હાલમાં દર્શાવવા માટે કોઈ ડેટા ઉપલબ્ધ નથી.',
      color: 'text-gray-700',
    },
    error: {
      icon: <AlertCircle className="w-10 h-10 text-red-500" />,
      defaultTitle: STRINGS_GU.states.error,
      defaultMessage: 'વિનંતી પર પ્રક્રિયા કરતી વખતે સમસ્યા આવી. કૃપા કરીને પુનઃપ્રયાસ કરો.',
      color: 'text-red-700',
    },
    'access-denied': {
      icon: <ShieldAlert className="w-10 h-10 text-amber-600" />,
      defaultTitle: STRINGS_GU.states.accessDenied,
      defaultMessage: 'તમારા એકાઉન્ટને આ વિભાગ અથવા સુવિધા ઍક્સેસ કરવાની અધિકૃતતા નથી.',
      color: 'text-amber-800',
    },
    'not-yet-available': {
      icon: <Clock className="w-10 h-10 text-blue-500" />,
      defaultTitle: STRINGS_GU.states.notAvailable,
      defaultMessage: 'આ મોડ્યુલનું નિર્માણ આગામી તબક્કામાં પૂર્ણ થશે. (વિકાસ હેઠળ)',
      color: 'text-blue-800',
    },
  };

  const resolvedKind = (state || type || 'empty') as StateKind;
  const current = configs[resolvedKind] || configs.empty;

  return (
    <div
      className={`py-12 px-6 text-center bg-white rounded-2xl border border-[#E2E8F0] shadow-xs max-w-lg mx-auto my-6 ${className}`}
    >
      <div className="flex justify-center mb-4">{current.icon}</div>
      <h3 className={`text-base font-bold ${current.color} mb-1.5`}>
        {title || current.defaultTitle}
      </h3>
      <p className="text-xs text-[#64748B] mb-5 leading-relaxed max-w-sm mx-auto">
        {message || description || current.defaultMessage}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
          {STRINGS_GU.actions.retry}
        </Button>
      )}
    </div>
  );
};

