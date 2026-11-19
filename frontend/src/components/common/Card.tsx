import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  noPadding = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-xs ${className}`}
      {...props}
    >
      {header && (
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B]">
          {footer}
        </div>
      )}
    </div>
  );
};
