import React, { createContext, useContext, useState, useEffect } from 'react';
import { OrganizationBranding, DEFAULT_BRANDING } from './brandingTypes.ts';
import { dbStore } from '../db/inMemoryStore.ts';

interface BrandingContextType {
  branding: OrganizationBranding;
  updateBranding: (updates: Partial<OrganizationBranding>) => void;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const BRANDING_STORAGE_KEY = 'odontopro_org_branding';

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<OrganizationBranding>(() => {
    // 1. Intentar cargar de localStorage
    try {
      const stored = localStorage.getItem(BRANDING_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_BRANDING, ...JSON.parse(stored) };
      }
    } catch (e) {}

    // 2. Cargar de dbStore
    const org = dbStore.getActiveOrganization();
    if (org) {
      return {
        tradeName: org.name || DEFAULT_BRANDING.tradeName,
        legalName: org.legalName || DEFAULT_BRANDING.legalName,
        taxId: org.taxId || DEFAULT_BRANDING.taxId,
        primaryColor: (org as any).primaryColor || DEFAULT_BRANDING.primaryColor,
        currency: org.defaultCurrency || DEFAULT_BRANDING.currency,
        currencySymbol: (org as any).currencySymbol || DEFAULT_BRANDING.currencySymbol,
        countryCode: org.countryCode || DEFAULT_BRANDING.countryCode,
        timezone: org.timezone || DEFAULT_BRANDING.timezone,
        phone: (org as any).phone || DEFAULT_BRANDING.phone,
        email: (org as any).email || DEFAULT_BRANDING.email,
        address: (org as any).address || DEFAULT_BRANDING.address,
        logoUrl: (org as any).logoUrl,
        website: (org as any).website,
      };
    }

    return DEFAULT_BRANDING;
  });

  // Escuchar cambios de dbStore
  useEffect(() => {
    const unsub = dbStore.subscribe(() => {
      const org = dbStore.getActiveOrganization();
      if (org) {
        setBranding((prev) => ({
          ...prev,
          tradeName: org.name || prev.tradeName,
          legalName: org.legalName || prev.legalName,
          taxId: org.taxId || prev.taxId,
          currency: org.defaultCurrency || prev.currency,
          countryCode: org.countryCode || prev.countryCode,
          timezone: org.timezone || prev.timezone,
        }));
      }
    });
    return unsub;
  }, []);

  const updateBranding = (updates: Partial<OrganizationBranding>) => {
    const next = { ...branding, ...updates };
    setBranding(next);

    try {
      localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {}

    // Actualizar también en el dbStore para coherencia con reportes y auditoría
    dbStore.updateOrganization({
      name: next.tradeName,
      legalName: next.legalName,
      taxId: next.taxId,
      phone: next.phone,
      email: next.email,
      address: next.address,
      ...(next.logoUrl ? { logoUrl: next.logoUrl } : {}),
      ...(next.primaryColor ? { primaryColor: next.primaryColor } : {}),
    });
  };

  const resetBranding = () => {
    setBranding(DEFAULT_BRANDING);
    try {
      localStorage.removeItem(BRANDING_STORAGE_KEY);
    } catch (e) {}
    dbStore.updateOrganization({
      name: DEFAULT_BRANDING.tradeName,
      legalName: DEFAULT_BRANDING.legalName,
      taxId: DEFAULT_BRANDING.taxId,
      phone: DEFAULT_BRANDING.phone,
      email: DEFAULT_BRANDING.email,
      address: DEFAULT_BRANDING.address,
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
