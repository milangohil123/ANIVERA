import React from 'react';
import { StateView } from '../components/common/StateView';

export interface CommonNotAvailableViewProps {
  title: string;
  subtitle?: string;
}

export const CommonNotAvailableView: React.FC<CommonNotAvailableViewProps> = ({
  title,
  subtitle,
}) => {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E2E8F0]">
        <h2 className="text-xl font-bold text-[#1E293B] font-heading">{title}</h2>
        {subtitle && <p className="text-xs text-[#64748B] mt-1">{subtitle}</p>}
      </div>
      <StateView state="not-yet-available" />
    </div>
  );
};

