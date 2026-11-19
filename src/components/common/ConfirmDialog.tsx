import React, { useEffect } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  hideCancel?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'warning',
  hideCancel = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const iconWrapperClass =
    variant === 'danger'
      ? 'bg-rose-100 text-rose-700'
      : variant === 'warning'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-teal-100 text-teal-700';

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-700/20'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-700/20'
        : 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-teal-700/20';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onCancel();
      }}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${iconWrapperClass}`}>
              {variant === 'danger' ? (
                <ShieldAlert className="h-5 w-5" />
              ) : variant === 'warning' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-900 leading-snug">
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            aria-label="Cerrar diálogo"
            className="text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!hideCancel && (
            <button
              type="button"
              disabled={isLoading}
              onClick={onCancel}
              className="px-4 py-2.5 min-h-[42px] text-xs font-bold text-slate-600 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-5 py-2.5 min-h-[42px] text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 ${confirmBtnClass}`}
          >
            {isLoading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
