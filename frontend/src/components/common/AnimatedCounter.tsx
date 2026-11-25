import React, { useEffect, useState, useRef } from 'react';

export interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  className?: string;
  decimals?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 750,
  className = '',
  decimals: propDecimals,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => String(value ?? 0));
  const prevValueRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // If value is null, undefined, or empty
    if (value === null || value === undefined || value === '') {
      setDisplayValue('0');
      return;
    }

    const strVal = String(value).trim();
    // Check if value has digits
    const match = strVal.match(/^([^\d.-]*)([-+]?[0-9,]*\.?[0-9]+)([^\d]*)$/);

    if (!match) {
      // Non-numeric string (e.g. "N/A" or text)
      setDisplayValue(strVal);
      return;
    }

    const prefix = match[1] || '';
    const rawNumberStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const targetNum = parseFloat(rawNumberStr);

    if (isNaN(targetNum)) {
      setDisplayValue(strVal);
      return;
    }

    // Determine decimal places
    let decimals = propDecimals;
    if (decimals === undefined) {
      const parts = rawNumberStr.split('.');
      decimals = parts.length > 1 ? parts[1].length : 0;
    }

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const formatted = targetNum.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      setDisplayValue(`${prefix}${formatted}${suffix}`);
      prevValueRef.current = targetNum;
      return;
    }

    const startNum = prevValueRef.current;
    const diff = targetNum - startNum;

    if (diff === 0) {
      const formatted = targetNum.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      setDisplayValue(`${prefix}${formatted}${suffix}`);
      return;
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentVal = startNum + diff * ease;

      const formatted = currentVal.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

      setDisplayValue(`${prefix}${formatted}${suffix}`);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = targetNum;
        const finalFormatted = targetNum.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        setDisplayValue(`${prefix}${finalFormatted}${suffix}`);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration, propDecimals]);

  return <span className={className}>{displayValue}</span>;
};
