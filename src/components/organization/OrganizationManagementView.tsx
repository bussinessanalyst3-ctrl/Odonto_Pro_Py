import React, { useState } from 'react';
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
  Landmark,
  Image as ImageIcon,
  DollarSign,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { useBranding } from '../../branding/BrandingContext.tsx';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';

const THEME_COLORS = [
  { id: 'teal', name: 'Turquesa Clínico (Teal)', class: 'bg-teal-600', ring: 'ring-teal-500' },
  { id: 'blue', name: 'Azul Hospitalario', class: 'bg-blue-600', ring: 'ring-blue-500' },
  { id: 'indigo', name: 'Índigo Moderno', class: 'bg-indigo-600', ring: 'ring-indigo-500' },
  { id: 'emerald', name: 'Verde Salud (Emerald)', class: 'bg-emerald-600', ring: 'ring-emerald-500' },
  { id: 'violet', name: 'Violeta Especializado', class: 'bg-purple-600', ring: 'ring-purple-500' },
  { id: 'cyan', name: 'Cian Dental', class: 'bg-cyan-600', ring: 'ring-cyan-500' },
];

export const OrganizationManagementView: React.FC = () => {
  const { branding, updateBranding, resetBranding } = useBranding();
  const { session } = useAuth();

  const [tradeName, setTradeName] = useState(branding.tradeName);
  const [legalName, setLegalName] = useState(branding.legalName);
  const [taxId, setTaxId] = useState(branding.taxId);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor || 'teal');
  const [currency, setCurrency] = useState(branding.currency || 'PYG');
  const [currencySymbol, setCurrencySymbol] = useState(branding.currencySymbol || '₲');
  const [phone, setPhone] = useState(branding.phone || '');
  const [email, setEmail] = useState(branding.email || '');
  const [address, setAddress] = useState(branding.address || '');
  const [website, setWebsite] = useState(branding.website || '');
  const [notification, setNotification] = useState<string | null>(null);

  // Multi-organización
  const organizations = dbStore.getOrganizations();
  const activeOrg = dbStore.getActiveOrganization();
  const [isNewOrgModalOpen, setIsNewOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgTaxId, setNewOrgTaxId] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateBranding({
      tradeName,
      legalName,
      taxId,
      logoUrl: logoUrl.trim() || undefined,
      primaryColor,
      currency,
      currencySymbol,
      phone,
      email,
      address,
      website: website.trim() || undefined,
    });

    setNotification('¡Configuración de Organización y Branding actualizada exitosamente en toda la plataforma!');
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const created = dbStore.addOrganization({
      name: newOrgName.trim(),
      tradeName: newOrgName.trim(),
      legalName: `${newOrgName.trim()} S.R.L.`,
      taxId: newOrgTaxId.trim() || '80000000-1',
      primaryColor,
    });

    dbStore.switchOrganization(created.id);
    updateBranding({
      tradeName: created.name,
      legalName: created.legalName,
      taxId: created.taxId,
    });

    setIsNewOrgModalOpen(false);
    setNewOrgName('');
    setNewOrgTaxId('');
    setNotification(`Nueva Organización "${created.name}" creada y seleccionada.`);
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSwitchOrg = (orgId: string) => {
    dbStore.switchOrganization(orgId);
    const target = organizations.find((o) => o.id === orgId);
    if (target) {
      setTradeName(target.name);
      setLegalName(target.legalName || target.name);
      setTaxId(target.taxId);
      updateBranding({
        tradeName: target.name,
        legalName: target.legalName || target.name,
        taxId: target.taxId,
      });
      setNotification(`Cambio a la organización: ${target.name}`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Organización, Multiempresa & Marca Blanca
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Personalización Centralizada
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure el nombre comercial, logotipo, razón social, RUC, paleta y moneda sin modificar código.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewOrgModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Empresa / Cliente</span>
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Multi-tenant Switcher Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Landmark className="h-4 w-4 text-teal-600" />
              <span>Clientes / Empresas Registradas ({organizations.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Seleccione la organización sobre la cual operan los módulos clínicos y sucursales.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {organizations.map((org) => {
            const isActive = org.id === activeOrg.id;
            return (
              <div
                key={org.id}
                onClick={() => handleSwitchOrg(org.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                      RUC: {org.taxId}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                        ACTIVA
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{org.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-1">{org.legalName}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{org.defaultCurrency || 'PYG'} • {org.timezone || 'America/Asuncion'}</span>
                  {isActive && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Branding Configuration Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Commercial & Legal Identity */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <Palette className="h-5 w-5 text-teal-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Identidad Visual & Comercial
              </h3>
              <p className="text-xs text-slate-500">
                Cambie el nombre de la clínica (ej. de "OdontoPro" a "Clínica Dental XYZ").
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nombre Comercial (Marca Pública) *
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
                Se mostrará en el Sidebar, Header, Login y Títulos principales.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Razón Social Oficial *
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Ej. Servicios Odontológicos Integrales S.R.L."
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Para facturas fiscales, consentimientos y fichas MSPBS.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                RUC / Identificador Tributario *
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
                URL del Logo Institucional (Opcional)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://ejemplo.com/logo.png"
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Theme Color Selector */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Color Primario de la Marca
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {THEME_COLORS.map((col) => {
                const isSelected = primaryColor === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setPrimaryColor(col.id)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-slate-800 bg-slate-50 ring-2 ring-slate-800/10'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full ${col.class} shrink-0`} />
                    <span className="truncate">{col.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact Details */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Teléfono Central
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
                Email Institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@clinica.com.py"
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
                placeholder="Calle Palma 745 c/ Ayolas, Asunción"
                className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={resetBranding}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restablecer Valores Iniciales</span>
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Guardar Configuración de Marca</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Whitelabel Preview */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>Vista Previa en Tiempo Real</span>
            </h3>

            {/* Sidebar Mock Header */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Encabezado de Barra Lateral
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-7 w-7 object-contain rounded-lg" />
                  ) : (
                    tradeName.charAt(0) || 'C'
                  )}
                </div>
                <div>
                  <div className="font-extrabold text-white text-sm leading-tight flex items-center gap-1.5">
                    <span>{tradeName || 'Nombre de la Clínica'}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                      {currency}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-[170px]">
                    {legalName}
                  </p>
                </div>
              </div>
            </div>

            {/* Document Receipt Mock Header */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Encabezado de Presupuesto / Recibo
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">{legalName}</div>
                <div className="text-slate-500 font-mono text-[11px]">RUC: {taxId}</div>
                <div className="text-slate-500 text-[11px]">{address}</div>
                <div className="text-slate-500 text-[11px]">Moneda: {currency} ({currencySymbol})</div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Modal: Nueva Organización */}
      {isNewOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Crear Nueva Organización / Cliente
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Permite habilitar una empresa o red odontológica independiente en la misma plataforma.
            </p>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre Comercial de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ej. Dental Care Asunción"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
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
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
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
