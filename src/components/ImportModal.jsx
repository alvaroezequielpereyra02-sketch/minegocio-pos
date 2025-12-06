import React, { useState } from 'react';
import { X, Upload, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ImportModal({ onClose, onImport }) {
    const [jsonText, setJsonText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleImport = async () => {
        if (!jsonText) return;
        setIsProcessing(true);
        setError('');

        try {
            const data = JSON.parse(jsonText);
            if (!Array.isArray(data)) throw new Error("El formato debe ser una lista de productos (Array)");

            await onImport(data);
            onClose();
            alert(`¡Éxito! Se importaron ${data.length} productos.`);
        } catch (e) {
            console.error(e);
            setError("JSON inválido o error al importar: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Upload className="text-blue-600" /> Importar Productos
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 border border-blue-100">
                        <p className="font-bold mb-1">Formato JSON requerido:</p>
                        <pre className="font-mono bg-white p-2 rounded border overflow-x-auto">
                            {`[
  {
    "name": "Coca Cola 1.5L",
    "price": 1500,
    "stock": 50,
    "category": "Bebidas",
    "imageUrl": "https://..."
  }
]`}
                        </pre>
                    </div>

                    <textarea
                        className="w-full h-48 p-3 border rounded-xl font-mono text-xs bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Pega aquí el JSON..."
                        value={jsonText}
                        onChange={(e) => setJsonText(e.target.value)}
                    ></textarea>

                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs flex items-center gap-2"><AlertTriangle size={14} /> {error}</div>}
                </div>

                <div className="pt-4 mt-2 border-t flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                    <button
                        onClick={handleImport}
                        disabled={isProcessing || !jsonText}
                        className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${isProcessing ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isProcessing ? 'Importando...' : <><CheckCircle size={18} /> Confirmar</>}
                    </button>
                </div>
            </div>
        </div>
    );
}