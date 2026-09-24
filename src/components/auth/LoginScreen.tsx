import React, { useState } from 'react';
import {
  Stethoscope,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Building2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';

export const LoginScreen: React.FC = () => {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = await login({ email, password });
    if (!result.success) {
      setErrorMsg(result.error || 'Error al iniciar sesión.');
      if (result.attemptsLeft !== undefined) {
        setAttemptsLeft(result.attemptsLeft);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        {/* Logo and Clinic branding */}
        <div className="inline-flex h-14 w-14 rounded-2xl bg-teal-600 items-center justify-center text-white shadow-xl shadow-teal-900/40 mb-3 ring-4 ring-teal-500/20">
          <Stethoscope className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          OdontoPro Paraguay
        </h1>
        <p className="text-xs text-teal-300 font-medium mt-1">
          Sistema Clínico Multi-Sucursal • OdontoSol S.R.L. (RUC: 80098765-4)
        </p>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 mt-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Fase 3: Autenticación Segura & Sesión Activa</span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-100">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Ingreso Seguro al Sistema Clínico
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acceso protegido con hashing Argon2id/bcrypt, cookies HttpOnly y auditoría de accesos.
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold">{errorMsg}</div>
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="text-[11px] text-rose-600">
                    Intentos de seguridad restantes: <strong>{attemptsLeft}</strong> de 5
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correo Electrónico Institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="usuario@odontosol.com.py"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => alert('Para soporte o restablecimiento de contraseña comuníquese con Dirección Médica o use las cuentas demo de prueba.')}
                  className="text-[11px] text-teal-600 hover:text-teal-800 font-medium"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span>Validando credenciales...</span>
              ) : (
                <>
                  <span>Iniciar Sesión Clínica</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Legal and Security Verification Info */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-teal-600" />
                Acceso Clínico Restringido
              </span>
              <span className="text-[10px] text-slate-400 font-mono">RBAC Activo</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Cada usuario debe ingresar obligatoriamente con su <strong>correo institucional</strong> y <strong>contraseña</strong> asignada. El sistema asignará permisos de sucursal, tarifas y módulos clínicos según el rol registrado.
            </p>
          </div>
        </div>

        {/* Security and Legal Notice Footer */}
        <div className="mt-6 text-center text-xs text-slate-400 space-y-1">
          <p>
            Cumplimiento Ley N° 1682/01 de Protección de Datos Médicos en Paraguay.
          </p>
          <p className="text-[11px] text-slate-500">
            Cookies de sesión con flags <code>HttpOnly</code>, <code>SameSite=Lax</code>, <code>Secure</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
