import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AttachmentViewer } from '../../components/AttachmentViewer';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { ArrowLeft } from 'lucide-react';
import { STRINGS_GU } from '../../constants/stringsGu';

export const FwAttachmentView: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, session } = useAuth();
  const [reportIdInput, setReportIdInput] = useState('');

  return (
    <div className="space-y-4 max-w-xl mx-auto">
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

      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
          રોગ અહેવાલ આઈડી (UUID) દાખલ કરો:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={reportIdInput}
            onChange={(e) => setReportIdInput(e.target.value.trim())}
            placeholder="દા.ત. 52fb05f7-2056-4003-bc62-53e27b02a101"
            className="flex-1 px-3 py-2 text-xs font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#135D43]"
          />
        </div>
      </div>

      <AttachmentViewer
        reportId={reportIdInput}
        apiBaseUrl={apiBaseUrl}
        authToken={session?.accessToken || ''}
      />
    </div>
  );
};

