import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Bell,
  Stethoscope,
  HeartPulse,
  Calculator,
  Calendar,
  DollarSign,
  Building2,
  X,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  RefreshCw,
  Menu,
  ShieldCheck
} from 'lucide-react';
import { dbStore } from '../db/inMemoryStore.ts';
import { useAuth } from '../auth/authContext.tsx';
import { TabType } from './Header.tsx';
import { formatPYG } from '../db/seeds/paraguay-catalogs.ts';

interface AppHeaderProps {
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  onNavigateTab: (tab: TabType, extraPayload?: any) => void;
  onOpenMobileSidebar: () => void;
}

interface SearchResult {
  type: 'patient' | 'quote' | 'treatment' | 'appointment';
  id: string;
  title: string;
  subtitle: string;
  extra?: string;
  tab: TabType;
  payload?: any;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  selectedBranchId,
  onSelectBranch,
  onNavigateTab,
  onOpenMobileSidebar,
}) => {
  const { session } = useAuth();
  const branches = dbStore.getBranches();
  const org = dbStore.getActiveOrganization();

  // Búsqueda global interactiva
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selector de sucursal activa
  const activeBranch = branches.find((b) => b.id === selectedBranchId);

  // Cerrar dropdown de búsqueda al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Motor de Búsqueda Global en tiempo real (Pacientes, Cédula, Presupuestos, Citas)
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setResults([]);
      setIsSearchOpen(false);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const cleanDoc = term.replace(/[.\-]/g, '');

    const patients = dbStore.getPatients();
    const quotes = dbStore.getQuotes();
    const appointments = dbStore.getAppointments();

    const matchedResults: SearchResult[] = [];

    // 1. Pacientes (por Nombre, Apellido o Cédula paraguaya)
    patients.forEach((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const patientDoc = (p.documentNumber || '').replace(/[.\-]/g, '');
      const phone = (p.phone || '').replace(/[\s+]/g, '');

      if (fullName.includes(term) || patientDoc.includes(cleanDoc) || phone.includes(term)) {
        matchedResults.push({
          type: 'patient',
          id: p.id,
          title: `${p.firstName} ${p.lastName}`,
          subtitle: `C.I. ${p.documentNumber} • Tel: ${p.phone}`,
          extra: p.allergies?.length ? `⚠️ Alergia: ${p.allergies[0]}` : undefined,
          tab: 'patients',
          payload: { patientId: p.id },
        });
      }
    });

    // 2. Presupuestos (por código PRES-XXXX o paciente)
    quotes.forEach((q) => {
      const code = (q.quoteNumber || '').toLowerCase();
      const p = patients.find((pat) => pat.id === q.patientId);
      const patName = p ? `${p.firstName} ${p.lastName}`.toLowerCase() : '';

      if (code.includes(term) || patName.includes(term)) {
        matchedResults.push({
          type: 'quote',
          id: q.id,
          title: `Presupuesto ${q.quoteNumber}`,
          subtitle: `${p ? `${p.firstName} ${p.lastName}` : 'Paciente'} • ${q.status}`,
          extra: `Total: ${formatPYG(q.totalAmountPyg)}`,
          tab: 'quotes',
          payload: { quoteId: q.id },
        });
      }
    });

    // 3. Citas / Turnos
    appointments.forEach((a) => {
      const p = patients.find((pat) => pat.id === a.patientId);
      const patName = p ? `${p.firstName} ${p.lastName}`.toLowerCase() : '';
      if (patName.includes(term) || (a.reason || '').toLowerCase().includes(term)) {
        matchedResults.push({
          type: 'appointment',
          id: a.id,
          title: `Cita: ${p ? `${p.firstName} ${p.lastName}` : 'Paciente'}`,
          subtitle: `${a.date} a las ${a.time} • ${a.reason || 'Consulta'}`,
          extra: a.status,
          tab: 'agenda',
          payload: { appointmentId: a.id },
        });
      }
    });

    setResults(matchedResults.slice(0, 8)); // Top 8 resultados más relevantes
    setIsSearchOpen(true);
  }, [searchTerm]);

  const handleSelectResult = (result: SearchResult) => {
    setIsSearchOpen(false);
    setSearchTerm('');
    onNavigateTab(result.tab, result.payload);
  };

  const handleResetData = () => {
    if (window.confirm('¿Desea restaurar los datos iniciales de prueba de Paraguay?')) {
      dbStore.resetToSeed();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      {/* Botón para abrir sidebar en móvil + Título en móvil */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1">
          <span>OdontoPro</span>
          <span className="text-teal-600 font-semibold text-xs">Suite</span>
        </span>
      </div>

      {/* Buscador Global (Centro / Izquierda en Desktop) */}
      <div ref={searchRef} className="relative flex-1 max-w-lg hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsSearchOpen(true);
            }}
            placeholder="Buscar por paciente, C.I., presupuesto (PRES-001) o cita..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setIsSearchOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown de Resultados de Búsqueda Global */}
        {isSearchOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Resultados encontrados ({results.length})</span>
              <span className="text-teal-600 font-medium">Presiona para ir al módulo</span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelectResult(r)}
                  className="w-full p-3 text-left hover:bg-teal-50/50 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                      {r.type === 'patient' && <HeartPulse className="h-4 w-4" />}
                      {r.type === 'quote' && <Calculator className="h-4 w-4" />}
                      {r.type === 'appointment' && <Calendar className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-teal-900">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-slate-500">{r.subtitle}</p>
                    </div>
                  </div>
                  {r.extra && (
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md group-hover:bg-teal-100 group-hover:text-teal-800">
                      {r.extra}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controles de la derecha: Selector de Sede + Badge Multi-tenant + Seed */}
      <div className="flex items-center gap-2.5">
        {/* Selector de Sucursal Profesional */}
        <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200 text-xs transition-colors">
          <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 text-left">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold hidden sm:inline">
              Sede:
            </span>
            <select
              value={selectedBranchId}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="">Todas las Sedes ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Indicador de Moneda Oficial Paraguay */}
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200/80 text-[11px] font-bold text-teal-800">
          <span>₲ PYG</span>
        </div>

        {/* Botón de Restaurar Seed inicial de prueba */}
        <button
          onClick={handleResetData}
          title="Restaurar datos iniciales de prueba de Paraguay"
          className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-2xs"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
