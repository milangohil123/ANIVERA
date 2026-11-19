import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'inverted';
  size?: 'sm' | 'md' | 'lg' | 'touch';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-lg';

  const variantClasses = {
    primary: 'bg-[#176B5B] text-white hover:bg-[#164E45] focus:ring-[#176B5B] active:bg-[#164E45] shadow-xs',
    secondary: 'bg-[#E8EEFC] text-[#1E293B] hover:bg-[#D8E4FA] focus:ring-[#0284C7] shadow-xs',
    outline: 'border border-[#E2E8F0] bg-white text-[#1E293B] hover:bg-slate-50 focus:ring-[#176B5B] shadow-xs',
    inverted: 'bg-[#1E293B] text-white hover:bg-[#0F172A] focus:ring-[#1E293B] shadow-xs',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 shadow-xs',
    ghost: 'text-[#1E293B] hover:bg-slate-100 focus:ring-[#176B5B]',
  };

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2 gap-2 h-10', // 40px standard
    lg: 'text-base px-5 py-2.5 gap-2.5 h-12',
    touch: 'text-base px-6 py-3.5 gap-3 min-h-[52px] w-full', // Field Worker touch-friendly
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};
