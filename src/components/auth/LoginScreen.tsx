import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  User,
  X
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { useBranding } from '../../branding/BrandingContext.tsx';
import { APP_NAME } from '../../config/appBrand.ts';
import { OdontoProWordmark } from '../ui/DesignPrimitives.tsx';

// Clave exclusiva para recordar únicamente el identificador (correo o nombre de usuario).
// NUNCA se almacena la contraseña en ningún medio local.
const REMEMBERED_IDENTIFIER_KEY = 'odontopro_remembered_identifier';

export const LoginScreen: React.FC = () => {
  const { login, requestPasswordReset, resetPasswordWithToken, isLoading } = useAuth();
  const { branding } = useBranding();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Modal para recuperación segura de contraseña
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState<'REQUEST' | 'RESET'>('REQUEST');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);

  // Carga inicial y saneamiento de almacenamiento local
  useEffect(() => {
    // 1. Limpieza de seguridad: erradicar cualquier clave previa que pudiera contener contraseñas o branding legado
    try {
      localStorage.removeItem('odontopro_remembered_credentials');
      sessionStorage.removeItem('odontopro_remembered_credentials');
      localStorage.removeItem('odontosol_remembered_identifier');
    } catch (e) {}

    // 2. Cargar únicamente el identificador no sensible si fue recordado por el usuario
    try {
      const savedIdentifier = localStorage.getItem(REMEMBERED_IDENTIFIER_KEY);
      if (savedIdentifier && typeof savedIdentifier === 'string') {
        setIdentifier(savedIdentifier);
        setRememberMe(true);
      }
    } catch (e) {
      console.warn('No se pudo leer el identificador recordado:', e);
    }
  }, []);

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      try {
        localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
      } catch (e) {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLocked(false);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setErrorMsg('Las credenciales ingresadas no son válidas.');
      return;
    }

    const result = await login({
      email: cleanIdentifier,
      password,
      rememberMe,
    });

    if (result.success) {
      // Si el usuario marcó "Recordarme", guardar ÚNICAMENTE el identificador (nunca la contraseña)
      if (rememberMe) {
        try {
          localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, cleanIdentifier);
        } catch (e) {}
      } else {
        try {
          localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
        } catch (e) {}
      }
    } else {
      setErrorMsg(result.error || 'Las credenciales ingresadas no son válidas.');
      if (result.locked) {
        setIsLocked(true);
      }
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoveryMessage(null);

    if (!recoveryEmail || !recoveryEmail.trim()) {
      setRecoveryError('Debe ingresar su correo electrónico institucional.');
      return;
    }

    setIsSubmittingRecovery(true);
    try {
      const res = await requestPasswordReset(recoveryEmail.trim());
      setRecoveryMessage(res.message);
    } catch (err: any) {
      // Mensaje neutro genérico para evitar enumeración de usuarios
      setRecoveryMessage(
        'Si el correo electrónico ingresado coincide con una cuenta activa, recibirá las instrucciones para restablecer su acceso institucional.'
      );
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoveryMessage(null);

    if (!recoveryToken || !recoveryToken.trim()) {
      setRecoveryError('Debe ingresar el código o token de recuperación.');
      return;
    }

    if (newPassword.length < 8) {
      setRecoveryError('La nueva contraseña debe tener como mínimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setRecoveryError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setIsSubmittingRecovery(true);
    try {
      const res = await resetPasswordWithToken(recoveryToken.trim(), newPassword);
      if (res.success) {
        setRecoveryMessage(res.message || 'Su contraseña ha sido actualizada con éxito. Puede iniciar sesión.');
        setRecoveryToken('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setRecoveryError(res.error || 'El código de recuperación es inválido o ha expirado.');
      }
    } catch (err: any) {
      setRecoveryError(err.message || 'Error al procesar el restablecimiento de contraseña.');
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  const openRecoveryModal = () => {
    setRecoveryError(null);
    setRecoveryMessage(null);
    setRecoveryEmail(identifier.includes('@') ? identifier : '');
    setRecoveryToken('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryTab('REQUEST');
    setIsForgotModalOpen(true);
  };

  const companyLegalName = (branding.legalName || '').trim();

  return (
    <div className="min-h-[100dvh] bg-[#F8F7F4] flex flex-col justify-center py-6 px-4 md:py-12 md:px-6 lg:px-8 font-sans antialiased text-[#1C1F1E] relative overflow-x-hidden selection:bg-[#0F5C63] selection:text-white">
      {/* Contenedor Principal */}
      <div className="w-full max-w-[420px] mx-auto relative z-10">
        {/* Cabecera de Marca ODONTOPRO */}
        <div className="text-center mb-5 md:mb-7">
          <div className="inline-flex flex-col items-center">
            <h1 aria-label={APP_NAME} className="leading-none">
              <OdontoProWordmark size="lg" />
            </h1>
            <span
              aria-hidden="true"
              className="mt-2.5 h-[2px] w-10 bg-[#C6B08E] rounded-full"
            />
          </div>

          {companyLegalName ? (
            <p
              className="mt-2.5 text-xs md:text-sm font-medium text-[#525755] max-w-[300px] sm:max-w-sm mx-auto truncate px-2"
              title={companyLegalName}
            >
              {companyLegalName}
            </p>
          ) : (
            <p className="mt-2.5 text-xs md:text-sm text-[#6B706D]">
              Gestión clínica odontológica y estética
            </p>
          )}
        </div>

        {/* Tarjeta Plana de Inicio de Sesión */}
        <div className="bg-white py-5 px-4 md:py-7 md:px-7 rounded-lg border border-[#E6E2D9]">
          {/* Mensaje de Error / Bloqueo */}
          {errorMsg && (
            <div
              className={`mb-4 p-3 rounded-md text-xs flex items-start gap-2.5 border ${
                isLocked
                  ? 'bg-[#FEF6E7] border-[#F5D69B] text-[#92400E]'
                  : 'bg-[#FEF2F2] border-[#F5C2C2] text-[#991B1B]'
              }`}
              role="alert"
            >
              <AlertCircle
                className={`h-4 w-4 shrink-0 mt-0.5 ${
                  isLocked ? 'text-[#B45309]' : 'text-[#B91C1C]'
                }`}
              />
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Formulario Estándar y Seguro con Autocompletado del Navegador */}
          <form onSubmit={handleSubmit} method="post" autoComplete="on" className="space-y-4">
            {/* Campo 1: Correo electrónico o nombre de usuario */}
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-semibold text-[#363B39] mb-1.5"
              >
                Correo electrónico o usuario
              </label>
              <div className="relative">
                <User className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B706D] pointer-events-none" />
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder="usuario@clinica.com.py"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-base md:text-sm bg-[#F8F7F4]/60 border border-[#E6E2D9] rounded-md focus:ring-2 focus:ring-[#0F5C63]/20 focus:border-[#0F5C63] focus:bg-white focus:outline-none transition-colors text-[#1C1F1E] placeholder-[#8A8F8C] min-h-[44px]"
                />
              </div>
            </div>

            {/* Campo 2: Contraseña */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#363B39] mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B706D] pointer-events-none" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-2.5 text-base md:text-sm bg-[#F8F7F4]/60 border border-[#E6E2D9] rounded-md focus:ring-2 focus:ring-[#0F5C63]/20 focus:border-[#0F5C63] focus:bg-white focus:outline-none transition-colors text-[#1C1F1E] placeholder-[#8A8F8C] min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[#6B706D] hover:text-[#1C1F1E] p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Fila de Controles: Recordarme y Recuperación */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => handleRememberMeChange(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D5D0C5] accent-[#0F5C63] focus:ring-[#0F5C63] cursor-pointer"
                />
                <span className="text-xs text-[#525755] font-medium">Recordarme</span>
              </label>

              <button
                type="button"
                onClick={openRecoveryModal}
                className="text-xs text-[#0F5C63] hover:text-[#0B474D] font-semibold transition-colors py-1 cursor-pointer hover:underline"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            {/* Botón Principal */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-1 py-2.5 px-4 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer min-h-[44px] md:min-h-[46px]"
            >
              {isLoading ? (
                <span>Validando credenciales...</span>
              ) : (
                <>
                  <span>Iniciar sesión</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Pie Institucional Discreto */}
        <p className="mt-4 md:mt-5 text-center text-[11px] md:text-xs text-[#6B706D] px-2">
          Confidencialidad clínica conforme a normativas del MSPBS de Paraguay.
        </p>
      </div>

      {/* Modal Seguro para Recuperación de Acceso */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 md:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-4 md:p-6 relative max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Botón de cierre */}
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-3 right-3 md:top-4 md:right-4 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Cabecera del Modal */}
            <div className="flex items-center gap-2.5 md:gap-3 mb-3.5 md:mb-4 pr-8">
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl md:rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-slate-900">
                  Recuperación de Contraseña
                </h3>
                <p className="text-xs text-slate-500">
                  Restablecimiento institucional seguro
                </p>
              </div>
            </div>

            {/* Selector de Pestañas estilo subrayado */}
            <div className="flex items-center gap-5 border-b border-[#E6E2D9] mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('REQUEST');
                  setRecoveryError(null);
                }}
                className={`relative pb-2.5 min-h-[40px] transition-colors cursor-pointer ${
                  recoveryTab === 'REQUEST'
                    ? 'text-[#0F5C63]'
                    : 'text-[#525755] hover:text-[#1C1F1E]'
                }`}
              >
                Solicitar enlace
                {recoveryTab === 'REQUEST' && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#0F5C63]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('RESET');
                  setRecoveryError(null);
                }}
                className={`relative pb-2.5 min-h-[40px] transition-colors cursor-pointer ${
                  recoveryTab === 'RESET'
                    ? 'text-[#0F5C63]'
                    : 'text-[#525755] hover:text-[#1C1F1E]'
                }`}
              >
                Tengo un código
                {recoveryTab === 'RESET' && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#0F5C63]" />
                )}
              </button>
            </div>

            {/* Mensajes de Estado en Modal */}
            {recoveryMessage && (
              <div className="mb-4 p-3.5 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-teal-950">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  <span>Procesado con Éxito</span>
                </div>
                <p className="text-[12px] leading-relaxed text-teal-800">
                  {recoveryMessage}
                </p>
              </div>
            )}

            {recoveryError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{recoveryError}</span>
              </div>
            )}

            {/* Pestaña 1: Solicitar Recuperación */}
            {recoveryTab === 'REQUEST' && (
              <form onSubmit={handleRequestRecovery} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Correo Electrónico Institucional
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="usuario@clinica.com.py"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800 min-h-[44px]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Por medidas de seguridad médica y protección contra enumeración, si la cuenta existe y está activa, se procesará el restablecimiento institucional.
                </p>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors min-h-[44px] cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 min-h-[44px] cursor-pointer"
                  >
                    {isSubmittingRecovery ? 'Procesando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            )}

            {/* Pestaña 2: Establecer Nueva Contraseña con Código de Un Solo Uso */}
            {recoveryTab === 'RESET' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código o Token de Recuperación
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="rst_..."
                    value={recoveryToken}
                    onChange={(e) => setRecoveryToken(e.target.value)}
                    className="block w-full px-3 py-2.5 text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white font-mono text-slate-800 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nueva Contraseña (mínimo 8 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full px-3 py-2.5 text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2.5 text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800 min-h-[44px]"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors min-h-[44px] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 min-h-[44px] cursor-pointer"
                  >
                    {isSubmittingRecovery ? 'Actualizando...' : 'Restablecer Contraseña'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
