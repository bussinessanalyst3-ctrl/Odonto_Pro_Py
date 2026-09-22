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
    return '#F8FAFC'; // slate-50 default clean tooth surface
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
      className={`relative flex flex-col items-center p-1 rounded-xl transition-all cursor-pointer group ${
        isSelected
          ? 'bg-teal-50 ring-2 ring-teal-600 shadow-xs'
          : 'hover:bg-slate-100/80'
      }`}
      title={`Pieza FDI ${toothNumber} - Click para ver o editar`}
    >
      {/* Number Badge */}
      <span
        className={`text-[11px] font-bold tracking-tight mb-1 transition-colors ${
          isSelected
            ? 'text-teal-800 font-extrabold scale-110'
            : isAbsent
            ? 'text-slate-400 line-through'
            : 'text-slate-700 group-hover:text-teal-700'
        }`}
      >
        {toothNumber}
      </span>

      {/* SVG Canvas for single tooth */}
      <div className="relative w-11 h-11">
        <svg
          viewBox="0 0 100 100"
          className={`w-full h-full drop-shadow-xs transition-transform ${
            isAbsent ? 'opacity-40' : 'opacity-100'
          } ${isCrown ? 'ring-2 ring-amber-400 rounded-full' : ''}`}
        >
          {/* Top Surface */}
          <polygon
            points="0,0 100,0 75,25 25,25"
            fill={getColor(topSurfaceName)}
            stroke="#94A3B8"
            strokeWidth="2.5"
            className="transition-colors hover:brightness-90"
            onClick={(e) => handlePolygonClick(e, topSurfaceName)}
          />

          {/* Bottom Surface */}
          <polygon
            points="25,75 75,75 100,100 0,100"
            fill={getColor(bottomSurfaceName)}
            stroke="#94A3B8"
            strokeWidth="2.5"
            className="transition-colors hover:brightness-90"
            onClick={(e) => handlePolygonClick(e, bottomSurfaceName)}
          />

          {/* Left Surface */}
          <polygon
            points="0,0 25,25 25,75 0,100"
            fill={getColor(leftSurfaceName)}
            stroke="#94A3B8"
            strokeWidth="2.5"
            className="transition-colors hover:brightness-90"
            onClick={(e) => handlePolygonClick(e, leftSurfaceName)}
          />

          {/* Right Surface */}
          <polygon
            points="100,0 100,100 75,75 75,25"
            fill={getColor(rightSurfaceName)}
            stroke="#94A3B8"
            strokeWidth="2.5"
            className="transition-colors hover:brightness-90"
            onClick={(e) => handlePolygonClick(e, rightSurfaceName)}
          />

          {/* Center (Oclusal / Incisal) */}
          <polygon
            points="25,25 75,25 75,75 25,75"
            fill={getColor('OCLUSAL')}
            stroke="#94A3B8"
            strokeWidth="2.5"
            className="transition-colors hover:brightness-90"
            onClick={(e) => handlePolygonClick(e, 'OCLUSAL')}
          />

          {/* OVERLAYS */}
          {/* Absent / Missing Cross (Gray/Black X) */}
          {isAbsent && (
            <g stroke="#EF4444" strokeWidth="6" strokeLinecap="round">
              <line x1="10" y1="10" x2="90" y2="90" />
              <line x1="90" y1="10" x2="10" y2="90" />
            </g>
          )}

          {/* Extraction indicated (Dashed Red Cross) */}
          {isExtr && (
            <g stroke="#DC2626" strokeWidth="5" strokeDasharray="6,4" strokeLinecap="round">
              <line x1="12" y1="12" x2="88" y2="88" />
              <line x1="88" y1="12" x2="12" y2="88" />
            </g>
          )}

          {/* Endodontics canal icon (Turquoise vertical thick canal) */}
          {isEndo && (
            <g stroke="#0D9488" strokeWidth="7" strokeLinecap="round">
              <line x1="50" y1="10" x2="50" y2="90" />
              <circle cx="50" cy="50" r="10" fill="#0D9488" />
            </g>
          )}

          {/* Dental Implant indicator (Purple screw threads) */}
          {isImplant && (
            <g stroke="#7C3AED" strokeWidth="4" strokeLinecap="round">
              <line x1="50" y1="15" x2="50" y2="85" />
              <line x1="32" y1="30" x2="68" y2="30" />
              <line x1="35" y1="50" x2="65" y2="50" />
              <line x1="38" y1="70" x2="62" y2="70" />
            </g>
          )}

          {/* Crown indicator (Gold circle outline) */}
          {isCrown && (
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="5"
            />
          )}
        </svg>

        {/* Status indicator pip at top-right */}
        {generalCondition && (
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-1 ring-white"
            style={{ backgroundColor: surfaces.GENERAL?.colorCode || '#3B82F6' }}
            title={`Condición General: ${generalCondition}`}
          />
        )}
      </div>

      {/* Surface acronym indicator labels */}
      <span className="text-[9px] text-slate-400 font-medium mt-0.5 uppercase">
        {generalCondition ? generalCondition.slice(0, 3) : ''}
      </span>
    </div>
  );
};
