import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  HeartPulse,
  AlertTriangle,
  Building2,
  Phone,
  MessageCircle,
  Eye,
  Edit2,
  Power,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  MapPin
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useBranding } from '../../branding/BrandingContext.tsx';
import { PatientModal } from './PatientModal.tsx';
import { ComprehensivePatientModal } from './ComprehensivePatientModal.tsx';

interface PatientManagementViewProps {
  onNavigateToTab?: (tab: string, payload?: any) => void;
}

export const PatientManagementView: React.FC<PatientManagementViewProps> = ({
  onNavigateToTab,
}) => {
  const [, setTick] = useState(0);
  const { branding } = useBranding();
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [alertFilter, setAlertFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<any | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const snapshot = dbStore.getSnapshot();
  const patients = snapshot.patients;
  const branches = snapshot.branches;

  const handleOpenAdd = () => {
    setPatientToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (patient: any) => {
    setPatientToEdit(patient);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (patientId: string) => {
    dbStore.togglePatientStatus(patientId);
  };

  // Filter logic memorized
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        p.firstName.toLowerCase().includes(term) ||
        p.lastName.toLowerCase().includes(term) ||
        p.documentNumber.toLowerCase().includes(term) ||
        p.phone.toLowerCase().includes(term) ||
        p.city.toLowerCase().includes(term);

      const matchesBranch = branchFilter === 'ALL' || p.primaryBranchId === branchFilter;

      let matchesAlert = true;
      if (alertFilter === 'ALLERGIES') {
        matchesAlert =
          p.allergies &&
          p.allergies.toLowerCase() !== 'ninguna' &&
          p.allergies.toLowerCase() !== 'ninguna conocida';
      } else if (alertFilter === 'CONDITIONS') {
        matchesAlert =
          p.medicalConditions &&
          p.medicalConditions.toLowerCase() !== 'ninguna' &&
          p.medicalConditions.toLowerCase() !== 'ninguna conocida';
      }

      return matchesSearch && matchesBranch && matchesAlert;
    });
  }, [patients, searchTerm, branchFilter, alertFilter]);

  const totalPages = Math.ceil(filteredPatients.length / pageSize) || 1;
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, branchFilter, alertFilter]);

  const totalPatients = patients.length;
  const patientsWithAllergies = patients.filter(
    (p) =>
      p.allergies &&
      p.allergies.toLowerCase() !== 'ninguna' &&
      p.allergies.toLowerCase() !== 'ninguna conocida'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Ficha Médica Única & Registro de Pacientes
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Fase 6: Ficha Clínica Unificada
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Historial unificado multi-sucursal, validación de Cédula de Identidad, anamnesis,
                antecedentes farmacológicos y contacto directo por WhatsApp en Paraguay.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>Nuevo Paciente</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Fichas Activas</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{totalPatients} Pacientes</div>
            <div className="text-[11px] text-teal-700 font-semibold">100% C.I. Validada</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Alertas de Alergias</div>
            <div className="text-lg font-bold text-rose-700 mt-0.5">{patientsWithAllergies} Pacientes</div>
            <div className="text-[11px] text-rose-600">Alerta Penicilina / Látex</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Multi-Sucursal</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">Ficha Compartida</div>
            <div className="text-[11px] text-slate-500">Historial Médico Unificado</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Cumplimiento Legal</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">Ley N° 1682/01</div>
            <div className="text-[11px] text-emerald-700 font-semibold">Privacidad & Datos Médicos</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por C.I., Nombre, Teléfono o Ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium text-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="flex-1 sm:flex-none text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 min-h-[40px] cursor-pointer"
          >
            <option value="ALL">Todas las Sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            className="flex-1 sm:flex-none text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 min-h-[40px] cursor-pointer"
          >
            <option value="ALL">Todas las Fichas</option>
            <option value="ALLERGIES">⚠️ Con Alergias</option>
            <option value="CONDITIONS">🩺 Con Patologías</option>
          </select>

          {/* Toggle Tarjetas / Tabla */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0 ml-auto sm:ml-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Vista de Tarjetas Adaptable"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Vista de Tabla Detallada"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tabla</span>
            </button>
          </div>
        </div>
      </div>

      {/* Patients Display: Cards or Table */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedPatients.map((p) => {
            const primaryBranch = branches.find((b) => b.id === p.primaryBranchId);
            const hasAlert =
              p.allergies &&
              p.allergies.toLowerCase() !== 'ninguna' &&
              p.allergies.toLowerCase() !== 'ninguna conocida';

            const cleanPhone = (p.whatsapp || p.phone || '').replace(/\D/g, '');
            const waUrl = `https://wa.me/${
              cleanPhone.startsWith('595') ? cleanPhone : '595' + cleanPhone.replace(/^0/, '')
            }?text=${encodeURIComponent(
              `Hola ${p.firstName}, le saludamos desde ${branding.legalName || branding.tradeName || 'la clínica odontológica'}.`
            )}`;

            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-2xl bg-teal-100 text-teal-800 font-bold text-sm flex items-center justify-center shrink-0">
                        {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {p.firstName} {p.lastName}
                        </h3>
                        <div className="text-[11px] font-mono text-slate-500">
                          C.I. {p.documentNumber}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                      {p.bloodType || 'O+'}
                    </span>
                  </div>

                  {hasAlert && (
                    <div className="mb-2.5 flex items-center gap-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                      <span className="truncate">{p.allergies}</span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-slate-600 mt-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">{p.city} ({p.department})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{primaryBranch?.name || 'Sede Central'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-mono">{p.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors min-h-[42px] sm:min-h-[44px]"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedPatientId(p.id)}
                      className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 min-h-[42px] sm:min-h-[44px] cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ficha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center cursor-pointer"
                      title="Editar Ficha"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(p.id)}
                      className={`p-2.5 rounded-xl border transition-colors min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center cursor-pointer ${
                        p.status === 'ACTIVE'
                          ? 'border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                      title={p.status === 'ACTIVE' ? 'Desactivar paciente' : 'Activar paciente'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Patients Table */
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3">Paciente / Documento</th>
                <th className="px-4 py-3">Ubicación (PY)</th>
                <th className="px-4 py-3">Contacto Directo</th>
                <th className="px-4 py-3">Alertas Clínicas (Anamnesis)</th>
                <th className="px-4 py-3">Sucursal Base</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedPatients.map((p) => {
                const primaryBranch = branches.find((b) => b.id === p.primaryBranchId);

                const hasAlert =
                  p.allergies &&
                  p.allergies.toLowerCase() !== 'ninguna' &&
                  p.allergies.toLowerCase() !== 'ninguna conocida';

                const cleanPhone = (p.whatsapp || p.phone || '').replace(/\D/g, '');
                const waUrl = `https://wa.me/${
                  cleanPhone.startsWith('595') ? cleanPhone : '595' + cleanPhone.replace(/^0/, '')
                }?text=${encodeURIComponent(
                  `Hola ${p.firstName}, le saludamos desde ${branding.legalName || branding.tradeName || 'la clínica odontológica'}.`
                )}`;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {p.firstName.charAt(0)}
                          {p.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>
                              {p.firstName} {p.lastName}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {p.bloodType || 'O+'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            C.I. {p.documentNumber}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-900 font-medium">{p.city}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                        {p.department}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="text-slate-800 font-mono text-[11px]">{p.phone}</div>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {hasAlert ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold max-w-[190px] truncate">
                          <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" />
                          <span className="truncate">{p.allergies}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Sin alergias declaradas</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        <span>{primaryBranch?.name.replace('Sucursal ', '')}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPatientId(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[11px] font-semibold transition-colors flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Ver Ficha</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Editar Ficha"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p.id)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            p.status === 'ACTIVE'
                              ? 'border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={p.status === 'ACTIVE' ? 'Desactivar paciente' : 'Activar paciente'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Paginación Compartida */}
      {filteredPatients.length > pageSize && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 shadow-xs">
          <div>
            Mostrando <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> a{' '}
            <span className="font-bold text-slate-900">
              {Math.min(currentPage * pageSize, filteredPatients.length)}
            </span>{' '}
            de <span className="font-bold text-slate-900">{filteredPatients.length}</span> pacientes
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 font-semibold text-slate-800">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <PatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientToEdit={patientToEdit}
      />

      {/* Comprehensive Patient Unified File Modal */}
      <ComprehensivePatientModal
        patientId={selectedPatientId}
        isOpen={!!selectedPatientId}
        onClose={() => setSelectedPatientId(null)}
        onEdit={(p) => {
          setSelectedPatientId(null);
          handleOpenEdit(p);
        }}
        onNavigateToTab={onNavigateToTab}
      />
    </div>
  );
};
