import React from 'react';

export interface ToothData {
  toothNumber: number;
  surfaces: {
    OCLUSAL?: { condition: string; colorCode?: string; material?: string; notes?: string };
    MESIAL?: { condition: string; colorCode?: string; material?: string; notes?: string };
    DISTAL?: { condition: string; colorCode?: string; material?: string; notes?: string };
    VESTIBULAR?: { condition: string; colorCode?: string; material?: string; notes?: string };
    LINGUAL?: { condition: string; colorCode?: string; material?: string; notes?: string };
    PALATINA?: { condition: string; colorCode?: string; material?: string; notes?: string };
    GENERAL?: { condition: string; colorCode?: string; material?: string; notes?: string };
  };
}

interface ToothSVGProps {
  toothNumber: number;
  data?: ToothData;
  isUpper: boolean;
  isRight: boolean; // Patient's right side (quadrants 1, 4, 5, 8)
  isSelected?: boolean;
  activeCondition?: { condition: string; colorCode: string; label: string } | null;
  onSelectTooth: (toothNumber: number) => void;
  onSurfaceClick?: (toothNumber: number, surface: string) => void;
}

export const ToothSVG: React.FC<ToothSVGProps> = ({
  toothNumber,
  data,
  isUpper,
  isRight,
  isSelected = false,
  activeCondition,
  onSelectTooth,
  onSurfaceClick,
}) => {
  const surfaces = data?.surfaces || {};
  const generalCondition = surfaces.GENERAL?.condition;

  // Surface orientation:
  // In upper teeth, top trapezoid is VESTIBULAR, bottom is PALATINA.
  // In lower teeth, top trapezoid is LINGUAL, bottom is VESTIBULAR.
  const topSurfaceName = isUpper ? 'VESTIBULAR' : 'LINGUAL';
  const bottomSurfaceName = isUpper ? 'PALATINA' : 'VESTIBULAR';

  // Left vs Right surface (Mesial vs Distal):
  // Mesial is toward the midline (between 11-21, 31-41).
  // For patient's right (quadrant 1 & 4), midline is on the right of the tooth on screen!
  // So for patient's right: right polygon is MESIAL, left polygon is DISTAL.
  // For patient's left (quadrant 2 & 3): left polygon is MESIAL, right polygon is DISTAL.
  const leftSurfaceName = isRight ? 'DISTAL' : 'MESIAL';
  const rightSurfaceName = isRight ? 'MESIAL' : 'DISTAL';

  const getColor = (surfaceName: string) => {
    const item = surfaces[surfaceName as keyof typeof surfaces];
    if (item && item.colorCode) {
      return item.colorCode;
    }
    return `url(#enamel-${toothNumber}-${surfaceName})`; // Enamel shine gradient
  };

  const handlePolygonClick = (e: React.MouseEvent, surfaceName: string) => {
    e.stopPropagation();
    if (onSurfaceClick) {
      onSurfaceClick(toothNumber, surfaceName);
    } else {
      onSelectTooth(toothNumber);
    }
  };

  const isAbsent = generalCondition === 'AUSENTE';
  const isCrown = generalCondition === 'CORONA';
  const isImplant = generalCondition === 'IMPLANTE';
  const isEndo = generalCondition === 'ENDODONCIA';
  const isExtr = generalCondition === 'EXTRACCION';

  return (
    <div
      onClick={() => onSelectTooth(toothNumber)}
      className={`relative flex flex-col items-center p-1.5 rounded-lg transition-colors cursor-pointer group ${
        isSelected
          ? 'bg-[#ECF5F5] ring-2 ring-[#0F5C63]'
          : 'hover:bg-[#F2F0EB]'
      }`}
      title={`Pieza FDI ${toothNumber} - Click para ver o editar`}
    >
      {/* Number Badge */}
      <span
        className={`text-[11px] font-semibold tabular-nums mb-1 transition-colors ${
          isSelected
            ? 'text-[#0F5C63]'
            : isAbsent
            ? 'text-[#A0A4A1] line-through'
            : 'text-[#525755] group-hover:text-[#0F5C63]'
        }`}
      >
        {toothNumber}
      </span>

      {/* SVG Canvas for single tooth with crisp uniform stroke */}
      <div className="relative w-11 h-11">
        <svg
          viewBox="0 0 100 100"
          className={`w-full h-full transition-opacity ${
            isAbsent ? 'opacity-35' : 'opacity-100'
          } ${isCrown ? 'ring-2 ring-[#C6B08E] rounded-md' : ''}`}
        >
          {/* Subtle Warm Enamel Gradients */}
          <defs>
            <linearGradient id={`enamel-${toothNumber}-${topSurfaceName}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F8F7F4" />
            </linearGradient>
            <linearGradient id={`enamel-${toothNumber}-${bottomSurfaceName}`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F8F7F4" />
            </linearGradient>
            <linearGradient id={`enamel-${toothNumber}-${leftSurfaceName}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F8F7F4" />
            </linearGradient>
            <linearGradient id={`enamel-${toothNumber}-${rightSurfaceName}`} x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F8F7F4" />
            </linearGradient>
            <radialGradient id={`enamel-${toothNumber}-OCLUSAL`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="85%" stopColor="#FAF9F7" />
              <stop offset="100%" stopColor="#EFECE5" />
            </radialGradient>
          </defs>

          {/* Top Surface */}
          <polygon
            points="2,2 98,2 75,25 25,25"
            fill={getColor(topSurfaceName)}
            stroke="#8B918E"
            strokeWidth="1.75"
            strokeLinejoin="round"
            className="transition-colors hover:brightness-95"
            onClick={(e) => handlePolygonClick(e, topSurfaceName)}
          />

          {/* Bottom Surface */}
          <polygon
            points="25,75 75,75 98,98 2,98"
            fill={getColor(bottomSurfaceName)}
            stroke="#8B918E"
            strokeWidth="1.75"
            strokeLinejoin="round"
            className="transition-colors hover:brightness-95"
            onClick={(e) => handlePolygonClick(e, bottomSurfaceName)}
          />

          {/* Left Surface */}
          <polygon
            points="2,2 25,25 25,75 2,98"
            fill={getColor(leftSurfaceName)}
            stroke="#8B918E"
            strokeWidth="1.75"
            strokeLinejoin="round"
            className="transition-colors hover:brightness-95"
            onClick={(e) => handlePolygonClick(e, leftSurfaceName)}
          />

          {/* Right Surface */}
          <polygon
            points="98,2 98,98 75,75 75,25"
            fill={getColor(rightSurfaceName)}
            stroke="#8B918E"
            strokeWidth="1.75"
            strokeLinejoin="round"
            className="transition-colors hover:brightness-95"
            onClick={(e) => handlePolygonClick(e, rightSurfaceName)}
          />

          {/* Center (Oclusal / Incisal) */}
          <polygon
            points="25,25 75,25 75,75 25,75"
            fill={getColor('OCLUSAL')}
            stroke="#8B918E"
            strokeWidth="1.75"
            strokeLinejoin="round"
            className="transition-colors hover:brightness-95"
            onClick={(e) => handlePolygonClick(e, 'OCLUSAL')}
          />

          {/* OVERLAYS */}
          {isAbsent && (
            <g stroke="#B91C1C" strokeWidth="5" strokeLinecap="round">
              <line x1="12" y1="12" x2="88" y2="88" />
              <line x1="88" y1="12" x2="12" y2="88" />
            </g>
          )}

          {isExtr && (
            <g stroke="#B91C1C" strokeWidth="4.5" strokeDasharray="6,4" strokeLinecap="round">
              <line x1="12" y1="12" x2="88" y2="88" />
              <line x1="88" y1="12" x2="12" y2="88" />
            </g>
          )}

          {isEndo && (
            <g stroke="#0F5C63" strokeWidth="5.5" strokeLinecap="round">
              <line x1="50" y1="12" x2="50" y2="88" />
              <circle cx="50" cy="50" r="8" fill="#0F5C63" />
            </g>
          )}

          {isImplant && (
            <g stroke="#4F5D95" strokeWidth="4" strokeLinecap="round">
              <line x1="50" y1="15" x2="50" y2="85" />
              <line x1="32" y1="30" x2="68" y2="30" />
              <line x1="35" y1="50" x2="65" y2="50" />
              <line x1="38" y1="70" x2="62" y2="70" />
            </g>
          )}

          {isCrown && (
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#B45309"
              strokeWidth="4.5"
            />
          )}
        </svg>

        {/* Status indicator pip at top-right */}
        {generalCondition && (
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-1 ring-white"
            style={{ backgroundColor: surfaces.GENERAL?.colorCode || '#0F5C63' }}
            title={`Condición General: ${generalCondition}`}
          />
        )}
      </div>

      {/* Surface acronym indicator labels */}
      <span className="text-[9px] text-[#6B706D] font-medium mt-0.5 uppercase">
        {generalCondition ? generalCondition.slice(0, 3) : ''}
      </span>
    </div>
  );
};
