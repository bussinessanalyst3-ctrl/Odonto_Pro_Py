import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Building2,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  KeyRound,
  HelpCircle,
  RotateCcw,
  Clock,
  Sparkles,
  HeartPulse,
  Hospital,
  Activity,
  Landmark
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { authService } from '../../auth/authService.ts';
import { useBranding } from '../../branding/BrandingContext.tsx';

export const LoginScreen: React.FC = () => {
  const { login, requestPasswordReset, isLoading } = useAuth();
  const { branding } = useBranding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // Modal para recuperación de contraseña
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<{ sent: boolean; message?: string }>({ sent: false });
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = await login({
      email,
      password,
      rememberMe,
    });

    if (!result.success) {
      setErrorMsg(result.error || 'Credenciales de acceso incorrectas.');
      if (result.attemptsLeft !== undefined) {
        setAttemptsLeft(result.attemptsLeft);
      }
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;

    setIsSendingRecovery(true);
    try {
      const res = await requestPasswordReset(recoveryEmail);
      setRecoveryStatus({ sent: true, message: res.message });
    } finally {
      setIsSendingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased text-slate-800 relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-teal-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-xl shadow-teal-500/25 mb-4 border border-teal-300/30 overflow-hidden"
            style={branding.customHexColor ? { background: branding.customHexColor } : undefined}
          >
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.tradeName}
                className="h-12 w-12 object-contain rounded-xl p-1"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : branding.logoIcon === 'heart-pulse' ? (
              <HeartPulse className="h-8 w-8 text-white" />
            ) : branding.logoIcon === 'hospital' ? (
              <Hospital className="h-8 w-8 text-white" />
            ) : branding.logoIcon === 'building' ? (
              <Building2 className="h-8 w-8 text-white" />
            ) : branding.logoIcon === 'sparkles' ? (
              <Sparkles className="h-8 w-8 text-white" />
            ) : branding.logoIcon === 'shield' ? (
              <ShieldCheck className="h-8 w-8 text-white" />
            ) : branding.logoIcon === 'activity' ? (
              <Activity className="h-8 w-8 text-white" />
            ) : branding.logoIcon === 'landmark' ? (
              <Landmark className="h-8 w-8 text-white" />
            ) : (
              <Stethoscope className="h-8 w-8 text-white" />
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {branding.tradeName}
          </h1>

          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-xs font-medium text-slate-300">
              {branding.legalName}
            </span>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-white/20">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">
              Acceso Seguro al Sistema Clínico
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ingrese con sus credenciales institucionales habilitadas por el Administrador.
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold">{errorMsg}</div>
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="text-[11px] text-rose-600 font-medium">
                    Intentos preventivos restantes: <strong>{attemptsLeft}</strong> de 5.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="usuario@clinica.com.py"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold transition-colors"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-600 font-medium">Recordar cuenta</span>
              </label>

              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Sesión: 8 horas</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <span>Validando credenciales...</span>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security Architecture Footnote */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Cifrado PBKDF2 + SHA-256</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{branding.countryCode}</span>
              <span>•</span>
              <span>{branding.currency} ({branding.currencySymbol})</span>
            </div>
          </div>
        </div>

        {/* Global Footer Note */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Protección de datos médicos conforme a las normativas del MSPBS de Paraguay.
        </p>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Recuperación de Acceso
                </h3>
                <p className="text-xs text-slate-500">
                  Protocolo institucional de seguridad
                </p>
              </div>
            </div>

            {recoveryStatus.sent ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-teal-950">
                    <CheckCircle2 className="h-4 w-4 text-teal-600" />
                    <span>Solicitud de Acceso Registrada</span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-teal-800">
                    {recoveryStatus.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setRecoveryStatus({ sent: false });
                    setRecoveryEmail('');
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Regresar al Inicio de Sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-4 mt-2">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ingrese su correo institucional. Se generará un registro seguro de auditoría para que el Administrador o Dirección Médica pueda restablecer su contraseña de inmediato.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@clinica.com.py"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingRecovery}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                  >
                    {isSendingRecovery ? 'Procesando...' : 'Enviar Solicitud'}
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
