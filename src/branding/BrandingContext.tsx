import React, { createContext, useContext, useState, useEffect } from 'react';
import { OrganizationBranding, DEFAULT_BRANDING } from './brandingTypes.ts';
import { dbStore } from '../db/inMemoryStore.ts';

interface BrandingContextType {
  branding: OrganizationBranding;
  updateBranding: (updates: Partial<OrganizationBranding>) => void;
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
    legalName: org.legalName || org.name || DEFAULT_BRANDING.legalName,
    taxId: org.taxId || DEFAULT_BRANDING.taxId,
    primaryColor: org.primaryColor || DEFAULT_BRANDING.primaryColor,
    customHexColor: org.customHexColor || THEME_HEX_MAP[org.primaryColor || 'teal'] || DEFAULT_BRANDING.customHexColor,
    logoUrl: org.logoUrl,
    logoIcon: org.logoIcon || DEFAULT_BRANDING.logoIcon,
    companyType: org.companyType || DEFAULT_BRANDING.companyType,
    timbradoNumber: org.timbradoNumber || DEFAULT_BRANDING.timbradoNumber,
    timbradoVencimiento: org.timbradoVencimiento || DEFAULT_BRANDING.timbradoVencimiento,
    currency: org.defaultCurrency || DEFAULT_BRANDING.currency,
    currencySymbol: org.currencySymbol || DEFAULT_BRANDING.currencySymbol,
    countryCode: org.countryCode || DEFAULT_BRANDING.countryCode,
    timezone: org.timezone || DEFAULT_BRANDING.timezone,
    phone: org.phone || DEFAULT_BRANDING.phone,
    whatsapp: org.whatsapp || DEFAULT_BRANDING.whatsapp,
    email: org.email || DEFAULT_BRANDING.email,
    address: org.address || DEFAULT_BRANDING.address,
    website: org.website,
  };
};

export const BRANDING_STORAGE_KEY = 'odontopro_active_branding_v2';

const getInitialBranding = (): OrganizationBranding => {
  let storedBranding: Partial<OrganizationBranding> | null = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(BRANDING_STORAGE_KEY);
      if (stored) {
        storedBranding = JSON.parse(stored);
      }
    }
  } catch (e) {
    console.warn('Error leyendo branding de localStorage:', e);
  }

  const org = dbStore.getActiveOrganization();
  const orgBranding = getBrandingForOrg(org);

  if (storedBranding) {
    const merged: OrganizationBranding = {
      ...DEFAULT_BRANDING,
      ...orgBranding,
      ...storedBranding,
    };
    return merged;
  }

  return orgBranding;
};

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<OrganizationBranding>(getInitialBranding);

  // Efecto para sincronizar variables CSS en el DOM
  useEffect(() => {
    const hex = branding.customHexColor || THEME_HEX_MAP[branding.primaryColor] || '#0d9488';
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--brand-color', hex);
    }
  }, [branding.primaryColor, branding.customHexColor]);

  // Escuchar cambios de dbStore y sincronizar fielmente con la organización activa
  useEffect(() => {
    const unsub = dbStore.subscribe(() => {
      const org = dbStore.getActiveOrganization();
      if (org) {
        const nextFromOrg = getBrandingForOrg(org);
        setBranding((prev) => {
          // Si el objeto de la organización tiene datos válidos, actualizar
          const updated = {
            ...prev,
            ...nextFromOrg,
            // Mantener logoUrl o logoIcon si la organización los tiene
            logoUrl: org.logoUrl !== undefined ? org.logoUrl : prev.logoUrl,
            logoIcon: org.logoIcon || prev.logoIcon,
          };
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(updated));
            }
          } catch (e) {}
          return updated;
        });
      }
    });
    return unsub;
  }, []);

  const updateBranding = (updates: Partial<OrganizationBranding>) => {
    const next: OrganizationBranding = { ...branding, ...updates };
    setBranding(next);

    // Persistir de inmediato en localStorage para que sobreviva cierres de sesión y recargas
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(next));
      }
    } catch (e) {
      console.warn('Error al guardar branding en localStorage:', e);
    }

    // Actualizar también en el dbStore para coherencia en facturación, reportes y auditoría
    dbStore.updateOrganization({
      name: next.tradeName,
      tradeName: next.tradeName,
      legalName: next.legalName,
      taxId: next.taxId,
      phone: next.phone,
      email: next.email,
      address: next.address,
      website: next.website,
      logoUrl: next.logoUrl !== undefined ? next.logoUrl : '',
      logoIcon: next.logoIcon || 'stethoscope',
      primaryColor: next.primaryColor || 'teal',
      customHexColor: next.customHexColor,
      companyType: next.companyType,
      timbradoNumber: next.timbradoNumber,
      timbradoVencimiento: next.timbradoVencimiento,
      whatsapp: next.whatsapp,
    });
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
