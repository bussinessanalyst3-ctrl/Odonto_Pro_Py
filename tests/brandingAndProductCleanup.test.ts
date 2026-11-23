import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_NAME,
  OFFICIAL_APP_ICON_ID,
  resolveOrganizationLegalName,
  formatDocumentTitle,
  getTodayAsuncionISO,
} from '../src/config/appBrand.ts';
import { DEFAULT_BRANDING } from '../src/branding/brandingTypes.ts';
import { dbStore } from '../src/db/inMemoryStore.ts';

test('Marca fija OdontoPro y resolución de razón social multi-tenant', () => {
  assert.equal(APP_NAME, 'OdontoPro');
  assert.equal(OFFICIAL_APP_ICON_ID, 'shield');
  assert.equal(DEFAULT_BRANDING.logoIcon, 'shield');

  // Sin empresa identificada: solo OdontoPro, sin subtítulo ni placeholders
  assert.equal(resolveOrganizationLegalName(null), '');
  assert.equal(resolveOrganizationLegalName({ legalName: '', name: '' }), '');
  assert.equal(formatDocumentTitle(''), 'OdontoPro');
  assert.equal(formatDocumentTitle(null), 'OdontoPro');

  // Con empresa identificada: prioridad a legalName sobre name/tradeName
  const org = dbStore.addOrganization({
    name: 'Clínica Sonrisa Comercial',
    tradeName: 'Clínica Sonrisa Comercial',
    legalName: 'Servicios Odontológicos del Este S.R.L.',
    taxId: '80055443-2',
  });

  const resolvedLegal = resolveOrganizationLegalName(org);
  assert.equal(org.name, 'Clínica Sonrisa Comercial');
  assert.equal(org.legalName, 'Servicios Odontológicos del Este S.R.L.');
  assert.equal(resolvedLegal, 'Servicios Odontológicos del Este S.R.L.');
  assert.equal(
    formatDocumentTitle(resolvedLegal),
    'OdontoPro | Servicios Odontológicos del Este S.R.L.'
  );

  // Fecha del sistema válida YYYY-MM-DD (sin fecha fija de simulación)
  const todayIso = getTodayAsuncionISO();
  assert.match(todayIso, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(todayIso, '2026-09-21');
});

test('UI de producción no expone fases, roadmap, Vercel ni fechas de simulación', () => {
  const root = process.cwd();
  const checkedFiles = [
    'index.html',
    'src/App.tsx',
    'src/components/Header.tsx',
    'src/components/AppHeader.tsx',
    'src/components/Sidebar.tsx',
    'src/components/auth/LoginScreen.tsx',
    'src/components/appointments/AppointmentsCalendarView.tsx',
    'src/components/appointments/CreateAppointmentModal.tsx',
    'src/components/reports/ExecutiveDashboard.tsx',
    'src/components/reports/AdminFinancialReport.tsx',
    'src/components/branches/BranchManagementView.tsx',
    'src/components/clinical/ClinicalRecordsView.tsx',
    'src/components/odontogram/OdontogramView.tsx',
    'src/components/treatments/TreatmentsManagementView.tsx',
    'src/components/treatments/CreateTreatmentModal.tsx',
    'src/components/quotes/QuotesManagementView.tsx',
    'src/components/cash/CashRegisterManagementView.tsx',
    'src/components/auth/SessionInspector.tsx',
    'src/components/quotes/QuoteDetailModal.tsx',
    'src/components/cash/CashReceiptModal.tsx',
    'src/components/treatments/ClaimSheetModal.tsx',
    'src/components/patients/ComprehensivePatientModal.tsx',
  ];

  for (const relPath of checkedFiles) {
    const content = fs.readFileSync(path.join(root, relPath), 'utf8');
    assert.equal(
      /DEV & HERRAMIENTAS|17 Fases|Fecha Simulación|OdontoPro Dental Suite|OdontoPro S\.A\./i.test(content),
      false,
      `Se encontró texto prohibido en ${relPath}`
    );
  }

  // Verificar que RoadmapViewer, 'roadmap' y flags ENABLE_DEV_TOOLS estén ausentes del frontend público
  const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.equal(appSource.includes('RoadmapViewer'), false);
  assert.equal(appSource.includes("case 'roadmap':"), false);

  for (const relPath of [
    'src/config/appBrand.ts',
    'src/App.tsx',
    'src/components/Sidebar.tsx',
    'src/components/Header.tsx',
    '.env.example',
  ]) {
    const content = fs.readFileSync(path.join(root, relPath), 'utf8');
    assert.equal(content.includes('ENABLE_DEV_TOOLS'), false, `${relPath} no debe contener ENABLE_DEV_TOOLS`);
    assert.equal(content.includes('VITE_ENABLE_DEV_TOOLS'), false, `${relPath} no debe contener VITE_ENABLE_DEV_TOOLS`);
  }
});
