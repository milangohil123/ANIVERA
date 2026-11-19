import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, HelpCircle } from 'lucide-react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'danger' | 'neutral' | 'info' | string;

export interface StatusChipProps {
  label?: string;
  text?: string;
  variant?: StatusVariant;
  status?: StatusVariant;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  label,
  text,
  variant,
  status,
  icon,
  size = 'md',
  className = '',
}) => {
  const displayLabel = label || text || '';
  const rawVariant = (variant || status || 'neutral').toLowerCase();
  
  let normalizedVariant: 'success' | 'warning' | 'error' | 'neutral' | 'info' = 'neutral';
  if (rawVariant === 'success' || rawVariant === 'active' || rawVariant === 'verified' || rawVariant === 'completed') {
    normalizedVariant = 'success';
  } else if (rawVariant === 'warning' || rawVariant === 'pending' || rawVariant === 'draft') {
    normalizedVariant = 'warning';
  } else if (rawVariant === 'error' || rawVariant === 'danger' || rawVariant === 'rejected' || rawVariant === 'cancelled' || rawVariant === 'locked' || rawVariant === 'revoked') {
    normalizedVariant = 'error';
  } else if (rawVariant === 'info') {
    normalizedVariant = 'info';
  }

  const variantStyles = {
    success: {
      bg: 'bg-[#E6F3EF]',
      border: 'border-[#176B5B]/30',
      text: 'text-[#164E45]',
      defaultIcon: <CheckCircle2 className="w-3.5 h-3.5 text-[#176B5B]" />,
    },
    warning: {
      bg: 'bg-[#FFFBEB]',
      border: 'border-[#FDE68A]',
      text: 'text-[#92400E]',
      defaultIcon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    error: {
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      text: 'text-[#991B1B]',
      defaultIcon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    neutral: {
      bg: 'bg-[#F1F5F9]',
      border: 'border-[#CBD5E1]',
      text: 'text-[#334155]',
      defaultIcon: <HelpCircle className="w-3.5 h-3.5" />,
    },
    info: {
      bg: 'bg-[#EFF8FF]',
      border: 'border-[#BAE0FD]',
      text: 'text-[#075985]',
      defaultIcon: <Info className="w-3.5 h-3.5" />,
    },
  };

  const current = variantStyles[normalizedVariant];
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${current.bg} ${current.border} ${current.text} ${sizeClasses} ${className}`}
    >
      <span className="flex-shrink-0">{icon || current.defaultIcon}</span>
      <span>{displayLabel}</span>
    </span>
  );
};
