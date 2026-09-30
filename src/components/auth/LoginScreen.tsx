import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Building2,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  KeyRound,
  HeartPulse,
  Hospital,
  Activity,
  Landmark,
  Sparkles,
  ShieldCheck,
  User,
  X
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { useBranding } from '../../branding/BrandingContext.tsx';

// Clave exclusiva para recordar únicamente el identificador (correo o nombre de usuario).
// NUNCA se almacena la contraseña en ningún medio local.
const REMEMBERED_IDENTIFIER_KEY = 'odontosol_remembered_identifier';

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
    // 1. Limpieza de seguridad: erradicar cualquier clave previa que pudiera contener contraseñas
    try {
      localStorage.removeItem('odontopro_remembered_credentials');
      sessionStorage.removeItem('odontopro_remembered_credentials');
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

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex flex-col justify-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8 font-sans antialiased text-slate-800 relative overflow-x-hidden selection:bg-teal-500 selection:text-white">
      {/* Luces difusas de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[350px] sm:h-[500px] bg-teal-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Contenedor Principal */}
      <div className="w-full max-w-md mx-auto relative z-10">
        {/* Cabecera Institucional */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-xl shadow-teal-500/20 mb-3 sm:mb-4 border border-teal-300/30 overflow-hidden"
            style={branding.customHexColor ? { background: branding.customHexColor } : undefined}
          >
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.tradeName || 'Sistema Odontológico Paraguay'}
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-xl p-1"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : branding.logoIcon === 'heart-pulse' ? (
              <HeartPulse className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            ) : branding.logoIcon === 'hospital' ? (
              <Hospital className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            ) : branding.logoIcon === 'building' ? (
              <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            ) : branding.logoIcon === 'sparkles' ? (
              <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            ) : branding.logoIcon === 'shield' ? (
              <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            ) : branding.logoIcon === 'activity' ? (
              <Activity className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            ) : branding.logoIcon === 'landmark' ? (
              <Landmark className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            ) : (
              <Stethoscope className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {branding.tradeName || 'Sistema Odontológico Paraguay'}
          </h1>

          <p className="mt-1 text-xs sm:text-sm font-medium text-teal-200/90">
            Acceso al Sistema Clínico
          </p>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="bg-white/95 backdrop-blur-md py-6 px-5 sm:py-8 sm:px-8 shadow-2xl rounded-2xl sm:rounded-3xl border border-white/20">
          {/* Mensaje de Error / Bloqueo */}
          {errorMsg && (
            <div
              className={`mb-5 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-200 border ${
                isLocked
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
              role="alert"
            >
              <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${isLocked ? 'text-amber-600' : 'text-rose-600'}`} />
              <div className="flex-1 font-semibold leading-relaxed">
                {errorMsg}
              </div>
            </div>
          )}

          {/* Formulario Estándar y Seguro con Autocompletado del Navegador */}
          <form onSubmit={handleSubmit} method="post" autoComplete="on" className="space-y-4">
            {/* Campo 1: Correo electrónico o nombre de usuario */}
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Correo electrónico o nombre de usuario
              </label>
              <div className="relative">
                <User className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder="usuario@clinica.com.py o nombre de usuario"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white focus:outline-none transition-all font-medium text-slate-800 min-h-[46px]"
                />
              </div>
            </div>

            {/* Campo 2: Contraseña */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white focus:outline-none transition-all font-medium text-slate-800 min-h-[46px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Fila de Controles: Recordarme & Recuperación */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => handleRememberMeChange(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium">Recordarme</span>
              </label>

              <button
                type="button"
                onClick={openRecoveryModal}
                className="text-xs text-teal-700 hover:text-teal-900 font-semibold transition-colors py-1 cursor-pointer hover:underline"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            {/* Botón Principal: INICIAR SESIÓN */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-bold tracking-wide transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer min-h-[48px] active:scale-[0.99]"
            >
              {isLoading ? (
                <span>Validando credenciales...</span>
              ) : (
                <>
                  <span>INICIAR SESIÓN</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Pie Institucional Discreto */}
        <p className="mt-5 text-center text-xs text-slate-400">
          Protección de datos y confidencialidad médica conforme a normativas del MSPBS de Paraguay.
        </p>
      </div>

      {/* Modal Seguro para Recuperación de Acceso */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative">
            {/* Botón de cierre */}
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Cabecera del Modal */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Recuperación de Contraseña
                </h3>
                <p className="text-xs text-slate-500">
                  Restablecimiento institucional seguro
                </p>
              </div>
            </div>

            {/* Selector de Pestañas: Solicitar / Restablecer con código */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('REQUEST');
                  setRecoveryError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  recoveryTab === 'REQUEST'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Solicitar enlace
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('RESET');
                  setRecoveryError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  recoveryTab === 'RESET'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tengo un código
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
                      className="block w-full pl-10 pr-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800 min-h-[44px]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Por medidas de seguridad médica y protección contra enumeración, si la cuenta existe y está activa, se procesará el restablecimiento institucional.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors min-h-[44px]"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 min-h-[44px]"
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
                    className="block w-full px-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white font-mono text-slate-800 min-h-[44px]"
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
                    className="block w-full px-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800 min-h-[44px]"
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
                    className="block w-full px-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800 min-h-[44px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 min-h-[44px]"
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
