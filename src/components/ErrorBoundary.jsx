import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Actualiza el estado para que el siguiente renderizado muestre la UI de repuesto.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // También puedes registrar el error en un servicio de reporte de errores
        console.error("💥 Error Fatal capturado por ErrorBoundary:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        // Forzamos una recarga limpia del navegador vaciando caché de la sesión
        window.location.reload(true);
    };

    render() {
        if (this.state.hasError) {
            // UI de Emergencia Personalizada
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={32} />
                        </div>

                        <h1 className="text-xl font-bold text-slate-800 mb-2">¡Ups! Algo salió mal</h1>
                        <p className="text-sm text-slate-500 mb-6">
                            La aplicación tuvo un problema inesperado al iniciar.
                        </p>

                        <button
                            onClick={this.handleReload}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-200"
                        >
                            <RefreshCw size={20} />
                            Recargar Aplicación
                        </button>

                        {/* Detalles técnicos ocultos para depuración */}
                        <details className="mt-6 text-left text-[10px] text-slate-400 bg-slate-100 p-2 rounded cursor-pointer">
                            <summary>Ver detalle técnico (para soporte)</summary>
                            <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-32">
                                {this.state.error && this.state.error.toString()}
                            </pre>
                        </details>
                    </div>
                    <div className="mt-8 text-xs text-slate-400 font-medium">
                        MiNegocio POS • Sistema de Recuperación
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;