import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, type SupportedLanguage } from '../../i18n';
import { Languages, Check, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  compact?: boolean;
  variant?: 'light' | 'dark' | 'header';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  compact = false,
  variant = 'header',
  className = '',
}) => {
  const { language, setLanguage, supportedLanguages, currentLanguageMeta } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
  };

  // Variant styling
  const buttonStyles = {
    header:
      'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 focus:ring-2 focus:ring-[#176B5B]/20',
    light:
      'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs focus:ring-2 focus:ring-[#176B5B]/20',
    dark:
      'bg-[#1E1E1E] hover:bg-[#2A2A2A] text-neutral-200 border border-[#383838] focus:ring-2 focus:ring-[#176B5B]/30',
  }[variant];

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="ભાષા પસંદ કરો / Select Language"
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer select-none ${buttonStyles}`}
        title="ભાષા બદલો (Change Language)"
      >
        <Languages className="w-3.5 h-3.5 text-[#176B5B] shrink-0" />
        <span className="font-heading">
          {compact ? currentLanguageMeta.shortLabel : currentLanguageMeta.nativeName}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-slate-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-40 origin-top-right rounded-xl bg-white border border-slate-200 py-1.5 shadow-lg z-50 animate-fade-in focus:outline-none"
        >
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            ભાષા / Language
          </div>

          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#E6F3EF] text-[#135D43] font-bold'
                    : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="text-xs font-heading">{lang.nativeName}</span>
                  {lang.name !== lang.nativeName && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      {lang.name}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[#135D43] shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

