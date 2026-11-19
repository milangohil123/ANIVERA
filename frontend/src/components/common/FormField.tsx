import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  helperText?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  helperText,
  id,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-xs font-semibold text-[#1E293B] leading-relaxed">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <p className="text-[11px] text-[#64748B] mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
};

