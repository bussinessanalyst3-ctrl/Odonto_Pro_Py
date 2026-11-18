import React from 'react';
import { X, DollarSign, Percent, FileText, CreditCard, History, UserCheck } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { EmployeeRecord, getEmployeeDisplayName } from '../../db/payrollEngine.ts';

interface EmployeeRemunerationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeRecord | null;
  onOpenSalaryModal?: (emp: EmployeeRecord) => void;
}

export const EmployeeRemunerationDrawer: React.FC<EmployeeRemunerationDrawerProps> = ({
  isOpen,
  onClose,
  employee,
  onOpenSalaryModal,
}) => {
  if (!isOpen || !employee) return null;

  const salaries = dbStore.getEmployeeSalaries(employee.id);
  const commissions = dbStore.getGeneratedCommissions({ employeeId: employee.id });
  const settlements = dbStore.getPayrollSettlements({ employeeId: employee.id });
  const payments = dbStore.getStaffPayments({ employeeId: employee.id });
  const patients = dbStore.getSnapshot().patients || [];
  const linkedUser = employee.userId ? dbStore.findUserById(employee.userId) : null;
  const branch = employee.branchId
    ? dbStore.getBranches().find((b: any) => b.id === employee.branchId)
    : null;

  const activeSalary = salaries.find((s: any) => s.status === 'VIGENTE') || null;
  const pendingCommsSum = commissions
    .filter((c: any) => c.status === 'PENDIENTE')
    .reduce((sum: number, c: any) => sum + Number(c.commissionAmount || 0), 0);
  const totalPaid = payments
    .filter((p: any) => p.status === 'COMPLETADO')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {getEmployeeDisplayName(employee)}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                {employee.employeeCode}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  employee.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {employee.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Área {employee.area} • {employee.position} • {branch?.name || 'Corporativo'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identidad y Acceso */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <div className="text-slate-500">Documento</div>
              <div className="font-mono font-semibold text-slate-900">
                {employee.documentType} {employee.documentNumber}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Modalidad</div>
              <div className="font-semibold text-slate-900">{employee.remunerationModality}</div>
            </div>
            <div>
              <div className="text-slate-500">Ingreso</div>
              <div className="font-mono text-slate-900">{employee.hireDate}</div>
            </div>
            <div>
              <div className="text-slate-500">Acceso Sistema</div>
              <div className="font-semibold text-teal-800 truncate">
                {linkedUser ? `${linkedUser.roleId}` : 'Sin usuario'}
              </div>
            </div>
          </div>

          {/* KPI Resumen */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="text-[11px] font-medium text-slate-500 uppercase">Salario Vigente</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1">
                {activeSalary ? `₲ ${activeSalary.baseSalary.toLocaleString('es-PY')}` : '₲ 0'}
              </div>
              <div className="text-[11px] text-slate-500">
                {activeSalary ? activeSalary.paymentFrequency : 'Sin salario fijo'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="text-[11px] font-medium text-slate-500 uppercase">Comisiones Pendientes</div>
              <div className="text-base font-bold font-mono tabular-nums text-indigo-700 mt-1">
                ₲ {pendingCommsSum.toLocaleString('es-PY')}
              </div>
              <div className="text-[11px] text-slate-500">
                {commissions.filter((c: any) => c.status === 'PENDIENTE').length} registros
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="text-[11px] font-medium text-slate-500 uppercase">Total Pagado</div>
              <div className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-1">
                ₲ {totalPaid.toLocaleString('es-PY')}
              </div>
              <div className="text-[11px] text-slate-500">
                {payments.filter((p: any) => p.status === 'COMPLETADO').length} pagos realizados
              </div>
            </div>
          </div>

          {/* Historial Salarial */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-teal-600" />
                <span>Historial Salarial ({salaries.length})</span>
              </h4>
              {onOpenSalaryModal && (
                <button
                  type="button"
                  onClick={() => onOpenSalaryModal(employee)}
                  className="text-xs font-bold text-teal-700 hover:underline cursor-pointer"
                >
                  + Actualizar Salario
                </button>
              )}
            </div>
            {salaries.length === 0 ? (
              <div className="p-3 rounded-xl border border-slate-200 text-xs text-slate-500">
                Sin salarios registrados.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {salaries.map((s: any) => (
                  <div key={s.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold tabular-nums text-slate-900">
                        ₲ {Number(s.baseSalary).toLocaleString('es-PY')} ({s.paymentFrequency})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Desde {s.effectiveDate} {s.endDate ? `hasta ${s.endDate}` : '— Actualidad'}
                        {s.observations ? ` • ${s.observations}` : ''}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'VIGENTE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Comisiones Generadas */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-indigo-600" />
              <span>Comisiones Generadas ({commissions.length})</span>
            </h4>
            {commissions.length === 0 ? (
              <div className="p-3 rounded-xl border border-slate-200 text-xs text-slate-500">
                No existen comisiones registradas para este colaborador.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {commissions.map((c: any) => {
                  const pat = c.patientId ? patients.find((p: any) => p.id === c.patientId) : null;
                  return (
                    <div key={c.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{c.concept}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.periodMonth}/{c.periodYear} • {c.sourceType}
                          {pat ? ` • Paciente: ${pat.firstName} ${pat.lastName}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold tabular-nums text-slate-900">
                          ₲ {Number(c.commissionAmount).toLocaleString('es-PY')}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {c.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Liquidaciones y Pagos */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-teal-600" />
              <span>Liquidaciones ({settlements.length}) &amp; Pagos ({payments.length})</span>
            </h4>
            {settlements.length === 0 ? (
              <div className="p-3 rounded-xl border border-slate-200 text-xs text-slate-500">
                Aún no se han emitido liquidaciones.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {settlements.map((s: any) => (
                  <div key={s.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {s.settlementNumber} — {s.periodLabel}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Neto: ₲ {s.netPayable.toLocaleString('es-PY')} • Pagado: ₲ {s.paidAmount.toLocaleString('es-PY')} • Saldo: ₲ {s.balanceDue.toLocaleString('es-PY')}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
