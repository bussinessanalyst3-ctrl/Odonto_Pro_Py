import React, { createContext, useContext, useState, useEffect } from 'react';
import { OrganizationBranding, DEFAULT_BRANDING } from './brandingTypes.ts';
import { dbStore } from '../db/inMemoryStore.ts';
import { getApiBaseUrl } from '../config/apiConfig.ts';

interface BrandingContextType {
  branding: OrganizationBranding;
  updateBranding: (updates: Partial<OrganizationBranding>) => Promise<void>;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const THEME_HEX_MAP: Record<string, string> = {
  teal: '#0d9488',
  cyan: '#0891b2',
  blue: '#2563eb',
  emerald: '#059669',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  rose: '#e11d48',
  amber: '#d97706',
  slate: '#475569',
};

const getBrandingForOrg = (org: any): OrganizationBranding => {
  if (!org) return DEFAULT_BRANDING;
  return {
    tradeName: org.name || org.tradeName || DEFAULT_BRANDING.tradeName,
    legalName: org.legalName || org.name || '',
    taxId: org.taxId || DEFAULT_BRANDING.taxId,
    primaryColor: org.primaryColor || DEFAULT_BRANDING.primaryColor,
    customHexColor: org.customHexColor || THEME_HEX_MAP[org.primaryColor || 'teal'] || DEFAULT_BRANDING.customHexColor,
    logoUrl: org.logoUrl,
    logoIcon: org.logoIcon || DEFAULT_BRANDING.logoIcon,
    companyType: org.companyType || DEFAULT_BRANDING.companyType,
    timbradoNumber: org.timbradoNumber ?? '',
    timbradoVencimiento: org.timbradoVencimiento ?? '',
    currency: org.defaultCurrency || DEFAULT_BRANDING.currency,
    currencySymbol: org.currencySymbol || DEFAULT_BRANDING.currencySymbol,
    countryCode: org.countryCode || DEFAULT_BRANDING.countryCode,
    timezone: org.timezone || DEFAULT_BRANDING.timezone,
    phone: org.phone ?? '',
    whatsapp: org.whatsapp ?? '',
    email: org.email ?? '',
    address: org.address ?? '',
    website: org.website ?? '',
  };
};

export const BRANDING_STORAGE_KEY = 'odontopro_active_branding_v2';

const isLegacyDemoBranding = (b: any): boolean => {
  if (!b || typeof b !== 'object') return false;
  const fields = [b.tradeName, b.legalName, b.email, b.website, b.taxId]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return fields.includes('odontosol') || b.taxId === '80098765-4';
};

const getInitialBranding = (): OrganizationBranding => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(BRANDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.tradeName || parsed.legalName)) {
          if (isLegacyDemoBranding(parsed)) {
            localStorage.removeItem(BRANDING_STORAGE_KEY);
          } else {
            return parsed;
          }
        }
      }
    }
  } catch (e) {}
  const org = dbStore.getActiveOrganization();
  return getBrandingForOrg(org);
};

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<OrganizationBranding>(getInitialBranding);

  // Efecto para sincronizar variables CSS en el DOM y persistir en almacenamiento local
  useEffect(() => {
    const hex = branding.customHexColor || THEME_HEX_MAP[branding.primaryColor] || '#0d9488';
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--brand-color', hex);
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
      }
    } catch (e) {}
  }, [branding]);

  // Escuchar cambios de dbStore y sincronizar fielmente con la organización activa
  useEffect(() => {
    const unsub = dbStore.subscribe(() => {
      const org = dbStore.getActiveOrganization();
      if (org) {
        const nextFromOrg = getBrandingForOrg(org);
        setBranding(nextFromOrg);
      }
    });
    return unsub;
  }, []);

  const updateBranding = async (updates: Partial<OrganizationBranding>) => {
    const activeOrg = dbStore.getActiveOrganization();
    const next: OrganizationBranding = { ...branding, ...updates };
    setBranding(next);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(next));
      }
    } catch (e) {}

    const orgPayload = {
      name: next.tradeName,
      tradeName: next.tradeName,
      legalName: next.legalName,
      taxId: next.taxId,
      phone: next.phone,
      email: next.email,
      address: next.address,
      website: next.website,
      logoUrl: next.logoUrl !== undefined ? next.logoUrl : '',
      logoIcon: next.logoIcon || 'shield',
      primaryColor: next.primaryColor || 'teal',
      customHexColor: next.customHexColor,
      companyType: next.companyType,
      timbradoNumber: next.timbradoNumber,
      timbradoVencimiento: next.timbradoVencimiento,
      whatsapp: next.whatsapp,
    };

    // Actualizar fielmente en el dbStore para coherencia en facturación, reportes y auditoría
    dbStore.updateOrganization(orgPayload, activeOrg.id);

    // Persistir directamente contra el Backend (REST) y confirmar persistencia real cuando hay sesión activa
    const hasBackendSession = Boolean(dbStore.getBackendActorContext());
    if (typeof fetch !== 'undefined' && hasBackendSession) {
      const baseUrl = getApiBaseUrl();
      const token = dbStore.getSessionToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && !token.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${baseUrl}/api/organizations/${activeOrg.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(orgPayload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || 'No se pudo guardar la configuración de la clínica en el servidor.');
      }
      await dbStore.flushPendingSyncStrict();
    }
  };

  const resetBranding = () => {
    setBranding(DEFAULT_BRANDING);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(BRANDING_STORAGE_KEY);
      }
    } catch (e) {}

    dbStore.updateOrganization({
      name: DEFAULT_BRANDING.tradeName,
      tradeName: DEFAULT_BRANDING.tradeName,
      legalName: DEFAULT_BRANDING.legalName,
      taxId: DEFAULT_BRANDING.taxId,
      phone: DEFAULT_BRANDING.phone,
      email: DEFAULT_BRANDING.email,
      address: DEFAULT_BRANDING.address,
      website: DEFAULT_BRANDING.website,
      primaryColor: DEFAULT_BRANDING.primaryColor,
      customHexColor: DEFAULT_BRANDING.customHexColor,
      logoUrl: '',
      logoIcon: DEFAULT_BRANDING.logoIcon,
      companyType: DEFAULT_BRANDING.companyType,
      timbradoNumber: DEFAULT_BRANDING.timbradoNumber,
      timbradoVencimiento: DEFAULT_BRANDING.timbradoVencimiento,
      whatsapp: DEFAULT_BRANDING.whatsapp,
    });
  };

  return (
    <BrandingContext.Provider value={{ branding, updateBranding, resetBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding debe usarse dentro de un BrandingProvider');
  }
  return context;
};
