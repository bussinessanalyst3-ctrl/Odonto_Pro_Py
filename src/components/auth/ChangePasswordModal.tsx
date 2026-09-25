import React, { useState } from 'react';
import { X, KeyRound, ShieldCheck, Eye, EyeOff, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { session, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener un mínimo de 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        if (onSuccess) onSuccess('Su contraseña ha sido actualizada con éxito y cifrada con PBKDF2.');
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error || 'Error al actualizar la contraseña.');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cambiar Mi Contraseña</h3>
              <p className="text-xs text-slate-500">Actualización segura de credenciales de usuario</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <span className="text-slate-500">Usuario activo: </span>
            <span className="font-bold text-slate-900">{session.firstName} {session.lastName}</span>
            <span className="text-slate-500 block font-mono text-[11px] mt-0.5">{session.email}</span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Contraseña Actual *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Ingrese su contraseña actual..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nueva Contraseña *
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-teal-600 hover:text-teal-700 flex items-center gap-1 font-semibold"
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres..."
              className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Confirmar Nueva Contraseña *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetir nueva contraseña..."
              className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Actualizar Contraseña</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
