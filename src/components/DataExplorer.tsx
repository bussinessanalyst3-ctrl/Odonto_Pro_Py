import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  DollarSign,
  ClipboardList,
  Building,
  Shield,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Receipt
} from 'lucide-react';
import { dbStore } from '../db/inMemoryStore.ts';
import { formatPYG } from '../db/seeds/paraguay-catalogs.ts';
import { CreatePatientModal } from './CreatePatientModal.tsx';

interface DataExplorerProps {
  selectedBranchId: string;
}

type EntityView =
  | 'patients'
  | 'appointments'
  | 'services'
  | 'users'
  | 'cash_movements'
  | 'audit_logs';

export const DataExplorer: React.FC<DataExplorerProps> = ({ selectedBranchId }) => {
  const [currentEntity, setCurrentEntity] = useState<EntityView>('patients');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [, setTick] = useState(0);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = dbStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const branch = selectedBranchId ? dbStore.getBranchById(selectedBranchId) : null;
  const patients = dbStore.getPatients(selectedBranchId);
  const appointments = dbStore.getAppointments(selectedBranchId);
  const services = dbStore.getServices();
  const users = dbStore.getUsers(selectedBranchId);
  const cashRegisters = dbStore.getCashRegisters(selectedBranchId);
  const snapshot = dbStore.getSnapshot();
  const auditLogs = dbStore.getAuditLogs();

  // Filtered lists
  const filteredPatients = patients.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.documentNumber.includes(q) ||
      p.city?.toLowerCase().includes(q)
    );
  });

  const filteredAppointments = appointments.filter((a) => {
    const q = searchTerm.toLowerCase();
    const pat = snapshot.patients.find((p) => p.id === a.patientId);
    return (
      (pat && (pat.firstName.toLowerCase().includes(q) || pat.lastName.toLowerCase().includes(q))) ||
      a.reason?.toLowerCase().includes(q) ||
      a.appointmentDate.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Context Stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-100 text-teal-700 rounded-lg">
                <Building className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Explorador de Datos Multi-Tenant en Vivo
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {branch
                ? `Filtrando datos exclusivos para: ${branch.name} (${branch.department} - ${branch.city})`
                : 'Mostrando datos consolidados de todas las sucursales de la clínica en Paraguay'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPatientModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Paciente de Prueba</span>
            </button>
          </div>
        </div>

        {/* Mini stats metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Pacientes Registrados</div>
            <div className="text-lg font-bold text-slate-900">{patients.length}</div>
            <div className="text-[11px] text-slate-400">Con C.I. Paraguay</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Citas en Agenda</div>
            <div className="text-lg font-bold text-teal-700">{appointments.length}</div>
            <div className="text-[11px] text-slate-400">Hoy y esta semana</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Servicios Activos</div>
            <div className="text-lg font-bold text-indigo-700">{services.length}</div>
            <div className="text-[11px] text-slate-400">Precios en Guaraníes (₲)</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Eventos Auditados</div>
            <div className="text-lg font-bold text-slate-800">{auditLogs.length}</div>
            <div className="text-[11px] text-emerald-600 font-medium">Inmutable append-only</div>
          </div>
        </div>
      </div>

      {/* Entity Tabs Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setCurrentEntity('patients')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            currentEntity === 'patients'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Pacientes ({patients.length})</span>
        </button>

        <button
          onClick={() => setCurrentEntity('appointments')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            currentEntity === 'appointments'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Turnos & Citas ({appointments.length})</span>
        </button>

        <button
          onClick={() => setCurrentEntity('services')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            currentEntity === 'services'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          <span>Aranceles Odontológicos ({services.length})</span>
        </button>

        <button
          onClick={() => setCurrentEntity('users')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            currentEntity === 'users'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Personal & Odontólogos ({users.length})</span>
        </button>

        <button
          onClick={() => setCurrentEntity('cash_movements')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            currentEntity === 'cash_movements'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="h-3.5 w-3.5" />
          <span>Caja & Cobros en PYG ({snapshot.cashMovements.length})</span>
        </button>

        <button
          onClick={() => setCurrentEntity('audit_logs')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            currentEntity === 'audit_logs'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Auditoría Médica ({auditLogs.length})</span>
        </button>
      </div>

      {/* Main Entity Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar registros en tabla..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="text-xs text-slate-400">
            Mostrando resultados con aislamiento multi-tenant
          </div>
        </div>

        {/* 1. Pacientes View */}
        {currentEntity === 'patients' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Paciente</th>
                  <th className="py-2.5 px-3">Cédula / Documento</th>
                  <th className="py-2.5 px-3">Contacto (+595)</th>
                  <th className="py-2.5 px-3">Ubicación Paraguay</th>
                  <th className="py-2.5 px-3">Alergias / Antecedentes</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="text-[11px] text-slate-400">{p.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {p.documentType}: {p.documentNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-700">{p.phone}</div>
                      {p.emergencyContactName && (
                        <div className="text-[11px] text-slate-400">
                          Contacto: {p.emergencyContactName}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{p.city}</div>
                      <div className="text-[11px] text-slate-400">{p.department}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                          p.allergies && p.allergies !== 'Ninguna conocida' && p.allergies !== 'Ninguna'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {p.allergies || 'Sin alergias'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        ACTIVO
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Turnos View */}
        {currentEntity === 'appointments' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Fecha & Hora</th>
                  <th className="py-2.5 px-3">Paciente</th>
                  <th className="py-2.5 px-3">Odontólogo</th>
                  <th className="py-2.5 px-3">Motivo de Consulta</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.map((a) => {
                  const pat = snapshot.patients.find((p) => p.id === a.patientId);
                  const doc = snapshot.users.find((u) => u.id === a.odontologistId);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-semibold text-slate-900">{a.appointmentDate}</div>
                        <div className="text-slate-500">{a.startTime} hs</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {pat?.firstName} {pat?.lastName}
                        </div>
                        <div className="text-[11px] text-slate-400">CI: {pat?.documentNumber}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          {doc?.firstName} {doc?.lastName}
                        </div>
                        <div className="text-[11px] text-teal-600">{doc?.professionalLicense}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                        {a.reason}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            a.status === 'EN_ATENCION'
                              ? 'bg-blue-100 text-blue-800'
                              : a.status === 'EN_SALA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {a.durationMin} min
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Aranceles / Servicios View */}
        {currentEntity === 'services' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Código</th>
                  <th className="py-2.5 px-3">Procedimiento Odontológico</th>
                  <th className="py-2.5 px-3">Especialidad / Categoría</th>
                  <th className="py-2.5 px-3">Duración Estándar</th>
                  <th className="py-2.5 px-3 text-right">Arancel Base (PYG)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {s.code}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-400">{s.description}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {s.defaultDurationMin} min
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                      {formatPYG(s.basePrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Personal & Usuarios */}
        {currentEntity === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Nombre Completo</th>
                  <th className="py-2.5 px-3">Rol Asignado (RBAC)</th>
                  <th className="py-2.5 px-3">Especialidad / Cargo</th>
                  <th className="py-2.5 px-3">Registro MSPBS</th>
                  <th className="py-2.5 px-3">Email & Contacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                        {u.roleId}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{u.specialty}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {u.professionalLicense || 'N/A (Administrativo)'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800">{u.email}</div>
                      <div className="text-[11px] text-slate-400">{u.phone}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Caja & Cobros */}
        {currentEntity === 'cash_movements' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Concepto</th>
                  <th className="py-2.5 px-3">Método de Pago</th>
                  <th className="py-2.5 px-3">Comprobante / Referencia</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3 text-right">Monto en Guaraníes (₲)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.cashMovements.map((cm) => (
                  <tr key={cm.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900">{cm.concept}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[11px] font-semibold">
                        {cm.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {cm.referenceNumber || 'Comprobante interno'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {cm.movementType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                      {formatPYG(cm.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Auditoría */}
        {currentEntity === 'audit_logs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Fecha & Hora</th>
                  <th className="py-2.5 px-3">Acción</th>
                  <th className="py-2.5 px-3">Entidad</th>
                  <th className="py-2.5 px-3">Descripción de Operación</th>
                  <th className="py-2.5 px-3">Dirección IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(log.createdAt).toLocaleTimeString('es-PY')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-teal-700 font-medium">
                      {log.entity}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{log.description}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal to create patient */}
      <CreatePatientModal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        defaultBranchId={selectedBranchId}
      />
    </div>
  );
};
