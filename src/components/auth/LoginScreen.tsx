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

/**
 * Isotipo minimalista monoline de OdontoPro: silueta estilizada de diente con curva de sonrisa
 * en verde petróleo (#0D565C), arco superior derecho y destello de 4 puntas en dorado champán (#C2A67E).
 */
const OdontoProLoginMark: React.FC = () => (
  <svg
    viewBox="0 0 80 76"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-14 w-14 md:h-[68px] md:w-[68px] shrink-0"
    aria-hidden="true"
  >
    {/* Contorno principal del diente + curva de sonrisa integrada en verde petróleo */}
    <path
      d="M52.5 27.5C46.5 30.2 41 27.6 36.2 22.8C31.4 18 23.2 15.2 18.6 21.8C14.2 28.1 16.8 41.2 21 53.2C23.5 60.4 26.8 66.2 31.2 65.8C34.9 65.5 36.7 58.6 39.2 52.8C39.8 51.4 40.9 51.4 41.5 52.8C44 58.6 45.8 65.5 49.5 65.8C53.9 66.2 57.2 60.4 59.7 53.2C61.5 48 63 42 63.4 36.2"
      stroke="#0D565C"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Curva sutil interna de sonrisa */}
    <path
      d="M32.5 39.2C36.8 42.6 41.8 47.2 44.5 52.6"
      stroke="#0D565C"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    {/* Arco superior derecho del esmalte en dorado champán */}
    <path
      d="M44.2 21.6C48.8 16.2 57.2 15.4 61.8 21.6C63.5 23.9 64.2 27.2 64 31"
      stroke="#C2A67E"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    {/* Destello minimalista de 4 puntas en dorado champán */}
    <path
      d="M68.5 3.5C69.1 10.6 70.4 11.9 77.5 12.5C70.4 13.1 69.1 14.4 68.5 21.5C67.9 14.4 66.6 13.1 59.5 12.5C66.6 11.9 67.9 10.6 68.5 3.5Z"
      fill="#C2A67E"
    />
  </svg>
);

/**
 * Capa decorativa dentaltech fija detrás del contenido:
 * redes geométricas finas asimétricas (superior derecha e inferior izquierda),
 * cuadrículas sutiles desvanecidas y polígonos translúcidos difuminados.
 */
const LoginTechBackdrop: React.FC = () => (
  <div
    aria-hidden="true"
    className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
  >
    {/* Polígonos translúcidos difuminados para profundidad atmosférica */}
    <div
      className="absolute -top-12 right-[6%] h-56 w-56 md:h-72 md:w-72 opacity-30"
      style={{
        background: 'linear-gradient(135deg, rgba(13, 86, 92, 0.24) 0%, rgba(194, 166, 126, 0.12) 100%)',
        clipPath: 'polygon(22% 8%, 88% 18%, 74% 88%, 12% 72%)',
        filter: 'blur(34px)',
      }}
    />
    <div
      className="absolute top-[22%] left-[12%] h-24 w-24 md:h-32 md:w-32 opacity-25"
      style={{
        background: 'linear-gradient(150deg, rgba(13, 86, 92, 0.30) 0%, rgba(13, 86, 92, 0.04) 100%)',
        clipPath: 'polygon(50% 6%, 94% 62%, 44% 94%, 12% 48%)',
        filter: 'blur(14px)',
      }}
    />
    <div
      className="absolute bottom-[14%] left-[10%] md:left-[15%] h-44 w-44 md:h-60 md:w-60 opacity-30"
      style={{
        background: 'linear-gradient(140deg, rgba(13, 86, 92, 0.18) 0%, rgba(194, 166, 126, 0.10) 100%)',
        clipPath: 'polygon(14% 26%, 82% 8%, 94% 74%, 34% 94%)',
        filter: 'blur(26px)',
      }}
    />
    <div
      className="absolute bottom-[8%] right-[10%] md:right-[12%] h-36 w-48 md:h-48 md:w-64 opacity-25"
      style={{
        background: 'linear-gradient(135deg, rgba(13, 86, 92, 0.28) 0%, rgba(13, 86, 92, 0.05) 100%)',
        clipPath: 'polygon(12% 28%, 68% 8%, 94% 62%, 38% 92%)',
        filter: 'blur(22px)',
      }}
    />

    {/* Cuadrícula vertical/horizontal desvanecida — lateral medio izquierdo */}
    <svg
      viewBox="0 0 260 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hidden sm:block absolute top-[14%] -left-4 w-[180px] md:w-[240px] h-auto opacity-75"
    >
      <defs>
        <linearGradient id="loginLeftFadeV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D565C" stopOpacity="0" />
          <stop offset="45%" stopColor="#0D565C" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#0D565C" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="loginLeftFadeH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0D565C" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#0D565C" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 134, 150, 168].map((x, idx) => (
        <line
          key={`lv-${x}`}
          x1={x}
          y1={idx % 2 === 0 ? 18 : 48}
          x2={x}
          y2={idx % 3 === 0 ? 330 : 285}
          stroke="url(#loginLeftFadeV)"
          strokeWidth="0.75"
        />
      ))}
      {[128, 140, 152, 164, 176, 188, 200, 212].map((y) => (
        <line
          key={`lh-${y}`}
          x1="0"
          y1={y}
          x2="235"
          y2={y}
          stroke="url(#loginLeftFadeH)"
          strokeWidth="0.7"
        />
      ))}
    </svg>

    {/* Cuadrícula vertical desvanecida — esquina inferior derecha */}
    <svg
      viewBox="0 0 260 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hidden sm:block absolute bottom-0 right-0 w-[180px] md:w-[250px] h-auto opacity-75"
    >
      <defs>
        <linearGradient id="loginRightFadeV" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#C2A67E" stopOpacity="0.22" />
          <stop offset="70%" stopColor="#0D565C" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0D565C" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[34, 48, 62, 76, 90, 104, 118, 132, 146, 160, 174, 188, 202, 216, 230, 244].map((x, idx) => (
        <line
          key={`rv-${x}`}
          x1={x}
          y1="220"
          x2={x}
          y2={Math.max(18, 185 - idx * 11)}
          stroke="url(#loginRightFadeV)"
          strokeWidth="0.8"
        />
      ))}
    </svg>

    {/* Red geométrica sutil — esquina superior derecha */}
    <svg
      viewBox="0 0 560 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute -top-6 -right-8 w-[340px] sm:w-[440px] md:w-[560px] h-auto opacity-65 md:opacity-100"
    >
      <defs>
        <pattern id="loginTopRightGrid" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#0D565C" strokeWidth="0.5" strokeOpacity="0.10" />
        </pattern>
        <radialGradient id="loginTopRightMaskGrad" cx="84%" cy="22%" r="58%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="loginTopRightGridMask">
          <rect width="560" height="440" fill="url(#loginTopRightMaskGrad)" />
        </mask>
      </defs>

      {/* Micro-cuadrícula suave desvanecida detrás de la red */}
      <rect width="560" height="440" fill="url(#loginTopRightGrid)" mask="url(#loginTopRightGridMask)" />

      {/* Aristas en dorado champán (opacidad baja 0.22–0.28) */}
      <g stroke="#C2A67E" strokeWidth="0.85" strokeOpacity="0.28">
        <line x1="158" y1="24" x2="232" y2="-10" />
        <line x1="158" y1="24" x2="170" y2="96" />
        <line x1="232" y1="-10" x2="170" y2="96" />
        <line x1="232" y1="-10" x2="296" y2="96" />
        <line x1="170" y1="96" x2="256" y2="196" />
        <line x1="296" y1="96" x2="256" y2="196" />
        <line x1="256" y1="196" x2="318" y2="196" />
        <line x1="256" y1="196" x2="132" y2="314" />
        <line x1="318" y1="196" x2="408" y2="236" />
        <line x1="408" y1="236" x2="226" y2="338" />
        <line x1="226" y1="338" x2="328" y2="348" />
        <line x1="408" y1="236" x2="548" y2="312" />
      </g>

      {/* Aristas en verde petróleo (opacidad 0.20–0.28) */}
      <g stroke="#0D565C" strokeWidth="0.85" strokeOpacity="0.25">
        <line x1="322" y1="78" x2="386" y2="48" />
        <line x1="322" y1="78" x2="424" y2="104" />
        <line x1="322" y1="78" x2="318" y2="196" />
        <line x1="386" y1="48" x2="424" y2="104" />
        <line x1="386" y1="48" x2="462" y2="6" />
        <line x1="424" y1="104" x2="318" y2="196" />
        <line x1="424" y1="104" x2="458" y2="178" />
        <line x1="424" y1="104" x2="508" y2="32" />
        <line x1="458" y1="178" x2="540" y2="198" />
        <line x1="458" y1="178" x2="444" y2="316" />
        <line x1="444" y1="316" x2="548" y2="288" />
        <line x1="444" y1="316" x2="548" y2="340" />
        <line x1="318" y1="196" x2="458" y2="178" />
      </g>

      {/* Nodos */}
      <circle cx="322" cy="78" r="4.2" fill="#0D565C" fillOpacity="0.82" />
      <circle cx="424" cy="104" r="4.6" fill="#0D565C" fillOpacity="0.78" />
      <circle cx="318" cy="196" r="3.1" fill="#0D565C" fillOpacity="0.72" />
      <circle cx="458" cy="178" r="4.0" fill="#0D565C" fillOpacity="0.34" />
      <circle cx="386" cy="48" r="3.4" fill="#C2A67E" fillOpacity="0.45" />
      <circle cx="296" cy="96" r="3.4" fill="#C2A67E" fillOpacity="0.48" />
      <circle cx="170" cy="96" r="3.8" fill="#C2A67E" fillOpacity="0.32" />
      <circle cx="256" cy="196" r="2.6" fill="#C2A67E" fillOpacity="0.46" />
      <circle cx="178" cy="204" r="3.2" fill="#C2A67E" fillOpacity="0.65" />
      <circle cx="332" cy="348" r="2.8" fill="#C2A67E" fillOpacity="0.62" />
      <circle cx="390" cy="360" r="2.3" fill="#C2A67E" fillOpacity="0.50" />
      <circle cx="408" cy="236" r="2.6" fill="#C2A67E" fillOpacity="0.42" />
    </svg>

    {/* Red geométrica sutil — esquina inferior izquierda */}
    <svg
      viewBox="0 0 560 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute -bottom-6 -left-6 w-[330px] sm:w-[440px] md:w-[560px] h-auto opacity-65 md:opacity-100"
    >
      {/* Aristas en dorado champán */}
      <g stroke="#C2A67E" strokeWidth="0.85" strokeOpacity="0.28">
        <line x1="20" y1="68" x2="122" y2="178" />
        <line x1="20" y1="68" x2="12" y2="210" />
        <line x1="122" y1="178" x2="246" y2="294" />
        <line x1="122" y1="178" x2="180" y2="306" />
        <line x1="246" y1="294" x2="286" y2="378" />
        <line x1="246" y1="294" x2="376" y2="346" />
        <line x1="302" y1="334" x2="376" y2="346" />
        <line x1="376" y1="346" x2="452" y2="354" />
        <line x1="376" y1="346" x2="466" y2="418" />
        <line x1="376" y1="346" x2="366" y2="432" />
        <line x1="376" y1="346" x2="286" y2="434" />
        <line x1="286" y1="378" x2="376" y2="346" />
      </g>

      {/* Aristas en verde petróleo */}
      <g stroke="#0D565C" strokeWidth="0.85" strokeOpacity="0.24">
        <line x1="12" y1="210" x2="122" y2="178" />
        <line x1="12" y1="210" x2="36" y2="308" />
        <line x1="36" y1="308" x2="122" y2="178" />
        <line x1="36" y1="308" x2="112" y2="334" />
        <line x1="36" y1="308" x2="64" y2="414" />
        <line x1="112" y1="334" x2="122" y2="178" />
        <line x1="112" y1="334" x2="180" y2="306" />
        <line x1="112" y1="334" x2="208" y2="386" />
        <line x1="112" y1="334" x2="108" y2="438" />
        <line x1="208" y1="386" x2="246" y2="294" />
        <line x1="208" y1="386" x2="286" y2="378" />
        <line x1="208" y1="386" x2="152" y2="438" />
        <line x1="286" y1="378" x2="256" y2="438" />
      </g>

      {/* Nodos */}
      <circle cx="122" cy="178" r="4.4" fill="#C2A67E" fillOpacity="0.72" />
      <circle cx="36" cy="308" r="4.2" fill="#0D565C" fillOpacity="0.80" />
      <circle cx="112" cy="334" r="4.4" fill="#0D565C" fillOpacity="0.82" />
      <circle cx="208" cy="386" r="4.4" fill="#0D565C" fillOpacity="0.82" />
      <circle cx="286" cy="378" r="4.2" fill="#0D565C" fillOpacity="0.76" />
      <circle cx="246" cy="294" r="4.5" fill="#C2A67E" fillOpacity="0.62" />
      <circle cx="180" cy="306" r="2.6" fill="#C2A67E" fillOpacity="0.48" />
      <circle cx="302" cy="334" r="2.6" fill="#C2A67E" fillOpacity="0.50" />
      <circle cx="452" cy="354" r="2.5" fill="#C2A67E" fillOpacity="0.45" />
    </svg>
  </div>
);

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
    <div className="min-h-[100dvh] bg-[#F7F7F4] flex flex-col justify-center py-8 px-4 md:py-12 md:px-6 lg:px-8 font-sans antialiased text-[#2D3739] relative overflow-x-hidden selection:bg-[#0D565C] selection:text-white">
      {/* Capa decorativa dentaltech fija */}
      <LoginTechBackdrop />

      {/* Contenedor Principal Centrado */}
      <div className="w-full max-w-[436px] mx-auto relative z-10">
        {/* Encabezado de Marca */}
        <div className="flex flex-col items-center text-center mb-7 md:mb-8">
          <OdontoProLoginMark />

          <h1
            aria-label={APP_NAME}
            className="mt-2 inline-flex items-center gap-2 text-[26px] md:text-[31px] font-extrabold tracking-[0.07em] text-[#0D565C] leading-none select-none"
          >
            <span>ODONTOPRO</span>
            <span
              aria-hidden="true"
              className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-[#C2A67E] shrink-0"
            />
          </h1>

          {/* Separador fino dorado champán */}
          <span
            aria-hidden="true"
            className="mt-3 mb-2.5 h-[1.5px] w-10 bg-[#C2A67E] rounded-full"
          />

          <p
            className="text-[13px] md:text-sm font-medium tracking-[0.02em] text-[#9E8A6C] max-w-[300px] sm:max-w-sm mx-auto truncate px-2"
            title={companyLegalName || 'Quality Solutions'}
          >
            {companyLegalName || 'Quality Solutions'}
          </p>
        </div>

        {/* Tarjeta de Login Glassmorphism */}
        <div
          className="rounded-[16px] p-6 sm:p-8 md:px-9 md:py-9 backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.86)',
            border: '1px solid rgba(255, 255, 255, 0.92)',
            boxShadow:
              '0 20px 40px -15px rgba(13, 86, 92, 0.10), 0 4px 16px -4px rgba(13, 86, 92, 0.04), 0 0 0 1px rgba(214, 211, 203, 0.45)',
          }}
        >
          {/* Mensaje de Error / Bloqueo */}
          {errorMsg && (
            <div
              className={`mb-5 p-3 rounded-[10px] text-xs flex items-start gap-2.5 border ${
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
          <form onSubmit={handleSubmit} method="post" autoComplete="on" className="space-y-5">
            {/* Campo 1: Correo electrónico o nombre de usuario */}
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-[13px] font-medium text-[#2D3739] mb-2"
              >
                Correo electrónico o usuario
              </label>
              <div className="relative">
                <User
                  className="h-[17px] w-[17px] absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7678] pointer-events-none"
                  strokeWidth={1.6}
                />
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
                  className="block w-full pl-10 pr-3.5 py-2.5 text-base md:text-[14px] bg-white/85 border border-[#DCE2E2] rounded-[9px] focus:border-[#0D565C] focus:ring-[3px] focus:ring-[#0D565C]/12 focus:bg-white focus:outline-none transition-all duration-150 text-[#2D3739] placeholder-[#6B7678]/70 min-h-[46px]"
                />
              </div>
            </div>

            {/* Campo 2: Contraseña */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-[13px] font-medium text-[#2D3739] mb-2"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="h-[17px] w-[17px] absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7678] pointer-events-none"
                  strokeWidth={1.6}
                />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-2.5 text-base md:text-[14px] bg-white/85 border border-[#DCE2E2] rounded-[9px] focus:border-[#0D565C] focus:ring-[3px] focus:ring-[#0D565C]/12 focus:bg-white focus:outline-none transition-all duration-150 text-[#2D3739] placeholder-[#6B7678]/70 min-h-[46px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[#6B7678] hover:text-[#2D3739] p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors rounded-lg"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  )}
                </button>
              </div>
            </div>

            {/* Fila de Controles: Recordarme y Recuperación */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none py-1 group">
                <span className="relative inline-flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => handleRememberMeChange(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="h-[18px] w-[18px] rounded-[4px] border border-[#C8D0D0] bg-white peer-checked:bg-[#0D565C] peer-checked:border-[#0D565C] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0D565C]/30 peer-focus-visible:ring-offset-1 transition-colors flex items-center justify-center"
                  >
                    <svg
                      viewBox="0 0 12 10"
                      fill="none"
                      className={`h-2.5 w-3 text-white transition-opacity ${
                        rememberMe ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <path
                        d="M1.5 5.2L4.5 8.2L10.5 1.8"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </span>
                <span className="text-[13px] text-[#6B7678] group-hover:text-[#2D3739] font-medium transition-colors">
                  Recordarme
                </span>
              </label>

              <button
                type="button"
                onClick={openRecoveryModal}
                className="text-[13px] text-[#0D565C] hover:text-[#094045] font-medium transition-colors py-1 cursor-pointer hover:underline"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            {/* Botón Principal */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-1 py-3 px-4 bg-[#0D565C] hover:bg-[#094045] active:scale-[0.99] text-white rounded-[10px] text-[14px] font-semibold tracking-[0.01em] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer min-h-[46px] md:min-h-[48px]"
              style={{
                boxShadow: '0 10px 22px -10px rgba(13, 86, 92, 0.50)',
              }}
            >
              {isLoading ? (
                <span>Validando credenciales...</span>
              ) : (
                <>
                  <span>Iniciar sesión</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Pie Institucional Discreto */}
        <p className="mt-6 text-center text-[12px] md:text-[13px] text-[#6B7678] leading-relaxed max-w-[360px] mx-auto px-2">
          Confidencialidad clínica conforme a normativas del MSPBS de Paraguay.
        </p>
      </div>

      {/* Modal Seguro para Recuperación de Acceso */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2729]/55 p-3 md:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[16px] border border-[#DCE2E2] max-w-md w-full shadow-2xl p-5 md:p-6 relative max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Botón de cierre */}
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-3.5 right-3.5 md:top-4 md:right-4 text-[#6B7678] hover:text-[#2D3739] p-2 rounded-lg hover:bg-[#F7F7F4] transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Cabecera del Modal */}
            <div className="flex items-center gap-3 mb-4 pr-8">
              <div className="h-10 w-10 rounded-[10px] bg-[#0D565C]/10 text-[#0D565C] flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-[#2D3739]">
                  Recuperación de Contraseña
                </h3>
                <p className="text-xs text-[#6B7678]">
                  Restablecimiento institucional seguro
                </p>
              </div>
            </div>

            {/* Selector de Pestañas estilo subrayado */}
            <div className="flex items-center gap-5 border-b border-[#DCE2E2] mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('REQUEST');
                  setRecoveryError(null);
                }}
                className={`relative pb-2.5 min-h-[40px] transition-colors cursor-pointer ${
                  recoveryTab === 'REQUEST'
                    ? 'text-[#0D565C]'
                    : 'text-[#6B7678] hover:text-[#2D3739]'
                }`}
              >
                Solicitar enlace
                {recoveryTab === 'REQUEST' && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#0D565C]" />
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
                    ? 'text-[#0D565C]'
                    : 'text-[#6B7678] hover:text-[#2D3739]'
                }`}
              >
                Tengo un código
                {recoveryTab === 'RESET' && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#0D565C]" />
                )}
              </button>
            </div>

            {/* Mensajes de Estado en Modal */}
            {recoveryMessage && (
              <div className="mb-4 p-3.5 bg-[#F4F8EA] border border-[#D7E6B5] rounded-[10px] text-xs text-[#3F6212] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#4D7C0F] shrink-0" />
                  <span>Procesado con Éxito</span>
                </div>
                <p className="text-[12px] leading-relaxed">
                  {recoveryMessage}
                </p>
              </div>
            )}

            {recoveryError && (
              <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#F5C2C2] rounded-[10px] text-xs text-[#991B1B] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[#B91C1C] shrink-0 mt-0.5" />
                <span className="font-semibold">{recoveryError}</span>
              </div>
            )}

            {/* Pestaña 1: Solicitar Recuperación */}
            {recoveryTab === 'REQUEST' && (
              <form onSubmit={handleRequestRecovery} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#2D3739] mb-1.5">
                    Correo Electrónico Institucional
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7678]" />
                    <input
                      type="email"
                      required
                      placeholder="usuario@clinica.com.py"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 text-base md:text-xs bg-white border border-[#DCE2E2] rounded-[9px] focus:border-[#0D565C] focus:ring-[3px] focus:ring-[#0D565C]/12 focus:outline-none text-[#2D3739] min-h-[44px]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-[#6B7678] leading-relaxed">
                  Por medidas de seguridad médica y protección contra enumeración, si la cuenta existe y está activa, se procesará el restablecimiento institucional.
                </p>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 border border-[#DCE2E2] text-[#6B7678] hover:bg-[#F7F7F4] rounded-[10px] text-xs font-semibold transition-colors min-h-[44px] cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#0D565C] hover:bg-[#094045] text-white rounded-[10px] text-xs font-semibold transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer"
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
                  <label className="block text-xs font-medium text-[#2D3739] mb-1">
                    Código o Token de Recuperación
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="rst_..."
                    value={recoveryToken}
                    onChange={(e) => setRecoveryToken(e.target.value)}
                    className="block w-full px-3 py-2.5 text-base md:text-xs bg-white border border-[#DCE2E2] rounded-[9px] focus:border-[#0D565C] focus:ring-[3px] focus:ring-[#0D565C]/12 focus:outline-none font-mono text-[#2D3739] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2D3739] mb-1">
                    Nueva Contraseña (mínimo 8 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full px-3 py-2.5 text-base md:text-xs bg-white border border-[#DCE2E2] rounded-[9px] focus:border-[#0D565C] focus:ring-[3px] focus:ring-[#0D565C]/12 focus:outline-none text-[#2D3739] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2D3739] mb-1">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2.5 text-base md:text-xs bg-white border border-[#DCE2E2] rounded-[9px] focus:border-[#0D565C] focus:ring-[3px] focus:ring-[#0D565C]/12 focus:outline-none text-[#2D3739] min-h-[44px]"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 border border-[#DCE2E2] text-[#6B7678] hover:bg-[#F7F7F4] rounded-[10px] text-xs font-semibold transition-colors min-h-[44px] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#0D565C] hover:bg-[#094045] text-white rounded-[10px] text-xs font-semibold transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer"
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
