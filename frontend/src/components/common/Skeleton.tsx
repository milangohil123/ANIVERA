import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded ${className}`}
      aria-hidden="true"
    />
  );
};

export const KpiCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E2E8F0] p-3 sm:p-3.5 flex flex-col justify-between min-h-[112px] min-w-0 flex-1 shadow-2xs animate-pulse ${className}`}
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="h-3.5 bg-slate-200 rounded w-24" />
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-200 shrink-0" />
      </div>

      {/* Metric Value */}
      <div className="my-1.5 flex items-baseline justify-between gap-2 min-w-0">
        <div className="h-7 w-28 bg-slate-200 rounded-md" />
      </div>

      {/* Footer */}
      <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1.5">
        <div className="h-3 bg-slate-200 rounded w-32" />
        <div className="h-4 bg-slate-200 rounded-full w-12" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-pulse">
      {/* Table Header */}
      <div className="flex gap-4 pb-3 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
        ))}
      </div>
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2 border-b border-slate-50 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3.5 bg-slate-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-48' }) => {
  return (
    <div className={`w-full bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between animate-pulse ${height}`}>
      <div className="flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-36" />
        <div className="h-4 bg-slate-200 rounded w-20" />
      </div>
      <div className="flex items-end gap-3 h-28 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-200 rounded-t flex-1"
            style={{ height: `${30 + (i % 4) * 20}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between pt-2 border-t border-slate-100">
        <div className="h-3 bg-slate-100 rounded w-16" />
        <div className="h-3 bg-slate-100 rounded w-16" />
        <div className="h-3 bg-slate-100 rounded w-16" />
      </div>
    </div>
  );
};
