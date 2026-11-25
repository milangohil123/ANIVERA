import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full' | string;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  size,
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const widthClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-5xl',
  };

  const chosenSize = (maxWidth || size || 'md') as string;
  const widthClass = widthClasses[chosenSize] || widthClasses.md;

  const modalElement = (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden flex items-center justify-center p-3 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Semi-transparent Backdrop with smooth blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card: Centered, viewport-bounded, internal vertical flex */}
      <div
        className={`relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full ${widthClass} max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col z-10 my-auto animate-fade-in ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky/Pinned Modal Header */}
        {title && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-white rounded-t-2xl shrink-0">
            <h3 className="text-base font-bold font-heading text-slate-900 leading-tight">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Modal Content: min-h-0 allows internal flex scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 text-sm text-slate-800">
          {children}
        </div>

        {/* Optional Modal Footer */}
        {footer && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
