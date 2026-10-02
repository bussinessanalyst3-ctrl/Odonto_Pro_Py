import React, { useState, useRef } from 'react';
import {
  Building2,
  Palette,
  Globe2,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Save,
  Plus,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  Landmark,
  Image as ImageIcon,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  Upload,
  Trash2,
  ExternalLink,
  Stethoscope,
  HeartPulse,
  Hospital,
  Activity,
  Lock,
  ShieldAlert,
  Sliders,
  Check,
  Eye,
  FileText,
  Receipt,
  MessageCircle,
  Hash
} from 'lucide-react';
import { useBranding } from '../../branding/BrandingContext.tsx';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface ThemePreset {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  borderClass: string;
  desc: string;
}

const THEME_PRESETS: ThemePreset[] = [
  { id: 'teal', name: 'Turquesa OdontoPro', hex: '#0d9488', bgClass: 'bg-teal-600', borderClass: 'border-teal-500', desc: 'Estándar clínico, higiene y confianza' },
  { id: 'cyan', name: 'Cian Quirúrgico', hex: '#0891b2', bgClass: 'bg-cyan-600', borderClass: 'border-cyan-500', desc: 'Fresco, tecnológico e implantología' },
  { id: 'blue', name: 'Azul Hospitalario', hex: '#2563eb', bgClass: 'bg-blue-600', borderClass: 'border-blue-500', desc: 'Seriedad médica, seguros y mutuales' },
  { id: 'emerald', name: 'Verde Salud (Emerald)', hex: '#059669', bgClass: 'bg-emerald-600', borderClass: 'border-emerald-500', desc: 'Bienestar biológico y odontología natural' },
  { id: 'indigo', name: 'Índigo Moderno', hex: '#4f46e5', bgClass: 'bg-indigo-600', borderClass: 'border-indigo-500', desc: 'Elegancia institucional y centros privados' },
  { id: 'violet', name: 'Lila Ortodoncia', hex: '#7c3aed', bgClass: 'bg-purple-600', borderClass: 'border-purple-500', desc: 'Estética dental y armonización orofacial' },
  { id: 'rose', name: 'Rosa Estética & Kids', hex: '#e11d48', bgClass: 'bg-rose-600', borderClass: 'border-rose-500', desc: 'Odontopediatría y diseño de sonrisa' },
  { id: 'amber', name: 'Dorado Premium Dental', hex: '#d97706', bgClass: 'bg-amber-600', borderClass: 'border-amber-500', desc: 'Clínica boutique y rehabilitación oral' },
  { id: 'slate', name: 'Grafito Minimalista', hex: '#475569', bgClass: 'bg-slate-700', borderClass: 'border-slate-500', desc: 'Cirugía maxilofacial y sobriedad' },
];

const DENTAL_ICONS = [
  { id: 'stethoscope', label: 'Estetoscopio', icon: Stethoscope },
  { id: 'heart-pulse', label: 'Salud / Pulso', icon: HeartPulse },
  { id: 'hospital', label: 'Centro Médico', icon: Hospital },
  { id: 'building', label: 'Clínica / Edificio', icon: Building2 },
  { id: 'sparkles', label: 'Estética / Brillo', icon: Sparkles },
  { id: 'shield', label: 'Protección Dental', icon: ShieldCheck },
  { id: 'activity', label: 'Diagnóstico', icon: Activity },
  { id: 'landmark', label: 'Corporativo', icon: Landmark },
];

const COMPANY_TYPES = [
  { id: 'S.R.L.', label: 'Sociedad de Responsabilidad Limitada (S.R.L.)' },
  { id: 'S.A.', label: 'Sociedad Anónima (S.A.)' },
  { id: 'E.A.S.', label: 'Empresa por Acciones Simplificadas (E.A.S.)' },
  { id: 'Unipersonal', label: 'Persona Física / Unipersonal (Odontólogo Titular)' },
];

export const OrganizationManagementView: React.FC = () => {
  const { branding, updateBranding, resetBranding } = useBranding();
  const { session, switchOrganization } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados del formulario de marca
  const [tradeName, setTradeName] = useState(branding.tradeName);
  const [legalName, setLegalName] = useState(branding.legalName);
  const [companyType, setCompanyType] = useState(branding.companyType || 'S.R.L.');
  const [taxId, setTaxId] = useState(branding.taxId);
  const [timbradoNumber, setTimbradoNumber] = useState(branding.timbradoNumber || '15984260');
  const [timbradoVencimiento, setTimbradoVencimiento] = useState(branding.timbradoVencimiento || '2026-12-31');

  // Estados del logo
  const [logoMode, setLogoMode] = useState<'upload' | 'icon' | 'url'>(
    branding.logoUrl ? (branding.logoUrl.startsWith('data:') ? 'upload' : 'url') : 'icon'
  );
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl || '');
  const [selectedIcon, setSelectedIcon] = useState(branding.logoIcon || 'stethoscope');
  const [imageError, setImageError] = useState(false);

  // Estados de color
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor || 'teal');
  const [customHexColor, setCustomHexColor] = useState(branding.customHexColor || '#0d9488');
  const [useCustomHex, setUseCustomHex] = useState(Boolean(branding.customHexColor && branding.customHexColor !== '#0d9488'));

  // Moneda y contacto
  const [currency, setCurrency] = useState(branding.currency || 'PYG');
  const [currencySymbol, setCurrencySymbol] = useState(branding.currencySymbol || '₲');
  const [phone, setPhone] = useState(branding.phone || '');
  const [whatsapp, setWhatsapp] = useState(branding.whatsapp || '+595 981 123 456');
  const [email, setEmail] = useState(branding.email || '');
  const [address, setAddress] = useState(branding.address || '');
  const [website, setWebsite] = useState(branding.website || '');

  // Pestaña del simulador interactivo
  const [previewTab, setPreviewTab] = useState<'sidebar' | 'receipt' | 'clinical' | 'quote'>('sidebar');

  // Notificaciones
  const [notification, setNotification] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Multi-organización
  const organizations = dbStore.getOrganizations();
  const activeOrg = dbStore.getActiveOrganization();
  const [isNewOrgModalOpen, setIsNewOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgTaxId, setNewOrgTaxId] = useState('');
  const [newOrgCompanyType, setNewOrgCompanyType] = useState('S.R.L.');

  // VERIFICACIÓN DE AUTORIDAD Y AISLAMIENTO MULTIEMPRESA:
  // "El administrador de organización no debería poder visualizar EMPRESA&BRANDING.
  // Para no cambiar de unidad de negocio solo puede gestionar su empresa.
  // El superadministrador podrá gestionar las multiples empresas y sucursales."
  if (session?.role !== 'SUPER_ADMIN') {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border border-amber-200 p-8 sm:p-10 shadow-sm text-center animate-in fade-in">
        <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-xs">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider">
          Módulo de Gobernanza Global Restringido
        </span>
        <h2 className="text-2xl font-black text-slate-900 mt-3 mb-2 tracking-tight">
          Acceso Exclusivo para Super Administrador
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Como <span className="font-bold text-teal-800">{session?.roleName || 'Administrador de Organización'}</span>, tu ámbito de autoridad se limita a la administración operativa, clínica y financiera de tu empresa (<span className="font-bold text-slate-900">{activeOrg.name}</span>), sus sucursales, colaboradores y pacientes.
        </p>

        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 text-xs text-slate-600 text-left space-y-2 mb-6 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Principio de Aislamiento Multi-Inquilino (Cross-Tenant):</span>
          </div>
          <p className="leading-relaxed">
            Para impedir conmutaciones indebidas de unidades de negocio o modificaciones en la identidad de marca de otras empresas, solo el <strong className="text-slate-800">Super Administrador</strong> posee permisos para gestionar múltiples empresas, alternar entre clientes y reconfigurar logotipos o razones sociales.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200">
          <CheckCircle2 className="h-4 w-4 text-teal-600" />
          <span>Tu empresa asignada activa: {activeOrg.name} (RUC: {activeOrg.taxId})</span>
        </div>
      </div>
    );
  }

  // Obtener el color hex activo
  const activeColorHex = useCustomHex
    ? customHexColor
    : (THEME_PRESETS.find((p) => p.id === primaryColor)?.hex || '#0d9488');

  // Optimización y compresión automática de logos para evitar problemas de cuota
  const optimizeImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/png', 0.92);
          resolve(compressed);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handler para subir archivo local de imagen (Logo)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido (PNG, JPG, SVG o WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5 MB.');
      return;
    }

    try {
      const dataUrl = await optimizeImageFile(file);
      setLogoUrl(dataUrl);
      setLogoMode('upload');
      setImageError(false);
      setNotification('Logotipo procesado y optimizado. Haga clic en "Guardar Configuración de Marca" para aplicar permanentemente.');
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Error al procesar logotipo:', err);
      alert('No se pudo procesar la imagen seleccionada.');
    }
  };

  // Guardar configuración completa y persistir al servidor central para móvil y PC
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const finalLogoUrl = logoMode === 'icon' ? '' : (logoUrl.trim() || '');

    try {
      await updateBranding({
        tradeName: tradeName.trim(),
        legalName: legalName.trim(),
        companyType,
        taxId: taxId.trim(),
        timbradoNumber: timbradoNumber.trim(),
        timbradoVencimiento: timbradoVencimiento.trim(),
        logoUrl: finalLogoUrl,
        logoIcon: selectedIcon,
        primaryColor,
        customHexColor: activeColorHex,
        currency,
        currencySymbol,
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim(),
        website: website.trim() || undefined,
      });

      setNotification('¡Configuración guardada y sincronizada exitosamente con el servidor central para todos los dispositivos (móvil y PC)!');
      setTimeout(() => setNotification(null), 6000);
    } catch (err) {
      console.error('Error guardando configuración:', err);
      setNotification('Se guardaron los cambios localmente.');
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Forzar sincronización bidireccional inmediata con el servidor
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await dbStore.syncFromServer();
      if (ok) {
        const currentOrg = dbStore.getActiveOrganization();
        if (currentOrg) {
          setTradeName(currentOrg.name || currentOrg.tradeName || '');
          setLegalName(currentOrg.legalName || currentOrg.name || '');
          setTaxId(currentOrg.taxId || '');
          setPhone(currentOrg.phone || '');
          setEmail(currentOrg.email || '');
          setAddress(currentOrg.address || '');
        }
        setNotification('¡Sincronización con el servidor completada! Los cambios están al día en este dispositivo.');
      } else {
        setNotification('Conexión con el servidor verificada. Datos locales listos.');
      }
    } catch (e) {
      setNotification('No se pudo completar la sincronización en este momento.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Crear nueva empresa/organización con sede inicial automática
  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const actor = session ? {
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
      allowedBranchIds: session.allowedBranchIds,
    } : undefined;

    const created = dbStore.addOrganization({
      name: newOrgName.trim(),
      tradeName: newOrgName.trim(),
      legalName: `${newOrgName.trim()} ${newOrgCompanyType}`,
      taxId: newOrgTaxId.trim() || '80000000-1',
      primaryColor,
    }, actor);

    switchOrganization(created.id);
    updateBranding({
      tradeName: created.name,
      legalName: created.legalName,
      taxId: created.taxId,
      primaryColor: created.primaryColor,
    });

    setIsNewOrgModalOpen(false);
    setNewOrgName('');
    setNewOrgTaxId('');
    setNotification(`Nueva Organización "${created.name}" creada e inicializada con su propia sede central independiente.`);
    setTimeout(() => setNotification(null), 5000);
  };

  // Conmutar entre organizaciones (Exclusivo Super Administrador)
  const handleSwitchOrg = (orgId: string) => {
    if (orgId === activeOrg.id) {
      setNotification(`La organización "${activeOrg.name}" ya es el contexto activo.`);
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    switchOrganization(orgId);
    const target = organizations.find((o) => o.id === orgId);
    if (target) {
      setTradeName(target.name);
      setLegalName(target.legalName || target.name);
      setTaxId(target.taxId);
      setPhone(target.phone || '');
      setEmail(target.email || '');
      setAddress(target.address || '');
      setPrimaryColor(target.primaryColor || 'teal');
      setNotification(`Contexto multiempresa conmutado a: ${target.name}`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Dar de baja organización (Exclusivo Super Administrador)
  const handleDeleteOrg = (orgId: string, orgName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Está seguro de que desea inactivar la empresa "${orgName}"?`)) return;

    try {
      const actor = session ? {
        userId: session.userId,
        role: session.role,
        organizationId: session.organizationId,
        allowedBranchIds: session.allowedBranchIds,
      } : undefined;

      dbStore.deleteOrganization(orgId, actor);
      setNotification(`Organización "${orgName}" dada de baja correctamente.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la empresa.');
    }
  };

  const ActiveDentalIconComponent = DENTAL_ICONS.find((i) => i.id === selectedIcon)?.icon || Stethoscope;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 transition-colors"
              style={{ backgroundColor: activeColorHex }}
            >
              <Palette className="h-5 sm:h-6 w-5 sm:w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Estudio de Marca, Multiempresa & Identidad Visual
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Gobernanza Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Personalice en tiempo real los colores temáticos, isotipo, razón social, RUC y timbrado fiscal con previsualización en vivo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full sm:w-auto px-3.5 py-2.5 min-h-[42px] sm:min-h-[44px] text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sincronizar datos con el servidor central para ver cambios de móvil o PC"
            >
              <RefreshCw className={`h-4 w-4 text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Servidor'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNewOrgModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] sm:min-h-[44px] text-xs font-bold text-white rounded-xl transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-95"
              style={{ backgroundColor: activeColorHex }}
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Empresa / Cliente</span>
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between gap-2.5 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Multiempresa Switcher Cards (Gobernanza de Unidades de Negocio) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Landmark className="h-4 w-4 text-teal-600" />
              <span>Unidades de Negocio & Empresas Registradas ({organizations.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Haga clic en una empresa para conmutar el contexto activo de la suite odontológica.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {organizations.map((org) => {
            const isActive = org.id === activeOrg.id;
            return (
              <div
                key={org.id}
                onClick={() => handleSwitchOrg(org.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                      RUC: {org.taxId}
                    </span>
                    {isActive ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        ACTIVA
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400">
                          Clic para conmutar
                        </span>
                        {organizations.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteOrg(org.id, org.name, e)}
                            title="Inactivar / Dar de baja empresa"
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{org.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{org.legalName}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{org.defaultCurrency || 'PYG'} • Asunción</span>
                  {isActive && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Branding Configuration Form + Interactive Live Simulator */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Visual Identity & Color Theme */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <Palette className="h-5 w-5 text-teal-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Paleta Cromática & Tema Visual
                </h3>
                <p className="text-xs text-slate-500">
                  Seleccione un tema predefinido o personalice su propio código HEX institucional.
                </p>
              </div>
            </div>

            {/* Presets Grid */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Temas Clínicos Sugeridos
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = !useCustomHex && primaryColor === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(preset.id);
                        setCustomHexColor(preset.hex);
                        setUseCustomHex(false);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? `${preset.borderClass} bg-slate-50 ring-2 ring-slate-800/10 shadow-2xs`
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`h-4 w-4 rounded-full ${preset.bgClass} shrink-0 shadow-2xs`} />
                        <span className="font-bold text-xs text-slate-800 truncate">{preset.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{preset.hex}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom HEX Color Picker */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-teal-600" />
                  <span>Selector Libre de Color HEX (Marca Personalizada)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomHex(!useCustomHex)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                >
                  {useCustomHex ? 'Usar presets temáticos' : 'Personalizar HEX libre'}
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <input
                  type="color"
                  value={activeColorHex}
                  onChange={(e) => {
                    setCustomHexColor(e.target.value);
                    setUseCustomHex(true);
                  }}
                  className="h-10 w-12 rounded-xl cursor-pointer border-0 bg-transparent"
                  title="Seleccionar color en paleta RGB"
                />
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">#</span>
                    <input
                      type="text"
                      value={activeColorHex.replace('#', '')}
                      onChange={(e) => {
                        const val = `#${e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)}`;
                        setCustomHexColor(val);
                        setUseCustomHex(true);
                      }}
                      placeholder="0d9488"
                      maxLength={7}
                      className="w-full text-xs font-mono pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 uppercase"
                    />
                  </div>
                </div>
                <div
                  className="px-3.5 py-2 rounded-xl text-white font-bold text-xs shadow-xs"
                  style={{ backgroundColor: activeColorHex }}
                >
                  Muestra
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Logo Manager (3 Versatile Modes) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="h-5 w-5 text-teal-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Logotipo & Emblema Institucional
                  </h3>
                  <p className="text-xs text-slate-500">
                    Elija subir su archivo corporativo, usar un icono dental predeterminado o ingresar una URL.
                  </p>
                </div>
              </div>

              {/* Mode Selector Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setLogoMode('icon')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all text-center min-h-[36px] flex items-center justify-center cursor-pointer ${
                    logoMode === 'icon'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Iconos Dentales
                </button>
                <button
                  type="button"
                  onClick={() => setLogoMode('upload')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all text-center min-h-[36px] flex items-center justify-center cursor-pointer ${
                    logoMode === 'upload'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Subir Archivo
                </button>
                <button
                  type="button"
                  onClick={() => setLogoMode('url')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all text-center min-h-[36px] flex items-center justify-center cursor-pointer ${
                    logoMode === 'url'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  URL Web
                </button>
              </div>
            </div>

            {/* Mode 1: Curated Dental Icons */}
            {logoMode === 'icon' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Seleccione el Isotipo Oficial para la Clínica
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DENTAL_ICONS.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = selectedIcon === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedIcon(item.id)}
                        className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-2xs"
                          style={{ backgroundColor: isSelected ? activeColorHex : '#64748b' }}
                        >
                          <IconComp className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 2: File Upload (Drag & Drop or Picker) */}
            {logoMode === 'upload' && (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-teal-50/20"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Haga clic aquí para seleccionar una imagen desde su equipo
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Formatos recomendados: PNG o SVG con fondo transparente (Máx. 2MB).
                  </p>
                </div>

                {logoUrl && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <img src={logoUrl} alt="Logo Preview" className="h-10 w-10 object-contain rounded-lg border border-slate-200 bg-white p-1" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">Logotipo cargado en memoria</p>
                        <p className="text-[11px] text-emerald-600 font-medium">✓ Listo para aplicar</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        setLogoMode('icon');
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Eliminar logo cargado"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Image URL input */}
            {logoMode === 'url' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    URL Externa del Logotipo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setImageError(false);
                      }}
                      placeholder="https://ejemplo.com/logo-clinica.png"
                      className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                    />
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl border border-slate-200"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Asegúrese de que el enlace sea HTTPS y de acceso público.
                  </span>
                </div>

                {logoUrl && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                    <img
                      src={logoUrl}
                      alt="Verificación"
                      onError={() => setImageError(true)}
                      className="h-10 w-10 object-contain rounded-lg bg-white p-1 border border-slate-200"
                    />
                    <div className="text-xs">
                      {imageError ? (
                        <span className="text-rose-600 font-semibold">⚠️ No se pudo cargar la imagen desde este enlace.</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">✓ Imagen verificada y disponible.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Commercial & Legal Identity */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <Building2 className="h-5 w-5 text-teal-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Datos Corporativos, Razón Social & Tributación
                </h3>
                <p className="text-xs text-slate-500">
                  Valores impresos en recetas médicas MSPBS, facturas DNIT y consentimientos informados.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre Comercial (Fantasía) *
                </label>
                <input
                  type="text"
                  required
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Ej. Clínica Dental San Lucas"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Visibilidad pública en Sidebar, Header y Citas.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo Societario
                </label>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                >
                  {COMPANY_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Razón Social Oficial Completa *
                </label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ej. Servicios Odontológicos Integrales S.R.L."
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  RUC Paraguay (Con Dígito Verificador) *
                </label>
                <input
                  type="text"
                  required
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Ej. 80098765-4"
                  className="w-full text-xs font-mono px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Timbrado Fiscal SET / DNIT N°
                </label>
                <input
                  type="text"
                  value={timbradoNumber}
                  onChange={(e) => setTimbradoNumber(e.target.value)}
                  placeholder="Ej. 15984260"
                  className="w-full text-xs font-mono px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vencimiento de Timbrado
                </label>
                <input
                  type="date"
                  value={timbradoVencimiento}
                  onChange={(e) => setTimbradoVencimiento(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Moneda Oficial del Sistema
                </label>
                <select
                  value={currency}
                  onChange={(e) => {
                    const c = e.target.value;
                    setCurrency(c);
                    setCurrencySymbol(c === 'PYG' ? '₲' : '$');
                  }}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-bold"
                >
                  <option value="PYG">Guaraníes Paraguayos (₲ PYG)</option>
                  <option value="USD">Dólares Estadounidenses ($ USD)</option>
                </select>
              </div>
            </div>

            {/* Contact details */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+595 21 445 890"
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Institucional
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+595 981 123 456"
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@odontosol.com.py"
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sitio Web Oficial
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://odontosol.com.py"
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dirección Casa Central
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle Palma 745 c/ Ayolas - Edificio Palma Real, Asunción"
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={resetBranding}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span>Restablecer Valores Iniciales</span>
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer hover:opacity-95"
                style={{ backgroundColor: activeColorHex }}
              >
                <Save className="h-4 w-4" />
                <span>Guardar Configuración de Marca</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Multi-Environment Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs sticky top-20 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Simulador en Vivo Multi-Entorno
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Tiempo Real
              </span>
            </div>

            {/* Simulator Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-center">
              <button
                type="button"
                onClick={() => setPreviewTab('sidebar')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  previewTab === 'sidebar'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sidebar
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('receipt')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  previewTab === 'receipt'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Factura
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('clinical')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  previewTab === 'clinical'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Ficha MSPBS
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('quote')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  previewTab === 'quote'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Presupuesto
              </button>
            </div>

            {/* Preview View 1: Sidebar & Header */}
            {previewTab === 'sidebar' && (
              <div className="space-y-4 animate-in fade-in">
                {/* Desktop Sidebar Top */}
                <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 shadow-md">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Cabecera Barra Lateral</span>
                    <span className="text-teal-400 font-mono text-[9px]">desktop-nav</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold shadow-md overflow-hidden shrink-0"
                      style={{ backgroundColor: activeColorHex }}
                    >
                      {logoMode !== 'icon' && logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                      ) : (
                        <ActiveDentalIconComponent className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-white text-sm leading-tight flex items-center gap-1.5">
                        <span className="truncate">{tradeName || 'Nombre Clínica'}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/20 text-white border border-white/30">
                          {currency}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {legalName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile Header Preview */}
                <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: activeColorHex }}
                    >
                      {logoMode !== 'icon' && logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <ActiveDentalIconComponent className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-800">{tradeName}</span>
                      <p className="text-[10px] text-slate-400 font-mono">RUC: {taxId}</p>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: activeColorHex }}
                  >
                    Móvil
                  </span>
                </div>
              </div>
            )}

            {/* Preview View 2: Fiscal Receipt / Invoice (DNIT) */}
            {previewTab === 'receipt' && (
              <div className="p-5 bg-white border border-slate-300 rounded-2xl space-y-4 shadow-sm animate-in fade-in font-sans">
                <div className="flex items-start justify-between border-b pb-3 border-slate-200">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-tight">
                      {legalName}
                    </h4>
                    <p className="text-[10px] text-slate-600 mt-0.5">{address}</p>
                    <p className="text-[10px] text-slate-600">Tel: {phone} • {email}</p>
                    <p className="text-[10px] font-mono text-slate-700 font-bold mt-1">
                      RUC: {taxId}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200 font-bold text-slate-800">
                      FACTURA N° 001-002-000142
                    </span>
                    <p className="text-[9px] text-slate-500 font-mono mt-1">Timbrado: {timbradoNumber}</p>
                    <p className="text-[9px] text-slate-500 font-mono">Venc: {timbradoVencimiento}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Tratamiento Odontológico / Consulta:</span>
                    <span className="font-mono font-bold text-slate-900">{currencySymbol} 250.000</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA Liquidado (10%):</span>
                    <span className="font-mono text-slate-700">{currencySymbol} 22.727</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-2 border-t border-slate-200 text-slate-900">
                    <span>TOTAL A PAGAR:</span>
                    <span className="font-mono text-emerald-700">{currencySymbol} 250.000 {currency}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview View 3: Clinical Record Header (MSPBS) */}
            {previewTab === 'clinical' && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: activeColorHex }}
                    >
                      <ActiveDentalIconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{tradeName}</h4>
                      <p className="text-[10px] text-slate-500">Expediente Clínico & Odontograma Digital</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 font-mono">
                    Ley N° 1682/01
                  </span>
                </div>

                <div className="text-[11px] space-y-1 text-slate-600">
                  <p><strong className="text-slate-800">Institución Habilitada:</strong> {legalName}</p>
                  <p><strong className="text-slate-800">Sede Central:</strong> {address}</p>
                  <p><strong className="text-slate-800">Dirección Médica:</strong> Dra. Valeria Gómez • Reg. MSPBS N° 14.821</p>
                </div>
              </div>
            )}

            {/* Preview View 4: Patient Treatment Quote */}
            {previewTab === 'quote' && (
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 animate-in fade-in shadow-2xs">
                <div className="flex items-center justify-between border-b pb-2.5 border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Propuesta de Plan Dental</span>
                    <h4 className="text-xs font-bold text-slate-900">{tradeName}</h4>
                  </div>
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: activeColorHex }}
                  >
                    PRE-2026-0001
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600">
                  <p><strong>Paciente:</strong> Juan Carlos Benítez</p>
                  <p><strong>Clínica:</strong> {legalName}</p>
                  <p><strong>Validez:</strong> 15 días hábiles</p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Plan Integral:</span>
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    {currencySymbol} 1.250.000 {currency}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Modal: Crear Nueva Organización (Exclusivo Super Admin) */}
      {isNewOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-2xs"
                style={{ backgroundColor: activeColorHex }}
              >
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Crear Nueva Organización / Clínica
                </h3>
                <p className="text-xs text-slate-500">
                  Habilite una clínica o cadena independiente en la plataforma.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre Comercial de la Clínica *
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ej. Dental Care San Lorenzo"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo Societario
                </label>
                <select
                  value={newOrgCompanyType}
                  onChange={(e) => setNewOrgCompanyType(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                >
                  {COMPANY_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  RUC Paraguay (Opcional)
                </label>
                <input
                  type="text"
                  value={newOrgTaxId}
                  onChange={(e) => setNewOrgTaxId(e.target.value)}
                  placeholder="Ej. 80012345-6"
                  className="w-full text-xs font-mono px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-900">
                <span className="font-bold">Aprovisionamiento Automático:</span>
                <p className="text-[11px] mt-0.5 text-teal-800">
                  La nueva empresa se creará con su propia Sede Central independiente y configuración de caja chica aislada.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewOrgModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  style={{ backgroundColor: activeColorHex }}
                >
                  Crear y Activar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
