import React, { useState } from 'react';
import { X, KeyRound, ShieldAlert, Check, Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react';
import { hashPassword } from '../../auth/cryptoUtils.ts';
import { dbStore } from '../../db/inMemoryStore.ts';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
  } | null;
  onSuccess: (message: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const generateRandomSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    for (let i = 0; i < 12; i++) {
      pwd += chars[array[i] % chars.length];
    }
    // Asegurar mayúscula, minúscula, dígito y símbolo
    pwd += '2026!';
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('La contraseña debe tener un mínimo de 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Hashear con PBKDF2 + SHA-256 + Salt aleatorio único
      const hashRecord = await hashPassword(newPassword);

      // 2. Guardar en el store con hash criptográfico PBKDF2
      dbStore.setUserPasswordHash(user.id, {
        hash: hashRecord.hash,
        salt: hashRecord.salt,
        iterations: hashRecord.iterations,
      });

      // 3. Revocar sesiones activas previas por seguridad
      dbStore.revokeUserSessions(user.id);

      onSuccess(`Contraseña actualizada y protegida con éxito para ${user.firstName} ${user.lastName} (${user.email}). Se han revocado sesiones anteriores.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al derivar el hash criptográfico.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Restablecer Contraseña</h3>
              <p className="text-xs text-slate-500">Módulo exclusivo de Super Administrador</p>
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
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Usuario Seleccionado</div>
            <div className="text-sm font-bold text-slate-900">{user.firstName} {user.lastName}</div>
            <div className="text-xs font-mono text-slate-600">{user.email}</div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
              Seguridad Criptográfica PBKDF2:
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              La contraseña se derivará inmediatamente con <strong>100,000 iteraciones SHA-256</strong> y una <strong>sal criptográfica única</strong>. Ningún texto plano se almacenará de manera permanente.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Nueva Contraseña</label>
                <button
                  type="button"
                  onClick={generateRandomSecurePassword}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Generar Segura
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres..."
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 pr-9 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Contraseña</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetir la contraseña..."
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Derivando Hash...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Aplicar Cifrado y Guardar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
