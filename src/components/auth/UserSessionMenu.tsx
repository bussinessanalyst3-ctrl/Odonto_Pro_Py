import React, { useState } from 'react';
import {
  User,
  LogOut,
  ShieldCheck,
  Building,
  Key,
  ChevronDown,
  Stethoscope,
  Info
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { dbStore } from '../../db/inMemoryStore.ts';

export const UserSessionMenu: React.FC = () => {
  const { session, logout, switchBranch, quickLoginAs } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!session) return null;

  const branches = dbStore.getBranches();
  const currentBranch = branches.find((b) => b.id === session.currentBranchId);
  const allowedBranches =
    session.role === 'SUPER_ADMIN'
      ? branches
      : branches.filter((b) => session.allowedBranchIds.includes(b.id));

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-xs text-left"
      >
        <div className="h-8 w-8 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
          {session.firstName.charAt(0)}
          {session.lastName.charAt(0)}
        </div>
        <div className="hidden sm:block">
          <div className="text-xs font-bold text-slate-900 leading-tight">
            {session.firstName} {session.lastName}
          </div>
          <div className="text-[10px] text-teal-700 font-semibold flex items-center gap-1">
            <span>{session.roleName}</span>
            {session.professionalLicense && (
              <span className="text-slate-500">• {session.professionalLicense}</span>
            )}
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 p-3 space-y-3"
          onMouseLeave={() => setIsOpen(false)}
        >
          {/* User Details */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Sesión Activa</span>
            </div>
            <div className="font-bold text-sm text-slate-900 mt-1">
              {session.firstName} {session.lastName}
            </div>
            <div className="text-xs text-slate-500 font-mono truncate">{session.email}</div>
            <div className="text-[11px] text-teal-800 font-medium mt-1">
              {session.specialty || session.roleName}
            </div>
          </div>

          {/* Current Branch Selector (Anti-IDOR) */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Building className="h-3 w-3 text-slate-400" />
              <span>Sucursal Activa (Asignada):</span>
            </div>
            <select
              value={session.currentBranchId}
              onChange={(e) => {
                switchBranch(e.target.value);
                setIsOpen(false);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500"
            >
              {allowedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* Simular como otro rol / Comprobar vista de usuario */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Key className="h-3 w-3 text-teal-600" />
              <span>Simular vista de otro rol:</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  await quickLoginAs('SUPER_ADMIN');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left border transition-colors ${
                  session.role === 'SUPER_ADMIN'
                    ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                👑 Super Admin
              </button>
              <button
                type="button"
                onClick={async () => {
                  await quickLoginAs('SUPERVISOR');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left border transition-colors ${
                  session.role === 'SUPERVISOR'
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🛡️ Supervisor
              </button>
              <button
                type="button"
                onClick={async () => {
                  await quickLoginAs('VENDEDOR');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left border transition-colors ${
                  session.role === 'VENDEDOR'
                    ? 'bg-orange-100 text-orange-900 border-orange-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🏷️ Vendedor
              </button>
              <button
                type="button"
                onClick={async () => {
                  await quickLoginAs('ODONTOLOGO');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left border transition-colors ${
                  session.role === 'ODONTOLOGO'
                    ? 'bg-teal-100 text-teal-900 border-teal-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🦷 Odontólogo
              </button>
              <button
                type="button"
                onClick={async () => {
                  await quickLoginAs('RECEPCION');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left border transition-colors ${
                  session.role === 'RECEPCION'
                    ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📋 Recepción
              </button>
              <button
                type="button"
                onClick={async () => {
                  await quickLoginAs('CAJA');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left border transition-colors ${
                  session.role === 'CAJA'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                💵 Cajero
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Prueba cómo cambia la barra superior según los permisos.
            </p>
          </div>

          {/* Token Security status */}
          <div className="p-2.5 bg-teal-50/60 rounded-lg text-[10px] text-teal-900 space-y-0.5">
            <div className="font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-teal-600" />
              <span>Protección Anti-IDOR Activa</span>
            </div>
            <div className="text-slate-500 font-mono truncate">
              Token: {session.sessionToken.slice(0, 16)}...
            </div>
          </div>

          {/* Logout Action */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar Sesión Segura</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
