import React from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { X, Printer, CheckCircle2, Building2 } from 'lucide-react';

interface CashReceiptModalProps {
  paymentId: string | null;
  onClose: () => void;
}

export const CashReceiptModal: React.FC<CashReceiptModalProps> = ({ paymentId, onClose }) => {
  if (!paymentId) return null;

  const payment = dbStore.getPayments().find((p) => p.id === paymentId);
  if (!payment) return null;

  const patient = dbStore.getPatients().find((p) => p.id === payment.patientId);
  const branch = dbStore.getBranches().find((b) => b.id === payment.branchId);
  const cashier = dbStore.getUsers().find((u) => u.id === payment.receivedBy);
  const organization = dbStore.getOrganization();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full my-6 overflow-hidden print:shadow-none print:border-none print:m-0 print:max-w-none">
        {/* Actions Bar (Hidden on Print) */}
        <div className="px-6 py-3 bg-slate-800 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Recibo Oficial de Pago
            </span>
            <span className="text-xs font-mono font-bold text-teal-300">
              {payment.receiptNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Recibo
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div className="p-8 print:p-4 space-y-6 text-slate-800">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {organization?.name || 'OdontoPro Paraguay'}
              </h2>
              <p className="text-xs font-semibold text-slate-600">
                Clínica Odontológica Integral
              </p>
              <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                <p>RUC: {organization?.taxId || '80012345-6'}</p>
                <p>Sucursal: {branch?.name} ({branch?.city})</p>
                <p>Dirección: {branch?.address}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="bg-slate-50 border border-slate-300 p-2.5 rounded-xl text-left">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">
                  RECIBO DE DINERO
                </span>
                <span className="block text-sm font-black font-mono text-teal-800">
                  {payment.receiptNumber}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Fecha: {new Date(payment.createdAt).toLocaleDateString('es-PY')}
                </span>
              </div>
            </div>
          </div>

          {/* Amount Badge */}
          <div className={`p-3.5 rounded-xl flex items-center justify-between border ${
            payment.status === 'ANULADO' 
              ? 'bg-rose-50 border-rose-300 text-rose-800' 
              : 'bg-teal-50 border-teal-200'
          }`}>
            <div>
              <span className={`text-xs font-bold uppercase block ${
                payment.status === 'ANULADO' ? 'text-rose-900' : 'text-teal-900'
              }`}>
                {payment.status === 'ANULADO' ? 'RECIBO ANULADO - VALOR REVERTIDO' : 'La suma de Guaraníes:'}
              </span>
              {payment.status === 'ANULADO' && (payment as any).annulledReason && (
                <span className="text-[11px] font-medium text-rose-700 italic block mt-0.5">
                  Motivo: "{(payment as any).annulledReason}"
                </span>
              )}
            </div>
            <span className={`text-lg font-black font-mono ${
              payment.status === 'ANULADO' ? 'text-rose-700 line-through' : 'text-teal-800'
            }`}>
              ₲ {payment.amount.toLocaleString('es-PY')}
            </span>
          </div>

          {/* Content details */}
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-500">Recibí de:</span>
              <span className="col-span-2 font-bold text-slate-900">
                {patient?.firstName} {patient?.lastName}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-500">Documento C.I. / RUC:</span>
              <span className="col-span-2 font-bold text-slate-800">
                {patient?.documentNumber}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-500">En concepto de:</span>
              <span className="col-span-2 font-medium text-slate-800">
                {payment.notes || 'Pago de servicios y atención odontológica'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-500">Forma de Pago:</span>
              <span className="col-span-2 font-bold text-teal-700">
                {payment.paymentMethod}
              </span>
            </div>

            {payment.invoiceNumber && (
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Factura Legal N°:</span>
                <span className="col-span-2 font-mono text-slate-700">
                  {payment.invoiceNumber}
                </span>
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-center text-xs">
            <div>
              <div className="border-t border-dashed border-slate-400 w-36 mx-auto mb-1"></div>
              <p className="font-bold text-slate-800">Caja / Recaudación</p>
              <p className="text-[10px] text-slate-500">
                {cashier?.firstName} {cashier?.lastName}
              </p>
            </div>
            <div>
              <div className="border-t border-dashed border-slate-400 w-36 mx-auto mb-1"></div>
              <p className="font-bold text-slate-800">Firma del Pagador</p>
              <p className="text-[10px] text-slate-500">C.I. {patient?.documentNumber}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
