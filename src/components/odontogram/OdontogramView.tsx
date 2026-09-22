import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  History,
  Plus,
  Save,
  Printer,
  Calendar,
  User,
  Shield,
  Layers,
  Info,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Check,
  ChevronDown
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { ToothSVG, ToothData } from './ToothSVG.tsx';
import { ToothConditionModal, CONDITIONS_CATALOG } from './ToothConditionModal.tsx';
import { useAuth } from '../../auth/authContext.tsx';

interface OdontogramViewProps {
  initialPatientId?: string;
  onNavigateToTreatments?: (patientId: string, toothNumber?: number) => void;
}

export const OdontogramView: React.FC<OdontogramViewProps> = ({
  initialPatientId,
  onNavigateToTreatments,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  // Selected patient
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || snapshot.patients[0]?.id || ''
  );
  const [patientSearch, setPatientSearch] = useState<string>('');

  // Dentition type: ADULTO (32 teeth) vs PEDIATRICO (20 teeth)
  const [dentitionType, setDentitionType] = useState<'ADULTO' | 'PEDIATRICO'>('ADULTO');

  // Selected active odontogram version
  const [selectedOdontogramId, setSelectedOdontogramId] = useState<string | null>(null);

  // Selected tooth for detailed modal
  const [modalToothNumber, setModalToothNumber] = useState<number | null>(null);

  // Quick Action Tool (direct paint on click)
  const [quickTool, setQuickTool] = useState<string | null>(null);

  // New version form state
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [newVersionNotes, setNewVersionNotes] = useState('');

  const patient = snapshot.patients.find((p) => p.id === selectedPatientId);

  // Filter patient odontograms
  const patientOdontograms = useMemo(() => {
    return (snapshot.odontograms || [])
      .filter((o) => o.patientId === selectedPatientId && o.odontogramType === dentitionType)
      .sort((a, b) => (b.version || 1) - (a.version || 1));
  }, [snapshot.odontograms, selectedPatientId, dentitionType]);

  // Current active odontogram
  const activeOdontogram = useMemo(() => {
    if (selectedOdontogramId) {
      const found = patientOdontograms.find((o) => o.id === selectedOdontogramId);
      if (found) return found;
    }
    return patientOdontograms[0] || null;
  }, [selectedOdontogramId, patientOdontograms]);

  // Get items for current active odontogram
  const activeItems = useMemo(() => {
    if (!activeOdontogram) return [];
    return (snapshot.odontogramItems || []).filter((it) => it.odontogramId === activeOdontogram.id);
  }, [activeOdontogram, snapshot.odontogramItems]);

  // Build teeth dictionary for fast rendering
  const teethDataMap = useMemo(() => {
    const map: Record<number, ToothData> = {};
    activeItems.forEach((it) => {
      if (!map[it.toothNumber]) {
        map[it.toothNumber] = {
          toothNumber: it.toothNumber,
          surfaces: {},
        };
      }
      map[it.toothNumber].surfaces[it.surface as keyof ToothData['surfaces']] = {
        condition: it.condition,
        colorCode: it.colorCode,
        material: it.material,
        notes: it.notes,
      };
    });
    return map;
  }, [activeItems]);

  // Statistical calculations (CPO-D indicator)
  const stats = useMemo(() => {
    let cariesCount = 0;
    let obturacionesCount = 0;
    let ausentesCount = 0;
    let coronasCount = 0;
    let implantesCount = 0;
    let endodonciasCount = 0;

    const affectedTeeth = new Set<number>();

    activeItems.forEach((it) => {
      affectedTeeth.add(it.toothNumber);
      if (it.condition === 'CARIES') cariesCount++;
      if (it.condition === 'OBTURACION') obturacionesCount++;
      if (it.condition === 'AUSENTE' || it.condition === 'EXTRACCION') ausentesCount++;
      if (it.condition === 'CORONA') coronasCount++;
      if (it.condition === 'IMPLANTE') implantesCount++;
      if (it.condition === 'ENDODONCIA') endodonciasCount++;
    });

    const cpodIndex = cariesCount + obturacionesCount + ausentesCount;

    return {
      totalItems: activeItems.length,
      affectedTeethCount: affectedTeeth.size,
      cariesCount,
      obturacionesCount,
      ausentesCount,
      coronasCount,
      implantesCount,
      endodonciasCount,
      cpodIndex,
    };
  }, [activeItems]);

  // Handle surface click (either apply quick tool or open modal)
  const handleSurfaceClick = (toothNumber: number, surface: string) => {
    if (!activeOdontogram) {
      // Prompt creation of initial odontogram
      handleCreateFirstVersion();
      return;
    }

    if (quickTool) {
      const condObj = CONDITIONS_CATALOG.find((c) => c.id === quickTool);
      dbStore.updateToothCondition({
        odontogramId: activeOdontogram.id,
        toothNumber,
        surface,
        condition: quickTool,
        colorCode: condObj?.color || '#EF4444',
        actorUserId: session?.userId,
      });
    } else {
      setModalToothNumber(toothNumber);
    }
  };

  const handleCreateFirstVersion = () => {
    const dentistId =
      session?.role === 'ODONTOLOGO'
        ? session.userId
        : snapshot.users.find((u) => u.roleId === 'ODONTOLOGO')?.id || snapshot.users[0].id;

    const created = dbStore.createOdontogramVersion({
      patientId: selectedPatientId,
      odontologistId: dentistId,
      odontogramType: dentitionType,
      generalObservations: 'Odontograma inicial de admisión diagnóstica.',
      actorUserId: session?.userId,
    });
    setSelectedOdontogramId(created.id);
  };

  const handleSaveNewVersion = () => {
    if (!patient) return;
    const dentistId =
      session?.role === 'ODONTOLOGO'
        ? session.userId
        : snapshot.users.find((u) => u.roleId === 'ODONTOLOGO')?.id || snapshot.users[0].id;

    // Clone current items into new version
    const clonedItems = activeItems.map((it) => ({
      toothNumber: it.toothNumber,
      surface: it.surface,
      condition: it.condition,
      material: it.material,
      notes: it.notes,
      colorCode: it.colorCode,
    }));

    const created = dbStore.createOdontogramVersion({
      patientId: selectedPatientId,
      odontologistId: dentistId,
      odontogramType: dentitionType,
      generalObservations: newVersionNotes || 'Evolución clínica del odontograma.',
      items: clonedItems,
      actorUserId: session?.userId,
    });

    setSelectedOdontogramId(created.id);
    setIsCreatingVersion(false);
    setNewVersionNotes('');
  };

  // Filtered patients for dropdown
  const filteredPatients = snapshot.patients.filter((p) => {
    const q = patientSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.nationalId.includes(q)
    );
  });

  // Teeth numbers according to FDI:
  // ADULT:
  // Upper Right (18 to 11), Upper Left (21 to 28)
  // Lower Right (48 to 41), Lower Left (31 to 38)
  const adultUpperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const adultUpperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
  const adultLowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
  const adultLowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

  // PEDIATRIC:
  // Upper Right (55 to 51), Upper Left (61 to 65)
  // Lower Right (85 to 81), Lower Left (71 to 75)
  const pedUpperRight = [55, 54, 53, 52, 51];
  const pedUpperLeft = [61, 62, 63, 64, 65];
  const pedLowerRight = [85, 84, 83, 82, 81];
  const pedLowerLeft = [71, 72, 73, 74, 75];

  const upperRightTeeth = dentitionType === 'ADULTO' ? adultUpperRight : pedUpperRight;
  const upperLeftTeeth = dentitionType === 'ADULTO' ? adultUpperLeft : pedUpperLeft;
  const lowerRightTeeth = dentitionType === 'ADULTO' ? adultLowerRight : pedLowerRight;
  const lowerLeftTeeth = dentitionType === 'ADULTO' ? adultLowerLeft : pedLowerLeft;

  const currentOdontologist = activeOdontogram
    ? snapshot.users.find((u) => u.id === activeOdontogram.odontologistId)
    : null;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
              <Layers className="h-4 w-4" />
              <span>Fase 9 • Odontograma Digital Interactivo (FDI)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Odontograma Clínico Unificado
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Representación visual anatómica según la nomenclatura internacional FDI (Federación Dental Internacional).
            </p>
          </div>

          {/* Quick Actions & Versioning */}
          <div className="flex flex-wrap items-center gap-2">
            {activeOdontogram ? (
              <button
                onClick={() => setIsCreatingVersion(true)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Guardar Nueva Evolución (v{(activeOdontogram.version || 1) + 1})</span>
              </button>
            ) : (
              <button
                onClick={handleCreateFirstVersion}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Inicializar Odontograma</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Imprimir Odontograma"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>

        {/* Filters Bar: Patient Selector, Type and Versions */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Patient Selector */}
          <div className="md:col-span-5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Paciente Seleccionado:
            </label>
            <div className="relative">
              <select
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setSelectedOdontogramId(null);
                }}
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {snapshot.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} — C.I. {p.nationalId}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dentition Type (Adulto / Pediátrico) */}
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Dentición:
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setDentitionType('ADULTO');
                  setSelectedOdontogramId(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dentitionType === 'ADULTO'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Permanente (32)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDentitionType('PEDIATRICO');
                  setSelectedOdontogramId(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dentitionType === 'PEDIATRICO'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Temporal (20)
              </button>
            </div>
          </div>

          {/* Version Selector */}
          <div className="md:col-span-4">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Historial de Evoluciones:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={activeOdontogram?.id || ''}
                onChange={(e) => setSelectedOdontogramId(e.target.value)}
                disabled={patientOdontograms.length === 0}
                className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden disabled:opacity-50"
              >
                {patientOdontograms.length === 0 ? (
                  <option value="">Sin versiones registradas</option>
                ) : (
                  patientOdontograms.map((o) => {
                    const doc = snapshot.users.find((u) => u.id === o.odontologistId);
                    const d = new Date(o.createdAt).toLocaleDateString('es-PY', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                    return (
                      <option key={o.id} value={o.id}>
                        Versión {o.version} • {d} (Dr. {doc?.lastName || 'Tratante'})
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tool Palette Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Herramienta Rápida de Marcado Dental:
            </span>
            {quickTool ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                Pincel Activo: {CONDITIONS_CATALOG.find((c) => c.id === quickTool)?.label}
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                (Seleccione una herramienta para pintar superficies directamente al hacer clic)
              </span>
            )}
          </div>
          {quickTool && (
            <button
              onClick={() => setQuickTool(null)}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-medium self-start sm:self-auto"
            >
              Desactivar Pincel (Modo Inspección)
            </button>
          )}
        </div>

        {/* Tool Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1">
          {CONDITIONS_CATALOG.map((tool) => {
            const isSelected = quickTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setQuickTool(isSelected ? null : tool.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
                  isSelected
                    ? `${tool.bg} ring-2 ring-teal-600 ring-offset-1 shadow-xs`
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tool.color }}
                />
                <span>{tool.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main FDI Chart Canvas */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative">
        {/* Orientation Labels */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-4 px-2">
          <span>DERECHA DEL PACIENTE (Cuadrantes 1 & 4 / 5 & 8)</span>
          <span className="text-teal-700 font-extrabold tracking-widest uppercase">
            {dentitionType === 'ADULTO' ? 'ARCADA PERMANENTE' : 'ARCADA TEMPORAL'}
          </span>
          <span>IZQUIERDA DEL PACIENTE (Cuadrantes 2 & 3 / 6 & 7)</span>
        </div>

        {/* UPPER ARCH (Maxilar Superior) */}
        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/60 mb-6">
          <div className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            ▲ Arcada Superior (Vestibular Arriba / Palatina Abajo)
          </div>

          <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto py-2">
            {/* Upper Right Quadrant (1 or 5) */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {upperRightTeeth.map((num) => (
                <ToothSVG
                  key={num}
                  toothNumber={num}
                  data={teethDataMap[num]}
                  isUpper={true}
                  isRight={true}
                  isSelected={modalToothNumber === num}
                  onSelectTooth={(n) => setModalToothNumber(n)}
                  onSurfaceClick={handleSurfaceClick}
                />
              ))}
            </div>

            {/* Midline Divider */}
            <div className="h-16 w-0.5 bg-teal-500/50 mx-1 sm:mx-2 rounded-full flex flex-col justify-between items-center py-1">
              <span className="text-[9px] font-black text-teal-700 bg-teal-50 px-1 rounded-sm">V</span>
              <span className="text-[9px] font-black text-teal-700 bg-teal-50 px-1 rounded-sm">P</span>
            </div>

            {/* Upper Left Quadrant (2 or 6) */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {upperLeftTeeth.map((num) => (
                <ToothSVG
                  key={num}
                  toothNumber={num}
                  data={teethDataMap[num]}
                  isUpper={true}
                  isRight={false}
                  isSelected={modalToothNumber === num}
                  onSelectTooth={(n) => setModalToothNumber(n)}
                  onSurfaceClick={handleSurfaceClick}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dental Midline Horizontal Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-slate-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs font-semibold text-slate-400">
              Plano de Oclusión Dental
            </span>
          </div>
        </div>

        {/* LOWER ARCH (Mandíbula Inferior) */}
        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/60 mt-4">
          <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto py-2">
            {/* Lower Right Quadrant (4 or 8) */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {lowerRightTeeth.map((num) => (
                <ToothSVG
                  key={num}
                  toothNumber={num}
                  data={teethDataMap[num]}
                  isUpper={false}
                  isRight={true}
                  isSelected={modalToothNumber === num}
                  onSelectTooth={(n) => setModalToothNumber(n)}
                  onSurfaceClick={handleSurfaceClick}
                />
              ))}
            </div>

            {/* Midline Divider */}
            <div className="h-16 w-0.5 bg-teal-500/50 mx-1 sm:mx-2 rounded-full flex flex-col justify-between items-center py-1">
              <span className="text-[9px] font-black text-teal-700 bg-teal-50 px-1 rounded-sm">L</span>
              <span className="text-[9px] font-black text-teal-700 bg-teal-50 px-1 rounded-sm">V</span>
            </div>

            {/* Lower Left Quadrant (3 or 7) */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {lowerLeftTeeth.map((num) => (
                <ToothSVG
                  key={num}
                  toothNumber={num}
                  data={teethDataMap[num]}
                  isUpper={false}
                  isRight={false}
                  isSelected={modalToothNumber === num}
                  onSelectTooth={(n) => setModalToothNumber(n)}
                  onSurfaceClick={handleSurfaceClick}
                />
              ))}
            </div>
          </div>

          <div className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-3">
            ▼ Arcada Inferior (Lingual Arriba / Vestibular Abajo)
          </div>
        </div>

        {/* Odontogram Meta / Professional Seal */}
        {activeOdontogram && (
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">Responsable Clínico: </span>
              <span className="text-teal-800 font-bold">
                Dr(a). {currentOdontologist?.firstName} {currentOdontologist?.lastName}
              </span>
              <span className="text-slate-400 ml-1">
                (Reg. MSPBS: {currentOdontologist?.professionalLicense || 'N/A'})
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Última Actualización: </span>
              <span>
                {new Date(activeOdontogram.updatedAt).toLocaleDateString('es-PY', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Epidemiological Summary Cards & Index */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Caries Activas</div>
          <div className="text-2xl font-black text-red-600 mt-1">{stats.cariesCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Requiere intervención</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Obturaciones</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{stats.obturacionesCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Restauradas previamente</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Ausentes / Exod.</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{stats.ausentesCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Piezas perdidas</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Endodoncias</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{stats.endodonciasCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Conductos obturados</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Implantes / Coronas</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {stats.implantesCount + stats.coronasCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Rehabilitación protésica</div>
        </div>

        <div className="p-4 bg-teal-50/80 rounded-2xl border border-teal-200 shadow-xs">
          <div className="text-[11px] font-bold text-teal-800 uppercase">Índice CPO-D</div>
          <div className="text-2xl font-black text-teal-900 mt-1">{stats.cpodIndex}</div>
          <div className="text-[10px] text-teal-700 mt-0.5">Caries + Perdidos + Obt.</div>
        </div>
      </div>

      {/* Modal for Deep Tooth Inspection */}
      <ToothConditionModal
        toothNumber={modalToothNumber}
        toothData={modalToothNumber ? teethDataMap[modalToothNumber] : undefined}
        isUpper={modalToothNumber ? (modalToothNumber < 30 || (modalToothNumber >= 50 && modalToothNumber < 70)) : true}
        isOpen={modalToothNumber !== null}
        onClose={() => setModalToothNumber(null)}
        onSave={(num, surf, cond, mat, notes, col) => {
          if (!activeOdontogram) return;
          dbStore.updateToothCondition({
            odontogramId: activeOdontogram.id,
            toothNumber: num,
            surface: surf,
            condition: cond,
            material: mat,
            notes,
            colorCode: col,
            actorUserId: session?.userId,
          });
        }}
        onCreateTreatment={(toothNum, cond) => {
          if (onNavigateToTreatments) {
            onNavigateToTreatments(selectedPatientId, toothNum);
          }
        }}
      />

      {/* Save New Version Modal */}
      {isCreatingVersion && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              Guardar Nueva Versión de Evolución del Odontograma
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Se creará la versión v{(activeOdontogram?.version || 1) + 1} para{' '}
              <span className="font-semibold text-slate-800">
                {patient?.firstName} {patient?.lastName}
              </span>
              , conservando intacto el historial anterior.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Motivo / Observaciones de la Evolución:
              </label>
              <textarea
                rows={3}
                value={newVersionNotes}
                onChange={(e) => setNewVersionNotes(e.target.value)}
                placeholder="Ej: Control semestral. Obturación resina pieza 16 en buen estado. Se detecta nueva lesión cariosa incipiente..."
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingVersion(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNewVersion}
                className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>Confirmar y Guardar v{(activeOdontogram?.version || 1) + 1}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
