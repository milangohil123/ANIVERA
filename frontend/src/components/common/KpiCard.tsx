import React from 'react';
import { AnimatedCounter } from './AnimatedCounter';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  subtextIcon?: React.ReactNode;
  icon?: React.ReactNode;
  iconVariant?: 'primary' | 'secondary' | 'neutral' | 'danger' | 'warning' | string;
  valueColor?: string;
  trend?: {
    value: string;
    isUp?: boolean;
  };
  badgeText?: string;
  badgeVariant?: 'red' | 'emerald' | 'amber' | 'blue' | 'slate' | 'teal';
  onClick?: () => void;
  className?: string;
  isLoading?: boolean;
  disableAnimation?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtext,
  subtextIcon,
  icon,
  iconVariant = 'primary',
  valueColor,
  trend,
  badgeText,
  badgeVariant = 'slate',
  onClick,
  className = '',
  isLoading = false,
  disableAnimation = false,
}) => {
  const getIconContainerStyle = () => {
    switch (iconVariant) {
      case 'dark':
      case 'charcoal':
        return 'bg-[#262626] text-white border border-neutral-700';
      case 'secondary':
      case 'blue':
      case 'sky':
        return 'bg-sky-50 text-[#0284C7] border border-sky-100';
      case 'danger':
      case 'red':
        return 'bg-red-50 text-red-600 border border-red-100';
      case 'warning':
      case 'amber':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'neutral':
      case 'slate':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'primary':
      case 'emerald':
      case 'teal':
      default:
        return 'bg-[#E6F3EF] text-[#176B5B] border border-[#176B5B]/20';
    }
  };

  const getBadgeStyle = () => {
    switch (badgeVariant) {
      case 'emerald':
      case 'teal':
        return 'bg-[#E6F3EF] text-[#164E45] border-[#176B5B]/30';
      case 'blue':
        return 'bg-sky-50 text-[#0284C7] border-sky-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'red':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'slate':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const renderValue = () => {
    if (isLoading) {
      return <div className="h-7 w-24 bg-slate-200/80 animate-pulse rounded-md" />;
    }

    if (
      !disableAnimation &&
      (typeof value === 'number' ||
        (typeof value === 'string' &&
          /^([^\d.-]*)([-+]?[0-9,]*\.?[0-9]+)([^\d]*)$/.test(value.trim()) &&
          value.trim() !== '...'))
    ) {
      return <AnimatedCounter value={value as string | number} />;
    }

    return value;
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-[#E2E8F0] p-3 sm:p-3.5 transition-all duration-150 hover:border-slate-300 hover:shadow-xs flex flex-col justify-between min-h-[112px] min-w-0 flex-1 ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      } ${className}`}
    >
      {/* Top Header: Label + Icon Container */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <span
          title={typeof label === 'string' ? label : undefined}
          className="text-[11px] sm:text-xs font-semibold text-[#64748B] uppercase tracking-wider font-heading leading-tight line-clamp-2 break-words min-w-0 flex-1"
        >
          {label}
        </span>
        {icon && (
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${getIconContainerStyle()}`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-1.5 flex items-baseline justify-between gap-2 min-w-0">
        <div
          className={`text-2xl sm:text-[26px] font-bold tracking-tight font-heading tabular-nums leading-none truncate min-w-0 ${
            valueColor || 'text-[#172033]'
          }`}
        >
          {renderValue()}
        </div>

        {trend && !isLoading && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
              trend.isUp ? 'bg-[#E6F3EF] text-[#164E45]' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {/* Footer Subtext & Optional Badge */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 text-xs text-[#64748B] min-w-0">
        {isLoading ? (
          <div className="h-3 w-28 bg-slate-100 animate-pulse rounded" />
        ) : subtext ? (
          <div
            title={typeof subtext === 'string' ? subtext : undefined}
            className="flex items-center gap-1 truncate text-[11px] font-medium text-[#64748B] min-w-0 flex-1"
          >
            {subtextIcon}
            <span className="truncate">{subtext}</span>
          </div>
        ) : (
          <span />
        )}

        {!isLoading && badgeText && (
          <span
            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeStyle()}`}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
