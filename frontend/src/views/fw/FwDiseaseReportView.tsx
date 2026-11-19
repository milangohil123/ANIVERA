import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DiseaseReportForm } from '../../components/DiseaseReportForm';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { STRINGS_GU } from '../../constants/stringsGu';

export const FwDiseaseReportView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editingEvent = (location.state as any)?.editingEvent || null;
  const { deviceInfo, apiBaseUrl, session } = useAuth();
  const [successEventId, setSuccessEventId] = useState<string | null>(null);

  const handleSubmitted = (eventId: string) => {
    setSuccessEventId(eventId);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 font-body text-[#172033]">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/fw/home')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          {STRINGS_GU.actions.back}
        </Button>
      </div>

      {successEventId && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm">અહેવાલ સફળતાપૂર્વક સાચવવામાં આવ્યો છે!</p>
            <p className="mt-0.5 text-[11px] text-emerald-700">
              ઇવેન્ટ આઈડી: <span className="font-mono font-semibold">{successEventId}</span>. ઑફલાઇન કતારમાં ઉમેરાયેલ છે અને નેટવર્ક મળતા આપમેળે સિંક થશે.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => setSuccessEventId(null)}
                className="px-3 py-1 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 transition-colors"
              >
                બીજો અહેવાલ નોંધો
              </button>
              <button
                onClick={() => navigate('/fw/home')}
                className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
              >
                હોમ પર જાઓ
              </button>
            </div>
          </div>
        </div>
      )}

      <DiseaseReportForm
        deviceInfo={deviceInfo}
        apiBaseUrl={apiBaseUrl}
        authToken={session?.accessToken || ''}
        editingEvent={editingEvent}
        onSubmitted={handleSubmitted}
        onCancelEdit={() => navigate('/fw/home')}
      />
    </div>
  );
};

