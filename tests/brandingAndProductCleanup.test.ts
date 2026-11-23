import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_NAME,
  ENABLE_DEV_TOOLS,
  resolveOrganizationLegalName,
  formatDocumentTitle,
  getTodayAsuncionISO,
} from '../src/config/appBrand.ts';
import { dbStore } from '../src/db/inMemoryStore.ts';

test('Marca fija ODONTOPRO y resolución de razón social multi-tenant', () => {
  assert.equal(APP_NAME, 'ODONTOPRO');
  assert.equal(ENABLE_DEV_TOOLS, false);

  // Sin empresa identificada: solo ODONTOPRO, sin subtítulo ni placeholders
  assert.equal(resolveOrganizationLegalName(null), '');
  assert.equal(resolveOrganizationLegalName({ legalName: '', name: '' }), '');
  assert.equal(formatDocumentTitle(''), 'ODONTOPRO');
  assert.equal(formatDocumentTitle(null), 'ODONTOPRO');

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
    'ODONTOPRO | Servicios Odontológicos del Este S.R.L.'
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

  // Verificar que RoadmapViewer y la pestaña 'roadmap' estén ausentes de la navegación principal
  const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.equal(appSource.includes('RoadmapViewer'), false);
  assert.equal(appSource.includes("case 'roadmap':"), false);
});
