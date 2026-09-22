import React, { useState } from 'react';
import { MapPin, Building, CreditCard, Banknote, CheckCircle2, Calculator, ArrowRight } from 'lucide-react';
import {
  PARAGUAY_DEPARTMENTS,
  DOCUMENT_TYPES,
  PAYMENT_METHODS,
  STANDARD_SERVICES,
  formatPYG,
  calculateRucVerificationDigit
} from '../db/seeds/paraguay-catalogs.ts';

export const ParaguayCatalogsViewer: React.FC = () => {
  const [selectedDeptCode, setSelectedDeptCode] = useState<string>('CEN');
  const [rucTestNumber, setRucTestNumber] = useState<string>('80098765');
  const [testedDv, setTestedDv] = useState<number | null>(4);

  const selectedDept =
    PARAGUAY_DEPARTMENTS.find((d) => d.code === selectedDeptCode) || PARAGUAY_DEPARTMENTS[0];

  const handleCalculateDv = (val: string) => {
    setRucTestNumber(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length > 0) {
      const dv = calculateRucVerificationDigit(clean);
      setTestedDv(dv);
    } else {
      setTestedDv(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
            <MapPin className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            Catálogos y Adaptación Regional para Paraguay
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Estructura de datos normalizada para la República del Paraguay: división político-administrativa
          (17 departamentos + Asunción), cálculo de dígito verificador RUC (Módulo 11),
          medios de pago autorizados (SIPAP, QR) y aranceles odontológicos en Guaraníes (₲).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Departamentos y Ciudades */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  División Territorial ({PARAGUAY_DEPARTMENTS.length} Regiones)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">ISO 3166-2:PY</span>
            </div>

            {/* Department selector */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Seleccionar Departamento:
              </label>
              <select
                value={selectedDeptCode}
                onChange={(e) => setSelectedDeptCode(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
              >
                {PARAGUAY_DEPARTMENTS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} (Cabecera: {d.capital})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Department Info */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-slate-900">{selectedDept.name}</div>
                  <div className="text-xs text-slate-500">Capital: {selectedDept.capital}</div>
                </div>
                <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-teal-100 text-teal-800">
                  {selectedDept.code}
                </span>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-600 mb-2">
                  Ciudades / Distritos principales ({selectedDept.cities.length}):
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedDept.cities.map((city) => (
                    <span
                      key={city}
                      className="px-2 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-700 font-medium"
                    >
                      {city}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RUC Validator (Módulo 11) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Calculator className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Validador Algorítmico de R.U.C. (Módulo 11 - DNIT / SET)
              </h3>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              En Paraguay, el Registro Único de Contribuyente (RUC) se compone de la Cédula de Identidad
              o número base, seguido de un dígito verificador calculado matemáticamente.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:w-2/3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número base (C.I. o RUC sin guión):
                </label>
                <input
                  type="text"
                  value={rucTestNumber}
                  onChange={(e) => handleCalculateDv(e.target.value)}
                  placeholder="Ej. 4250312 o 80098765"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium"
                />
              </div>

              <div className="w-full sm:w-1/3 p-3 bg-teal-50 border border-teal-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-teal-800">Dígito Verificador</div>
                <div className="text-xl font-mono font-black text-teal-900 mt-0.5">
                  {testedDv !== null ? `-${testedDv}` : '—'}
                </div>
              </div>
            </div>

            {testedDv !== null && (
              <div className="mt-3 p-2 bg-slate-100 rounded-lg text-xs font-mono text-center text-slate-800">
                Resultado Formateado: <strong>{rucTestNumber}-{testedDv}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Tipos de Documento, Métodos de Pago y Aranceles en Guaraníes */}
        <div className="lg:col-span-6 space-y-4">
          {/* Métodos de Pago Locales */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Medios de Cobro y Facturación en Guaraníes (PYG)
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PAYMENT_METHODS.map((pm) => (
                <div
                  key={pm.code}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5"
                >
                  <div className="h-7 w-7 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs shrink-0">
                    ₲
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{pm.label}</div>
                    <div className="text-[10px] font-mono text-slate-400">{pm.code}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aranceles de Procedimientos Estándar en Guaraníes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Aranceles Sugeridos (Guaraníes sin centavos)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Almacenado en BIGINT</span>
            </div>

            <div className="mt-4 divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {STANDARD_SERVICES.map((s) => (
                <div key={s.code} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{s.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {s.code} • {s.category} • {s.defaultDurationMin} min
                    </div>
                  </div>
                  <div className="text-xs font-bold font-mono text-emerald-700">
                    {formatPYG(s.basePrice)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
