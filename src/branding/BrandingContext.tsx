import React, { createContext, useContext, useState, useEffect } from 'react';
import { OrganizationBranding, DEFAULT_BRANDING } from './brandingTypes.ts';
import { dbStore } from '../db/inMemoryStore.ts';

interface BrandingContextType {
  branding: OrganizationBranding;
  updateBranding: (updates: Partial<OrganizationBranding>) => void;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const getBrandingForOrg = (org: any): OrganizationBranding => {
  if (!org) return DEFAULT_BRANDING;
  return {
    tradeName: org.name || org.tradeName || DEFAULT_BRANDING.tradeName,
    legalName: org.legalName || org.name || DEFAULT_BRANDING.legalName,
    taxId: org.taxId || DEFAULT_BRANDING.taxId,
    primaryColor: org.primaryColor || DEFAULT_BRANDING.primaryColor,
    currency: org.defaultCurrency || DEFAULT_BRANDING.currency,
    currencySymbol: org.currencySymbol || DEFAULT_BRANDING.currencySymbol,
    countryCode: org.countryCode || DEFAULT_BRANDING.countryCode,
    timezone: org.timezone || DEFAULT_BRANDING.timezone,
    phone: org.phone || DEFAULT_BRANDING.phone,
    email: org.email || DEFAULT_BRANDING.email,
    address: org.address || DEFAULT_BRANDING.address,
    logoUrl: org.logoUrl,
    website: org.website,
  };
};

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<OrganizationBranding>(() => {
    const org = dbStore.getActiveOrganization();
    return getBrandingForOrg(org);
  });

  // Escuchar cambios de dbStore y sincronizar fielmente con la organización activa
  useEffect(() => {
    const unsub = dbStore.subscribe(() => {
      const org = dbStore.getActiveOrganization();
      if (org) {
        setBranding(getBrandingForOrg(org));
      }
    });
    return unsub;
  }, []);

  const updateBranding = (updates: Partial<OrganizationBranding>) => {
    const next = { ...branding, ...updates };
    setBranding(next);

    // Actualizar también en el dbStore para coherencia con reportes y auditoría
    dbStore.updateOrganization({
      name: next.tradeName,
      legalName: next.legalName,
      taxId: next.taxId,
      phone: next.phone,
      email: next.email,
      address: next.address,
      ...(next.logoUrl !== undefined ? { logoUrl: next.logoUrl } : {}),
      ...(next.primaryColor ? { primaryColor: next.primaryColor } : {}),
    });
  };

  const resetBranding = () => {
    setBranding(DEFAULT_BRANDING);
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
