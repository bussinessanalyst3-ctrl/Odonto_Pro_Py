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
  Sparkles
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
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-xl shadow-teal-500/25 mb-4 border border-teal-300/30">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.tradeName} className="h-10 w-10 object-contain rounded-xl" />
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
            {branding.taxId && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 text-teal-200 border border-white/15 font-mono">
                RUC: {branding.taxId}
              </span>
            )}
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

          {/* Quick Demo Credentials Access */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Credenciales de Acceso Rápido</span>
              </div>
              <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                1 Clic para autocompletar
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Seleccione cualquiera de los usuarios de prueba oficiales con su rol y permisos de la nueva versión:
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setEmail('lucas.arrua@odontosol.com.py');
                  setPassword('SuperAdmin2026!');
                  setErrorMsg(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 group-hover:text-purple-700">Super Admin</span>
                  <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">L100</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Lucas Arrua Almada</div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">SuperAdmin2026!</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('sofia.benitez@odontosol.com.py');
                  setPassword('AdminOrg2026!');
                  setErrorMsg(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900 group-hover:text-indigo-700">Org Admin</span>
                  <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold">L80</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Sofía Benítez</div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">AdminOrg2026!</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('marcos.vega@odontosol.com.py');
                  setPassword('AdminSuc2026!');
                  setErrorMsg(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 group-hover:text-blue-700">Sucursal Admin</span>
                  <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">L50</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Marcos Vega (SLO)</div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">AdminSuc2026!</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('valeria.gomez@odontosol.com.py');
                  setPassword('Odonto2026!');
                  setErrorMsg(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-900 group-hover:text-teal-700">Odontóloga</span>
                  <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-mono font-bold">MSPBS</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Dra. Valeria Gómez</div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">Odonto2026!</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('carlos.mendoza@odontosol.com.py');
                  setPassword('Caja2026!');
                  setErrorMsg(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 group-hover:text-emerald-700">Caja / Facturación</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">PYG</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Carlos Mendoza</div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">Caja2026!</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('ana.gimenez@odontosol.com.py');
                  setPassword('Recepcion2026!');
                  setErrorMsg(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 group-hover:text-amber-700">Recepción</span>
                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">Turnos</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Ana Sofía Giménez</div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">Recepcion2026!</div>
              </button>
            </div>
            <div className="mt-2 text-[10px] text-center text-slate-400">
              Clave maestra global alternativa: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700 font-bold">OdontoSol2026!</code>
            </div>
          </div>

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
