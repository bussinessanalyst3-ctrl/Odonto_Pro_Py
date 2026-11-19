import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeltaToRelationalDb,
  COLLECTION_CHILD_TO_PARENT_ORDER,
  COLLECTION_PARENT_TO_CHILD_ORDER,
  ensureRelationalSchema,
  getRecordKey,
} from '../src/db/pgRepository.ts';
import { generateInitialSeedData } from '../src/db/seeds/initial-seed.ts';
import { filterStateForTenant } from '../server/stateStore.ts';
import { canManageRole, isSuperAdminRole } from '../src/security/rbacHierarchy.ts';

test('COLLECTION_PARENT_TO_CHILD_ORDER cubre las 32 colecciones y claves determinísticas', () => {
  assert.equal(COLLECTION_PARENT_TO_CHILD_ORDER.length, 32);
  assert.deepEqual(
    [...COLLECTION_CHILD_TO_PARENT_ORDER],
    [...COLLECTION_PARENT_TO_CHILD_ORDER].reverse()
  );

  assert.equal(getRecordKey('branchSettings', { branchId: 'b1' }), 'b1');
  assert.equal(getRecordKey('userBranches', { userId: 'u1', branchId: 'b1' }), 'u1::b1');
  assert.equal(getRecordKey('branchServices', { branchId: 'b1', serviceId: 's1' }), 'b1::s1');
  assert.equal(getRecordKey('patientBranches', { patientId: 'p1', branchId: 'b1' }), 'p1::b1');
  assert.equal(getRecordKey('patients', { id: 'pat-1' }), 'pat-1');
});

test('applyDeltaToRelationalDb ejecuta transacciones en orden padre->hijo para upserts y hijo->padre para deletes', async () => {
  const executedSql: Array<{ text: string; params?: any[] }> = [];
  const seed = generateInitialSeedData();
  const envelope = { data: seed, organizationsList: [seed.organization] };

  const mockClient = {
    async query(sql: string, params?: any[]) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      executedSql.push({ text: normalized, params });
      if (normalized.includes('FROM information_schema.columns')) {
        return { rows: [{ column_name: 'last_name' }] };
      }
      return { rows: [] };
    },
    release() {},
  };

  const mockPool = {
    async connect() {
      return mockClient;
    },
    async query(sql: string, params?: any[]) {
      return mockClient.query(sql, params);
    },
  } as any;

  await ensureRelationalSchema(mockPool);

  // Confirmar que ensureRelationalSchema relajó CHECK constraints heredados de 202611180001
  assert.ok(
    executedSql.some((q) => q.text.includes('DROP CONSTRAINT IF EXISTS payroll_settlement_items_item_type_check')),
    'Debe eliminar restriction CHECK incompatible en payroll_settlement_items'
  );
  assert.ok(
    executedSql.some((q) => q.text.includes('DROP CONSTRAINT IF EXISTS commission_rules_calculation_mode_check')),
    'Debe eliminar restriction CHECK incompatible en commission_rules'
  );

  executedSql.length = 0;

  await applyDeltaToRelationalDb(
    mockPool,
    {
      upserts: {
        payrollSettlementItems: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            settlementId: seed.payrollSettlements[0].id,
            itemType: 'SALARIO_BASE',
            concept: 'Salario base',
            sign: 'CREDIT',
            amount: 3000000,
          },
        ],
        branches: [seed.branches[0]],
      },
      deletes: {
        branches: ['22222222-2222-4222-8222-222222222222'],
        payrollSettlementItems: ['33333333-3333-4333-8333-333333333333'],
      },
    },
    envelope,
    2
  );

  const txStatements = executedSql.map((q) => q.text);
  assert.equal(txStatements[0], 'BEGIN');
  assert.equal(txStatements[txStatements.length - 1], 'COMMIT');

  // Upsert branches (padre) debe ejecutarse ANTES que upsert payroll_settlement_items (hijo)
  const upsertBranchIdx = txStatements.findIndex((s) => s.startsWith('INSERT INTO branches'));
  const upsertItemIdx = txStatements.findIndex((s) => s.startsWith('INSERT INTO payroll_settlement_items'));
  assert.ok(upsertBranchIdx > 0 && upsertItemIdx > upsertBranchIdx);

  // Delete payroll_settlement_items (hijo) debe ejecutarse ANTES que delete branches (padre)
  const delItemIdx = txStatements.findIndex((s) => s.startsWith('DELETE FROM payroll_settlement_items'));
  const delBranchIdx = txStatements.findIndex((s) => s.startsWith('DELETE FROM branches'));
  assert.ok(delItemIdx > 0 && delBranchIdx > delItemIdx);
});

test('applyDeltaToRelationalDb ejecuta ROLLBACK si falla una sentencia SQL dentro de la transacción', async () => {
  const executedSql: string[] = [];
  const seed = generateInitialSeedData();
  const envelope = { data: seed, organizationsList: [seed.organization] };

  const mockPool = {
    async connect() {
      return {
        async query(sql: string) {
          const normalized = sql.replace(/\s+/g, ' ').trim();
          executedSql.push(normalized);
          if (normalized.startsWith('INSERT INTO branches')) {
            throw new Error('Simulated constraint error');
          }
          return { rows: [] };
        },
        release() {},
      };
    },
  } as any;

  await assert.rejects(
    () =>
      applyDeltaToRelationalDb(
        mockPool,
        { upserts: { branches: [seed.branches[0]] } },
        envelope,
        3
      ),
    /Simulated constraint error/
  );

  assert.ok(executedSql.includes('BEGIN'));
  assert.ok(executedSql.includes('ROLLBACK'));
  assert.ok(!executedSql.includes('COMMIT'));
});

test('RBAC jerárquico y aislamiento multi-tenant en filterStateForTenant', () => {
  assert.equal(isSuperAdminRole('SUPER_ADMIN'), true);
  assert.equal(canManageRole('ADMIN_ORGANIZACION', 'ODONTOLOGO'), true);
  assert.equal(canManageRole('ADMIN_SUCURSAL', 'ADMIN_ORGANIZACION'), false);
  assert.equal(canManageRole('RECEPCION', 'SUPER_ADMIN'), false);

  const seed = generateInitialSeedData() as any;
  const foreignOrgId = 'aaaaaaaa-0000-4000-8000-000000000099';
  seed.patients.push({
    id: 'pat-foreign-1',
    organizationId: foreignOrgId,
    primaryBranchId: 'br-foreign',
    firstName: 'Ajeno',
    lastName: 'Paciente',
    allergies: 'Secreto Org B',
  });
  seed.auditLogs.push({
    id: 'audit-foreign-1',
    organizationId: foreignOrgId,
    action: 'TEST',
    entity: 'PATIENT',
  });

  const filtered = filterStateForTenant(
    { data: seed, organizationsList: [seed.organization, { id: foreignOrgId, name: 'Org B' }] },
    {
      userId: 'u-recep',
      role: 'RECEPCION',
      organizationId: seed.organization.id,
      allowedBranchIds: [seed.branches[0].id],
    }
  );

  assert.equal(filtered.organizationsList.length, 1);
  assert.equal(filtered.organizationsList[0].id, seed.organization.id);
  assert.ok(!filtered.data.patients.some((p: any) => p.id === 'pat-foreign-1'));
  assert.equal(filtered.data.auditLogs.length, 0);
  assert.equal(filtered.data.clinicalRecords.length, 0);
  assert.equal(filtered.data.employeeSalaries.length, 0);
  assert.ok(!filtered.data.users.some((u: any) => u.roleId === 'SUPER_ADMIN'));
  assert.ok(!filtered.data.users.some((u: any) => u.passwordHash !== undefined));
});

test('syncFullStateToRelationalDb depura vínculos huérfanos (userBranches/patientBranches) antes de insertar FKs', async () => {
  const { syncFullStateToRelationalDb } = await import('../src/db/pgRepository.ts');
  const seed = generateInitialSeedData() as any;
  const orphanUserId = '99999999-9999-4999-8999-999999999999';
  seed.userBranches.push({
    userId: orphanUserId,
    branchId: seed.branches[0].id,
    isDefault: false,
  });

  const userBranchInserts: Array<any[]> = [];
  const mockClient = {
    async query(sql: string, params?: any[]) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized.includes('FROM information_schema.columns')) {
        return { rows: [{ column_name: 'last_name' }] };
      }
      if (normalized.startsWith('INSERT INTO user_branches')) {
        userBranchInserts.push(params || []);
      }
      return { rows: [] };
    },
    release() {},
  };

  const mockPool = {
    async connect() {
      return mockClient;
    },
    async query(sql: string, params?: any[]) {
      return mockClient.query(sql, params);
    },
  } as any;

  await syncFullStateToRelationalDb(
    mockPool,
    { data: seed, organizationsList: [seed.organization] },
    1
  );

  assert.ok(userBranchInserts.length > 0);
  assert.ok(
    !userBranchInserts.some((params) => params[0] === orphanUserId),
    'No debe intentar insertar user_branches cuyo userId no existe en users'
  );
});

