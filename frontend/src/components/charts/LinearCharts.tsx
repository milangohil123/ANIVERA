import React, { useState } from 'react';

// ============================================================================
// 1. Linear-Style Smooth Area Chart
// ============================================================================
export interface DataPoint {
  label: string; // e.g. "સોમ", "મંગળ", "બુધ"
  value: number; // e.g. 420
  secondaryValue?: number;
}

export interface LinearAreaChartProps {
  data: DataPoint[];
  height?: number;
  color?: string; // Hex e.g. "#10B981" or "#135D43"
  fillGradientId?: string;
  unit?: string;
  className?: string;
}

export const LinearAreaChart: React.FC<LinearAreaChartProps> = ({
  data,
  height = 160,
  color = '#135D43',
  fillGradientId = 'linearAreaGrad',
  unit = '',
  className = '',
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const width = 600;
  const paddingX = 30;
  const paddingY = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const maxValue = Math.max(...data.map((d) => d.value), 10);
  const minValue = 0;

  // Calculate coordinates
  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * chartWidth;
    const y = paddingY + chartHeight - ((d.value - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y, ...d };
  });

  // Construct SVG Bezier Smooth Path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  // Area path for gradient fill
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${
    height - paddingY
  } Z`;

  return (
    <div className={`relative w-full overflow-hidden select-none ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        style={{ maxHeight: height }}
      >
        <defs>
          <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="60%" stopColor={color} stopOpacity="0.06" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal guide lines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingY + chartHeight * (1 - ratio);
          const val = Math.round(minValue + (maxValue - minValue) * ratio);
          return (
            <g key={idx}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={paddingX - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-mono font-medium"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Gradient Area Fill */}
        <path d={areaD} fill={`url(#${fillGradientId})`} />

        {/* Main Line Stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Data Dots & Hover Crosshair */}
        {points.map((p, idx) => {
          const isHovered = hoverIndex === idx;
          return (
            <g
              key={idx}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              className="cursor-pointer"
            >
              {/* Invisible touch target */}
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

              {/* Crosshair line on hover */}
              {isHovered && (
                <line
                  x1={p.x}
                  y1={paddingY}
                  x2={p.x}
                  y2={height - paddingY}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              )}

              {/* Data Dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? '4.5' : '3'}
                fill="#FFFFFF"
                stroke={color}
                strokeWidth={isHovered ? '2.5' : '2'}
                className="transition-all duration-150"
              />

              {/* X-axis label */}
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                className={`text-[10px] font-medium transition-colors ${
                  isHovered ? 'fill-slate-900 font-bold' : 'fill-slate-400'
                }`}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div
          className="absolute z-20 pointer-events-none -translate-x-1/2 px-2.5 py-1 rounded-md bg-[#0F172A] text-white text-[11px] font-medium shadow-md transition-all duration-75 flex items-center gap-1.5"
          style={{
            left: `${(points[hoverIndex].x / width) * 100}%`,
            top: `${Math.max(2, (points[hoverIndex].y / height) * 100 - 32)}%`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>
            {points[hoverIndex].label}:{' '}
            <strong className="font-mono">{points[hoverIndex].value.toLocaleString()}</strong> {unit}
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. Linear-Style Bar Progress Breakdown
// ============================================================================
export interface LinearBarItem {
  label: string;
  sublabel?: string;
  value: number;
  target: number;
  color?: string;
}

export interface LinearBarChartProps {
  items: LinearBarItem[];
  className?: string;
}

export const LinearBarChart: React.FC<LinearBarChartProps> = ({ items, className = '' }) => {
  return (
    <div className={`space-y-3.5 ${className}`}>
      {items.map((item, idx) => {
        const pct = item.target > 0 ? Math.min(100, Math.round((item.value / item.target) * 100)) : 0;
        const barColor = item.color || '#135D43';

        return (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{item.label}</span>
                {item.sublabel && (
                  <span className="text-[11px] text-slate-400 font-normal">
                    {item.sublabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-slate-500 text-[11px]">
                  {item.value.toLocaleString()} / {item.target.toLocaleString()}
                </span>
                <span className="font-bold text-slate-900 text-xs w-9 text-right">{pct}%</span>
              </div>
            </div>

            {/* Track & Bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 3. Linear-Style Circular Gauge
// ============================================================================
export interface LinearRadialGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  className?: string;
}

export const LinearRadialGauge: React.FC<LinearRadialGaugeProps> = ({
  percentage,
  size = 110,
  strokeWidth = 9,
  color = '#135D43',
  label,
  sublabel,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-heading tabular-nums text-slate-900">
            {percentage}%
          </span>
          <span className="text-[10px] text-slate-400 font-medium">સિદ્ધિ</span>
        </div>
      </div>

      {label && <p className="text-xs font-bold text-slate-800 mt-2 text-center">{label}</p>}
      {sublabel && <p className="text-[11px] text-slate-400 text-center">{sublabel}</p>}
    </div>
  );
};

