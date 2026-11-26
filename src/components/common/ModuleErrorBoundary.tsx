import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getApiBaseUrl } from '../../config/apiConfig.ts';

interface ModuleErrorBoundaryProps {
  moduleId: string;
  sessionToken?: string;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
}

const CLIENT_REPORT_COOLDOWN_MS = 15_000;
const lastReportByModule = new Map<string, number>();

function reportClientModuleError(moduleId: string, error: Error, sessionToken?: string): void {
  try {
    const now = Date.now();
    const last = lastReportByModule.get(moduleId) || 0;
    if (now - last < CLIENT_REPORT_COOLDOWN_MS) {
      return;
    }
    lastReportByModule.set(moduleId, now);

    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken && !sessionToken.startsWith('httpOnly_')) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }

    const rawMsg = String(error?.message || error?.name || 'Error de renderizado en módulo').slice(
      0,
      180
    );

    void fetch(`${baseUrl}/api/client-errors`, {
      method: 'POST',
      credentials: 'include',
      headers,
      keepalive: true,
      body: JSON.stringify({
        module: moduleId,
        message: rawMsg,
      }),
    }).catch(() => {
      // Silencioso: el reporte jamás debe interrumpir al usuario
    });
  } catch {
    // Silencioso
  }
}

export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(): Partial<ModuleErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    reportClientModuleError(this.props.moduleId, error, this.props.sessionToken);
  }

  private handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      retryCount: prev.retryCount + 1,
    }));
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="max-w-lg mx-auto my-8 md:my-12 p-6 md:p-8 bg-white border border-rose-200 rounded-2xl shadow-xs text-center"
        >
          <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1.5">
            Este módulo tuvo un problema. Intente nuevamente.
          </h3>
          <p className="text-xs md:text-sm text-slate-600 mb-6">
            El resto del sistema continúa funcionando con normalidad. Puede reintentar o cambiar de módulo desde el menú.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Reintentar</span>
          </button>
        </div>
      );
    }

    return <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>;
  }
}
