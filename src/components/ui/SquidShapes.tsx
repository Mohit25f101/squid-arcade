import React from 'react';

interface ShapeProps {
  size?: number;
  color?: string;
  glow?: boolean;
  className?: string;
  animate?: boolean;
}

export const CircleShape: React.FC<ShapeProps> = ({ size = 40, color = '#FF0066', glow = false, className = '', animate = false }) => (
  <div
    className={`rounded-full border-2 flex items-center justify-center ${animate ? 'anim-float' : ''} ${className}`}
    style={{
      width: size,
      height: size,
      borderColor: color,
      boxShadow: glow ? `0 0 15px ${color}80, 0 0 30px ${color}30` : 'none',
    }}
  />
);

export const TriangleShape: React.FC<ShapeProps> = ({ size = 40, color = '#00FFB2', glow = false, className = '', animate = false }) => (
  <div
    className={`relative ${animate ? 'anim-float delay-200' : ''} ${className}`}
    style={{ width: size, height: size }}
  >
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <polygon
        points="50,5 95,95 5,95"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinejoin="round"
        filter={glow ? `drop-shadow(0 0 8px ${color})` : 'none'}
      />
    </svg>
  </div>
);

export const SquareShape: React.FC<ShapeProps> = ({ size = 40, color = '#FF0066', glow = false, className = '', animate = false }) => (
  <div
    className={`border-2 ${animate ? 'anim-float delay-400' : ''} ${className}`}
    style={{
      width: size,
      height: size,
      borderColor: color,
      boxShadow: glow ? `0 0 15px ${color}80, 0 0 30px ${color}30` : 'none',
    }}
  />
);

export const UmbrellaShape: React.FC<ShapeProps> = ({ size = 40, color = '#FF0066', glow = false, className = '' }) => (
  <div className={className} style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path
        d="M50 10 C20 10 10 35 10 50 L50 50 L90 50 C90 35 80 10 50 10Z"
        fill="none"
        stroke={color}
        strokeWidth="5"
        filter={glow ? `drop-shadow(0 0 8px ${color})` : 'none'}
      />
      <line x1="50" y1="50" x2="50" y2="80" stroke={color} strokeWidth="5" />
      <path d="M50 80 Q60 90 55 95" fill="none" stroke={color} strokeWidth="5" />
    </svg>
  </div>
);

// Symbol trio used throughout the UI
export const SymbolTrio: React.FC<{ size?: number; gap?: string; className?: string }> = ({
  size = 24,
  gap = 'gap-4',
  className = ''
}) => (
  <div className={`flex items-center ${gap} ${className}`}>
    <CircleShape size={size} color="#FF0066" glow />
    <TriangleShape size={size} color="#00FFB2" glow />
    <SquareShape size={size} color="#FF0066" glow />
  </div>
);

// Player number badge
export const PlayerBadge: React.FC<{ number: string | number; size?: 'sm' | 'md' | 'lg'; color?: string }> = ({
  number,
  size = 'md',
  color = '#00FFB2'
}) => {
  const sizes = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-2xl px-5 py-2',
  };
  return (
    <span
      className={`font-mono-sq font-bold rounded ${sizes[size]} border`}
      style={{
        color,
        borderColor: `${color}60`,
        background: `${color}10`,
        boxShadow: `0 0 10px ${color}30`,
        letterSpacing: '0.1em',
      }}
    >
      #{number}
    </span>
  );
};

// Status dot
export const StatusDot: React.FC<{ alive?: boolean; size?: number }> = ({ alive = true, size = 8 }) => (
  <div
    className={`rounded-full ${alive ? 'anim-pulse-teal' : ''}`}
    style={{
      width: size,
      height: size,
      backgroundColor: alive ? '#00FFB2' : '#FF3333',
      boxShadow: alive ? '0 0 8px #00FFB2' : '0 0 8px #FF3333',
    }}
  />
);
