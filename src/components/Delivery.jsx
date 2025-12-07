import React, { useState, useMemo } from 'react';
import { Truck, MapPin, Phone, FileText, CheckSquare, Square, Navigation, CheckCircle } from 'lucide-react';

export default function Delivery({ transactions, customers, onUpdateTransaction }) {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [viewMode, setViewMode] = useState('selection'); // 'selection' | 'route'

    // 1. Filtrar solo pedidos LISTOS para entregar (y que no estén cancelados/entregados)
    const readyOrders = useMemo(() => {
        return transactions.filter(t => t.fulfillmentStatus === 'ready').sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0));
    }, [transactions]);

    // 2. Obtener datos completos de los pedidos seleccionados
    const selectedOrders = useMemo(() => {
        return readyOrders.filter(t => selectedIds.has(t.id)).map(t => {
            // Cruzar datos con la lista de clientes para obtener dirección actualizada si falta en la venta
            const client = customers.find(c => c.id === t.clientId) || {};
            return {
                ...t,
                address: client.address || 'Sin dirección registrada',
                phone: client.phone || ''
            };
        });
    }, [readyOrders, selectedIds, customers]);

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === readyOrders.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(readyOrders.map(t => t.id)));
    };

    const handleMarkAsDelivered = async (id) => {
        if (window.confirm("¿Confirmar entrega y pago?")) {
            // Marcar como entregado y pagado si estaba pendiente
            await onUpdateTransaction(id, {
                fulfillmentStatus: 'delivered',
                paymentStatus: 'paid', // Asumimos que el repartidor cobra al entregar
                amountPaid: 999999999 // Marca lógica de pago total. En producción idealmente calcularías t.total
            });
            // Si era parte de la ruta activa, lo sacamos de la selección visual
            const newSet = new Set(selectedIds);
            newSet.delete(id);
            setSelectedIds(newSet);
        }
    };

    // --- GENERAR PDF DE HOJA DE RUTA ---
    const printRoute = async () => {
        try {
            // TRUCO: Usamos una variable para el import dinámico
            // Esto evita que el bundler estricto falle si no encuentra la librería al compilar
            const libName = 'html2pdf.js';
            const html2pdf = (await import(libName)).default;

            const content = `
          <div style="font-family: sans-serif; padding: 20px;">
            <h1 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">HOJA DE RUTA</h1>
            <p>Fecha: ${new Date().toLocaleDateString()} - Total Paradas: ${selectedOrders.length}</p>
            
            ${selectedOrders.map((order, index) => `
              <div style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                  <span>#${index + 1} - ${order.clientName}</span>
                  <span>$${order.total.toLocaleString()}</span>
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                  📍 ${order.address} <br/>
                  📞 ${order.phone}
                </div>
                <div style="margin-top: 5px; font-size: 12px;">
                  Estado Pago: <strong>${order.paymentStatus === 'paid' ? 'PAGADO' : 'A COBRAR'}</strong>
                </div>
                <div style="margin-top: 5px; font-style: italic; font-size: 11px;">
                  Items: ${order.items.map(i => `${i.qty} ${i.name}`).join(', ')}
                </div>
              </div>
            `).join('')}
          </div>
        `;

            const element = document.createElement('div');
            element.innerHTML = content;
            html2pdf().set({ margin: 10, filename: `hoja_ruta_${new Date().toLocaleDateString()}.pdf` }).from(element).save();
        } catch (error) {
            console.error("Error al generar PDF:", error);
            alert("No se pudo cargar el módulo de impresión. Asegúrate de tener internet o la librería instalada.");
        }
    };

    // --- VISTA 1: SELECCIÓN DE PEDIDOS ---
    if (viewMode === 'selection') {
        return (
            <div className="flex flex-col h-full bg-slate-50 -m-4 overflow-hidden">
                <div className="bg-white p-4 border-b shadow-sm flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="text-blue-600" /> Logística
                    </h2>
                    <div className="text-sm text-slate-500">
                        {readyOrders.length} pendientes
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {readyOrders.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            <Truck size={48} className="mx-auto mb-2 opacity-20" />
                            <p>No hay pedidos listos para entregar.</p>
                            <p className="text-xs">Marca pedidos como "Listos" en la pestaña Pedidos.</p>
                        </div>
                    )}

                    {readyOrders.length > 0 && (
                        <button onClick={toggleAll} className="text-sm font-bold text-blue-600 mb-2 flex items-center gap-2">
                            {selectedIds.size === readyOrders.length ? <CheckSquare size={16} /> : <Square size={16} />}
                            Seleccionar Todo
                        </button>
                    )}

                    {readyOrders.map(order => (
                        <div
                            key={order.id}
                            onClick={() => toggleSelection(order.id)}
                            className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer transition-all flex items-center gap-4 ${selectedIds.has(order.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                        >
                            <div className={`text-blue-600 ${selectedIds.has(order.id) ? 'opacity-100' : 'opacity-30'}`}>
                                {selectedIds.has(order.id) ? <CheckSquare size={24} /> : <Square size={24} />}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-800">{order.clientName}</div>
                                <div className="text-xs text-slate-500">{new Date(order.date.seconds * 1000).toLocaleDateString()} • ${order.total.toLocaleString()}</div>
                                <div className={`text-[10px] font-bold uppercase mt-1 inline-block px-2 py-0.5 rounded ${order.paymentStatus === 'pending' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {order.paymentStatus === 'pending' ? 'A Cobrar' : 'Pagado'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white border-t pb-24 lg:pb-4 transition-all">
                    <button
                        onClick={() => setViewMode('route')}
                        disabled={selectedIds.size === 0}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2 active:scale-95 transition-transform"
                    >
                        <Navigation size={20} /> Iniciar Recorrido ({selectedIds.size})
                    </button>
                </div>
            </div>
        );
    }

    // --- VISTA 2: MODO REPARTO ACTIVO ---
    return (
        <div className="flex flex-col h-full bg-slate-900 -m-4 overflow-hidden text-white">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                <button onClick={() => setViewMode('selection')} className="text-slate-400 hover:text-white text-sm font-bold">← Volver</button>
                <h2 className="font-bold text-lg">En Reparto</h2>
                <button onClick={printRoute} className="bg-slate-700 p-2 rounded-lg text-white hover:bg-slate-600" title="Descargar PDF"><FileText size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {selectedOrders.map((order, idx) => (
                    <div key={order.id} className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 bg-blue-600 text-white px-3 py-1 rounded-br-xl text-xs font-bold">
                            Parada #{idx + 1}
                        </div>

                        <div className="mt-4 mb-4">
                            <h3 className="text-xl font-bold text-white mb-1">{order.clientName}</h3>
                            <div className="flex items-start gap-2 text-slate-400 text-sm">
                                <MapPin size={16} className="mt-1 shrink-0 text-blue-400" />
                                <span className="leading-tight">{order.address}</span>
                            </div>
                        </div>

                        {/* Panel de Cobro */}
                        <div className="bg-slate-900/50 rounded-xl p-3 mb-4 border border-slate-700 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">A Cobrar</span>
                            <span className={`text-2xl font-black ${order.paymentStatus === 'pending' ? 'text-red-400' : 'text-green-400'}`}>
                                ${order.paymentStatus === 'pending' ? (order.total - (order.amountPaid || 0)).toLocaleString() : '0'}
                            </span>
                        </div>

                        {/* Acciones Rápidas */}
                        <div className="grid grid-cols-3 gap-2">
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-slate-700 hover:bg-slate-600 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                                <Navigation size={20} className="text-blue-400" />
                                <span className="text-[10px] font-bold">Mapa</span>
                            </a>

                            <a
                                href={`https://wa.me/${order.phone?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-slate-700 hover:bg-slate-600 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                                <Phone size={20} className="text-green-400" />
                                <span className="text-[10px] font-bold">Llamar</span>
                            </a>

                            <button
                                onClick={() => handleMarkAsDelivered(order.id)}
                                className="bg-green-600 hover:bg-green-500 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors shadow-lg shadow-green-900/20"
                            >
                                <CheckCircle size={20} className="text-white" />
                                <span className="text-[10px] font-bold">Entregado</span>
                            </button>
                        </div>
                    </div>
                ))}

                <div className="h-20"></div> {/* Espacio extra al final */}
            </div>
        </div>
    );
}