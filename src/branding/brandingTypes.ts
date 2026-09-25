export interface OrganizationBranding {
  tradeName: string;         // Nombre comercial público (ej. "OdontoPro Dental")
  legalName: string;         // Razón Social (ej. "OdontoSol S.R.L.")
  taxId: string;             // RUC Paraguay (ej. "80098765-4")
  logoUrl?: string;          // URL del logo institucional
  primaryColor: string;      // Color temático primario (teal, indigo, blue, emerald, purple)
  currency: string;          // Código de moneda (PYG, USD, etc.)
  currencySymbol: string;    // Símbolo (₲, $, etc.)
  countryCode: string;       // Código país ISO (PRY)
  timezone: string;          // Huso horario (America/Asuncion)
  phone: string;             // Teléfono central
  email: string;             // Email corporativo
  address: string;           // Dirección central
  website?: string;          // Sitio web institucional
}

export const DEFAULT_BRANDING: OrganizationBranding = {
  tradeName: 'OdontoPro Paraguay',
  legalName: 'OdontoSol Servicios Odontológicos Integrales S.R.L.',
  taxId: '80098765-4',
  primaryColor: 'teal',
  currency: 'PYG',
  currencySymbol: '₲',
  countryCode: 'PRY',
  timezone: 'America/Asuncion',
  phone: '+595 21 445 890',
  email: 'contacto@odontosol.com.py',
  address: 'Calle Palma 745 c/ Ayolas - Edificio Palma Real, Asunción',
  website: 'https://odontosol.com.py',
};
