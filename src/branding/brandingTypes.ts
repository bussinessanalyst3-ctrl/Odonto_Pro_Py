export interface OrganizationBranding {
  tradeName: string;         // Nombre comercial público (ej. "OdontoPro Dental")
  legalName: string;         // Razón Social (ej. "OdontoSol S.R.L.")
  taxId: string;             // RUC Paraguay (ej. "80098765-4")
  logoUrl?: string;          // URL del logo institucional o data-URL cargada
  logoIcon?: string;         // Identificador del icono dental prediseñado
  primaryColor: string;      // Color temático primario (teal, cyan, blue, emerald, indigo, violet, rose, amber, slate)
  customHexColor?: string;   // Código HEX personalizado libre (ej. "#0d9488")
  companyType?: string;      // Tipo societario (S.R.L., S.A., E.A.S., Unipersonal)
  timbradoNumber?: string;   // N° de Timbrado Fiscal legal SET/DNIT
  timbradoVencimiento?: string; // Fecha vencimiento timbrado
  currency: string;          // Código de moneda (PYG, USD, etc.)
  currencySymbol: string;    // Símbolo (₲, $, etc.)
  countryCode: string;       // Código país ISO (PRY)
  timezone: string;          // Huso horario (America/Asuncion)
  phone: string;             // Teléfono central
  whatsapp?: string;         // WhatsApp de atención
  email: string;             // Email corporativo
  address: string;           // Dirección central
  website?: string;          // Sitio web institucional
}

export const DEFAULT_BRANDING: OrganizationBranding = {
  tradeName: 'OdontoPro Paraguay',
  legalName: 'OdontoSol Servicios Odontológicos Integrales S.R.L.',
  taxId: '80098765-4',
  companyType: 'S.R.L.',
  primaryColor: 'teal',
  customHexColor: '#0d9488',
  logoIcon: 'stethoscope',
  timbradoNumber: '15984260',
  timbradoVencimiento: '2026-12-31',
  currency: 'PYG',
  currencySymbol: '₲',
  countryCode: 'PRY',
  timezone: 'America/Asuncion',
  phone: '+595 21 445 890',
  whatsapp: '+595 981 123 456',
  email: 'contacto@odontosol.com.py',
  address: 'Calle Palma 745 c/ Ayolas - Edificio Palma Real, Asunción',
  website: 'https://odontosol.com.py',
};
