import React from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  CircleDot,
  Minus,
} from 'lucide-react';
import {
  getPatientAvatarStyle,
  getPatientInitials,
  SemanticTone,
} from '../../utils/visualIdentity.ts';

/**
 * Marca tipográfica ODONTOPRO en verde petróleo profundo con acento champagne puntual.
 */
export const OdontoProWordmark: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const textSize =
    size === 'lg'
      ? 'text-2xl md:text-3xl tracking-[0.06em]'
      : size === 'sm'
        ? 'text-sm tracking-[0.05em]'
        : 'text-base md:text-[17px] tracking-[0.06em]';
  const markSize = size === 'lg' ? 'h-2 w-2' : 'h-1.5 w-1.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-extrabold text-[#0F5C63] select-none leading-none ${textSize} ${className}`}
    >
      <span>ODONTOPRO</span>
      <span
        aria-hidden="true"
        className={`${markSize} rounded-full bg-[#C6B08E] shrink-0`}
      />
    </span>
  );
};

/**
 * Iniciales de paciente en círculo con tonos serenos y contraste AA.
 */
export const PatientAvatar: React.FC<{
  firstName?: string | null;
  lastName?: string | null;
  seed?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ firstName, lastName, seed, size = 'sm', className = '' }) => {
  const initials = getPatientInitials(firstName, lastName);
  const style = getPatientAvatarStyle(seed || `${firstName || ''}${lastName || ''}`);

  const sizeClass =
    size === 'xs'
      ? 'h-7 w-7 text-[11px]'
      : size === 'lg'
        ? 'h-11 w-11 text-sm'
        : size === 'md'
          ? 'h-9 w-9 text-xs'
          : 'h-8 w-8 text-[11px]';

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`inline-flex items-center justify-center rounded-full border font-semibold shrink-0 select-none ${sizeClass} ${className}`}
    >
      {initials}
    </span>
  );
};

/**
 * Indicador semántico sobrio: siempre texto + ícono (nunca solo color, nunca píldora estridente).
 */
export const StatusLabel: React.FC<{
  tone: SemanticTone;
  label: string;
  compact?: boolean;
  className?: string;
}> = ({ tone, label, compact = false, className = '' }) => {
  const okStyle = {
    wrap: 'bg-[#F4F8EA] text-[#3F6212] border-[#D7E6B5]',
    icon: 'text-[#4D7C0F]',
    Icon: CheckCircle2,
  };
  const warnStyle = {
    wrap: 'bg-[#FEF6E7] text-[#92400E] border-[#F5D69B]',
    icon: 'text-[#B45309]',
    Icon: Clock,
  };
  const dangerStyle = {
    wrap: 'bg-[#FEF2F2] text-[#991B1B] border-[#F5C2C2]',
    icon: 'text-[#B91C1C]',
    Icon: XCircle,
  };
  const brandStyle = {
    wrap: 'bg-[#ECF5F5] text-[#0F5C63] border-[#B9D9DC]',
    icon: 'text-[#0F5C63]',
    Icon: CircleDot,
  };
  const neutralStyle = {
    wrap: 'bg-[#F2F0EB] text-[#525755] border-[#E6E2D9]',
    icon: 'text-[#6B706D]',
    Icon: Minus,
  };

  const styles: Record<SemanticTone, { wrap: string; icon: string; Icon: React.ComponentType<{ className?: string }> }> = {
    ok: okStyle,
    paid: okStyle,
    warn: warnStyle,
    pending: warnStyle,
    danger: dangerStyle,
    brand: brandStyle,
    active: brandStyle,
    neutral: neutralStyle,
  };

  const cfg = styles[tone] || styles.neutral;
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${cfg.wrap} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.icon}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

/**
 * Pestañas estilo subrayado inferior en lugar de cápsulas.
 */
export interface UnderlineTabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

export function UnderlineTabs<T extends string>({
  items,
  activeId,
  onChange,
  ariaLabel = 'Pestañas de sección',
  className = '',
}: {
  items: UnderlineTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-5 sm:gap-7 border-b border-[#E6E2D9] overflow-x-auto scrollbar-none ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`relative pb-3 pt-1 min-h-[44px] flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              isActive
                ? 'text-[#0F5C63]'
                : 'text-[#525755] hover:text-[#1C1F1E]'
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={`text-xs tabular-nums ${
                  isActive ? 'text-[#0F5C63]/80' : 'text-[#6B706D]'
                }`}
              >
                ({item.count})
              </span>
            )}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#0F5C63]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Estado vacío sobrio con mensaje corto y acción siguiente.
 */
export const EmptyState: React.FC<{
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  message?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({ icon, title, description, message, action, actionLabel, onAction, className = '' }) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return <div className="text-[#6B706D]">{icon}</div>;
    }
    if (typeof icon === 'function' || (typeof icon === 'object' && '$$typeof' in (icon as object))) {
      const IconComp = icon as React.ComponentType<{ className?: string }>;
      return (
        <div className="text-[#6B706D]">
          <IconComp className="h-6 w-6" aria-hidden="true" />
        </div>
      );
    }
    return <div className="text-[#6B706D]">{icon as React.ReactNode}</div>;
  };

  return (
    <div
      className={`py-10 px-4 text-center rounded-lg border border-dashed border-[#E6E2D9] bg-[#F8F7F4]/60 flex flex-col items-center justify-center gap-2.5 ${className}`}
    >
      {renderIcon()}
      {title && <p className="text-sm font-semibold text-[#1C1F1E]">{title}</p>}
      {(description || message) && (
        <p className="text-sm text-[#525755] font-normal max-w-sm">
          {description || message}
        </p>
      )}
      {action ? (
        <div className="mt-1">{action}</div>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-md bg-[#0F5C63] hover:bg-[#0B474D] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};
